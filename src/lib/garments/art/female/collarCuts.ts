/*
  Plain `.ts`, relative and extensioned, and no JSX — so `scripts/
  preview-garments.mjs` can import it and measure the same collars the app
  draws, on every cut they are sewn to. See `dressCut.ts` for why.

  The collars here are the ones that lie along the cut they are sewn to,
  rather than standing at the base of the neck whatever the cut: a flat collar
  follows its garment's own neckline, and a sailor collar is sewn down a V.
*/
import { flatCollar, outline, run, type Neckline, type Pt } from "../../fit.ts";
import { blade, mirror, nudge, type Point } from "../../collar.ts";
import type { NecklineId } from "../../necklines.ts";
import { stripeSides, stripesAlong, type StripeBand } from "../../stripes.ts";
import type { Edge } from "../../edges.ts";
import { bodiceFor, dressPoints } from "./dressCut.ts";
import { opening, standFront } from "./yoke.ts";

/* ------------------------------------------------------------- Peter Pan */

/**
 * The crew opening, the shallowest of the round ones: what a Peter Pan is
 * sewn to on a top, which keeps its own neckline. Cut to the shallowest, it
 * covers the seam of every top it is offered on — the blouse's dips four units
 * lower, inside the collar's cloth.
 */
const CREW = opening(34);

/**
 * A Peter Pan's size, in canvas units — see `flatCollar`: 30 units, 5.7 cm,
 * across the cloth from the seam, the whole way round; its front ends
 * rounded on a quarter circle as wide as the collar, so they just meet at
 * the neck; and over the shoulder at its back, through the last 45% of each
 * half, its end lying 30 units along the shoulder. The same on every cut:
 * on a scoop or a boat it follows that neckline at this width.
 *
 * It used to be 34 units deep at centre front, the halves butted square
 * down the middle and tapering to 12 at the shoulders: a bib.
 */
export const PETER_PAN = { width: 30, round: 30, reach: 30, blend: 0.45 };

/** The neckline a Peter Pan lies along: the dress's own cut, or a top's crew neck. */
const roundOpening = (cut?: NecklineId): Neckline => (cut ? bodiceFor(cut).cut.neck : undefined) ?? CREW;

/**
 * The shoulder lines each half turns over, from each collar point out: the
 * dress's own cut's, or — on a top, whose crew neck is the round cut's
 * opening — the round cut's, which are the yoke's.
 */
const shouldersOf = (cut?: NecklineId): { left: Pt[]; right: Pt[] } => {
  const parts = (cut ? bodiceFor(cut).cut.parts : undefined) ?? bodiceFor("round").cut.parts!;
  return { left: parts.strapLeft, right: [...parts.strapRight].reverse() };
};

/**
 * A Peter Pan's two halves, cut from the opening it is sewn to — see
 * `flatCollar`: its inner edge **is** the seam, so on a scoop it lies along
 * the scoop's low line and on a boat along its wide, shallow one, out toward
 * the shoulders, with no skin between collar and cloth; and its free edges,
 * each from the shoulder round to centre front.
 */
export function peterPan(cut?: NecklineId): { left: Pt[]; right: Pt[]; free: [Pt[], Pt[]] } {
  return flatCollar(roundOpening(cut), { ...PETER_PAN, shoulders: shouldersOf(cut) });
}

/* ---------------------------------------------------------------- sailor */

/**
 * A sailor collar's size — see `sailorPanel`.
 *
 * `reach` is how far out along the shoulder each panel lies, as a share of
 * the shoulder from the collar point to the shoulder point: 0.88, so its
 * outer corner stops about 1.6 cm short of the shoulder point. `bow` is how
 * far the outer edge's curve is drawn out from the straight line between that
 * corner and the V's point, in canvas units — the handles' offset, 13 — which
 * stands the edge itself 1.5 cm off that line at its fullest: a panel this
 * broad hangs, and its free edge curves. At 1 cm the edge read as a straight
 * line, and the panel as a band laid along the V.
 */
export const SAILOR = { reach: 0.88, bow: 13 };

