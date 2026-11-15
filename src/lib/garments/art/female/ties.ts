/*
  Plain `.ts`, relative and extensioned, and no JSX — so `scripts/
  check-edges.mjs` can import it and measure the same ties the app draws.

  The ties: a small tied bow, a necktie and a scarf, each drawn at a point
  — the centre front of a neck, a fabric belt's front or its side — and
  hanging down from it; see `dressPoints` in `dressCut.ts` for the points.
  **A tie's size depends on where it is knotted:** at the neck the knot is a
  small bow and the scarf's tails fall a hand's length; on a belt the knot is
  the belt bow — see `bowAt` — and the scarf is knotted in a sash's cloth
  with its tails to the knee. And the belt bow is what a sash is tied in,
  whatever its width — see `sashOn` in `dressCut.ts`.
*/
import { blade, mirror, type Point } from "../../collar.ts";
import { outline, run, type Pt } from "../../fit.ts";
import { BOW_REACH, SASHES } from "../../closures.ts";
import type { BowAtId, TieAtId } from "@/types";

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

/**
 * The scarf knotted on a belt: a sash's cloth tied in the same knot, and so
 * bigger all round — the knot about 6 cm across, the two tails 36 and 31 cm,
 * as wide as a sash at their ends, 6 cm, and splayed less for their length,
 * as long cloth hangs; curved and cut on a slant as the small one's are.
 */
const BELT_SCARF_KNOT: Piece = { corners: [[-16.2, -7.4], [-14.2, 16.9], [14.2, 17.6], [16.9, -6.8]], bows: [3.5, 3.2, 3.5, 2.7] };
const BELT_SCARF_LONG: Piece = { corners: [[-14, 10], [-41, 200], [-9, 192], [3, 14]], bows: [-6, 1, 7, 0] };
const BELT_SCARF_SHORT: Piece = { corners: [[-13, 10.5], [-37, 172], [-6, 165], [3.5, 14.5]], bows: [-5, 0.8, 6, 0] };
export const BELT_SCARF = { knot: BELT_SCARF_KNOT, long: BELT_SCARF_LONG, short: BELT_SCARF_SHORT };

/** The scarf's pieces where it is knotted: the small one at the neck, the sash-sized one on a belt. */
const scarfFor = (where: TieAtId) => (where === "neck" ? SCARF : BELT_SCARF);

/** A fold as the drawing takes it — see `Fold` in `folds.tsx`: its ridge, width from end to end, shadow, light and softness. */
export type FoldSpec = [ridge: Pt[], width: [number, number], shadow: number, light: number, soft: number];

/**
 * The scarf's folds, laid on its own pieces at a point: down each tail a
 * lit crease and a shaded one, fanning out with it, and a gather where it
 * comes out from under the knot; on the knot, three short gathers drawn in
 * to its middle, where it is pulled tight.
 */
export function scarfFolds(at: Pt, where: TieAtId = "neck"): { tails: FoldSpec[]; knot: FoldSpec[] } {
  const { long, short } = scarfFor(where);
  /* the belt's knot is the neck's, a third bigger: its gathers with it */
  const s = where === "neck" ? 1 : 1.35;
  const k = (ridge: [number, number][]): Pt[] => ridge.map(([x, y]) => [at[0] + x * s, at[1] + y * s] as Pt);
  return {
    tails: [...tailFolds(long, at, false), ...tailFolds(short, at, true)],
    knot: [
      [k([[-9.5, -3], [-5.5, 1.5], [-2, 4.5]]), [0.9 * s, 0.4 * s], 0.22, 0.2, 0.9],
      [k([[9.5, -2.5], [5.5, 1.8], [2, 4.6]]), [0.9 * s, 0.4 * s], 0.2, 0.18, 0.9],
      [k([[0.5, 12.5], [0.2, 9], [0, 6]]), [0.8 * s, 0.4 * s], 0.2, 0.14, 0.9],
      [k([[-10, 11], [0, 14], [10, 11.5]]), [2.4 * s, 2.4 * s], 0.16, 0, 1.6],
    ],
  };
}

/**
 * A tail's folds, laid on its own corners at a point — the long ones the
 * scarf's and the belt bow's alike: down it a lit crease and a shaded one,
 * fanning out with it, and a gather where it comes out from under the knot.
 * `flip` lays them on the tail reflected to the other side.
 */
