/**
 * The edge checks: every part laid along every edge it can go on, checked
 * once per edge rather than once per outfit — see `src/lib/garments/edges.ts`.
 *
 * Fourteen cuts, forty-six sleeves and sixty skirts are over thirty-eight
 * thousand dresses before a button or a stripe; no check can draw them all.
 * Instead, in three layers:
 *
 *   1. **Each edge on its own.** Each kind of edge declares what shapes it
 *      (`EdgeSpec.shapedBy`) and every shape it can take (`every`). Each is
 *      built and held to the edge rules: it lies on its cloth's border, its
 *      cloth is on the side it says, there is cloth enough in from it for
 *      three stripes, a pair mirrors, and a point sits on the centre line.
 *   2. **Each part on every edge.** Stripes, in every count, on every edge:
 *      each stripe there, the whole way along, on its cloth, nearest first.
 *      The tie at the point it is knotted at.
 *   3. **What the first two cannot see.** Whole outfits, drawn at random from
 *      what the panel offers, and a set chosen so every pair of options is
 *      worn together at least once: each edge built from the whole outfit must
 *      be the edge built from only what it declared, so nothing undeclared
 *      shapes it — which is what makes checking edges one at a time sound —
 *      and each pair goes through the hole check too.
 */
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (p) => pathToFileURL(join(ROOT, p)).href;
const { STRIPES, ringsOf, insideRings, stripeSides, stripesAlong, guideAt, fittedBands } = await import(src("src/lib/garments/stripes.ts"));
const { mirrorX } = await import(src("src/lib/garments/edges.ts"));

/* --------------------------------------------------------------- tolerances */

/** How far an edge may stray from its cloth's border, in units: 1.5 is 0.3 cm. */
const ON_BORDER = 1.5;
/**
 * And a band's: its stripes follow the sleeve's hem moved down to the band's
 * foot, as a braid follows the hem it is sewn under — and a puff's gathered
 * band curves up to 2.1 units (0.4 cm) off it at the ends. 2.5 is 0.5 cm.
 */
const ON_BAND_FOOT = 2.5;
/**
 * How much of an edge's middle must have cloth three stripes deep in from it.
 * Braid that meets another edge of its cloth is cut there — the square's
 * corner cuts a cap sleeve's third stripe short (88%) — so not all of it:
 * what this catches is an edge with next to no cloth in from it.
 */
const DEEP_SHARE = 0.85;
/** How short of the edge's own length a stripe may run, as a share: braid runs the whole way. */
const STRIPE_SHARE = 0.6;
/** How far a pair's mirrored edge may stray from its twin, in units. */
const MIRRORED = 0.75;
/** How far a point may stray off the centre line, in units. */
const ON_CENTRE = 0.5;
/** Random whole outfits for the hidden-dependency check, and the seed they are drawn from. */
const RANDOM_OUTFITS = 300;
const SEED = 18;

