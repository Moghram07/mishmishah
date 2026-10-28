/*
  Plain `.ts`, relative and extensioned, and no JSX — so `scripts/
  preview-garments.mjs` imports it and checks the skirts the app draws. See
  `art/female/dressCut.ts` for why that matters.
*/
import { column, type Tuck } from "./fit.ts";
import type { SkirtChoice, SkirtLengthId } from "@/types";

/**
 * A skirt — the skirt garment's, or a dress's below its waist seam — is cut
 * from shared parts: a shape and a length. What stays each garment's own is how
 * it finishes its skirt: where the top edge sits, whether it has a band, how
 * its hem falls. A dress's skirt is sewn under its bodice; a skirt sits on its
 * own waistband.
 */
export interface SkirtFinish {
  /** How far below the body's own waist its top edge sits; negative is above. */
  rise: number;
  /** Its ease at the waist, held down to the hip. */
  ease: number;
  /** How far it flares by its hem. */
  flare: number;
  /** How far its hem drops at centre front, where it turns toward you. */
  dip: number;
  /** A waistband this deep, cut from the skirt's own edge. */
  band?: number;
  /** A hem that waves where the folds reach it — see `column`. */
  wave?: { at: number[]; depth: number };
  /** Its hem's row at each length it comes in. */
  hemAt: Partial<Record<SkirtLengthId, number>>;
}

/** A skirt as cut: its outline, its band, and where it starts and ends. */
export type CutSkirt = ReturnType<typeof column>;

/** One key per style, for the caches that keep each cut once. */
export const skirtKey = (skirt: SkirtChoice): string =>
  `${skirt.shape}|${skirt.length}|${skirt.waist ?? "natural"}`;

export const sameSkirt = (a: SkirtChoice, b: SkirtChoice): boolean => skirtKey(a) === skirtKey(b);

/** One skirt, cut to a style: on its own, or under a jacket's hem — see `tucked`. */
export function skirtCut(finish: SkirtFinish, skirt: SkirtChoice, inside?: Tuck): CutSkirt {
  const toY = finish.hemAt[skirt.length];
  if (toY === undefined) throw new Error(`This skirt is not cut ${skirt.length}`);
  return column("female", {
    rise: finish.rise,
    toY,
    ease: finish.ease,
    flare: finish.flare,
    dip: finish.dip,
    ...(finish.band ? { band: finish.band } : {}),
    ...(finish.wave ? { wave: finish.wave } : {}),
    ...(inside ? { inside } : {}),
  });
}
