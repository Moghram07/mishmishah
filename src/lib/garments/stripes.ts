/*
  Plain `.ts`, relative and extensioned, and no JSX — so `scripts/
  preview-garments.mjs` could import it as it does the cuts.

  Stripes of braid sewn flat along an edge: a sailor collar's outer edge, a
  sleeve's hem, a skirt's hem, a boat neckline. Each is a band between two
  guide lines laid at its two distances in from the edge, cut to the piece of
  cloth it lies on — so a stripe runs right to that piece's own edges, and
  never past them.
*/
import type { Pt } from "./fit.ts";
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

/** Whether a point lies inside a set of rings — the even-odd rule, as SVG fills a path by default here. */
export function insideRings(rings: Pt[][], [x, y]: Pt): boolean {
  let hit = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
    }
  }
  return hit;
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

/**
 * Stripes along a hem: the hem moved in onto the cloth by each stripe's
 * distances, carried on past its ends and cut to each piece given — a sleeve
 * and its cuff, or a skirt and its placket. A moved copy rather than an
 * offset, so a waving or stepped hem keeps its shape in every stripe and no
 * stripe folds over itself.
 *
 * `into` points from the hem onto the cloth; `inset` sets every stripe that
 * much further in, past the hem's own turn.
 */
export function hemStripes(
  hem: Pt[],
  into: Pt,
  bands: readonly StripeBand[],
  pieces: { index: number; d: string }[],
  inset = 0
): Inlay[] {
  if (hem.length < 2 || bands.length === 0) return [];
  const guide = extend(densify(hem, 1), 24);
  const keep = Math.floor(guide.length / 2);
  return lay(
    bands.map(([a, b]) => [translate(guide, into, a + inset), translate(guide, into, b + inset)] as [Pt[], Pt[]]),
    pieces,
    keep
  );
}

/**
 * Stripes along an edge that turns — a boat neckline and the shoulders
 * either side of it, a cap sleeve's edge round the arm: the edge smoothed
 * through its corners, then offset onto the cloth, `toward` a point on it.
 */
export function edgeStripes(
  edge: Pt[],
  toward: Pt,
  bands: readonly StripeBand[],
  pieces: { index: number; d: string }[],
  { round = 12, ends = [16, 16] }: { round?: number; ends?: [head: number, tail: number] } = {}
): Inlay[] {
  if (edge.length < 2 || bands.length === 0) return [];
  const guide = extend(smooth(edge, round), ends[0], 1, ends[1]);
  const keep = Math.floor(guide.length / 2);
  return lay(
    bands.map(([a, b]) => [offset(guide, a, toward), offset(guide, b, toward)] as [Pt[], Pt[]]),
    pieces,
    keep
  );
}

/** Each stripe's two sides cut to each piece, and closed into a stripe where both lie on it. */
function lay(sides: [Pt[], Pt[]][], pieces: { index: number; d: string }[], keep: number): Inlay[] {
  const out: Inlay[] = [];
  for (const { index, d } of pieces) {
    const rings = ringsOf(d);
    for (const [near, far] of sides) {
      const a = clipTo(rings, near, keep);
      const b = clipTo(rings, far, keep);
      if (a.length > 1 && b.length > 1) out.push({ piece: index, d: band(a, b) });
    }
  }
  return out;
}
