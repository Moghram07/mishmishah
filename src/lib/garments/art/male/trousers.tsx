import {
  DRAPE,
  vertical,
} from "@/lib/garments/shading";
import { draft, type Tuck } from "@/lib/garments/fit";
import { foldDefs, foldLights, foldShadows, trouserFolds } from "@/lib/garments/folds";
import { seamFolds, sleeveFoldDefs } from "../sleeveFolds";
import { beltLoops, detailDefs, detailShading, detailStitch } from "../trouserDetails";
import type { GarmentArt, RegionArt } from "../index";
import type { LegId } from "@/types";
import { DEFAULT_LEG, HEM_Y, WAISTBAND, cloth, legsFor } from "./trousersCut";

/**
 * Trousers, male front, cut to a leg — straight, slim or wide: see `legs.ts`;
 * their geometry lives in `trousersCut.ts`, where `check:garments` reads it.
 * Cut to his hip rather than to the wider of
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

const L = legsFor();

/*
  Pressed: a crease down the front of each leg from the waist to the hem, a
  few soft folds at the top of the thigh, and a small soft break above the
  hem — see `trouserFolds`. The fly, the slanted pockets and the belt loops
  are drafted with the legs — see `trouserDetails` — and drawn on them below.
*/
const SEED = 27;
const FOLDS = trouserFolds({
  leg: L.left,
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

const legsRegion = (inside?: Tuck, leg: LegId = DEFAULT_LEG): RegionArt => {
  const T = legsFor(inside, leg);
  const folds = T === L ? FOLDS : trouserFolds({ leg: T.left, bandY: T.bandY, crotchY: draft("male").crotchY, hemY: HEM_Y, seed: SEED });
  const seam = seamFolds([T.seam]);
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
        {/* the centre front seam: a soft fold, as every seam is */}
        {foldShadows(uid, seam)}
        {/* the pockets' openings and the fly's front edge, each lying on the cloth behind it */}
        {detailShading(uid, T.details)}
      </>
    ),
    light: (uid) => foldLights(uid, [...folds, ...seam]),
    stitch: [
      T.bandStitch,
      T.stitch,
      detailStitch(T.details),
    ].join(" "),
    /* the belt loops, sewn over the band */
    over: beltLoops(T.details.loops),
  };
};

const cutRegions = new Map<string, RegionArt>();

export const maleTrousersFront: GarmentArt = {
  regions: { body: legsRegion() },
  /* where a necktie worn over them reaches */
  waistband: WAISTBAND,
  /** In a leg, or under a jacket, where they come out from under its hem. */
  cut: (choice) => {
    const { inside, leg = DEFAULT_LEG } = choice;
    if (!inside && leg === DEFAULT_LEG) return {};
    const key = `${leg}|${inside ? `${inside.y}|${inside.x}` : ""}`;
    if (!cutRegions.has(key)) cutRegions.set(key, legsRegion(inside, leg));
    return { body: cutRegions.get(key)! };
  },
  /** The legs as cut, for the leg picker. */
  silhouette: (choice) => cloth(choice),
};
