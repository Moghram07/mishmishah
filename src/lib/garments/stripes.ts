/*
  Plain `.ts`, relative and extensioned, and no JSX — so `scripts/
  preview-garments.mjs` could import it as it does the cuts.

  Stripes of braid sewn flat along an edge — any edge: see `edges.ts`. Each
  is a band between two guide lines laid at its two distances in from the
  edge, cut to the piece of cloth it lies on — so a stripe runs right to that
  piece's own edges, and never past them.
*/
import type { Pt } from "./fit.ts";
import type { Edge, EdgePiece, EdgeStop } from "./edges.ts";
import type { StripesId } from "@/types";

/** A stripe's near and far side, as distances in from the edge it runs along, in canvas units. */
export type StripeBand = readonly [near: number, far: number];

/**
 * Each stripe, for one, two or three. Thin: 0.5–0.75 cm, the first 0.75–0.85
 * cm in from the edge, about half a centimetre between them — braid, as on
 * the photographs, not bands of colour. Two is the pair the sailor collar
 * was approved with.
 */
export const STRIPES: Record<Exclude<StripesId, "none">, readonly StripeBand[]> = {
  one: [[4.5, 8.4]],
  two: [
    [4.5, 7.9],
    [10.7, 14.1],
  ],
  three: [
    [4, 6.8],
    [9, 11.8],
    [14, 16.8],
  ],
};

/** The stripes for a count, or none. */
export const stripesFor = (id: StripesId | undefined): readonly StripeBand[] =>
  id && id !== "none" ? STRIPES[id] : [];

const add = (a: Pt, b: Pt, k = 1): Pt => [a[0] + b[0] * k, a[1] + b[1] * k];
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const len = (a: Pt) => Math.hypot(a[0], a[1]);
const unit = (a: Pt): Pt => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l];
};
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const xy = ([x, y]: Pt) => `${Math.round(x * 100) / 100} ${Math.round(y * 100) / 100}`;

/**
 * A path's outline as rings of points, one per subpath — its lines, and its
 * curves sampled every couple of units. Absolute commands, as every drawing
 * here writes: M, L, H, V, C, Q and Z.
 */
export function ringsOf(d: string): Pt[][] {
  const known = parsed.get(d);
  if (known) return known;
  const rings = parse(d);
  parsed.set(d, rings);
  /* the oldest out once there are enough: pieces are asked for again and again, but not without end */
  if (parsed.size > 512) parsed.delete(parsed.keys().next().value!);
  return rings;
}
/** Outlines already read, by path — shared: never change one. */
const parsed = new Map<string, Pt[][]>();

function parse(d: string): Pt[][] {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const rings: Pt[][] = [];
  let ring: Pt[] = [];
  let at: Pt = [0, 0];
  let cmd = "";
  let i = 0;
  const num = () => Number(tokens[i++]);
  const close = () => {
    if (ring.length > 2) rings.push(ring);
    ring = [];
  };
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++];
    if (cmd === "Z" || cmd === "z") {
      close();
      continue;
    }
    if (cmd === "M") {
      close();
      at = [num(), num()];
      ring.push(at);
      cmd = "L";
    } else if (cmd === "L") {
      at = [num(), num()];
      ring.push(at);
    } else if (cmd === "H") {
      at = [num(), at[1]];
      ring.push(at);
    } else if (cmd === "V") {
      at = [at[0], num()];
      ring.push(at);
    } else if (cmd === "C") {
      const [b, c, e]: Pt[] = [
        [num(), num()],
        [num(), num()],
        [num(), num()],
      ];
      const a = at;
      const n = Math.max(2, Math.ceil((len(sub(b, a)) + len(sub(c, b)) + len(sub(e, c))) / 2));
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        const s = 1 - t;
        ring.push([
          s * s * s * a[0] + 3 * s * s * t * b[0] + 3 * s * t * t * c[0] + t * t * t * e[0],
          s * s * s * a[1] + 3 * s * s * t * b[1] + 3 * s * t * t * c[1] + t * t * t * e[1],
        ]);
      }
      at = e;
    } else if (cmd === "Q") {
      const [b, e]: Pt[] = [
        [num(), num()],
        [num(), num()],
      ];
      const a = at;
      const n = Math.max(2, Math.ceil((len(sub(b, a)) + len(sub(e, b))) / 2));
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        const s = 1 - t;
        ring.push([s * s * a[0] + 2 * s * t * b[0] + t * t * e[0], s * s * a[1] + 2 * s * t * b[1] + t * t * e[1]]);
      }
      at = e;
    } else {
      /* anything else — an arc — is not in a piece of cloth here: skip its numbers */
      i++;
    }
  }
  close();
  return rings;
}

