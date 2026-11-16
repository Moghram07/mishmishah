/*
  Plain `.ts`, relative and extensioned, and no JSX — so `scripts/
  preview-garments.mjs` can import it and measure the same ties the app draws.

  The ties worn with a shirt collar — a necktie and a bow tie — and only with
  one: a necktie or a bow tie needs a shirt collar to sit under (the user's
  photos ShirtCollarTie and ShirtCollarBowtie). Each is knotted round the
  collar's band, under its leaves, so its band never shows; and the collar
  stays closed at the top — its leaves still meet. Where they meet is the
  tie's point, `meet`: the collar's own — see `SHIRT_COLLAR` and
  `MALE_SHIRT_COLLAR`.

  - **The necktie** (ShirtCollarTie): its knot sits snug in the V between
    the leaves, its top where they meet and its sides running on under them
    — the collar's points lie over the sides of the knot: see the collar's
    `over`. Under it the blade hangs straight down the middle, widening
    gently, and ends in a point at the waist — hers, or his.
  - **Her bow tie** (ShirtCollarBowtie): a ribbon bow right under where the
    points meet — the round 24 belt bow, smaller: two loops lying flat,
    sideways, a small knot, and two tails 18 and 16.3 cm long falling in a
    slight upside-down V, cut on a slant.
  - **His bow tie**: a classic small one, two wings pinched into a knot, and
    no tails.

  Both bow ties lie over the collar, on its leaves, as the photo's does; the
  necktie's knot lies under them.
*/
import { blade, mirror } from "../collar.ts";
import { outline, type Pt } from "../fit.ts";
import { bowAt, crease, type BowSize, type FoldSpec } from "./female/ties.ts";
import type { BodyType } from "@/types";

/** The ties a shirt collar takes — see `Collar.ties`. */
export type ShirtTieStyle = "necktie" | "bowtie";
export const SHIRT_TIE_STYLES: readonly ShirtTieStyle[] = ["necktie", "bowtie"];

/** How far below the point where the leaves meet a knot's top sits: just under it, so no band shows above the knot. */
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
 * Her bow tie: a ribbon `width` wide (2.3 cm), tied in the belt bow — see
 * `bowAt` — with loops reaching 6.1 cm either side of the knot, lying flat,
 * and tails of 18 and 16.3 cm along them, falling 9° and 9.5° from upright
 * — a slight upside-down V — and cut on a slant.
 */
export const RIBBON_BOW: { width: number } & BowSize = {
  width: 12,
  reach: 32,
  tails: [95, 86],
  spread: { longDir: 1, long: { angle: 9, ease: 0.1 }, short: { angle: 9.5, ease: 0.1 } },
  ends: "slant",
};

/**
 * His bow tie, a classic butterfly: 11 cm across and 4.9 cm deep at its
 * wings' ends, pinched to a knot 1.9 cm wide and 2.3 cm tall; its knot's
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

/** A tie worn with a shirt collar, as `shirtTie` draws it. */
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
  /** Whether the collar's leaves lie over it: a necktie's knot is under its points; a bow tie lies over them. */
  under: boolean;
  /** A necktie's point, where its blade ends. */
  tip?: Pt;
  /** A bow tie's tails, where it has them: the line down each, back to front. */
  tailLines?: Pt[][];
  /** How far a bow tie's loops or wings reach either side of its knot. */
  reach?: number;
}

/**
 * A tie worn with a shirt collar whose leaves meet at `meet`, on a body
 * whose waist is the row `waistY` — see the comment at the top.
 */
export function shirtTie(style: ShirtTieStyle, body: BodyType, meet: Pt, waistY: number): ShirtTie {
  return style === "necktie" ? necktie(body, meet, waistY) : body === "female" ? ribbonBow(meet) : butterfly(meet);
}

/**
 * The necktie: its knot from just under where the leaves meet, `KNOT_DROP`,
 * an inverted trapezoid with its sides bowed out a little, so its upper
 * corners run on under the leaves either side; its blade from under the
 * knot, straight down the middle — the collar's axis where the leaves meet
 * — widening evenly to `NECKTIE.blade[1]` and ending in a right-angled point
 * at `waistY`.
 */
function necktie(body: BodyType, meet: Pt, waistY: number): ShirtTie {
  const [kt, kb, kh] = NECKTIE[body].knot;
  const [b0, b1] = NECKTIE[body].blade;
  const [mx, my] = meet;
  const top = my + KNOT_DROP;
  const bottom = top + kh;
  /* the knot, anticlockwise from its top left: its sides and its foot bowed out, its top straight under the roll */
  const knot = blade([[mx - kt / 2, top], [mx - kb / 2, bottom], [mx + kb / 2, bottom], [mx + kt / 2, top]], [0.8, 1, 0.8, 0]);
  /* the blade, from under the knot to its point: a right angle, as deep as half its width */
  const under = bottom - 3;
  const wide = waistY - b1 / 2;
  const bladePath = blade([[mx - b0 / 2, under], [mx - b1 / 2, wide], [mx, waistY], [mx + b1 / 2, wide], [mx + b0 / 2, under]], [0.5, 0, 0, 0.5, 0]);
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
    tip: [mx, waistY],
  };
}

/**
 * Her bow tie: the belt bow — see `bowAt` — tied in `RIBBON_BOW`'s ribbon,
 * its knot's top `KNOT_DROP` under where the leaves meet.
 */
function ribbonBow(meet: Pt): ShirtTie {
  const { width: w, ...size } = RIBBON_BOW;
  const at: Pt = [meet[0], meet[1] + KNOT_DROP + (0.78 * w) / 2];
  const bow = bowAt(at, "front", w, false, size);
  const { tails, loops, knot } = bow.parts;
  return {
    style: "bowtie",
    body: "female",
    pieces: bow.pieces,
    parts: [
      ...tails.map((d, i) => ({ id: `tail-${i}`, pieces: [d], folds: bow.folds.tails[i] })),
      { id: "loops", pieces: loops, folds: bow.folds.loops },
      { id: "knot", pieces: [knot], folds: bow.folds.knot },
    ],
    knot,
    at,
    under: false,
    tailLines: bow.tailLines,
    reach: bow.reach,
  };
}

/**
 * His bow tie, a butterfly: two wings, each pinched into the knot and
 * flaring out to a rounded end `BUTTERFLY.wing` above and below the knot's
 * middle, a small dimple at the middle of its end where the cloth folds
 * back; and the knot over them, a little narrower than it is tall. Its knot
 * sits just under where the leaves meet, low enough that the wings' ends
 * stay under the collar's roll.
 */
function butterfly(meet: Pt): ShirtTie {
  const { half, wing, knot: [kw, kh], drop } = BUTTERFLY;
  const at: Pt = [meet[0], meet[1] + drop];
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