/** One panel of a sailor collar, as cut: what is drawn, and the points it is drawn through. */
export interface SailorPanel {
  /** The panel, closed: along the shoulder, down its outer edge, up the V. */
  path: string;
  /** Its free edge: the outer edge, from its corner on the shoulder down to the V's point. */
  free: string;
  /** The corner where its outer edge leaves the shoulder line. */
  corner: Pt;
  /** The panel's outline as points, for measuring: shoulder, outer edge, V. */
  ring: Pt[];
  /** The outer edge as points, corner to point. */
  outer: Pt[];
  /**
   * A line `d` units in from the outer edge, carried on past both its ends
   * and cut to the panel — where a stripe's side runs: see `panelStripes`.
   */
  inFrom: (d: number) => Pt[];
}

const add = (a: Pt, b: Pt, k = 1): Pt => [a[0] + b[0] * k, a[1] + b[1] * k];
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const len = (a: Pt) => Math.hypot(a[0], a[1]);
const unit = (a: Pt): Pt => [a[0] / len(a), a[1] / len(a)];
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const xy1 = ([x, y]: Pt) => `${Math.round(x * 10) / 10} ${Math.round(y * 10) / 10}`;

/** A cubic's point at `t`. */
const cubicAt = ([a, b, c, d]: Pt[], t: number): Pt => {
  const s = 1 - t;
  const k = [s * s * s, 3 * s * s * t, 3 * s * t * t, t * t * t];
  return [k[0] * a[0] + k[1] * b[0] + k[2] * c[0] + k[3] * d[0], k[0] * a[1] + k[1] * b[1] + k[2] * c[1] + k[3] * d[1]];
};
/** A cubic's direction at `t`. */
const cubicSlope = ([a, b, c, d]: Pt[], t: number): Pt => {
  const s = 1 - t;
  const k = [3 * s * s, 6 * s * t, 3 * t * t];
  return [
    k[0] * (b[0] - a[0]) + k[1] * (c[0] - b[0]) + k[2] * (d[0] - c[0]),
    k[0] * (b[1] - a[1]) + k[1] * (c[1] - b[1]) + k[2] * (d[1] - c[1]),
  ];
};

/** Whether a point lies inside a closed ring of points — the even-odd rule. */
export const insideRing = (ring: Pt[], [x, y]: Pt): boolean => {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};

/** A run of points cut to the part of it inside a ring, its two ends found on the ring. */
function within(ring: Pt[], pts: Pt[]): Pt[] {
  const inn = pts.map((p) => insideRing(ring, p));
  const first = inn.indexOf(true);
  const last = inn.lastIndexOf(true);
  if (first < 0) return [];
  /* from a point inside toward one outside, halving the gap until it closes */
  const crossing = (a: Pt, b: Pt): Pt => {
    let [lo, hi] = [0, 1];
    for (let k = 0; k < 20; k++) {
      const m = (lo + hi) / 2;
      if (insideRing(ring, lerp(a, b, m))) lo = m;
      else hi = m;
    }
    return lerp(a, b, lo);
  };
  const out = pts.slice(first, last + 1);
  if (first > 0) out.unshift(crossing(pts[first], pts[first - 1]));
  if (last < pts.length - 1) out.push(crossing(pts[last], pts[last + 1]));
  return out;
}

/** A polyline with points put in along it, no two more than `step` apart. */
const fine = (pts: Pt[], step = 1.5): Pt[] => [
  pts[0],
  ...pts.slice(1).flatMap((b, i) => {
    const a = pts[i];
    const n = Math.max(1, Math.ceil(len(sub(b, a)) / step));
    return Array.from({ length: n }, (_, k) => lerp(a, b, (k + 1) / n));
  }),
];

/**
 * One panel of a sailor collar, sewn down one edge of a V.
 *
 * It lies **on the shoulder**: its top edge is the garment's own shoulder line,
 * from the collar point out to `SAILOR.reach` of the way to the shoulder
 * point, where the collar turns over to the back. Its inner edge **is** the
 * V's edge, the whole way up to the collar point, so nothing of it stands
 * beside the neck. And from its corner on the shoulder its outer edge comes
 * down and in to the V's point in one bowed curve, so the panel is broadest
 * over the shoulder and narrows smoothly to nothing at the point, where the
 * two panels meet.
 *
 * It used to hang below the shoulder line from the collar point, its top
 * edge running down the chest to a corner short of the shoulder: two flat
 * triangles on the chest, a bib, with the back of the collar standing up at
 * either side of the neck.
 */
