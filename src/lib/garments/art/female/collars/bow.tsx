import { foldDefs, foldLights, foldShadows, type Fold } from "@/lib/garments/folds";
import type { NecklineId } from "@/lib/garments/necklines";
import type { Pt } from "@/lib/garments/fit";
import { standBehind } from "../yoke";
import { BOW_CENTRE, bow } from "../collarCuts";
import { behindBandArt } from "../../behindBand";
import { collarTone } from "../../collarLight";
import type { GarmentArt, RegionArt } from "../../index";

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
 * Centred on her neck, at x 297, where the band round it is. The pieces are
 * cut in `collarCuts.ts` — see `bow` — so that `check:garments` measures the
 * same bow on every cut it is sewn to: tied at the throat on a high neckline,
 * and on a keyhole above the opening, its knot on the band and its tails
 * falling either side of the keyhole.
 *
 * Lit as every collar is — see `collarLight.tsx`: in the cloth's own colour,
 * no line round any piece. What passes under what is the soft shadow each
 * piece's edge throws on the one beneath it, the knot's on the loops and the
 * loops' on the tails; the folds of the pinch are soft, as a seam's are.
 *
 * Six pieces, each its own path, back to front: the band, the tails, the loops
 * and the knot. Overlapping subpaths of one path would cancel exactly where
 * the bow needs to be solid.
 */

const STAND_BEHIND_PATH = standBehind(8);

/** A fold's ridge, mirrored to the other half of the bow. */
const mirrorFold = (f: Fold): Fold => ({ ...f, ridge: f.ridge.map(([x, y]) => [2 * BOW_CENTRE - x, y]) });
/** A fold lifted with the knot and loops it lies on. */
const liftFold = (lift: number) => (f: Fold): Fold => ({ ...f, ridge: f.ridge.map(([x, y]) => [x, y - lift] as Pt) });

/**
 * The pinch: each loop gathered into the knot, its folds running out from
 * under it across the loop and opening as they go, three to a loop. Soft, as
 * a seam's folds are: the shadow of each about half what it was.
 */
const LOOP_FOLDS_LEFT: Fold[] = [
  { ridge: [[291, 187.4], [280, 183.4], [268, 180.2]], width: [0.7, 2.6], shadow: 0.26, light: 0.32, soft: 0.9 },
  { ridge: [[291, 191.2], [276, 190.2], [261.5, 189.6]], width: [0.7, 3], shadow: 0.24, light: 0.3, soft: 1 },
  { ridge: [[291, 194.8], [280, 196.6], [269, 198]], width: [0.7, 2.4], shadow: 0.25, light: 0.26, soft: 0.9 },
];
const LOOP_FOLDS: Fold[] = [...LOOP_FOLDS_LEFT, ...LOOP_FOLDS_LEFT.map(mirrorFold)];

/** The knot's wraps: two creases down it where the cloth is pulled round. */
const KNOT_FOLDS: Fold[] = [
  { ridge: [[294.2, 184], [293.6, 191], [294.4, 197.8]], width: [0.8, 0.8], shadow: 0.18, light: 0.22, soft: 0.8 },
  { ridge: [[300.4, 184], [301, 191], [300.2, 197.8]], width: [0.8, 0.8], shadow: 0.16, light: 0.2, soft: 0.8 },
];

/**
 * Each tail's one soft fold, from the pinch under the knot most of the way
 * down, and a short one beside it where it turns out of the knot — on the
 * tail as it falls on each cut.
 */
const TAIL_FOLDS_LEFT: Fold[] = [
  { ridge: [[294.2, 201], [289.4, 228], [282.2, 262]], width: [1.2, 2.6], shadow: 0.16, light: 0.18, soft: 1.4 },
  { ridge: [[290.6, 199.5], [288.4, 210], [286.8, 220]], width: [0.8, 1.6], shadow: 0.14, light: 0.14, soft: 1 },
];
const TAIL_FOLDS_LEFT_KEYHOLE: Fold[] = [
  { ridge: [[281.4, 196], [277.4, 228], [272.2, 262]], width: [1.2, 2.6], shadow: 0.16, light: 0.18, soft: 1.4 },
  { ridge: [[285.4, 190.6], [283.6, 198], [282.2, 206]], width: [0.8, 1.6], shadow: 0.14, light: 0.14, soft: 1 },
];
const tailFolds = (left: Fold[]): Fold[] => [...left, ...left.map(mirrorFold)];

/** The bow as it is tied on one cut. */
function collarOn(cut?: NecklineId): RegionArt {
  const b = bow(cut);
  const pieces = [b.band, ...b.tails, ...b.loops, b.knot];
  const loopFolds = LOOP_FOLDS.map(liftFold(b.lift));
  const knotFolds = KNOT_FOLDS.map(liftFold(b.lift));
  const tails = tailFolds(cut === "keyhole" ? TAIL_FOLDS_LEFT_KEYHOLE : TAIL_FOLDS_LEFT);
  return {
    focus: [300, 230],
    outline: "soft",
    /** Soft cloth cut on the bias, which is why it ties and drapes at all. */
    grain: { turn: 45 },
    shape: (fill) => (
      <>
        {pieces.map((d, i) => (
          <path key={i} d={d} fill={fill} />
        ))}
      </>
    ),
    defs: (uid) => (
      <>
        {foldDefs(uid)}
        {/* each piece's folds on that piece alone, never on what lies over it */}
        <mask id={uid("loops")} maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="1000">
          <path d={b.loops[0]} fill="#fff" />
          <path d={b.loops[1]} fill="#fff" />
          <path d={b.knot} fill="#000" />
        </mask>
        <mask id={uid("tails")} maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="1000">
          <path d={b.tails[0]} fill="#fff" />
          <path d={b.tails[1]} fill="#fff" />
          <path d={b.loops[0]} fill="#000" />
          <path d={b.loops[1]} fill="#000" />
          <path d={b.knot} fill="#000" />
        </mask>
      </>
    ),
    shading: (uid) => (
      <>
        {collarTone()}
        <g mask={`url(#${uid("tails")})`}>{foldShadows(uid, tails)}</g>
        <g mask={`url(#${uid("loops")})`}>{foldShadows(uid, loopFolds)}</g>
        {foldShadows(uid, knotFolds)}
      </>
    ),
    light: (uid) => (
      <>
        <g mask={`url(#${uid("tails")})`}>{foldLights(uid, tails)}</g>
        <g mask={`url(#${uid("loops")})`}>{foldLights(uid, loopFolds)}</g>
        {foldLights(uid, knotFolds)}
      </>
    ),
  };
}

/** The bow on each cut it has been tied on, drawn once. */
const onCut = new Map<string, RegionArt>();
const collarFor = (cut?: string): RegionArt => {
  const key = cut === "keyhole" ? "keyhole" : "";
  let r = onCut.get(key);
  if (!r) {
    r = collarOn(cut === "keyhole" ? "keyhole" : undefined);
    onCut.set(key, r);
  }
  return r;
};

export const bowCollarBehind = behindBandArt(STAND_BEHIND_PATH);

export const bowCollarFront: GarmentArt = {
  regions: { collar: collarFor() },
  /* on a keyhole, tied above the opening */
  cut: (choice) => ({ collar: collarFor(choice.neckline) }),
};
