/*
  Plain `.ts`, relative and extensioned, and no JSX — so `scripts/
  preview-garments.mjs` imports it and checks the trousers the app draws. See
  `art/female/dressCut.ts` for why that matters.
*/
import type { LegsSpec } from "./fit.ts";
import type { LegId } from "@/types";

/**
 * How each leg is cut — see `hungLeg` in `fit.ts`. A pair of trousers keeps
 * its own rise, band, ease, fly and pockets; a leg changes only how it falls
 * below the crotch, and never brings the legs closer together but by design:
 * a wide or a flared leg's inseam stays where a straight leg's is, a slim
 * leg's comes in toward her ankle, away from the other leg — and a palazzo's
 * meets the other's below the knee.
 *
 * - **Straight** is the trousers as they have always been: hung from the
 *   thigh, nearly straight from the knee.
 * - **Slim** is straight to the knee and comes in from there on straight
 *   lines to the ankle, 5 units — a centimetre — off it at the hem.
 * - **Wide** is as wide all the way down as it is at the top of the thigh,
 *   where it leaves her hip, and 10 in every 100 wider at the hem.
 * - **Palazzo** is wider still, 30 in every 100 wider at the hem than at the
 *   thigh, and so full that the legs meet below the knee and hang side by
 *   side, a centre seam between them: hers only.
 * - **Flare** is straight to the knee and opens from there, its hem 60 in
 *   every 100 wider than the knee: hers only.
 */
const LEGS: Record<LegId, NonNullable<LegsSpec["leg"]> | null> = {
  straight: null,
  slim: { slim: 5 },
  wide: { wide: 0.1 },
  palazzo: { palazzo: 0.3 },
  flare: { flare: 0.6 },
};

/** The legs, in the order the picker offers them. */
export const LEG_SHAPES: readonly LegId[] = ["straight", "slim", "wide", "palazzo", "flare"];

/** How much wider than at the top of the thigh a leg is at its hem, as a share — a wide leg's or a palazzo's — or `undefined`: for `check:garments`, which reads such a leg from the line it falls on. */
export const legWiden = (leg: LegId): number | undefined => LEGS[leg]?.wide ?? LEGS[leg]?.palazzo;

/** Whether a leg's inseam meets the other leg's below the knee — a palazzo's — see `palazzoInseam` in `fit.ts`. */
export const legsMeet = (leg: LegId): boolean => LEGS[leg]?.palazzo !== undefined;

/** A pair of trousers' cut, in a leg: straight is the cut as it is. */
export const legCut = (spec: LegsSpec, leg: LegId = "straight"): LegsSpec => {
  const cut = LEGS[leg];
  return cut ? { ...spec, leg: cut } : spec;
};