/**
 * Whether a point lies inside a set of rings — the even-odd rule, as SVG
 * fills a path by default here.
 *
 * Asked of every point of every stripe's guide, against outlines of a
 * thousand points and more, so each set of rings is indexed once by the
 * unit-high rows its sides pass through: a point is tested only against the
 * sides that reach its row — every side that could cross it, and the same
 * test, so the same answer.
 */
export function insideRings(rings: Pt[][], [x, y]: Pt): boolean {
  const { top, rows } = rowsOf(rings);
  const row = rows[Math.floor(y) - top];
  if (!row) return false;
  let hit = false;
  for (let k = 0; k < row.length; k += 4) {
    const [xi, yi, xj, yj] = [row[k], row[k + 1], row[k + 2], row[k + 3]];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** Each side of a set of rings, filed under every unit-high row it passes through. */
const indexed = new WeakMap<Pt[][], { top: number; rows: number[][] }>();
function rowsOf(rings: Pt[][]): { top: number; rows: number[][] } {
  const known = indexed.get(rings);
  if (known) return known;
  let top = Infinity;
  let bottom = -Infinity;
  for (const ring of rings) for (const [, py] of ring) [top, bottom] = [Math.min(top, py), Math.max(bottom, py)];
  top = Math.floor(top);
  const rows: number[][] = Array.from({ length: Number.isFinite(top) ? Math.floor(bottom) - top + 1 : 0 }, () => []);
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      for (let r = Math.floor(Math.min(yi, yj)); r <= Math.floor(Math.max(yi, yj)); r++) rows[r - top].push(xi, yi, xj, yj);
    }
  }
  const index = { top, rows };
  indexed.set(rings, index);
  return index;
}

/** A polyline with points put in along it, no two more than `step` apart. */
export function densify(pts: Pt[], step = 1): Pt[] {
  if (pts.length < 2) return [...pts];
  return [
    pts[0],
    ...pts.slice(1).flatMap((b, i) => {
      const a = pts[i];
      const n = Math.max(1, Math.ceil(len(sub(b, a)) / step));
      return Array.from({ length: n }, (_, k) => lerp(a, b, (k + 1) / n));
    }),
  ];
}

/** A polyline carried on straight past both its ends, by `by` units, along its end directions. */
export function extend(pts: Pt[], by: number, step = 1, tailBy = by): Pt[] {
  const n = Math.ceil(by / step);
  const m = Math.ceil(tailBy / step);
  const head = unit(sub(pts[0], pts[Math.min(3, pts.length - 1)]));
  const tail = unit(sub(pts[pts.length - 1], pts[Math.max(0, pts.length - 4)]));
  return [
    ...Array.from({ length: n }, (_, k) => add(pts[0], head, (by * (n - k)) / n)),
    ...pts,
    ...Array.from({ length: m }, (_, k) => add(pts[pts.length - 1], tail, (tailBy * (k + 1)) / m)),
  ];
}

/**
 * A polyline smoothed by averaging each point with its neighbours within
 * `radius` units along it, its two ends kept — so a corner an offset would
 * fold over itself at becomes a curve it can follow.
 */
export function smooth(pts: Pt[], radius: number): Pt[] {
  const fine = densify(pts, 1);
  const s: number[] = [0];
  for (let i = 1; i < fine.length; i++) s.push(s[i - 1] + len(sub(fine[i], fine[i - 1])));
  const total = s[s.length - 1];
  return fine.map((p, i) => {
    /* the window narrows toward the ends, so they stay put */
    const r = Math.min(radius, s[i], total - s[i]);
    if (r <= 0) return p;
    let [x, y, n] = [0, 0, 0];
    for (let j = i; j >= 0 && s[i] - s[j] <= r; j--) [x, y, n] = [x + fine[j][0], y + fine[j][1], n + 1];
    for (let j = i + 1; j < fine.length && s[j] - s[i] <= r; j++) [x, y, n] = [x + fine[j][0], y + fine[j][1], n + 1];
    return [x / n, y / n] as Pt;
  });
}