/* ----------------------------------------------------------------- geometry */

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const lengthOf = (pts) => pts.slice(1).reduce((s, p, i) => s + dist(p, pts[i]), 0);
const toSegment = (p, a, b) => {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  return dist(p, [a[0] + t * dx, a[1] + t * dy]);
};
const toPolyline = (p, pts) => pts.slice(1).reduce((m, b, i) => Math.min(m, toSegment(p, pts[i], b)), Infinity);
const toRings = (p, rings) => Math.min(...rings.map((r) => toPolyline(p, [...r, r[0]])));
/** Points every `step` units along a polyline. */
const sample = (pts, step = 2) => {
  const out = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]];
    const l = dist(a, b);
    let t = step - carry;
    while (t <= l) {
      out.push([a[0] + ((b[0] - a[0]) * t) / l, a[1] + ((b[1] - a[1]) * t) / l]);
      t += step;
    }
    carry = l - (t - step);
  }
  return out;
};
/** The middle `share` of a run of points, by index. */
const middle = (pts, share) => {
  const cut = Math.floor((pts.length * (1 - share)) / 2);
  return pts.slice(cut, pts.length - cut);
};
/** Whether a point is on any of a set of pieces. */
const onPieces = (ringsList, p) => ringsList.some((rings) => insideRings(rings, p));
/** The direction an edge lays its cloth-side in, at a point near `p` on it. */
const inward = (edge, p) => {
  if (edge.lay.by === "level") {
    const [x, y] = edge.lay.into;
    const l = Math.hypot(x, y) || 1;
    return [x / l, y / l];
  }
  /* square to the line where it passes `p`, on the side of the point it is laid toward */
  const i = edge.line.reduce((best, q, k) => (dist(q, p) < dist(edge.line[best], p) ? k : best), 0);
  const a = edge.line[Math.max(0, i - 2)];
  const b = edge.line[Math.min(edge.line.length - 1, i + 2)];
  const l = dist(a, b) || 1;
  let n = [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
  const toward = edge.lay.by === "follow" ? edge.lay.toward : null;
  if (toward && n[0] * (toward[0] - p[0]) + n[1] * (toward[1] - p[1]) < 0) n = [-n[0], -n[1]];
  return n;
};
/**
 * The stretch of an edge that lies over its cloth. On a band — an edge with
 * `room` — that is the band's width: a bishop's hem is gathered into a cuff
 * far narrower than itself, and the edge laid along the cuff's foot is that
 * hem, moved down, so only its middle lies on the cuff. Elsewhere, all of it.
 */
function spanOf(edge) {
  if (edge.room === undefined || edge.pieces.length < 2) return { line: edge.line, within: () => true };
  const [a, b] = [edge.line[0], edge.line[edge.line.length - 1]];
  const l = dist(a, b) || 1;
  const u = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  const along = (p) => (p[0] - a[0]) * u[0] + (p[1] - a[1]) * u[1];
  const band = ringsOf(edge.pieces[edge.pieces.length - 1].d).flat().map(along);
  const [lo, hi] = [Math.min(...band) - 0.5, Math.max(...band) + 0.5];
  const within = (p) => along(p) >= lo && along(p) <= hi;
  const line = edge.line.filter(within);
  return line.length > 1 ? { line, within } : { line: edge.line, within: () => true };
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const lineSame = (a, b) => a.length === b.length && a.every((p, i) => Math.abs(p[0] - b[i][0]) < 1e-6 && Math.abs(p[1] - b[i][1]) < 1e-6);
const layOf = (edge) => (edge.lay.by === "own" ? { by: "own" } : edge.lay);
const label = (edge, key) => `${edge.kind}${edge.side !== undefined ? ` ${edge.side ? "right" : "left"}` : ""} · ${JSON.stringify(key)}`;

/* ------------------------------------------------------------- the rules */

/**
 * Layer 1: an edge held to the edge rules, alone. Returns what is wrong with it.
 * `twin`, for one of a pair, is the other.
 */
function edgeProblems(edge, { twin, axis, axisTolerance = MIRRORED } = {}) {
  const problems = [];
  const ringsList = edge.pieces.map((p) => ringsOf(p.d));
  if (edge.pieces.length === 0) return ["lies on no cloth"];
  if (edge.line.length < 2) return ["has no length"];

  /* on its cloth's border, where it lies over its cloth */
  const span = spanOf(edge);
  const worst = Math.max(...middle(sample(span.line), 0.9).map((p) => Math.min(...ringsList.map((r) => toRings(p, r)))));
  const allowed = edge.room === undefined ? ON_BORDER : ON_BAND_FOOT;
  if (worst > allowed) problems.push(`strays ${worst.toFixed(1)} units off its cloth's border (≤ ${allowed})`);

  /* its cloth on the side it says: just in from its middle is cloth, just out is none of its own */
  const mid = span.line[Math.floor(span.line.length / 2)];
  const n = inward(edge, mid);
  const inside = edge.lay.by === "own" ? edge.lay.inFrom(2).length > 1 : onPieces(ringsList, [mid[0] + n[0] * 2, mid[1] + n[1] * 2]);
  const outside = edge.lay.by !== "own" && onPieces(ringsList, [mid[0] - n[0] * 2, mid[1] - n[1] * 2]);
  if (!inside) problems.push("has no cloth on the side it lays onto");
  if (outside) problems.push("has its own cloth on the side away from it too — it is not an edge of it");

  /* cloth enough in from it for three stripes, fitted to its room */
  const three = fittedBands(edge, STRIPES.three);
  const deep = three[three.length - 1][1];
  const guide = guideAt(edge, deep).pts;
  const share =
    edge.lay.by === "own"
      ? lengthOf(guide) / lengthOf(edge.line)
      : (() => {
          /* the guide's points over the edge itself, not the run on past its ends */
          const ends = edge.lay.by === "level" ? [24, 24] : edge.lay.ends.map((e) => Math.ceil(e));
          const over = middle(guide.slice(ends[0], guide.length - ends[1]).filter(span.within), 0.6);
          return over.filter((p) => onPieces(ringsList, p)).length / over.length;
        })();
  if (!(share >= (edge.lay.by === "own" ? STRIPE_SHARE : DEEP_SHARE))) {
    problems.push(`has cloth three stripes (${deep.toFixed(1)} units) deep along only ${Math.round(share * 100)}% of it`);
  }

  /* a pair mirrors; an edge across the middle is its own mirror */
  if (twin) {
    const far = Math.max(...sample(mirrorX(edge.line, 300)).map((p) => toPolyline(p, twin.line)));
    if (far > axisTolerance) problems.push(`is ${far.toFixed(1)} units off its twin's mirror image (≤ ${axisTolerance.toFixed(2)})`);
  } else if (axis !== undefined) {
    const far = Math.max(...sample(mirrorX(edge.line, axis)).map((p) => toPolyline(p, edge.line)));
    if (far > axisTolerance) problems.push(`is ${far.toFixed(1)} units off its own mirror image about x ${axis} (≤ ${axisTolerance.toFixed(2)})`);
  }
  return problems;
}

/**
 * Layer 2: stripes, in every count, on an edge: each one there, along at
 * least `STRIPE_SHARE` of it, on its cloth, and each further in than the one
 * before.
 */
function stripeProblems(edge) {
  const problems = [];
  const along = lengthOf(spanOf(edge).line);
  for (const count of ["one", "two", "three"]) {
    const bands = STRIPES[count];
    const sides = stripeSides(edge, bands);
    const depth = [];
    for (let i = 0; i < bands.length; i++) {
      const mine = sides.filter((s) => s.stripe === i);
      const run = mine.reduce((s, m) => s + lengthOf(m.near), 0);
      if (mine.length === 0) problems.push(`${count}: stripe ${i + 1} is not there`);
      else if (run < STRIPE_SHARE * along) problems.push(`${count}: stripe ${i + 1} runs ${Math.round((run / along) * 100)}% of the edge`);
      for (const m of mine) {
        /* a point inside the stripe: between its two sides at the middle — a curved stripe's centroid can lie off it */
        const piece = edge.pieces.find((p) => p.index === m.piece);
        const a = m.near[Math.floor(m.near.length / 2)];
        const b = m.far.reduce((best, q) => (dist(q, a) < dist(best, a) ? q : best), m.far[0]);
        const c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        if (!piece || !insideRings(ringsOf(piece.d), c)) problems.push(`${count}: stripe ${i + 1} is off its cloth`);
      }
      /* how far in it lies: its near side's middle from the edge */
      const near = mine[0]?.near;
      if (near) depth.push(toPolyline(near[Math.floor(near.length / 2)], edge.line));
    }
    for (let i = 1; i < depth.length; i++) {
      if (!(depth[i] > depth[i - 1])) problems.push(`${count}: stripe ${i + 1} is no further in than stripe ${i}`);
    }
  }
  return problems;
}

/* --------------------------------------------------------- whole outfits */

/** A seeded random number in [0, 1) — the same outfits every run. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pickOf = (rand) => (list) => list[Math.floor(rand() * list.length)];

/**
 * A whole dress the panel could make, at random: a cut, a sleeve it offers
 * on that cut, a cuff where one is offered, a skirt, buttons the cut and
 * shape take, and a collar opening the cut presents — the panel's own rules,
 * from the same tables.
 */
function randomDress(pick, world) {
  const { cuts, sleevesOn, cuffsOn, skirt, buttonsOn, openingsOn } = world;
  const cut = pick(cuts);
  const types = sleevesOn(cut);
  const type = types.length ? pick(types) : null;
  const sleeve = type ? { type, length: pick(world.lengthsOf(type, cut)) } : undefined;
  const cuffs = sleeve ? cuffsOn(sleeve) : [];
  if (sleeve && cuffs.length) {
    const cuff = pick(cuffs);
    if (cuff !== "none") sleeve.cuff = cuff;
  }
  const shape = pick(skirt.shapes);
  const choice = {
    neckline: cut,
    ...(sleeve ? { sleeve } : {}),
    skirt: { shape, length: pick(skirt.lengthsOf(shape)), waist: pick(skirt.waists) },
  };
  const buttons = pick(buttonsOn(cut, shape));
  if (buttons !== "none") choice.buttons = buttons;
  const opening = pick([null, ...openingsOn(cut)]);
  if (opening) choice.opening = opening;
  return choice;
}

/** The options a dress is made of, as named values — what "every pair" pairs up. */
const axesOf = (c) => ({
  cut: c.neckline,
  type: c.sleeve?.type ?? "-",
  length: c.sleeve?.length ?? "-",
  cuff: c.sleeve?.cuff ?? "-",
  shape: c.skirt.shape,
  skirtLength: c.skirt.length,
  waist: c.skirt.waist,
  buttons: c.buttons ?? "none",
  opening: c.opening ?? "none",
});
const pairsOf = (c) => {
  const a = Object.entries(axesOf(c)).map(([k, v]) => `${k}=${v}`);
  const out = [];
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) out.push(`${a[i]}|${a[j]}`);
  return out;
};

/**
 * A few hundred whole dresses in which every pair of options the panel can
 * put together is worn at least once: drawn from many random ones, each next
 * the one that wears the most pairs not yet worn.
 */
function everyPair(pick, world, pool = 4000) {
  const candidates = Array.from({ length: pool }, () => randomDress(pick, world));
  const wanted = new Set(candidates.flatMap(pairsOf));
  const chosen = [];
  const left = new Set(wanted);
  while (left.size > 0) {
    let best = null;
    let gain = 0;
    for (const c of candidates) {
      const g = pairsOf(c).filter((p) => left.has(p)).length;
      if (g > gain) [best, gain] = [c, g];
    }
    if (!best) break;
    chosen.push(best);
    for (const p of pairsOf(best)) left.delete(p);
  }
  return { chosen, pairs: wanted.size };
}

/**
 * Whether the edges a whole choice gives are those its declarations give —
 * see `EdgeSpec`. Compared as drawn: the line, how it is laid, its room, and
 * the three stripes laid along it. Returns what differs.
 */
function undeclared(mod, choice, everyKey) {
  const problems = [];
  const full = mod.dressEdges(choice);
  for (const spec of mod.DRESS_EDGE_SPECS) {
    const key = spec.shapedBy(choice);
    const mine = full.filter((e) => e.kind === spec.kind);
    const declared = mod.dressEdges(spec.choiceFor(key)).filter((e) => e.kind === spec.kind);
    const where = `${spec.kind} of ${JSON.stringify(axesOf(choice))}`;
    if (mine.length !== declared.length) {
      problems.push(`${where}: ${mine.length} edges, but ${declared.length} from what it declares ${JSON.stringify(key)}`);
      continue;
    }
    if (mine.length && !everyKey.get(spec.kind).has(JSON.stringify(key))) {
      problems.push(`${where}: shaped as ${JSON.stringify(key)}, which its \`every\` does not list — layer 1 never checks it`);
    }
    mine.forEach((e, i) => {
      const d = declared[i];
      const what = [];
      if (e.side !== d.side) what.push("side");
      if (!lineSame(e.line, d.line)) what.push("line");
      if (!same(layOf(e), layOf(d))) what.push("lay");
      if (e.room !== d.room) what.push("room");
      const cloth = same(e.pieces.map((p) => p.d), d.pieces.map((p) => p.d));
      if (!cloth && !same(stripesAlong(e, STRIPES.three).map((s) => s.d), stripesAlong(d, STRIPES.three).map((s) => s.d))) what.push("stripes");
      if (what.length) problems.push(`${where}: its ${what.join(", ")} differ from those of ${JSON.stringify(key)} — something undeclared shapes it`);
    });
  }
  /* and its points */
  const key = mod.DRESS_POINT_SPEC.shapedBy(choice);
  if (!same(mod.dressPoints(choice), mod.dressPoints(mod.DRESS_POINT_SPEC.choiceFor(key)))) {
    problems.push(`points of ${JSON.stringify(axesOf(choice))} differ from those of ${JSON.stringify(key)}`);
  }
  return problems;
}

/* ---------------------------------------------------------------- the run */

/**
 * Every edge check on one garment cut in `mod` (its `dressEdges`), with the
 * sailor collar's edges from `collarMod`. `world` is what the panel offers,
 * `holes(choice)` the hole check for a whole outfit. Prints a line per layer
 * and every problem; returns how many failed.
 */
export function checkEdges({ garment, mod, collarMod, offer, world, holes, log = console.log }) {
  let failed = 0;
  let clock = Date.now();
  const lap = () => { const t = Date.now() - clock; clock = Date.now(); return ` [${(t / 1000).toFixed(1)}s]`; };
  const report = (tag, line, problems) => {
    failed += problems.length ? 1 : 0;
    log(`${problems.length ? "FAIL" : "ok  "} female ${garment.id.padEnd(16)} ${line}${process.env.EDGE_TIMES ? lap() : ""}`);
    const shown = process.env.EDGE_ALL ? problems : problems.slice(0, 12);
    for (const p of shown) log(`       ${p}`);
    if (problems.length > shown.length) log(`       … and ${problems.length - shown.length} more`);
  };

  /* layer 1 and 2: every edge each spec lists, and the collar's */
  const everyKey = new Map();
  const edges = [];
  for (const spec of mod.DRESS_EDGE_SPECS) {
    const keys = spec.every(offer);
    everyKey.set(spec.kind, new Set(keys.map((k) => JSON.stringify(k))));
    for (const key of keys) {
      const choice = spec.choiceFor(key);
      const mine = mod.dressEdges(choice).filter((e) => e.kind === spec.kind);
      const axis = spec.kind === "hem" ? 300 : spec.kind === "neckline" ? 300 : undefined;
      /*
        Cut about her throat, three units left of her shoulders' centre — a
        neckline, and a skirt's flat panel under its placket — it is that much
        off a mirror about the shoulders'.
      */
      const throat = spec.kind === "neckline" || (spec.kind === "hem" && key.toHem);
      const axisTolerance = throat ? Math.abs(300 - mod.NECK_CENTRE) + MIRRORED : MIRRORED;
      for (const e of mine) edges.push({ edge: e, key, twin: mine.find((t) => t !== e && t.side !== undefined && e.side === 0), axis, axisTolerance });
    }
  }
  /* the sailor collar's panels are each cut from their own side, about her throat: that much off a mirror */
  const collar = collarMod.sailorEdges();
  for (const e of collar) edges.push({ edge: e, key: "sailor collar", twin: e.side === 0 ? collar[1] : undefined, axis: undefined, axisTolerance: Math.abs(300 - mod.NECK_CENTRE) + MIRRORED });

  const kinds = {};
  const edgeIssues = [];
  const stripeIssues = [];
  /* an edge the same as one already checked — a sleeve's at a waist it does not hang beside — is not checked twice */
  const seen = new Set();
  let distinct = 0;
  for (const { edge, key, twin, axis, axisTolerance } of edges) {
    kinds[edge.kind] = (kinds[edge.kind] ?? 0) + 1;
    const sig = JSON.stringify([edge.kind, edge.side, edge.line, layOf(edge), edge.room, edge.pieces.map((p) => p.d), twin?.line, axisTolerance]);
    if (seen.has(sig)) continue;
    seen.add(sig);
    distinct++;
    for (const p of edgeProblems(edge, { twin, axis, axisTolerance })) edgeIssues.push(`${label(edge, key)}: ${p}`);
    for (const p of stripeProblems(edge)) stripeIssues.push(`${label(edge, key)}: ${p}`);
  }
  const counted = Object.entries(kinds).map(([k, n]) => `${n} ${k}`).join(", ");
  report("edges", `edges: ${edges.length} (${counted}), ${distinct} different, each on its cloth's border, cloth on its side, three stripes deep, mirrored`, edgeIssues);
  report("stripes", `stripes: one, two and three on all ${distinct} different edges, each the whole way along, on its cloth, in order`, stripeIssues);

  /* the points, and the tie at the V's */
  const pointIssues = [];
  let points = 0;
  for (const key of mod.DRESS_POINT_SPEC.every()) {
    const choice = mod.DRESS_POINT_SPEC.choiceFor(key);
    const b = mod.drawnBodice(choice);
    const outline = ringsOf(b.pieces[0]);
    /* the opening's own centre line: midway between its two corners — a boat's lies between her throat's and her shoulders' */
    const parts = b.cut.parts;
    const centre = parts ? (parts.neck[0] + parts.neckRight[0]) / 2 : mod.NECK_CENTRE;
    for (const pt of mod.dressPoints(choice)) {
      points++;
      if (Math.abs(pt.at[0] - centre) > ON_CENTRE) pointIssues.push(`${key.cut} ${pt.kind}: ${Math.abs(pt.at[0] - centre).toFixed(2)} units off its opening's centre line`);
      if (toRings(pt.at, outline) > ON_BORDER) pointIssues.push(`${key.cut} ${pt.kind}: ${toRings(pt.at, outline).toFixed(1)} units off the neckline`);
    }
  }
  const vPoint = mod.dressPoints({ neckline: "v" }).find((p) => p.kind === "neck");
  if (!vPoint || !same(collarMod.TIE_AT, vPoint.at)) pointIssues.push("the sailor collar's tie is not knotted at the V's neck point");
  for (const kind of ["knot", "necktie"]) {
    const { parts } = collarMod.sailorTie(kind);
    const knot = ringsOf(parts.knot).flat();
    const xs = knot.map(([x]) => x);
    if (Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - collarMod.TIE_AT[0]) > ON_CENTRE) pointIssues.push(`the ${kind}'s knot is off its point`);
  }
  report("points", `points: ${points} neck points on the centre line and the neckline; the tie at the V's`, pointIssues);

  /* layer 3: whole outfits — random ones, then every pair */
  const pick = pickOf(rng(SEED));
  const random = Array.from({ length: RANDOM_OUTFITS }, () => randomDress(pick, world));
  const { chosen, pairs } = everyPair(pick, world);
  const depIssues = [...random, ...chosen].flatMap((c) => undeclared(mod, c, everyKey));
  report("declared", `declared: ${random.length} random dresses and ${chosen.length} wearing every pair of ${pairs} — every edge only what it declares`, depIssues);
  const holeIssues = chosen.flatMap((c) => {
    const { n, at } = holes(c);
    return n > 0 ? [`${JSON.stringify(axesOf(c))}: ${n} px uncovered at x ${at.x0}–${at.x1}, y ${at.y0}–${at.y1}`] : [];
  });
  report("pairs", `pairs: ${chosen.length} dresses, every pair of options together, drawn without a hole`, holeIssues);
  return failed;
}
