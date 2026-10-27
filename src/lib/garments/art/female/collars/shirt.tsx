import { FALL, softShadow, vertical } from "@/lib/garments/shading";
import { arc, nudge, type Point } from "@/lib/garments/collar";
import { line, run, type Pt } from "@/lib/garments/fit";
import { foldDefs, foldLights, foldShadows, type Fold } from "@/lib/garments/folds";
import {
  COLLAR_AXIS,
  NECK_BASE_SEAM,
  reflect,
  reflectPts,
  standBehind,
  standFront,
  standFrontEdges,
} from "../yoke";
import { behindBandArt } from "../../behindBand";
import { litButtons } from "../../buttons";
import { seamShadows, sleeveFoldDefs } from "../../sleeveFolds";
import type { GarmentArt } from "../../index";

/**
 * Shirt collar, female: a band round the neck, and two leaves folded down over
 * it — built the way his is, and the way a shirt collar is made.
 *
 * The **band** (the stand) is sewn to the neckline and wraps the neck, closing
 * at the throat on the collar's axis. The **leaves** (the fall) are sewn to the
 * *top* of the band and fold down over it, so the band's top edge is the roll
 * line and the leaves hang from it, covering the band and reaching a little
 * below the neckline seam. Above the roll line you see the neck; below it,
 * only the leaves, and in the small V between them the band, closing with a
 * button.
 *
 * It used to be cut from the neckline: each leaf's inner edge was the seam and
 * the two met at the top of the placket, so a triangle of neck showed between
 * the points, above the placket — the inside of an open collar where a closed
 * one should be.
 *
 * Her numbers, not his scaled: the band rises 13 units at the side of her
 * neck, about as tall as her mandarin, to a roll line two and a half centimetres up
 * it; the points are shorter than his and splay as much.
 */

/** How high the band rises above the neckline seam at the side of the neck: about her mandarin's 14. */
const BAND_RISE = 13;
/** How far the leaves reach below the seam at the side. */
const BELOW_SEAM = 4;
/** How far a leaf's outer corner stands out past the band. */
const SPREAD = 10;
/** A point's front edge: about 6.5 cm long, angled down toward the placket. */
const POINT_LENGTH = 34;
const POINT_ANGLE = (22 * Math.PI) / 180;

const BAND_PATH = standFront(BAND_RISE);
const STAND_BEHIND_PATH = standBehind(BAND_RISE);

/** The roll line: the band's top edge, left to right. */
const ROLL: Pt[] = standFrontEdges(BAND_RISE).top;
const MID = (ROLL.length - 1) / 2;

/** Where the leaves meet: the top of the band, on the collar's axis. */
const MEET: Point = [COLLAR_AXIS(ROLL[MID][1]), ROLL[MID][1]];
/** Where the roll line turns round the side of the neck. */
const SIDE: Point = ROLL[0];
/** The leaf's outer corner, past the band and just below the seam. */
const OUTER: Point = [SIDE[0] - SPREAD, NECK_BASE_SEAM + BELOW_SEAM];
/** The point, on the upper chest. */
const TIP: Point = [
  MEET[0] - POINT_LENGTH * Math.sin(POINT_ANGLE),
  MEET[1] + POINT_LENGTH * Math.cos(POINT_ANGLE),
];

/** The roll line from where the leaves meet out to the side of the neck. */
const ROLL_LEFT: Pt[] = [[MEET[0], MEET[1]], ...ROLL.slice(0, MID).reverse()];

/*
  One leaf: along the roll line from the meeting point out to the side of the
  neck, down and out to the outer corner, in to the point, and up the front
  edge back to the meeting point. Edges bow outward a little, as cloth folded
  over a neck does; the front edge runs a shade hollow.
*/
const LEAF_LEFT_PATH =
  `M${MEET[0]} ${MEET[1]} ${run(ROLL_LEFT.slice(1))} ` +
  `${arc(SIDE, OUTER, 2)} ${arc(OUTER, TIP, 1.5)} ${arc(TIP, MEET, -1)} Z`;
const LEAF_RIGHT_PATH = reflect(LEAF_LEFT_PATH);
const [TIP_RIGHT] = reflectPts([TIP]);

/**
 * Where the band is sewn to the neckline: a seam, so a soft line of shadow
 * rather than an outline, which turns pale on a dark page — across the foot of
 * the V that was a light line under the button. Lifted a little into the band,
 * since shading is drawn on the collar only.
 */
const BAND_FOOT = line(standFrontEdges(BAND_RISE).foot.map(([x, y]) => [x, y - 0.8] as Pt));

/** The narrow V between the leaves, where the band shows. */
const V_SHADE = `M${MEET[0]} ${MEET[1]} L${TIP[0]} ${TIP[1]} L${TIP_RIGHT[0]} ${TIP_RIGHT[1]} Z`;

/* The fold: a soft, rounded turn along the roll line — light and shadow only. */
const ROLL_FOLD: Fold = {
  ridge: ROLL.map(([x, y]) => [x, y + 2] as Pt),
  width: [2, 2],
  shadow: 0.28,
  light: 0.45,
  soft: 1,
};

/** Each leaf's shadow on the body, under its outer edge. */
const LEAF_CAST_PATH = `${nudge(LEAF_LEFT_PATH, 1.5, 3)} ${nudge(LEAF_RIGHT_PATH, -1.5, 3)}`;

/** The button on the band, in the V: one, below the meeting point. */
const BUTTON_DROP = 15;

export const shirtCollarFront: GarmentArt = {
  regions: {
    collar: {
      focus: [300, 192],
      surface: { blur: 5, relief: 4, warp: 2 },
      /**
       * Cut from further along the roll than the shirt it is sewn to, so a
       * stripe stays upright but does not line up across the seam.
       */
      grain: { shift: [0, 14] },
      shape: (fill) => (
        <>
          <path d={BAND_PATH} fill={fill} />
          <path d={LEAF_LEFT_PATH} fill={fill} />
          <path d={LEAF_RIGHT_PATH} fill={fill} />
        </>
      ),
      /* the leaves outlined all round; the band nowhere — under the leaves but for its seam */
      edge: () => (
        <>
          <path d="" />
          <path d={LEAF_LEFT_PATH} />
          <path d={LEAF_RIGHT_PATH} />
        </>
      ),
      defs: (uid) => (
        <>
          {vertical(uid("fall"), FALL)}
          {softShadow(uid("soft"), 3)}
          {foldDefs(uid)}
          {sleeveFoldDefs(uid)}
        </>
      ),
      cast: (uid) => (
        <path d={LEAF_CAST_PATH} fill="#7a7a7a" opacity="0.35" filter={`url(#${uid("soft")})`} />
      ),
      shading: (uid) => (
        <>
          {/* the band, in the shade of the leaves folded over it */}
          <path d={V_SHADE} fill="#c8c8c8" />
          {seamShadows(uid, [BAND_FOOT])}
          <path d={LEAF_LEFT_PATH} fill={`url(#${uid("fall")})`} />
          <path d={LEAF_RIGHT_PATH} fill={`url(#${uid("fall")})`} />
          {foldShadows(uid, [ROLL_FOLD])}
        </>
      ),
      light: (uid) => foldLights(uid, [ROLL_FOLD]),
    },
  },
  /** One button on the band, whatever the garment asks: there is room for one in the V. */
  bandButtons: () => litButtons([[COLLAR_AXIS(MEET[1] + BUTTON_DROP), MEET[1] + BUTTON_DROP]], 2),
};

export const shirtCollarBehind = behindBandArt(STAND_BEHIND_PATH);

