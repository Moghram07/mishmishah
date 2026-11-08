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
    Worn eight units below his own waist, which the photograph puts at y 383.
    This was a typed y 362 — hers, to the unit — and it put the band
    twenty-odd units up his stomach, which is the "floating on the torso" the
    figure showed.
  */
  rise: 8,
  band: 34,
  hemY: HEM_Y,
  /*
    His numbers, and deliberately not hers — see the note on the female draft.
    A man's trouser is the opposite shape to a woman's: cut fuller through the
    thigh and **straight** from knee to hem, so the cuff is the widest part of
    the leg rather than the narrowest. Five at the waist, six at the thigh,
    seven at the ankle.
  */
  ease: 5,
  legEase: 6,
  cuffEase: 7,
  innerEase: 4,
  /*
    A man's fly closes left over right, so its J is on his left — the
    canvas's right — three and a half centimetres in and eighteen down; and
    his slanted pockets reach the side seam sixteen centimetres below the band.
  */
  fly: { length: 18, width: 3.5, on: "left" },
  pocket: 16,
};

/** The leg they arrive in. Kept in step with their record by a test. */
export const DEFAULT_LEG: LegId = "straight";

const OWN = trousers("male", SPEC);
const cuts = new Map<string, Legs>();

/**
 * The trousers in a leg, on their own or under a jacket — drawn in under its
 * hem where they are wider than it, and out again to their own hem: see
 * `tucked`. Each cut once, kept.
 */
export function legsFor(inside?: Tuck, leg: LegId = DEFAULT_LEG): Legs {
  if (!inside && leg === DEFAULT_LEG) return OWN;
  const key = `${leg}|${inside ? `${inside.y}|${inside.x}` : ""}`;
  if (!cuts.has(key)) cuts.set(key, trousers("male", { ...legCut(SPEC, leg), ...(inside ? { inside } : {}) }));
  return cuts.get(key)!;
}

/**
 * The row a leg's inseam starts to come in to meet the other's — a palazzo's,
 * `PALAZZO_MEET` of the way from the crotch to the knee — or `undefined`
 * for a leg that keeps its daylight to the hem. For `check:garments`.
 */
export const meetsFrom = (leg: LegId): number | undefined => {
  if (!legsMeet(leg)) return undefined;
  const crotch = draft("male").crotchY;
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
