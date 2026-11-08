import {
  softShadow,
  vertical,
} from "@/lib/garments/shading";
import { foldDefs, foldLights, foldShadows, type Fold } from "@/lib/garments/folds";
import { blade, mirror, nudge, type Point } from "@/lib/garments/collar";
import { standBehind, standFront } from "../yoke";
import { behindBandArt } from "../../behindBand";
import type { GarmentArt } from "../../index";

/**
 * Bow collar: a soft tie knotted at the throat, two loops and two long tails
 * lying flat down the chest.
 *
 * Soft cloth, not stuffing. It was drawn as two round loops, each lit as a
 * cushion, with tails as thick as the loops: a bow of balloons. A real one is
 * a strip of thin cloth, so every part of it is nearly flat — the loops are
 * flattened tubes, wider than they are tall, pinched into the knot, with the
 * folds of that pinch running out across them; the tails fall to the middle
 * of the chest and lie on the dress, their ends cut on a slant. Its form is
 * the folds and the occlusion — what passes under what — not a highlight.
 *
 * Centred on her neck, at x 297, where the band round it is: the old bow sat
 * three units right of its own band.
 *
 * Six pieces, each its own path, back to front: the band, the tails, the loops
 * and the knot. Overlapping subpaths of one path would cancel exactly where
 * the bow needs to be solid.
 */

const BAND_PATH = standFront(8);
const STAND_BEHIND_PATH = standBehind(8);

/** The neck's centre, which the bow is mirrored about. */
const CENTRE = 297.05;

/**
 * The left loop, round from where it leaves the knot: out along its top edge,
 * round its end, and back along its lower edge. About 6.6 cm long, 2.3 cm
 * tall where it is pinched into the knot and 4.5 cm at its end, tipped up a
 * little away from the knot — a flattened tube, not an oval.
 */
const LOOP_LEFT_PATH =
  "M292.5 185.2 C284.6 183.4 274.2 176 264.8 176.8 C258.6 177.4 256.4 183.6 257.3 189.4 " +
  "C258.3 195.8 262.6 200.4 270 200.4 C278.2 200.4 285.4 197.8 292.5 197.1 Z";
const LOOP_RIGHT_PATH = mirror(LOOP_LEFT_PATH, CENTRE);

/**
 * The knot, small and wrapped tight over both loops: pinched in at its sides,
 * where it is under the most tension, and swelling top and bottom. About
 * 2.9 cm across and 3.2 tall.
 */
const KNOT: Point[] = [
  [289.6, 182.4],
  [304.5, 182.4],
  [305.3, 199.2],
  [288.8, 199.2],
];
const KNOT_BOWS = [1.2, -1.5, 1.4, -1.5];
const KNOT_PATH = blade(KNOT, KNOT_BOWS);

/**
 * The left tail, from under the knot to the middle of her chest at y 284:
 * about 17 cm long and 2.7 wide, falling a little away from the other, and
 * cut on a slant at its end, its outer corner the lower. Its edges bend
 * gently, as soft cloth lying on a body does; it lies flat, so it is not
 * lit as a tube.
 */
const TAIL_LEFT_PATH =
  "M289.4 195.2 C286.4 221.8 279.6 252.6 271.6 284.4 " +
  "C276.6 282.2 281.6 279.8 286.6 277.4 " +
  "C287.6 255.4 292.6 226.2 298.2 196.4 Z";
const TAIL_RIGHT_PATH = mirror(TAIL_LEFT_PATH, CENTRE);

const PIECES = [
  BAND_PATH,
  TAIL_LEFT_PATH,
  TAIL_RIGHT_PATH,
  LOOP_LEFT_PATH,
  LOOP_RIGHT_PATH,
  KNOT_PATH,
];

/** Flat cloth: a whisper of light across it, darker only toward its lower end. */
const FLAT: [number, string][] = [
  [0, "#ffffff"],
  [0.7, "#f3f3f3"],
  [1, "#e2e2e2"],
];

/** A fold's ridge, mirrored to the other half of the bow. */
const mirrorFold = (f: Fold): Fold => ({ ...f, ridge: f.ridge.map(([x, y]) => [2 * CENTRE - x, y]) });

/**
 * The pinch: each loop gathered into the knot, its folds running out from
 * under it across the loop and opening as they go, three to a loop.
 */
const LOOP_FOLDS_LEFT: Fold[] = [
  { ridge: [[291, 187.4], [280, 183.4], [268, 180.2]], width: [0.7, 2.6], shadow: 0.5, light: 0.32, soft: 0.9 },
  { ridge: [[291, 191.2], [276, 190.2], [261.5, 189.6]], width: [0.7, 3], shadow: 0.44, light: 0.3, soft: 1 },
  { ridge: [[291, 194.8], [280, 196.6], [269, 198]], width: [0.7, 2.4], shadow: 0.48, light: 0.26, soft: 0.9 },
];
const LOOP_FOLDS: Fold[] = [...LOOP_FOLDS_LEFT, ...LOOP_FOLDS_LEFT.map(mirrorFold)];

/** The knot's wraps: two creases down it where the cloth is pulled round. */
const KNOT_FOLDS: Fold[] = [
  { ridge: [[294.2, 184], [293.6, 191], [294.4, 197.8]], width: [0.8, 0.8], shadow: 0.32, light: 0.22, soft: 0.8 },
  { ridge: [[300.4, 184], [301, 191], [300.2, 197.8]], width: [0.8, 0.8], shadow: 0.28, light: 0.2, soft: 0.8 },
];

