/*
  Plain `.ts`, relative and extensioned, and no JSX — so `scripts/
  check-edges.mjs` can import it and measure the same ties the app draws.

  The ties: a small tied bow, a necktie and a scarf, each drawn at a point
  — the centre front of a neck, a fabric belt's front or its side — and
  hanging down from it. One drawing for every place, so a tie looks the same
  wherever it is knotted; see `dressPoints` in `dressCut.ts` for the points.
*/
import { blade, mirror, type Point } from "../../collar.ts";
import type { Pt } from "../../fit.ts";

export type TieStyle = "knot" | "necktie" | "scarf";

/** A piece written relative to its point, left side only: its corners, anticlockwise, and how far each side bows — see `blade`. */
interface Piece {
  corners: [number, number][];
  bows: number[];
}

/**
 * The knot: a small tied bow, about 7 cm across — a knot 1.7 cm across, two
 * loops pinched into it, each 2.4 cm long and twice as tall at its end as at
 * the knot, and two short tails, 5 cm, falling from under it and cut on a
 * slant, the outer corner lower. Written left side only and reflected about
 * the point, each piece anticlockwise, so a positive bow is convex.
 */
const KNOT: Piece = { corners: [[-4.5, -3.6], [-3.6, 5.6], [3.6, 5.6], [4.5, -3.6]], bows: [1.2, 0.8, 1.2, 0.8] };
const KNOT_LOOP: Piece = { corners: [[-3.8, -2.6], [-16.2, -5.6], [-15, 6.2], [-3.8, 4.6]], bows: [1.3, 3.6, 1.3, 0] };
const KNOT_TAIL: Piece = { corners: [[-4.6, 3.4], [-10.6, 29.4], [-3.4, 26.6], [0.4, 3.4]], bows: [1, 0, -0.6, 0] };

/**
 * The necktie: a knot at the point, 2.5 cm across at the top and narrowing
 * under it, and its blade hanging down the centre from under the knot,
 * widening to 5.5 cm and ending in a point 12.5 cm below — cut on the bias,
 * as a tie is, and lying flat.
 */
const NECKTIE_KNOT: Piece = { corners: [[-6.6, -4], [-4.2, 7.2], [4.2, 7.2], [6.6, -4]], bows: [0.8, 0.6, 0.8, 0.6] };
const NECKTIE_BLADE: Piece = { corners: [[-4.4, 5], [-14.6, 46], [0, 66], [14.6, 46], [4.4, 5]], bows: [1.2, 0.8, 0.8, 1.2, 0] };

/**
 * The scarf «وشاح», as photo 1's: soft cloth tied in front, not ribbon.
 *
 * - **The knot** is soft and full, about 5.3 cm across and 4.3 tall, every
 *   side bowed out — cloth bunched round itself, not a square.
 * - **Two broad tails** fall from under it and splay apart, each widening
 *   from 2.3 cm at the knot to 4.6 and 4.2 cm at its end, and **not the
 *   same**: her right one, on the left here, 12 cm long, the other 10 cm, as
 *   a knotted scarf's ends never are.
 * - **Each a little curved:** its outer edge hollowed and its inner edge
 *   full, so it swings out as it falls, as soft cloth hangs.
 * - **Cut on a slant**, the outer corner lower.
 *
 * Each tail written as a left one, anticlockwise from its top outer corner,
 * the shorter then reflected — see `blade` for the bows' sign. Its folds are
 * laid on its own corners: see `scarfFolds`.
 */
const SCARF_KNOT: Piece = { corners: [[-12, -5.5], [-10.5, 12.5], [10.5, 13], [12.5, -5]], bows: [2.6, 2.4, 2.6, 2] };
const SCARF_LONG: Piece = { corners: [[-10, 7], [-42, 69], [-18.5, 63], [2, 10]], bows: [-5, 0.8, 6, 0] };
const SCARF_SHORT: Piece = { corners: [[-9.5, 7.5], [-35, 58], [-13, 54.5], [2.5, 10.5]], bows: [-4.2, 0.6, 5, 0] };
export const SCARF = { knot: SCARF_KNOT, long: SCARF_LONG, short: SCARF_SHORT };

/** A fold as the drawing takes it — see `Fold` in `folds.tsx`: its ridge, width from end to end, shadow, light and softness. */
export type FoldSpec = [ridge: Pt[], width: [number, number], shadow: number, light: number, soft: number];

