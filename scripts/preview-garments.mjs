/**
 * Checks every garment against every body, and draws the result.
 *
 *     node --experimental-strip-types scripts/preview-garments.mjs
 *
 * Two jobs, both about the one rule that can silently break the visualizer:
 * **a garment must cover every zone it claims to cover.** Coverage erases part
 * of the mannequin photograph, so a garment that claims the thigh but stops
 * above the knee leaves a hole where a leg used to be — and nothing in the type
 * system can catch that, because it is a fact about geometry.
 *
 *   1. It reports, per garment and per body, how many body pixels are erased by
 *      coverage and left unpainted. Anything above a rounding error is a hole.
 *   2. It writes `.preview/garment-<body>.png` so the fit can be looked at.
 *
 * It reads the real records and the real drawings — there is no second copy of
 * the geometry to drift.
 */

import { writeFileSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { decodePngAlpha, encodePng } from "./mannequin/png.mjs";
import { measureBody } from "./measure-body.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, ".preview");
const ART_DIR = join(ROOT, "src", "lib", "garments", "art");

const src = (p) => pathToFileURL(join(ROOT, p)).href;
const { bodies, BODY_CANVAS } = await import(src("src/lib/mannequin/bodies.ts"));
const { garments, garmentsFor, LAYER_ORDER } = await import(src("src/lib/data/garments.ts"));
const { collars, collarsFor, collarsForGarment } = await import(
  src("src/lib/data/collars.ts")
);
/*
  The collar geometry, imported for real rather than evaluated out of its
  source. It can be: `collar.ts` is plain TypeScript with no imports at all, so
  node strips its types and runs it. The yoke files cannot be — they import
  through the "@/" alias, which nothing resolves here — which is why those are
  still read with `constTable` below, and why every helper in them has to stay
  a single expression.

  Seeding these means a path written as `blade(LEAF, BOWS)` resolves to the
  same string the browser draws. Without it such a path silently fails to
  evaluate, `artPaths` never sees it, and every check in this file then passes
  against whatever pieces of the collar happened to be written out longhand.
*/
const COLLAR_KIT = await import(src("src/lib/garments/collar.ts"));

/*
  And the same for the drafting kit, for exactly the same reason and with more
  riding on it. Every garment outline in the wardrobe is now built by `setIn`,
  `trousers` or `column` rather than typed out, so without these in the seed not
  one `*_PATH` resolves — and `artPaths` would then measure a wardrobe of empty
  strings and report it green. The failure mode of a silent evaluator is always
  a pass.
*/
const FIT_KIT = await import(src("src/lib/garments/fit.ts"));

/*
  And the sleeves: every top with a choice of sleeve draws its cloth through
  `top` and `clothOf`, so a drawing's `CLOTH` resolves only if they are seeded.
*/
const SLEEVE_KIT = await import(src("src/lib/garments/sleeves.ts"));
const { SLEEVE_KINDS, sleeveCoverage } = SLEEVE_KIT;

/* The fifteen cuts, and what each of them bares — see `garments/necklines.ts`. */
const { LOPSIDED, NECKLINE_BARES, NECKLINE_BARE_SHOULDERS, NECKLINE_OPENING, NECKLINE_SLEEVES } = await import(
  src("src/lib/garments/necklines.ts")
);

/* The measured body itself, for the checks that compare cloth against it. */
const { edgeAt, edgeEnd, profileFor } = await import(
  src("src/lib/mannequin/profile.ts")
);

const W = BODY_CANVAS.width;
const H = BODY_CANVAS.height;
/** Samples per axis. Coverage is a yes/no question, so 2 is plenty. */
const SS = 2;

/* ------------------------------------------------------------ path parsing */

/** Flatten an SVG path into polygons. Supports the subset the art uses. */
function flatten(d) {
  const tokens = d.match(/[MLHVCQZmlhvcqz]|-?\d*\.?\d+/g) ?? [];
  const polys = [];
  let poly = null;
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let i = 0;
  let cmd = "M";

  const num = () => Number(tokens[i++]);
  const push = (px, py) => {
    poly.push([px, py]);
    x = px;
    y = py;
  };
  const curve = (pts, steps = 18) => {
    for (let s = 1; s <= steps; s++) push(...pts(s / steps));
  };

  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++];
    switch (cmd) {
      case "M": {
        if (poly && poly.length > 1) polys.push(poly);
        poly = [];
        const nx = num();
        const ny = num();
        push(nx, ny);
        startX = nx;
        startY = ny;
        cmd = "L"; // repeated pairs after an M are implicit line-tos
        break;
      }
      case "L":
        push(num(), num());
        break;
      case "H":
        push(num(), y);
        break;
      case "V":
        push(x, num());
        break;
      case "C": {
        const [x0, y0] = [x, y];
        const c1x = num();
        const c1y = num();
        const c2x = num();
        const c2y = num();
        const ex = num();
        const ey = num();
        curve((t) => {
          const u = 1 - t;
          return [
            u ** 3 * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t ** 3 * ex,
            u ** 3 * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t ** 3 * ey,
          ];
        });
        break;
      }
      case "Q": {
        const [x0, y0] = [x, y];
        const cx = num();
        const cy = num();
        const ex = num();
        const ey = num();
        curve((t) => {
          const u = 1 - t;
          return [
            u * u * x0 + 2 * u * t * cx + t * t * ex,
            u * u * y0 + 2 * u * t * cy + t * t * ey,
          ];
        });
        break;
      }
      case "Z":
      case "z":
        if (poly) {
          push(startX, startY);
          if (poly.length > 2) polys.push(poly);
          poly = [];
          poly.push([startX, startY]);
        }
        break;
      default:
        i++; // an unsupported command: skip its number rather than loop forever
    }
  }
  if (poly && poly.length > 2) polys.push(poly);
  return polys;
}

/**
 * Rasterize polygons into a coverage buffer with the non-zero winding rule —
 * the same rule the browser uses, so what this sees is what the page draws.
 */
function fillPolys(polys, buf, w, h, ss) {
  const edges = [];
  for (const poly of polys) {
    for (let k = 0; k < poly.length - 1; k++) {
      const [x0, y0] = poly[k];
      const [x1, y1] = poly[k + 1];
      if (y0 !== y1) edges.push([x0, y0, x1, y1]);
    }
    // Close any polygon the path left open.
    const [fx, fy] = poly[0];
    const [lx, ly] = poly[poly.length - 1];
    if (fy !== ly) edges.push([lx, ly, fx, fy]);
  }

  const hits = [];
  for (let sy = 0; sy < h * ss; sy++) {
    const y = (sy + 0.5) / ss;
    hits.length = 0;
    for (const [x0, y0, x1, y1] of edges) {
      if (y < Math.min(y0, y1) || y >= Math.max(y0, y1)) continue;
      const t = (y - y0) / (y1 - y0);
      hits.push([x0 + t * (x1 - x0), y1 > y0 ? 1 : -1]);
    }
    if (hits.length === 0) continue;
    hits.sort((a, b) => a[0] - b[0]);

    let winding = 0;
    for (let k = 0; k < hits.length - 1; k++) {
      winding += hits[k][1];
      if (winding === 0) continue;
      const from = hits[k][0];
      const to = hits[k + 1][0];
      for (let sx = Math.max(0, Math.ceil(from * ss - 0.5)); sx < w * ss; sx++) {
        const x = (sx + 0.5) / ss;
        if (x >= to) break;
        buf[Math.floor(sy / ss) * w + Math.floor(x)] += 1;
      }
    }
  }
}

/* --------------------------------------------------------- the body itself */

/**
 * Where the body actually is, 0–1 per canvas pixel, read from the shipped
 * photograph's alpha rather than from whatever produced it.
 */
function bodyCoverage(body) {
  const file = join(ROOT, "public", body.view.front);
  const { width, height, alpha } = decodePngAlpha(readFileSync(file));

  // The photograph is drawn to fill the canvas box, so the mapping is a
  // straight scale; average the source pixels landing on each canvas pixel.
  const cover = new Float32Array(W * H);
  const sx = width / W;
  const sy = height / H;

  for (let y = 0; y < H; y++) {
    const y0 = Math.floor(y * sy);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    for (let x = 0; x < W; x++) {
      const x0 = Math.floor(x * sx);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      let sum = 0;
      let n = 0;
      for (let py = y0; py < y1 && py < height; py++) {
        for (let px = x0; px < x1 && px < width; px++) {
          sum += alpha[py * width + px];
          n++;
        }
      }
      cover[y * W + x] = n > 0 ? sum / n / 255 : 0;
    }
  }
  return cover;
}

/* ------------------------------------------------------------- the drawings */

/**
 * `"male-thobe-front"` → `male/thobe.tsx`, the file the asset id names.
 *
 * The body prefix is anchored rather than inferred, so a drawing filed under
 * the wrong body is an error here instead of a garment quietly cut against the
 * wrong anchors.
 */
const camel = (piece) => piece.replace(/-(\w)/g, (_, c) => c.toUpperCase());

function artFile(assetId) {
  // Collars first: `female-peter-pan-collar-front` is a valid garment asset id
  // by shape, and would otherwise be looked for as `female/peterPanCollar.tsx`.
  // `behind` is a layer within the front view, not a camera angle — but it
  // resolves to the same file, because both halves of a band are one drawing.
  const collar = /^(female|male)-(.+)-collar-(front|behind)$/.exec(assetId);
  // `front` only: the visualizer draws one view and the type now says so.
  const named = /^(female|male)-(.+)-(front)$/.exec(assetId);
  if (!collar && !named) {
    throw new Error(`Asset id "${assetId}" is not <body>-<piece>-<view>`);
  }
  const [, body, piece] = collar ?? named;
  const dir = collar ? join(body, "collars") : body;
  const stem = camel(piece);
  const file = readdirSync(join(ART_DIR, dir)).find((f) => f === `${stem}.tsx`);
  if (!file) {
    throw new Error(`No drawing for "${assetId}" (${dir}/${stem}.tsx)`);
  }
  return join(dir, file);
}

/**
 * Resolve the plain-value `const`s in some sources.
 *
 * A garment outline is assembled from pieces — the shared yoke, its own sides,
 * its own neckline — so reading the literals out is not enough; the references
 * have to be followed. Anything that is not a plain value (a drawing, a call
 * into the shading helpers) simply fails to evaluate and is skipped.
 */
/**
 * Two seed modules may not offer the same name.
 *
 * `collar.ts` exports `mirror`, which reflects a path string; `fit.ts` had one
 * that reflects a list of points. Spread into one object the second silently
 * replaced the first, every collar drawing then called it with a string, the
 * `TypeError` was swallowed by the `catch` below, and three male collars went
 * on to be measured from whatever constants had still resolved — reporting as
 * *drawn too small* rather than as broken. An evaluator that fails quietly
 * always fails toward a pass, so the one thing it must not do is let a name be
 * quietly redefined.
 */
function seedOf(...kits) {
  const seed = {};
  const from = new Map();
  for (const [name, kit] of kits) {
    for (const key of Object.keys(kit)) {
      if (from.has(key)) {
        throw new Error(
          `${name} and ${from.get(key)} both export "${key}" — ` +
            `rename one, or a drawing gets whichever was spread last`
        );
      }
      from.set(key, name);
      seed[key] = kit[key];
    }
  }
  return seed;
}

function constTable(sources, seed = {}) {
  const decls = [];
  for (const source of sources) {
    for (const m of source.matchAll(
      /(?:export\s+)?const\s+(\w+)\s*(?::[^=]+)?=\s*([\s\S]*?);\n/g
    )) {
      decls.push([m[1], m[2]]);
    }
  }

  // Values the drawings import rather than declare — the anchor table.
  const values = new Map(Object.entries(seed));
  for (let pass = 0; pass < 4; pass++) {
    for (const [name, expr] of decls) {
      if (values.has(name)) continue;
      const known = [...values.keys()];
      try {
        const js = expr
          // `as const` is one piece of TypeScript that reaches these values…
          .replace(/\s+as\s+const\s*$/, "")
          // …and a typed parameter is the other. The yoke builds its bands
          // from small helpers — `standFront(rise)` and the rest — and those
          // take annotated arguments, which this evaluator runs as plain JS —
          // optional ones too, whose `?` has to go with the annotation.
          // Without stripping them the helper silently fails to resolve, every
          // path built from it goes missing, and the collars are then checked
          // against art that consists of whatever was left.
          .replace(
            /\(([^()]*)\)\s*=>/g,
            (_, params) => `(${params.replace(/\??\s*:\s*[^,]+/g, "")}) =>`
          );
        values.set(
          name,
          new Function(...known, `return (${js});`)(
            ...known.map((k) => values.get(k))
          )
        );
      } catch {
        // Not a plain value, or its references are not resolved yet.
      }
    }
  }
  return values;
}

/** Every resolvable constant in a drawing, its yoke included. */
function artTable(assetId, body) {
  return constTable(
    [
      readFileSync(join(ART_DIR, body.id, "yoke.ts"), "utf8"),
      readFileSync(join(ART_DIR, artFile(assetId)), "utf8"),
    ],
    {
      // Both yoke files alias their own table to `ANCHORS`, so one seed name
      // serves either body — and a drawing may reference the anchors directly.
      ANCHORS: body.anchors,
      // `blade`, `mirror`, `shrink`, `setIn`, `trousers`, `column` and the
      // rest of both kits, as the real functions — and no name from one
      // quietly standing in for a name from the other.
      ...seedOf(["collar.ts", COLLAR_KIT], ["fit.ts", FIT_KIT], ["sleeves.ts", SLEEVE_KIT]),
    }
  );
}

/**
 * Every `*_PATH` constant in a drawing — the cloth it actually paints.
 *
 * Two conventions live in the names, and both exist so that one file can hold
 * more than one version of a piece without this having to union them:
 *
 *   • `X_BEHIND_PATH` belongs to the `behindBody` layer, drawn under the
 *     photograph. It is *excluded* from the front layer, because a band round
 *     the back of the neck is not cloth on the chest and every front-layer rule
 *     would rightly reject it.
 *   • A shading mark — a rib, a crease, the shadow under a fold — is **not**
 *     named `*_PATH` at all, and so never reaches here. `RIB_PATH`,
 *     `CLOSURE_PATH` and their like were, and they were measured as part of the
 *     collar's own outline: a rib drawn as five straight strokes inside a knit
 *     tube counted against the straight-edge budget as if the tube itself had
 *     been drawn with a ruler. Cloth is `*_PATH`; marks on it are not.
 *   • `X_CAST_PATH` is a **shadow**, not cloth: the shape a piece throws onto
 *     whatever lies beneath it, drawn through `RegionDrawing.cast`. It is
 *     excluded everywhere. Counted as cloth it inflates the collar's measured
 *     footprint past what its record declares, and — because a shadow lands
 *     outside the piece by definition — it reports as cloth hanging over
 *     nothing. Neither is true of a shadow.
 *   • `X_HIGH_PATH` is the `high`-neckline cut of `X_PATH`. Asking for `high`
 *     takes it and drops its plain counterpart; asking for anything else drops
 *     it. Unioning the two would produce a garment with the *shallowest* of the
 *     openings — a shape nothing renders — and every coverage check would then
 *     pass against art no one can see.
 */
/**
 * Art whose outlines are **generated**, imported rather than evaluated.
 *
 * `constTable` reads a drawing by evaluating its `const` declarations out of
 * the source, which works beautifully for a typed-out path and not at all for a
 * cut that is drafted per neckline: it cannot call a `function`, and it stops at
 * the first semicolon inside an arrow body. Fifteen generated bodices are
 * exactly the shape of thing it cannot see — and a drawing this file cannot see
 * is a drawing none of its rules apply to, which is how the male collars once
 * drifted into a trapezoid on a collarbone with every check passing.
 *
 * So a garment whose cuts are generated keeps them in a plain `.ts` module with
 * no JSX, and that module is imported here for real. One geometry, two readers.
 */
const CUT_MODULES = {
  "female-dress-front": await import(
    src("src/lib/garments/art/female/dressCut.ts")
  ),
};

/**
 * Collars whose drawing follows the cut they are sewn to — a Peter Pan along a
 * scoop's own line rather than a crew neck's, a sailor collar down a V — are
 * drafted in a plain module for the same reason, and read from it here, on
 * every cut they are sewn to.
 */
const { COLLAR_CLOTH } = await import(src("src/lib/garments/art/female/collarCuts.ts"));

/** Every cut a generated drawing offers, or `[]` for a typed-out one. */
const cutsOf = (assetId) =>
  CUT_MODULES[assetId] ? Object.keys(CUT_MODULES[assetId].NECKLINE_PATHS) : [];

/** The sleeve a drawing arrives in, from its garment's record. */
const defaultSleeveOf = (assetId) =>
  garments.find((g) => g.asset.front === assetId)?.sleeves?.default;

