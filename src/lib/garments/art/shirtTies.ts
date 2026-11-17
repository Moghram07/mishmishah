/*
  Plain `.ts`, relative and extensioned, and no JSX — so `scripts/
  preview-garments.mjs` can import it and measure the same ties the app draws.

  The ties a collar draws itself, knotted under it: a necktie and a bow tie
  with a shirt collar — a necktie needs a shirt collar to sit under (the
  user's photos ShirtCollarTie and ShirtCollarBowtie) — and her ribbon bow
  under a Peter Pan as well. Each is knotted round the collar's band, or
  round the neck under a flat collar, so its band never shows; and the collar
  stays closed at the top — its edges still meet. Where they meet is
  `TieFit.meet`.

  - **The necktie** (ShirtCollarTie): its knot sits snug in the V between
    the leaves, its top where they meet and its sides running on under them
    — the collar's points lie over the sides of the knot: see the collar's
    `over`. Under it the blade hangs straight down the middle, widening
    gently, and ends in a point at the waistband — see `necktieTo`.
  - **Her bow tie «فيونكة»** (WomenRibbon for where it sits and its tails,
    femaleBowtieMenTie for its loops): a ribbon bow under the collar, just
    below where its edges meet, both points lying over its loops — see
    `ribbonUnder`; two full, rounded loops, a small wrapped knot, and two
    tails hanging straight down side by side, slightly apart, cut on a slant.
  - **His bow tie «بابيون»**: a classic small one, two wings pinched into a
    knot, and no tails — lying on the collar's leaves.
*/
import { blade, mirror } from "../collar.ts";
import { draft, outline, run, type Pt } from "../fit.ts";
import { insideRings, ringsOf } from "../stripes.ts";
import { WAIST_DROP } from "../skirts.ts";
import { BELT_ABOVE_SEAM } from "../closures.ts";
import { WAISTBAND as SKIRT_BAND } from "./female/skirtCut.ts";
import { WAISTBAND as HIS_TROUSERS_BAND } from "./male/trousersCut.ts";
import { crease, type FoldSpec } from "./female/ties.ts";
import type { BodyType } from "@/types";
import type { GarmentChoice } from "./index.ts";

/** The ties a collar draws, knotted under it — see `Collar.ties`. */
export type ShirtTieStyle = "necktie" | "bowtie";
export const SHIRT_TIE_STYLES: readonly ShirtTieStyle[] = ["necktie", "bowtie"];

/** How far below the point where the leaves meet a necktie's knot's top sits: just under it, so no band shows above the knot. */
export const KNOT_DROP = 1;

/**
 * A necktie's numbers, in canvas units (0.19 cm each): its knot's width
 * across the top and across the bottom, and its height — a four-in-hand,
 * hers 3.6 × 4 cm, his 4.2 × 4.8 — and its blade's width under the knot and
 * at its widest, just above the point: hers 5.5 cm, his 7.4.
 */
export const NECKTIE: Record<BodyType, { knot: readonly [top: number, bottom: number, height: number]; blade: readonly [under: number, widest: number] }> = {
  female: { knot: [19, 10.5, 21], blade: [8, 29] },
  male: { knot: [22, 12.5, 25], blade: [10, 39] },
};

/**
 * Her bow tie «فيونكة», a ribbon bow, in canvas units: a ribbon `width` wide
 * — 2.8 cm, the loops and the tails alike; its two loops `span` across from
 * end to end — 11 cm, about as wide as the collar's opening — each `loop`
 * tall at its fullest, 4.6 cm, and about as long, so they stand full and
 * round; its `knot` 2.3 cm across, a little narrower than the ribbon, and
 * 2.6 tall; and its two `tails`, 18 and 17 cm, hanging straight down side by
 * side — `apart` under the knot, 0.85 cm, each leaning out `lean` degrees, so
 * they part a little more by their ends and never cross.
 */
export const RIBBON_BOW = {
  width: 14.5,
  span: 58,
  loop: 24,
  knot: [12.2, 13.6] as const,
  tails: [95, 89] as const,
  apart: 4.5,
  lean: 1.2,
};

/**
 * How much of its loops her bow shows under a collar: at least this share of
 * their cloth below and beside the collar's points, which lie over the rest
 * — see `ribbonUnder`.
 */