/**
 * The scarf's folds, laid on its own pieces at a point: down each tail a
 * lit crease and a shaded one, fanning out with it, and a gather where it
 * comes out from under the knot; on the knot, three short gathers drawn in
 * to its middle, where it is pulled tight.
 */
export function scarfFolds(at: Pt): { tails: FoldSpec[]; knot: FoldSpec[] } {
  const on = (p: Piece, flip: boolean) => {
    const [a, b, c, d] = p.corners;
    /* a point `u` across the tail, outer edge to inner, and `v` down it */
    const pt = (u: number, v: number): Pt => {
      const top = [a[0] + (d[0] - a[0]) * u, a[1] + (d[1] - a[1]) * u];
      const end = [b[0] + (c[0] - b[0]) * u, b[1] + (c[1] - b[1]) * u];
      const x = top[0] + (end[0] - top[0]) * v;
      return [at[0] + (flip ? -x : x), at[1] + top[1] + (end[1] - top[1]) * v];
    };
    const line = (u0: number, u1: number, v0: number, v1: number): Pt[] => [0, 0.5, 1].map((k) => pt(u0 + (u1 - u0) * k, v0 + (v1 - v0) * k));
    return [
      [line(0.42, 0.36, 0.2, 0.92), [0.8, 2.8], 0.1, 0.24, 1.6],
      [line(0.7, 0.76, 0.26, 0.95), [0.6, 2.2], 0.26, 0.06, 1.6],
      [line(0.52, 0.5, 0.06, 0.3), [3, 0.6], 0.34, 0.05, 1.6],
    ] as FoldSpec[];
  };
  const k = (ridge: [number, number][]): Pt[] => ridge.map(([x, y]) => [at[0] + x, at[1] + y] as Pt);
  return {
    tails: [...on(SCARF_LONG, false), ...on(SCARF_SHORT, true)],
    knot: [
      [k([[-9.5, -3], [-5.5, 1.5], [-2, 4.5]]), [0.9, 0.4], 0.22, 0.2, 0.9],
      [k([[9.5, -2.5], [5.5, 1.8], [2, 4.6]]), [0.9, 0.4], 0.2, 0.18, 0.9],
      [k([[0.5, 12.5], [0.2, 9], [0, 6]]), [0.8, 0.4], 0.2, 0.14, 0.9],
      [k([[-10, 11], [0, 14], [10, 11.5]]), [2.4, 2.4], 0.16, 0, 1.6],
    ],
  };
}

/** A piece laid at a point. */
const placed = ({ corners, bows }: Piece, at: Pt): string => blade(corners.map(([x, y]) => [at[0] + x, at[1] + y] as Point), bows);

/** A tie's pieces, back to front, and which is which. */
export interface TiePieces {
  pieces: string[];
  parts: { tails?: string[]; loops?: string[]; knot: string; blade?: string };
}

/**
 * A tie of a style, knotted at a point and hanging down from it: each piece
 * closed, its own path, back to front — tails, then loops, then the knot on
 * top; or a necktie's blade, then its knot.
 */
export function tieAt(style: TieStyle, at: Pt): TiePieces {
  if (style === "necktie") {
    const bladePath = placed(NECKTIE_BLADE, at);
    const knot = placed(NECKTIE_KNOT, at);
    return { pieces: [bladePath, knot], parts: { blade: bladePath, knot } };
  }
  if (style === "scarf") {
    /* the longer tail, then the shorter reflected to the other side, then the knot over both */
    const tails = [placed(SCARF_LONG, at), mirror(placed(SCARF_SHORT, at), at[0])];
    const knot = placed(SCARF_KNOT, at);
    return { pieces: [...tails, knot], parts: { tails, knot } };
  }
  const tail = placed(KNOT_TAIL, at);
  const tails = [tail, mirror(tail, at[0])];
  const knot = placed(KNOT, at);
  const loop = placed(KNOT_LOOP, at);
  const loops = [loop, mirror(loop, at[0])];
  return { pieces: [...tails, ...loops, knot], parts: { tails, loops, knot } };
}

/** How far below its point each style hangs, in canvas units: the lowest of its pieces. */
export const TIE_DROP: Record<TieStyle, number> = { knot: 29.4, necktie: 66, scarf: 69 };