function artPaths(assetId, body, { behind = false, opening = null, cut = null, sleeve = null, inside = null } = {}) {
  if (COLLAR_CLOTH[assetId] && !behind) return COLLAR_CLOTH[assetId](cut ?? undefined);
  const generated = CUT_MODULES[assetId];
  if (generated && !behind) {
    return generated.cloth(cut ?? undefined, sleeve ?? defaultSleeveOf(assetId), inside ?? undefined);
  }

  const table = artTable(assetId, body);
  /* under a jacket's hem: the drawing's own tucked cut, where it has one — see `tucked` */
  const tuckedFn = table.get("TUCKED");
  if (inside && !behind && typeof tuckedFn === "function") return tuckedFn(inside);
  /*
    A top with a choice of sleeve draws its body and sleeves through `CLOTH`,
    for one sleeve and one opening; its other pieces — a placket — are still
    named paths, and are added below as before.
  */
  const clothFn = table.get("CLOTH");
  const drafted =
    typeof clothFn === "function" && !behind
      ? clothFn(sleeve ?? defaultSleeveOf(assetId), opening === "high", inside ?? undefined)
      : [];
  const names = [...table.keys()].filter(
    (n) => n.endsWith("_PATH") && typeof table.get(n) === "string"
  );
  const wanted = names.filter((n) => {
    if (n.endsWith("_CAST_PATH")) return false;
    const isBehind = n.endsWith("_BEHIND_PATH");
    if (behind !== isBehind) return false;
    const isHigh = n.endsWith("_HIGH_PATH");
    if (opening === "high") {
      // the plain counterpart of a variant that exists is not drawn
      return isHigh || !names.includes(n.replace(/_PATH$/, "_HIGH_PATH"));
    }
    return !isHigh;
  });
  const out = [...drafted, ...wanted.map((n) => table.get(n))];
  if (out.length === 0 && !behind) {
    throw new Error(`No outline found for "${assetId}"`);
  }
  return out;
}

/**
 * The neckline a collar is sewn into, as a polyline.
 *
 * Each collar-accepting drawing exports it as `NECK_SEAM` — an open line rather
 * than an area, which is why it is deliberately not named `*_PATH` and does not
 * end up in the cloth above.
 */
function neckSeam(assetId, body, opening = null, cut = null) {
  const generated = CUT_MODULES[assetId];
  if (generated) {
    // A generated drawing has one seam per cut, and the cut owns the opening.
    const d = generated.NECKLINE_SEAMS[cut ?? generated.DEFAULT_CUT];
    return typeof d === "string" && d.length > 0 ? flatten(d).flat() : null;
  }
  const table = artTable(assetId, body);
  // A collar is sewn to the opening it asked for, so that is the seam to walk.
  const key = opening === "high" ? "NECK_SEAM_HIGH" : "NECK_SEAM";
  const d = table.get(key) ?? table.get("NECK_SEAM");
  if (typeof d !== "string") return null;
  return flatten(d).flat();
}

/* -------------------------------------------------------------------- main */

mkdirSync(OUT_DIR, { recursive: true });

const zoneCache = new Map();
const zoneMask = (body, zone) => {
  const key = `${body.id}:${zone}`;
  let m = zoneCache.get(key);
  if (!m) {
    m = new Float32Array(W * H);
    fillPolys(flatten(body.zones[zone]), m, W, H, SS);
    zoneCache.set(key, m);
  }
  return m;
};

let failures = 0;

/** Fill a set of paths into one buffer. */
function rasterize(paths) {
  const buf = new Float32Array(W * H);
  for (const d of paths) fillPolys(flatten(d), buf, W, H, SS);
  return buf;
}

/**
 * Every pixel a coverage claim erases from the body — the same rule the
 * renderer uses: covered, and not also claimed by something left uncovered.
 */
function erasedZones(body, coverage) {
  const erased = new Float32Array(W * H);
  for (const zone of coverage) {
    const m = zoneMask(body, zone);
    for (let i = 0; i < erased.length; i++) erased[i] = Math.max(erased[i], m[i]);
  }
  for (const zone of Object.keys(body.zones)) {
    if (coverage.includes(zone)) continue;
    const m = zoneMask(body, zone);
    for (let i = 0; i < erased.length; i++) if (m[i] > 0) erased[i] = 0;
  }
  return erased;
}

/** Body that is erased and painted by nothing in `layers`. Holes, in a word. */
function countHoles(cover, erased, layers, holeMap) {
  let holes = 0;
  const at = { x0: W, y0: H, x1: 0, y1: 0 };
  for (let i = 0; i < cover.length; i++) {
    if (cover[i] <= 0.5 || erased[i] <= 0.5) continue;
    if (layers.some((paint) => paint[i] >= 0.5)) continue;
    holes++;
    if (holeMap) holeMap[i] = 1;
    const x = i % W;
    const y = (i / W) | 0;
    at.x0 = Math.min(at.x0, x);
    at.y0 = Math.min(at.y0, y);
    at.x1 = Math.max(at.x1, x);
    at.y1 = Math.max(at.y1, y);
  }
  return { holes, at };
}

/** The silhouette's left and right edge on every row, read from the alpha. */
function edgeRows(cover) {
  const rows = [];
  for (let y = 0; y < H; y++) {
    let lo = W;
    let hi = -1;
    for (let x = 0; x < W; x++) {
      if (cover[y * W + x] <= 0.5) continue;
      if (x < lo) lo = x;
      if (x > hi) hi = x;
    }
    rows[y] = hi < 0 ? null : { lo, hi, width: hi - lo };
  }
  return rows;
}

/**
 * How far each yoke stands off the shoulder it is drawn over.
 *
 * The shoulder is the one part of a dressed figure no coverage zone reaches —
 * `torso` starts at y=268 and `upperArm` at y=230 — so a seam that cuts inside
 * the body and shows a stripe of skin above the garment passes every other
 * check in this file. This is what watches it, and it is the only reason
 * "check:garments is still green" means anything after a yoke is re-solved.
 *
 * The stand-off is reported rather than bounded above: how much ease a shoulder
 * wants is a question about cloth, not about correctness. Cutting *into* the
 * body is a defect on any figure, and that is what fails.
 */
const SEAM_MIN = 2;

function checkSeams(bodyKey, rows, body) {
  const table = constTable(
    [readFileSync(join(ART_DIR, body.id, "yoke.ts"), "utf8")],
    {
      ANCHORS: body.anchors,
      // The yoke builds its two shoulder seams with `seamPair` now, so
      // without the kit here `YOKE_START` does not resolve and this check
      // reports the one thing it exists to catch as simply missing.
      ...seedOf(["collar.ts", COLLAR_KIT], ["fit.ts", FIT_KIT]),
    }
  );

  const problems = [];
  for (const name of ["YOKE_START", "OUTER_YOKE_START"]) {
    const d = table.get(name);
    if (typeof d !== "string") {
      problems.push(`${name} did not resolve to a path`);
      continue;
    }

    const [seam] = flatten(d);
    let min = Infinity;
    let max = 0;
    let widest = 0;
    /*
      Measured from where the seam leaves the throat, not from a fixed share of
      its length.

      A shoulder seam starts *on* the body at the neck point and runs outward,
      so its first stretch is inboard of the silhouette by construction — and
      what is above it there is neck, which is drawn. It was skipping the first
      tenth of the points instead, which worked while the seam was one cubic
      flattened into eighteen steps and stopped working the moment it became a
      walked edge with ten times as many. The honest bound is the throat itself:
      past its edge, anything above the seam is sky.
    */
    const profile = profileFor(bodyKey);
    for (let i = 0; i < seam.length; i++) {
      const [x, y] = seam[i];
      const throat = edgeAt(profile.neckLeft, y);
      if (throat !== null && x >= throat - 1) continue;
      const row = rows[Math.round(y)];
      if (!row) continue;
      const clear = row.lo - x;
      if (clear < min) min = clear;
      if (clear > max) {
        max = clear;
        widest = Math.round(y);
      }
    }

    console.log(
      `     ${bodyKey.padEnd(6)} ${name.padEnd(16)} ` +
        `stands ${min.toFixed(1)}–${max.toFixed(1)} off the shoulder` +
        `, widest at y ${widest}`
    );
    if (min <= SEAM_MIN) {
      problems.push(
        `${name} comes within ${min.toFixed(1)} of the body — the seam has cut` +
          ` into the shoulder and skin will show above the garment`
      );
    }
  }

  for (const problem of problems) {
    console.log(`HOLE ${bodyKey.padEnd(6)} seam      ${problem}`);
  }
  return problems.length;
}

/**
 * Does this body meet the skeleton the garments are cut to?
 *
 * `BODY_ANCHORS` is the contract every drawing is built against, and a new
 * figure is valid exactly when it hits these numbers — so they are checked
 * rather than merely written down. Everything between them is free to differ.
 */
function checkAnchors(bodyKey, cover, rows, anchors) {
  const at = (y) => rows[Math.round(y)];
  const { centerX, crownY, chinY, shoulderY, shoulderX, crotchY, kneeY, floorY } =
    anchors;
  const first = rows.findIndex(Boolean);
  const last = rows.length - 1 - [...rows].reverse().findIndex(Boolean);

  const problems = [];
  const near = (what, actual, want, slack) => {
    if (Math.abs(actual - want) > slack) {
      problems.push(`${what} is at y ${actual}, expected ~${want}`);
    }
  };

  near("crown", first, crownY, 6);
  near("floor", last, floorY, 6);

  // The shoulder seam is drawn at shoulderX; the body may not reach past it.
  const shoulder = at(shoulderY);
  if (shoulder.lo < shoulderX.left || shoulder.hi > shoulderX.right) {
    problems.push(
      `shoulders span ${shoulder.lo}–${shoulder.hi}, past ${shoulderX.left}–${shoulderX.right}`
    );
  }

  // A neck the shoulders do not flare out from is not a neck.
  const neck = at((chinY + shoulderY) / 2);
  if (neck.width >= shoulder.width * 0.75) {
    problems.push(`neck is ${neck.width} wide against shoulders of ${shoulder.width}`);
  }

  // The legs have to have parted by mid-thigh, or trousers make no sense.
  const thigh = Math.round((crotchY + kneeY) / 2);
  if (cover[thigh * W + centerX] > 0.5) {
    problems.push("legs have not parted by mid-thigh");
  }

  // A figure off the centre line puts every garment off it too.
  for (const y of [shoulderY, crotchY, kneeY]) {
    const row = at(y);
    const drift = Math.abs(centerX - row.lo - (row.hi - centerX));
    if (drift > 8) problems.push(`row ${y} is ${drift} off centre`);
  }

  for (const problem of problems) {
    console.log(`HOLE ${bodyKey.padEnd(6)} anchors   ${problem}`);
  }
  return problems.length;
}

/**
 * Is this body's wardrobe a wardrobe?
 *
 * Coverage was never the thing that let a dress onto the male mannequin —
 * eligibility was, and nothing expressed it. A garment is cut for exactly one
 * figure, so every garment must name a body that exists, must be offered on
 * that body and no other, and every body must have something to wear.
 */
function checkWardrobe(bodyKey) {
  const problems = [];

  for (const g of garmentsFor(bodyKey)) {
    if (g.gender !== bodyKey) {
      problems.push(`${g.id} is cut for ${g.gender} but offered on ${bodyKey}`);
    }
  }
  if (garmentsFor(bodyKey).length === 0) {
    problems.push(`no garment is cut for ${bodyKey}`);
  }

  for (const problem of problems) {
    console.log(`WRONG ${bodyKey.padEnd(6)} wardrobe  ${problem}`);
  }
  return problems.length;
}

/* ------------------------------------------------------------- how it fits */

/**
 * Four checks, one per complaint the wardrobe was rebuilt to answer.
 *
 * Coverage was the only thing measured here before, and coverage is blind to
 * every one of them: a garment can be a perfectly sealed slab with a crooked
 * shoulder, a wedge under each arm and no daylight anywhere, and report zero
 * pixels uncovered. It did, for a long time. These measure the *shape* of what
 * is drawn against the shape of the body underneath it.
 */

/**
 * How far apart the two sides of a garment may sit, in canvas units.
 *
 * Two, which is under half a centimetre. The rasteriser's own edge is worth
 * about one, so this is as tight as the measurement allows.
 */
/* ------------------------------------------------------------- stand-off */

/**
 * Does the cloth hang **on** the body, or around it?
 *
 * Read at the body's own landmarks — its waist, its hip, and a thigh row below
 * the hands — and **each side separately**, against the photograph rather than
 * the folded profile. Separately, because the fault this exists for was
 * invisible folded: both photographs sat 2.5 units right of the axis every
 * garment is mirrored about, so the cloth stood ten units off one hip and five
 * off the other, and a profile that folds the two sides together reads that as
 * a comfortable seven and a half.
 *
 * Two limits. How far off the body a close-cut garment may stand at all; and
 * how different the two sides may be, which is the one that catches a garment
 * cut about a different line from the body wearing it.
 */

/** The most a close-cut garment may stand off the body, on either side. */
const MAX_STANDOFF = 9;
/** A coat is cut to go over a top, so it is allowed that top's thickness. */
const MAX_STANDOFF_OUTER = 12;
/** How much further off one side may be than the other. */
const MAX_SIDE_SKEW = 2;

/** A run along one row, grown out from `x`. */
function runAt(grid, y, x, on) {
  if (!on(grid[y * W + x])) return null;
  let lo = x;
  let hi = x;
  while (lo > 0 && on(grid[y * W + lo - 1])) lo--;
  while (hi < W - 1 && on(grid[y * W + hi + 1])) hi++;
  return [lo, hi];
}

function checkStandOff(bodyKey, label, garment, cloth, cover, profile) {
  const solid = (v) => v >= 0.5;
  const reads = [];

  /*
    The trunk: the body's run across the centre line, and on each side the
    cloth lying over that side's edge. Read from the body's edge rather than
    from the centre, because a garment may be open at the centre — a jacket
    falls away below its button — and it still has to sit on the hips.
  */
  for (const [name, y] of [["waist", profile.waistY], ["hip", profile.hipY]]) {
    const b = runAt(cover, y, W / 2, solid);
    const l = b && runAt(cloth, y, b[0], solid);
    const r = b && runAt(cloth, y, b[1], solid);
    if (l && r) reads.push([name, y, b[0] - l[0], r[1] - b[1]]);
  }

  /* A thigh, below where the hands end: each leg's own run. */
  const thighY = Math.max(profile.crotchY + 40, profile.armEndY + 12);
  if (!solid(cloth[thighY * W + W / 2])) {
    let l = null;
    let r = null;
    for (let x = W / 2; x > 0 && !l; x--) l = runAt(cloth, thighY, x, solid);
    for (let x = W / 2; x < W - 1 && !r; x++) r = runAt(cloth, thighY, x, solid);
    const bl = l && runAt(cover, thighY, Math.round((l[0] + l[1]) / 2), solid);
    const br = r && runAt(cover, thighY, Math.round((r[0] + r[1]) / 2), solid);
    if (bl && br) reads.push(["thigh", thighY, bl[0] - l[0], r[1] - br[1]]);
  }

  if (reads.length === 0) return 0;
  const limit = garment.category === "outerwear" ? MAX_STANDOFF_OUTER : MAX_STANDOFF;
  const problems = [];
  let far = 0;
  let skew = 0;
  for (const [name, y, gl, gr] of reads) {
    far = Math.max(far, gl, gr);
    skew = Math.max(skew, Math.abs(gl - gr));
    if (Math.max(gl, gr) > limit) {
      problems.push(
        `stands ${Math.max(gl, gr)} units off the ${name} at y ${y} (limit ${limit}) — ` +
          `cloth placed around the body rather than hanging on it`
      );
    }
    if (Math.abs(gl - gr) > MAX_SIDE_SKEW) {
      problems.push(
        `is ${gl} off the left of the ${name} and ${gr} off the right at y ${y} — ` +
          `cut about a different line from the body wearing it`
      );
    }
  }
  const ok = problems.length === 0;
  console.log(
    `${ok ? "ok  " : "HOLE"} ${bodyKey.padEnd(6)} ${label.padEnd(21)} ` +
      `stands ${far} off the body at most, sides within ${skew}`
  );
  for (const problem of problems) {
    console.log(`     ${bodyKey.padEnd(6)} fit       ${label} ${problem}`);
  }
  return ok ? 0 : 1;
}

const MAX_LOPSIDED = 2.5;

/**
 * Is the garment the same on both sides?
 *
 * Clothes are cut symmetrically, and the reason this needs saying is that the
 * shoulder seams were written out twice — once for the left and once for the
 * right, under a comment claiming the second was a reflection of the first. It
 * was not, by 5.2 units at the steepest part of the slope, and that is what a
 * crooked shoulder is.
 *
 * Measured as the **edge's** displacement, row by row, and not as the share of
 * area that differs. Area is the obvious measure and it is far too blunt: the
 * old crooked yoke differed over so small a patch that it scored 0.5% against
 * a corrected 0.3%, which no threshold can separate from noise. The eye is not
 * reading area. It is reading where one outline sits against the other, and
 * five units at the shoulder is five units whatever the garment's acreage.
 */