export const RIBBON_SHOWS = 0.8;

/**
 * His bow tie «بابيون», a classic butterfly: 11 cm across and 4.9 cm deep at
 * its wings' ends, pinched to a knot 1.9 cm wide and 2.3 cm tall; its knot's
 * middle `drop` below where the leaves meet — just low enough that its
 * wings' ends, which rise above the knot, stay under the collar's roll as it
 * climbs round his neck. In canvas units.
 */
export const BUTTERFLY = { half: 29, wing: 13, knot: [10, 12] as const, drop: 11.5 };

/** A part of a tie, back to front: its pieces, and the folds laid on them. What shows of it is it, less every part after it. */
export interface TiePart {
  id: string;
  pieces: string[];
  folds: FoldSpec[];
}

/**
 * Where a tie is worn with a collar: where the collar's edges meet, `meet`;
 * the row a necktie's point reaches, `to` — see `necktieTo`; and where a bow
 * tie's knot sits, `bow` — under her ribbon bow's collar see `ribbonUnder`,
 * his butterfly `BUTTERFLY.drop` below where his leaves meet.
 */
export interface TieFit {
  meet: Pt;
  to: number;
  bow: Pt;
}

/** A tie worn with a collar, as `shirtTie` draws it. */
export interface ShirtTie {
  style: ShirtTieStyle;
  body: BodyType;
  /** Every piece, back to front. */
  pieces: string[];
  /** Its parts, back to front — see `TiePart`. */
  parts: TiePart[];
  /** Its knot's piece, and the knot's centre. */
  knot: string;
  at: Pt;
  /** Whether the collar lies over it: a necktie's knot is under its points, and her bow under them; his bow tie lies over them. */
  under: boolean;
  /** A necktie's point, where its blade ends. */
  tip?: Pt;
  /** Her bow tie's tails: the line down the middle of each, from under the knot to its end, back to front. */
  tailLines?: Pt[][];
  /** How far a bow tie's loops or wings reach either side of its knot. */
  reach?: number;
}

/** A tie worn with a collar, as the collar fits it — see `TieFit`, and the comment at the top. */
export function shirtTie(style: ShirtTieStyle, body: BodyType, fit: TieFit): ShirtTie {
  return style === "necktie" ? necktie(body, fit.meet, fit.to) : body === "female" ? ribbonBow(fit.bow) : butterfly(fit.bow);
}

/** Where his butterfly's knot sits on a shirt collar whose leaves meet at `meet`. */
export const butterflyAt = (meet: Pt): Pt => [meet[0], meet[1] + BUTTERFLY.drop];

/**
 * The waistband of what each body wears under a shirt when nothing is said:
 * her skirt's, his trousers' — see `necktieTo`.
 */
const WAISTBANDS: Record<BodyType, readonly [number, number]> = { female: SKIRT_BAND, male: HIS_TROUSERS_BAND };

/**
 * The row a necktie's point reaches — the user's rule: a necktie's tip
 * reaches the waistband of the trousers or skirt, or the belt if there is
 * one. Its middle, as a tie's point reaches a belt's buckle:
 *
 * - over a skirt or trousers, their waistband: `choice.waistband`, which the
 *   stage gives a top worn over one;
 * - on a dress, its own belt — a sash's band is centred where a belt is —
 *   or, with none, its waist seam, wherever its waist is;
 * - over nothing, the waistband of what each body arrives in under a shirt:
 *   her skirt's, his trousers'.
 */
export function necktieTo(body: BodyType, choice: GarmentChoice): number {
  const band = choice.waistband ?? (choice.skirt ? undefined : WAISTBANDS[body]);
  if (band) return (band[0] + band[1]) / 2;
  const seam = draft(body).waistY + WAIST_DROP[choice.skirt?.waist ?? "natural"];
  return choice.belt && choice.belt !== "none" ? seam - BELT_ABOVE_SEAM : seam;
}

/**
 * The necktie: its knot from just under where the leaves meet, `KNOT_DROP`,
 * an inverted trapezoid with its sides bowed out a little, so its upper
 * corners run on under the leaves either side; its blade from under the
 * knot, straight down the middle — the collar's axis where the leaves meet
 * — widening evenly to `NECKTIE.blade[1]` and ending in a right-angled point
 * at the row `to`.
 */