function tailFolds(p: Piece, at: Pt, flip: boolean, scale = 1): FoldSpec[] {
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
    [line(0.42, 0.36, 0.2, 0.92), [0.8 * scale, 2.8 * scale], 0.1, 0.24, 1.6 * scale],
    [line(0.7, 0.76, 0.26, 0.95), [0.6 * scale, 2.2 * scale], 0.26, 0.06, 1.6 * scale],
    [line(0.52, 0.5, 0.06, 0.3), [3 * scale, 0.6 * scale], 0.34, 0.05, 1.6 * scale],
  ] as FoldSpec[];
}

/** A piece laid at a point. */
const placed = ({ corners, bows }: Piece, at: Pt): string => blade(corners.map(([x, y]) => [at[0] + x, at[1] + y] as Point), bows);

/** A tie's pieces, back to front, and which is which. */
export interface TiePieces {
  pieces: string[];
  parts: { tails?: string[]; loops?: string[]; knot: string; blade?: string };
}

/** The belt bow's pieces, with its folds laid on them, the line each tail hangs along and how far its loops reach. */
export interface BowPieces extends TiePieces {
  /** Its tails back to front — the longer, crossing over the other, last — then its loops, then its knot. */
  parts: { tails: string[]; loops: string[]; knot: string };
  /** Its folds: each tail's own, back to front; both loops'; the knot's. */
  folds: { tails: FoldSpec[][]; loops: FoldSpec[]; knot: FoldSpec[] };
  /** The line down the middle of each tail, from under the knot to its end, back to front. */
  tailLines: Pt[][];
  /** How its tails' ends are cut: on a slant, the outer corner lower — a sash's — or notched in a V, a ribbon's. */
  ends: "slant" | "notch";
  reach: number;
  width: number;
}

/** How a tail falls: the angle from vertical it leaves the knot at, in degrees, and the share of it it eases off toward vertical by its end. */
export interface TailFall {
  angle: number;
  ease: number;
}

/**
 * How the belt bow's two tails fall, by where it is tied — and at the front
 * by the skirt: which way the longer falls (1 to the right here, her left),
 * and each one's fall.
 *
 * - **At the front** they spread in an upside-down V, as photo 1's, as far
 *   as the skirt has room for: over a full skirt about 25° from vertical,
 *   clear of her hands; over a narrow one, a pencil or a mermaid — see
 *   `NARROW_SKIRTS` — about 20°, still on the skirt.
 * - **At her side** the longer falls in over the front of the skirt, about
 *   25°; the shorter leaves the knot about 19° out toward her side and eases
 *   toward vertical as it falls — any further out and it runs off her waist
 *   and onto her arm, which is drawn again over the clothes.
 */
export const BOW_TAIL_SPREAD: Record<"front" | "narrow" | "side", { longDir: -1 | 1; long: TailFall; short: TailFall }> = {
  front: { longDir: 1, long: { angle: 25.5, ease: 0.1 }, short: { angle: 26, ease: 0.1 } },
  narrow: { longDir: 1, long: { angle: 20, ease: 0.1 }, short: { angle: 21, ease: 0.1 } },
  side: { longDir: -1, long: { angle: 26, ease: 0.1 }, short: { angle: 19, ease: 0.6 } },
};

/** How far below the knot the belt bow's two tails reach along their length, in canvas units: 36 cm, the one crossing in front, and 32 cm. */
export const BOW_TAILS: readonly [number, number] = [190, 170];

/** Cloth narrower than this — a ribbon — is notched in a V at its ends; a sash is cut on a slant. */
const NOTCHED_UNDER = 20;

/** How wide a tail is along it, as a share of its cloth: gathered under the knot, full, narrowed where it twists, full again to its end. */
const TAIL_WIDTH: readonly (readonly [t: number, share: number])[] = [
  [0, 0.5],
  [0.14, 0.82],
  [0.3, 0.96],
  [0.46, 0.64],
  [0.54, 0.64],
  [0.7, 0.94],
  [1, 1],
];
export const tailWidth = (t: number): number => {
  for (let i = 1; i < TAIL_WIDTH.length; i++) {
    const [t0, a] = TAIL_WIDTH[i - 1];
    const [t1, b] = TAIL_WIDTH[i];
    if (t <= t1) return a + ((b - a) * (t - t0)) / (t1 - t0);
  }
  return TAIL_WIDTH[TAIL_WIDTH.length - 1][1];
};

