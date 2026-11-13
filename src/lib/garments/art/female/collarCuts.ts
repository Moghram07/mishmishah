/*
  Plain `.ts`, relative and extensioned, and no JSX — so `scripts/
  preview-garments.mjs` can import it and measure the same collars the app
  draws, on every cut they are sewn to. See `dressCut.ts` for why.

  The collars here are the ones that lie along the cut they are sewn to,
  rather than standing at the base of the neck whatever the cut: a flat collar
  follows its garment's own neckline, and a sailor collar is sewn down a V.
*/
import { flatCollar, line, outline, run, type Neckline, type Pt } from "../../fit.ts";
import { blade, mirror, nudge, type Point } from "../../collar.ts";
import type { NecklineId } from "../../necklines.ts";
import { clipTo, cornersOf, densify, extend, offsetRuns, ringsOf, smoothRuns, stripeSides, stripesAlong, type StripeBand } from "../../stripes.ts";
import type { WaistId } from "@/types";
import type { Edge } from "../../edges.ts";
import type { SleeveChoice } from "../../sleeves.ts";
import { bodiceFor, dressPoints, skirtTopAt } from "./dressCut.ts";
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

/**
 * A sailor collar's free edges on a cut it follows — what its stripes are
 * laid along: on the V, its two panels', left then right; round a round,
 * boat or square neckline, the one collar's, shoulder to shoulder; on a
 * wrap, each band's, the one under first.
 */