function necktie(body: BodyType, meet: Pt, to: number): ShirtTie {
  const [kt, kb, kh] = NECKTIE[body].knot;
  const [b0, b1] = NECKTIE[body].blade;
  const [mx, my] = meet;
  const top = my + KNOT_DROP;
  const bottom = top + kh;
  /* the knot, anticlockwise from its top left: its sides and its foot bowed out, its top straight under the roll */
  const knot = blade([[mx - kt / 2, top], [mx - kb / 2, bottom], [mx + kb / 2, bottom], [mx + kt / 2, top]], [0.8, 1, 0.8, 0]);
  /* the blade, from under the knot to its point: a right angle, as deep as half its width */
  const under = bottom - 3;
  const wide = to - b1 / 2;
  const bladePath = blade([[mx - b0 / 2, under], [mx - b1 / 2, wide], [mx, to], [mx + b1 / 2, wide], [mx + b0 / 2, under]], [0.5, 0, 0, 0.5, 0]);
  /*
    Its folds, where the knot shows — in the V between the leaves, and below
    them where its sides draw in: the edge of the band wrapped round it,
    running down across it from upper left to lower right, as a four-in-hand's
    does; the rounded foot of the knot catching the light; under it the
    dimple, a short crease down the blade; and down the blade one long soft
    crease, off the middle as a tie's lining lets it fall.
  */
  const s = kt / NECKTIE.female.knot[0];
  const knotFolds: FoldSpec[] = [
    ...crease([[mx - 2.2 * s, top + 0.3 * kh], [mx + 0.2 * s, top + 0.55 * kh], [mx + 2.6 * s, bottom - 2.6 * s]], 1.8 * s, 1.1),
    [[[mx - kb / 2 + 1.2, bottom - 1.6], [mx, bottom - 0.7], [mx + kb / 2 - 1.2, bottom - 1.6]], [0.5 * s, 0.5 * s], 0.08, 0.34, 0.5],
  ];
  const bladeFolds: FoldSpec[] = [
    ...crease([[mx, bottom + 0.6], [mx + 0.2, bottom + 4 * s], [mx + 0.5, bottom + 9 * s]], 1.6 * s, 1.2),
    ...crease([[mx + 1.2 * s, bottom + 18 * s], [mx + 2 * s, (bottom + wide) / 2], [mx + 1.4 * s, wide - 8 * s]], 4 * s, 0.45),
  ];
  return {
    style: "necktie",
    body,
    pieces: [bladePath, knot],
    parts: [
      { id: "blade", pieces: [bladePath], folds: bladeFolds },
      { id: "knot", pieces: [knot], folds: knotFolds },
    ],
    knot,
    at: [mx, top + kh / 2],
    under: true,
    tip: [mx, to],
  };
}

/** A number written to a tenth, as a path takes it. */
const f1 = (v: number) => String(Math.round(v * 10) / 10);

/**
 * Her ribbon bow's loops about a knot at `at`, as the pink bow's are: full
 * and round. Each, left side first, a fan from its root under the knot — its
 * top rising quickly from the knot to the loop's full height two thirds of
 * the way out, round its broad end, and back along its bottom, a little
 * fuller as cloth hangs — written as four curves, so its edge runs smooth;
 * a curve through many points wobbles between them. As long as it is tall,
 * a loop of ribbon standing out, not a strip lying flat.
 */
function ribbonLoops(at: Pt): { loops: string[]; root: number; half: number; full: number } {
  const { width: w, span, loop, knot } = RIBBON_BOW;
  const half = span / 2;
  const root = -knot[0] / 2 + 1.2;
  const h = loop / 2;
  const pinch = 0.42 * w;
  const droop = 0.8;
  /* where it is fullest, and how far its round end stands past that; its end's middle, a little low */
  const full = -half + 8;
  const e = full + half;
  const mid = 0.4 + droop / 2;
  const k = 0.5523;
  const P = ([x, y]: Pt): string => `${f1(at[0] + x)} ${f1(at[1] + y)}`;
  const C = (c1: Pt, c2: Pt, to: Pt) => `C${P(c1)} ${P(c2)} ${P(to)}`;
  const left =
    `M${P([root, -pinch])} ` +
    `${C([root - 6, -pinch - 1.6], [full + 6.5, -h], [full, -h])} ` +
    `${C([full - k * e, -h], [-half, mid - k * (mid + h)], [-half, mid])} ` +
    `${C([-half, mid + k * (h + droop - mid)], [full - k * e, h + droop], [full, h + droop])} ` +
    `${C([full + 6.5, h + droop], [root - 6, pinch + 1.8], [root, pinch])} Z`;
  return { loops: [left, mirror(left, at[0])], root, half, full };
}