/**
 * The line down a tail: from `start`, leaving the knot as `fall` says toward
 * `dir` and easing toward vertical as it falls, with a soft S across where
 * it twists; `length` along it.
 */
function tailLine(start: Pt, dir: -1 | 1, fall: TailFall, length: number, n = 20): Pt[] {
  const pts: Pt[] = [start];
  let [x, y] = start;
  for (let i = 1; i <= n; i++) {
    const a = (fall.angle * (1 - fall.ease * ((i - 0.5) / n)) * Math.PI) / 180;
    x += dir * Math.sin(a) * (length / n);
    y += Math.cos(a) * (length / n);
    pts.push([x, y]);
  }
  return pts.map(([px, py], i) => [px + dir * 0.026 * length * Math.sin((2 * Math.PI * i) / n), py] as Pt);
}

/** Along a tail's line at `i`: which way it runs, and the way out to its outer side, away from the other tail. */
function tailFrame(line: Pt[], i: number, dir: -1 | 1): { along: Pt; out: Pt } {
  const n = line.length - 1;
  const [px, py] = line[Math.max(0, i - 1)];
  const [qx, qy] = line[Math.min(n, i + 1)];
  const len = Math.hypot(qx - px, qy - py) || 1;
  const along: Pt = [(qx - px) / len, (qy - py) / len];
  const out: Pt = -along[1] * dir >= 0 ? [-along[1], along[0]] : [along[1], -along[0]];
  return { along, out };
}

/** A point on a tail: `t` of the way down its line, `u` across it from its inner edge (-1) to its outer (1). */
function onTail(line: Pt[], dir: -1 | 1, w: number, t: number, u: number): Pt {
  const n = line.length - 1;
  const i = Math.min(n, Math.max(0, Math.round(t * n)));
  const { out } = tailFrame(line, i, dir);
  const h = (tailWidth(i / n) * w) / 2;
  return [line[i][0] + out[0] * u * h, line[i][1] + out[1] * u * h];
}

/**
 * A tail along its line, in cloth `w` wide: its two long edges either side of
 * the line as wide as `TAIL_WIDTH` says, smooth; its end cut on a slant, the
 * outer corner lower, or notched in a V, its corners sharp; its top, under
 * the knot, straight across.
 */
function tailPath(line: Pt[], dir: -1 | 1, w: number, ends: "slant" | "notch"): string {
  const n = line.length - 1;
  const outer: Pt[] = [];
  const inner: Pt[] = [];
  line.forEach(([x, y], i) => {
    const { out } = tailFrame(line, i, dir);
    const h = (tailWidth(i / n) * w) / 2;
    outer.push([x + out[0] * h, y + out[1] * h]);
    inner.push([x - out[0] * h, y - out[1] * h]);
  });
  const { along } = tailFrame(line, n, dir);
  let end: Pt[][];
  if (ends === "slant") {
    const s = 0.16 * w;
    outer[n] = [outer[n][0] + along[0] * s, outer[n][1] + along[1] * s];
    inner[n] = [inner[n][0] - along[0] * s, inner[n][1] - along[1] * s];
    end = [[outer[n], inner[n]]];
  } else {
    const notch: Pt = [line[n][0] - along[0] * 0.42 * w, line[n][1] - along[1] * 0.42 * w];
    end = [
      [outer[n], notch],
      [notch, inner[n]],
    ];
  }
  const f = (v: number) => String(Math.round(v * 10) / 10);
  return `M${f(outer[0][0])} ${f(outer[0][1])} ${run(outer)} ${end.map((r) => run(r)).join(" ")} ${run([...inner].reverse())} ${run([inner[0], outer[0]])} Z`;
}

/** A crease as soft cloth takes it: a fine crisp crest — a line of shade and one of light — over a broad soft turn either side of it. */
const crease = (ridge: Pt[], broad: number, depth = 1): FoldSpec[] => [
  [ridge, [0.55, 0.8], 0.34 * depth, 0.3 * depth, 0.8],
  [ridge, [0.6, broad], 0.13 * depth, 0.12 * depth, 2],
];