/**
 * How many rows below a garment's top edge the rule starts.
 *
 * The neckline is the one part of a garment that is deliberately **not**
 * symmetric about the canvas: it is cut to the throat, and the throat is not on
 * the trunk's axis — hers sits three units left of it. For the few rows where the collar points
 * are the widest thing the garment has, that offset is the whole measurement —
 * it reported his t-shirt as five units lopsided, which is true and is not the
 * defect this is looking for. A row or two lower the shoulder seams take over
 * and those must mirror exactly.
 */
const SYMMETRY_FROM = 8;

/**
 * How far the neck column's centre sits off the canvas axis, measured at the
 * column — its narrowest row, the one every opening is cut about — and not at
 * the flare below it, which is trapezius.
 */
function throatOffset(profile) {
  let narrowest = Infinity;
  let off = 0;
  for (let y = 0; y < H; y++) {
    const l = edgeAt(profile.neckLeft, y);
    const r = edgeAt(profile.neckRight, y);
    if (l === null || r === null || r - l >= narrowest) continue;
    narrowest = r - l;
    off = Math.abs((l + r) / 2 - W / 2);
  }
  return off;
}

function checkSymmetry(bodyKey, id, paint) {
  /*
    Above the armpit a garment may be cut to the throat, and the throat is not
    on the axis: the photographs are registered on the trunk, and her head sits
    three units left of it. Up there the halves may differ by that offset,
    doubled — and no more. From the armpit down there is nothing but the trunk
    to cut to, and they must mirror.
  */
  const profile = profileFor(bodyKey);
  const throat = throatOffset(profile);
  let top = -1;
  for (let y = 0; y < H && top < 0; y++) {
    for (let x = 0; x < W; x++) {
      if (paint[y * W + x] >= 0.5) {
        top = y;
        break;
      }
    }
  }

  let worst = 0;
  let worstY = 0;
  for (let y = top + SYMMETRY_FROM; y < H; y++) {
    let lo = -1;
    let hi = -1;
    for (let x = 0; x < W; x++) {
      if (paint[y * W + x] < 0.5) continue;
      if (lo < 0) lo = x;
      hi = x;
    }
    if (lo < 0) continue;
    // the left edge against the right edge reflected, less what the throat owns
    const allowed = y < profile.armpitY ? 2 * throat : 0;
    const off = Math.max(0, Math.round(Math.abs(lo - (W - 1 - hi)) - allowed));
    if (off > worst) {
      worst = off;
      worstY = y;
    }
  }

  const ok = worst <= MAX_LOPSIDED;
  console.log(
    `${ok ? "ok  " : "HOLE"} ${bodyKey.padEnd(6)} ${id.padEnd(21)} ` +
      `sides differ by ${worst} px at most`
  );
  if (ok) return 0;
  console.log(
    `     ${bodyKey.padEnd(6)} fit       ${id} sits ${worst} units further out on ` +
      `one side than the other at y ${worstY} — the two halves are not one ` +
      `shape mirrored`
  );
  return 1;
}


/**
 * How much of the body's own daylight a garment has to leave open.
 *
 * A fixed minimum is the wrong shape for this rule. Her arm hangs 10 units
 * clear of her ribs at the armpit and 23 by the elbow; his legs are 36 apart
 * at the knee and 96 at the ankle. Any single number is either unreachable
 * where the body is close or trivially passed where it is open — and the old
 * trousers, which met along a 4-unit slit, would have cleared a floor of 3.
 * A share of what is actually there is the honest test.
 */
const MIN_SHARE = 0.2;

/**
 * Legs are held to more, because there is more there to keep.
 *
 * The daylight between two legs runs from 20 units at the thigh to 96 at his
 * ankle, against 6–23 between an arm and the ribs — so a share that is honest
 * for an armhole lets a 4-unit slit through between the legs, which is exactly
 * what the old trousers had.
 */
const MIN_LEG_SHARE = 0.3;

/** Below this the body's own gap is too narrow to ask anything about. */
const MIN_DAYLIGHT = 6;

/**
 * How many of the sampled rows have to be open.
 *
 * Not all of them, because a row or two on each figure genuinely cannot be:
 * right under the armpit the body's own gap is 6 units wide, and where her
 * forearm crosses her flaring hip it closes again. Cloth has to be *somewhere*
 * on those rows. What the rule is really asking is whether the sleeve and the
 * body are two pieces with air between them or one fused slab, and a slab
 * scores zero everywhere rather than on two rows out of sixteen.
 */
const MIN_OPEN_ROWS = 0.6;

/**
 * Does the arm hang clear of the ribs?
 *
 * Both mannequins hold their arms away from the body — hers by up to 27 units
 * and his by up to 32 — and no file anywhere recorded it, so every top was
 * drawn with its sleeve welded to its side seam and the figure came out a slab.
 * This walks the rows where the body's own gap is worth having and asks for an
 * unpainted column somewhere inside it.
 */
const GAP_FROM = 60;

/** ...and how far down. Below the hip a skirt is in the way, legitimately. */
const GAP_TO = 150;

function checkArmGap(bodyKey, id, paint, profile, coverage) {
  // Only garments that actually sleeve the arm can be asked about this.
  if (!coverage.includes("upperArm")) return 0;

  const bad = [];
  let rows = 0;
  let tightest = Infinity;
  const to = Math.min(profile.armpitY + GAP_TO, edgeEnd(profile.armInner));

  for (let y = profile.armpitY + GAP_FROM; y <= to; y += 6) {
    const inner = edgeAt(profile.armInner, y);
    const trunk = edgeAt(profile.torso, y);
    const outer = edgeAt(profile.armOuter, y);
    if (inner === null || trunk === null || outer === null) continue;

    /*
      Only rows the garment actually sleeves. Below a short sleeve the arm is
      bare and there is nothing to judge, and below a dress's waist the thing
      filling this space is its skirt — which is where a skirt belongs, with
      the forearm hanging in front of it. Asking either to leave daylight is
      asking the wrong question of the wrong piece of cloth.
    */
    if (paint[y * W + Math.round(outer)] < 0.5) continue;

    // The body's own daylight on this row. Too narrow to matter, skip it.
    const daylight = trunk - inner;
    if (daylight < MIN_DAYLIGHT) continue;
    const want = Math.max(2, daylight * MIN_SHARE);
    rows++;

    let open = 0;
    let best = 0;
    for (let x = Math.floor(inner) - 2; x <= Math.ceil(trunk) + 2; x++) {
      if (paint[y * W + x] >= 0.5) open = 0;
      else best = Math.max(best, ++open);
    }
    tightest = Math.min(tightest, best / daylight);
    if (best < want) bad.push(y);
  }

  if (rows === 0) return 0;
  const ok = bad.length <= rows * (1 - MIN_OPEN_ROWS);
  console.log(
    `${ok ? "ok  " : "HOLE"} ${bodyKey.padEnd(6)} ${id.padEnd(21)} ` +
      `arm gap open on ${rows - bad.length}/${rows} rows, ` +
      `${tightest === Infinity ? "--" : (tightest * 100).toFixed(0)}% of the body's own at worst`
  );
  if (ok) return 0;
  console.log(
    `     ${bodyKey.padEnd(6)} fit       ${id} fills the gap between arm and ` +
      `ribs on ${bad.length} of ${rows} rows (y ${bad[0]}–${bad[bad.length - 1]}) ` +
      `— the sleeve and the side seam have run together`
  );
  return 1;
}

/**
 * Is there daylight between the legs?
 *
 * The same failure one storey down, and worse, because the two bodies differ
 * most here and the two drawings used to share the numbers exactly: her ankles
 * are 42 units apart and his are 96, and both trouser outlines carried the run
 * `L295 760 L298 640 L300 512` character for character. A single point at the
 * crotch is not a gap.
 */
function checkLegGap(bodyKey, id, paint, profile, coverage) {
  if (!coverage.includes("knee") && !coverage.includes("calf")) return 0;

  /*
    A skirt and a thobe cover the legs without having any, and asking a column
    of cloth to have daylight up the middle is asking it to be trousers. Which
    a garment is, is a fact about what is drawn rather than one worth adding to
    the records: count the painted runs across the rows below the crotch. Two
    runs anywhere is a pair of legs and gets checked; one everywhere is a column
    and does not. It used to count one row near the hem — and her trousers,
    whose legs met from the calf down, read there as one run and so as a
    column, and were never checked at all.
  */
  const legRuns = (() => {
    let most = 0;
    for (let y = profile.crotchY + 20; y <= H - 60; y += 4) {
      let runs = 0;
      let on = false;
      for (let x = 0; x < W; x++) {
        const lit = paint[y * W + x] >= 0.5;
        if (lit && !on) runs++;
        on = lit;
      }
      most = Math.max(most, runs);
    }
    return most;
  })();
  if (legRuns < 2) return 0;

  const bad = [];
  let rows = 0;
  let tightest = Infinity;
  const to = Math.min(edgeEnd(profile.legInner), H - 60);

  // From well below the crotch: the legs are still touching where they part.
  for (let y = profile.crotchY + 60; y <= to; y += 8) {
    const inner = edgeAt(profile.legInner, y);
    if (inner === null) continue;
    const daylight = W - 2 * inner;
    if (daylight < MIN_DAYLIGHT) continue;
    const want = Math.max(2, daylight * MIN_LEG_SHARE);
    rows++;

    let open = 0;
    let best = 0;
    for (let x = Math.floor(inner) - 2; x <= Math.ceil(W - inner) + 2; x++) {
      if (paint[y * W + x] >= 0.5) open = 0;
      else best = Math.max(best, ++open);
    }
    tightest = Math.min(tightest, best / daylight);
    if (best < want) bad.push(y);
  }

  if (rows === 0) return 0;
  /*
    Every row, down to the hem — not most of them, as between an arm and the
    ribs. Legs that meet partway down read as one column, a long skirt with a
    line down it, whatever is above.
  */
  const ok = bad.length === 0;
  console.log(
    `${ok ? "ok  " : "HOLE"} ${bodyKey.padEnd(6)} ${id.padEnd(21)} ` +
      `leg gap open on ${rows - bad.length}/${rows} rows, ` +
      `${tightest === Infinity ? "--" : (tightest * 100).toFixed(0)}% of the body's own at worst`
  );
  if (ok) return 0;
  console.log(
    `     ${bodyKey.padEnd(6)} fit       ${id} closes the gap between the legs ` +
      `on ${bad.length} of ${rows} rows (y ${bad[0]}–${bad[bad.length - 1]})`
  );
  return 1;
}

/* ------------------------------------------------------------- the arms */

/** How far an edge of an arm's cloth may move between rows two units apart before it is a step. */
const EDGE_STEP = 1.6;
/**
 * Below the underarm, where the band's own lower edge across the chest is
 * still in the rows being read: past this, the band is round the arm alone.
 */
const BAND_CLEAR = 10;

/** Across where a sleeve leaves the band: the most its outside may move between rows two apart, and change its move by. */
const JOIN_JUMP = 2.5;
const JOIN_KINK = 1.2;
/** How far above a cuff's seam a sleeve is gathered into it. */
const CUFF_GATHER_ROWS = 8;
/**
 * How far a fitted sleeve's outside may stand off the arm, past what the band
 * it hangs from does: the photograph's outline steps by about a unit, and a
 * sleeve following it smoothly sits that much either side of it.
 */
const STANDOFF_SLACK = 0.75;
/** How many rows above where a sleeve leaves an off-shoulder's band the band's own stand-off is read over. */
const STANDOFF_BAND = 8;
/** How far above and below where a sleeve leaves an off-shoulder's band its outside is read for a step. */
const JOIN_ABOVE = 12;
const JOIN_BELOW = 16;

/**
 * Does a sleeve carry on from an off-shoulder's band, as one piece?
 *
 * The band is the top of every sleeve on that cut: the outside of the arm runs
 * in one line from the band to the hem. A sleeve drafted as a tube of its own
 * and set under the band left a ledge where the two met, and every other check
 * passed it: each piece was a fine shape on its own. So this reads them
 * together, as the eye does:
 *
 * - **for every sleeve**, the outside of the arm, row by row from above the
 *   band's lower edge to below it — it may not jump;
 * - **for the fitted one**, the width across band and sleeve, from below the
 *   underarm to the hem — it may never grow, and neither edge may jump.
 */
function checkBandArm(bodyKey, label, arm, profile) {
  if (!arm) return 0;
  const pieces = arm.pieces.map((d) => flatten(d).flat());
  /* the merged run of cloth on the arm's row: band, sleeve and cuff together */
  const runAt = (y) => {
    const spans = [];
    for (const xs of crossingsAt(pieces, y)) {
      for (let k = 0; k + 1 < xs.length; k += 2) if (xs[k] < W / 2 - 10) spans.push([xs[k], xs[k + 1]]);
    }
    if (spans.length === 0) return null;
    spans.sort((a, b) => a[0] - b[0]);
    let [l, r] = spans[0];
    for (const [a, b] of spans.slice(1)) {
      if (a > r + 0.5) break;
      r = Math.max(r, b);
    }
    return [l, r];
  };
  const problems = [];
  /*
    The outside of the arm across the join: no jump between rows, as a ledge
    is, and no sudden change of direction, as a corner is. A puff flares out
    fast from its gathers, and that is its shape; a flare is a curve, and a
    ledge is not.
  */
  let lastOut = null;
  let lastMove = null;
  for (let y = arm.join - JOIN_ABOVE + 0.25; y <= Math.min(arm.join + JOIN_BELOW, arm.hem - 4); y += 2) {
    const run = runAt(y);
    if (!run) continue;
    if (lastOut !== null) {
      const move = run[0] - lastOut;
      if (Math.abs(move) > JOIN_JUMP && problems.length < 3) {
        problems.push(`its outside jumps ${Math.abs(move).toFixed(1)} at y ${Math.round(y)}, where it leaves the band`);
      } else if (lastMove !== null && Math.abs(move - lastMove) > JOIN_KINK && problems.length < 3) {
        problems.push(`its outside turns a corner at y ${Math.round(y)}, where it leaves the band`);
      }
      lastMove = move;
    }
    lastOut = run[0];
  }
  /*
    The fitted one's outside, from the band down the upper arm: no further off
    the arm than the band's own. Drafted as a sleeve from the shoulder, which
    needs room over the shoulder cap, it slanted out below the band to that
    sleeve's width and left a triangle of cloth beside the arm; hung from the
    band it starts lower and needs none.
  */
  let standoff = null;
  if (arm.fitted && profile) {
    const off = (y) => {
      const run = runAt(y);
      const at = edgeAt(profile.armOuter, y);
      return run && at !== null ? at - run[0] : null;
    };
    let band = -Infinity;
    for (let y = arm.join - STANDOFF_BAND + 0.25; y < arm.join; y += 1) band = Math.max(band, off(y) ?? -Infinity);
    let worst = -Infinity;
    let worstAt = 0;
    for (let y = arm.join + 0.25; y <= Math.min(profile.elbowY, arm.hem - 4); y += 1) {
      const o = off(y);
      if (o !== null && o > worst) [worst, worstAt] = [o, y];
    }
    standoff = { band, worst };
    if (worst > band + STANDOFF_SLACK && problems.length < 3) {
      problems.push(
        `its outside stands ${worst.toFixed(1)} off the arm at y ${Math.round(worstAt)}, where the band stands ${band.toFixed(1)} — cloth slanting out below the band`
      );
    }
  }
  /* the fitted one: never wider going down, and no jump in either edge */
  let narrowest = Infinity;
  if (arm.fitted) {
    let last = null;
    /* down to where a cuff is gathered in: the cuff's own gather is the shared one, on every garment */
    const to = arm.cuffTop !== undefined ? arm.cuffTop - CUFF_GATHER_ROWS : arm.hem - 4;
    for (let y = arm.underarm + BAND_CLEAR + 0.25; y <= to; y += 2) {
      const run = runAt(y);
      if (!run) continue;
      const [l, r] = run;
      const width = r - l;
      narrowest = Math.min(narrowest, width);
      if (width - narrowest > SLEEVE_GROWTH && problems.length < 3) {
        problems.push(`widens to ${width.toFixed(1)} at y ${Math.round(y)}, ${(width - narrowest).toFixed(1)} past the narrowest above`);
      }
      if (last && (Math.abs(l - last[0]) > EDGE_STEP || Math.abs(r - last[1]) > EDGE_STEP) && problems.length < 3) {
        problems.push(`its edge steps ${Math.max(Math.abs(l - last[0]), Math.abs(r - last[1])).toFixed(1)} at y ${Math.round(y)}`);
      }
      last = [l, r];
    }
  }
  const ok = problems.length === 0;
  console.log(
    `${ok ? "ok  " : "HOLE"} ${bodyKey.padEnd(6)} ${label.padEnd(26)} carries on from the band` +
      (ok
        ? arm.fitted
          ? `: no step, never wider than ${narrowest.toFixed(1)} below the underarm, ` +
            `${standoff ? `at most ${standoff.worst.toFixed(1)} off the arm to the elbow (the band ${standoff.band.toFixed(1)})` : ""}`
          : ": no step"
        : `: ${problems.join("; ")} — a tube set under the band, not one piece with it`)
  );
  return ok ? 0 : 1;
}