export function sailorEdges(cut: NecklineId = "v", waist: WaistId = "natural", sleeve?: SleeveChoice): Edge[] {
  if (cut === "v") {
    const { left, right } = sailor();
    return [panelEdge(left, 0), panelEdge(right, 1)];
  }
  return sailorOn(cut as Exclude<SailorCut, "v">, waist, sleeve).map((p, index) => ({
    kind: "collar" as const,
    ...(p.side !== undefined ? { side: p.side } : {}),
    line: p.outer,
    pieces: [{ index, d: p.path }],
    lay: { by: "own" as const, inFrom: p.inFrom },
    ...(p.room !== undefined ? { room: p.room } : {}),
  }));
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

/* ------------------------------------------ the sailor on the other necklines */

/**
 * The cuts a sailor collar follows, the V first: the V's two panels as
 * approved, a wide flat collar round the boat (photo 1), the round, the
 * square and the scoop, and two bands down a wrap's edges, the top one
 * crossing over the other and running on to the tie (photos 2–3) — see
 * `sailorOn`.
 */
export const SAILOR_CUTS = ["v", "boat", "wrap", "round", "square", "scoop"] as const satisfies readonly NecklineId[];
export type SailorCut = (typeof SAILOR_CUTS)[number];

/**
 * How wide a sailor collar lies round the other necklines it follows — the
 * round, the boat and the square — and along a wrap's two edges: 28 units,
 * 5.3 cm, square off the seam. Photo 1's, round a boat, is about 5 cm;
 * photos 2–3's, down a wrap, about 5.5.
 */
export const SAILOR_BAND = 28;

/**
 * How wide it lies round each neckline it lies round, square off the seam:
 * round a boat 40 units, 7.6 cm, as photo 1's is — a wide shallow opening
 * wants a broad collar, or it reads as a band — and round the others
 * `SAILOR_BAND`.
 */
export const SAILOR_WIDTH: Record<"boat" | "round" | "square" | "scoop", number> = { boat: 40, round: SAILOR_BAND, square: SAILOR_BAND, scoop: SAILOR_BAND };

/**
 * How far along the seam from each collar point the outer edge sweeps from
 * its corner on the shoulder before it runs on at the band's width — see
 * `sweptFromCorner`.
 */
const SAILOR_TURN = 40;

/**
 * How far inside the armhole seam a sailor collar's outer edge keeps: 1 cm.
 * A collar is sewn to the neck and lies on the bodice; past the armhole it
 * would lie over the sleeve. Round the square, whose corners come within
 * 2 cm of it, this is what shapes the collar's sides.
 */
export const ARMHOLE_CLEAR = 5;

/** How far short of a wrap's crossing its under band's edge leaves the seam, which hooks round there — see `downWrap`. */
const WRAP_HOOK = 6;

/**
 * One piece of a sailor collar as it is cut on a neckline: the collar round
 * a round, boat or square, or one band of a wrap's.
 */
export interface SailorPiece {
  /** The piece, closed. */
  path: string;
  /** Its free edges, as open paths: what throws its shadow and catches its light. */
  free: string;
  /** Its outline as points, for measuring. */
  ring: Pt[];
  /** Its outer edge as points, from the shoulder: what its stripes are laid along. */
  outer: Pt[];
  /** A line `d` units in from the outer edge, carried on past its ends and cut to the piece — see `SailorPanel.inFrom`. */
  inFrom: (d: number) => Pt[];
  /** Which of a pair: 0 the left (her right), 1 the other. Absent for a collar round the neck. */
  side?: 0 | 1;
  /**
   * Where it is narrower than its stripes are deep — round the square's lower
   * corners, between the opening and the armhole — how deep it is there: the
   * stripes are drawn finer to pass, as on a narrow band, never cut off.
   */
  room?: number;
}

const lengthOf = (pts: Pt[]) => pts.slice(1).reduce((s, p, i) => s + len(sub(p, pts[i])), 0);

/**
 * How far short of the shoulder point a sailor collar's corner lies on the
 * shoulder: as far as the V's panels' do, about 1.6 cm — whatever is left of
 * a shoulder beside a wider neckline.
 */
const SHOULDER_SHORT = (1 - SAILOR.reach) * lengthOf(bodiceFor("v").cut.parts!.strapLeft);

/**
 * Her shoulder points, left and right, where a set-in sleeve is sewn: a cap
 * sleeve, cut in one with the bodice, or a dropped shoulder runs the
 * shoulder line on past them, over the arm.
 */
const SHOULDER_POINTS = (() => {
  const { strapLeft, strapRight } = bodiceFor("round").cut.parts!;
  return { left: strapLeft[strapLeft.length - 1], right: strapRight[0] };
})();

/** How far along a polyline the point on it nearest `q` is. */
function lengthTo(pts: Pt[], q: Pt): number {
  let best = { s: lengthOf(pts), d: Infinity };
  let run = 0;
  for (let i = 1; i < pts.length; i++) {
    const ab = sub(pts[i], pts[i - 1]);
    const l = len(ab) || 1e-9;
    const t = Math.max(0, Math.min(1, ((q[0] - pts[i - 1][0]) * ab[0] + (q[1] - pts[i - 1][1]) * ab[1]) / (l * l)));
    const d = len(sub(q, add(pts[i - 1], ab, t)));
    if (d < best.d) best = { s: run + t * l, d };
    run += l;
  }
  return best.s;
}

/**
 * A shoulder line, from the collar point out, walked to a sailor collar's
 * corner on it — `SHOULDER_SHORT` short of her shoulder point, wherever the
 * line runs on past it: the line there, and the corner.
 */
function toCorner(shoulder: Pt[], point: Pt): { along: Pt[]; corner: Pt } {
  let left = Math.max(0, lengthTo(shoulder, point) - SHOULDER_SHORT);
  const along: Pt[] = [shoulder[0]];
  for (let i = 1; i < shoulder.length; i++) {
    const step = len(sub(shoulder[i], shoulder[i - 1]));
    if (step >= left) {
      along.push(lerp(shoulder[i - 1], shoulder[i], step ? left / step : 0));
      break;
    }
    left -= step;
    along.push(shoulder[i]);
  }
  return { along, corner: along[along.length - 1] };
}

/**
 * The armholes a collar keeps clear of on a bodice cut with `sleeve`, each
 * from the shoulder down to the underarm and on down the side: the seam a
 * set-in or dropped sleeve is sewn along — a dropped shoulder's lower on the
 * arm, leaving the bodice wider — or the free edge a cap or a loose sleeve
 * leaves round the arm. A raglan's seam runs up to the neck, and a collar
 * lies over it as the V's panels do; with no sleeve, or one cut in one with
 * the bodice, a set-in sleeve's.
 */
type Armholes = { left: Pt[]; right: Pt[] };
const armholeCache = new Map<string, Armholes>();
function armholesFor(sleeve?: SleeveChoice): Armholes {
  const own = sleeve && sleeve.length !== "sleeveless" && sleeve.type !== "raglan" ? sleeve : { type: "set-in" as const, length: "short" as const };
  const k = bodiceFor("round", own).sleeveCut;
  const setIn = bodiceFor("round", { type: "set-in", length: "short" }).sleeveCut!.seamed!;
  const lines: Armholes | null = k?.seamed
    ? { left: ringsOf(k.seamed.seams[0])[0], right: ringsOf(k.seamed.seams[1])[0] }
    : k?.left.armhole && k.left.armhole.length > 2
      ? /* the right side mirrored about her shoulders' centre, as the sleeves are cut */
        { left: k.left.armhole, right: k.left.armhole.map(([x, y]): Pt => [600 - x, y]) }
      : null;
  const { left, right } = lines ?? { left: ringsOf(setIn.seams[0])[0], right: ringsOf(setIn.seams[1])[0] };
  const key = `${left.map(String).join(" ")}|${right.map(String).join(" ")}`;
  let found = armholeCache.get(key);
  if (!found) {
    /* each run down from the shoulder, then the side seam below its underarm */
    const down = (pts: Pt[]) => (pts[0][1] <= pts[pts.length - 1][1] ? pts : [...pts].reverse());
    const side = ringsOf(setIn.sides)[0].filter(([, y]) => y < 340);
    const [l, r] = [down(left), down(right)];
    found = {
      left: [...l, ...side.filter(([x, y]) => x < 300 && y > l[l.length - 1][1])],
      right: [...r, ...side.filter(([x, y]) => x > 300 && y > r[r.length - 1][1]).reverse()],
    };
    armholeCache.set(key, found);
  }
  return found;
}

/** Where an armhole, run down from the shoulder, is at row `y`: above it, its top. */
function armholeAt(armhole: Pt[], y: number): number {
  if (y <= armhole[0][1]) return armhole[0][0];
  for (let i = 1; i < armhole.length; i++) {
    const [a, b] = [armhole[i - 1], armhole[i]];
    if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) return a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]);
  }
  return armhole[armhole.length - 1][0];
}

