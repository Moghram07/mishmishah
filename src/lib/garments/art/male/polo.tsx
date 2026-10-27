import { blade, type Point } from "@/lib/garments/collar";
import { PLACKET_BOWS, placketArt } from "../placket";
import { clothOf, top } from "@/lib/garments/sleeves";
import type { SleeveChoice } from "@/types";
import {
  BAND_FOOT,
  HIGH_NECKLINE,
  NECK_LEFT,
  NECK_RIGHT,
  SHOULDER_EASE,
  opening,
  TIP_LEFT,
} from "./yoke";
import type { GarmentArt } from "../index";
import { draft, type Tuck } from "@/lib/garments/fit";
import { knitFolds } from "@/lib/garments/folds";
import { sleevedTop } from "../sleevedTop";
import { litButtons } from "../buttons";

/**
 * Polo shirt, male front: the t-shirt's body and sleeves, and a short placket.
 *
 * The soft knit collar that used to be drawn here is a record and a drawing of
 * its own now — see the note in `male/shirt.tsx`, which this had the same
 * version of, including the transparent hole where the placket crossed the
 * band under `fillRule="evenodd"`.
 */

/** Body and sleeves, drafted against his photograph — see `garments/sleeves.ts`. */
const DRAFT = top("male", {
  tip: [TIP_LEFT[0], TIP_LEFT[1]],
  neck: [NECK_LEFT[0], NECK_LEFT[1]],
  neckRight: [NECK_RIGHT[0], NECK_RIGHT[1]],
  shoulderEase: SHOULDER_EASE,
  ease: 4,
  hemY: 488,
  dip: 10,
  sleeve: [4, 5],
  inner: [2, 4],
  /* a short sleeve ends in a rib armband, about 2.5 cm deep */
  finish: { armband: 13 },
});

export const DEFAULT_SLEEVE: SleeveChoice = { type: "set-in", length: "short", cuff: "rib" };

/**
 * The opening, cut round the front of the throat where the throat actually
 * is. `dip` is the whole of what makes it this garment's neckline rather
 * than another's — see `opening` in the yoke.
 */
const NECK = opening(30);
const NECKLINE = NECK.front;

/** The seam a collar is sewn to, as an open line — see `check:garments`. */
export const NECK_SEAM = `M${NECK_RIGHT[0]} ${NECK_RIGHT[1]} ${NECKLINE}`;
export const NECK_SEAM_HIGH = `M${NECK_RIGHT[0]} ${NECK_RIGHT[1]} ${HIGH_NECKLINE}`;

/** Every piece of body cloth, for one sleeve and one opening — what the checker draws. */
export const CLOTH = (sleeve: SleeveChoice, high: boolean, inside?: Tuck) =>
  clothOf(DRAFT, high ? HIGH_NECKLINE : NECKLINE, sleeve, inside);

/** The short placket a polo fastens with — three buttons and no further. */
const PLACKET: Point[] = [
  [288, 208],
  [312, 208],
  [312, 296],
  [288, 296],
];
const PLACKET_HIGH: Point[] = [
  [288, 188],
  [312, 188],
  [312, 296],
  [288, 296],
];

const PLACKET_PATH = blade(PLACKET, PLACKET_BOWS);
const PLACKET_HIGH_PATH = blade(PLACKET_HIGH, PLACKET_BOWS);

/*
  Knit, so it folds very little: a drag line or two from each underarm toward
  the chest, soft folds at the sides of the waist — see `knitFolds`.
*/
const WAIST_Y = draft("male").waistY;

const TOP = sleevedTop({
  draft: DRAFT,
  openings: { own: NECKLINE, high: HIGH_NECKLINE },
  defaultSleeve: DEFAULT_SLEEVE,
  focus: [300, 320],
  folds: (k) => ({
    body: knitFolds({
      underarm: k.left.side[0],
      side: k.left.side,
      waistY: WAIST_Y,
      hem: k.left.side[k.left.side.length - 1],
      hemDip: 10,
      seed: 13,
    }),
  }),
});

export const malePoloFront: GarmentArt = {
  /** Buttons closing a collar's band, where it shows between the leaves. */
  collarButtons: 1,
  regions: {
    body: TOP.region({}),
    placket: placketArt(PLACKET_PATH, PLACKET),
  },
  variants: {
    high: {
      body: TOP.region({ opening: "high" }),
      placket: placketArt(PLACKET_HIGH_PATH, PLACKET_HIGH),
    },
  },
  cut: (choice) => ({ body: TOP.region(choice) }),
  armCover: (choice) => TOP.armCover(choice),
  cuffTrim: (choice) => TOP.cuffTrim(choice),
  trim: litButtons([[300, 240], [300, 272]], 5),
  /*
    Under a band collar the placket shows from the band down, so its buttons
    do too: the first just under the band and three evenly to the same last
    one. With two, the first sat 10 cm under the band — the gap — and two
    spread over the whole placket would be 15 cm apart.
  */
  bandTrim: litButtons([0, 1, 2].map((i) => [300, BAND_FOOT + 8 + ((272 - BAND_FOOT - 8) * i) / 2] as const), 5),
};
