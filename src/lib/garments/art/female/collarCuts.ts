/*
  Plain `.ts`, relative and extensioned, and no JSX — so `scripts/
  preview-garments.mjs` can import it and measure the same collars the app
  draws, on every cut they are sewn to. See `dressCut.ts` for why.

  The collars here are the ones that lie along the cut they are sewn to,
  rather than standing at the base of the neck whatever the cut: a flat collar
  follows its garment's own neckline, and a sailor collar is sewn down a V.
*/
import { flatCollar, outline, run, type Neckline, type Pt } from "../../fit.ts";
import { blade, mirror, seam, type Point } from "../../collar.ts";
import type { NecklineId } from "../../necklines.ts";
import { bodiceFor } from "./dressCut.ts";
import { COLLAR_AXIS, opening } from "./yoke.ts";

/* ------------------------------------------------------------- Peter Pan */

/**
 * The crew opening, the shallowest of the round ones: what a Peter Pan is
 * sewn to on a top, which keeps its own neckline. Cut to the shallowest, it
 * covers the seam of every top it is offered on — the blouse's dips four units
 * lower, inside the collar's cloth.
 */
const CREW = opening(34);

/**
 * The cloth, from centre front out to the collar point. Widest
 * three-quarters of the way out, which is where a Peter Pan's lobe sits —
 * over the collarbone, not under the chin. The collar keeps it on every cut;
 * only the line it lies along changes.
 */
export const PETER_PAN_WIDTHS = [34, 34, 30, 18, 12];

/** The neckline a Peter Pan lies along: the dress's own cut, or a top's crew neck. */
const roundOpening = (cut?: NecklineId): Neckline => (cut ? bodiceFor(cut).cut.neck : undefined) ?? CREW;

/**
 * A Peter Pan's two halves, cut from the opening it is sewn to — see
 * `flatCollar`: its inner edge **is** the seam, so on a scoop it lies along
 * the scoop's low line and on a boat along its wide, shallow one, out toward
 * the shoulders, with no skin between collar and cloth. It used to be cut to
 * the crew neck whatever the cut, and on the scoop sat up on the neck above
 * the opening, and on the boat floated inside it.
 */
export function peterPan(cut?: NecklineId): { left: Pt[]; right: Pt[]; free: [Pt[], Pt[]] } {
  const { left, right } = flatCollar(roundOpening(cut), { width: PETER_PAN_WIDTHS });
  /*
    The free edges: the outer run of each half only, from centre front round
    to the collar point — `flatCollar` returns each half as its inner edge and
    then its outer edge reversed. Never the neckline, which is a seam.
  */
  const outer = (half: Pt[]) => half.slice(Math.ceil(half.length / 2));
  const free: [Pt[], Pt[]] = [outer(left), outer(right)];
  if (!cut) return { left, right, free };
  /*
    Each collar point held square, so the outline turns there as the seam
    does. Smoothed round the corner, the collar's inner edge swung half a unit
    into the opening beside a scoop's steep end, where the seam runs almost
    straight down: cloth over the opening, which a flat collar never is.
  */
  const near = (from: Pt, to: Pt): Pt => {
    const d = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
    return [from[0] + ((to[0] - from[0]) * CORNER_HOLD) / d, from[1] + ((to[1] - from[1]) * CORNER_HOLD) / d];
  };
  /* the right half starts at its collar point; the left half reaches its own halfway along */
  const lc = Math.ceil(left.length / 2) - 1;
  return {
    right: [...right, near(right[0], right[right.length - 1])],
    left: [...left.slice(0, lc + 1), near(left[lc], left[lc + 1]), ...left.slice(lc + 1)],
    free,
  };
}
/** How close beside a collar point the outline is held square: a fraction of a unit. */
const CORNER_HOLD = 0.5;

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
};
