import { arc, type Point } from "@/lib/garments/collar";
import { draft, line, run, type Pt } from "@/lib/garments/fit";
import { foldDefs, foldLights, foldShadows, type Fold } from "@/lib/garments/folds";
import { collarFold, collarTone } from "../../collarLight";
import {
  COLLAR_AXIS,
  NECK_BASE_SEAM,
  reflect,
  standBehind,
  standFront,
  standFrontEdges,
} from "../yoke";
import { behindBandArt } from "../../behindBand";
import { litButtons } from "../../buttons";
import { seamFolds, sleeveFoldDefs } from "../../sleeveFolds";
import { shirtTieArt } from "../../shirtTieArt";
import { shirtTie } from "../../shirtTies";
import type { GarmentArt, RegionArt } from "../../index";

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

/**
 * Where the band is sewn to the neckline: a seam, so a soft line of shadow
 * rather than an outline, which turns pale on a dark page — across the foot of
 * the V that was a light line under the button. Lifted a little into the band,
 * since shading is drawn on the collar only.
 */
const BAND_FOOT = line(standFrontEdges(BAND_RISE).foot.map(([x, y]) => [x, y - 0.8] as Pt));

/* The fold: a soft, rounded turn along the roll line, drawn as a seam is — a little light, a soft shadow. */
const ROLL_FOLD: Fold = collarFold(ROLL.map(([x, y]) => [x, y + 2] as Pt), 2);

/** Where the band is sewn to the neckline: a soft fold, seen only in the V between the leaves. */
const BAND_SEAM = seamFolds([BAND_FOOT]);

/** The button on the band, in the V: one, below the meeting point. */
const BUTTON_DROP = 15;

/** The collar: its band, and its two leaves over it. */
const COLLAR: RegionArt = {
  focus: [300, 192],
  outline: "soft",
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
      {foldDefs(uid)}
      {sleeveFoldDefs(uid)}
      {/* the band's seam is lit only where the band shows: its light is drawn after the leaves */}
      <mask id={uid("band-seam")} maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="1000">
        <path d={BAND_PATH} fill="#fff" />
        <path d={LEAF_LEFT_PATH} fill="#000" />
        <path d={LEAF_RIGHT_PATH} fill="#000" />
      </mask>
    </>
  ),
  shading: (uid) => (
    <>
      {/* the garment's light; the band's seam and the roll, soft folds; the leaves' soft shadow on the band is their outline's */}
      {collarTone()}
      {foldShadows(uid, BAND_SEAM)}
      {foldShadows(uid, [ROLL_FOLD])}
    </>
  ),
  light: (uid) => (
    <>
      {foldLights(uid, [ROLL_FOLD])}
      <g mask={`url(#${uid("band-seam")})`}>{foldLights(uid, BAND_SEAM)}</g>
    </>
  ),
};

/**
 * Its leaves alone, drawn as `COLLAR` draws them: laid again over a
 * necktie's knot, which is knotted round the band under them, so the
 * collar's points lie over the sides of the knot — the stage draws them
 * after the tie, and only over it: see `GARMENT_LAYERS`' `fall`.
 */
const LEAVES: RegionArt = {
  ...COLLAR,
  shape: (fill) => (
    <>
      <path d={LEAF_LEFT_PATH} fill={fill} />
      <path d={LEAF_RIGHT_PATH} fill={fill} />
    </>
  ),
  edge: () => (
    <>
      <path d={LEAF_LEFT_PATH} />
      <path d={LEAF_RIGHT_PATH} />
    </>
  ),
};

/** The collar with a necktie knotted round its band: drawn as ever, its leaves laid again over the knot — see `LEAVES`. */
const UNDER_TIE: RegionArt = { ...COLLAR, over: LEAVES };

/** The row a necktie worn with it ends at: her waist — see `shirtTie`. */
const WAIST_Y = draft("female").waistY;

export const shirtCollarFront: GarmentArt = {
  regions: { collar: COLLAR },
  /*
    Worn with a necktie or a bow tie, knotted round its band and under its
    leaves where they meet, it draws the tie — and lays its leaves again over
    a necktie's knot. Its leaves still meet: the collar is closed at the top.
  */
  cut: (choice) => {
    const style = choice.tieBand ? choice.tie : undefined;
    if (style !== "necktie" && style !== "bowtie") return {};
    const meet: Pt = [MEET[0], MEET[1]];
    const tie = shirtTieArt(style, "female", meet, WAIST_Y);
    /* a necktie's knot lies under the leaves, a bow tie on them — as its pieces say: see `ShirtTie.under` */
    return shirtTie(style, "female", meet, WAIST_Y).under ? { collar: UNDER_TIE, tie } : { tie };
  },
  /** One button on the band, whatever the garment asks: there is room for one in the V. */
  bandButtons: () => litButtons([[COLLAR_AXIS(MEET[1] + BUTTON_DROP), MEET[1] + BUTTON_DROP]], 2),
};

/** For the record and the checker: the collar's own measurements — see `MALE_SHIRT_COLLAR`. */
export const SHIRT_COLLAR = { stand: BAND_RISE, meet: MEET, side: SIDE, outer: OUTER, tip: TIP };

export const shirtCollarBehind = behindBandArt(STAND_BEHIND_PATH);

