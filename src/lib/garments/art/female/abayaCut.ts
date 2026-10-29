/*
  Plain `.ts`, relative and extensioned, and no JSX — so `scripts/
  preview-garments.mjs` imports the abaya the app draws, and holds every
  garment under it to what the abaya actually encloses. See `dressCut.ts`
  for why the checker must see the real geometry.
*/
import { BODY_CANVAS, FEMALE_ANCHORS } from "../../../mannequin/bodies.ts";
import { openRobe } from "../../sleeves.ts";
import type { SleeveChoice } from "@/types";
import type { GarmentChoice } from "../index.ts";
import { OUTER_NECK_LEFT, OUTER_NECK_RIGHT, OUTER_TIP_LEFT } from "./yoke.ts";

const CM = 1 / BODY_CANVAS.cmPerUnit;

/**
 * Her abaya: a loose robe open down the front, worn over whatever she wears,
 * from her shoulders to her ankles — see `openRobe`.
 *
 * - **Its shoulders** are outerwear's: three units of ease more than a top's,
 *   over the top underneath, and soft — walked along her, not padded.
 * - **Its body** is eight units off her, room for the clothes under it, and
 *   falls straight from where it leaves her under the arm, 12 units out in
 *   every 100 down: loose over her waist and hips, and wide enough at the
 *   ankle to hang over a skirt.
 * - **Its hem** just covers her ankle bone, y 906.
 * - **Its sleeve** is the regular long sleeve, following her arm with four
 *   units of room over a sleeve under it, in front of the robe's own side.
 *   It ends where a long sleeve does, so one worn under it does not show.
 * - **Its fronts** almost meet under the neck, 5 cm apart, and fall a little
 *   apart as they hang: 15 cm at the hem.
 */
export const ABAYA = {
  hemY: FEMALE_ANCHORS.ankleY,
  ease: 8,
  slope: 0.12,
  neckDip: 20,
  gap: [5 * CM, 15 * CM] as const,
};

/** The sleeve it is cut with. */
export const SLEEVE: SleeveChoice = { type: "set-in", length: "long" };

export const ROBE = openRobe("female", {
  tip: [OUTER_TIP_LEFT[0], OUTER_TIP_LEFT[1]],
  neck: [OUTER_NECK_LEFT[0], OUTER_NECK_LEFT[1]],
  neckRight: [OUTER_NECK_RIGHT[0], OUTER_NECK_RIGHT[1]],
  shoulderEase: 6,
  ease: ABAYA.ease,
  hemY: ABAYA.hemY,
  dip: 12,
  straight: ABAYA.slope,
  sleeve: [6, 8],
  inner: [3, 4],
  finish: { over: 4, front: true },
  neckDip: ABAYA.neckDip,
  gap: ABAYA.gap,
});

/** Every piece of cloth it is — what `check:garments` rasterises. */
export const cloth = (_choice: GarmentChoice = {}): string[] => [ROBE.right, ROBE.left, ROBE.sleeveLeft, ROBE.sleeveRight];

/** Its fronts alone, without the sleeves: the body the stand-off is read off. */
export const BODY = [ROBE.right, ROBE.left];

/** Its sleeves alone, left then right: what is measured for hanging as a tube. */
export const SLEEVES = [ROBE.sleeveLeft, ROBE.sleeveRight];

/** What it holds inside it — see `Encloses`. */
export const encloses = ROBE.encloses;

/**
 * Where it falls clear of her, for `check:garments`: straight from where its
 * body leaves her under the arm, at its slope — and wide enough that its
 * sleeve hangs in front of it, as a sleeve does in front of an A-line.
 */
export const FALLS = { from: ROBE.underarm, slope: ABAYA.slope, front: true };