/**
 * An outer edge kept `ARMHOLE_CLEAR` inside both armholes, and inside her
 * shoulder points, which a cap's edge and a dropped shoulder's seam run on
 * past — each point drawn
 * in square to the armhole beside it, where it would reach past it — with the
 * points that land on one another dropped.
 */
function insideArmholes(pts: Pt[], centre: number, armholes: Armholes): Pt[] {
  /* and never further out than her shoulder points: over a cap or a dropped shoulder the bodice runs on onto the arm */
  const kept = pts.map(([x, y]): Pt => {
    if (x < centre) return [Math.max(x, Math.max(armholeAt(armholes.left, y), SHOULDER_POINTS.left[0]) + ARMHOLE_CLEAR), y];
    return [Math.min(x, Math.min(armholeAt(armholes.right, y), SHOULDER_POINTS.right[0]) - ARMHOLE_CLEAR), y];
  });
  return kept.filter((p, i) => i === 0 || len(sub(p, kept[i - 1])) > 0.4);
}

/**
 * A run's outer edge from its start swept from a corner on the shoulder — see
 * `SAILOR_TURN`. `outer[i]` is `inner[i]` moved square off it by the band's
 * width; up to `join` units along `inner` that is replaced by one curve: off
 * the corner square to the shoulder, into the bodice, and round into the
 * band's edge where it joins it, running on along it. So the collar leaves
 * the shoulder as the V's panels do, in one sweep, not standing out level
 * with the neck point above a shoulder that slopes away below it.
 */