/**
 * Her bow tie: a ribbon bow knotted at `at` — see `RIBBON_BOW`, and
 * `ribbonUnder` for where it sits. Back to front: its two tails, its loops,
 * and the knot over both; all of it under the collar, whose points lie over
 * its loops.
 *
 * - **The knot**, a short length of the ribbon wrapped round its middle: a
 *   little narrower than the ribbon, its sides and foot bowed out.
 * - **The loops**, full and round — see `ribbonLoops` — with soft folds
 *   fanning out from the knot into each, one into the dimple at its end.
 * - **The tails** come out from under the knot side by side, `apart`, and
 *   hang straight down — never crossing — each as wide as the ribbon from a
 *   little under the knot, where it is gathered in, to its end, cut on a
 *   slant, its outer corner lower; a soft crease down each, a gather where it
 *   leaves the knot.
 */
function ribbonBow(at: Pt): ShirtTie {
  const { width: w, knot: [kw, kh], tails: lengths, apart, lean } = RIBBON_BOW;
  const rel = (pts: Pt[], flip = false): Pt[] => pts.map(([x, y]) => [at[0] + (flip ? -x : x), at[1] + y] as Pt);
  const { loops, root, half, full } = ribbonLoops(at);
  const knot = blade(
    [[at[0] - kw / 2, at[1] - kh / 2], [at[0] - kw / 2 + 0.7, at[1] + kh / 2], [at[0] + kw / 2 - 0.7, at[1] + kh / 2], [at[0] + kw / 2, at[1] - kh / 2]],
    [0.9, 0.7, 0.9, 0.6]
  );

  /* the tails: each from under the knot, `apart` from the other, straight down and a little out */
  const a = (lean * Math.PI) / 180;
  const top = at[1] + kh / 2 - 3;
  const N = 8;
  const tail = (dir: -1 | 1, len: number) => {
    const x0 = at[0] + dir * (apart / 2 + w / 2);
    const line: Pt[] = [];
    for (let i = 0; i <= N; i++) line.push([x0 + dir * Math.sin(a) * len * (i / N), top + Math.cos(a) * len * (i / N)]);
    /* across it, the way out from the other tail: square to its line */
    const out: Pt = [dir * Math.cos(a), -Math.sin(a)];
    const along: Pt = [dir * Math.sin(a), Math.cos(a)];
    const share = (t: number) => (t >= 0.12 ? 1 : 0.86 + 0.14 * ((3 - 2 * (t / 0.12)) * (t / 0.12) ** 2));
    const outer = line.map(([x, y], i) => [x + (out[0] * share(i / N) * w) / 2, y + (out[1] * share(i / N) * w) / 2] as Pt);
    const inner = line.map(([x, y], i) => [x - (out[0] * share(i / N) * w) / 2, y - (out[1] * share(i / N) * w) / 2] as Pt);
    /* the end cut on a slant, its outer corner lower */
    const s = 0.16 * w;
    outer[N] = [outer[N][0] + along[0] * s, outer[N][1] + along[1] * s];
    inner[N] = [inner[N][0] - along[0] * s, inner[N][1] - along[1] * s];
    const d = `M${f1(outer[0][0])} ${f1(outer[0][1])} ${run(outer)} ${run([outer[N], inner[N]])} ${run([...inner].reverse())} ${run([inner[0], outer[0]])} Z`;
    /* a point `t` down it, `u` across it from its inner edge (-1) to its outer (1) */
    const p = (t: number, u: number): Pt => {
      const [x, y] = [line[0][0] + along[0] * len * t, line[0][1] + along[1] * len * t];
      return [x + (out[0] * u * share(t) * w) / 2, y + (out[1] * u * share(t) * w) / 2];
    };
    const folds: FoldSpec[] = [
      ...crease([p(0.015, 0.05), p(0.06, 0.12), p(0.13, 0.16)], 0.12 * w, 0.9),
      ...crease([p(0.16, 0.34), p(0.52, 0.28), p(0.9, 0.36)], 0.14 * w, 0.55),
      [[p(0.1, -0.58), p(0.5, -0.62), p(0.92, -0.56)], [0.8, 0.2 * w], 0.1, 0.04, 2],
    ];
    return { d, line, folds };
  };
  const tails = [tail(-1, lengths[0]), tail(1, lengths[1])];

  /*
    The loops' folds: two fanning out from the knot into each, above and below
    its middle; where the ribbon folds back at its end, a soft crease in from
    the end's middle; and its roundness — its upper half catching the light,
    its lower half turning away into a broad soft shade — which is what makes
    it read full.
  */
  const loopFolds = (flip: boolean): FoldSpec[] => [
    ...crease(rel([[root - 0.6, -2.4], [(root + full) / 2, -6.2], [full - 3.5, -7.6]], flip), 0.16 * w, 0.8),
    ...crease(rel([[root - 0.6, 2.6], [(root + full) / 2, 6.6], [full - 3.5, 8.4]], flip), 0.16 * w, 0.75),
    ...crease(rel([[-half + 0.8, 0.8], [full - 1, 0.7], [full + 5, 0.5]], flip), 0.12 * w, 0.7),
    [rel([[root - 1, 6], [(root + full) / 2, 10.4], [full - 5, 8.8]], flip), [0.4 * w, 0.4 * w], 0.12, 0, 2],
    [rel([[root - 1, -5], [(root + full) / 2, -9.4], [full - 4, -8]], flip), [0.3 * w, 0.3 * w], 0, 0.1, 2],
  ];
  const knotFolds: FoldSpec[] = [
    [rel([[-0.22 * kw, -kh / 2 + 1.2], [-0.25 * kw, 0], [-0.2 * kw, kh / 2 - 1.2]]), [0.6, 0.6], 0.2, 0.22, 0.6],
    [rel([[0.22 * kw, -kh / 2 + 1.2], [0.25 * kw, 0], [0.2 * kw, kh / 2 - 1.2]]), [0.6, 0.6], 0.18, 0.2, 0.6],
    [rel([[-0.4 * kw, kh / 2 - 0.8], [0, kh / 2 + 0.2], [0.4 * kw, kh / 2 - 0.8]]), [2, 2], 0.16, 0, 1.4],
  ];
  return {
    style: "bowtie",
    body: "female",
    pieces: [...tails.map((t) => t.d), ...loops, knot],
    parts: [
      ...tails.map((t, i) => ({ id: `tail-${i}`, pieces: [t.d], folds: t.folds })),
      { id: "loops", pieces: loops, folds: [...loopFolds(false), ...loopFolds(true)] },
      { id: "knot", pieces: [knot], folds: knotFolds },
    ],
    knot,
    at,
    under: true,
    tailLines: tails.map((t) => t.line),
    reach: half,
  };
}

