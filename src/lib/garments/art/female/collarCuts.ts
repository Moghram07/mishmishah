/*
  Plain `.ts`, relative and extensioned, and no JSX — so `scripts/
  preview-garments.mjs` can import it and measure the same collars the app
  draws, on every cut they are sewn to. See `dressCut.ts` for why.

  The collars here are the ones that lie along the cut they are sewn to,
  rather than standing at the base of the neck whatever the cut: a flat collar
  follows its garment's own neckline, and a sailor collar is sewn down a V.
*/
import { flatCollar, outline, run, type Neckline, type Pt } from "../../fit.ts";
import { blade, mirror, nudge, seam, type Point } from "../../collar.ts";
import type { NecklineId } from "../../necklines.ts";
import { bodiceFor } from "./dressCut.ts";
import { COLLAR_AXIS, opening, standFront } from "./yoke.ts";

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
 * The sailor's panel as it is cut for a high neckline, where its panels part
 * in a V over the garment's own cloth: from the collar point, out across the
 * shoulder, down the outer edge, in to the point at mid-chest, and straight
 * back up the V. Reflected about her own axis — her neck is three units left
 * of the canvas centre — so the two land on the two collar points.
 */
export const SAILOR_PANEL: Point[] = [opening(10).left, [224, 214], [238, 260], [COLLAR_AXIS(290), 290]];
/** How each edge bows, positive to the left of travel: the outside carries the cloth's weight; the V is cut straight. */
export const SAILOR_BOWS = [3, 5, 4, 0];

/**
 * How far above the V's point the panel's lower outer corner sits, on a V:
 * the front of the panel tapering in to the point, as the panel cut for a
 * high neckline does to its own.
 */
const SAILOR_TAPER = 14;

/**
 * A sailor collar sewn down a V — the neckline it belongs on. Each panel's
 * inner edge **is** the V's edge, from the collar point down to the V's
 * point, where the two panels meet; out across the shoulder it keeps its own
 * width, and its outer edge comes in to that point. The right panel is the
 * left reflected about the V's own axis. `null` for a cut that is not a V.
 */
export function sailorOnV(cut?: NecklineId): { left: string; right: string; free: string; axis: number } | null {
  const vee = cut ? bodiceFor(cut).cut.vee : undefined;
  if (!vee) return null;
  const { apex, left } = vee;
  const corner = left[left.length - 1];
  const [, shoulder, lowerDefault] = SAILOR_PANEL;
  const lower: Point = [lowerDefault[0], apex[1] - SAILOR_TAPER];
  /* out and round, as the high-neck panel's edges bow; then up the V's own edge, which is a seam */
  const outer = seam([corner, shoulder, lower, apex], SAILOR_BOWS);
  const panel = `${outer} ${run(left)} Z`;
  return { left: panel, right: mirror(panel, apex[0]), free: outer, axis: apex[0] };
}

/**
 * A sailor collar's two panels on whatever it is sewn to, and its free edge
 * (the left panel's): down a V on a V, and parting in a V over a high
 * neckline everywhere else — every edge of it then free but the few units at
 * the neck point.
 */
export function sailor(cut?: NecklineId): { left: string; right: string; free: string; axis?: number } {
  const v = sailorOnV(cut);
  if (v) return v;
  const left = blade(SAILOR_PANEL, SAILOR_BOWS);
  return { left, right: mirror(left, COLLAR_AXIS), free: seam([...SAILOR_PANEL, SAILOR_PANEL[0]], SAILOR_BOWS) };
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
  "female-sailor-collar-front": (cut) => {
    const { left, right } = sailor(cut);
    return [left, right];
  },
  "female-bow-collar-front": (cut) => {
    const b = bow(cut);
    return [b.band, ...b.tails, ...b.loops, b.knot];
  },
};
