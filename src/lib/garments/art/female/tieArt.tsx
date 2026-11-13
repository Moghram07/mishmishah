import { FLAT_COLLAR_SHADOW, collarTone, edgeLight, edgeLightDefs } from "../collarLight";
import { foldDefs, foldLights, foldShadows, type Fold } from "@/lib/garments/folds";
import type { Pt } from "@/lib/garments/fit";
import type { RegionArt } from "../index";
import { scarfFolds, tieAt, type FoldSpec, type TieStyle } from "./ties";

/**
 * A tie drawn at a point — see `tieAt` in `ties.ts` for its pieces: lit as a
 * flat collar is, cut on the bias; each piece throws the flat collar's soft
 * shadow on what it lies on — the knot on the loops, the tails and the
 * blade, the loops on the tails — and its folds stay on it. In a cloth of
 * its own, which it arrives in — see `setTie`.
 */

/** Its folds, written relative to its point, left side only where they are mirrored. */
type FoldAt = [ridge: Pt[], width: [number, number], shadow: number, light: number, soft: number];
const KNOT_LOOP_FOLDS: FoldAt[] = [
  [[[-4, -1.2], [-9, -2.2], [-13.4, -3.2]], [0.5, 1.4], 0.26, 0.3, 0.7],
  [[[-4, 2.2], [-9, 3], [-13.4, 3.8]], [0.5, 1.4], 0.24, 0.28, 0.7],
];
const KNOT_FOLDS: FoldAt[] = [
  [[[-1.8, -2.6], [-2.1, 1], [-1.6, 4.6]], [0.5, 0.5], 0.18, 0.22, 0.6],
  [[[1.9, -2.6], [2.2, 1], [1.7, 4.6]], [0.5, 0.5], 0.16, 0.2, 0.6],
];
const KNOT_TAIL_FOLDS: FoldAt[] = [[[[-2, 6], [-4.6, 16], [-7.4, 26]], [0.8, 1.6], 0.14, 0.16, 1]];
const NECKTIE_FOLDS: FoldAt[] = [[[[0.6, 9], [0, 32], [0.8, 58]], [0.8, 2.4], 0.14, 0.18, 1.2]];
const NECKTIE_KNOT_FOLDS: FoldAt[] = [
  [[[-2.6, -3], [-2.4, 1.5], [-1.8, 6.4]], [0.6, 0.6], 0.18, 0.22, 0.6],
  [[[2.8, -3], [2.6, 1.5], [2, 6.4]], [0.6, 0.6], 0.16, 0.2, 0.6],
];

const cache = new Map<string, RegionArt>();

/** A tie of a style at a point, as a region of its garment — one per style and point. */
export function tieArt(style: TieStyle, point: Pt): RegionArt {
  const key = `${style}|${point[0]}|${point[1]}`;
  let r = cache.get(key);
  if (r) return r;
  const { pieces, parts } = tieAt(style, point);
  const fold = ([ridge, width, shadow, light, soft]: FoldAt): Fold => ({ ridge: ridge.map(([x, y]) => [point[0] + x, point[1] + y] as Pt), width, shadow, light, soft });
  const mirrored = (f: Fold): Fold => ({ ...f, ridge: f.ridge.map(([x, y]) => [2 * point[0] - x, y] as Pt) });
  const both = (list: FoldAt[]): Fold[] => list.map(fold).flatMap((f) => [f, mirrored(f)]);
  const folds =
    style === "knot"
      ? { tails: both(KNOT_TAIL_FOLDS), under: both(KNOT_LOOP_FOLDS), knot: KNOT_FOLDS.map(fold) }
      : style === "scarf"
        ? (() => {
            /* the scarf's own, laid on its pieces — its two tails are not alike */
            const { tails, knot } = scarfFolds(point);
            const asFold = ([ridge, width, shadow, light, soft]: FoldSpec): Fold => ({ ridge, width, shadow, light, soft });
            return { tails: tails.map(asFold), under: [] as Fold[], knot: knot.map(asFold) };
          })()
        : { tails: [] as Fold[], under: NECKTIE_FOLDS.map(fold), knot: NECKTIE_KNOT_FOLDS.map(fold) };
  const tailed = Boolean(parts.tails);
  r = {
    focus: [Math.round(point[0]), point[1] + 10],
    outline: "soft",
    /** Cut on the bias, which is why a tie ties and drapes at all. */
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
        {edgeLightDefs(uid)}
        {/* each piece's folds on that piece alone, never on what lies over it */}
        <mask id={uid("under-knot")} maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="1000">
          {pieces.slice(0, -1).map((d, i) => (
            <path key={i} d={d} fill="#fff" />
          ))}
          <path d={parts.knot} fill="#000" />
        </mask>
        {tailed && parts.tails && (
          <mask id={uid("tails")} maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="1000">
            {parts.tails.map((d, i) => (
              <path key={i} d={d} fill="#fff" />
            ))}
            {[...(parts.loops ?? []), parts.knot].map((d, i) => (
              <path key={`o${i}`} d={d} fill="#000" />
            ))}
          </mask>
        )}
      </>
    ),
    shading: (uid) => (
      <>
        {collarTone()}
        {tailed ? (
          <>
            <g mask={`url(#${uid("tails")})`}>{foldShadows(uid, folds.tails)}</g>
            {folds.under.length > 0 && <g mask={`url(#${uid("under-knot")})`}>{foldShadows(uid, folds.under)}</g>}
            {foldShadows(uid, folds.knot)}
          </>
        ) : (
          <>
            <g mask={`url(#${uid("under-knot")})`}>{foldShadows(uid, folds.under)}</g>
            {foldShadows(uid, folds.knot)}
          </>
        )}
      </>
    ),
    light: (uid) => (
      <>
        {edgeLight(uid, ...pieces)}
        {tailed ? (
          <>
            <g mask={`url(#${uid("tails")})`}>{foldLights(uid, folds.tails)}</g>
            {folds.under.length > 0 && <g mask={`url(#${uid("under-knot")})`}>{foldLights(uid, folds.under)}</g>}
            {foldLights(uid, folds.knot)}
          </>
        ) : (
          <>
            <g mask={`url(#${uid("under-knot")})`}>{foldLights(uid, folds.under)}</g>
            {foldLights(uid, folds.knot)}
          </>
        )}
      </>
    ),
    shadow: FLAT_COLLAR_SHADOW,
  };
  cache.set(key, r);
  return r;
}