/**
 * How much cloth a bare shoulder may carry: the antialiased edge of a bodice
 * that stops at the underarm, and no more.
 */
const BARE_SLACK = 25;
/** How far inside the trunk's edge a bodice's side may sit and still be its side. */
const SIDE_ROOM = 7;

/**
 * Is there cloth on a shoulder the cut leaves bare?
 *
 * A one-shoulder bodice was closed through the outline every bodice uses,
 * which runs up both armholes — so on the bare side it climbed the inside of
 * the arm to the shoulder point before the neckline set off across the chest
 * from the underarm, and a strip of dress lay on the bare arm. Every other
 * check passed it: the strip covered nothing it should not erase, and lay on
 * the body rather than over the page. This one asks, of each side a cut
 * leaves bare — see `NECKLINE_BARE_SHOULDERS` — whether any cloth lies
 * outside the trunk from above the shoulder down to the waist.
 */
function checkBareShoulders(bodyKey, label, paint, profile, cutId) {
  const sides = cutId ? (NECKLINE_BARE_SHOULDERS[cutId] ?? []) : [];
  if (sides.length === 0) return 0;
  const trunkAt = (y) => edgeAt(profile.torso, Math.max(y, profile.armpitY)) ?? edgeAt(profile.torso, profile.armpitY);
  let failed = 0;
  for (const side of sides) {
    let count = 0;
    let first = null;
    for (let y = profile.shoulderPointY - 12; y <= profile.waistY - 4; y++) {
      const edge = trunkAt(y) - SIDE_ROOM;
      for (let x = 0; x < W / 2; x++) {
        const cx = side === "left" ? x : W - 1 - x;
        if (x >= edge) break;
        if (paint[y * W + cx] >= 0.5) {
          count++;
          if (!first) first = [cx, y];
        }
      }
    }
    const ok = count <= BARE_SLACK;
    if (!ok) failed++;
    console.log(
      `${ok ? "ok  " : "HOLE"} ${bodyKey.padEnd(6)} ${label.padEnd(26)} ` +
        `bare ${side} shoulder: ${count} px of cloth on it` +
        (ok ? "" : `, first at ${first[0]},${first[1]} — cloth on a shoulder the cut takes off`)
    );
  }
  return failed;
}

/** How much skin may show under an arm the cloth covers: an antialiased edge. */
const UNDERARM_SLACK = 8;
/** How much of the arm's width cloth must span, row after row below the armpit, to be on the arm. */
const ON_ARM = 0.6;

/**
 * Does skin show under an arm the cloth is on?
 *
 * The off-shoulder was a band across the chest at the height of the armpit,
 * its ends standing on the outer arms — so between each arm and the chest the
 * armpit showed above it. A sleeve, or a band round the arm, is sewn to the
 * bodice under the arm, and the cloth runs on from one into the other: where
 * the cloth is on the arm, the armpit is covered. This asks, on each side
 * whose arm the cloth covers below the armpit, whether any skin shows in the
 * hollow between the arm and the chest, from a little above the armpit down to
 * where the arm leaves the side.
 */
function checkUnderarm(bodyKey, label, paint, cover, profile, loud) {
  const below = profile.armpitY + 8;
  const inner = edgeAt(profile.armInner, below);
  const trunk = edgeAt(profile.torso, below);
  if (inner === null || trunk === null) return 0;
  let failed = 0;
  for (const side of ["left", "right"]) {
    const at = (x) => (side === "left" ? x : W - 1 - x);
    /* is the cloth on this arm? most of its width, on most rows just below the armpit */
    let onRows = 0;
    let rows = 0;
    for (let y = profile.armpitY + 12; y <= profile.armpitY + 30; y += 2) {
      const o = edgeAt(profile.armOuter, y);
      const i = edgeAt(profile.armInner, y);
      if (o === null || i === null) continue;
      rows++;
      let lit = 0;
      for (let x = Math.ceil(o); x <= Math.floor(i); x++) if (paint[y * W + at(x)] >= 0.5) lit++;
      if (lit >= ON_ARM * (i - o)) onRows++;
    }
    if (rows === 0 || onRows < rows * 0.7) continue;
    /* the hollow: between the arm's inside and the chest, above where the arm leaves the side */
    let skin = 0;
    let first = null;
    for (let y = profile.armpitY - 16; y <= profile.armpitY + 6; y++) {
      for (let x = Math.floor(inner) - 3; x <= Math.ceil(trunk) + 3; x++) {
        const k = y * W + at(x);
        if (cover[k] > 0.5 && paint[k] < 0.5) {
          skin++;
          if (!first) first = [at(x), y];
        }
      }
    }
    const ok = skin <= UNDERARM_SLACK;
    if (!ok) failed++;
    if (!ok || loud) {
      console.log(
        `${ok ? "ok  " : "HOLE"} ${bodyKey.padEnd(6)} ${label.padEnd(26)} ` +
          `under the ${side} arm: ${skin} px of skin` +
          (ok ? "" : `, first at ${first[0]},${first[1]} — the armpit shows above cloth that is on the arm`)
      );
    }
  }
  return failed;
}

/* ------------------------------------------------------- sleeve widths */

/**
 * How much a sleeve may widen, anywhere between its underarm and its hem.
 *
 * A sleeve hangs from the shoulder like a tube: widest at the underarm and
 * tapering to the wrist, bridging the forearm rather than following it. Drafted
 * along the arm's own outline, every long sleeve here swelled below the elbow —
 * on him 48 units across at the upper arm, 61 under the elbow, 40 at the wrist,
 * which is a puff sleeve whether or not anyone chose one. Two units is the
 * rasterising and the curve of the hem, no more.
 */
const SLEEVE_GROWTH = 2;
/** Loose on purpose, and allowed their shape: they are the sleeves that billow. */
const LOOSE_SLEEVES = ["puff", "bishop", "bell", "flutter"];

/** Where a set of outlines crosses one row, sorted, per outline. */
function crossingsAt(polys, y) {
  return polys.map((poly) => {
    const xs = [];
    for (let i = 0; i < poly.length; i++) {
      const [ax, ay] = poly[i];
      const [bx, by] = poly[(i + 1) % poly.length];
      if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
    }
    return xs.sort((a, b) => a - b);
  });
}

/**
 * The left sleeve's width, row by row from its underarm to its hem, and the
 * most it ever grows past the narrowest it has been above. A sleeve cut as its
 * own piece is measured across that piece; one cut in one with the body, across
 * the outermost run of cloth on each row.
 */
function sleeveGrowth(paths, bodyKey, sleeve) {
  const top = SLEEVE_KIT.underarmRow(bodyKey, sleeve);
  const cuff = SLEEVE_KIT.hemRow(bodyKey, sleeve);
  if (top === null || cuff === null) return null;
  const pieces = paths.map((d) => flatten(d).flat());
  const cutOn = SLEEVE_KINDS[sleeve.type].construction === "cut-on";
  let narrowest = Infinity;
  let worst = { grows: 0, y: null, width: null };
  /*
    Read a quarter of a unit off each whole row. A cuff's band is sewn over
    the sleeve's straight under-hem, and when that hem lands exactly on a row
    read here, the crossings along it are rounding noise — eighteen of them on
    one row, which read as the sleeve suddenly narrowing to half its width.
  */
  for (let y = Math.ceil(top) + 1.25; y <= cuff - 2; y += 2) {
    const rows = crossingsAt(pieces, y);
    let width = null;
    if (cutOn) {
      /*
        The outermost run of cloth on the row, its pieces merged: a cut-on
        sleeve's cuff overlaps the sleeve it ends, and read piece by piece the
        two looked like a sleeve narrowing to nothing and widening again.
      */
      const spans = [];
      for (const xs of rows) for (let k = 0; k + 1 < xs.length; k += 2) spans.push([xs[k], xs[k + 1]]);
      spans.sort((a, b) => a[0] - b[0]);
      if (spans.length >= 3) {
        let [l0, l1] = spans[0];
        for (const [a, b] of spans.slice(1)) {
          if (a > l1 + 0.5) break;
          l1 = Math.max(l1, b);
        }
        width = l1 - l0;
      }
    } else {
      const own = rows.find((xs, i) => xs.length >= 2 && Math.max(...pieces[i].map(([x]) => x)) < W / 2 - 10);
      if (own) width = own[own.length - 1] - own[0];
    }
    if (width === null) continue;
    narrowest = Math.min(narrowest, width);
    if (width - narrowest > worst.grows) worst = { grows: width - narrowest, y, width };
  }
  return worst;
}

/**
 * Does the checked-in profile still describe the shipped photograph?
 *
 * `src/lib/mannequin/profile.ts` is generated by `npm run measure:body`, and
 * every outline in the wardrobe is drafted from it. Replace a PNG without
 * regenerating and the whole wardrobe is cut to a body that is no longer there
 * — silently, because nothing else here reads both.
 */
const PROFILE_SLACK = 2;
/** Grey levels, 0–1: a little under one step of an 8-bit channel either way. */
const LIGHT_SLACK = 0.004;

function checkProfile(bodyKey, body, profile) {
  const problems = [];
  const measured = measureBody(join(ROOT, "public", body.view.front));

  for (const key of ["shoulderPointY", "elbowY", "wristY", "armpitY", "waistY", "hipY", "crotchY"]) {
    if (Math.abs(measured[key] - profile[key]) > PROFILE_SLACK) {
      problems.push(
        `${key} is ${profile[key]} in profile.ts but ${measured[key]} in the ` +
          `photograph — run "npm run measure:body"`
      );
    }
  }

  // The light a skin tone is drawn over, read off the same photograph.
  for (const key of ["median", "highlight"]) {
    if (Math.abs(measured.light[key] - (profile.light?.[key] ?? -1)) > LIGHT_SLACK) {
      problems.push(
        `light.${key} is ${profile.light?.[key]} in profile.ts but ` +
          `${measured.light[key]} in the photograph — run "npm run measure:body"`
      );
    }
  }

  for (const key of ["torso", "armOuter", "armInner", "legOuter", "legInner"]) {
    const a = profile[key];
    const b = measured[key];
    let worst = 0;
    for (let i = 0; i < Math.min(a.x.length, b.x.length); i++) {
      if (a.x[i] === null || b.x[i] === null) continue;
      worst = Math.max(worst, Math.abs(a.x[i] - b.x[i]));
    }
    if (worst > PROFILE_SLACK) {
      problems.push(
        `${key} is up to ${worst.toFixed(1)} units off the photograph — ` +
          `run "npm run measure:body"`
      );
    }
  }

  console.log(
    `${problems.length ? "HOLE" : "ok  "} ${bodyKey.padEnd(6)} ` +
      `profile               ${problems.length ? "stale" : "matches the photograph"}`
  );
  for (const problem of problems) {
    console.log(`     ${bodyKey.padEnd(6)} profile   ${problem}`);
  }
  return problems.length;
}
/** One tile of the collar contact sheet: the neck and shoulders, cropped. */
const TILE = { x0: 176, y0: 126, w: 248, h: 208, cols: 3 };

/** How far off a seam may sit before it is a gap rather than an allowance. */
/**
 * How far a flat collar may sit inside an opening before it is in the way.
 *
 * Not the seam allowance, which is SEAM_SLACK: this is the spread between the
 * several garments one collar is sewn to. The blouse cuts its crew four units
 * deeper than the t-shirt and the dress cuts its own from a different ease, so
 * a single drawing is a few units inside one of them whatever it does, and the
 * collar has to cover the shallowest seam to be sewn to it at all. Eight units
 * covers that spread and nothing more — what this is for stood at seventeen.
 */
const FLAT_SLACK = 8;

const SEAM_SLACK = 3;
/** Cloth a collar must share with the garment before it counts as sewn on. */
const MIN_ATTACHED = 150;
/** Collar over neither cloth nor body: out in space, and always a mistake. */
const MAX_FLOATING = 80;
/**
 * How far a `behindBody` band may stand clear of the neck it wraps.
 *
 * The visible part of the band is the sliver either side of the throat, so this
 * is really the band's thickness seen edge-on: about 1.5 cm of cloth.
 */
const BEHIND_MARGIN = 9;
/** Below this the neck has become shoulder, and a band has no business there. */
const NECK_FLOOR = 196;
/** Where a collar is sewn: the collar points the neckline runs between. */
const NECK_SEAM_Y = 180;

/**
 * Where the head stops and the neck begins, read from the silhouette.
 *
 * Walking up from the chest the figure narrows to the neck column and then
 * widens again into the jaw; the last row still narrowing is the jawline. On
 * both shipped figures that lands at y 150 — four units above `anchors.chinY`,
 * which is why that anchor is not used as the bound.
 *
 * It matters because **nothing is ever drawn in front of a collar.**
 * `BodyAsset.overlay` is `["forearm", "hand"]`: the arms come back over the
 * cloth and the head never does. So a collar rising past the jaw is not a
 * collar tucked under a chin — it is cloth painted across a face, which is what
 * the ruffle and the turtleneck were doing, nine and five units' worth.
 */
/** How much the neck column may wander before it counts as the jaw. */
const JAW_SLACK = 4;

function jawline(rows, anchors) {
  let narrowest = Infinity;
  let jaw = anchors.chinY;
  for (let y = anchors.shoulderY; y > anchors.crownY; y -= 1) {
    const row = rows[y];
    if (!row) continue;
    narrowest = Math.min(narrowest, row.width);
    // The column runs at a steady width for fifty units and then flares. The
    // last row before it flares is the jawline: y 138 on both shipped figures.
    if (row.width > narrowest + JAW_SLACK) break;
    jaw = y;
  }
  return jaw;
}

/**
 * How far a drawing may differ from its declared stand.
 *
 * Generous, because a collar's topmost pixel is not always its band — a ruff's
 * scallops and a bow's loops rise past it. What this catches is the failure
 * that actually happened: every collar drawn to one height while nine
 * different heights were written down.
 */
const STAND_SLACK = 8;

/* ------------------------------------------------------------ collar shape */

/** Two collars whose boxes agree this closely, in cm, are the same collar. */
const ALIKE_CM = 1.5;
/**
 * Two bands — collars with no fall — are the same collar only if they close
 * the same way at the throat and their drawn heights agree this closely, in
 * cm. A band round a throat is as wide as the throat, so every band shares a
 * box within `ALIKE_CM`; what tells one from another is its height and how
 * its ends close — a tab buttoned over the other end, or two ends meeting —
 * which each record declares as `build.front` and a box cannot see.
 */
const BAND_ALIKE_CM = 0.5;
/**
 * How much bigger the largest collar must be than the smallest, by area.
 *
 * A band at the throat and a collar across both shoulders are not the same
 * size in reality, and nine drawings that all fit the same hundred square
 * units are nine costumes on one shape.
 */
const SPREAD = 6;

/** The painted bounding box of a drawing, in canvas units. */
function boundingBox(paint) {
  let x0 = W;
  let x1 = -1;
  let y0 = H;
  let y1 = -1;
  for (let i = 0; i < paint.length; i++) {
    if (paint[i] < 0.5) continue;
    const x = i % W;
    const y = (i / W) | 0;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0 };
}

const cm = (units) => units * BODY_CANVAS.cmPerUnit;

/**
 * Is each collar the size and shape its record says it is?
 *
 * Every other check here passes a collar that has quietly shrunk to a band at
 * the neck: it is still sewn to the seam, still covers what it claims, still
 * hangs over cloth rather than space. Nine collars can satisfy all of that and
 * be, in silhouette, the same collar drawn nine times — which is what the
 * first nine were. Three questions catch it, and none of them are about seams:
 *
 *   • **the declared size** — the drawing lands inside the `footprint` its
 *     record gives, in centimetres. A sailor collar cannot shrink to mandarin
 *     size without the record being edited to say so, which is a change
 *     somebody has to make on purpose.
 *   • **no two alike** — two boxes that agree within `ALIKE_CM` on both axes
 *     are not telling two collars apart, whatever the paths inside them say.
 *     Two bands are held to their heights instead — see `BAND_ALIKE_CM`.
 *   • **a real spread** — the largest box is at least `SPREAD`× the smallest.
 *     This is the one that fails when every collar is drawn to whatever fits
 *     most easily round a neck.
 */
