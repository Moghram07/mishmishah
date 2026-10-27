import { draft, necklineShadow, necklineStitch, type Tuck } from "@/lib/garments/fit";
import { clothOf, top } from "@/lib/garments/sleeves";
import type { SleeveChoice } from "@/types";
import { NECK_LEFT, NECK_RIGHT, SHOULDER_EASE, opening, TIP_LEFT } from "./yoke";
import type { GarmentArt } from "../index";
import { knitFolds } from "@/lib/garments/folds";
import { sleevedTop } from "../sleevedTop";

/**
 * T-shirt, male front. Cut straight from the chest — his waist is 14 units
 * wider than hers, so the side seam that would skim her hangs off him and the
 * one that fits him would swamp her. That is the whole reason the two
 * wardrobes are drawn separately.
 *
 * His armpit is at y 271, twenty-five units lower than hers, and his sleeve
 * used to be the quadrilateral `M194 220 L176 332 L240 342 L214 292 Z` — four
 * straight lines, an underarm guessed at 292, and a lower edge running clean
 * across the daylight between his arm and his ribs to land *inside* his chest.
 * Both edges are measured now, the sleeve is set in at his own shoulder point,
 * and it is cut to any of the sleeves offered to him.
 */

const DRAFT = top("male", {
  tip: [TIP_LEFT[0], TIP_LEFT[1]],
  neck: [NECK_LEFT[0], NECK_LEFT[1]],
  neckRight: [NECK_RIGHT[0], NECK_RIGHT[1]],
  shoulderEase: SHOULDER_EASE,
  ease: 4,
  /*
    Mid-fly, where a t-shirt worn untucked should end: halfway between his
    waistband and his crotch. At y 500 it reached the bottom of the fly.
  */
  hemY: 452,
  dip: 8,
  sleeve: [4, 5],
  inner: [2, 4],
});

export const DEFAULT_SLEEVE: SleeveChoice = { type: "set-in", length: "short" };

const NECK = opening(32);
const NECKLINE = NECK.front;

/** Every piece of cloth, for one sleeve — what the checker draws. */
export const CLOTH = (sleeve: SleeveChoice, high: boolean, inside?: Tuck) =>
  clothOf(DRAFT, NECKLINE, sleeve, inside);

const NECK_SHADOW_PATH = necklineShadow(NECK);

/*
  Knit, so it folds very little: a drag line or two from each underarm toward
  the chest, soft folds at the sides of the waist — see `knitFolds`.
*/
const WAIST_Y = draft("male").waistY;

const TOP = sleevedTop({
  draft: DRAFT,
  openings: { own: NECKLINE },
  defaultSleeve: DEFAULT_SLEEVE,
  focus: [300, 330],
  folds: (k) => ({
    body: knitFolds({
      underarm: k.left.side[0],
      side: k.left.side,
      waistY: WAIST_Y,
      hem: k.left.side[k.left.side.length - 1],
      hemDip: 8,
      seed: 11,
    }),
  }),
  own: {
    shading: () => <path d={NECK_SHADOW_PATH} fill="#c9c9c9" opacity="0.5" />,
    stitch: necklineStitch(NECK),
  },
});

export const maleTShirtFront: GarmentArt = {
  regions: { body: TOP.region({}) },
  cut: (choice) => ({ body: TOP.region(choice) }),
  armCover: (choice) => TOP.armCover(choice),
  cuffTrim: (choice) => TOP.cuffTrim(choice),
};