function sweptFromCorner(inner: Pt[], outer: Pt[], along: Pt[], join: number): Pt[] {
  const corner = along[along.length - 1];
  let j = 1;
  for (let s = 0; j < inner.length - 1; j++) {
    s += len(sub(inner[j], inner[j - 1]));
    if (s >= join) break;
  }
  const end = outer[j];
  const towards = unit(sub(outer[Math.min(j + 1, outer.length - 1)], outer[j - 1]));
  /* square off the shoulder at the corner, into the bodice */
  const shoulder = unit(sub(corner, along[along.length - 2]));
  let off: Pt = [-shoulder[1], shoulder[0]];
  if (off[1] < 0) off = [-off[0], -off[1]];
  const reach = len(sub(end, corner)) * 0.4;
  const curve: Pt[] = [corner, add(corner, off, reach), add(end, towards, -reach), end];
  const n = Math.max(8, Math.ceil(len(sub(end, corner))));
  const swept = Array.from({ length: n }, (_, k) => cubicAt(curve, k / n));
  return [...swept, ...outer.slice(j)];
}

/** A polyline's points thinned to about one every `step` units, its ends and every corner kept — what a path is drawn through. */
function thinned(pts: Pt[], step = 2.5): Pt[] {
  /* each corner held square by the points either side of it, and each end by the one beside it — see `held` */
  const keep = new Set([0, 1, pts.length - 2, pts.length - 1, ...cornersOf(pts).flatMap((i) => [i - 1, i, i + 1])]);
  const out: Pt[] = [pts[0]];
  let since = 0;
  for (let i = 1; i < pts.length; i++) {
    since += len(sub(pts[i], pts[i - 1]));
    if (keep.has(i) || since >= step) {
      out.push(pts[i]);
      since = 0;
    }
  }
  return out;
}

/**
 * A short run — a shoulder line — with a point put in just inside each end,
 * so the curve drawn through it turns square where it meets the next run
 * rather than swinging round past the corner: see `outline` in fit.ts.
 */
function held(pts: Pt[]): Pt[] {
  if (pts.length < 2) return pts;
  const near = (a: Pt, b: Pt): Pt => lerp(a, b, Math.min(0.5, 0.6 / (len(sub(b, a)) || 1)));
  return [pts[0], near(pts[0], pts[1]), ...pts.slice(1, -1), near(pts[pts.length - 1], pts[pts.length - 2]), pts[pts.length - 1]];
}

/** The least depth of a piece in from its outer edge to its seam, along the middle of the edge: where it is narrowest. */
function leastDepth(outer: Pt[], inner: Pt[]): number {
  let least = Infinity;
  const from = Math.floor(outer.length * 0.1);
  for (let i = from; i < outer.length - from; i++) {
    let d = Infinity;
    for (const q of inner) d = Math.min(d, len(sub(q, outer[i])));
    least = Math.min(least, d);
  }
  return least;
}

/**
 * The guide `d` units in from an outer edge, as `SailorPanel.inFrom`: the
 * edge carried on 30 units past both ends, moved in square to itself to the
 * side `side` (1 its left as it runs, -1 its right), its corners mitred,
 * and cut to the piece round its middle.
 */
const inwardFrom = (outer: Pt[], ring: Pt[], side: 1 | -1) => (d: number): Pt[] => {
  const long = extend(densify(outer, 1), 30);
  const { pts, keep } = offsetRuns(long, d, side, cornersOf(long), Math.floor(long.length / 2));
  return clipTo([ring], pts, keep);
};