function sailorPanel(apex: Pt, edge: Pt[], shoulder: Pt[]): SailorPanel {
  const collarPoint = shoulder[0];
  /* along the shoulder to its share of the way out */
  const seg = shoulder.slice(1).map((b, i) => len(sub(b, shoulder[i])));
  let left = SAILOR.reach * seg.reduce((a, b) => a + b, 0);
  let i = 0;
  while (i < seg.length - 1 && left > seg[i]) left -= seg[i++];
  const corner = lerp(shoulder[i], shoulder[i + 1], Math.min(1, left / seg[i]));
  const along = [...shoulder.slice(0, i + 1), corner];

  /* the outer edge: one cubic from the corner to the point, bowed out away from the collar point */
  const chord = sub(apex, corner);
  const u = unit(chord);
  let out: Pt = [u[1], -u[0]];
  if (out[0] * (collarPoint[0] - corner[0]) + out[1] * (collarPoint[1] - corner[1]) > 0) out = [-out[0], -out[1]];
  const third = len(chord) / 3;
  const curve: Pt[] = [
    corner,
    add(add(corner, u, third), out, SAILOR.bow),
    add(add(apex, u, -third), out, SAILOR.bow * 0.6),
    apex,
  ];
  const outer = Array.from({ length: 61 }, (_, k) => cubicAt(curve, k / 60));

  const ring = [...fine(along), ...outer.slice(1), ...fine(edge).slice(1, -1)];
  const free = `M${xy1(corner)} C${xy1(curve[1])} ${xy1(curve[2])} ${xy1(apex)}`;
  const path = `M${xy1(collarPoint)} ${run(along)} C${xy1(curve[1])} ${xy1(curve[2])} ${xy1(apex)} ${run(edge)} Z`;

  /*
    The trim: the outer edge, carried on past both its ends, moved in by each
    stripe's two distances and cut to the panel — so each stripe runs on over
    the shoulder at the top and is cut off by the V near the point, as a braid
    is, sewn on before the collar is set.
  */
  const inward = (dir: Pt): Pt => {
    const n: Pt = [dir[1], -dir[0]];
    return n[0] * out[0] + n[1] * out[1] > 0 ? [-n[0], -n[1]] : n;
  };
  const inFrom = (d: number): Pt[] => {
    const start = unit(cubicSlope(curve, 0));
    const end = unit(cubicSlope(curve, 1));
    const pts: Pt[] = [];
    for (let k = 12; k >= 1; k--) pts.push(add(add(corner, start, -2.5 * k), inward(start), d));
    for (let k = 0; k <= 120; k++) {
      const t = k / 120;
      pts.push(add(cubicAt(curve, t), inward(unit(cubicSlope(curve, t))), d));
    }
    for (let k = 1; k <= 12; k++) pts.push(add(add(apex, end, 2.5 * k), inward(end), d));
    return within(ring, pts);
  };
  return { path, free, corner, ring, outer, inFrom };
}

/**
 * A panel's free edge, as an edge parts are laid along — see `edges.ts`: its
 * outer edge, on the panel, each stripe's side laid in along the panel's own
 * curve and cut to it (`inFrom`). `side` is the panel's index in the
 * collar's drawing: 0 the left, 1 the right.
 */
export const panelEdge = (panel: SailorPanel, side: 0 | 1): Edge => ({
  kind: "collar",
  side,
  line: panel.outer,
  pieces: [{ index: side, d: panel.path }],
  lay: { by: "own", inFrom: panel.inFrom },
});

/** The sailor collar's two free edges, left then right — what its stripes are laid along. */
export function sailorEdges(): Edge[] {
  const { left, right } = sailor();
  return [panelEdge(left, 0), panelEdge(right, 1)];
}

/**
 * A panel's stripes, closed, each with its two long sides as points from the
 * shoulder down, the side nearer the free edge first — see `STRIPES` in
 * `stripes.ts` for how many and how far in.
 */
export function panelStripes(panel: SailorPanel, bands: readonly StripeBand[]): { paths: string[]; edges: [Pt[], Pt[]][] } {
  const edge = panelEdge(panel, 0);
  return { paths: stripesAlong(edge, bands).map((s) => s.d), edges: stripeSides(edge, bands).map((s) => [s.near, s.far]) };
}

