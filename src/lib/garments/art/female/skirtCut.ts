/*
  Plain `.ts`, relative and extensioned, and no JSX — so `scripts/
  preview-garments.mjs` imports the skirt the app draws, in whatever style it
  is cut. It used to read constants out of `skirt.tsx`, which can hold one
  skirt and no more. See `dressCut.ts` for why the checker must see the real
  geometry.
*/
import { draft, foldPlaces, type Tuck } from "../../fit.ts";
import { sameSkirt, skirtCut, skirtKey, type CutSkirt, type SkirtFinish } from "../../skirts.ts";
import type { SkirtChoice } from "@/types";
import type { GarmentChoice } from "../index.ts";

/**
 * Where its folds fall across it — seven, from the hip — and so where its hem
 * waves: a little lower wherever a fold reaches it, never higher.
 */
export const FOLD_AT = foldPlaces(7, 31);

/** How the skirt finishes itself — see `skirts.ts`: the same worn on its own and under a jacket. */
export const FINISH: SkirtFinish = {
  /*
    Ten units below her measured waist, with a band cut from its own edge:
    18 units, about 3.4 cm, a standard skirt band. It was 34 — six and a half
    centimetres, a corset belt rather than a waistband.
  */
  rise: 10,
  band: 18,
  ease: 4,
  dip: 18,
  wave: { at: FOLD_AT, depth: 2.2 },
};

/** The skirt it arrives as. Kept in step with its record by a test. */
export const DEFAULT_SKIRT: SkirtChoice = { shape: "flared", length: "midi" };

export const HIP_Y = draft("female").hipY;

const SKIRT = skirtCut(FINISH, DEFAULT_SKIRT);
const skirts = new Map<string, CutSkirt>();

/**
 * The skirt in a style, on its own, under a jacket's hem, or under a top's —
 * see `tucked`. Each cut once, kept. Under a top it is no wider than, it is
 * the very skirt it is on its own: a top changes only what would show past it.
 */
export function skirtFor(inside?: Tuck, skirt: SkirtChoice = DEFAULT_SKIRT, underTop?: Tuck): CutSkirt {
  if (!inside && underTop) {
    const own = skirtFor(undefined, skirt);
    const key = `${skirtKey(skirt)}|top|${JSON.stringify([underTop.y, underTop.x, underTop.side])}`;
    if (!skirts.has(key)) {
      const sk = skirtCut(FINISH, skirt, underTop);
      skirts.set(key, sk.path === own.path ? own : sk);
    }
    return skirts.get(key)!;
  }
  if (!inside && sameSkirt(skirt, DEFAULT_SKIRT)) return SKIRT;
  const key = `${skirtKey(skirt)}|${inside ? `${inside.y}|${inside.x}` : ""}`;
  if (!skirts.has(key)) skirts.set(key, skirtCut(FINISH, skirt, inside));
  return skirts.get(key)!;
}

/**
 * Every piece of cloth the skirt is, for one choice: the skirt and its band —
 * or, under a jacket, the skirt alone, its band hidden under the jacket.
 * What `check:garments` rasterises.
 */
export const cloth = ({ inside, skirt, underTop }: GarmentChoice = {}): string[] => {
  const sk = skirtFor(inside, skirt, underTop);
  return inside ? [sk.path] : [sk.path, sk.band];
};
