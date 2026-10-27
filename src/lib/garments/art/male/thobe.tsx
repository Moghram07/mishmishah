import { blade, type Point } from "@/lib/garments/collar";
import type { Pt, Tuck } from "@/lib/garments/fit";
import { hangingFolds } from "@/lib/garments/folds";
import { PLACKET_BOWS, placketArt } from "../placket";
import { clothOf, top } from "@/lib/garments/sleeves";
import type { SleeveChoice } from "@/types";
import {
  BAND_FOOT,
  THOBE_PLACKET,
  HIGH_NECKLINE,
  NECK_LEFT,
  NECK_RIGHT,
  SHOULDER_EASE,
  opening,
  TIP_LEFT,
} from "./yoke";
import type { GarmentArt } from "../index";
import { litButtons } from "../buttons";
import { sleevedTop } from "../sleevedTop";

/**
 * Thobe, male front — one piece from shoulder to ankle.
 *
 * The garment the coverage rule exists for. It covers the hip, thigh, knee and
 * calf as well as the chest and arms, so trousers worn under it are a strict
 * subset and the renderer simply stops drawing them — no `incompatibleWith`
 * entry, no special case, and they are back the moment it comes off. That is
 * also how a thobe is actually worn.
 *
 * The hem stops at 898 rather than the floor: the `calf` zone ends at 890 and
 * the `foot` zone begins at 892, and a garment may not hide feet it has not
 * declared.
 */

/**
 * One piece from shoulder to ankle, drafted against him — see `garments/sleeves.ts`.
 *
 * It is the only garment here that reaches past the crotch, so its side seam
 * runs out of trunk to follow at y 521 and hangs from his hip to the hem, one
 * line over both legs — see `bodySide`. It used to follow each leg, came in at
 * the knee and flared out again: a mermaid. `hemEase` is the A-line, the hem
 * standing 28 units wider than the hip on each side, about 5 cm.
 *
 * Its sleeve is the shared sewn sleeve — see `sewn` in `garments/sleeves.ts`,
 * first drafted for it and approved here: one curve from
 * the shoulder seam over the shoulder and down the outer arm, about 58 units
 * across from the underarm to the forearm's widest row, then narrowing a
 * little on both edges to 50 — at its hem without a cuff, or just above a
 * plain cuff, «كبك سادة» on the chart: 29 units tall, about 5.5 cm, and 46
 * across. The cuff is the sleeve's choice; the thobe arrives in it. It was the tube the shirts hang,
 * which slanted straight out from the shoulder point, bent at the armpit,
 * dropped ruler-straight and pinched only on the inside of the wrist — a
 * puffed head on a tight wrist, which is a leg-of-mutton sleeve.
 */
const DRAFT = top("male", {
  tip: [TIP_LEFT[0], TIP_LEFT[1]],
  neck: [NECK_LEFT[0], NECK_LEFT[1]],
  neckRight: [NECK_RIGHT[0], NECK_RIGHT[1]],
  shoulderEase: SHOULDER_EASE,
  ease: 5,
  hemY: 898,
  dip: 22,
  hemEase: 28,
  /* roomy, and the same at the cuff as at the head: a sleeve hangs, it does not flare */
  sleeve: [7, 7],
  inner: [2, 3],
  finish: { end: 50, cuff: { height: 29, width: 46 }, plumb: true },
});

export const DEFAULT_SLEEVE: SleeveChoice = { type: "set-in", length: "long", cuff: "plain" };

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

/**
 * The placket a thobe fastens with, in the two cuts every male top has: worn
 * open, and taken up under a collar's band. The stand collar that was drawn
 * here is a record of its own now — see the note in `male/shirt.tsx`.
 */
const PLACKET: Point[] = [
  [THOBE_PLACKET[0], 208],
  [THOBE_PLACKET[1], 208],
  [THOBE_PLACKET[1], 352],
  [THOBE_PLACKET[0], 352],
];
const PLACKET_HIGH: Point[] = [
  [THOBE_PLACKET[0], 188],
  [THOBE_PLACKET[1], 188],
  [THOBE_PLACKET[1], 352],
  [THOBE_PLACKET[0], 352],
];

const PLACKET_PATH = blade(PLACKET, PLACKET_BOWS);
const PLACKET_HIGH_PATH = blade(PLACKET_HIGH, PLACKET_BOWS);

/*
  The long fall of a robe — see `garments/folds.tsx`. A thobe has no waist
  seam to gather into: it hangs from the shoulders and the chest, so its folds
  start narrow across the chest and fall the whole length to the hem, opening
  as they go. These were nine grey wedges fanned evenly from the chest. Its
  sleeves hang in the drape every sewn sleeve does — see `sewnDrape`.
*/
const CHEST: readonly [Pt, Pt] = [
  [236, 296],
  [364, 296],
];

const TOP = sleevedTop({
  draft: DRAFT,
  openings: { own: NECKLINE, high: HIGH_NECKLINE },
  defaultSleeve: DEFAULT_SLEEVE,
  focus: [300, 560],
  surface: { blur: 18, relief: 5, warp: 5 },
  drape: [
    [0, "#cfcfcf"],
    [0.12, "#ffffff"],
    [0.7, "#f4f4f4"],
    [1, "#bcbcbc"],
  ],
  folds: (k) => {
    const [hx, hy] = k.left.side[k.left.side.length - 1];
    return {
      body: hangingFolds({
        seam: CHEST,
        hem: [
          [hx, hy],
          [600 - hx, hy],
        ],
        hemDip: 22,
        count: 9,
        width: [1.6, 18],
        shadow: 0.42,
        light: 0.26,
        seed: 21,
      }),
    };
  },
});

/**
 * The placket's buttons: four, evenly spaced, from just under whatever closes
 * the neck to just above the placket's foot — the way the brown thobe on the
 * reference chart is buttoned. There were three, and the first sat about
 * 11 cm below the collar. A regular collar's tab carries two more.
 */
const BUTTONS = 4;
/** How far below the placket's top the first button sits, and above its foot the last. */
const BUTTON_TOP = 13;
const BUTTON_FOOT = 14;
/**
 * How far below a band collar's foot the first button sits: just under it.
 * Under a band there are no leaves to leave room for.
 */
const UNDER_BAND = 8;
/** Down the middle of the placket — and of a regular collar's tab above it, on the same line. */
const MIDDLE = (THOBE_PLACKET[0] + THOBE_PLACKET[1]) / 2;
const row = (from: number, to: number) =>
  litButtons(Array.from({ length: BUTTONS }, (_, i) => [MIDDLE, from + ((to - from) * i) / (BUTTONS - 1)] as const), 4);
const buttons = (placket: Point[]) => row(placket[0][1] + BUTTON_TOP, placket[2][1] - BUTTON_FOOT);

export const maleThobeFront: GarmentArt = {
  /** Buttons closing a collar's band, where it shows between the leaves. */
  collarButtons: 2,
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
  trim: buttons(PLACKET),
  openingTrim: { high: buttons(PLACKET_HIGH) },
  /* under a band collar, from just under the band to the same last button */
  bandTrim: row(BAND_FOOT + UNDER_BAND, PLACKET_HIGH[2][1] - BUTTON_FOOT),
};
