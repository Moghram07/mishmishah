import { draft, necklineShadow, necklineStitch, type Pt, type Tuck } from "@/lib/garments/fit";
import { clothOf, coverOf, top } from "@/lib/garments/sleeves";
import type { SleeveChoice } from "@/types";
import {
  HIGH_NECKLINE,
  NECK_LEFT,
  NECK_RIGHT,
  SHOULDER_EASE,
  opening,
  TIP_LEFT,
  BUST,
} from "./yoke";
import type { GarmentArt } from "../index";
import { knitFolds } from "@/lib/garments/folds";
import { sleevedTop } from "../sleevedTop";

/**
 * T-shirt, front. A crew neckline of its own, cut straight from the chest so it
 * skims the widest hip on offer rather than clinging to the narrowest — and
 * sleeves of any type and length, set in at her measured shoulder point.
 *
 * It cuts two openings, not one. The crew reaches y 220 and takes any collar
 * that lies flat; a standing band cannot be sewn to it, because the base of the
 * neck is thirty units higher and a band hung from a crew neck stands on the
 * chest. So there is a `high` cut as well, following the neck's own silhouette,
 * and the collar names which one it needs.
 *
 * Not one coordinate below is typed. The body panel and the sleeves come out of
 * `garments/sleeves.ts`, which drafts them against her measured photograph and
 * mirrors the left side to make the right. `SIDES` used to open
 * `L182 330 L244 340 L218 290` — the sleeve's own outline drawn *inside* the
 * body's, with a straight diagonal for an underarm twenty units below her real
 * one. That was the triangular wedge, and it is why the arm and the ribs had no
 * daylight between them.
 */

const TIP: Pt = [TIP_LEFT[0], TIP_LEFT[1]];

/** Her t-shirt's numbers: four off the body, the sleeve a touch fuller at its hem. */
const DRAFT = top("female", {
  tip: TIP,
  neck: [NECK_LEFT[0], NECK_LEFT[1]],
  neckRight: [NECK_RIGHT[0], NECK_RIGHT[1]],
  shoulderEase: SHOULDER_EASE,
  ease: 4,
  /*
    Mid-hip, as a t-shirt is worn untucked: an inch or two below where a
    waistband sits, covering it. It ended at y 498, past her crotch, which is
    a minidress.
  */
  hemY: 426,
  dip: 8,
  sleeve: [4, 5],
  inner: [2, 4],
});

/** A true short sleeve: past halfway to the elbow, as a t-shirt's is. */
export const DEFAULT_SLEEVE: SleeveChoice = { type: "set-in", length: "short" };

const NECK = opening(34);
const NECKLINE = NECK.front;

export const NECK_SEAM = `M${NECK_RIGHT[0]} ${NECK_RIGHT[1]} ${NECKLINE}`;
export const NECK_SEAM_HIGH = `M${NECK_RIGHT[0]} ${NECK_RIGHT[1]} ${HIGH_NECKLINE}`;

/** Every piece of cloth, for one sleeve and one opening — what the checker draws. */
export const CLOTH = (sleeve: SleeveChoice, high: boolean, inside?: Tuck) =>
  clothOf(DRAFT, high ? HIGH_NECKLINE : NECKLINE, sleeve, inside);

/** What it lets a skirt worn under it show, for one sleeve — what the checker asks; see `coverOf`. */
export const COVER = (sleeve: SleeveChoice) => coverOf(DRAFT, NECKLINE, sleeve);

const NECK_SHADOW_PATH = necklineShadow(NECK);

/*
  Knit, so it folds very little: a drag line or two from each underarm toward
  the chest, soft folds at the sides of the waist, the turn under her bust — see `knitFolds`.
*/
const WAIST_Y = draft("female").waistY;

const TOP = sleevedTop({
  draft: DRAFT,
  openings: { own: NECKLINE, high: HIGH_NECKLINE },
  defaultSleeve: DEFAULT_SLEEVE,
  focus: [300, 330],
  folds: (k) => ({
    body: knitFolds({
      underarm: k.left.side[0],
      side: k.left.side,
      waistY: WAIST_Y,
      hem: k.left.side[k.left.side.length - 1],
      hemDip: 8,
      bust: BUST,
      seed: 17,
    }),
  }),
  own: {
    shading: () => <path d={NECK_SHADOW_PATH} fill="#c9c9c9" opacity="0.5" />,
    stitch: necklineStitch(NECK),
  },
});

export const tShirtFront: GarmentArt = {
  regions: { body: TOP.region({}) },
  /** The same shirt with the high opening a standing band needs. */
  variants: { high: { body: TOP.region({ opening: "high" }) } },
  cut: (choice) => ({ body: TOP.region(choice) }),
  armCover: (choice) => TOP.armCover(choice),
  cuffTrim: (choice) => TOP.cuffTrim(choice),
  cover: (choice) => TOP.cover(choice),
};