function checkCollarShapes(bodyKey, paints) {
  const problems = [];
  const boxes = [];

  for (const [id, paint] of paints) {
    const collar = collars.find((c) => c.id === id);
    const box = boundingBox(paint);
    if (!box) {
      problems.push(`${id} paints nothing at all`);
      continue;
    }
    boxes.push({ id, box });

    const want = collar.footprint;
    const got = { width: cm(box.w), drop: cm(box.h) };
    for (const axis of ["width", "drop"]) {
      const [lo, hi] = want[axis];
      if (got[axis] < lo || got[axis] > hi) {
        problems.push(
          `${id} is ${got[axis].toFixed(1)} cm ${axis}, outside the ` +
            `${lo}–${hi} cm its record declares` +
            (got[axis] < lo ? " — drawn smaller than it is" : " — oversized")
        );
      }
    }
    console.log(
      `     ${bodyKey.padEnd(6)} ${id.replace(`${bodyKey}-`, "").padEnd(20)} ` +
        `${cm(box.w).toFixed(1).padStart(5)} × ${cm(box.h).toFixed(1).padStart(5)} cm` +
        `   x ${box.x0}–${box.x1}, y ${box.y0}–${box.y1}`
    );
  }

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      const dw = Math.abs(cm(a.box.w) - cm(b.box.w));
      const dh = Math.abs(cm(a.box.h) - cm(b.box.h));
      const [ca, cb] = [a, b].map(({ id }) => collars.find((c) => c.id === id));
      const bands = ca?.build.fall === "none" && cb?.build.fall === "none";
      const alike = bands
        ? (ca.build.front ?? "") === (cb.build.front ?? "") && dh <= BAND_ALIKE_CM
        : dw <= ALIKE_CM && dh <= ALIKE_CM;
      if (alike) {
        problems.push(
          `${a.id} and ${b.id} occupy the same box ` +
            `(${dw.toFixed(1)} cm and ${dh.toFixed(1)} cm apart) — ` +
            `nothing in the silhouette tells them apart`
        );
      }
    }
  }

  if (boxes.length > 1) {
    const areas = boxes.map((b) => ({ id: b.id, a: b.box.w * b.box.h }));
    areas.sort((p, q) => p.a - q.a);
    const smallest = areas[0];
    const largest = areas[areas.length - 1];
    const ratio = largest.a / smallest.a;
    console.log(
      `     ${bodyKey.padEnd(6)} spread            ` +
        `${largest.id.replace(`${bodyKey}-`, "")} is ${ratio.toFixed(1)}× the box of ` +
        `${smallest.id.replace(`${bodyKey}-`, "")}`
    );
    if (ratio < SPREAD) {
      problems.push(
        `the ${boxes.length} collars span only ${ratio.toFixed(1)}× in area, ` +
          `under the ${SPREAD}× a set running from a throat band to a ` +
          `shoulder-wide collar has to cover — they are all the same size`
      );
    }
  }

  for (const problem of problems) {
    console.log(`HOLE ${bodyKey.padEnd(6)} shape     ${problem}`);
  }
  return problems.length;
}

/* ------------------------------------------------------------ collar edges */

/**
 * A segment longer than this, once the path is flattened, was a straight line
 * in the source. A cubic comes out of `flatten` as eighteen short steps; an
 * `L` comes out as one long one, so the two are told apart by length alone.
 */
const LONG_SEGMENT = 8;

/**
 * How much of a collar's boundary may be straight.
 *
 * Cloth has no straight edges, and this is the check that says so. Every collar
 * here was once a hand-typed polygon — `M297 188 L271 180 L256 202 L285 233 Z`
 * and twelve more like it — and no other check in this file can see that: a
 * polygon is sewn to the neckline just as neatly as a curve, covers exactly
 * what it claims, and lands inside its declared footprint. It simply looks like
 * folded paper, which is a fact about the drawing that nothing was asserting.
 *
 * Measured, the old shirt leaf and the old male collar are 100% straight and
 * the old sailor panel 83%; rebuilt on curves they are 0%. What is left above
 * zero in a passing collar is the band, whose top edge genuinely is straight
 * because a band is a strip of cloth — so this is not zero, but it is nowhere
 * near where a polygon lands.
 */
const MAX_STRAIGHT = 0.45;

/** The share of a drawing's boundary length carried by straight runs. */
function straightness(paths) {
  let total = 0;
  let long = 0;
  for (const d of paths) {
    for (const poly of flatten(d)) {
      for (let i = 0; i < poly.length - 1; i++) {
        const len = Math.hypot(
          poly[i + 1][0] - poly[i][0],
          poly[i + 1][1] - poly[i][1]
        );
        total += len;
        if (len > LONG_SEGMENT) long += len;
      }
    }
  }
  return total > 0 ? long / total : 0;
}

/**
 * No collar may paint above the jawline.
 *
 * The rule that stands in for a chin: since the head is never redrawn over the
 * cloth, the cloth has to stop below it. A collar that tops out on the jaw is
 * not tucked under it — head-on there is nothing in front of it at all.
 */
function checkCollarHeight(bodyKey, paints, jaw) {
  const problems = [];
  for (const [id, paint] of paints) {
    const box = boundingBox(paint);
    if (!box) continue;
    console.log(
      `     ${bodyKey.padEnd(6)} ${id.replace(`${bodyKey}-`, "").padEnd(20)} ` +
        `tops out at y ${String(box.y0).padStart(3)}, jaw at y ${jaw}` +
        (box.y0 < jaw ? "" : "   clear")
    );
    if (box.y0 < jaw) {
      problems.push(
        `${id} paints ${jaw - box.y0} units above the jawline at y ${jaw} — ` +
          `nothing is drawn in front of a collar, so that is cloth across a face`
      );
    }
  }
  for (const problem of problems) {
    console.log(`HOLE ${bodyKey.padEnd(6)} height    ${problem}`);
  }
  return problems.length;
}

function checkCollarEdges(bodyKey, outlines) {
  const problems = [];
  for (const [id, paths] of outlines) {
    const straight = straightness(paths);
    console.log(
      `     ${bodyKey.padEnd(6)} ${id.replace(`${bodyKey}-`, "").padEnd(20)} ` +
        `${(straight * 100).toFixed(0).padStart(3)}% of its edge is straight`
    );
    if (straight > MAX_STRAIGHT) {
      problems.push(
        `${id} is ${(straight * 100).toFixed(0)}% straight edges, over the ` +
          `${(MAX_STRAIGHT * 100).toFixed(0)}% a piece of cloth can be — it is ` +
          `drawn as a polygon, and will read as folded paper whatever it is ` +
          `shaded with`
      );
    }
  }
  for (const problem of problems) {
    console.log(`HOLE ${bodyKey.padEnd(6)} edges     ${problem}`);
  }
  return problems.length;
}

/** Is any painted pixel within `slack` of this point? */
function paintedNear(paint, x, y, slack) {
  const x0 = Math.max(0, Math.round(x) - slack);
  const x1 = Math.min(W - 1, Math.round(x) + slack);
  const y0 = Math.max(0, Math.round(y) - slack);
  const y1 = Math.min(H - 1, Math.round(y) + slack);
  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      if (paint[py * W + px] >= 0.5) return true;
    }
  }
  return false;
}

/**
 * Do the collars fit the garments they say they fit?
 *
 * Everything here is checked against *every* garment a collar names, never a
 * sample, because that is where the variation is: three tops that share a yoke
 * still cut three different openings, and a collar is sewn to the opening.
 *
 * Four questions per pair, and the first is the one that matters:
 *
 *   • **no gap** — the neckline seam runs under the collar for its whole
 *     length. A collar that stops above it leaves an unfinished edge, which is
 *     what "sewn into the neckline" means when you check it rather than say it.
 *   • **attached** — the two share enough cloth to be sewn together at all,
 *     so a collar cannot hover a few units clear of the garment.
 *   • **not floating** — no collar pixel lies over neither cloth nor body. A
 *     cowl over a bare chest is on the body and fine; a collar wider than the
 *     shoulder it sits on is not.
 *   • **coverage** — the pair together leave no body erased and unpainted,
 *     which is the same rule every garment is already held to, applied to the
 *     union of what the two claim.
 */
function checkCollars(bodyKey, cover, body, painted, rows) {
  const problems = [];
  const wardrobe = garmentsFor(bodyKey);
  const mine = collarsFor(bodyKey);
  const paints = new Map();
  /** Each collar's front outline, for the straight-edge check. */
  const outlines = new Map();
  /** The behind-the-neck half of each band, for the contact sheet. */
  const backs = new Map();
  /**
   * The cut that presents a given opening, on a garment that has cuts.
   *
   * A collar names the opening it needs and a neckline presents one, so a
   * mandarin on this dress means the dress cut to something with cloth at the
   * base of the throat — `high`, `keyhole` or `collared` — and not whichever cut
   * it happens to default to. Measured against the default the band covered 53
   * of 289 points of a scooped neckline, which is true and is a question nobody
   * asked: that pair is not offered.
   */
  /** Whether a collar is sewn into the opening a cut presents — see `Collar.cuts`. */
  const sews = (collar, opening) =>
    opening !== null && opening !== undefined && (collar.cuts ?? [collar.opening]).includes(opening);
  /**
   * Every cut of a garment that offers a collar — not only the first with
   * its opening. A collar was measured on one cut per opening, so a Peter Pan
   * was only ever checked on the round neck, and sat above the scoop's
   * opening and floated inside the boat's with every check passing.
   */
  const cutsFor = (garment, collar) => cutsOf(garment.asset.front).filter((c) => sews(collar, NECKLINE_OPENING[c]));

  /** A garment's cloth, cut to an opening — on a garment with cuts, to one cut presenting it. */
  const clothFor = (garment, opening, cut = null) => {
    const key = cut ? `${garment.id}:${opening}:${cut}` : `${garment.id}:${opening}`;
    if (!painted.has(key)) {
      painted.set(
        key,
        rasterize(artPaths(garment.asset.front, body, { opening, cut }))
      );
    }
    return painted.get(key);
  };

  for (const collar of mine) {
    const before = problems.length;
    const front = artPaths(collar.asset.front, body);
    const paint = rasterize(front);
    paints.set(collar.id, paint);
    outlines.set(collar.id, front);

    /*
      The band behind the neck, judged by its own rule.

      It is drawn under the photograph, so most of it is hidden and the rest
      sits against the background above the shoulder line — which the front
      layer's "nothing may hang over neither cloth nor body" would reject, and
      rightly, since for a front piece that is always a mistake. What is wrong
      *here* is a band that is not a band: every visible pixel has to hug the
      neck, or the piece is a cape hanging behind the figure.
    */
    if (collar.asset.behindBody) {
      const back = rasterize(
        artPaths(collar.asset.behindBody, body, { behind: true })
      );
      backs.set(collar.id, back);
      let stray = 0;
      let worst = null;
      for (let i = 0; i < back.length; i++) {
        if (back[i] < 0.5) continue;
        const x = i % W;
        const y = (i / W) | 0;
        if (cover[i] > 0.5) continue; // hidden behind the body: always fine
        const row = rows[y];
        const clear =
          !row || y > NECK_FLOOR
            ? Infinity
            : Math.max(row.lo - x, x - row.hi, 0);
        if (clear > BEHIND_MARGIN) {
          stray++;
          if (!worst) worst = [x, y];
        }
      }
      if (stray > 0) {
        problems.push(
          `${collar.id} behindBody: ${stray} px stand more than ` +
            `${BEHIND_MARGIN} units clear of the neck (first at ` +
            `${worst[0]},${worst[1]}) — that is a cape, not a collar band`
        );
      }
      if (back.length && !back.some((v) => v >= 0.5)) {
        problems.push(`${collar.id} names a behindBody drawing that paints nothing`);
      }
    } else if (collar.build.stand > 0) {
      problems.push(
        `${collar.id} stands ${collar.build.stand} units but has no behindBody ` +
          `piece — a band that never passes behind the neck reads as a decal`
      );
    }

    /*
      Does the drawing stand as high as the record says?

      This is the assertion the nine collars needed and did not have. They all
      shared one 22-unit band while their records declared 16, 0, 22, 14, 10, 0,
      12, 18 and 30 — nine numbers describing nothing, and the visible result
      was a mandarin with something stuck to the front, whichever you picked.
      `stand` only means anything if the cloth has to obey it.
    */
    const top = boundingBox(paint)?.y0;
    if (top !== undefined) {
      const drawn = NECK_SEAM_Y - top;
      if (Math.abs(drawn - collar.build.stand) > STAND_SLACK) {
        problems.push(
          `${collar.id} declares a ${collar.build.stand}-unit stand but its ` +
            `drawing rises ${drawn} above the neckline — the number and the ` +
            `cloth disagree`
        );
      }
    }

    // What it claims, on its own. A collar may not name a zone it does not
    // cover end to end, whatever the garment beneath happens to hide.
    if (collar.coverage.length > 0) {
      const { holes } = countHoles(
        cover,
        erasedZones(body, collar.coverage),
        [paint]
      );
      if (holes > 40) {
        problems.push(
          `${collar.id} claims ${collar.coverage.join(", ")} but leaves ` +
            `${holes} px of it bare`
        );
      }
    }

    /*
      And only where the garment can actually be cut to it. A garment with
      necklines offers a collar if *some* cut presents the opening it needs;
      one without them cuts whatever its drawing cuts, as before.
    */
    const fits = wardrobe.filter(
      (g) =>
        collarsForGarment(g).includes(collar) &&
        (cutsOf(g.asset.front).length === 0 || cutsFor(g, collar).length > 0)
    );
    if (fits.length === 0) {
      problems.push(`${collar.id} fits nothing in the ${bodyKey} wardrobe`);
    }

    let sewnTo = 0;
    for (const garment of fits) {
    for (const cut of cutsOf(garment.asset.front).length > 0 ? cutsFor(garment, collar) : [null]) {
      sewnTo++;
      /* the opening this cut presents, and the collar as it is drawn on it */
      const opening = cut ? NECKLINE_OPENING[cut] : collar.opening;
      const cloth = clothFor(garment, opening, cut);
      const sewn = COLLAR_CLOTH[collar.asset.front] && cut ? rasterize(artPaths(collar.asset.front, body, { cut })) : paint;
      const pair = `${collar.id} × ${garment.id}${cut ? ` · ${cut}` : ""}`;

      const seam = neckSeam(garment.asset.front, body, opening, cut);
      if (!seam) {
        problems.push(`${garment.id} accepts collars but exports no NECK_SEAM`);
      } else {
        /*
          An open-fronted collar is excused the stretch of seam in its own
          opening — and only that stretch: a bare point must have the collar's
          cloth on *both* sides of it along its row, which is what "between the
          panels" means. A collar that has simply come off its seam leaves bare
          points with cloth on one side or none, and those still fail.
        */
        const between = (x, y) => {
          if (collar.build.front !== "open") return false;
          const row = Math.round(y) * W;
          let left = false;
          let right = false;
          for (let c = 0; c < W; c++) {
            if (sewn[row + c] < 0.5) continue;
            if (c < x) left = true;
            else right = true;
          }
          return left && right;
        };
        const bare = seam.filter(
          ([x, y]) => !paintedNear(sewn, x, y, SEAM_SLACK) && !between(x, y)
        );
        if (bare.length > 0) {
          const [x, y] = bare[0];
          problems.push(
            `${pair}: the neckline is not covered — ${bare.length} of ` +
              `${seam.length} points bare, first at ${Math.round(x)},${Math.round(y)}`
          );
        }
      }

      /*
        A collar with no stand may not rise above that seam at all.

        `Collar.build.stand` is documented as "how far the band rises **above
        the neckline seam**", and until now nothing held a drawing to it below
        the whole-collar height check — which measures one topmost pixel
        against a flat y 180 and so cannot see cloth sitting inside the middle
        of a curved opening.

        `stand: 0` is the case with no ambiguity in it. A flat collar lies *on*
        the garment, outside the opening; the neck comes up through the
        garment's opening in front of nothing. Let it paint above the seam and
        it fills the top of that opening and leaves a smaller round hole of its
        own, with the neck through the middle — which is exactly how the Peter
        Pan came to read as a ring rather than as cloth. Measured, its inner
        edge sat 18 units inside the blouse's opening.

        Read per column, against the seam directly above or below it, because a
        neckline is a curve: at the collar point the seam is up at the shoulder
        and at centre front it is thirty-odd units lower, and a single flat
        bound would either let the middle float or condemn the ends.
      */
      if (seam && collar.build.stand === 0) {
        const ceiling = new Float64Array(W).fill(Infinity);
        for (const [sx, sy] of seam) {
          const c = Math.round(sx);
          if (c >= 0 && c < W) ceiling[c] = Math.min(ceiling[c], sy);
        }
        /* Past the collar point the neckline has become the shoulder seam, so
           the bound out there is the nearest end of the curve. */
        let carry = Infinity;
        for (let x = 0; x < W; x++) {
          if (ceiling[x] === Infinity) ceiling[x] = carry;
          else carry = ceiling[x];
        }
        carry = Infinity;
        for (let x = W - 1; x >= 0; x--) {
          if (ceiling[x] === Infinity) ceiling[x] = carry;
          else carry = ceiling[x];
        }

        let risen = 0;
        let peak = 0;
        let peakAt = null;
        for (let x = 0; x < W; x++) {
          if (ceiling[x] === Infinity) continue;
          const limit = ceiling[x] - FLAT_SLACK;
          for (let y = 0; y < limit; y++) {
            if (sewn[y * W + x] < 0.5) continue;
            risen++;
            if (limit - y > peak) {
              peak = limit - y;
              peakAt = [x, y];
            }
            break;
          }
        }
        if (peak > 0) {
          problems.push(
            `${pair}: the collar lies ${Math.round(peak)} units inside the ` +
              `opening on ${risen} columns (worst at ${peakAt[0]},${peakAt[1]}) ` +
              `— it declares no stand, so every part of it belongs on or below ` +
              `the neckline, and cloth above it is a second, smaller neck hole`
          );
        }
      }

      /*
        "Floating" means cloth over neither the garment nor the body, which for
        a flat collar is always a mistake. A *standing* one is different: a ruff
        or a band rises beside the throat, where above the shoulder line there
        is simply no body to be over, and holding it to the flat rule would mean
        shrinking every standing collar until it lay down again. So above the
        neck the bound becomes the shoulder seam — which is what stops it
        becoming a cape, and is the thing actually worth forbidding.
      */
      const stands = collar.build.stand > 0;
      let attached = 0;
      let floating = 0;
      for (let i = 0; i < sewn.length; i++) {
        if (sewn[i] < 0.5) continue;
        if (cloth[i] >= 0.5) {
          attached++;
          continue;
        }
        if (cover[i] > 0.5) continue;
        const x = i % W;
        const y = (i / W) | 0;
        const besideTheNeck =
          stands &&
          y <= NECK_FLOOR &&
          x >= body.anchors.shoulderX.left &&
          x <= body.anchors.shoulderX.right;
        if (!besideTheNeck) floating++;
      }
      if (attached < MIN_ATTACHED) {
        problems.push(`${pair}: only ${attached} px of cloth in common — not sewn on`);
      }
      if (floating > MAX_FLOATING) {
        problems.push(
          `${pair}: ${floating} px hang over neither cloth nor body`
        );
      }

      const sleeved =
        garment.sleeves && (!cut || NECKLINE_SLEEVES[cut] === "both");
      /* less what the cut bares — a scoop opens the upper chest, a boat the shoulders — as every other check has it */
      const bares = cut ? (NECKLINE_BARES[cut] ?? []) : [];
      const bared = garment.coverage.filter((z) => !bares.includes(z));
      const own = sleeved
        ? sleeveCoverage(bodyKey, bared, garment.sleeves.default)
        : bared;
      const coverage = [...new Set([...own, ...collar.coverage])];
      const { holes, at } = countHoles(cover, erasedZones(body, coverage), [
        cloth,
        sewn,
      ]);
      if (holes > 40) {
        problems.push(
          `${pair}: ${holes} px erased and unpainted at x ${at.x0}–${at.x1}, ` +
            `y ${at.y0}–${at.y1}`
        );
      }
    }
    }

    const bad = problems.length - before;
    console.log(
      `${bad > 0 ? "HOLE" : "ok  "} ${bodyKey.padEnd(6)} ` +
        `${collar.id.padEnd(26)} sewn to ${String(fits.length).padStart(2)} garment${fits.length === 1 ? "" : "s"}, ` +
        `checked on ${sewnTo === 1 ? "the one cut" : `each of the ${sewnTo} cuts`} that offer${sewnTo === 1 ? "s" : ""} it` +
        (bad > 0 ? `, ${bad} problem(s)` : "")
    );
  }

  for (const problem of problems) {
    console.log(`     ${bodyKey.padEnd(6)} collar    ${problem}`);
  }
  return { problems: problems.length, paints, backs, outlines };
}

