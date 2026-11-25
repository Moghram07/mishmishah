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
const { tieAt } = await import(src("src/lib/garments/art/female/ties.ts"));

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
  /* to the side it keeps as it runs, or toward the point it is laid toward */
  if (edge.lay.by === "follow" && edge.lay.side !== undefined) return [n[0] * edge.lay.side, n[1] * edge.lay.side];
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
/** How far apart rows may lie and still be the same rows: 0.5 units, a tenth of a centimetre. */
const SAME_ROWS = 0.5;
/** The farthest any point of one set of rows lies from the matching row of the other — infinite if they differ in number. */
function rowsApart(a, b) {
  if (a.length !== b.length) return Infinity;
  let m = 0;
  a.forEach((row, i) => {
    const [p, q] = [ringsOf(row.d)[0] ?? [], ringsOf(b[i].d)[0] ?? []];
    for (const x of p) m = Math.max(m, toPolyline(x, [...q, q[0]]));
    for (const x of q) m = Math.max(m, toPolyline(x, [...p, p[0]]));
  });
  return m;
}
const lineSame = (a, b) => a.length === b.length && a.every((p, i) => Math.abs(p[0] - b[i][0]) < 1e-6 && Math.abs(p[1] - b[i][1]) < 1e-6);
const layOf = (edge) => (edge.lay.by === "own" ? { by: "own" } : edge.lay);
const label = (edge, key) => `${edge.kind}${edge.side !== undefined ? ` ${edge.side ? "right" : "left"}` : ""} · ${JSON.stringify(key)}`;

/* ------------------------------------------------------------- the rules */

/**
 * Layer 1: an edge held to the edge rules, alone. Returns what is wrong with it.
 * `twin`, for one of a pair, is the other.
 */
