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
 * Straight-leg trousers, male front. Cut to his hip rather than to the wider of
 * two hips: his is 7 units narrower than hers, but his thigh is 2 wider and is
 * the outer surface from about the crotch down, so the leg is what the seam has
 * to clear.
 *
 * **Two pieces, one per leg, and his own stance.** This and the female pair
 * used to carry the same inner edge character for character — `L295 760
 * L298 640 L300 512` in both — so the two legs met along a hairline and the one
 * measurement that most separates the two figures was the one thing the two
 * garments shared. His legs part at y 521 where hers part at 495, and his
 * ankles stand 96 units apart where hers stand 42. All of that is read off the
 * photographs now; see `garments/fit.ts`.
 */

const HEM_Y = 902;

/** How they are cut: the same numbers worn on their own and under a jacket. */
const SPEC: LegsSpec = {
  /*
    Worn eight units below his own waist, which the photograph puts at y 383.
    This was a typed y 362 — hers, to the unit — and it put the band
    twenty-odd units up his stomach, which is the "floating on the torso" the
    figure showed.
  */
  rise: 8,
  band: 34,
  hemY: HEM_Y,
  /*
    His numbers, and deliberately not hers — see the note on the female draft.
    A man's trouser is the opposite shape to a woman's: cut fuller through the
    thigh and **straight** from knee to hem, so the cuff is the widest part of
    the leg rather than the narrowest. Five at the waist, six at the thigh,
    seven at the ankle.
  */
  ease: 5,
  legEase: 6,
  cuffEase: 7,
  innerEase: 4,
  /*
    A man's fly closes left over right, so its J is on his left — the
    canvas's right — three and a half centimetres in and eighteen down; and
    his slanted pockets reach the side seam sixteen centimetres below the band.
  */
  fly: { length: 18, width: 3.5, on: "left" },
  pocket: 16,
};

const L = trousers("male", SPEC);

/**
 * The trousers worn under a jacket: drawn in under the jacket's hem, where they
 * are wider than it, and out again to their own hem — see `tucked`.
 */
export const TUCKED = (inside: Tuck) => ((T) => [T.left, T.right])(trousers("male", { ...SPEC, inside }));

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
const SEED = 27;
const FOLDS = trouserFolds({
  leg: LEG_LEFT_PATH,
  bandY: L.bandY,
  crotchY: draft("male").crotchY,
  hemY: HEM_Y,
  seed: SEED,
});

/*
  No seat patch. A dark crescent hung under the crotch was meant as the seat's
  shadow and read as a stain: the seat is behind the legs, and a front view
  sees only how the cloth pulls toward it — which is folds, and round 2's job.
*/

const legsRegion = (inside?: Tuck): RegionArt => {
  const T = inside ? trousers("male", { ...SPEC, inside }) : L;
  const folds = inside
    ? trouserFolds({ leg: T.left, bandY: T.bandY, crotchY: draft("male").crotchY, hemY: HEM_Y, seed: SEED })
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

export const maleTrousersFront: GarmentArt = {
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
