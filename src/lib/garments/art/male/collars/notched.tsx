import { FALL, softShadow, vertical } from "@/lib/garments/shading";
import { blade, type Point } from "@/lib/garments/collar";
import { foldDefs, foldLights, foldShadows, lapelRoll } from "@/lib/garments/folds";
import { LAPEL, reflect, reflectPts, standBehind } from "../yoke";
import { behindBandArt } from "../../behindBand";
import type { GarmentArt } from "../../index";

/**
 * Notched collar, male: his jacket's lapel, with the notch it is named after.
 *
 * Built exactly as hers is and from his own landmarks: the lapel is the top of
 * his jacket's front folded back, so its inner edge is the jacket's V and it
 * narrows to nothing at his button; the collar above it runs up the V to his
 * neck and round the back. Both come from `LAPEL` in his yoke, which is built
 * from the same neck point and button his jacket's fronts are.
 *
 * It used to be five typed corners per piece, with the two upper collars
 * meeting over his throat — the back of the collar drawn across the front of
 * the neck — on a lapel breaking at y 266 above three buttons.
 */

/**
 * The back of the collar, standing behind his neck: drawn under the photograph,
 * so what shows is the edge passing each side of it. Nothing crosses the throat.
 */
const STAND_BEHIND_PATH = standBehind(14);

/** The upper collar: up beside the neck, over to its point, the notch, up the V. */
const COLLAR: Point[] = LAPEL.collar;
const COLLAR_BOWS = [3, 1, 1.5, 0];

/** The lapel: out along the gorge, down its bellied outer edge, back up the roll. */
const LAPEL_PTS: Point[] = LAPEL.lapel;
const LAPEL_BOWS = [1, 5, 2];

const COLLAR_LEFT_PATH = blade(COLLAR, COLLAR_BOWS);
const COLLAR_RIGHT_PATH = reflect(COLLAR_LEFT_PATH);
const LAPEL_LEFT_PATH = blade(LAPEL_PTS, LAPEL_BOWS);
const LAPEL_RIGHT_PATH = reflect(LAPEL_LEFT_PATH);

/** The roll line, as a band of shade along the fold rather than a drawn line. */
/**
 * The roll along each lapel's fold line, gorge to break: a lit crest where the
 * cloth turns over and a soft shadow on the lapel's face beside it — see
 * `lapelRoll`. It was a hard grey strip.
 */
const [GORGE_RIGHT, BREAK_RIGHT] = reflectPts([LAPEL_PTS[0], LAPEL_PTS[2]]);
const ROLL = [...lapelRoll(LAPEL_PTS[0], LAPEL_PTS[2]), ...lapelRoll(GORGE_RIGHT, BREAK_RIGHT)];

const COLLAR_CAST_PATH = blade(
  COLLAR.map(([x, y]) => [x, y + 3] as Point),
  COLLAR_BOWS
);
const LAPEL_CAST_PATH = blade(
  LAPEL_PTS.map(([x, y]) => [x - 2, y + 3] as Point),
  LAPEL_BOWS
);

export const maleNotchedCollarBehind = behindBandArt(STAND_BEHIND_PATH);

export const maleNotchedCollarFront: GarmentArt = {
  regions: {
    collar: {
      focus: [300, 244],
      surface: { blur: 6, relief: 4, warp: 2 },
      /** Straight grain, as a lapel is, but from further down the roll. */
      grain: { shift: [0, 22] },
      shape: (fill) => (
        <>
          <path d={COLLAR_LEFT_PATH} fill={fill} />
          <path d={COLLAR_RIGHT_PATH} fill={fill} />
          <path d={LAPEL_LEFT_PATH} fill={fill} />
          <path d={LAPEL_RIGHT_PATH} fill={fill} />
        </>
      ),
      defs: (uid) => (
        <>
          {vertical(uid("fall"), FALL)}
          {softShadow(uid("soft"), 4)}
          {foldDefs(uid)}
        </>
      ),
      cast: (uid) => (
        <g filter={`url(#${uid("soft")})`} opacity="0.36">
          <path d={COLLAR_CAST_PATH} fill="#7a7a7a" />
          <path d={reflect(COLLAR_CAST_PATH)} fill="#7a7a7a" />
          <path d={LAPEL_CAST_PATH} fill="#7a7a7a" />
          <path d={reflect(LAPEL_CAST_PATH)} fill="#7a7a7a" />
        </g>
      ),
      shading: (uid) => (
        <>
          {/* the collar in the same light as the lapel: one cloth, one face */}
          <path d={COLLAR_LEFT_PATH} fill={`url(#${uid("fall")})`} />
          <path d={COLLAR_RIGHT_PATH} fill={`url(#${uid("fall")})`} />
          <path d={LAPEL_LEFT_PATH} fill={`url(#${uid("fall")})`} />
          <path d={LAPEL_RIGHT_PATH} fill={`url(#${uid("fall")})`} />
          {foldShadows(uid, ROLL)}
        </>
      ),
      light: (uid) => foldLights(uid, ROLL),
    },
  },
};
