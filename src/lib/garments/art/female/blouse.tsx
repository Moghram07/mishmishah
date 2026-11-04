import { draft, type Pt, type Tuck } from "@/lib/garments/fit";
import { blade, type Point } from "@/lib/garments/collar";
import { PLACKET_BOWS, placketArt } from "../placket";
import { clothOf, coverOf, top } from "@/lib/garments/sleeves";
import type { SleeveChoice } from "@/types";
import {
  COLLAR_AXIS,
  HIGH_DIP,
  HIGH_NECKLINE,
  NECK_LEFT,
  NECK_RIGHT,
  SHOULDER_EASE,
  opening,
  TIP_LEFT,
  BUST,
} from "./yoke";
import type { GarmentArt } from "../index";
import { wovenFolds } from "@/lib/garments/folds";
import { sleevedTop } from "../sleevedTop";
import { litButtons } from "../buttons";

/**
 * Blouse, front — long-sleeved as it arrives, and cut to any sleeve.
 *
 * It used to draw its own shirt collar and cut a deep V to hang it from. Both
 * moved: the collar is a record in `data/collars.ts` that this arrives wearing,
 * and the neckline is cut round so that *any* of the nine can be sewn to it.
 * The V is not gone — it comes back with the collar that has one, which is the
 * whole point of making a collar a part rather than a style.
 *
 * Fitted, unlike the t-shirt: its side seam takes her waist instead of bridging
 * it. That is the one line of difference between the two cuts, and it is the
 * difference between a blouse and a tee.
 *
 * A shirttail at the hip: the side seams end at y 440 and the front falls 30
 * units below them, to y 470, just past her hip. It hung to y 504 — past her
 * crotch, and below her jacket's hem, so it showed under the jacket. Rounded up
 * at the sides, the hem stays clear of the long sleeve's cuff at her wrist
 * instead of merging with it into one line across the figure.
 *
 * It buttons down the front on a placket — the same piece his shirt has, cut
 * narrower — where it used to have a single line for a centre front.
 */
const HEM_Y = 440;
const TAIL = 30;

const TIP: Pt = [TIP_LEFT[0], TIP_LEFT[1]];

const DRAFT = top("female", {
  tip: TIP,
  neck: [NECK_LEFT[0], NECK_LEFT[1]],
  neckRight: [NECK_RIGHT[0], NECK_RIGHT[1]],
  shoulderEase: SHOULDER_EASE,
  ease: 4,
  hemY: HEM_Y,
  tail: TAIL,
  fitted: true,
  sleeve: [4, 4],
  inner: [3, 3],
});

export const DEFAULT_SLEEVE: SleeveChoice = { type: "set-in", length: "long", cuff: "formal" };

const NECK = opening(38);
const NECKLINE = NECK.front;

/** The seam a collar is sewn into. See `tShirt.tsx` for why it is named. */
export const NECK_SEAM = `M${NECK_RIGHT[0]} ${NECK_RIGHT[1]} ${NECKLINE}`;
export const NECK_SEAM_HIGH = `M${NECK_RIGHT[0]} ${NECK_RIGHT[1]} ${HIGH_NECKLINE}`;

/** Every piece of cloth, for one sleeve and one opening — what the checker draws. */
export const CLOTH = (sleeve: SleeveChoice, high: boolean, inside?: Tuck) =>
  clothOf(DRAFT, high ? HIGH_NECKLINE : NECKLINE, sleeve, inside);

/** What it lets a skirt worn under it show, for one sleeve — what the checker asks; see `coverOf`. */
export const COVER = (sleeve: SleeveChoice) => coverOf(DRAFT, NECKLINE, sleeve);

/**
 * The placket, from the neckline to the hem. It follows the collar's axis —
 * her neck is three units left of the trunk, and the collar points meet over
 * it — so its top lines up under the collar and its foot is on the centre line.
 */
const PLACKET_HALF = 11;
const placket = (top: number): Point[] => {
  const bottom = HEM_Y + TAIL - 3;
  return [
    [COLLAR_AXIS(top) - PLACKET_HALF, top],
    [COLLAR_AXIS(top) + PLACKET_HALF, top],
    [COLLAR_AXIS(bottom) + PLACKET_HALF, bottom],
    [COLLAR_AXIS(bottom) - PLACKET_HALF, bottom],
  ];
};
const PLACKET = placket(NECK.seamY + NECK.dip);
const PLACKET_HIGH = placket(NECK.seamY + HIGH_DIP);

/** Six buttons from below the collar to above the hem. */
const BUTTONS = Array.from({ length: 6 }, (_, i) => {
  const y = PLACKET[0][1] + 20 + (i * (HEM_Y + TAIL - 26 - (PLACKET[0][1] + 20))) / 5;
  return [COLLAR_AXIS(y), y] as const;
});

/*
  Woven, so it folds in longer, crisper lines: a few from the chest to the
  hem, a soft diagonal from each underarm toward the waist, the turn under her bust — see `wovenFolds`.
*/
const WAIST_Y = draft("female").waistY;

const TOP = sleevedTop({
  draft: DRAFT,
  openings: { own: NECKLINE, high: HIGH_NECKLINE },
  defaultSleeve: DEFAULT_SLEEVE,
  focus: [300, 340],
  folds: (k) => ({
    body: wovenFolds({
      underarm: k.left.side[0],
      side: k.left.side,
      waistY: WAIST_Y,
      hem: k.left.side[k.left.side.length - 1],
      hemDip: TAIL,
      bust: BUST,
      seed: 23,
    }),
  }),
});

export const blouseFront: GarmentArt = {
  regions: {
    body: TOP.region({}),
    placket: placketArt(blade(PLACKET, PLACKET_BOWS), PLACKET),
  },
  variants: {
    high: {
      body: TOP.region({ opening: "high" }),
      placket: placketArt(blade(PLACKET_HIGH, PLACKET_BOWS), PLACKET_HIGH),
    },
  },
  cut: (choice) => ({ body: TOP.region(choice) }),
  armCover: (choice) => TOP.armCover(choice),
  cuffTrim: (choice) => TOP.cuffTrim(choice),
  cover: (choice) => TOP.cover(choice),
  trim: litButtons(BUTTONS, 4),
};