/**
 * The belt bow, as photos 1 and 2's: a sash tied in a bow at the waist,
 * written in the width `w` of the cloth it is tied in — a sash's 6 cm, a
 * ribbon's 3 — about a knot at `at`.
 *
 * - **The knot** is the band pinched: a little narrower than the cloth and a
 *   little shorter, every side bowed out.
 * - **Two soft loops**, one each side, reaching `BOW_REACH` from the knot —
 *   10.6 cm at the front, where the bow spans nine tenths of her waist as
 *   photo 1's does; 7 cm at her side, as photo 2's. Each pinched into the
 *   knot and widening to its outer end, drooping a little there, its end
 *   rounded with a small dimple where the cloth folds back, and folds
 *   fanning out from the knot into it.
 * - **Two long tails**, 36 and 32 cm along them, gathered under the knot and
 *   crossing there, the longer over the other, then spreading apart in an
 *   upside-down V — see `BOW_TAIL_SPREAD`, `narrow` for a bow at the front
 *   of a narrow skirt — each narrowing where it twists halfway down, with
 *   soft folds, and ending as wide as the cloth: cut on a slant, the outer
 *   corner lower, or for a ribbon notched in a V.
 *
 * Back to front: the tails, then the loops, then the knot over all.
 */
export function bowAt(at: Pt, place: BowAtId, w: number = SASHES.sash.width, narrow = false): BowPieces {
  const reach = BOW_REACH[place];
  const [kw, kh] = [0.72 * w, 0.78 * w];
  const knotPiece: Piece = {
    corners: [[-kw / 2, -kh / 2], [-kw / 2 + 0.04 * w, kh / 2], [kw / 2 - 0.04 * w, kh / 2], [kw / 2, -kh / 2]],
    bows: [0.1 * w, 0.09 * w, 0.1 * w, 0.08 * w],
  };
  const rel = (pts: Pt[], flip = false): Pt[] => pts.map(([x, y]) => [at[0] + (flip ? -x : x), at[1] + y] as Pt);

  /*
    A loop, left side, round from its root under the knot: up and out along
    its top, down its rounded end — out to `reach`, in to the dimple, out
    again — and back along its fuller bottom; drooping `droop` at its end.
  */
  const root = -kw / 2 + 0.1 * w;
  const len = reach + root;
  const droop = Math.min(0.12 * reach, 0.25 * w);
  const dimple: Pt = [-reach + 0.12 * w, 0.02 * w + droop];
  const loopPts: Pt[] = [
    [root, -0.3 * w],
    [root - 0.28 * len, -0.47 * w + 0.15 * droop],
    [root - 0.62 * len, -0.58 * w + 0.45 * droop],
    [-reach + 0.13 * w, -0.6 * w + 0.85 * droop],
    [-reach, -0.28 * w + droop],
    dimple,
    [-reach + 0.02 * w, 0.32 * w + droop],
    [-reach + 0.17 * w, 0.6 * w + droop],
    [root - 0.6 * len, 0.58 * w + 0.65 * droop],
    [root - 0.27 * len, 0.45 * w + 0.3 * droop],
    [root, 0.31 * w],
  ];
  const loop = outline(rel(loopPts));
  const loops = [loop, mirror(loop, at[0])];
  const knot = placed(knotPiece, at);

  /* the tails: the shorter at the back, the longer crossing over it in front, each leaving from the knot's far side */
  const spread = BOW_TAIL_SPREAD[place === "side" ? "side" : narrow ? "narrow" : "front"];
  const ends = w < NOTCHED_UNDER ? "notch" : "slant";
  const top = kh / 2 - 0.14 * w;
  const tailSpecs = [
    { dir: (-spread.longDir) as -1 | 1, fall: spread.short, length: BOW_TAILS[1] },
    { dir: spread.longDir, fall: spread.long, length: BOW_TAILS[0] },
  ];
  const tailLines = tailSpecs.map(({ dir, fall, length }) => tailLine([at[0] - dir * 0.12 * w, at[1] + top], dir, fall, length));
  const tails = tailSpecs.map(({ dir }, k) => tailPath(tailLines[k], dir, w, ends));

  /*
    The folds. Down each tail a gather where it comes out from under the
    knot, a crease either side above its twist and below it, and the twist
    itself across it; on each loop three folds fanning out from the knot, the
    middle one into the dimple, and the dimple's own crease; on the knot two
    creases and the shade under it.
  */
  const s = w / SASHES.sash.width;
  const tailFoldsOf = (line: Pt[], dir: -1 | 1): FoldSpec[] => {
    const p = (t: number, u: number) => onTail(line, dir, w, t, u);
    return [
      ...crease([p(0.02, 0), p(0.07, 0.04), p(0.13, 0.06)], 0.1 * w, 0.9),
      ...crease([p(0.08, 0.3), p(0.25, 0.22), p(0.41, 0.14)], 0.12 * w, 0.8),
      ...crease([p(0.12, -0.35), p(0.27, -0.3), p(0.4, -0.22)], 0.1 * w, 0.7),
      ...crease([p(0.43, 0.85), p(0.49, 0), p(0.55, -0.85)], 0.2 * w, 1.35),
      ...crease([p(0.6, -0.3), p(0.78, -0.24), p(0.95, -0.18)], 0.12 * w, 0.8),
      ...crease([p(0.62, 0.36), p(0.8, 0.42), p(0.96, 0.46)], 0.1 * w, 0.7),
    ];
  };
  const loopFold = (flip: boolean): FoldSpec[] => [
    ...[-1, 0, 1].flatMap((j) =>
      crease(
        rel(
          [
            [root - 0.02 * w, j * 0.16 * w],
            [root - 0.5 * len, j * 0.32 * w + 0.5 * droop],
            [-reach + 0.2 * w, j * 0.4 * w + 0.9 * droop],
          ],
          flip
        ),
        0.12 * w,
        j === 0 ? 1 : 0.8
      )
    ),
    ...crease(rel([dimple, [dimple[0] + 0.22 * len, dimple[1] - 0.08 * droop]], flip), 0.08 * w, 1.1),
  ];
  const knotFolds: FoldSpec[] = [
    [rel([[-0.1 * w, -kh / 2 + 0.06 * w], [-0.12 * w, 0], [-0.09 * w, kh / 2 - 0.06 * w]]), [0.6 * s, 0.6 * s], 0.18, 0.22, 0.6 * s],
    [rel([[0.1 * w, -kh / 2 + 0.06 * w], [0.12 * w, 0], [0.09 * w, kh / 2 - 0.06 * w]]), [0.6 * s, 0.6 * s], 0.16, 0.2, 0.6 * s],
    [rel([[-kw * 0.4, kh / 2 - 0.06 * w], [0, kh / 2 + 0.02 * w], [kw * 0.4, kh / 2 - 0.05 * w]]), [2.4 * s, 2.4 * s], 0.16, 0, 1.6 * s],
  ];
  return {
    pieces: [...tails, ...loops, knot],
    parts: { tails, loops, knot },
    folds: { tails: tailSpecs.map(({ dir }, k) => tailFoldsOf(tailLines[k], dir)), loops: [...loopFold(false), ...loopFold(true)], knot: knotFolds },
    tailLines,
    ends,
    reach,
    width: w,
  };
}

