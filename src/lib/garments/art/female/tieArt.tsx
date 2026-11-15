import type { ReactNode } from "react";
import { FLAT_COLLAR_SHADOW, collarTone, edgeLight, edgeLightDefs } from "../collarLight";
import { foldDefs, foldLights, foldShadows, type Fold } from "@/lib/garments/folds";
import { FLAT_LIT, type Uid } from "@/lib/garments/shading";
import type { Pt } from "@/lib/garments/fit";
import type { RegionArt } from "../index";
import type { TieAtId } from "@/types";
import { bowAt, scarfFolds, tieAt, type BowPieces, type FoldSpec, type TieStyle } from "./ties";
import { SASHES } from "@/lib/garments/closures";

/**
 * A tie drawn at a point — see `tieAt` in `ties.ts` for its pieces, sized
 * for where it is knotted: lit as a flat collar is, cut on the bias; each
 * piece throws the flat collar's soft shadow on what it lies on — the knot
 * on the loops, the tails and the blade, the loops on the tails — and its
 * folds stay on it. In a cloth of its own, which it arrives in — see
 * `setTie`. A knot tied on a belt is the belt bow, drawn as every sash's
 * bow is: see `bowLayers`.
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

/* -------------------------------------------------------------- the belt bow */

/** The light along a bow's edges: a fine line just inside each, barely softened — on dark cloth it is the edge. */
const CRISP_EDGE = { width: 1.1, opacity: 0.14, soft: 0.4 } as const;

/**
 * The shadow a bow's edges throw on what they lie on: narrow and sharp, so on
 * a print it draws the edge rather than smudging the cloth round it — the
 * flat collar's, 5 units wide and blurred 3, read on a dark or printed bow
 * as the whole bow out of focus.
 */
export const BOW_SHADOW = { opacity: 0.55, width: 2.4, soft: 0.8 } as const;

/** The blur the bow's edge light is drawn through. In `bowLayers`' defs. */
const crispEdgeDefs = (uid: Uid): ReactNode => (
  <filter id={uid("crisp-edge")} filterUnits="userSpaceOnUse" x="0" y="0" width="600" height="1000" colorInterpolationFilters="sRGB">
    <feGaussianBlur stdDeviation={CRISP_EDGE.soft} />
  </filter>
);

/** The fine light along edges, stroked twice its width: masked to what shows of the piece, the half inside it is what is left. */
export const crispEdgeLight = (uid: Uid, edges: string[]): ReactNode => (
  <g
    filter={`url(#${uid("crisp-edge")})`}
    fill="none"
    stroke="#ffffff"
    strokeOpacity={CRISP_EDGE.opacity}
    strokeWidth={CRISP_EDGE.width * 2}
    strokeLinejoin="round"
  >
    {edges.map((d, i) => (
      <path key={i} d={d} />
    ))}
  </g>
);

/**
 * How the belt bow is lit — the knot a tie makes on a belt and every sash's
 * bow alike, see `bowAt`: flat, as a collar is, and crisp in any cloth. Each
 * piece in the flat tone; its folds, each a crisp crest over a broad soft
 * turn, and the fine light along its edges laid only on what shows of it —
 * never on a piece lying over it, where a hidden edge's light used to show
 * on dark cloth as a pale line across the bow. The narrow shadow under its
 * edges is the region's: `BOW_SHADOW`.
 */