/** A polyline moved `d` units off itself along its normals, to the side `toward` the given point. */
export function offset(pts: Pt[], d: number, toward: Pt): Pt[] {
  return pts.map((p, i) => {
    const dir = unit(sub(pts[Math.min(i + 1, pts.length - 1)], pts[Math.max(i - 1, 0)]));
    let n: Pt = [-dir[1], dir[0]];
    if (n[0] * (toward[0] - p[0]) + n[1] * (toward[1] - p[1]) < 0) n = [-n[0], -n[1]];
    return add(p, n, d);
  });
}

/**
 * Where a polyline turns sharply — more than `angle` degrees over `span`
 * points either side, a unit apart — by index: one per turn, at its sharpest.
 * A V's point, a square neckline's corners, where a shoulder meets the neck.
 */
export function cornersOf(pts: Pt[], angle = 35, span = 3): number[] {
  const limit = Math.cos((angle * Math.PI) / 180);
  const turns: { i: number; c: number }[] = [];
  for (let i = span; i < pts.length - span; i++) {
    const a = unit(sub(pts[i], pts[i - span]));
    const b = unit(sub(pts[i + span], pts[i]));
    const c = a[0] * b[0] + a[1] * b[1];
    if (c < limit) turns.push({ i, c });
  }
  const out: number[] = [];
  for (let k = 0; k < turns.length; ) {
    let best = turns[k];
    let j = k;
    while (j + 1 < turns.length && turns[j + 1].i === turns[j].i + 1) {
      j++;
      if (turns[j].c < best.c) best = turns[j];
    }
    out.push(best.i);
    k = j + 1;
  }
  return out;
}

/** A polyline smoothed run by run between its corners, each run's ends kept, so its corners stay sharp. */
export function smoothRuns(pts: Pt[], radius: number, corners: number[]): Pt[] {
  const cuts = [0, ...corners, pts.length - 1];
  let out: Pt[] = [];
  for (let k = 0; k + 1 < cuts.length; k++) {
    const run = pts.slice(cuts[k], cuts[k + 1] + 1);
    const done = run.length > 2 ? smooth(run, radius) : densify(run, 1);
    out = k === 0 ? done : [...out, ...done.slice(1)];
  }
  return out;
}

/** Where segments ab and cd cross, if they do. */
function crossAt(a: Pt, b: Pt, c: Pt, d: Pt): Pt | null {
  const r = sub(b, a);
  const s = sub(d, c);
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return null;
  const q = sub(c, a);
  const t = (q[0] * s[1] - q[1] * s[0]) / den;
  const u = (q[0] * r[1] - q[1] * r[0]) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? add(a, r, t) : null;
}

/** Where the lines through ab and cd meet, if they are not parallel. */
function meetAt(a: Pt, b: Pt, c: Pt, d: Pt): Pt | null {
  const r = sub(b, a);
  const s = sub(d, c);
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return null;
  const q = sub(c, a);
  return add(a, r, (q[0] * s[1] - q[1] * s[0]) / den);
}

/** How far out a mitred corner may reach, in stripe depths: past this, it is cut off square. */
const MITRE_LIMIT = 4;

/**
 * A polyline moved `d` units off itself to one side — `side` 1 its left as
 * it runs, -1 its right — run by run between its corners, each corner joined
 * as braid turns one: where the runs moved apart, carried on to meet in a
 * mitre; where they crossed, cut back to the crossing. Returns the line and
 * the index on it nearest where `middle` of the line went.
 */
