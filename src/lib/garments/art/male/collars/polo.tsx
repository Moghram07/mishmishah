import { collarTone } from "../../collarLight";
import { nudge, softEdges, type Point } from "@/lib/garments/collar";
import { lifted, reverse, run, type Pt } from "@/lib/garments/fit";
import { foldDefs, foldLights, foldShadows, type Fold } from "@/lib/garments/folds";
import {
  COLLAR_AXIS,
  HIGH_DIP,
  NECK_BASE_SEAM,
  opening,
  reflect,
  reflectPts,
  standBehind,
} from "../yoke";
import { behindBandArt } from "../../behindBand";
import type { GarmentArt } from "../../index";

/**
 * Polo collar: soft rib knit, folded low round the neck, with short blunt
 * points that meet at the top of the placket.
 *
 * A polo's collar is one knitted strip sewn to the neckline, with the ends at
 * the placket. It has a stand of about a centimetre round the back and sides,
 * where it folds, and no band across the front at all: the ends come down to
 * the placket, so from the front the fold runs from the side of the neck down
 * to the top of the placket and the neck shows above it. It used to have a
 * shirt's band across the throat, closed in front, which is a shirt collar.
 *
 * And it is rib, not woven cloth: fine ribs running down the fall, from the
 * fold to the edge, and no crisp corner anywhere — the points are rounded and
 * the edges roll a little under.
 */

/** How far the fold sits above the neckline seam, round the sides of the neck. */
const RISE = 6;
/** How far each side of the axis the fold starts to come down to meet: half the placket and a little. */
const OPEN = 14;
/** How far the fall reaches below the seam at the side, and how far out past the neck. */
const BELOW_SEAM = 13;
const SPREAD = 16;
/** A point's front edge: about 8 cm, angled down toward the placket. */
const POINT_LENGTH = 42;
const POINT_ANGLE = (24 * Math.PI) / 180;
/** How round the knit corners are: the outer one, and the point. */
const ROUND_OUTER = 6;
const ROUND_TIP = 8;

const STAND_BEHIND_PATH = standBehind(RISE);

/** The neckline the collar is sewn to, left half, from the side of the neck to centre front. */
const NECK_ARC: Pt[] = reverse(opening(HIGH_DIP).points).slice(0, 9);
/** Where the leaves meet: the top of the placket, on the collar's axis, just over the seam. */
const MEET: Point = [COLLAR_AXIS(NECK_ARC[8][1]), NECK_ARC[8][1] + 1];

/**
 * The fold, from where the leaves meet out to the side of the neck: six units
 * above the seam round the neck, coming down to meet at the placket over the
 * last centimetre or two each side.
 */
const FOLD_IN: Pt[] = [
  [MEET[0], MEET[1]],
  ...lifted(reverse(NECK_ARC.slice(0, 8)), (x) => RISE * Math.min(1, Math.abs(x - MEET[0]) / OPEN) ** 0.7),
];
/** Where the fold turns round the side of the neck. */
const SIDE: Point = FOLD_IN[FOLD_IN.length - 1];
/** The fall's outer corner, past the neck and below the seam. */
const OUTER: Point = [SIDE[0] - SPREAD, NECK_BASE_SEAM + BELOW_SEAM];
/** The point, short and blunt. */
const TIP: Point = [
  MEET[0] - POINT_LENGTH * Math.sin(POINT_ANGLE),
  MEET[1] + POINT_LENGTH * Math.cos(POINT_ANGLE),
];

/*
  One leaf: along the fold from where the leaves meet out to the side of the
  neck, down and out to the outer corner, in to the point, and up the front
  edge back to the placket. Both corners rounded, as a knit's are; the edges
  bowed out a little and the front edge a shade hollow.
*/
const LEAF_LEFT_PATH = `M${MEET[0]} ${MEET[1]} ${run(FOLD_IN)} ${softEdges(
  [SIDE, OUTER, TIP, MEET],
  [3, 3, -1],
  [0, ROUND_OUTER, ROUND_TIP]
)} Z`;
const LEAF_RIGHT_PATH = reflect(LEAF_LEFT_PATH);

/** A point `t` of the way from `a` to `b` — past either end when `t` is outside 0 to 1. */
const along = (a: Point, b: Point, t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/**
 * The rib: fine lines down the fall from the fold to the edge, fanning a
 * little as the fall widens, a rib every half centimetre or so — drawn by its
 * light alone, so the knit shows without a dark line in it. Overshooting
 * both edges, since the light is masked to the collar.
 */
const RIB_COUNT = 15;
const RIB_LEFT = Array.from({ length: RIB_COUNT }, (_, k) => {
  const t = (k + 0.5) / RIB_COUNT;
  const top = along(SIDE, MEET, t);
  const foot = along(OUTER, TIP, t);
  const [a, b] = [along(top, foot, -0.25), along(top, foot, 1.2)];
  return `M${a[0].toFixed(1)} ${a[1].toFixed(1)} L${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
}).join(" ");
/** The same ribs nudged across by half a rib: the lit side of each. */
const RIB_LIGHTS = `${nudge(RIB_LEFT, 1.1, 0)} ${reflect(nudge(RIB_LEFT, 1.1, 0))}`;

/* The fold: a soft, wide, round turn — knit rolls where cloth would crease. */
const FOLD_RIDGE: Pt[] = [...FOLD_IN].reverse().map(([x, y]) => [x, y + 2.5] as Pt);
const ROLL: Fold[] = [
  { ridge: FOLD_RIDGE, width: [2.8, 2.8], shadow: 0.2, light: 0.32, soft: 1.8 },
  { ridge: reflectPts(FOLD_RIDGE).map(([x, y]) => [x, y] as Pt), width: [2.8, 2.8], shadow: 0.2, light: 0.32, soft: 1.8 },
];

export const malePoloCollarFront: GarmentArt = {
  regions: {
    collar: {
      focus: [300, 200],
      outline: "soft",
      /** Knit, and cut round: the rib runs across the grain. */
      grain: { turn: 90 },
      shape: (fill) => (
        <>
          <path d={LEAF_LEFT_PATH} fill={fill} />
          <path d={LEAF_RIGHT_PATH} fill={fill} />
        </>
      ),
      defs: foldDefs,
      shading: (uid) => (
        <>
          {/* the garment's light and the soft roll; the rib reads by its light alone, with no dark line in it */}
          {collarTone()}
          {foldShadows(uid, ROLL)}
        </>
      ),
      light: (uid) => (
        <>
          <path d={RIB_LIGHTS} fill="none" stroke="#ffffff" strokeWidth="0.7" strokeLinecap="round" opacity="0.14" />
          {foldLights(uid, ROLL)}
        </>
      ),
    },
  },
};

export const malePoloCollarBehind = behindBandArt(STAND_BEHIND_PATH);