/**
 * A tie of a style, knotted at a point and hanging down from it: each piece
 * closed, its own path, back to front — tails, then loops, then the knot on
 * top; or a necktie's blade, then its knot. Sized for where it is knotted,
 * `where`: on a belt the knot is the belt bow — see `bowAt`, whose tails at
 * the front spread less over a `narrow` skirt — and the scarf is tied in a
 * sash's cloth.
 */
export function tieAt(style: TieStyle, at: Pt, where: TieAtId = "neck", narrow = false): TiePieces {
  if (style === "necktie") {
    const bladePath = placed(NECKTIE_BLADE, at);
    const knot = placed(NECKTIE_KNOT, at);
    return { pieces: [bladePath, knot], parts: { blade: bladePath, knot } };
  }
  if (style === "scarf") {
    /* the longer tail, then the shorter reflected to the other side, then the knot over both */
    const scarf = scarfFor(where);
    const tails = [placed(scarf.long, at), mirror(placed(scarf.short, at), at[0])];
    const knot = placed(scarf.knot, at);
    return { pieces: [...tails, knot], parts: { tails, knot } };
  }
  if (where !== "neck") {
    const { pieces, parts } = bowAt(at, where === "belt-side" ? "side" : "front", SASHES.sash.width, narrow);
    return { pieces, parts };
  }
  const tail = placed(KNOT_TAIL, at);
  const tails = [tail, mirror(tail, at[0])];
  const knot = placed(KNOT, at);
  const loop = placed(KNOT_LOOP, at);
  const loops = [loop, mirror(loop, at[0])];
  return { pieces: [...tails, ...loops, knot], parts: { tails, loops, knot } };
}

/** How far below its point each style hangs at the neck, in canvas units: the lowest of its pieces. */
export const TIE_DROP: Record<TieStyle, number> = { knot: 29.4, necktie: 66, scarf: 69 };