export function offsetRuns(pts: Pt[], d: number, side: 1 | -1, corners: number[], middle: number): { pts: Pt[]; keep: number } {
  const cuts = [0, ...corners, pts.length - 1];
  const normal = (run: Pt[], i: number): Pt => {
    const u = unit(sub(run[Math.min(run.length - 1, i + 1)], run[Math.max(0, i - 1)]));
    return [-u[1] * side, u[0] * side];
  };
  let out: Pt[] = [];
  for (let k = 0; k + 1 < cuts.length; k++) {
    const run = pts.slice(cuts[k], cuts[k + 1] + 1);
    const moved = run.map((p, i) => add(p, normal(run, i), d));
    if (k === 0) {
      out = moved;
      continue;
    }
    /* the two runs at the corner: crossed, or apart */
    let best: { ia: number; ib: number; p: Pt } | null = null;
    for (let ia = out.length - 2; ia >= Math.max(0, out.length - 80); ia--) {
      for (let ib = 0; ib < Math.min(moved.length - 1, 80); ib++) {
        const p = crossAt(out[ia], out[ia + 1], moved[ib], moved[ib + 1]);
        if (p && (!best || out.length - ia + ib < out.length - best.ia + best.ib)) best = { ia, ib, p };
      }
    }
    if (best) out = [...out.slice(0, best.ia + 1), best.p, ...moved.slice(best.ib + 1)];
    else {
      const x = meetAt(out[out.length - 2], out[out.length - 1], moved[0], moved[1]);
      const corner = run[0];
      out = x && len(sub(x, corner)) <= MITRE_LIMIT * d ? [...out, x, ...moved] : [...out, ...moved];
    }
  }
  /* where the middle went: the point nearest the middle, moved off square */
  const mid = pts[middle];
  const goal = add(mid, normal(pts, middle), d);
  let keep = 0;
  for (let i = 1; i < out.length; i++) if (len(sub(out[i], goal)) < len(sub(out[keep], goal))) keep = i;
  return { pts: out, keep };
}

/** The same polyline moved `d` units along `dir`. */
export const translate = (pts: Pt[], dir: Pt, d: number): Pt[] => pts.map((p) => add(p, unit(dir), d));

/**
 * The stretch of a guide line that lies on a piece: of the runs of it inside
 * the piece, the one round the guide's own middle — its two ends found on the
 * piece's outline. Empty when its middle is not on the piece: a guide meant
 * for another part of the cloth.
 */
export function clipTo(rings: Pt[][], pts: Pt[], keep = Math.floor(pts.length / 2)): Pt[] {
  const inn = pts.map((p) => insideRings(rings, p));
  if (!inn[keep]) return [];
  let first = keep;
  let last = keep;
  while (first > 0 && inn[first - 1]) first--;
  while (last < pts.length - 1 && inn[last + 1]) last++;
  /* from a point inside toward one outside, halving the gap until it closes */
  const crossing = (a: Pt, b: Pt): Pt => {
    let [lo, hi] = [0, 1];
    for (let k = 0; k < 18; k++) {
      const m = (lo + hi) / 2;
      if (insideRings(rings, lerp(a, b, m))) lo = m;
      else hi = m;
    }
    return lerp(a, b, lo);
  };
  const out = pts.slice(first, last + 1);
  if (first > 0) out.unshift(crossing(pts[first], pts[first - 1]));
  if (last < pts.length - 1) out.push(crossing(pts[last], pts[last + 1]));
  return out;
}

/** A stripe, closed: along its near side, and back along its far side. */
export function band(near: Pt[], far: Pt[]): string {
  const pts = [...near, ...[...far].reverse()];
  return `M${xy(pts[0])} ${pts
    .slice(1)
    .map((p) => `L${xy(p)}`)
    .join(" ")} Z`;
}

/** A stripe laid on one piece of a region: the piece's index in its `shape`, and the stripe. */
export interface Inlay {
  piece: number;
  d: string;
}

/** How much of a band or cuff the stripes on it leave clear above them, in canvas units. */
export const BAND_STRIPE_ROOM = 1.5;

/**
 * The stripes as they fit an edge: on a band narrower than they are deep —
 * an edge with `room` — drawn finer to fit it, since a stripe across its seam
 * would be lost; elsewhere as they are.
 */
export function fittedBands(edge: Edge, bands: readonly StripeBand[]): readonly StripeBand[] {
  if (edge.room === undefined || bands.length === 0) return bands;
  const last = bands[bands.length - 1][1];
  if (edge.room >= last + BAND_STRIPE_ROOM) return bands;
  const fit = (edge.room - BAND_STRIPE_ROOM) / last;
  return bands.map(([n, f]) => [n * fit, f * fit] as const);
}

/**
 * The guide line `d` units in from an edge, before it is cut to the cloth,
 * and the index of its middle — where every stripe is laid from.
 *
 * A `level` edge — a hem — is moved straight in, carried on 24 units past
 * each end: a moved copy rather than an offset, so a waving or stepped hem
 * keeps its shape in every stripe and no stripe folds over itself. A `follow`
 * edge — one that turns — is smoothed through its corners, carried on past
 * its ends, and offset square to itself onto the cloth.
 */
