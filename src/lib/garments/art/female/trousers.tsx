import {
  DRAPE,
  vertical,
} from "@/lib/garments/shading";
import { draft, trousers, type LegsSpec, type Tuck } from "@/lib/garments/fit";
import { foldDefs, foldLights, foldShadows, trouserFolds } from "@/lib/garments/folds";
import { seamShadows, sleeveFoldDefs } from "../sleeveFolds";
import { beltLoops, detailDefs, detailShading, detailStitch } from "../trouserDetails";
import type { GarmentArt, RegionArt } from "../index";

/**
 * Straight-leg trousers, front. The waistband sits at the natural waist and
 * each leg follows her own leg down to the ankle.
 *
 * **Two pieces, not one.** The old outline was a single shape that ran down the
 * outside of one leg, up to a single point at `L300 512`, and back down the
 * other — so the two legs met along a hairline with no daylight anywhere below
 * it. Her legs are 29 units apart at the knee and 42 at the ankle, and his are
 * 43 and 96; the two drawings carried the *same* inner edge to the character,
 * which is why one pair of trousers used to fit neither figure. Both are
 * measured now, so the difference between a man's silhouette and a woman's
 * comes out of the photographs rather than out of a guess.
 */

const HEM_Y = 902;

/** How they are cut: the same numbers worn on their own and under a jacket. */
const SPEC: LegsSpec = {
  /*
    Worn twelve units below her waist — a mid rise, sitting just over the
    navel. Relative to the waist she was measured to have, so it moves with
    the body rather than with a typed row.
  */
  rise: 12,
  band: 34,
  hemY: HEM_Y,
  /*
    Her numbers, not a shared set. These were 9/11/9/5 on both bodies, which is
    the generic silhouette in plain sight — and 11 through the thigh, on top of
    the taut outer edge's own bridging, is what stood the cloth 18 units off her
    knee and made a trouser read as a wide shape placed around a leg.

    A woman's trouser is cut close over the seat and **tapers**: five at the
    hip, five through the thigh, four at the ankle. The inner edge comes in a
    unit, which widens the daylight between the legs rather than narrowing it.
  */
  ease: 5,
  legEase: 5,
  cuffEase: 4,
  innerEase: 4,
  /*
    A woman's fly closes right over left, so its J is on her right — the
    canvas's left — three centimetres in and fifteen down; and her slanted
    pockets reach the side seam fourteen centimetres below the band.
  */
  fly: { length: 15, width: 3, on: "right" },
  pocket: 14,
};

const L = trousers("female", SPEC);

/**
 * The trousers worn under a jacket: drawn in under the jacket's hem, where they
 * are wider than it, and out again to their own hem — see `tucked`.
 */
export const TUCKED = (inside: Tuck) => ((T) => [T.left, T.right])(trousers("female", { ...SPEC, inside }));

const LEG_LEFT_PATH = L.left;
const LEG_RIGHT_PATH = L.right;

/** The waistband: the top of the legs' own edge, in the same cloth. */
const WAISTBAND_PATH = L.band;

/*
  Pressed: a crease down the front of each leg from the waist to the hem, a
  few soft folds at the top of the thigh, and a small soft break above the
  hem — see `trouserFolds`. The fly, the slanted pockets and the belt loops
  are drafted with the legs — see `trouserDetails` — and drawn on them below.
*/
const SEED = 29;
const FOLDS = trouserFolds({
  leg: LEG_LEFT_PATH,
  bandY: L.bandY,
  crotchY: draft("female").crotchY,
  hemY: HEM_Y,
  seed: SEED,
});

/*
  No seat patch. A dark crescent hung under the crotch was meant as the seat's
  shadow and read as a stain: the seat is behind the legs, and a front view
  sees only how the cloth pulls toward it — which is folds, and round 2's job.
*/

const legsRegion = (inside?: Tuck): RegionArt => {
  const T = inside ? trousers("female", { ...SPEC, inside }) : L;
  const folds = inside
    ? trouserFolds({ leg: T.left, bandY: T.bandY, crotchY: draft("female").crotchY, hemY: HEM_Y, seed: SEED })
    : FOLDS;
  return {
    focus: [300, 620],
    surface: { blur: 18, relief: 5, warp: 5 },
    /* One filter per leg, so each is lit as its own tube. */
    shape: (fill) => (
      <>
        <path d={T.left} fill={fill} />
        <path d={T.right} fill={fill} />
      </>
    ),
    /* outlined along their free edges only: the centre front is a seam, drawn below */
    edge: () => (
      <>
        <path d={T.edges[0]} />
        <path d={T.edges[1]} />
      </>
    ),
    defs: (uid) => (
      <>
        {foldDefs(uid)}
        {sleeveFoldDefs(uid)}
        {vertical(uid("drape"), DRAPE)}
        {vertical(uid("band"), [
          [0, "#ffffff"],
          [1, "#d2d2d2"],
        ])}
        {detailDefs(uid, T.details)}
      </>
    ),
    shading: (uid) => (
      <>
        <path d={T.left} fill={`url(#${uid("drape")})`} />
        <path d={T.right} fill={`url(#${uid("drape")})`} />
        <path d={T.band} fill={`url(#${uid("band")})`} />
        {foldShadows(uid, folds)}
        {/* the centre front seam: a soft darker line, as every seam is */}
        {seamShadows(uid, [T.seam])}
        {/* the pockets' openings and the fly's front edge, each lying on the cloth behind it */}
        {detailShading(uid, T.details)}
      </>
    ),
    light: (uid) => foldLights(uid, folds),
    stitch: [
      T.bandStitch,
      T.stitch,
      detailStitch(T.details),
    ].join(" "),
    /* the belt loops, sewn over the band */
    over: beltLoops(T.details.loops),
  };
};

const tuckedRegions = new Map<string, RegionArt>();

export const trousersFront: GarmentArt = {
  regions: { body: legsRegion() },
  /** Under a jacket, they come out from under its hem. */
  cut: (choice) => {
    const inside = choice.inside;
    if (!inside) return {};
    const key = `${inside.y}|${inside.x}`;
    if (!tuckedRegions.has(key)) tuckedRegions.set(key, legsRegion(inside));
    return { body: tuckedRegions.get(key)! };
  },
};