export function bowLayers(bow: BowPieces): { defs: (uid: Uid) => ReactNode; shading: (uid: Uid) => ReactNode; light: (uid: Uid) => ReactNode } {
  const asFold = ([ridge, width, shadow, light, soft]: FoldSpec): Fold => ({ ridge, width, shadow, light, soft });
  const { tails, loops, knot } = bow.parts;
  /* what shows of each part: it, less every part drawn over it */
  const parts = [
    ...tails.map((d, i) => ({ id: `bow-tail-${i}`, pieces: [d], over: [...tails.slice(i + 1), ...loops, knot], folds: bow.folds.tails[i].map(asFold) })),
    { id: "bow-loops", pieces: loops, over: [knot], folds: bow.folds.loops.map(asFold) },
    { id: "bow-knot", pieces: [knot], over: [] as string[], folds: bow.folds.knot.map(asFold) },
  ];
  return {
    defs: (uid) => (
      <>
        {foldDefs(uid)}
        {crispEdgeDefs(uid)}
        {parts.map((p) => (
          <mask key={p.id} id={uid(p.id)} maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="1000">
            {p.pieces.map((d, i) => (
              <path key={i} d={d} fill="#fff" />
            ))}
            {p.over.map((d, i) => (
              <path key={`o${i}`} d={d} fill="#000" />
            ))}
          </mask>
        ))}
      </>
    ),
    shading: (uid) => (
      <>
        {bow.pieces.map((d, i) => (
          <path key={i} d={d} fill={FLAT_LIT} />
        ))}
        {parts.map((p) => (
          <g key={p.id} mask={`url(#${uid(p.id)})`}>
            {foldShadows(uid, p.folds)}
          </g>
        ))}
      </>
    ),
    light: (uid) => (
      <>
        {parts.map((p) => (
          <g key={p.id} mask={`url(#${uid(p.id)})`}>
            {crispEdgeLight(uid, p.pieces)}
            {foldLights(uid, p.folds)}
          </g>
        ))}
      </>
    ),
  };
}

/* ------------------------------------------------------------------ the ties */

/**
 * A tie's folds at a point — see `tieAt`: down its tails, on what lies under
 * its knot (the loops, a necktie's blade), and on the knot itself. The small
 * knot's, a necktie's, and a scarf's at the neck or on a belt; a knot on a
 * belt is the belt bow, whose folds are its own — see `bowAt`.
 */
export function tieFolds(style: TieStyle, point: Pt, where: TieAtId = "neck"): { tails: Fold[]; under: Fold[]; knot: Fold[] } {
  const fold = ([ridge, width, shadow, light, soft]: FoldAt): Fold => ({ ridge: ridge.map(([x, y]) => [point[0] + x, point[1] + y] as Pt), width, shadow, light, soft });
  const mirrored = (f: Fold): Fold => ({ ...f, ridge: f.ridge.map(([x, y]) => [2 * point[0] - x, y] as Pt) });
  const both = (list: FoldAt[]): Fold[] => list.map(fold).flatMap((f) => [f, mirrored(f)]);
  const asFold = ([ridge, width, shadow, light, soft]: FoldSpec): Fold => ({ ridge, width, shadow, light, soft });
  if (style === "necktie") return { tails: [], under: NECKTIE_FOLDS.map(fold), knot: NECKTIE_KNOT_FOLDS.map(fold) };
  if (style === "scarf") {
    /* the scarf's own, laid on its pieces — its two tails are not alike */
    const { tails, knot } = scarfFolds(point, where);
    return { tails: tails.map(asFold), under: [], knot: knot.map(asFold) };
  }
  return { tails: both(KNOT_TAIL_FOLDS), under: both(KNOT_LOOP_FOLDS), knot: KNOT_FOLDS.map(fold) };
}

/** A tie of a style at a point, as a region of its garment — one per style, point and place, and for a bow on a belt whether the skirt is a narrow one. */
export function tieArt(style: TieStyle, point: Pt, where: TieAtId = "neck", narrow = false): RegionArt {
  const key = `${style}|${point[0]}|${point[1]}|${where}${narrow ? "|narrow" : ""}`;
  let r = cache.get(key);
  if (r) return r;
  if (style === "knot" && where !== "neck") {
    /* a knot tied on a belt is the belt bow, lit as every sash's bow is */
    const bow = bowAt(point, where === "belt-side" ? "side" : "front", SASHES.sash.width, narrow);
    r = {
      focus: [Math.round(point[0]), point[1] + 24],
      outline: "soft",
      /** Cut on the bias, which is why a tie ties and drapes at all. */
      grain: { turn: 45 },
      shape: (fill) => (
        <>
          {bow.pieces.map((d, i) => (
            <path key={i} d={d} fill={fill} />
          ))}
        </>
      ),
      ...bowLayers(bow),
      shadow: BOW_SHADOW,
    };
    cache.set(key, r);
    return r;
  }
  const { pieces, parts } = tieAt(style, point, where);
  const folds = tieFolds(style, point, where);
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