/**
 * A sailor collar round a round, boat or square neckline: one piece of flat
 * cloth lying on the bodice outside the opening, `SAILOR_BAND` wide square
 * off the seam — round the curve of a round or a boat, and turning each of a
 * square's corners square — and over the shoulders, its ends lying on the
 * shoulder line out to as near the shoulder point as the V's panels', where
 * it turns over to the back. Its inner edge **is** the seam, so no skin
 * shows between collar and cloth; its outer edge is free, and keeps
 * `ARMHOLE_CLEAR` inside the armholes — round the square's sides, where the
 * opening comes close to them, it follows them in.
 */
function aroundOpening(cut: keyof typeof SAILOR_WIDTH, sleeve?: SleeveChoice): SailorPiece {
  const width = SAILOR_WIDTH[cut];
  const c = bodiceFor(cut, sleeve).cut;
  const parts = c.parts!;
  /* the seam, from the left collar point round the front to the right one */
  const seam = ringsOf(c.seam)[0];
  const inner = densify(seam[0][0] > seam[seam.length - 1][0] ? [...seam].reverse() : seam, 1);
  const corners = cornersOf(inner);
  const { pts: moved } = offsetRuns(inner, width, 1, corners, Math.floor(inner.length / 2));
  const left = toCorner(parts.strapLeft, SHOULDER_POINTS.left);
  const right = toCorner([...parts.strapRight].reverse(), SHOULDER_POINTS.right);
  /* turned to each corner on the shoulder, no further along the seam than its first corner, or a third of it */
  const headRun = corners.length ? corners[0] : inner.length - 1;
  const tailRun = corners.length ? corners[corners.length - 1] : 0;
  const turn = Math.min(SAILOR_TURN, lengthOf(inner) / 3, 0.8 * lengthOf(inner.slice(0, headRun + 1)), 0.8 * lengthOf(inner.slice(tailRun)));
  /* the runs before the first corner and after the last are moved point for point, so swept in place */
  let outer = sweptFromCorner(inner, moved, left.along, turn);
  const fromEnd = (pts: Pt[]) => [...pts].reverse();
  outer = fromEnd(sweptFromCorner(fromEnd(inner), fromEnd(outer), right.along, turn));
  /* kept inside the armholes, smoothed between its corners so it follows them in without a kink, and kept inside again */
  const centre = (parts.neck[0] + parts.neckRight[0]) / 2;
  const armholes = armholesFor(sleeve);
  const kept = densify(insideArmholes(outer, centre, armholes), 1);
  outer = insideArmholes(smoothRuns(kept, 4, cornersOf(kept)), centre, armholes);
  const ring = [...left.along, ...outer.slice(1, -1), ...[...right.along].reverse(), ...[...inner].reverse().slice(1, -1)];
  const drawn = thinned(outer);
  const depth = leastDepth(outer, inner);
  return {
    path: outline(held(left.along), drawn.slice(1, -1), held([...right.along].reverse()), thinned([...inner].reverse()).slice(1, -1)),
    free: line(drawn),
    ring,
    outer,
    inFrom: inwardFrom(outer, ring, -1),
    ...(depth < width - 1 ? { room: Math.floor(depth * 10) / 10 } : {}),
  };
}

/** A run going down, as far as row `y`: its points above it, and where it crosses it. */
function downTo(pts: Pt[], y: number): Pt[] {
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]];
    if (b[1] >= y) {
      out.push(lerp(a, b, (y - a[1]) / (b[1] - a[1] || 1)));
      return out;
    }
    out.push(b);
  }
  return out;
}

/** The point on a polyline nearest `q`, by index. */
const nearestIndex = (pts: Pt[], q: Pt): number => pts.reduce((best, p, i) => (len(sub(p, q)) < len(sub(pts[best], q)) ? i : best), 0);

