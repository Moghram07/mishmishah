import {
  softShadow,
  vertical,
} from "@/lib/garments/shading";
import { blade, mirror, type Point } from "@/lib/garments/collar";
import { standBehind, standFront } from "../yoke";
import { behindBandArt } from "../../behindBand";
import type { GarmentArt } from "../../index";

/**
 * Bow collar: soft ties knotted at the throat, with two tails down the chest.
 *
 * The one collar here that is deeper than it is wide, and the only one whose
 * shape lives mostly *below* the neckline. The first attempt drew the bow as a
 * lump with two threads hanging off it; a bow is two loops, a knot, and two
 * tails that fall to the bust — that last measurement is the one that makes it
 * read as a bow rather than as a badge.
 *
 * Five pieces, each its own path. The loops overlap the knot, and overlapping
 * subpaths of one path would cancel exactly where the bow needs to be solid.
 */

const BAND_PATH = standFront(8);
const STAND_BEHIND_PATH = standBehind(8);

/**
 * The two loops. Each rises to a peak away from the knot, so the silhouette
 * dips between them: drawn as two even ovals they merge into one blob at the
 * throat and the bow stops reading as a bow.
 */
const LOOP_LEFT_PATH =
  "M294 194 C282 182 265 187 264 202 C263 218 275 231 294 224 Z";
const LOOP_RIGHT_PATH =
  "M306 194 C318 182 335 187 336 202 C337 218 325 231 306 224 Z";

/**
 * The knot, narrow, over both loops.
 *
 * Bowed on all four sides, because a knot is the one part of a bow under
 * tension: it is pinched in at the waist and swells top and bottom. Drawn as
 * the rectangle it was, it reads as a buckle.
 */
const KNOT: Point[] = [
  [292, 193],
  [308, 193],
  [311, 228],
  [289, 228],
];
const KNOT_BOWS = [1.5, -2, 1.5, -2];
const KNOT_PATH = blade(KNOT, KNOT_BOWS);

/**
 * The tails, falling to the bust at y 270 and a little past it.
 *
 * Soft silk hanging under its own weight does not fall in a straight line. The
 * long edges bow the same way, so the whole tail curves rather than tapering —
 * which is the difference between a ribbon and a pennant.
 */
const TAIL: Point[] = [
  [291, 224],
  [277, 276],
  [293, 283],
  [302, 232],
];
const TAIL_BOWS = [3, 1, 3, 0];
const TAIL_LEFT_PATH = blade(TAIL, TAIL_BOWS);
const TAIL_RIGHT_PATH = mirror(TAIL_LEFT_PATH);

const SILK: [number, string][] = [
  [0, "#ffffff"],
  [0.5, "#ededed"],
  [1, "#bcbcbc"],
];

const PIECES = [
  BAND_PATH,
  TAIL_LEFT_PATH,
  TAIL_RIGHT_PATH,
  LOOP_LEFT_PATH,
  LOOP_RIGHT_PATH,
  KNOT_PATH,
];

/**
 * Where each piece passes behind another.
 *
 * All six used to take the same flat `SILK` ramp, and the result was a bow
 * with no depth at all — a knot, two loops and two tails that were provably
 * five shapes and visibly one. A bow is almost entirely *occlusion*: the loops
 * disappear under the knot, the tails disappear under the loops, and it is
 * seeing one thing end behind another that tells you it is tied.
 *
 * Drawn as shapes rather than as lines, and shaded, so they survive a change of
 * cloth the way every other shadow here does.
 */
const UNDER_KNOT =
  "M288 196 C284 208 284 216 289 226 L311 226 C316 216 316 208 312 196 Z";
const UNDER_LOOP_LEFT =
  "M292 200 C286 196 278 195 272 198 C276 206 284 210 292 210 Z";

/** The whole bow dropped onto the chest. */
const BOW_CAST_PATH =
  "M264 206 C263 224 278 236 294 230 L281 282 L297 289 L306 238 " +
  "L323 282 L339 276 L310 230 C326 236 339 224 338 206 " +
  "C337 192 320 188 306 200 L294 200 C280 188 265 192 264 206 Z";

export const bowCollarBehind = behindBandArt(STAND_BEHIND_PATH);

export const bowCollarFront: GarmentArt = {
  regions: {
    collar: {
      focus: [300, 230],
      surface: { blur: 6, relief: 4, warp: 2 },
      /** Soft silk cut on the bias, which is why it ties and drapes at all. */
      grain: { turn: 45 },
      shape: (fill) => (
        <>
          {PIECES.map((d, i) => (
            <path key={i} d={d} fill={fill} />
          ))}
        </>
      ),
      defs: (uid) => (
        <>
          {vertical(uid("silk"), SILK)}
          {softShadow(uid("soft"), 4)}
        </>
      ),
      cast: (uid) => (
        <path
          d={BOW_CAST_PATH}
          fill="#7a7a7a"
          opacity="0.3"
          filter={`url(#${uid("soft")})`}
        />
      ),
      shading: (uid) => (
        <>
          {/* the tails, then what the loops throw over them */}
          <path d={TAIL_LEFT_PATH} fill={`url(#${uid("silk")})`} />
          <path d={TAIL_RIGHT_PATH} fill={`url(#${uid("silk")})`} />
          <path d={UNDER_LOOP_LEFT} fill="#8f8f8f" opacity="0.3" />
          {/* the loops, each modelled across itself: a loop is a tube */}
          {/* and what the knot throws over both of them */}
          <path d={UNDER_KNOT} fill="#8a8a8a" opacity="0.34" />
        </>
      ),
      /** The knot's edges, and the fold running down each tail. */
    },
  },
};