/**
 * Where her ribbon bow's knot sits under a collar whose edges meet at
 * `meet`, the collar's pieces `collar` — each its own rings: just below
 * where its edges meet, as high as it can sit while its loops show at least
 * `RIBBON_SHOWS` of themselves — so the collar's points lie over the loops,
 * both of them seen above the loops, and the loops still show full and
 * round below them (the user's photo WomenRibbon). A shirt collar's leaves
 * meet at the top of its band and open in a V down to their points; a Peter
 * Pan's rounded ends touch at the neckline's centre and part below it.
 */
export function ribbonUnder(collar: Pt[][][], meet: Pt): Pt {
  const kh = RIBBON_BOW.knot[1];
  const start = meet[1] + KNOT_DROP + kh / 2;
  for (let y = start; y < start + 90; y += 0.5) {
    const at: Pt = [meet[0], y];
    if (loopsShowing(at, collar) >= RIBBON_SHOWS) return at;
  }
  return [meet[0], start + 90];
}

/** How much of her bow's loops, knotted at `at`, shows past `collar`: the share of their cloth not under any of its pieces, sampled every unit. */
export function loopsShowing(at: Pt, collar: Pt[][][]): number {
  /* the left loop, and the right its mirror */
  const ring = ringsOf(ribbonLoops(at).loops[0]);
  const pts = ring.flat();
  const xs = pts.map(([x]) => x);
  const ys = pts.map(([, y]) => y);
  let [all, seen] = [0, 0];
  for (let y = Math.floor(Math.min(...ys)) + 0.5; y < Math.max(...ys); y++)
    for (let x = Math.floor(Math.min(...xs)) + 0.5; x < Math.max(...xs); x++) {
      if (!insideRings(ring, [x, y])) continue;
      for (const p of [[x, y], [2 * at[0] - x, y]] as Pt[]) {
        all++;
        if (!collar.some((piece) => insideRings(piece, p))) seen++;
      }
    }
  return all ? seen / all : 0;
}