/**
 * Each tail's one soft fold, from the pinch under the knot most of the way
 * down, and a short one beside it where it turns out of the knot.
 */
const TAIL_FOLDS_LEFT: Fold[] = [
  { ridge: [[294.2, 201], [289.4, 228], [282.2, 262]], width: [1.2, 2.6], shadow: 0.26, light: 0.18, soft: 1.4 },
  { ridge: [[290.6, 199.5], [288.4, 210], [286.8, 220]], width: [0.8, 1.6], shadow: 0.22, light: 0.14, soft: 1 },
];
const TAIL_FOLDS: Fold[] = [...TAIL_FOLDS_LEFT, ...TAIL_FOLDS_LEFT.map(mirrorFold)];

/**
 * Where each piece passes under another: the knot's shadow on the loops, and
 * the loops' on the tops of the tails. A bow is almost entirely occlusion —
 * seeing one thing end behind another is what tells you it is tied.
 */
const UNDER_KNOT =
  "M287.8 184.6 C285.6 190 285.6 194.8 287.6 200.6 L306.4 200.6 C308.4 194.8 308.4 190 306.2 184.6 Z";
const UNDER_LOOP_LEFT =
  "M273 199 C279 201.2 286 201.4 292.5 200 L293.5 205.6 C286.5 206.6 280.5 205.6 275.2 203.4 Z";
const UNDER_LOOP_RIGHT = mirror(UNDER_LOOP_LEFT, CENTRE);

/**
 * What the bow throws on the dress: each piece's own outline, dropped a
 * little. Lying flat, it throws little — close under it, and soft.
 */
const CASTS = [TAIL_LEFT_PATH, TAIL_RIGHT_PATH, LOOP_LEFT_PATH, LOOP_RIGHT_PATH, KNOT_PATH].map((d) => nudge(d, 0.6, 1.4));

export const bowCollarBehind = behindBandArt(STAND_BEHIND_PATH);

export const bowCollarFront: GarmentArt = {
  regions: {
    collar: {
      focus: [300, 230],
      /* thin cloth: the edges turn a little, the middle stays flat */
      surface: { blur: 3, relief: 1.4, warp: 2 },
      /** Soft cloth cut on the bias, which is why it ties and drapes at all. */
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
          {vertical(uid("flat"), FLAT)}
          {softShadow(uid("soft"), 1.6)}
          {softShadow(uid("under"), 1.2)}
          {foldDefs(uid)}
          {/* what each shadow may fall on: never the piece that throws it */}
          <mask id={uid("no-knot")} maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="1000">
            <rect x="0" y="0" width="600" height="1000" fill="#fff" />
            <path d={KNOT_PATH} fill="#000" />
          </mask>
          <mask id={uid("loops")} maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="1000">
            <path d={LOOP_LEFT_PATH} fill="#fff" />
            <path d={LOOP_RIGHT_PATH} fill="#fff" />
            <path d={KNOT_PATH} fill="#000" />
          </mask>
          <mask id={uid("tails")} maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="1000">
            <path d={TAIL_LEFT_PATH} fill="#fff" />
            <path d={TAIL_RIGHT_PATH} fill="#fff" />
            <path d={LOOP_LEFT_PATH} fill="#000" />
            <path d={LOOP_RIGHT_PATH} fill="#000" />
            <path d={KNOT_PATH} fill="#000" />
          </mask>
        </>
      ),
      cast: (uid) => (
        <g filter={`url(#${uid("soft")})`} fill="#6e6e6e" opacity="0.3">
          {CASTS.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      ),
      shading: (uid) => (
        <>
          {/* the tails, flat, their folds, and the loops' shadow close under their lower edges */}
          <g mask={`url(#${uid("tails")})`}>
            <path d={TAIL_LEFT_PATH} fill={`url(#${uid("flat")})`} />
            <path d={TAIL_RIGHT_PATH} fill={`url(#${uid("flat")})`} />
            {foldShadows(uid, TAIL_FOLDS)}
            <g filter={`url(#${uid("under")})`} fill="#8a8a8a" opacity="0.4">
              <path d={UNDER_LOOP_LEFT} />
              <path d={UNDER_LOOP_RIGHT} />
            </g>
          </g>
          {/* the loops, pinched into the knot */}
          <g mask={`url(#${uid("loops")})`}>{foldShadows(uid, LOOP_FOLDS)}</g>
          {/* the knot's shadow on whatever it lies over, then its own wraps */}
          <g mask={`url(#${uid("no-knot")})`}>
            <path d={UNDER_KNOT} fill="#8a8a8a" opacity="0.3" filter={`url(#${uid("under")})`} />
          </g>
          {foldShadows(uid, KNOT_FOLDS)}
        </>
      ),
      light: (uid) => (
        <>
          <g mask={`url(#${uid("tails")})`}>{foldLights(uid, TAIL_FOLDS)}</g>
          <g mask={`url(#${uid("loops")})`}>{foldLights(uid, LOOP_FOLDS)}</g>
          {foldLights(uid, KNOT_FOLDS)}
        </>
      ),
    },
  },
};