/** Points `width(s)` units square off a polyline to the side `side` (1 its left as it runs), `s` the length along it. */
function offsetBy(pts: Pt[], side: 1 | -1, width: (s: number) => number): Pt[] {
  let s = 0;
  return pts.map((p, i) => {
    if (i > 0) s += len(sub(p, pts[i - 1]));
    const u = unit(sub(pts[Math.min(i + 1, pts.length - 1)], pts[Math.max(i - 1, 0)]));
    return add(p, [-u[1] * side, u[0] * side], width(s));
  });
}

/** Where two polylines first cross, walking `a` from its start: the point, and the segment of each it is on. */
function firstCrossing(a: Pt[], b: Pt[]): { at: Pt; ia: number; ib: number } | null {
  for (let i = 0; i + 1 < a.length; i++) {
    for (let j = 0; j + 1 < b.length; j++) {
      const r = sub(a[i + 1], a[i]);
      const s = sub(b[j + 1], b[j]);
      const den = r[0] * s[1] - r[1] * s[0];
      if (Math.abs(den) < 1e-9) continue;
      const q = sub(b[j], a[i]);
      const t = (q[0] * s[1] - q[1] * s[0]) / den;
      const u = (q[0] * r[1] - q[1] * r[0]) / den;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return { at: add(a[i], r, t), ia: i, ib: j };
    }
  }
  return null;
}

/**
 * A sailor collar down a wrap: a band `SAILOR_BAND` wide along each edge of
 * its V, each from its corner on the shoulder, as photos 2–3 have it.
 *
 * - **The under band**, on the under panel's edge, runs down to the crossing
 *   and on under the top panel: what shows of it ends on the top panel's
 *   edge, where it goes under.
 * - **The top band** runs on along the top panel's edge past the crossing —
 *   over the under band's end — and down it to the tie, ending level where
 *   it goes into the waist seam.
 *
 * Back to front: the under band first, so the top one lies over it.
 */
function downWrap(waist: WaistId, sleeve?: SleeveChoice): SailorPiece[] {
  const c = bodiceFor("wrap", sleeve, waist).cut;
  const parts = c.parts!;
  const { over, apex } = c.wrap!;
  /*
    The seam runs from the under panel's collar point down to the crossing
    and up the top panel's edge — drawn as one curve, so at the crossing it
    hooks round from one edge into the other, and a band's edge moved out
    from it there would loop. So the top band follows the top panel's own
    edge, one line from the neck through the crossing, and the under band
    the seam down to just short of the crossing, carried on straight.
  */
  const seam = ringsOf(c.seam)[0];
  const at = nearestIndex(seam, apex);
  const under = densify(seam.slice(0, at + 1).filter((p) => len(sub(p, apex)) > WRAP_HOOK), 1);
  const below = densify(over, 1);
  const top = densify(c.wrap!.edge, 1);
  const centre = (parts.neck[0] + parts.neckRight[0]) / 2;

  /* the under band, carried on past the crossing until its outer edge meets the top panel's edge */
  const right = toCorner([...parts.strapRight].reverse(), SHOULDER_POINTS.right);
  const underLong = extend(under, 0, 1, 80);
  let underOuter = sweptFromCorner(underLong, offsetBy(underLong, -1, () => SAILOR_BAND), right.along, SAILOR_TURN);
  const meets = firstCrossing(underOuter, below)!;
  const armholes = armholesFor(sleeve);
  underOuter = insideArmholes([...underOuter.slice(0, meets.ia + 1), meets.at], centre, armholes);
  const goesUnder = [...below.slice(0, meets.ib + 1), meets.at];
  const underRing = [...right.along, ...underOuter.slice(1), ...[...goesUnder].reverse().slice(1), ...[...under].reverse().slice(1, -1)];

  /*
    The top band, along the top panel's edge the whole way down to the tie,
    as photos 2–3 have it: over the under band's end at the crossing, and on
    down the edge to where it goes into the waist seam under the skirt's top
    — ended level there, every stripe with it, as braid sewn into a seam is.
  */
  const left = toCorner(parts.strapLeft, SHOULDER_POINTS.left);
  const crossing = nearestIndex(top, apex);
  const level = skirtTopAt(waist);
  const edge = downTo(top, level);
  const topOuter = downTo(insideArmholes(sweptFromCorner(edge, offsetBy(edge, 1, () => SAILOR_BAND), left.along, SAILOR_TURN), centre, armholes), level);
  const foot: Pt[] = [topOuter[topOuter.length - 1], edge[edge.length - 1]];
  const topRing = [...left.along, ...topOuter.slice(1), ...[...edge].reverse().slice(0, -1)];
  /* its edge past the crossing lies on the under panel and the under band: free, as its outer edge is */
  const lapped = edge.slice(crossing);

  const underDrawn = thinned(underOuter);
  const topDrawn = thinned(topOuter);
  return [
    {
      path: outline(held([...right.along]), underDrawn.slice(1), thinned([...goesUnder].reverse()).slice(1), thinned([...under].reverse()).slice(1, -1)),
      free: line(underDrawn),
      ring: underRing,
      outer: underOuter,
      inFrom: inwardFrom(underOuter, underRing, 1),
      side: 1,
    },
    {
      path: outline(held(left.along), topDrawn.slice(1, -1), held(foot), thinned([...edge].reverse()).slice(1, -1)),
      free: `${line(topDrawn)} ${line(thinned(lapped))}`,
      ring: topRing,
      outer: topOuter,
      inFrom: inwardFrom(topOuter, topRing, -1),
      side: 0,
    },
  ];
}

