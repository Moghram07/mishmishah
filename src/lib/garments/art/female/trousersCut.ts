/*
  Plain `.ts`, relative and extensioned, and no JSX — so `scripts/
  preview-garments.mjs` imports the trousers the app draws, in whatever leg
  they are cut. It used to read constants out of `trousers.tsx`, which can
  hold one pair and no more. See `dressCut.ts` for why the checker must see
  the real geometry.
*/
import { PALAZZO_MEET, draft, trousers, type Legs, type LegsSpec, type Tuck } from "../../fit.ts";
import { legCut, legsMeet } from "../../legs.ts";
import type { LegId } from "@/types";
import type { GarmentChoice } from "../index.ts";

export const HEM_Y = 902;

/** How they are cut: the same numbers worn on their own and under a jacket. */
export const SPEC: LegsSpec = {
  /*
    Worn twelve units below her waist — a mid rise, sitting just over the
    navel. Relative to the waist she was measured to have, so it moves with
    the body rather than with a typed row.
  */
  rise: 12,
  band: 34,
  hemY: HEM_Y,
  /*
    Her numbers, not a shared set. These were 9/11/9/5 on both bodies, which is
    the generic silhouette in plain sight — and 11 through the thigh, on top of
    the taut outer edge's own bridging, is what stood the cloth 18 units off her
    knee and made a trouser read as a wide shape placed around a leg.

    A woman's trouser is cut close over the seat and **tapers**: five at the
    hip, five through the thigh, four at the ankle. The inner edge comes in a
    unit, which widens the daylight between the legs rather than narrowing it.
  */
  ease: 5,
  legEase: 5,
  cuffEase: 4,
  innerEase: 4,
  /*
    A woman's fly closes right over left, so its J is on her right — the
    canvas's left — three centimetres in and fifteen down; and her slanted
    pockets reach the side seam fourteen centimetres below the band.
  */
  fly: { length: 15, width: 3, on: "right" },
  pocket: 14,
};

/** The leg they arrive in. Kept in step with their record by a test. */
export const DEFAULT_LEG: LegId = "straight";

const OWN = trousers("female", SPEC);
const cuts = new Map<string, Legs>();

/**
 * The trousers in a leg, on their own or under a jacket — drawn in under its
 * hem where they are wider than it, and out again to their own hem: see
 * `tucked`. Each cut once, kept.
 */
export function legsFor(inside?: Tuck, leg: LegId = DEFAULT_LEG): Legs {
  if (!inside && leg === DEFAULT_LEG) return OWN;
  const key = `${leg}|${inside ? `${inside.y}|${inside.x}` : ""}`;
  if (!cuts.has(key)) cuts.set(key, trousers("female", { ...legCut(SPEC, leg), ...(inside ? { inside } : {}) }));
  return cuts.get(key)!;
}

/**
 * The row a leg's inseam starts to come in to meet the other's — a palazzo's,
 * `PALAZZO_MEET` of the way from the crotch to the knee — or `undefined`
 * for a leg that keeps its daylight to the hem. For `check:garments`.
 */
export const meetsFrom = (leg: LegId): number | undefined => {
  if (!legsMeet(leg)) return undefined;
  const crotch = draft("female").crotchY;
  return crotch + PALAZZO_MEET * ((crotch + HEM_Y) / 2 - crotch);
};

/**
 * Every piece of cloth the trousers are, for one choice: the two legs. The
 * waistband is cut from their own edge, inside them. What `check:garments`
 * rasterises.
 */
export const cloth = ({ inside, leg }: GarmentChoice = {}): string[] => {
  const L = legsFor(inside, leg);
  return [L.left, L.right];
};