/** Every garment belongs to exactly one wardrobe, under a unique id. */
function checkWardrobes() {
  const problems = [];
  const seen = new Set();
  const known = Object.keys(bodies);

  for (const g of garments) {
    if (seen.has(g.id)) problems.push(`${g.id} is declared twice`);
    seen.add(g.id);

    const offered = known.filter((body) => garmentsFor(body).includes(g));
    if (offered.length !== 1) {
      problems.push(
        `${g.id} is "${g.gender}" and is offered on ${offered.length} bodies` +
          ` — a garment names exactly one`
      );
    }
  }

  for (const problem of problems) {
    console.log(`WRONG        wardrobe  ${problem}`);
  }
  return problems.length;
}

/**
 * Every collar belongs to one wardrobe, and is never offered outside it.
 *
 * The mirror of `checkWardrobes`, and for the same reason: a collar is drawn
 * against one figure's neck points, so one offered on the other body would sit
 * over a neckline it was never cut to — and if it claimed a zone, erase a
 * throat nothing paints back.
 */
function checkCollarWardrobes() {
  const problems = [];
  const seen = new Set();
  const known = Object.keys(bodies);

  for (const c of collars) {
    if (seen.has(c.id)) problems.push(`${c.id} is declared twice`);
    seen.add(c.id);

    if (!known.includes(c.gender)) {
      problems.push(`${c.id} is cut for "${c.gender}", which is not a body`);
    }
    if (!c.id.startsWith(`${c.gender}-`) || !c.id.endsWith("-collar")) {
      problems.push(`${c.id} is not named <body>-<name>-collar`);
    }
    if (c.compatibleWith.length === 0) {
      problems.push(`${c.id} fits no garment category — it can never be worn`);
    }
    const offered = known.filter((body) => collarsFor(body).includes(c));
    if (offered.length !== 1) {
      problems.push(
        `${c.id} is offered on ${offered.length} bodies — a collar names one`
      );
    }
  }

  // The assertion in one line: no collar reaches a garment from another body.
  for (const g of garments) {
    for (const c of collarsForGarment(g)) {
      if (c.gender !== g.gender) {
        problems.push(`${c.id} is selectable on ${g.id}, cut for ${g.gender}`);
      }
    }
    // A garment finishes its own neck or leaves it to a collar, never both.
    if (g.acceptsCollar && g.fabricRegions.includes("collar")) {
      problems.push(
        `${g.id} draws its own collar region and accepts a swappable one`
      );
    }
  }

  for (const problem of problems) {
    console.log(`WRONG        collars   ${problem}`);
  }
  return problems.length;
}


/* ----------------------------------------------------- drawn at all */

/**
 * Every garment draws, in everything it is drawn in.
 *
 * This file reads a drawing by evaluating its constants out of the source,
 * and a constant it cannot evaluate is not an error: it is simply missing,
 * and every rule then runs against whatever is left. That is how the t-shirt,
 * whose outline function took an optional argument this evaluator could not
 * yet read, was checked against nothing at all and passed. So two guards,
 * and both fail loudly:
 *
 * - **Read.** Every outline a drawing declares — a `*_PATH`, its `CLOTH` or
 *   `TUCKED` function, its jacket construction — has to have evaluated.
 * - **Drawn.** Every cut, sleeve and cuff it is drawn in has to put a real
 *   area of cloth down: `MIN_DRAWN` pixels, where the smallest garment here
 *   covers well over ten times that.
 */
const MIN_DRAWN = 2000;

/** How much cloth a raster holds. */
const areaOf = (cloth) => {
  let n = 0;
  for (let i = 0; i < cloth.length; i++) if (cloth[i] >= 0.5) n++;
  return n;
};

/** Fails for a raster with next to nothing in it, naming what was drawn. */
function drawn(bodyKey, label, cloth) {
  const area = areaOf(cloth);
  if (area >= MIN_DRAWN) return 0;
  console.log(
    `EMPTY ${bodyKey.padEnd(6)} ${label.padEnd(26)} draws ${area} px of cloth — a drawing that did not ` +
      `evaluate, or drew nothing, is never a pass`
  );
  return 1;
}

/** Fails for any outline a garment's drawing declares that this file could not evaluate. */
function checkDrawingsRead(bodyKey, body, wardrobe) {
  let failed = 0;
  for (const garment of wardrobe) {
    const assetId = garment.asset.front;
    if (CUT_MODULES[assetId]) continue;
    const source = readFileSync(join(ART_DIR, artFile(assetId)), "utf8");
    const table = artTable(assetId, body);
    const declared = [...source.matchAll(/(?:export\s+)?const\s+(\w+_PATH|CLOTH|TUCKED|J)\s*(?::[^=]+)?=/g)]
      .map((m) => m[1])
      /* a cast is a shadow, not cloth — see `artPaths` — and is never checked as cloth */
      .filter((name) => !name.endsWith("_CAST_PATH"));
    const unread = declared.filter((name) => !table.has(name));
    if (unread.length > 0) {
      failed++;
      console.log(
        `UNREAD ${bodyKey.padEnd(6)} ${garment.id.padEnd(26)} ${unread.join(", ")} did not evaluate — ` +
          `the checks would run against a drawing missing them`
      );
    }
  }
  return failed;
}

/* ------------------------------------------------- the trousers' details */

/**
 * The details sewn into a pair of trousers — the fly, the slanted pockets and
 * the belt loops, drafted by `trouserDetails` in `garments/fit.ts` — lie on
 * the cloth, and move nothing about its outline. Every rule above measures
 * the outline, which the loops are drawn over and the lines are drawn on, so
 * a loop standing off the side seam, or a pocket's stitch run out past it,
 * would pass all of them while changing what the trousers look like. This
 * asks it directly:
 *
 * - every belt loop inside the cloth, to the pixel;
 * - every point of the fly's and the pockets' lines on it, within a unit;
 * - each pocket's opening meeting the side seam at its foot;
 * - and the fly's J stopping short of the crotch, as a fly does.
 */
const DETAIL_SLACK = 1;
/** The least a fly's J may stop above the crotch, in centimetres: "a little above" it. */
const FLY_ABOVE_CROTCH = 1;

function checkTrouserDetails(bodyKey, body, profile, wardrobe) {
  let failed = 0;
  const cm = (u) => u * BODY_CANVAS.cmPerUnit;
  for (const garment of wardrobe) {
    const assetId = garment.asset.front;
    if (CUT_MODULES[assetId]) continue;
    const table = artTable(assetId, body);
    const legs = [...table.values()].find((v) => v && typeof v === "object" && v.details?.loops);
    if (!legs) continue;
    const { fly, pockets, loops } = legs.details;
    const cloth = rasterize(artPaths(assetId, body));
    const on = ([x, y]) => {
      for (let dy = -DETAIL_SLACK; dy <= DETAIL_SLACK; dy++) {
        for (let dx = -DETAIL_SLACK; dx <= DETAIL_SLACK; dx++) {
          const px = Math.round(x) + dx;
          const py = Math.round(y) + dy;
          if (px >= 0 && py >= 0 && px < W && py < H && cloth[py * W + px] >= 0.5) return true;
        }
      }
      return false;
    };

    const loopPaint = rasterize(loops.pieces);
    let loopOut = 0;
    for (let i = 0; i < loopPaint.length; i++) if (loopPaint[i] >= 0.5 && cloth[i] < 0.5) loopOut++;

    const lines = [fly?.stitch, fly?.edge, ...pockets.flatMap((p) => [p.edge, p.stitch])].filter(Boolean);
    const points = lines.flatMap((d) => flatten(d).flat());
    const off = points.filter((p) => !on(p)).length;

    /* each opening's foot, on the side seam: the cloth's own edge on that row */
    const unmet = pockets.filter((p) => {
      const pts = flatten(p.edge).flat();
      const [x, y] = pts[pts.length - 1];
      const row = Math.round(y);
      let lo = W, hi = -1;
      for (let px = 0; px < W; px++) if (cloth[row * W + px] >= 0.5) { lo = Math.min(lo, px); hi = Math.max(hi, px); }
      return Math.min(Math.abs(x - lo), Math.abs(x - hi)) > DETAIL_SLACK + 1;
    }).length;

    const foot = fly ? flatten(fly.stitch).flat().at(-1) : null;
    const above = foot ? cm(profile.crotchY - foot[1]) : null;
    const short = above !== null && above < FLY_ABOVE_CROTCH;

    const bad = loopOut > 0 || off > 0 || unmet > 0 || short;
    if (bad) failed++;
    console.log(
      `${bad ? "OFF " : "ok  "} ${bodyKey.padEnd(6)} ${garment.id.padEnd(26)} ` +
        `details on the cloth: ${loops.pieces.length} loops, ${loopOut} px outside it; ` +
        `${points.length - off}/${points.length} points of the fly and pockets on it; ` +
        `${pockets.length - unmet}/${pockets.length} pockets meet the side seam` +
        (above !== null ? `; the fly stops ${above.toFixed(1)} cm above the crotch` : "")
    );
  }
  return failed;
}

/* --------------------------------------------------------- the layering */

/**
 * A garment under a jacket is inside it — see `Encloses` in
 * `garments/sleeves.ts`. Asked of every outfit the picker allows: each outer
 * garment that holds what is under it, over every garment it can be worn with,
 * in every cut and every sleeve that garment comes in.
 *
 * The renderer hides the inner layer, from the jacket's shoulders to its hem,
 * everywhere outside the jacket's outline with its front closed. This draws
 * that, and then asks what shows: inner cloth with no outer cloth over it,
 * between the shoulders and the hem, is allowed only in the jacket's front
 * opening — the run of open cloth through the centre line on that row — and
 * below its cuffs. Anything else is an inner layer showing outside the outer
 * one, which is exactly what a wrong outline would let through.
 *
 * It also asks three things of the fit. That the jacket's shoulder sits
 * outside the shoulder under it, before any mask: nothing of the inner layer
 * shows past it. That a long inner sleeve shows `REVEAL` below the jacket's
 * cuff, as tailoring does. And that nothing the outfit erases between them is
 * left unpainted once the inner layer is hidden — a sleeve hidden over an arm
 * the jacket does not cover would be a hole.
 */
const LAYER_LEAK = 0;
/** The most an outfit's outline may jump outward from one row to the next across a jacket's hem. */
const HEM_STEP = 2;
/** How much of a long inner sleeve should show below a jacket's: 1 to 1.5 cm, in units. */
const REVEAL = [5, 8.5];

/** Every sleeve a garment can be cut with, its cuffs included; `[null]` for one that has no choice. */
function sleeveChoicesOf(garment, bodyKey) {
  if (!garment.sleeves) return [null];
  const out = [];
  for (const type of garment.sleeves.types) {
    if (!SLEEVE_KINDS[type].bodies.includes(bodyKey)) continue;
    for (const length of ["sleeveless", ...SLEEVE_KINDS[type].lengths]) {
      const cuffs = SLEEVE_KIT.cuffsOffered(garment.sleeves.cuffs, { type, length });
      for (const cuff of cuffs.length > 0 ? cuffs : [null]) {
        out.push(cuff ? { type, length, cuff } : { type, length });
      }
    }
  }
  return out;
}

/** What an outer garment holds inside it, read out of its drawing. */
function enclosesOf(assetId, body) {
  for (const v of artTable(assetId, body).values()) {
    if (v && typeof v === "object" && v.encloses && Array.isArray(v.encloses.envelope)) return v.encloses;
  }
  return null;
}

/** The picker's rule: two garments conflict if they share a layer or one rules the other out. */
const conflicts = (a, b) =>
  a.id === b.id || a.layer === b.layer || a.incompatibleWith.includes(b.id) || b.incompatibleWith.includes(a.id);

/**
 * A jacket as what it holds: its cloth, the envelope and windows an inner
 * layer shows through, the rows it holds that layer over, and each row's
 * front opening. `null` for an outer garment that holds nothing.
 */
function jacketOf(outer, body) {
  const enc = enclosesOf(outer.asset.front, body);
  if (!enc) return null;
  const open = (v) => v < 0.5;
  const cloth = rasterize(artPaths(outer.asset.front, body));
  const inside = rasterize(enc.envelope);
  const windows = rasterize(enc.windows);
  const [top, bottom] = [Math.ceil(enc.band[0]), Math.floor(enc.band[1])];
  /*
    Each row's front opening: the run of open outer cloth through the centre
    line — or, where the fronts lap there, through a pixel either side of
    it, which is the opening's tip at the button.
  */
  const opening = [];
  for (let y = top; y < bottom; y++) {
    opening[y] = [W / 2, W / 2 - 1, W / 2 + 1, W / 2 - 2, W / 2 + 2]
      .map((x) => runAt(cloth, y, x, open))
      .find((r) => r !== null) ?? null;
  }
  const inOpening = (x, y) => {
    const r = opening[y];
    return r !== null && r !== undefined && x >= r[0] && x <= r[1];
  };
  /* whether what is worn inside shows at a pixel — the stage's mask: outside the band, or within the jacket */
  const shows = (i) => {
    const y = Math.floor(i / W);
    return y < top || y >= bottom || inside[i] >= 0.5 || windows[i] >= 0.5;
  };
  return { enc, cloth, inside, windows, top, bottom, inOpening, shows };
}