const pieceCache = new Map<string, SailorPiece[]>();

/**
 * A sailor collar's pieces on a cut it follows other than the V, back to
 * front — see `aroundOpening` and `downWrap` — cut to the bodice as it is
 * drawn: a wrap's edge runs to its tie at its waist, and a cap sleeve, cut
 * in one with the bodice, opens a boat's and a square's neck wider at the
 * shoulders. So the same cut takes the same collar wherever its opening and
 * shoulders are the same.
 */
export function sailorOn(cut: Exclude<SailorCut, "v">, waist: WaistId = "natural", sleeve?: SleeveChoice): SailorPiece[] {
  const at = cut === "wrap" ? waist : "natural";
  const { seam, parts } = bodiceFor(cut, sleeve, at).cut;
  const holes = armholesFor(sleeve);
  const key = `${cut}|${at}|${seam}|${parts!.strapLeft.at(-1)}|${parts!.strapRight[0]}|${holes.left.length}:${holes.left[1]}:${holes.right[1]}`;
  let pieces = pieceCache.get(key);
  if (!pieces) {
    pieces = cut === "wrap" ? downWrap(at, sleeve) : [aroundOpening(cut, sleeve)];
    pieceCache.set(key, pieces);
  }
  return pieces;
}

/* ------------------------------------------------------------- the tie */

/** Where a sailor collar's tie is knotted on the V: the V's neck point, where its two panels meet — see `dressPoints`. Its ties are in `ties.ts`. */
export const TIE_AT: Pt = dressPoints({ neckline: "v" }).find((p) => p.kind === "neck")!.at;

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
export const COLLAR_CLOTH: Record<string, (cut?: NecklineId, sleeve?: SleeveChoice) => string[]> = {
  "female-peter-pan-collar-front": (cut) => {
    const { left, right } = peterPan(cut);
    return [outline(left), outline(right)];
  },
  "female-sailor-collar-front": (cut, sleeve) => {
    /* round a boat, a round neck or a square, or down a wrap, as cut to each; on the V, its panels */
    if (cut && cut !== "v" && (SAILOR_CUTS as readonly string[]).includes(cut)) return sailorOn(cut as Exclude<SailorCut, "v">, "natural", sleeve).map((p) => p.path);
    const { left, right } = sailor();
    return [left.path, right.path];
  },
  "female-bow-collar-front": (cut) => {
    const b = bow(cut);
    return [b.band, ...b.tails, ...b.loops, b.knot];
  },
};