/**
 * His bow tie, a butterfly knotted at `at`: two wings, each pinched into the
 * knot and flaring out to a rounded end `BUTTERFLY.wing` above and below the
 * knot's middle, a small dimple at the middle of its end where the cloth
 * folds back; and the knot over them, a little narrower than it is tall. Its
 * knot sits just under where the leaves meet, low enough that the wings'
 * ends stay under the collar's roll — see `butterflyAt`.
 */
function butterfly(at: Pt): ShirtTie {
  const { half, wing, knot: [kw, kh] } = BUTTERFLY;
  const rel = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [at[0] + x, at[1] + y] as Pt);
  /* the left wing, round from its root under the knot: up and out along its top, down its end, back along its foot */
  const root = -kw / 2 + 2;
  const wingPts: Pt[] = [
    [root, -kh / 2 + 0.8],
    [root - 6, -kh / 2 - 0.6],
    [-half * 0.55, -wing + 2.6],
    [-half + 3.4, -wing],
    [-half + 0.4, -wing + 3.6],
    [-half, -3.4],
    [-half + 1.6, 0],
    [-half, 3.4],
    [-half + 0.4, wing - 3.6],
    [-half + 3.4, wing],
    [-half * 0.55, wing - 2.6],
    [root - 6, kh / 2 + 0.6],
    [root, kh / 2 - 0.8],
  ];
  const left = outline(rel(wingPts));
  const wings = [left, mirror(left, at[0])];
  const knot = blade(
    [[at[0] - kw / 2, at[1] - kh / 2], [at[0] - kw / 2 + 0.6, at[1] + kh / 2], [at[0] + kw / 2 - 0.6, at[1] + kh / 2], [at[0] + kw / 2, at[1] - kh / 2]],
    [1, 0.7, 1, 0.6]
  );
  /* each wing: its fold back along the middle, out to the dimple, and a crease fanning to each corner; on the knot, two creases */
  const wingFolds = (flip: boolean): FoldSpec[] => {
    const f = (pts: Pt[]): Pt[] => rel(pts.map(([x, y]) => [flip ? -x : x, y] as Pt));
    return [
      ...crease(f([[root - 1, 0.2], [-half * 0.5, 0.4], [-half + 2.4, 0]]), 1.6, 1.1),
      ...crease(f([[root - 1.5, -2.2], [-half * 0.5, -5.2], [-half + 4.5, -wing + 4]]), 1.8, 0.75),
      ...crease(f([[root - 1.5, 2.4], [-half * 0.5, 5.4], [-half + 4.5, wing - 4]]), 1.8, 0.7),
    ];
  };
  const knotFolds: FoldSpec[] = [
    ...crease(rel([[-1.8, -kh / 2 + 1.5], [-2.1, 0], [-1.6, kh / 2 - 1.5]]), 1.4, 0.8),
    ...crease(rel([[1.9, -kh / 2 + 1.5], [2.2, 0], [1.7, kh / 2 - 1.5]]), 1.4, 0.7),
  ];
  return {
    style: "bowtie",
    body: "male",
    pieces: [...wings, knot],
    parts: [
      { id: "wings", pieces: wings, folds: [...wingFolds(false), ...wingFolds(true)] },
      { id: "knot", pieces: [knot], folds: knotFolds },
    ],
    knot,
    at,
    under: false,
    reach: half,
  };
}
