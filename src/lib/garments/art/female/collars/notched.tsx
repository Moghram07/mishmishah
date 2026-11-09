import { collarTone } from "../../collarLight";
import { blade, type Point } from "@/lib/garments/collar";
import { foldDefs, foldLights, foldShadows, lapelRoll } from "@/lib/garments/folds";
import { LAPEL, reflect, reflectPts, standBehind } from "../yoke";
import { behindBandArt } from "../../behindBand";
import type { GarmentArt } from "../../index";

/**
 * Notched collar: the jacket's lapel, with the notch it is named after.
 *
 * What makes it *notched* is that the collar and the lapel are two pieces
 * meeting at an angle with a wedge of nothing between them — so they are drawn
 * as two pieces per side, and the notch is the gap, opening outward from the
 * gorge where the two are sewn together.
 *
 * **Cut from the jacket, not drawn beside it.** A lapel is the top of the front
 * folded back, so its inner edge is the jacket's V and it narrows to nothing at
 * the jacket's button. Both come from `LAPEL` in the yoke, which is built from
 * the same neck point and button the jacket's fronts are — the old one was
 * five typed corners breaking at y 262 on a jacket with three buttons below.
 *
 * The right side is the left one reflected about her collar axis — her neck at
 * the neck, the trunk at the button — which is exactly the line the jacket's
 * right-hand V is reflected about, so the two land on each other.
 */

/**
 * No band in front of the neck. The back of a jacket collar stands up behind
 * the neck, and head-on the neck hides all of it except the edges passing each
 * side — which is this, drawn under the photograph. A band across the throat
 * would put the part of the collar that goes round the *back* of the neck in
 * front of it.
 */
const STAND_BEHIND_PATH = standBehind(14);

/**
 * The upper collar: up the side of the neck, over the shoulder to its point,
 * back along the notch to the gorge, and up the V to the neck.
 *
 * Bowed outward where it rolls over the shoulder, and only a little elsewhere:
 * the notch and the edge along the V are sewn, and a sewn edge on a pressed
 * collar is nearly straight — nearly, because cloth is never ruled. The edge
 * along the V bellies into the opening, so it covers the seam it lies on.
 */
const COLLAR: Point[] = LAPEL.collar;
const COLLAR_BOWS = [3, 1, 1.5, 0];

/**
 * The lapel: out along the gorge to its peak, down its outer edge to the
 * break, and back up the V.
 *
 * The outer edge bellies a little — a pressed lapel rolls, it is not a
 * triangle. The gorge is a seam and barely curves; the roll line is the fold
 * the lapel turns back on, and it bows into the V the way a rolled lapel does,
 * which also keeps it over the seam it is folded from.
 */
const LAPEL_PTS: Point[] = LAPEL.lapel;
const LAPEL_BOWS = [1, 5, 2];

const COLLAR_LEFT_PATH = blade(COLLAR, COLLAR_BOWS);
const COLLAR_RIGHT_PATH = reflect(COLLAR_LEFT_PATH);
const LAPEL_LEFT_PATH = blade(LAPEL_PTS, LAPEL_BOWS);
const LAPEL_RIGHT_PATH = reflect(LAPEL_LEFT_PATH);

/**
 * The roll line: the fold the lapel turns back on, which is the V itself. A
 * band of shade along it rather than a drawn line.
 */
/**
 * The roll along each lapel's fold line, gorge to break: a lit crest where the
 * cloth turns over and a soft shadow on the lapel's face beside it — see
 * `lapelRoll`. It was a hard grey strip.
 */
const [GORGE_RIGHT, BREAK_RIGHT] = reflectPts([LAPEL_PTS[0], LAPEL_PTS[2]]);
const ROLL = [...lapelRoll(LAPEL_PTS[0], LAPEL_PTS[2]), ...lapelRoll(GORGE_RIGHT, BREAK_RIGHT)];

export const notchedCollarBehind = behindBandArt(STAND_BEHIND_PATH);

export const notchedCollarFront: GarmentArt = {
  regions: {
    collar: {
      focus: [300, 240],
      outline: "soft",
      /**
       * A lapel is cut on the same straight grain as the jacket, and from
       * further down the roll — so a stripe stays upright across the break but
       * does not line up through it, which is exactly what a real one does.
       */
      grain: { shift: [0, 22] },
      shape: (fill) => (
        <>
          <path d={COLLAR_LEFT_PATH} fill={fill} />
          <path d={COLLAR_RIGHT_PATH} fill={fill} />
          <path d={LAPEL_LEFT_PATH} fill={fill} />
          <path d={LAPEL_RIGHT_PATH} fill={fill} />
        </>
      ),
      defs: foldDefs,
      shading: (uid) => (
        <>
          {/*
            The collar in the same light as the lapel. Shaded as an under
            collar it came out two dark tabs beside the neck; head-on it is the
            top collar you see, the same cloth facing the same way.
          */}
          {collarTone()}
          {foldShadows(uid, ROLL)}
        </>
      ),
      light: (uid) => foldLights(uid, ROLL),
    },
  },
};