function checkLayering(bodyKey, body, cover, wardrobe) {
  let failed = 0;
  const profile = profileFor(bodyKey);
  const solid = (v) => v >= 0.5;

  for (const outer of wardrobe) {
    const jacket = jacketOf(outer, body);
    if (!jacket) continue;
    const { enc, cloth: outerCloth, inside, windows, top, bottom, inOpening } = jacket;
    const shoulderTo = top + 40;

    for (const inner of wardrobe) {
      if (inner.layer === "outer" || conflicts(inner, outer)) continue;
      const cuts = cutsOf(inner.asset.front);
      const variants = [
        ...sleeveChoicesOf(inner, bodyKey).map((sleeve) => ({ cut: cuts[0] ?? null, sleeve })),
        ...cuts.slice(1).map((cut) => ({ cut, sleeve: null })),
      ];
      let leak = 0;
      let shoulder = 0;
      let step = 0;
      let stepAt = "";
      /* a loose sleeve's crown is its own business: it rises past the shoulder on purpose */
      let looseShoulder = 0;
      let holes = 0;
      let worst = "";
      const reveals = [];
      const looseReveals = [];
      for (const { cut, sleeve } of variants) {
        const cloth = rasterize(artPaths(inner.asset.front, body, { cut, sleeve, inside: enc.hem }));
        const empty = drawn(bodyKey, `${inner.id} under ${outer.id}`, cloth);
        failed += empty;
        if (empty) continue;
        const visible = new Float32Array(W * H);
        let l = 0;
        let s = 0;
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const i = y * W + x;
            if (!solid(cloth[i])) continue;
            const banded = y >= top && y < bottom;
            const shown = !banded || solid(inside[i]) || solid(windows[i]);
            if (shown) visible[i] = 1;
            if (!banded || solid(outerCloth[i]) || inOpening(x, y)) continue;
            /* before the mask: a shoulder the jacket does not sit outside of */
            if (y < shoulderTo) s++;
            if (shown && !solid(windows[i])) l++;
          }
        }
        /*
          How far a long inner sleeve shows below the jacket's cuff, on the left
          arm — read only over the arm, so a skirt beside the hand is not taken
          for a sleeve. The loose sleeves are reported but not held to it: a
          bell's hem dips by design.
        */
        if (sleeve?.length === "long") {
          let rows = 0;
          for (let y = Math.ceil(enc.cuff); y < bottom; y++) {
            let any = false;
            const reach = Math.min(W / 2 - 40, (edgeAt(profile.armInner, y) ?? W / 2) + 3);
            for (let x = 0; x < reach && !any; x++) {
              const i = y * W + x;
              any = visible[i] > 0 && solid(windows[i]) && !solid(outerCloth[i]);
            }
            if (any) rows++;
          }
          (LOOSE_SLEEVES.includes(sleeve.type) ? looseReveals : reveals).push(rows);
        }
        /* and what the outfit erases, painted by the jacket or by what still shows of the inner layer */
        const bares = cut ? (NECKLINE_BARES[cut] ?? []) : [];
        const own = inner.coverage.filter((z) => !bares.includes(z));
        const sleeved = inner.sleeves && (cut === null || NECKLINE_SLEEVES[cut] === "both");
        const coverage = [
          ...new Set([...(sleeved ? sleeveCoverage(bodyKey, own, sleeve ?? inner.sleeves.default) : own), ...outer.coverage]),
        ];
        const h = countHoles(cover, erasedZones(body, coverage), [outerCloth, visible], null).holes;
        /*
          No step at the jacket's hem: row by row across it, the outfit's outline
          on each side may not jump outward — a garment coming out from under
          the hem wider than it was a shelf with square corners.
        */
        const edges = [];
        for (let y = Math.floor(enc.hem.y) - 8; y <= Math.ceil(enc.hem.y) + 16; y++) {
          let lo = null;
          let hi = null;
          for (let x = 60; x < W - 60; x++) {
            const i = y * W + x;
            if (solid(outerCloth[i]) || visible[i] > 0) {
              if (lo === null) lo = x;
              hi = x;
            }
          }
          edges.push([lo, hi]);
        }
        let st = 0;
        for (let r = 1; r < edges.length; r++) {
          const [l0, h0] = edges[r - 1];
          const [l1, h1] = edges[r];
          if (l0 !== null && l1 !== null) st = Math.max(st, l0 - l1);
          if (h0 !== null && h1 !== null) st = Math.max(st, h1 - h0);
        }
        const label = `${cut ?? ""}${sleeve ? ` ${sleeve.type} ${sleeve.length}${sleeve.cuff ? ` ${sleeve.cuff} cuff` : ""}` : ""}`.trim();
        if (st > step) stepAt = label || "as it arrives";
        step = Math.max(step, st);
        const loose = sleeve && LOOSE_SLEEVES.includes(sleeve.type);
        if (l > leak || (!loose && s > shoulder) || h > holes) worst = label || "as it arrives";
        leak = Math.max(leak, l);
        if (loose) looseShoulder = Math.max(looseShoulder, s);
        else shoulder = Math.max(shoulder, s);
        holes = Math.max(holes, h);
      }
      const reveal = reveals.length ? [Math.min(...reveals), Math.max(...reveals)] : null;
      const badReveal = reveal !== null && (reveal[0] < REVEAL[0] || reveal[1] > REVEAL[1]);
      const bad = leak > LAYER_LEAK || shoulder > LAYER_LEAK || holes > 40 || badReveal || step > HEM_STEP;
      if (bad) failed++;
      const cm = (u) => (u * BODY_CANVAS.cmPerUnit).toFixed(1);
      console.log(
        `${bad ? "HOLE" : "ok  "} ${bodyKey.padEnd(6)} ${`${outer.id} over ${inner.id}`.padEnd(38)} ` +
          `${String(variants.length).padStart(2)} cuts and sleeves: ${leak} px outside, ` +
          `${shoulder} px past its shoulder${looseShoulder ? ` (a puffed crown ${looseShoulder} px, hidden)` : ""}, ${holes} px uncovered, ` +
          `a ${step} px step at its hem${step > HEM_STEP ? ` (${stepAt})` : ""}` +
          (reveal ? `, a long sleeve shows ${cm(reveal[0])}–${cm(reveal[1])} cm below the cuff` : "") +
          (looseReveals.length ? ` (a loose one ${cm(Math.max(...looseReveals))} at most)` : "") +
          (bad && worst ? `  — worst: ${worst}` : "")
      );
    }
  }
  return failed;
}

/*
  ------------------------------------------------------------ the base layer

  What each mannequin wears under everything — see `garments/baseLayer.ts`.
  Imported for real, like the fit kit, so this measures the pieces the stage
  draws, and asks the stage's own rule which of them an outfit shows.
*/
const BASE = await import(src("src/lib/garments/baseLayer.ts"));
const { BUST } = await import(src("src/lib/garments/art/female/yoke.ts"));

/** How far round each apex her chest is held to be covered: 3 cm. */
const CHEST_RADIUS = 16;
/**
 * A hem turns up into its garment's side in a curve, and over the last rows
 * of the turn what is under it shows beside it: the shorts at a shirt's
 * rounded corner. A sliver up the side runs further than this.
 */
const HEM_TURN = 4;

/**
 * The base layer, in every outfit the picker allows.
 *
 * An outfit is any pick of at most one garment a layer that the picker lets
 * stand together, each garment in every neckline cut it has. In each:
 *
 *   - the rule, as it was asked for: the tank only with no top or dress on,
 *     the shorts only with no bottom or dress on. Written out here, and the
 *     stage's `baseLayer` held to it;
 *   - inside a jacket, nothing of it shows but in the jacket's front opening,
 *     and the shorts below the jacket's hem;
 *   - nothing of it shows in a row that a garment worn over it closes all the
 *     way across the body — a waistband over the tank, a top over the shorts
 *     above its hem. Anything showing there is a sliver beside that garment,
 *     or a glimpse through it;
 *   - and her bust, and both bodies' hips, are never bare: covered by what is
 *     worn, as it is drawn, or by what shows of the base layer.
 *
 * Sleeves are left as each garment arrives in them, and collars are not
 * drawn: neither reaches anything measured here.
 */
function checkBaseLayer(bodyKey, body, cover, wardrobe) {
  const solid = (v) => v >= 0.5;
  const profile = profileFor(bodyKey);
  const female = bodyKey === "female";
  const N = W * H;

  /* where a set of pixels lies, as the other checks report it */
  const span = (px) => {
    const xs = px.map((i) => i % W);
    const ys = px.map((i) => Math.floor(i / W));
    return `x ${Math.min(...xs)}–${Math.max(...xs)}, y ${Math.min(...ys)}–${Math.max(...ys)}`;
  };

  const own = BASE.BASE_PIECES[bodyKey];
  const pieceCloth = { shorts: rasterize(own.shorts.shapes), tank: own.tank ? rasterize(own.tank.shapes) : null };

  /*
    A hand or forearm hangs in front of the clothes — where nothing worn
    covers it — and what it hides is neither bare nor showing. The regions
    below leave out wherever one can hang; what shows is asked per outfit.
  */
  const overlay = body.overlay.map((z) => zoneMask(body, z));
  const inFront = (i) => overlay.some((m) => m[i] > 0);
  const frontFor = (outfit) => {
    const covered = new Set();
    for (const { garment, cut } of outfit) {
      const bares = cut ? (NECKLINE_BARES[cut] ?? []) : [];
      const own = garment.coverage.filter((z) => !bares.includes(z));
      const sleeved = garment.sleeves && (cut === null || NECKLINE_SLEEVES[cut] === "both");
      for (const z of sleeved ? sleeveCoverage(bodyKey, own, garment.sleeves.default) : own) covered.add(z);
    }
    const masks = body.overlay.filter((z) => !covered.has(z)).map((z) => zoneMask(body, z));
    return (i) => masks.some((m) => m[i] > 0);
  };

  /*
    The trunk, row by row, from the armpit down: between the body's own edges,
    so an arm hanging beside it is no part of it. Below the crotch it is the
    two legs, and the gap between them is not body.
  */
  const trunk = new Map();
  for (let y = profile.armpitY; y <= edgeEnd(profile.legOuter); y++) {
    const l = y < profile.crotchY ? edgeAt(profile.torso, y) : edgeAt(profile.legOuter, y);
    if (l === null) continue;
    const xs = [];
    for (let x = Math.ceil(l); x <= Math.floor(W - l); x++) if (solid(cover[y * W + x])) xs.push(x);
    if (xs.length > 0) trunk.set(y, xs);
  }

  /* her bust, a disc round each apex; and the hips, the body's own hip zone on the trunk */
  const chest = [];
  if (female) {
    for (const [cx, cy] of BUST.points) {
      for (let y = Math.floor(cy - CHEST_RADIUS); y <= Math.ceil(cy + CHEST_RADIUS); y++) {
        for (let x = Math.floor(cx - CHEST_RADIUS); x <= Math.ceil(cx + CHEST_RADIUS); x++) {
          const i = y * W + x;
          if (Math.hypot(x - cx, y - cy) <= CHEST_RADIUS && solid(cover[i]) && !inFront(i)) chest.push(i);
        }
      }
    }
  }
  const hipZone = zoneMask(body, "hip");
  const hips = [];
  for (const [y, xs] of trunk) {
    for (const x of xs) if (solid(hipZone[y * W + x]) && !inFront(y * W + x)) hips.push(y * W + x);
  }

  /* every outfit the picker allows: at most one garment a layer, none ruling another out… */
  let picks = [[]];
  for (const layer of LAYER_ORDER) {
    const choices = wardrobe.filter((g) => g.layer === layer);
    picks = picks.flatMap((p) => [p, ...choices.filter((g) => p.every((h) => !conflicts(g, h))).map((g) => [...p, g])]);
  }
  /* …each garment in every cut it has, innermost first */
  const outfits = picks.map((pick) =>
    pick.reduce(
      (acc, garment) => {
        const cuts = cutsOf(garment.asset.front);
        return acc.flatMap((o) => (cuts.length > 0 ? cuts : [null]).map((cut) => [...o, { garment, cut }]));
      },
      [[]]
    )
  );

  /*
    What the stage draws of an outfit: a garment every zone of which a layer
    over it covers is not drawn — `visibleStack`, asked of the record's
    coverage less what its cut bares.
  */
  const drawnOf = (outfit) => {
    const above = new Set();
    const out = [];
    for (let k = outfit.length - 1; k >= 0; k--) {
      const { garment, cut } = outfit[k];
      const bares = cut ? (NECKLINE_BARES[cut] ?? []) : [];
      const coverage = garment.coverage.filter((z) => !bares.includes(z));
      if (!(coverage.length > 0 && coverage.every((z) => above.has(z)))) out.unshift(outfit[k]);
      for (const z of coverage) above.add(z);
    }
    return out;
  };

  const clothCache = new Map();
  const clothOf = (garment, cut, inside) => {
    const key = `${garment.id}|${cut ?? ""}|${inside ? "inside" : ""}`;
    if (!clothCache.has(key)) clothCache.set(key, rasterize(artPaths(garment.asset.front, body, { cut, inside })));
    return clothCache.get(key);
  };
  const jacketCache = new Map();
  const jacketFor = (garment) => {
    if (!jacketCache.has(garment.id)) jacketCache.set(garment.id, jacketOf(garment, body));
    return jacketCache.get(garment.id);
  };

  let failed = 0;
  let tried = 0;
  for (const variants of outfits) {
    const ids = variants[0].map(({ garment }) => garment.id);
    const label = ids.length > 0 ? ids.join(" + ") : "nothing worn";
    const worst = { rule: "", outside: 0, closed: 0, chest: 0, hips: 0, at: "" };
    let shownKinds = [];
    for (const outfit of variants) {
      tried++;
      const categories = outfit.map(({ garment }) => garment.category);
      /* the rule, as asked */
      const wants = [
        ...(!categories.some((c) => c === "bottom" || c === "dress") ? ["shorts"] : []),
        ...(female && !categories.some((c) => c === "top" || c === "dress") ? ["tank"] : []),
      ];
      const kinds = BASE.baseLayer(bodyKey, categories).map((p) => p.kind);
      if (kinds.join() !== wants.join()) worst.rule = `draws ${kinds.join(", ") || "none"}, the rule says ${wants.join(", ") || "none"}`;
      shownKinds = kinds;

      /* as drawn: each garment inside every jacket over it, shown only where that jacket shows it */
      const drawn = drawnOf(outfit);
      const holders = drawn.map(({ garment }, k) => ({ k, J: jacketFor(garment) })).filter(({ J }) => J);
      const shownIn = (k, i) => holders.every((h) => h.k <= k || h.J.shows(i));
      const layers = drawn.map(({ garment, cut }, k) => ({
        garment,
        cloth: clothOf(garment, cut, holders.find((h) => h.k > k)?.J.enc.hem ?? null),
        k,
      }));
      const clothShown = new Uint8Array(N);
      for (const { cloth, k } of layers) {
        for (let i = 0; i < N; i++) if (!clothShown[i] && solid(cloth[i]) && shownIn(k, i)) clothShown[i] = 1;
      }
      /* and the base layer under it all, inside every jacket, and behind a bare hand */
      const front = frontFor(outfit);
      const baseShown = new Uint8Array(N);
      const kindAt = new Map();
      for (const kind of kinds) {
        const c = pieceCloth[kind];
        for (let i = 0; i < N; i++) {
          if (!baseShown[i] && solid(c[i]) && !clothShown[i] && shownIn(-1, i) && !front(i)) {
            baseShown[i] = 1;
            kindAt.set(i, kind);
          }
        }
      }

      /* inside a jacket: only in its opening — and the shorts below its hem */
      const outside = new Set();
      for (const { J } of holders) {
        for (const [i, kind] of kindAt) {
          const y = Math.floor(i / W);
          const below = y >= J.bottom && kind === "shorts";
          if (!below && !(y >= J.top && y < J.bottom && J.inOpening(i % W, y))) outside.add(i);
        }
      }
      /* nothing in a row a garment over it closes across the body */
      const peeks = new Set();
      for (const { garment, cloth } of layers) {
        if (jacketFor(garment)) continue;
        const shut = new Set();
        for (const [y, xs] of trunk) if (xs.every((x) => solid(cloth[y * W + x]))) shut.add(y);
        for (const y of shut) {
          /* short of the turn at either end of the run it closes */
          let within = true;
          for (let d = 1; d <= HEM_TURN && within; d++) within = shut.has(y - d) && shut.has(y + d);
          if (!within) continue;
          for (let x = 0; x < W; x++) if (baseShown[y * W + x]) peeks.add(y * W + x);
        }
      }
      const closed = peeks.size;
      /* and nothing bare */
      const bare = (px) => px.filter((i) => !clothShown[i] && !baseShown[i]);
      const chestBare = bare(chest);
      const hipsBare = bare(hips);

      const cut = outfit.find(({ cut }) => cut)?.cut ?? "";
      const wrong = [...outside, ...peeks, ...chestBare, ...hipsBare];
      if (wrong.length > worst.outside + worst.closed + worst.chest + worst.hips) {
        worst.at = [cut, wrong.length > 0 ? `at ${span(wrong)}` : ""].filter(Boolean).join(" ");
      }
      worst.outside = Math.max(worst.outside, outside.size);
      worst.closed = Math.max(worst.closed, closed);
      worst.chest = Math.max(worst.chest, chestBare.length);
      worst.hips = Math.max(worst.hips, hipsBare.length);
    }
    const bad = worst.rule !== "" || worst.outside > 0 || worst.closed > 0 || worst.chest > 0 || worst.hips > 0;
    if (bad) failed++;
    const cuts = variants.length > 1 ? ` · ${variants.length} cuts` : "";
    console.log(
      `${bad ? "HOLE" : "ok  "} ${bodyKey.padEnd(6)} ${`${label}${cuts}`.padEnd(46)} ` +
        `shows ${shownKinds.join(" and ") || "none of it"}: ` +
        `${worst.outside} px outside a jacket's opening, ${worst.closed} px under a garment closed over it` +
        `${female ? `, bust ${worst.chest} px bare` : ""}, hips ${worst.hips} px bare` +
        (worst.rule ? ` — ${worst.rule}` : "") +
        (bad && worst.at ? `  — worst: ${worst.at}` : "")
    );
  }
  console.log(`     ${bodyKey.padEnd(6)} base layer: ${tried} outfits, ${outfits.length} without counting cuts, ${failed} failing\n`);
  return failed;
}