function edgeProblems(edge, { twin, axis, axisTolerance = MIRRORED, borderTo } = {}) {
  const problems = [];
  const ringsList = edge.pieces.map((p) => ringsOf(p.d));
  if (edge.pieces.length === 0) return ["lies on no cloth"];
  if (edge.line.length < 2) return ["has no length"];

  /* on its cloth's border, where it lies over its cloth */
  const span = spanOf(edge);
  /* a wrap's top panel's edge only down to where the panels cross: past it, it lies over the under panel, inside the bodice */
  const onBorder = middle(sample(span.line), 0.9).filter((p) => !borderTo || p[1] <= borderTo[1] + 0.5);
  const worst = Math.max(...onBorder.map((p) => Math.min(...ringsList.map((r) => toRings(p, r)))));
  const allowed = edge.room === undefined ? ON_BORDER : ON_BAND_FOOT;
  if (worst > allowed) problems.push(`strays ${worst.toFixed(1)} units off its cloth's border (≤ ${allowed})`);

  /* its cloth on the side it says: just in from its middle is cloth, just out is none of its own */
  const tried = [0.3, 0.5, 0.7].map((f) => {
    const p = span.line[Math.floor((span.line.length - 1) * f)];
    const n = inward(edge, p);
    return {
      inside: edge.lay.by === "own" ? edge.lay.inFrom(2).length > 1 : onPieces(ringsList, [p[0] + n[0] * 2, p[1] + n[1] * 2]),
      outside: edge.lay.by !== "own" && onPieces(ringsList, [p[0] - n[0] * 2, p[1] - n[1] * 2]),
    };
  });
  if (tried.filter((t) => t.inside).length < 2) problems.push("has no cloth on the side it lays onto");
  if (tried.filter((t) => t.outside).length >= 2) problems.push("has its own cloth on the side away from it too — it is not an edge of it");

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
  const { cuts, sleevesOn, cuffsOn, skirt, buttonsOn, openingsOn, beltsOn } = world;
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
  /* to the waist, on a cut that takes them, two rows or one */
  if (buttons === "waist" && world.doubleCuts.includes(cut) && pick([true, false])) choice.buttonRows = "two";
  /* a belt the cut takes: none, in cloth, leather, or a sash — tied at the front or her side; a wrap's at its side */
  const belt = pick(beltsOn(cut));
  if (belt && belt !== "none") choice.belt = belt;
  if (world.isSash(belt)) choice.bowAt = pick(world.bowPlacesOn(cut));
  const opening = pick([null, ...openingsOn(cut)]);
  if (opening) choice.opening = opening;
  /* stripes along some of its edges: two edges that meet share the cloth between them when both are striped */
  const on = ["neckline", "sleeves", "hem", "belt"].filter(() => pick([true, false]));
  if (on.length) choice.stripes = { count: "three", on };
  /* a tie, where it has a place for one */
  const style = pick(["none", ...world.tieStyles]);
  const places = style === "none" ? [] : world.tiePlacesOn(cut, opening, choice.belt, style);
  if (places.length) {
    choice.tie = style;
    choice.tieAt = pick(places);
  }
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
  buttons: c.buttons ? `${c.buttons}${c.buttonRows === "two" ? "×2" : ""}` : "none",
  opening: c.opening ?? "none",
  belt: c.belt ? `${c.belt}${c.bowAt ? `@${c.bowAt}` : ""}` : "none",
  stripes: c.stripes ? c.stripes.on.join("+") : "none",
  tie: c.tie ? `${c.tie}@${c.tieAt}` : "none",
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
      if (!cloth) {
        const gap = rowsApart(stripesAlong(e, STRIPES.three), stripesAlong(d, STRIPES.three));
        if (gap > SAME_ROWS) what.push(`stripes (${Number.isFinite(gap) ? `${gap.toFixed(2)} units apart` : "a different number of rows"})`);
      }
      if (what.length) problems.push(`${where}: its ${what.join(", ")} differ from those of ${JSON.stringify(key)} — something undeclared shapes it`);
    });
  }
  /* and its points: its neck's, from its cut; its belt's, from its belt and skirt */
  const all = mod.dressPoints(choice);
  for (const [spec, mine] of [
    [mod.DRESS_POINT_SPEC, (p) => p.kind === "neck"],
    [mod.BELT_POINT_SPEC, (p) => p.kind !== "neck"],
  ]) {
    const key = spec.shapedBy(choice);
    const declared = mod.dressPoints(spec.choiceFor(key)).filter(mine);
    if (!same(all.filter(mine), declared)) problems.push(`points of ${JSON.stringify(axesOf(choice))} differ from those of ${JSON.stringify(key)}`);
  }
  /* and its sash, as tied: from which sash, where, and the skirt — a wrap's the same as any dress's at its side */
  const sashKey = mod.SASH_SPEC.shapedBy(choice);
  if (!same(mod.sashFor(choice), mod.sashFor(mod.SASH_SPEC.choiceFor(sashKey)))) problems.push(`the sash of ${JSON.stringify(axesOf(choice))} differs from that of ${JSON.stringify(sashKey)}`);
  if (sashKey.sash && !everyKey.get("sash").has(JSON.stringify(sashKey))) problems.push(`the sash of ${JSON.stringify(axesOf(choice))} is ${JSON.stringify(sashKey)}, which \`every\` does not list`);
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
  everyKey.set("sash", new Set(mod.SASH_SPEC.every(offer).map((k) => JSON.stringify(k))));
  const edges = [];
  for (const spec of mod.DRESS_EDGE_SPECS) {
    const keys = spec.every(offer);
    everyKey.set(spec.kind, new Set(keys.map((k) => JSON.stringify(k))));
    for (const key of keys) {
      const choice = spec.choiceFor(key);
      const mine = mod.dressEdges(choice).filter((e) => e.kind === spec.kind);
      const lopsided = spec.kind === "neckline" && (world.lopsided.includes(key.cut) || Boolean(mod.bodiceFor(key.cut).cut.wrap));
      const axis = spec.kind === "hem" || spec.kind === "belt" ? 300 : spec.kind === "neckline" && !lopsided ? 300 : undefined;
      /*
        Cut about her throat, three units left of her shoulders' centre — a
        neckline, and a skirt's flat panel under its placket — it is that much
        off a mirror about the shoulders'.
      */
      const throat = spec.kind === "neckline" || (spec.kind === "hem" && key.toHem);
      /* mirrored about her shoulders' centre, a line cut about her throat lands twice the throat's offset away */
      const axisTolerance = throat ? 2 * Math.abs(300 - mod.NECK_CENTRE) + MIRRORED : MIRRORED;
      /* one of a pair is held to its twin; an edge across the middle, to its own mirror image */
      /*
        a wrap's two are each panel's own, as the sailor collar's down a wrap
        are below: the top panel's on past the crossing to its waist, the
        under panel's only to the crossing — held to neither's mirror image,
        and the top one to its border only down to the crossing
      */
      /* the wrap as drawn for this choice: with a collar on it the collar's cut, without one bare — see `CutSpec.bare` */
      const wrap = spec.kind === "neckline" ? mod.bodiceFor(key.cut, undefined, key.waist ?? "natural", "none", Boolean(key.collared), false, !key.collared).cut.wrap : undefined;
      for (const e of mine)
        edges.push(
          wrap
            ? { edge: e, key, borderTo: e.side === 0 ? wrap.apex : undefined, axisTolerance }
            : { edge: e, key, twin: mine.find((t) => t !== e && t.side !== undefined && e.side === 0), axis: e.side === undefined ? axis : undefined, axisTolerance }
        );
    }
  }
  /*
    The sailor collar on every cut it follows. Cut about her throat, each
    piece from its own side: that much off a mirror. On the V its panels are
    held to each other; round a boat, a round neck or a square, its one edge
    to its own mirror image; down a wrap, whose top band crosses over the
    other's end, to neither — at every waist, since the wrap's edge runs to it.
  */
  const throatTolerance = 2 * Math.abs(300 - mod.NECK_CENTRE) + MIRRORED;
  for (const cut of collarMod.SAILOR_CUTS) {
    /* cut to the bodice as drawn: with every sleeve the cut takes, since a cap or a dropped shoulder opens a neck wider — the same edge is checked once */
    const sleeves = cut === "v" ? [undefined] : [undefined, { type: "set-in", length: "sleeveless" }, ...world.sleevesOn(cut).map((type) => ({ type, length: world.lengthsOf(type, cut).find((l) => l !== "sleeveless") }))];
    for (const waist of cut === "wrap" ? offer.skirt.waists : ["natural"]) for (const sleeve of sleeves) {
      const collar = collarMod.sailorEdges(cut, waist, sleeve);
      const key = `sailor collar · ${cut}${cut === "wrap" ? ` · ${waist}` : ""}${sleeve ? ` · ${sleeve.type} ${sleeve.length}` : ""}`;
      for (const e of collar)
        edges.push({
          edge: e,
          key,
          twin: cut === "v" && e.side === 0 ? collar[1] : undefined,
          axis: e.side === undefined ? 300 : undefined,
          axisTolerance: throatTolerance,
        });
    }
  }

  const kinds = {};
  const edgeIssues = [];
  const stripeIssues = [];
  /* an edge the same as one already checked — a sleeve's at a waist it does not hang beside — is not checked twice */
  const seen = new Set();
  let distinct = 0;
  for (const { edge, key, twin, axis, axisTolerance, borderTo } of edges) {
    kinds[edge.kind] = (kinds[edge.kind] ?? 0) + 1;
    const sig = JSON.stringify([edge.kind, edge.side, edge.line, layOf(edge), edge.room, edge.pieces.map((p) => p.d), twin?.line, axisTolerance, borderTo]);
    if (seen.has(sig)) continue;
    seen.add(sig);
    distinct++;
    for (const p of edgeProblems(edge, { twin, axis, axisTolerance, borderTo })) edgeIssues.push(`${label(edge, key)}: ${p}`);
    for (const p of stripeProblems(edge)) stripeIssues.push(`${label(edge, key)}: ${p}`);
  }
  const counted = Object.entries(kinds).map(([k, n]) => `${n} ${k}`).join(", ");
  report("edges", `edges: ${edges.length} (${counted}), ${distinct} different, each on its cloth's border, cloth on its side, three stripes deep, mirrored`, edgeIssues);
  report("stripes", `stripes: one, two and three on all ${distinct} different edges, each the whole way along, on its cloth, in order`, stripeIssues);

  /*
    Where two striped edges meet or run close — a cap sleeve and the neckline,
    on every cut that keeps both sleeves — no row of one lies over a row of the
    other: they meet in a mitre, and share the cloth between them.
  */
  const touchIssues = [];
  let touched = 0;
  for (const cut of world.cuts.filter((c) => world.sleevesOn(c).includes("cap"))) {
    for (const count of ["one", "two", "three"]) {
      const choice = { neckline: cut, sleeve: { type: "cap", length: "short" }, stripes: { count, on: ["neckline", "sleeves"] } };
      const edges = mod.dressEdges(choice).filter((x) => x.kind === "neckline" || x.kind === "sleeve");
      const laid = edges.map((x) => stripeSides(x, STRIPES[count]));
      for (let a = 0; a < edges.length; a++) {
        for (let b = 0; b < edges.length; b++) {
          if (a === b) continue;
          touched++;
          const rows = laid[b].map((x) => [...x.near, ...[...x.far].reverse()]);
          let over = 0;
          for (const row of laid[a]) {
            /* along the middle of each row of one, inside any row of the other */
            const n = Math.min(row.near.length, row.far.length);
            for (let k = 1; k < n - 1; k += 2) {
              const p = [(row.near[k][0] + row.far[Math.round((k * (row.far.length - 1)) / (row.near.length - 1))][0]) / 2, (row.near[k][1] + row.far[Math.round((k * (row.far.length - 1)) / (row.near.length - 1))][1]) / 2];
              if (rows.some((r) => insideRings([r], p))) over++;
            }
          }
          if (over > 2) touchIssues.push(`${cut} with a cap, ${count}: ${over} points of the ${edges[a].kind}'s rows lie on the ${edges[b].kind}'s`);
        }
      }
    }
  }
  report("touch", `touch: ${touched} pairs of rows along edges that meet — a cap and the neckline, on each cut — never lie over each other`, touchIssues);

  /*
    The points, and every tie at each. A neck point lies on its neckline, on
    the opening's own centre line: halfway between the opening's two edges
    just above it — a wrap's are mirrored about a line that leans. A belt's
    front lies at the buckle's place, its side inside the belt near her left
    end, both on the belt's middle row. Every tie the dress offers, at every
    place it can be knotted there, is centred on its point, over it, hangs
    down from it, and stays on the canvas.
  */
  const pointIssues = [];
  let points = 0;
  let tied = 0;
  const checkTie = (where, style, at, kind = "neck", narrow = false) => {
    tied++;
    const { parts, pieces } = tieAt(style, at, kind, narrow);
    const knot = ringsOf(parts.knot).flat();
    const [kx, ky] = [knot.map(([x]) => x), knot.map(([, y]) => y)];
    if (Math.abs((Math.min(...kx) + Math.max(...kx)) / 2 - at[0]) > ON_CENTRE) pointIssues.push(`${where}: the ${style}'s knot is off its point`);
    if (Math.min(...ky) > at[1] || Math.max(...ky) < at[1]) pointIssues.push(`${where}: the ${style}'s knot is not over its point`);
    const all = pieces.flatMap((d) => ringsOf(d).flat());
    const [ax, ay] = [all.map(([x]) => x), all.map(([, y]) => y)];
    /*
      A knot at the neck and a necktie are mirrored about their point. A
      scarf's two tails are not alike, nor the belt bow's — see `bowAt` — but
      fall one each side of it; the belt bow's loops are mirrored about it.
    */
    const bowed = style === "knot" && kind !== "neck";
    if (style === "scarf" || bowed) {
      if (Math.min(...ax) > at[0] - 15 || Math.max(...ax) < at[0] + 15) pointIssues.push(`${where}: the ${style}'s tails do not fall either side of its point`);
      if (bowed) {
        const lx = parts.loops.flatMap((d) => ringsOf(d).flat()).map(([x]) => x);
        if (Math.abs((Math.min(...lx) + Math.max(...lx)) / 2 - at[0]) > ON_CENTRE) pointIssues.push(`${where}: the bow's loops are not mirrored about its point`);
      }
    } else if (Math.abs((Math.min(...ax) + Math.max(...ax)) / 2 - at[0]) > ON_CENTRE) pointIssues.push(`${where}: the ${style} is not mirrored about its point`);
    if (Math.max(...ay) - at[1] < 20) pointIssues.push(`${where}: the ${style} does not hang down from its point`);
    if (Math.min(...ax) < 0 || Math.max(...ax) > 600 || Math.min(...ay) < 0 || Math.max(...ay) > 1000) pointIssues.push(`${where}: the ${style} runs off the canvas`);
  };
  /* whether a point lies on the dress at a waist: on the bodice, on the band round it, or on the skirt — each its own outline, since they overlap at the seam */
  const dressRings = (skirt, band) => {
    const body = ringsOf(mod.bodiceFor("round", undefined, skirt.waist).pieces[0]);
    const sk = ringsOf(mod.skirtFor(undefined, skirt).path);
    return (q) => insideRings(body, q) || insideRings(band, q) || insideRings(sk, q);
  };
  /* the opening's own middle at a row just above a point: halfway between the two edges either side of it */
  const middleAt = (outline, at, top) => {
    const y = at[1] - Math.max(1, Math.min(6, (at[1] - (top ?? at[1] - 12)) / 2));
    const xs = outline.flatMap((ring) => ring.flatMap((a, i) => {
      const b = ring[(i + 1) % ring.length];
      return (a[1] - y) * (b[1] - y) < 0 ? [a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1])] : [];
    })).sort((a, b) => a - b);
    const right = xs.findIndex((x) => x > at[0]);
    return right > 0 ? (xs[right - 1] + xs[right]) / 2 : NaN;
  };
  for (const key of mod.DRESS_POINT_SPEC.every(offer)) {
    const choice = mod.DRESS_POINT_SPEC.choiceFor(key);
    const b = mod.drawnBodice(choice);
    const outline = ringsOf(b.pieces[0]);
    const where = `${key.cut}${key.waist ? ` · ${key.waist}` : ""}`;
    for (const pt of mod.dressPoints(choice)) {
      points++;
      const off = Math.abs(pt.at[0] - middleAt(outline, pt.at, b.cut.parts?.neck[1]));
      if (!(off <= ON_CENTRE)) pointIssues.push(`${where} ${pt.kind}: ${off.toFixed(2)} units off its opening's centre line`);
      if (toRings(pt.at, outline) > ON_BORDER) pointIssues.push(`${where} ${pt.kind}: ${toRings(pt.at, outline).toFixed(1)} units off the neckline`);
      for (const style of world.tieStyles) checkTie(`${where} ${pt.kind}`, style, pt.at);
    }
  }
  for (const key of mod.BELT_POINT_SPEC.every(offer)) {
    const choice = mod.BELT_POINT_SPEC.choiceFor(key);
    const belt = mod.beltFor(choice.skirt);
    const ring = ringsOf(belt.path);
    const where = `belt · ${key.skirt.shape} ${key.skirt.length} ${key.skirt.waist}`;
    const belted = mod.dressPoints(choice).filter((p) => p.kind !== "neck");
    if (belted.length !== 2) pointIssues.push(`${where}: ${belted.length} points on the belt, not its front and its side`);
    for (const pt of belted) {
      points++;
      if (!insideRings(ring, pt.at)) pointIssues.push(`${where} ${pt.kind}: off the belt`);
      if (Math.abs(pt.at[1] - belt.mid) > 0.01) pointIssues.push(`${where} ${pt.kind}: not on the belt's middle row`);
      if (pt.kind === "belt-front" && Math.abs(pt.at[0] - belt.buckle.x) > ON_CENTRE) pointIssues.push(`${where}: its front is not where its buckle is`);
      if (pt.kind === "belt-side") {
        /* the belt's end at her left, on that row: from its own outline */
        const ends = ring.flat().filter(([, y]) => Math.abs(y - belt.mid) < 1.5).map(([x]) => x);
        const end = Math.max(...ends);
        if (end - pt.at[0] < 8 || pt.at[0] - belt.buckle.x < 20) pointIssues.push(`${where}: its side point is ${(end - pt.at[0]).toFixed(1)} units in from the belt's end, ${(pt.at[0] - belt.buckle.x).toFixed(1)} from its front`);
      }
      /*
        Every tie knotted there, sized for the belt — the bow's tails spread
        wider at the front of a full skirt than a narrow one — lies on the
        dress, the bodice, the belt or the skirt below it, and off both her
        arms, which are drawn again over the clothes: at the front its tails
        spread toward her hands.
      */
      const narrow = mod.narrowSkirt(choice.skirt);
      const onDress = dressRings(choice.skirt, ring);
      for (const style of world.tieStyles.filter((s) => s !== "necktie")) {
        const off = tieAt(style, pt.at, pt.kind, narrow).pieces.flatMap((d) => ringsOf(d).flat()).filter((q) => !onDress(q) || insideRings(world.armRings, q));
        if (off.length) pointIssues.push(`${where}: the ${style} at its ${pt.kind === "belt-side" ? "side" : "front"} runs off the dress or onto her arm at ${off[0].map((v) => v.toFixed(1)).join(",")} (${off.length} points)`);
      }
      for (const style of world.tieStyles.filter((s) => s !== "necktie")) checkTie(`${where} ${pt.kind}`, style, pt.at, pt.kind, narrow);
    }
  }
  /* a tie on a belt is sized for it: the knot is the belt bow, the scarf a sash's cloth; at the neck both are as they were */
  const neckBow = tieAt("knot", [300, 300]).pieces.flatMap((d) => ringsOf(d).flat()).map(([x]) => x);
  const beltBow = tieAt("knot", [300, 300], "belt-front").pieces.flatMap((d) => ringsOf(d).flat()).map(([x]) => x);
  if (Math.max(...beltBow) - Math.min(...beltBow) < 2 * (Math.max(...neckBow) - Math.min(...neckBow))) pointIssues.push("the knot on a belt is not the belt bow: no wider than the knot at the neck");
  report("points", `points: ${points} — necks and belts — each on its neckline's centre line or its belt; ${tied} ties, every style at every place, sized for it, centred, hanging down`, pointIssues);

  /*
    The sashes: a sash and a ribbon, tied at the front and at her side, over
    every skirt — and the wrap's, which is the sash at its side. Each band
    its cloth's width where nothing pulls it, centred where a belt is and
    covering the seam, reaching a little past the dress at its ends; its knot
    on its middle row, at the centre front or in from her left end; the
    bow's loops reaching as far as declared, as tall as the cloth and a
    little more, widening and drooping to a dimpled end; its two tails 30
    to 40 cm along them, the longer in front crossing over the other under
    the knot, spreading in an upside-down V as far as declared, twisting
    halfway down, cut on a slant or, a ribbon's, notched in a V; and all of
    it on the dress and off both her arms.
  */
  const sashIssues = [];
  let sashCount = 0;
  const cm = (u) => u * 0.19;
  const box = (paths) => {
    const pts = paths.flatMap((d) => ringsOf(d).flat());
    const xs = pts.map(([x]) => x);
    const ys = pts.map(([, y]) => y);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  };
  /* where a row, or a column, crosses an outline */
  const xsOn = (rings, y) => rings.flatMap((r) => r.flatMap((a, i) => { const b = r[(i + 1) % r.length]; return (a[1] - y) * (b[1] - y) < 0 ? [a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1])] : []; }));
  const ysOn = (rings, x) => rings.flatMap((r) => r.flatMap((a, i) => { const b = r[(i + 1) % r.length]; return (a[0] - x) * (b[0] - x) < 0 ? [a[1] + ((x - a[0]) * (b[1] - a[1])) / (b[0] - a[0])] : []; }));
  const lengthOf = (l) => l.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - l[i][0], p[1] - l[i][1]), 0);
  /* how far from vertical a line runs, in degrees, to the right positive: from its start to `upTo` of the way along */
  const angleOf = (l, upTo = 1) => { const b = l[Math.round(upTo * (l.length - 1))]; return (Math.atan2(b[0] - l[0][0], b[1] - l[0][1]) * 180) / Math.PI; };
  for (const key of mod.SASH_SPEC.every(offer)) {
    const choice = mod.SASH_SPEC.choiceFor(key);
    const sash = mod.sashFor(choice);
    const where = `${key.sash} · ${key.place} · ${key.skirt.shape} ${key.skirt.length} ${key.skirt.waist}`;
    sashCount++;
    if (!sash || sash.kind !== key.sash || sash.place !== key.place) {
      sashIssues.push(`${where}: no such sash tied there`);
      continue;
    }
    const belt = mod.beltFor(choice.skirt);
    const band = ringsOf(sash.path);
    const w = world.sashWidth(key.sash);
    if (Math.abs(sash.bottom - sash.top - w) > 0.01) sashIssues.push(`${where}: the band is ${cm(sash.bottom - sash.top).toFixed(1)} cm deep, not its cloth's ${cm(w).toFixed(1)}`);
    if (Math.abs(sash.mid - belt.mid) > 0.01) sashIssues.push(`${where}: the band is centred at y ${sash.mid}, not where a belt is`);
    const sk = mod.skirtFor(undefined, choice.skirt);
    if (!(sash.top < sk.waistY && sash.bottom > sk.waistY + 3)) sashIssues.push(`${where}: the band does not cover the seam`);
    /* its ends where the belt's are, row for row where they share one — a little past the dress, as the belt's are */
    for (const [x, y] of sash.left) {
      const row = belt.left.find(([, by]) => Math.abs(by - y) < 0.01);
      if (row && Math.abs(row[0] - x) > 0.01) sashIssues.push(`${where}: at y ${y} the band ends at x ${x.toFixed(1)}, the belt at ${row[0].toFixed(1)}`);
    }
    /* far from the knot the band is its full depth; at the knot it is pinched in to the knot's height */
    const depthAt = (x) => {
      const ys = band.flatMap((r) => r.flatMap((a, i) => { const b = r[(i + 1) % r.length]; return (a[0] - x) * (b[0] - x) < 0 ? [a[1] + ((x - a[0]) * (b[1] - a[1])) / (b[0] - a[0])] : []; }));
      return ys.length >= 2 ? Math.max(...ys) - Math.min(...ys) : NaN;
    };
    const far = sash.knot[0] - 1.6 * w;
    if (depthAt(far) < w - 1.2) sashIssues.push(`${where}: the band is ${cm(depthAt(far)).toFixed(2)} cm deep ${cm(1.6 * w).toFixed(0)} cm from the knot, not nearly its full ${cm(w).toFixed(1)}`);
    const atKnot = depthAt(sash.knot[0]);
    if (!(atKnot < w - 1 && atKnot > 0.6 * w)) sashIssues.push(`${where}: the band is ${cm(atKnot).toFixed(2)} cm deep under the knot — not gathered in`);
    /* the knot */
    const [kx, ky] = sash.knot;
    if (Math.abs(ky - sash.mid) > 0.01) sashIssues.push(`${where}: the knot is off the band's middle row`);
    if (!insideRings(band, sash.knot)) sashIssues.push(`${where}: the knot is off the band`);
    const end = Math.max(...band.flat().filter(([, y]) => Math.abs(y - sash.mid) < 1.5).map(([x]) => x));
    if (key.place === "front" && Math.abs(kx - belt.buckle.x) > ON_CENTRE) sashIssues.push(`${where}: tied at the front, its knot is ${(kx - belt.buckle.x).toFixed(1)} off the centre front`);
    if (key.place === "side" && (end - kx < 8 || kx - belt.buckle.x < 20)) sashIssues.push(`${where}: tied at her side, its knot is ${(end - kx).toFixed(1)} units in from the band's end, ${(kx - belt.buckle.x).toFixed(1)} from the front`);
    /* the bow: in the band's width; its loops' reach; its tails */
    const { parts, reach, width } = sash.bow;
    if (width !== w) sashIssues.push(`${where}: the bow is tied in cloth ${cm(width).toFixed(1)} cm wide, the band ${cm(w).toFixed(1)}`);
    const loops = box(parts.loops);
    const span = Math.max(loops.x1 - kx, kx - loops.x0);
    if (Math.abs(span - reach) > 1 || Math.abs(reach - world.bowReach(key.place)) > 0.01) sashIssues.push(`${where}: its loops reach ${cm(span).toFixed(1)} cm from the knot, declared ${cm(reach).toFixed(1)}`);
    if (Math.abs(loops.x1 - kx - (kx - loops.x0)) > ON_CENTRE) sashIssues.push(`${where}: its loops are not mirrored about the knot`);
    const tall = loops.y1 - loops.y0;
    if (tall < 1.1 * w || tall > 1.45 * w) sashIssues.push(`${where}: its loops are ${cm(tall).toFixed(1)} cm tall, the cloth ${cm(w).toFixed(1)} wide`);
    /* each loop soft, not a box: widening to its outer end, drooping there, its end dimpled where the cloth folds back */
    const loopRings = ringsOf(parts.loops[0]);
    const column = (x) => {
      const ys = ysOn(loopRings, x);
      return ys.length >= 2 ? { span: Math.max(...ys) - Math.min(...ys), mid: (Math.max(...ys) + Math.min(...ys)) / 2 } : { span: NaN, mid: NaN };
    };
    const [nearKnot, nearEnd] = [column(kx - 0.4 * w), column(kx - reach + 0.25 * w)];
    if (!(nearEnd.span > 1.4 * nearKnot.span)) sashIssues.push(`${where}: its loops do not widen toward their ends (${cm(nearKnot.span).toFixed(1)} to ${cm(nearEnd.span).toFixed(1)} cm)`);
    if (!(nearEnd.mid > ky + 1)) sashIssues.push(`${where}: its loops do not droop at their ends`);
    const tips = [];
    for (let y = loops.y0 + 0.5; y < loops.y1 - 0.5; y += 0.5) {
      const xs = xsOn(loopRings, y);
      if (xs.length) tips.push(Math.min(...xs));
    }
    if (!tips.some((x, i) => x >= Math.min(...tips.slice(0, i + 1)) + 0.04 * w && x >= Math.min(...tips.slice(i)) + 0.04 * w)) sashIssues.push(`${where}: its loops' ends are not dimpled where the cloth folds back`);
    /* its tails: 30 to 40 cm along them, the longer in front, crossing over the other under the knot and spreading apart in an upside-down V */
    const { tailLines, ends } = sash.bow;
    const [back, front] = tailLines;
    for (const [name, l] of [["back", back], ["front", front]]) {
      const len = cm(lengthOf(l));
      if (len < 30 || len > 40) sashIssues.push(`${where}: its ${name} tail is ${len.toFixed(1)} cm long`);
    }
    const longer = cm(lengthOf(front) - lengthOf(back));
    if (longer < 2 || longer > 6) sashIssues.push(`${where}: its front tail is ${longer.toFixed(1)} cm longer than the other`);
    if (Math.sign(front[0][0] - back[0][0]) !== -Math.sign(front[front.length - 1][0] - back[back.length - 1][0])) sashIssues.push(`${where}: its tails do not cross under the knot`);
    if (Math.sign(angleOf(back)) !== -Math.sign(angleOf(front))) sashIssues.push(`${where}: its tails do not spread apart, one each side`);
    if (key.place === "front") {
      /* about 25° from vertical over a full skirt, about 20° over a narrow one */
      const least = mod.narrowSkirt(choice.skirt) ? 18 : 23;
      for (const [name, l] of [["back", back], ["front", front]]) {
        const a = Math.abs(angleOf(l));
        if (a < least || a > 30) sashIssues.push(`${where}: its ${name} tail falls ${a.toFixed(1)}° from vertical`);
      }
    } else {
      /* at her side: the one falling in over the skirt about 25°; the one falling out leaving it near 20° and easing toward vertical */
      const [inward, outward] = angleOf(back) < 0 ? [back, front] : [front, back];
      const a = Math.abs(angleOf(inward));
      if (a < 22 || a > 30) sashIssues.push(`${where}: its tail falling in over the skirt falls ${a.toFixed(1)}° from vertical`);
      if (Math.abs(angleOf(outward, 0.25)) < 17 || Math.abs(angleOf(outward)) < 10) sashIssues.push(`${where}: its tail falling out toward her side hangs straight down`);
    }
    /* each narrowing where it twists halfway down, and ending cut on a slant, the outer corner lower — or, a ribbon's, notched in a V */
    if (ends !== (w < 20 ? "notch" : "slant")) sashIssues.push(`${where}: its tails' ends are ${ends === "notch" ? "notched" : "cut on a slant"}`);
    tailLines.forEach((l, k) => {
      const name = k ? "front" : "back";
      const rings = ringsOf(parts.tails[k]);
      const across = (t) => {
        const xs = xsOn(rings, l[Math.round(t * (l.length - 1))][1]);
        return Math.max(...xs) - Math.min(...xs);
      };
      if (!(across(0.5) < 0.88 * Math.min(across(0.3), across(0.72)))) sashIssues.push(`${where}: its ${name} tail does not twist halfway down`);
      const e = l[l.length - 1];
      const [ax, ay] = [e[0] - l[l.length - 2][0], e[1] - l[l.length - 2][1]];
      const al = Math.hypot(ax, ay);
      const along = [ax / al, ay / al];
      const dir = Math.sign(e[0] - l[0][0]);
      const out = -along[1] * dir >= 0 ? [-along[1], along[0]] : [along[1], -along[0]];
      const pts = rings.flat().map(([x, y]) => ({ down: (x - e[0]) * along[0] + (y - e[1]) * along[1], across: (x - e[0]) * out[0] + (y - e[1]) * out[1] }));
      const lowest = (keep) => Math.max(...pts.filter(keep).map((p) => p.down));
      if (ends === "slant" && !(lowest((p) => p.across > 0.3 * w) - lowest((p) => p.across < -0.3 * w) > 0.2 * w)) sashIssues.push(`${where}: its ${name} tail's end is not cut on a slant, the outer corner lower`);
      if (ends === "notch" && !(lowest((p) => Math.abs(p.across) < 0.08 * w) < -0.3 * w && lowest((p) => p.across > 0.35 * w) > -0.1 * w && lowest((p) => p.across < -0.35 * w) > -0.1 * w)) sashIssues.push(`${where}: its ${name} tail's end is not notched in a V`);
    });
    /* the band gathered where the bow pulls it: folds on the band, drawing in toward the knot */
    if (sash.gathers.length < 3) sashIssues.push(`${where}: the band is not gathered where the bow pulls it`);
    for (const [ridge] of sash.gathers) {
      if (ridge.some((q) => !insideRings(band, q))) sashIssues.push(`${where}: a gather runs off the band`);
      const [farQ, , nearQ] = ridge;
      if (!(Math.abs(nearQ[0] - kx) < Math.abs(farQ[0] - kx)) || Math.abs(nearQ[1] - sash.mid) > Math.abs(farQ[1] - sash.mid) + 1e-9) sashIssues.push(`${where}: a gather does not draw in toward the knot`);
    }
    /* all of it on the dress — the bodice, the band, the skirt — and off both her arms */
    const onDress = dressRings(choice.skirt, band);
    const off = sash.bow.pieces.flatMap((d) => ringsOf(d).flat()).filter((q) => !onDress(q) || insideRings(world.armRings, q));
    if (off.length) sashIssues.push(`${where}: the bow runs off the dress or onto her arm at ${off[0].map((v) => v.toFixed(1)).join(",")} (${off.length} points)`);
  }
  /* the wrap: its sash, at its side, whatever belt is asked for; the same sash any dress wears there */
  for (const waist of offer.skirt.waists) {
    const skirt = { ...mod.DEFAULT_SKIRT, waist };
    const wrap = mod.sashFor({ neckline: "wrap", skirt, belt: "brown", bowAt: "front" });
    if (!wrap || wrap.kind !== "sash" || wrap.place !== "side") sashIssues.push(`wrap · ${waist}: not tied with its sash at its side`);
    else if (wrap !== mod.sashOn(skirt, "sash", "side")) sashIssues.push(`wrap · ${waist}: its sash is not the sash tied at the side`);
    if (mod.beltWorn({ neckline: "wrap", skirt, belt: "self" }) !== "sash") sashIssues.push(`wrap · ${waist}: wears a belt other than its sash`);
  }
  report("sashes", `sashes: ${sashCount} — a sash and a ribbon, front and side, over every skirt — each its cloth's width, gathered under the knot, its bow's soft loops and crossing tails in an upside-down V as declared, on the dress and off her arms; the wrap's at its side`, sashIssues);
  const vPoint = mod.dressPoints({ neckline: "v" }).find((p) => p.kind === "neck");
  if (!vPoint || !same(collarMod.TIE_AT, vPoint.at)) pointIssues.push("the sailor collar's tie is not knotted at the V's neck point");

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