/**
 * A sailor collar's two panels, sewn down the V — the only cut it is offered
 * on. Each is cut from its own side: her neck is three units left of her
 * shoulders' centre, so one panel mirrored would stop short of the other
 * shoulder and leave a sliver of the dress above it.
 */
export function sailor(): { left: SailorPanel; right: SailorPanel } {
  const { vee, parts } = bodiceFor("v").cut;
  return {
    /* the V's left edge runs from its point up to the collar point, the shoulder from there out */
    left: sailorPanel(vee!.apex, vee!.left, parts!.strapLeft),
    right: sailorPanel(vee!.apex, [...vee!.right].reverse(), [...parts!.strapRight].reverse()),
  };
}

/* ------------------------------------------------------------- the tie */

/** Where a sailor collar's tie is knotted: the V's neck point, where its two panels meet — see `dressPoints`. */
export const TIE_AT: Pt = dressPoints({ neckline: "v" }).find((p) => p.kind === "neck")!.at;

/** Corners and bows relative to the V's point, laid on it — see `blade` for the bows' sign. */
const atV = (corners: Pt[]): Point[] => corners.map(([x, y]) => [TIE_AT[0] + x, TIE_AT[1] + y] as const);

/**
 * The knot: a small tied bow at the V's point, about 7 cm across — a knot
 * 1.7 cm across, two loops pinched into it, each 2.4 cm long and twice as
 * tall at its end as at the knot, and two short tails, 5 cm, falling from under it and cut on a
 * slant, the outer corner lower. Written left side only and reflected about
 * the point, each piece anticlockwise, so a positive bow is convex.
 */
const KNOT = { corners: atV([[-4.5, -3.6], [-3.6, 5.6], [3.6, 5.6], [4.5, -3.6]]), bows: [1.2, 0.8, 1.2, 0.8] };
const KNOT_LOOP = { corners: atV([[-3.8, -2.6], [-16.2, -5.6], [-15, 6.2], [-3.8, 4.6]]), bows: [1.3, 3.6, 1.3, 0] };
const KNOT_TAIL = { corners: atV([[-4.6, 3.4], [-10.6, 29.4], [-3.4, 26.6], [0.4, 3.4]]), bows: [1, 0, -0.6, 0] };

/**
 * The necktie: a knot at the V's point, 2.5 cm across at the top and
 * narrowing under it, and its blade hanging down the centre from under the
 * knot, widening to 5.5 cm and ending in a point 12.5 cm below the V —
 * cut on the bias, as a tie is, and lying flat on the dress.
 */
const NECKTIE_KNOT = { corners: atV([[-6.6, -4], [-4.2, 7.2], [4.2, 7.2], [6.6, -4]]), bows: [0.8, 0.6, 0.8, 0.6] };
const NECKTIE_BLADE = { corners: atV([[-4.4, 5], [-14.6, 46], [0, 66], [14.6, 46], [4.4, 5]]), bows: [1.2, 0.8, 0.8, 1.2, 0] };

/** A sailor collar's tie, back to front: each piece closed, its own path. */
export function sailorTie(kind: "knot" | "necktie"): { pieces: string[]; parts: { tails?: string[]; loops?: string[]; knot: string; blade?: string } } {
  const piece = ({ corners, bows }: { corners: Point[]; bows: number[] }) => blade(corners, bows);
  if (kind === "knot") {
    const tail = piece(KNOT_TAIL);
    const loop = piece(KNOT_LOOP);
    const tails = [tail, mirror(tail, TIE_AT[0])];
    const loops = [loop, mirror(loop, TIE_AT[0])];
    const knot = piece(KNOT);
    return { pieces: [...tails, ...loops, knot], parts: { tails, loops, knot } };
  }
  const bladePath = piece(NECKTIE_BLADE);
  const knot = piece(NECKTIE_KNOT);
  return { pieces: [bladePath, knot], parts: { blade: bladePath, knot } };
}

/* ------------------------------------------------------------------- bow */

/** The neck's centre, which the bow is mirrored about. */
export const BOW_CENTRE = 297.05;

/** The band the bow is tied round: eight units of stand, at the base of the neck. */
const BOW_BAND = standFront(8);