export function guideAt(edge: Edge, d: number): { pts: Pt[]; keep: number } {
  const lay = edge.lay;
  if (lay.by === "own") {
    const pts = lay.inFrom(d);
    return { pts, keep: Math.floor(pts.length / 2) };
  }
  if (lay.by === "level") {
    const guide = extend(densify(edge.line, 1), 24);
    return { pts: translate(guide, lay.into, d + lay.inset), keep: Math.floor(guide.length / 2) };
  }
  if (lay.side !== undefined) {
    /* smoothed between its corners, carried on past its ends, and moved off to its cloth's side, the corners mitred */
    const fine = densify(edge.line, 1);
    const turns = lay.corners ? cornersOf(fine) : [];
    const smoothed = smoothRuns(fine, lay.round, turns);
    const guide = extend(smoothed, lay.ends[0], 1, lay.ends[1]);
    const at = lay.corners ? cornersOf(guide) : [];
    return offsetRuns(guide, d, lay.side, at, Math.floor(guide.length / 2));
  }
  const guide = extend(smooth(edge.line, lay.round), lay.ends[0], 1, lay.ends[1]);
  return { pts: offset(guide, d, lay.toward ?? [300, 262]), keep: Math.floor(guide.length / 2) };
}

/** One stripe's two long sides as laid on one piece, near side first. */
export interface StripeSides {
  piece: number;
  /** Which stripe of the count, from the edge in. */
  stripe: number;
  near: Pt[];
  far: Pt[];
}

/**
 * Each stripe's two sides along an edge, cut to each piece it lies on — a
 * sleeve and its cuff, a skirt and its placket, a collar panel — where both
 * lie on it. An `own` edge's are cut already.
 */
export function stripeSides(edge: Edge, bands: readonly StripeBand[]): StripeSides[] {
  if (edge.line.length < 2 || bands.length === 0) return [];
  const fitted = fittedBands(edge, bands);
  const guides = fitted.map(([a, b]) => [guideAt(edge, a), guideAt(edge, b)] as const);
  const out: StripeSides[] = [];
  if (edge.lay.by === "own") {
    const piece = edge.pieces[0]?.index ?? 0;
    guides.forEach(([a, b], stripe) => {
      if (a.pts.length > 1 && b.pts.length > 1) out.push({ piece, stripe, near: a.pts, far: b.pts });
    });
    return out;
  }
  for (const { index, d } of edge.pieces as EdgePiece[]) {
    const rings = ringsOf(d);
    guides.forEach(([a, b], stripe) => {
      const near = clipTo(rings, a.pts, a.keep);
      const far = clipTo(rings, b.pts, b.keep);
      if (near.length > 1 && far.length > 1) out.push({ piece: index, stripe, near, far });
    });
  }
  return edge.meets || edge.against?.length ? endNeatly(edge, out, fitted[fitted.length - 1][1]) : out;
}

/* ------------------------------------------------------- neat ends */

/** How near another edge a stripe must end to have run into it, in units. */
const RAN_INTO = 2;

/** The arc length along a line to the point on it nearest `q`, and whether that falls on it rather than past an end. */
function along(line: Pt[], q: Pt): { s: number; on: boolean; total: number } {
  let best = { s: 0, d: Infinity };
  let run = 0;
  for (let i = 1; i < line.length; i++) {
    const [a, b] = [line[i - 1], line[i]];
    const ab = sub(b, a);
    const l = len(ab) || 1e-9;
    const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * ab[0] + (q[1] - a[1]) * ab[1]) / (l * l)));
    const d = len(sub(q, add(a, ab, t)));
    if (d < best.d) best = { s: run + t * l, d };
    run += l;
  }
  return { s: best.s, on: best.s > 0.5 && best.s < run - 0.5, total: run };
}

/** The point at arc length `s` along a line, and the line's direction there. */
function pointAt(line: Pt[], s: number): { p: Pt; t: Pt } {
  let run = 0;
  for (let i = 1; i < line.length; i++) {
    const [a, b] = [line[i - 1], line[i]];
    const l = len(sub(b, a));
    if (run + l >= s || i === line.length - 1) return { p: lerp(a, b, l ? Math.min(1, (s - run) / l) : 0), t: unit(sub(b, a)) };
    run += l;
  }
  return { p: line[0], t: [1, 0] };
}

