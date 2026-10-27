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
import { wovenFolds } from "@/lib/garments/folds";
import { sleevedTop } from "../sleevedTop";
import { litButtons } from "../buttons";

/**
 * Shirt, male front — long-sleeved as it arrives, and cut to any sleeve offered
 * him: the body, the sleeves, and the placket that fastens it.
 *
 * **The collar is no longer here.** It used to be a region of this drawing, and
 * that one fact is why it was the worst-looking thing in the wardrobe. A collar
 * drawn inside a garment is a collar no collar check can see: `check:garments`
 * walks the collar *records*, all of which were female, so this one was never
 * measured against his neck, never required to pass behind it, and never held
 * to a footprint. What it had grown into was a trapezoid from y 176 *downward*
 * into the chest — below the base of his neck, with the throat bare above it
 * and no arc behind — plus three transparent holes, because the band, the two
 * leaves and the placket were four subpaths of one `fillRule="evenodd"` path
 * and overlapping subpaths cancel.
 *
 * It is a record in `data/collars.ts` and a drawing in `male/collars/` now, on
 * the same terms every female collar is, and the checker walks it like any
 * other.
 *
 * The front is cut closed. An open collar would leave a wedge of bare chest
 * where a real shirt shows an undershirt, and the wardrobe has no layer beneath
 * this one to show.
 */

/**
 * Body and sleeves, drafted against his photograph — see `garments/sleeves.ts`.
 *
 * A shirttail: the side seams end at y 470 and the front falls 44 units below
 * them, to y 514 — rounded up at the sides as a shirt is, so its tails do not
 * bunch at the hip. It was a straight hem at y 502, level with his long
 * sleeve's cuff; his hands hang against his thighs, so the two merged into one
 * line across the figure, which is most of why the shirt read as a slab.
 */
const HEM_Y = 470;
const TAIL = 44;

const DRAFT = top("male", {
  tip: [TIP_LEFT[0], TIP_LEFT[1]],
  neck: [NECK_LEFT[0], NECK_LEFT[1]],
  neckRight: [NECK_RIGHT[0], NECK_RIGHT[1]],
  shoulderEase: SHOULDER_EASE,
  ease: 4,
  hemY: HEM_Y,
  tail: TAIL,
  sleeve: [5, 5],
  inner: [3, 3],
});

export const DEFAULT_SLEEVE: SleeveChoice = { type: "set-in", length: "long", cuff: "formal" };

const NECK = opening(30);
const NECKLINE = NECK.front;

/** The seam a collar is sewn to, as an open line — see `check:garments`. */
export const NECK_SEAM = `M${NECK_RIGHT[0]} ${NECK_RIGHT[1]} ${NECKLINE}`;
export const NECK_SEAM_HIGH = `M${NECK_RIGHT[0]} ${NECK_RIGHT[1]} ${HIGH_NECKLINE}`;

/** Every piece of body cloth, for one sleeve and one opening — what the checker draws. */
export const CLOTH = (sleeve: SleeveChoice, high: boolean, inside?: Tuck) =>
  clothOf(DRAFT, high ? HIGH_NECKLINE : NECKLINE, sleeve, inside);

/**
 * The placket runs the shirt's full length, collar to hem, as a shirt's does:
 * it is the opening the shirt goes on by. It stopped at y 372 under three
 * buttons, which is a henley's. It ends just inside the shirttail's lowest
 * point.
 */
const PLACKET_END = HEM_Y + TAIL - 3;
const PLACKET: Point[] = [
  [286, 208],
  [314, 208],
  [314, PLACKET_END],
  [286, PLACKET_END],
];
const PLACKET_HIGH: Point[] = [
  [286, 188],
  [314, 188],
  [314, PLACKET_END],
  [286, PLACKET_END],
];

/** Seven front buttons, about 8 cm apart — the collar's own button is under the collar. */
const BUTTONS = Array.from({ length: 7 }, (_, i) => 238 + i * 42);

const PLACKET_PATH = blade(PLACKET, PLACKET_BOWS);
const PLACKET_HIGH_PATH = blade(PLACKET_HIGH, PLACKET_BOWS);

/*
  Woven, so it folds in longer, crisper lines: a few from the chest to the
  hem, a soft diagonal from each underarm toward the waist — see `wovenFolds`.
*/
const WAIST_Y = draft("male").waistY;

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
      seed: 19,
    }),
  }),
});

export const maleShirtFront: GarmentArt = {
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
  trim: litButtons(BUTTONS.map((y) => [300, y] as const), 5),
  /*
    Under a band collar, one more button just under the band — no collar
    button hidden under leaves — and the seven evenly from it to the same last
    one: about 8 cm apart, as they are.
  */
  bandTrim: litButtons(
    Array.from({ length: 8 }, (_, i) => [300, BAND_FOOT + 8 + ((BUTTONS[BUTTONS.length - 1] - BAND_FOOT - 8) * i) / 7] as const),
    5
  ),
};