failures += checkWardrobes();
failures += checkCollarWardrobes();

for (const bodyKey of Object.keys(bodies)) {
  const body = bodies[bodyKey];
  const cover = bodyCoverage(body);
  const rows = edgeRows(cover);
  const profile = profileFor(bodyKey);
  failures += checkProfile(bodyKey, body, profile);
  failures += checkAnchors(bodyKey, cover, rows, body.anchors);
  failures += checkSeams(bodyKey, rows, body);
  failures += checkWardrobe(bodyKey);
  failures += checkDrawingsRead(bodyKey, body, garmentsFor(bodyKey));
  failures += checkTrouserDetails(bodyKey, body, profile, garmentsFor(bodyKey));
  failures += checkLayering(bodyKey, body, cover, garmentsFor(bodyKey));
  failures += checkBaseLayer(bodyKey, body, cover, garmentsFor(bodyKey));
  const rgba = Buffer.alloc(W * H * 4);
  const holeMap = new Uint8Array(W * H);

  /**
   * The garments this body can actually be dressed in — which, now that a
   * garment names the one body it is cut for, is exactly the garments cut for
   * it. One wardrobe each, never the cross product.
   *
   * The cross product used to pass, and that is what hid the bug: the female
   * drawings happened to be cut loose enough to clear the male figure too, so
   * checking a dress against him said "ok" while the app was busy putting it
   * on him. Fitting was never the question — eligibility was.
   */
  const wardrobe = garmentsFor(bodyKey);

  /** Each garment's cloth, rasterized once — the collar pass reuses them. */
  const painted = new Map();

  for (const garment of wardrobe) {
    /*
      Every rule below runs once per **cut**, not once per garment.

      A garment that takes necklines is fifteen garments as far as geometry is
      concerned: each cut moves the top corner of the body panel, and three of
      them take the sleeves off entirely. Checking only the one it happens to
      default to would leave fourteen unmeasured — and the whole reason the
      cuts are drafted rather than drawn is that unmeasured geometry in this
      project has always drifted.
    */
    const cuts = cutsOf(garment.asset.front);
    const wornCuts = cuts.length > 0 ? cuts : [null];
    let paint = null;

    /**
     * Every rule a cut of a garment is held to, for one cut and one sleeve.
     *
     * Asked once per neckline cut in the sleeve the garment arrives in, and
     * once per sleeve in the cut it arrives in — so every neckline and every
     * sleeve is measured, without drawing every one of their products.
     */
    const checkCut = (cutId, sleeve, label, loose) => {
      const cloth = rasterize(
        artPaths(garment.asset.front, body, { cut: cutId, sleeve })
      );
      let failed = drawn(bodyKey, label, cloth);

      /*
        A cut can **bare** a zone — a strapless bodice takes the shoulders and
        the arms off a dress that otherwise covers them — so coverage is asked
        of the cut rather than of the record. Releasing a zone can only ever
        make this easier: what is not erased cannot be a hole.
      */
      const bares = cutId ? (NECKLINE_BARES[cutId] ?? []) : [];
      const cutCoverage = garment.coverage.filter((z) => !bares.includes(z));
      /*
        And the sleeve decides the arm: a zone is claimed only if the sleeve
        spans all of it — the same rule `effectiveCoverage` applies, so the
        checker and the renderer erase the same photograph.
      */
      const sleeved =
        garment.sleeves && (cutId === null || NECKLINE_SLEEVES[cutId] === "both");
      const coverage = sleeved
        ? sleeveCoverage(bodyKey, cutCoverage, sleeve ?? garment.sleeves.default)
        : cutCoverage;

      const erased = erasedZones(body, coverage);
      const { holes, at } = countHoles(cover, erased, [cloth], holeMap);

      const tag = holes > 40 ? "HOLE" : "ok  ";
      if (holes > 40) failed++;
      console.log(
        `${tag} ${bodyKey.padEnd(6)} ${label.padEnd(26)} ` +
          `${String(holes).padStart(6)} px uncovered` +
          (holes > 40
            ? `  at x ${at.x0}–${at.x1}, y ${at.y0}–${at.y1}`
            : "")
      );

      /*
        Coverage says the cloth reaches the body. These three say it is the right
        shape when it gets there — square on the shoulders, clear of the arms, and
        open between the legs. A slab passes the first and fails all three, which
        is exactly the state this wardrobe was in.
      */
      if (!LOPSIDED.includes(cutId)) {
        failed += checkSymmetry(bodyKey, label, cloth);
      }
      /*
        A cut-on sleeve is cut in one with the body down to a deep underarm,
        and a flutter falls open over the arm: neither has the daylight under
        the arm a set-in sleeve keeps, by construction rather than by fault.
      */
      if (!loose) failed += checkArmGap(bodyKey, label, cloth, profile, coverage);
      failed += checkStandOff(bodyKey, label, garment, cloth, cover, profile);
      failed += checkLegGap(bodyKey, label, cloth, profile, coverage);
      failed += checkBareShoulders(bodyKey, label, cloth, profile, cutId);
      /* said aloud for a cut whose own band is on the arm — the off-shoulder's */
      failed += checkUnderarm(bodyKey, label, cloth, cover, profile, cutId !== null && NECKLINE_SLEEVES[cutId] === "band");
      return { cloth, failed };
    };

    for (const cutId of wornCuts) {
      const label = cutId ? `${garment.id} · ${cutId}` : garment.id;
      const { cloth, failed } = checkCut(cutId, null, label, false);
      failures += failed;
      // the collar pass reuses whichever cut the garment arrives in
      if (paint === null) paint = cloth;
    }

    /*
      A cut whose band is the top of its own sleeves — the off-shoulder — offers
      those sleeves at every length, and a cuff on the long one. They hang from
      that cut, not the one the garment arrives in, so the loop below never
      reaches them: each is checked here, quietly unless it fails.
    */
    for (const cutId of wornCuts.filter((c) => c !== null && NECKLINE_SLEEVES[c] === "band")) {
      let tried = 0;
      let failedCombos = 0;
      /* the cut's own fitted sleeve, and the loose ones the garment offers, each hung from the band */
      const bandTypes = SLEEVE_KIT.BAND_CUT_TYPES.filter(
        (t) =>
          SLEEVE_KINDS[t].bodies.includes(bodyKey) &&
          (SLEEVE_KINDS[t].construction === "band" || (garment.sleeves?.types ?? []).includes(t))
      );
      for (const type of bandTypes) {
        const fitted = SLEEVE_KINDS[type].construction === "band";
        for (const length of SLEEVE_KINDS[type].lengths) {
          const cuffs = SLEEVE_KIT.cuffsOffered(garment.sleeves?.cuffs, { type, length });
          for (const cuff of cuffs.length > 0 ? cuffs : [null]) {
            const sleeve = cuff ? { type, length, cuff } : { type, length };
            const label = `${garment.id} · ${cutId} ${fitted ? "fitted" : type} ${length}${cuff ? ` ${cuff} cuff` : ""}`;
            const lines = [];
            const log = console.log;
            console.log = (...a) => lines.push(a.join(" "));
            let failed = 0;
            try {
              /* a flutter falls open over the arm, here as on every cut: no daylight under it to keep */
              const res = checkCut(cutId, sleeve, label, type === "flutter");
              failed = res.failed;
              /*
                Below the underarm a sleeve parts from the body with the daylight
                her sleeves keep on every other cut. The cut bares the upper arm
                for its own band, so the arm gap is asked of the sleeve directly.
              */
              if (type !== "flutter" && length !== "short") failed += checkArmGap(bodyKey, label, res.cloth, profile, ["upperArm"]);
              /* every sleeve but the band alone carries on from the band */
              failed += checkBandArm(bodyKey, label, CUT_MODULES[garment.asset.front]?.bandArm?.(cutId, sleeve) ?? null, profile);
              if (fitted && length !== "short") {
                const g = sleeveGrowth(artPaths(garment.asset.front, body, { cut: cutId, sleeve }), bodyKey, sleeve);
                if (g && g.grows > SLEEVE_GROWTH) {
                  failed++;
                  console.log(
                    `HOLE ${bodyKey.padEnd(6)} ${label.padEnd(26)} sleeve widens ${g.grows.toFixed(1)} units ` +
                      `below its band, to ${g.width.toFixed(1)} at y ${g.y} — a sleeve hangs as a tube`
                  );
                }
              }
            } finally {
              console.log = log;
            }
            tried++;
            if (failed > 0) {
              failedCombos++;
              failures += failed;
              for (const line of lines) console.log(line);
            }
          }
        }
      }
      console.log(
        `${failedCombos ? "HOLE" : "ok  "} ${bodyKey.padEnd(6)} ${`${garment.id} · ${cutId}`.padEnd(26)} ` +
          `sleeves hung from the band: ${tried} combinations, ${failedCombos} failing`
      );
    }

    /*
      Every sleeve the garment offers, at every length it comes in, in the cut
      the garment arrives in. Quiet when it passes — twenty-odd combinations a
      garment would bury every other line — and loud, in full, when it does not.
    */
    if (garment.sleeves) {
      const cutId = wornCuts[0];
      let tried = 0;
      let failedCombos = 0;
      const cuffed = garment.sleeves.cuffs?.length ? garment.sleeves.cuffs : null;
      for (const type of garment.sleeves.types) {
        if (!SLEEVE_KINDS[type].bodies.includes(bodyKey)) continue;
        for (const length of ["sleeveless", ...SLEEVE_KINDS[type].lengths]) {
          /*
            And a long sleeve once per cuff it is offered with: a cuff is its
            own piece of cloth, and the sleeve above it ends differently.
          */
          const cuffs = SLEEVE_KIT.cuffsOffered(garment.sleeves.cuffs, { type, length });
          for (const cuff of cuffs.length > 0 ? cuffs : [null]) {
          const sleeve = cuff ? { type, length, cuff } : { type, length };
          const label = `${garment.id} · ${type} ${length}${cuff ? ` ${cuff} cuff` : ""}`;
          const lines = [];
          const log = console.log;
          console.log = (...a) => lines.push(a.join(" "));
          let failed = 0;
          try {
            failed = checkCut(cutId, sleeve, label, SLEEVE_KINDS[type].construction === "cut-on" || type === "flutter").failed;
            if (!LOOSE_SLEEVES.includes(type) && length !== "sleeveless") {
              const g = sleeveGrowth(artPaths(garment.asset.front, body, { cut: cutId, sleeve }), bodyKey, sleeve);
              if (g && g.grows > SLEEVE_GROWTH) {
                failed++;
                console.log(
                  `HOLE ${bodyKey.padEnd(6)} ${label.padEnd(26)} sleeve widens ${g.grows.toFixed(1)} units ` +
                    `below its underarm, to ${g.width.toFixed(1)} at y ${g.y} — a sleeve hangs as a tube`
                );
              }
            }
          } finally {
            console.log = log;
          }
          tried++;
          if (failed > 0) {
            failedCombos++;
            failures += failed;
            for (const line of lines) console.log(line);
          }
          }
        }
      }
      console.log(
        `${failedCombos ? "HOLE" : "ok  "} ${bodyKey.padEnd(6)} ${garment.id.padEnd(26)} ` +
          `sleeves: ${tried} combinations, ${failedCombos} failing` +
          (cuffed ? `, cuffs ${cuffed.join(" / ")} on every long sleeve that takes one` : "")
      );
    }

    painted.set(garment.id, paint);

    // Draw this garment's outline into the shared sheet, so one picture shows
    // every fit at once.
    const hue = wardrobe.indexOf(garment) * 60;
    const [r, g, b] = hsl(hue, 0.62, 0.55);
    for (let i = 0; i < paint.length; i++) {
      if (paint[i] < 0.5) continue;
      const o = i * 4;
      if (rgba[o + 3] > 0) continue; // first garment to claim a pixel keeps it
      rgba[o] = r;
      rgba[o + 1] = g;
      rgba[o + 2] = b;
      rgba[o + 3] = 150;
    }
  }

  // The body underneath, so misalignment is obvious.
  for (let i = 0; i < cover.length; i++) {
    if (cover[i] <= 0) continue;
    const o = i * 4;
    const a = rgba[o + 3];
    const shade = 205;
    rgba[o] = Math.round((rgba[o] * a) / 255 + (shade * (255 - a)) / 255);
    rgba[o + 1] = Math.round((rgba[o + 1] * a) / 255 + (shade * (255 - a)) / 255);
    rgba[o + 2] = Math.round((rgba[o + 2] * a) / 255 + (shade * (255 - a)) / 255);
    rgba[o + 3] = 255;
  }

  // Holes last and opaque: a garment that fails to cover what it erases is the
  // one thing this picture exists to show.
  for (let i = 0; i < holeMap.length; i++) {
    if (!holeMap[i]) continue;
    const o = i * 4;
    rgba[o] = 220;
    rgba[o + 1] = 20;
    rgba[o + 2] = 40;
    rgba[o + 3] = 255;
  }

  const file = join(OUT_DIR, `garment-${bodyKey}.png`);
  writeFileSync(file, encodePng(rgba, W, H));
  console.log(`     → ${file}\n`);

  const collarCheck = checkCollars(bodyKey, cover, body, painted, rows);
  failures += collarCheck.problems;
  if (collarCheck.paints.size > 0) {
    failures += checkCollarShapes(bodyKey, collarCheck.paints);
    failures += checkCollarEdges(bodyKey, collarCheck.outlines);
    failures += checkCollarHeight(
      bodyKey,
      collarCheck.paints,
      jawline(rows, body.anchors)
    );
  }
  if (collarCheck.paints.size > 0) {
    // Shown over the garment most of them are sewn to, so the join is visible.
    const under = wardrobe.find((g) => g.acceptsCollar && g.category === "top");
    const { png, ids } = collarSheet(
      cover,
      collarCheck.paints,
      (id) => {
        const collar = collars.find((c) => c.id === id);
        return (
          painted.get(`${under.id}:${collar.opening}`) ?? painted.get(under.id)
        );
      },
      collarCheck.backs
    );
    const file = join(OUT_DIR, `collar-${bodyKey}.png`);
    writeFileSync(file, png);
    console.log(`     → ${file}  (${ids.join(", ")}, over ${under.id})\n`);
  }
}

/**
 * A contact sheet: one tile per collar, cropped to the neck and shoulders.
 *
 * Not one figure with nine collars stacked on it, which is what this was first
 * and which showed only whichever collar was drawn first — every one of them
 * occupies the same hundred square units. Side by side they can be compared,
 * which is the only reason to draw a picture at all.
 */
function collarSheet(cover, paints, clothFor, backs) {
  const ids = [...paints.keys()];
  const rows = Math.ceil(ids.length / TILE.cols);
  const sw = TILE.w * TILE.cols;
  const sh = TILE.h * rows;
  const rgba = Buffer.alloc(sw * sh * 4, 255);

  ids.forEach((id, n) => {
    const paint = paints.get(id);
    // the garment cut to the opening *this* collar asked for, so a stand
    // collar is not shown hovering over a crew neck it is never sewn to
    const cloth = clothFor(id);
    const ox = (n % TILE.cols) * TILE.w;
    const oy = Math.floor(n / TILE.cols) * TILE.h;

    for (let y = 0; y < TILE.h; y++) {
      for (let x = 0; x < TILE.w; x++) {
        const i = (TILE.y0 + y) * W + (TILE.x0 + x);
        const o = ((oy + y) * sw + ox + x) * 4;

        // a hairline between tiles, so nine of them read as nine
        if (x === 0 || y === 0) {
          rgba[o] = rgba[o + 1] = rgba[o + 2] = 220;
          continue;
        }
        const back = backs.get(id);
        if (paint[i] >= 0.5) {
          [rgba[o], rgba[o + 1], rgba[o + 2]] = [232, 106, 44];
        } else if (back && back[i] >= 0.5) {
          // the band passing behind the neck, in a paler orange: whether a
          // collar wraps is exactly what these tiles exist to show
          [rgba[o], rgba[o + 1], rgba[o + 2]] = [246, 186, 150];
        } else if (cloth[i] >= 0.5) {
          [rgba[o], rgba[o + 1], rgba[o + 2]] = [232, 226, 218];
        } else if (cover[i] > 0.5) {
          [rgba[o], rgba[o + 1], rgba[o + 2]] = [198, 198, 198];
        }
      }
    }
  });

  return { png: encodePng(rgba, sw, sh), ids };
}

function hsl(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r + m, g + m, b + m].map((v) => Math.round(v * 255));
}

process.exit(failures > 0 ? 1 : 0);