/** The distance from a point to a polyline. */
function toLine(q: Pt, line: Pt[]): number {
  let m = Infinity;
  for (let i = 1; i < line.length; i++) {
    const [a, b] = [line[i - 1], line[i]];
    const ab = sub(b, a);
    const l2 = ab[0] * ab[0] + ab[1] * ab[1] || 1e-9;
    const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * ab[0] + (q[1] - a[1]) * ab[1]) / l2));
    m = Math.min(m, len(sub(q, add(a, ab, t))));
  }
  return m;
}

/** A run of points cut where it first crosses segment ab from its start — `fromHead` — or last from its end; the rest kept. */
function cutAt(pts: Pt[], a: Pt, b: Pt, fromHead: boolean): Pt[] {
  if (fromHead) {
    for (let i = 0; i + 1 < pts.length; i++) {
      const x = crossAt(pts[i], pts[i + 1], a, b);
      if (x) return [x, ...pts.slice(i + 1)];
    }
  } else {
    for (let i = pts.length - 2; i >= 0; i--) {
      const x = crossAt(pts[i], pts[i + 1], a, b);
      if (x) return [...pts.slice(0, i + 1), x];
    }
  }
  return pts;
}

/**
 * Each stripe ended as braid is at a corner of its cloth — see `Edge.meets`
 * and `Edge.against`. Where an end of the edge meets another edge, every
 * stripe ends on the line halving the corner. And where some row would run
 * into another finished edge near the edge's end, all of them end there
 * together, square across the edge, just short of the first that would.
 */
function endNeatly(edge: Edge, sides: StripeSides[], deep: number): StripeSides[] {
  const line = edge.line;
  const reach = deep + 4;
  /* the cross-sections every row ends at, by arc length from the edge's start, where another edge cuts in */
  let lo = -Infinity;
  let hi = Infinity;
  if (edge.against?.length) {
    const half = along(line, line[0]).total / 2;
    for (const s of sides) {
      for (const end of [s.near[0], s.near[s.near.length - 1], s.far[0], s.far[s.far.length - 1]]) {
        const at = along(line, end);
        if (!at.on || !edge.against.some((other) => toLine(end, other) < RAN_INTO)) continue;
        /* near its ends only: a row that runs into another edge mid-way had room made for it — see `Edge.room` */
        if (at.s < half * 0.5) lo = Math.max(lo, at.s + 0.6);
        else if (at.s > half * 1.5) hi = Math.min(hi, at.s - 0.6);
      }
    }
  }
  const across = (s: number): [Pt, Pt] => {
    const { p, t } = pointAt(line, s);
    const n: Pt = [-t[1], t[0]];
    return [add(p, n, -reach), add(p, n, reach)];
  };
  const mitre = (stop: EdgeStop): [Pt, Pt] => {
    /* far enough along the halving line to cross the deepest row, however sharp the corner */
    return [add(stop.at, stop.dir, -1), add(stop.at, stop.dir, Math.min(60, reach * 3))];
  };
  const head = edge.meets?.head ? mitre(edge.meets.head) : null;
  const tail = edge.meets?.tail ? mitre(edge.meets.tail) : null;
  const headCut = Number.isFinite(lo) ? across(lo) : null;
  const tailCut = Number.isFinite(hi) ? across(hi) : null;
  const finish = (pts: Pt[]): Pt[] => {
    let out = pts;
    if (head) out = cutAt(out, head[0], head[1], true);
    if (tail) out = cutAt(out, tail[0], tail[1], false);
    if (headCut) out = cutAt(out, headCut[0], headCut[1], true);
    if (tailCut) out = cutAt(out, tailCut[0], tailCut[1], false);
    return out;
  };
  return sides.map((s) => ({ ...s, near: finish(s.near), far: finish(s.far) })).filter((s) => s.near.length > 1 && s.far.length > 1);
}

/** Stripes along any edge, closed, each on the piece of its region it lies on — see `stripeSides`. */
export const stripesAlong = (edge: Edge, bands: readonly StripeBand[]): Inlay[] =>
  stripeSides(edge, bands).map(({ piece, near, far }) => ({ piece, d: band(near, far) }));
