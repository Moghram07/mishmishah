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
import { DEFAULT_LEG, HEM_Y, cloth, legsFor } from "./trousersCut";

/**
 * Trousers, front, cut to a leg — straight, slim or wide: see `legs.ts`. The
 * waistband sits at the natural waist and each leg falls from her own leg or
 * hip down to the ankle. Their geometry lives in `trousersCut.ts`, where
 * `check:garments` reads it.
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

const L = legsFor();

/*
  Pressed: a crease down the front of each leg from the waist to the hem, a
  few soft folds at the top of the thigh, and a small soft break above the
  hem — see `trouserFolds`. The fly, the slanted pockets and the belt loops
  are drafted with the legs — see `trouserDetails` — and drawn on them below.
*/
const SEED = 29;
const FOLDS = trouserFolds({
  leg: L.left,
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

const legsRegion = (inside?: Tuck, leg: LegId = DEFAULT_LEG): RegionArt => {
  const T = legsFor(inside, leg);
  const folds = T === L ? FOLDS : trouserFolds({ leg: T.left, bandY: T.bandY, crotchY: draft("female").crotchY, hemY: HEM_Y, seed: SEED });
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

export const trousersFront: GarmentArt = {
  regions: { body: legsRegion() },
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