/**
 * The left loop, round from where it leaves the knot: out along its top edge,
 * round its end, and back along its lower edge. About 6.6 cm long, 2.3 cm
 * tall where it is pinched into the knot and 4.5 cm at its end, tipped up a
 * little away from the knot — a flattened tube, not an oval.
 */
const BOW_LOOP_LEFT =
  "M292.5 185.2 C284.6 183.4 274.2 176 264.8 176.8 C258.6 177.4 256.4 183.6 257.3 189.4 " +
  "C258.3 195.8 262.6 200.4 270 200.4 C278.2 200.4 285.4 197.8 292.5 197.1 Z";

/**
 * The knot, small and wrapped tight over both loops: pinched in at its sides,
 * where it is under the most tension, and swelling top and bottom. About
 * 2.9 cm across and 3.2 tall.
 */
const BOW_KNOT: Point[] = [
  [289.6, 182.4],
  [304.5, 182.4],
  [305.3, 199.2],
  [288.8, 199.2],
];
const BOW_KNOT_BOWS = [1.2, -1.5, 1.4, -1.5];

/**
 * The left tail, from under the knot to the middle of her chest at y 284:
 * about 17 cm long and 2.7 wide, falling a little away from the other, and
 * cut on a slant at its end, its outer corner the lower. Its edges bend
 * gently, as soft cloth lying on a body does.
 */
const BOW_TAIL_LEFT =
  "M289.4 195.2 C286.4 221.8 279.6 252.6 271.6 284.4 " +
  "C276.6 282.2 281.6 279.8 286.6 277.4 " +
  "C287.6 255.4 292.6 226.2 298.2 196.4 Z";

/**
 * On a keyhole the bow is tied above the opening: knot and loops lifted
 * until the knot sits on the band, its lower edge on the band's foot, so the
 * keyhole opens below it — the knot covers the top of the slit and the
 * keyhole's own small button there.
 */
export const BOW_KEYHOLE_LIFT = 9;

/**
 * And its tails fall either side of the opening: each leaves from under the
 * knot and its loop, turns out round the keyhole — three to six units clear of
 * it where it is widest — and falls to the same slanted end at y 284 as the
 * bow's own, a little further out.
 */
const BOW_TAIL_LEFT_KEYHOLE =
  "M275 188 C271.6 214 266.4 250 260.4 284.4 " +
  "C265.8 282.2 271 279.8 276.4 277.4 " +
  "C277.6 252 280 222 282.4 200 " +
  "C284 194 286.2 189.6 288.8 186.6 Z";

/**
 * The bow's pieces on whatever it is sewn to, back to front — the band, the
 * tails, the loops and the knot — and how far its knot and loops are lifted:
 * tied at the throat on a high neckline, above the opening on a keyhole.
 */
export function bow(cut?: NecklineId): { band: string; tails: [string, string]; loops: [string, string]; knot: string; lift: number } {
  const keyhole = cut === "keyhole";
  const lift = keyhole ? BOW_KEYHOLE_LIFT : 0;
  const up = (d: string) => (lift ? nudge(d, 0, -lift) : d);
  const loop = up(BOW_LOOP_LEFT);
  const tail = keyhole ? BOW_TAIL_LEFT_KEYHOLE : BOW_TAIL_LEFT;
  return {
    band: BOW_BAND,
    tails: [tail, mirror(tail, BOW_CENTRE)],
    loops: [loop, mirror(loop, BOW_CENTRE)],
    knot: up(blade(BOW_KNOT, BOW_KNOT_BOWS)),
    lift,
  };
}

/* --------------------------------------------------------------- for the checker */

/**
 * Each collar drawn here, as cloth, for one cut — or for a garment with no
 * choice of cut when `cut` is absent. What `check:garments` rasterises, so it
 * measures the shape the browser draws on that cut.
 */
export const COLLAR_CLOTH: Record<string, (cut?: NecklineId) => string[]> = {
  "female-peter-pan-collar-front": (cut) => {
    const { left, right } = peterPan(cut);
    return [outline(left), outline(right)];
  },
  "female-sailor-collar-front": () => {
    const { left, right } = sailor();
    return [left.path, right.path];
  },
  "female-bow-collar-front": (cut) => {
    const b = bow(cut);
    return [b.band, ...b.tails, ...b.loops, b.knot];
  },
};
