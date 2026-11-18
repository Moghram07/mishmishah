import { Fragment, useContext, type ReactNode } from "react";
import type { Pt } from "./fit";
import { pleatsBeside } from "./fit";
import type { Uid } from "./shading";
import type { PuffShape } from "./sleeves";
import { BODY_CANVAS } from "@/lib/mannequin/bodies";
import { SheenContext, alongGrain } from "./sheen";
import { SHADE_COLOR, type SheenLook } from "@/lib/fabrics/sheen";

/**
 * Folds: the one way every garment here draws drape, gathers and darts.
 *
 * A fold is light and shadow and nothing else. It is drawn into a region's
 * `shading` (multiplied, so it can only darken) and `light` (screened, so it
 * can only lighten), both masked to the region — never into the fabric's fill.
 * The print is laid at its true size underneath and no fold moves, stretches or
 * scales it; what changes is how much light each part of the cloth catches.
 *
 * There is one primitive. A fold is a **ridge** — a line along the cloth — with
 * a width that can change along it, and two flanks: the one facing the light
 * catches it, the one facing away falls into shadow. The light comes from the
 * upper left, as it does for `clothSurface`, so on a ridge running down the
 * body the left flank is lit and the right is in shadow, and on a ridge running
 * across it the upper flank is lit and the lower is in shadow.
 *
 * Everything else is a layout of that primitive:
 *
 * - `hangingFolds` — pipe folds, the tubes cloth falls into below a seam it is
 *   released from: narrow at the seam, wider and deeper toward the hem.
 * - `gathers` — the short, tight folds of cloth eased into a seam.
 * - `dart` — a sewn wedge, which from the front is a fine seam running out to
 *   a point, with the cloth either side of it turning very slightly.
 * - `contour` — where cloth turns under a form: under a bust, under a seat.
 * - `sleeveDrape` — a sleeve hanging from the shoulder: long soft folds down
 *   it, the shadow the body throws along its inner edge, a crease or two at the
 *   inner elbow and the small folds above the wrist where the length collects.
 *
 * Layouts are seeded, not random: the same garment folds the same way on every
 * render, and on the server and in the browser alike — an unseeded fold would
 * be a hydration mismatch.
 */

export interface Fold {
  /** The ridge, from where the fold starts to where it runs out. */
  ridge: Pt[];
  /** How wide each flank is where the fold starts and where it ends, in canvas units. */
  width: readonly [start: number, end: number];
  /** How dark the shadowed flank gets: 0 is none, 1 is deep. */
  shadow: number;
  /** How bright the lit flank gets: 0 is none, 1 is a strong sheen. */
  light: number;
  /** How soft the fold's edges are: a blur, in canvas units. */
  soft: number;
  /**
   * Which way the shadow falls, when it is not the light that decides it — a
   * shadow the body throws on the sleeve beside it, say. A direction; the
   * flank facing it is in shadow and the other is not lit.
   */
  shadowToward?: Pt;
}

/* ----------------------------------------------------------------- layout */

/** A small seeded generator (mulberry32): the same seed, the same folds. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const along = ([x0, y0]: Pt, [x1, y1]: Pt, t: number): Pt => [lerp(x0, x1, t), lerp(y0, y1, t)];

export interface HangingSpec {
  /** The seam the cloth is released from, left end and right end. */
  seam: readonly [Pt, Pt];
  /** The hem, left end and right end, at the side seams. */
  hem: readonly [Pt, Pt];
  /** How far the hem sags at the centre front, so each fold ends on it. */
  hemDip?: number;
  /** How many folds across the piece. */
  count: number;
  /** A flank's width at the seam and at the hem. */
  width: readonly [number, number];
  /** How far below the seam the folds begin — gathers can take the first stretch. */
  start?: number;
  /**
   * Where along the seam each fold falls, 0 to 1, for a garment that places
   * them itself — a skirt whose hem waves where they reach it. `count` is
   * then its length, and each fold reaches the hem at the same place.
   */
  at?: number[];
  shadow?: number;
  light?: number;
  seed: number;
}

/**
 * Pipe folds hanging from a seam to a hem.
 *
 * Each fold starts narrow where the cloth is released and opens toward the hem,
 * where a flared piece has the most cloth to fold. They are spaced evenly and
 * then nudged, swayed and weighted by the seed, so a row of them does not read
 * as a printed sunburst; and they run a little past the hem, which the region's
 * mask trims, so every fold reaches it.
 */
export function hangingFolds(spec: HangingSpec): Fold[] {
  const { seam, hem, hemDip = 0, count, width, start = 0, shadow = 0.5, light = 0.3 } = spec;
  const rnd = seeded(spec.seed);
  return Array.from({ length: spec.at?.length ?? count }, (_, i) => {
    const t = spec.at ? spec.at[i] : (i + 0.5 + (rnd() - 0.5) * 0.45) / count;
    const top = along(seam[0], seam[1], t);
    const foot = along(hem[0], hem[1], spec.at ? t : Math.min(1, Math.max(0, t + (t - 0.5) * 0.08)));
    const end: Pt = [foot[0], foot[1] + hemDip * Math.sin(Math.PI * t) + 12];
    const from: Pt = [top[0], top[1] + start];
    const sway = (rnd() - 0.5) * 10;
    const ridge: Pt[] = [0, 0.33, 0.66, 1].map((u) => {
      const [x, y] = along(from, end, u);
      return [x + sway * Math.sin(Math.PI * u), y];
    });
    const weight = 0.75 + rnd() * 0.5;
    return {
      ridge,
      width: [width[0], width[1] * weight],
      shadow: shadow * (0.7 + rnd() * 0.45),
      light: light * (0.7 + rnd() * 0.45),
      soft: Math.max(2, width[1] * 0.28),
    };
  });
}

export interface GatherSpec {
  /** The seam the cloth is gathered into, left end and right end. */
  seam: readonly [Pt, Pt];
  count: number;
  /** How far down a gather runs before it relaxes into the cloth. */
  length: readonly [min: number, max: number];
  /** A flank's width at the seam. */
  width: number;
  shadow?: number;
  light?: number;
  seed: number;
}

/**
 * Gathers: short, tight folds just below a seam the cloth was eased into.
 *
 * They fan very slightly outward from the centre, as cloth gathered round a
 * body does, and they taper to nothing — a gather is a pleat that has not been
 * pressed, so it has no edge to end on.
 */
export function gathers(spec: GatherSpec): Fold[] {
  const { seam, count, length, width, shadow = 0.4, light = 0.25 } = spec;
  const rnd = seeded(spec.seed);
  const mid = (seam[0][0] + seam[1][0]) / 2;
  const half = Math.abs(seam[1][0] - seam[0][0]) / 2 || 1;
  return Array.from({ length: count }, (_, i) => {
    const t = (i + 0.5 + (rnd() - 0.5) * 0.5) / count;
    const top = along(seam[0], seam[1], t);
    const run = lerp(length[0], length[1], rnd());
    const lean = ((top[0] - mid) / half) * run * 0.12;
    return {
      ridge: [top, [top[0] + lean * 0.5, top[1] + run * 0.5], [top[0] + lean, top[1] + run]],
      width: [width * (0.7 + rnd() * 0.6), 0.4],
      shadow: shadow * (0.55 + rnd() * 0.6),
      light: light * (0.55 + rnd() * 0.6),
      soft: 2,
    };
  });
}

/**
 * A dart: a wedge of cloth sewn away to shape a piece over a curve. From the
 * front it is a fine seam from its wide end on a seam to its point, with a
 * narrow turn of light and shade beside it.
 */
export function dart(base: Pt, point: Pt, width = 2.2): Fold {
  return {
    ridge: [base, along(base, point, 0.5), point],
    width: [width, 0.3],
    shadow: 0.45,
    light: 0.22,
    soft: 0.9,
  };
}

export interface ContourSpec {
  /** The lowest point of the curve the cloth turns under. */
  centre: Pt;
  /** Half the curve's width. */
  half: number;
  /** How far the curve's middle hangs below its ends. */
  sag: number;
  /** A flank's width. */
  width: number;
  shadow?: number;
  light?: number;
  soft?: number;
}

/**
 * Where cloth turns under a form — under a bust, under a seat: an arc whose
 * upper flank catches the light and whose lower flank falls into the shadow
 * the form throws.
 */
export function contour(spec: ContourSpec): Fold {
  const { centre: [cx, cy], half, sag, width, shadow = 0.3, light = 0.18 } = spec;
  const ridge: Pt[] = Array.from({ length: 9 }, (_, i) => {
    const t = i / 8;
    return [cx - half + 2 * half * t, cy - sag + sag * Math.sin(Math.PI * t)];
  });
  return { ridge, width: [width, width], shadow, light, soft: spec.soft ?? width * 0.6 };
}

/**
 * Where a closed outline crosses one row: its leftmost and rightmost x there,
 * or `null` if it does not reach the row. Read off the outline's own points,
 * which for a sleeve run every few units down each edge.
 */
export function rowSpan(path: string, y: number): [number, number] | null {
  const n = (path.match(/-?[0-9]*[.]?[0-9]+/g) ?? []).map(Number);
  const pts: Pt[] = [];
  for (let i = 0; i + 1 < n.length; i += 2) pts.push([n[i], n[i + 1]]);
  const xs: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
  }
  return xs.length >= 2 ? [Math.min(...xs), Math.max(...xs)] : null;
}

export interface DrapeSpec {
  /** The sleeve's outline. */
  sleeve: string;
  /** The row its underarm is at, and the row its hem is at. */
  underarm: number;
  cuff: number;
  /** The body's elbow and wrist rows, from `draft`. */
  elbowY: number;
  wristY: number;
  /**
   * The row a cuff is sewn at, for a sleeve gathered into one. Its fullness
   * then goes into a few short folds running down into the cuff, rather than
   * collecting across the sleeve above a bare wrist.
   */
  cuffTop?: number;
  /**
   * Model the sleeve as a rounded tube: a lit band down the side facing the
   * light, falling away to the outer edge. A sleeve lit as its own piece gets
   * that from its outline; one lit with the body it is sewn to does not.
   */
  round?: boolean;
  /**
   * Whether a long sleeve is cut a little longer than the arm, so its extra
   * length collects in a few small folds above a bare wrist. Unless it is said
   * otherwise, it is. A robe's is cut to length and just ends at its own width.
   */
  collects?: boolean;
  seed: number;
}

/**
 * A sleeve hanging from the shoulder.
 *
 * Its folds run **down** it, not across: two long, soft folds that follow the
 * sleeve's taper, and the shadow the body throws along its inner edge. A
 * hanging arm barely bends, so the elbow gets at most a faint crease or two on
 * the inside; and a long sleeve, cut a little longer than the arm, collects in
 * a few small soft folds just above the wrist.
 *
 * It replaces folds drawn across the sleeve at the elbow, which read as bands
 * and made a sleeve that bulged there look worse.
 */
export function sleeveDrape({ sleeve, underarm, cuff, elbowY, wristY, cuffTop, round, collects = true, seed }: DrapeSpec): Fold[] {
  const rnd = seeded(seed);
  const spanAt = (y: number) => rowSpan(sleeve, y);
  const first = spanAt(underarm + 6);
  if (!first) return [];
  const leftArm = (first[0] + first[1]) / 2 < 300;
  /* a cuffed sleeve's own cloth ends at the cuff seam */
  const hem = cuffTop ?? cuff;
  /** A point `u` of the way across the sleeve at row `y`: 0 is the outer edge, 1 the inner. */
  const across = (y: number, u: number): Pt | null => {
    const sp = spanAt(y);
    if (!sp) return null;
    const [outer, inner] = leftArm ? [sp[0], sp[1]] : [sp[1], sp[0]];
    return [lerp(outer, inner, u), y];
  };
  const down = (u: number, from: number, to: number, n = 5): Pt[] =>
    Array.from({ length: n }, (_, i) => across(lerp(from, to, i / (n - 1)), u)).filter(
      (p): p is Pt => p !== null
    );
  const folds: Fold[] = [];
  const outward: Pt = [leftArm ? -1 : 1, 0];

  if (round) {
    /*
      The tube. Its lit side faces the light, up and to the left: on his right
      arm — the left of the canvas — that is the outer side, and on his left
      arm the middle, because the side nearer the light there is the side
      against his body. The outer edge turns away from the eye and darkens.
    */
    /*
      Both start up in the head from nothing and widen to the underarm, so
      neither has a top edge to see; begun at the underarm at full width, the
      lit band drew a step across the sleeve there.
    */
    const ys = (sleeve.match(/-?[0-9]*[.]?[0-9]+/g) ?? []).map(Number).filter((_, i) => i % 2 === 1);
    const head = underarm - 0.6 * (underarm - Math.min(...ys));
    const tube = (u: number, to: number, width: number, fold: Omit<Fold, "ridge" | "width">) => {
      const top = down(u, head, underarm + 12, 5);
      const rest = down(u, underarm + 12, to, 7);
      if (top.length >= 2) folds.push({ ...fold, ridge: top, width: [0.4, width] });
      if (rest.length >= 2) folds.push({ ...fold, ridge: rest, width: [width, width * 0.9] });
    };
    tube(leftArm ? 0.3 : 0.48, hem - 4, 9, { shadow: 0, light: 0.3, soft: 9 });
    tube(leftArm ? 0.04 : 0.16, hem - 2, 7, {
      shadow: leftArm ? 0.16 : 0.3,
      light: 0,
      soft: 6,
      shadowToward: outward,
    });
  }

  /* long, soft folds down the sleeve — a short one is too short to fold */
  for (const u of hem - underarm > 60 ? [0.33, 0.66] : []) {
    const ridge = down(u + (rnd() - 0.5) * 0.08, underarm + 18, hem - 12);
    if (ridge.length < 2) continue;
    folds.push({
      ridge,
      width: round ? [4, 7] : [3, 5],
      shadow: (round ? 0.3 : 0.15) * (0.8 + rnd() * 0.4),
      light: round ? 0.22 : 0.13,
      soft: 6,
    });
  }

  /* the shadow the body throws along the inner edge */
  const edge = down(0.86, underarm + 4, hem - 2, 7);
  if (edge.length >= 2) {
    folds.push({
      ridge: edge,
      width: [6, 6],
      shadow: round ? 0.3 : 0.22,
      light: 0,
      soft: 4,
      shadowToward: [leftArm ? 1 : -1, 0],
    });
  }

  /* a faint crease or two at the inner elbow */
  if (spanAt(elbowY + 16)) {
    for (const dy of [-4, 6].slice(0, rnd() < 0.5 ? 1 : 2)) {
      const a = across(elbowY + dy + 3, 0.97);
      const b = across(elbowY + dy - 2, 0.7);
      if (a && b) folds.push({ ridge: [a, b], width: [1.6, 0.4], shadow: 0.15, light: 0.08, soft: 1 });
    }
  }

  if (cuffTop !== undefined) {
    /*
      Gathered into a cuff: two or three short, soft folds running down into
      the seam, leaning in toward it as the fullness is drawn together.
    */
    const gathersAt = rnd() < 0.5 ? [0.28, 0.72] : [0.24, 0.5, 0.76];
    for (const u of gathersAt) {
      const a = across(cuffTop - 16 - rnd() * 6, u + (u - 0.5) * 0.12);
      const b = across(cuffTop + 1, u);
      if (a && b) folds.push({ ridge: [a, along(a, b, 0.5), b], width: [0.8, 3.2], shadow: 0.48, light: 0.3, soft: 2 });
    }
  } else if (collects && cuff >= wristY) {
    /* where a long sleeve's extra length collects, just above the wrist */
    [-30, -21, -12].forEach((dy, i) => {
      const tilt = i % 2 === 0 ? 2.5 : -2.5;
      const a = across(cuff + dy + tilt, 0.22 + rnd() * 0.08);
      const b = across(cuff + dy - tilt, 0.72 + rnd() * 0.1);
      if (a && b) folds.push({ ridge: [a, b], width: [2.2, 0.8], shadow: 0.18, light: 0.12, soft: 2 });
    });
  }
  return folds;
}

/**
 * A puff's gathers — see `PuffShape` in `sleeves.ts`: fine folds spreading
 * from both of its gathered edges, from the crown or the band it hangs from
 * down into the balloon, and from the arm band up into it. Each runs along
 * the balloon as a line of its cloth does — the same share of the way across
 * it at every row — and fades out before the middle, where the cloth is
 * drawn smooth over the bulge. Its roundness is light, not folds — see
 * `puffLight` in `art/sleeveFolds.tsx`.
 *
 * It had four short marks above its band and three at its crown, too few
 * and too short to read as gathered cloth.
 */
export function puffDrape(shape: PuffShape, seed: number): Fold[] {
  const rnd = seeded(seed);
  const { across, top, bottom, widest } = shape;
  /* a point `u` of the way across the puff at row `y`, from its outside */
  const at = (y: number, u: number): Pt => {
    const k = Math.max(0, Math.min(across.length - 1, (y - across[0][0]) / ((across[across.length - 1][0] - across[0][0]) / (across.length - 1) || 1)));
    const i = Math.min(across.length - 2, Math.floor(k));
    const t = k - i;
    const [, o0, i0] = across[i];
    const [, o1, i1] = across[i + 1];
    return [lerp(lerp(o0, o1, t), lerp(i0, i1, t), u), y];
  };
  const run = (u: number, from: number, to: number): Pt[] => Array.from({ length: 6 }, (_, i) => at(lerp(from, to, i / 5), u));
  const folds: Fold[] = [];
  /* from the top: hanging down into the balloon, a little longer toward its middle */
  for (let k = 0; k < PUFF_GATHERS; k++) {
    const u = (k + 0.5 + (rnd() - 0.5) * 0.4) / PUFF_GATHERS;
    /* from a crown they all start from one point, so they start below it, where they have spread */
    const crown = top[0][0] === top[1][0];
    const from = lerp(top[0][1], top[1][1], u) + (crown ? PUFF_CROWN_CLEAR : 1);
    const reach = (widest - from) * (0.45 + 0.25 * Math.sin(Math.PI * u) + rnd() * 0.15);
    folds.push({ ridge: run(u, from, from + reach), width: [crown ? 1.2 : 1.5, 0.3], shadow: 0.42 * (crown ? 0.7 : 1) * (0.75 + rnd() * 0.4), light: 0.3, soft: 1 });
  }
  /* from the band: drawn up into the balloon from where it is gathered round the arm */
  const bandY = bottom[0][1];
  for (let k = 0; k < PUFF_GATHERS; k++) {
    const u = (k + 0.5 + (rnd() - 0.5) * 0.4) / PUFF_GATHERS;
    const reach = (bandY - widest) * (0.4 + 0.25 * Math.sin(Math.PI * u) + rnd() * 0.15);
    folds.push({ ridge: run(u, bandY - 0.5, bandY - reach), width: [1.7, 0.3], shadow: 0.45 * (0.75 + rnd() * 0.4), light: 0.3, soft: 1 });
  }
  return folds;
}
/** How many gathers spread from each of a puff's edges, and how far below its crown's point they start. */
const PUFF_GATHERS = 9;
const PUFF_CROWN_CLEAR = 9;

/* ---------------------------------------------------------- the bodies */

/*
  The layouts every remaining garment's body is folded with. The rules the
  thobe and the dress taught, in one place: folds are soft, long and mostly
  vertical; nothing runs across a piece as a hard band, which on the thobe's
  sleeves read as puffs; and all of it is light and shadow, never outline.
*/

/** A fold reflected about the figure's centre: the right side's, from the left's. */
export function mirrorFold(f: Fold): Fold {
  return {
    ...f,
    ridge: f.ridge.map(([x, y]) => [600 - x, y] as Pt),
    ...(f.shadowToward ? { shadowToward: [-f.shadowToward[0], f.shadowToward[1]] as Pt } : {}),
  };
}

/** A run of points' x at a row, read along it and held at its ends. */
function xAt(run: Pt[], y: number): number {
  if (y <= run[0][1]) return run[0][0];
  for (let i = 1; i < run.length; i++) {
    if (run[i][1] < y) continue;
    const [x0, y0] = run[i - 1];
    const [x1, y1] = run[i];
    return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0 || 1);
  }
  return run[run.length - 1][0];
}

/** A ridge from one point to another, bowed `bow` units to one side at its middle. */
function bowed(a: Pt, b: Pt, bow: number, n = 5): Pt[] {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const len = Math.hypot(dx, dy) || 1;
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const s = Math.sin(Math.PI * t) * bow;
    return [a[0] + dx * t + (-dy / len) * s, a[1] + dy * t + (dx / len) * s] as Pt;
  });
}

export interface TopBodySpec {
  /** Where the body's side seam leaves the arm, on the left. */
  underarm: Pt;
  /** The left side seam, top to bottom. */
  side: Pt[];
  /** The body's own waist row. */
  waistY: number;
  /** The hem's left end, and how far the hem falls below it at centre front. */
  hem: Pt;
  hemDip: number;
  /** Her bust, on a top that goes over one: the apexes, and the crease under them. */
  bust?: { points: readonly (readonly [number, number])[]; creaseY: number };
  seed: number;
}

/** The turn of the cloth under each side of a bust: lit above, in shadow below. */
function bustFolds(bust: NonNullable<TopBodySpec["bust"]>, depth: number): Fold[] {
  return bust.points.map(([x]) =>
    contour({ centre: [x, bust.creaseY], half: 24, sag: 8, width: 6, shadow: 0.22 * depth, light: 0.15 * depth, soft: 6 })
  );
}

/**
 * A knit top: soft, so it folds very little. A drag line or two from the
 * underarm toward the chest, where the sleeve pulls the body; a couple of soft
 * folds at each side of the waist, where the cloth relaxes; and the turn under
 * her bust.
 */
export function knitFolds(s: TopBodySpec): Fold[] {
  const rnd = seeded(s.seed);
  const [ux, uy] = s.underarm;
  const left: Fold[] = [];
  for (const [dx, dy] of [
    [34, -16],
    [30, 1],
  ]) {
    const a: Pt = [ux + 2, uy + 5];
    const b: Pt = [a[0] + dx + (rnd() - 0.5) * 4, a[1] + dy];
    left.push({ ridge: bowed(a, b, -1.5), width: [3, 0.6], shadow: 0.3, light: 0.18, soft: 4 });
  }
  const bottom = Math.min(s.waistY + 26, s.hem[1] - 8);
  for (const [inset, reach] of [
    [7, 1],
    [15, 0.7],
  ]) {
    const x = xAt(s.side, s.waistY) + inset;
    const top = s.waistY - 28 * reach;
    left.push({
      ridge: bowed([x + 1, top], [x + 1, bottom], 1.5),
      width: [3, 3],
      shadow: 0.22,
      light: 0.14,
      soft: 4,
    });
  }
  return [...left, ...left.map(mirrorFold), ...(s.bust ? bustFolds(s.bust, 0.9) : [])];
}

/**
 * A woven top: crisper, and folding in longer lines. A few long folds from
 * the chest to the hem; a soft diagonal fold from each underarm toward the
 * waist, where the cloth is drawn from the side seam to the arm; and the turn
 * under her bust.
 */
export function wovenFolds(s: TopBodySpec): Fold[] {
  const [ux, uy] = s.underarm;
  const chestY = uy + 26;
  const chest = xAt(s.side, chestY) + 16;
  const long = hangingFolds({
    seam: [
      [chest, chestY],
      [600 - chest, chestY],
    ],
    hem: [s.hem, [600 - s.hem[0], s.hem[1]]],
    hemDip: s.hemDip,
    count: 4,
    width: [1.2, 8],
    shadow: 0.3,
    light: 0.18,
    seed: s.seed,
  });
  const waist: Pt = [xAt(s.side, s.waistY) + 16, s.waistY - 6];
  const diagonal: Fold[] = [
    { ridge: bowed([ux + 3, uy + 10], waist, 2), width: [3, 0.8], shadow: 0.26, light: 0.15, soft: 6 },
    {
      ridge: bowed([ux + 4, uy + 26], [waist[0] + 4, waist[1] + 20], 1.5),
      width: [2.4, 0.6],
      shadow: 0.18,
      light: 0.11,
      soft: 6,
    },
  ];
  return [...long, ...diagonal, ...diagonal.map(mirrorFold), ...(s.bust ? bustFolds(s.bust, 1) : [])];
}

export interface SkirtBodySpec {
  /** The hip, left and right, where the folds are released; and the hem, left and right. */
  hip: readonly [Pt, Pt];
  hem: readonly [Pt, Pt];
  hemDip: number;
  /** Where the folds fall across it — the places its hem waves at. */
  at: number[];
  /** The waistband's lower edge, which the darts run down from. */
  bandY: number;
  seed: number;
  /**
   * How wide a fold opens, where it is released and at the hem: a flared
   * skirt's open wide; a pencil's barely, hanging nearly straight.
   */
  width?: readonly [number, number];
}

/**
 * How wide a fitted skirt's folds open at its hem, as a share of a flared
 * skirt's: in step with how far its side comes out between where they are
 * released and the hem — as wide as a flared skirt's for the flared skirt's
 * own 54 units — and never quite shut: a pencil's, which leans in, barely
 * open.
 */
export const foldOpen = (flare: number): number => Math.max(0.18, Math.min(1.2, flare / FLARED_FLARE));
const FLARED_FLARE = 54;

/**
 * A darted A-line skirt: no gathers, so nothing at the waist but two small
 * darts on each side under the band; below the hip — or wherever the skirt
 * starts to flare, a mermaid's above the knee — soft folds falling to the hem
 * and opening as they go.
 */
export function skirtFolds(s: SkirtBodySpec): Fold[] {
  const folds = hangingFolds({
    seam: s.hip,
    hem: s.hem,
    hemDip: s.hemDip,
    count: s.at.length,
    at: s.at,
    width: s.width ?? [1.4, 15],
    shadow: 0.4,
    light: 0.24,
    seed: s.seed,
  });
  const darts = [256, 276].map((x) => dart([x, s.bandY], [x + 1, s.bandY + (x < 266 ? 46 : 38)], 2));
  return [...folds, ...darts, ...darts.map(mirrorFold)];
}

/**
 * A circle skirt's folds: deep pipe folds falling from where it is released
 * — its seam, or a jacket's hem — more of them and deeper than a flared
 * skirt's, each reaching the hem at its own place across it (`at`), where the
 * hem waves under it.
 */
export function circleFolds(s: Omit<HangingSpec, "count" | "width" | "shadow" | "light"> & { at: number[] }): Fold[] {
  return hangingFolds({ ...s, count: s.at.length, width: [1.5, 18], shadow: 0.75, light: 0.42 });
}

export interface TierSpec {
  /** The skirt's outline, as cut. */
  path: string;
  /** The row it shows from — its seam, its band's foot, or a jacket's or a top's hem — and whether that is a seam it is gathered into. */
  top: number;
  gathered: boolean;
  /** The rows its tiers are sewn together at, at the sides. */
  seams: number[];
  /** The hem, left and right, and how far it sags at the centre front. */
  hem: readonly [Pt, Pt];
  hemDip: number;
  /** Where its lowest tier's folds reach the hem, across it from 0 to 1: where the hem waves — see `fallOf`. */
  at: number[];
  seed: number;
}

/*
  A row across a tiered skirt, side to side, sagging at the centre front as its
  hem does, in proportion to how far down the skirt it is: its point `t` of the
  way across, `inset` in from each side.
*/
const tierRow = (s: TierSpec) => {
  const hemY = s.hem[0][1];
  return (y: number) => {
    const [l, r] = rowSpan(s.path, y + 0.5) ?? [s.hem[0][0], s.hem[1][0]];
    const sag = (s.hemDip * (y - s.top)) / Math.max(1, hemY - s.top);
    return (t: number, inset = 0): Pt => [l + inset + (r - l - 2 * inset) * t, y + sag * Math.sin(Math.PI * t)];
  };
};

/** A tiered skirt's seams, each right across it and sagging at the centre front as its hem does, the lower more. */
export const tierSeams = (s: TierSpec): Pt[][] => {
  const row = tierRow(s);
  return s.seams.map((y) => {
    const at = row(y);
    return Array.from({ length: 13 }, (_, i) => at(i / 12, 1));
  });
};

/**
 * How far apart a tier's gathers are at its seam, in centimetres: 1.5 on the
 * first, closer on each fuller tier below it, 1 on the third.
 */
const GATHER_APART = [1.5, 1.25, 1];
/** How far down from its seam a gather runs before it relaxes into the tier's folds, in centimetres. */
const GATHER_RUN = [5, 8];
/** The seam's shadow, just under it where the tier below hangs from it: about 5 mm. */
const TIER_SEAM_SHADOW = 2.6;

/**
 * A tiered skirt's gathers, tier by tier: many small ones close together
 * right under each seam — under the first only where it is gathered into its
 * seam or band, not under a hem that hides that — standing out for their
 * first 5 to 8 cm and narrowing as they relax into the tier's folds. A lower
 * tier is cut fuller, so it is wider and its gathers closer: more of them.
 */
export function tierGathers(s: TierSpec): Fold[][] {
  const rnd = seeded(s.seed + 1);
  const row = tierRow(s);
  return [s.top, ...s.seams].map((top, k) => {
    if (k === 0 && !s.gathered) return [];
    const [l, r] = rowSpan(s.path, top + 0.5) ?? [s.hem[0][0], s.hem[1][0]];
    const apart = GATHER_APART[Math.min(k, GATHER_APART.length - 1)] / BODY_CANVAS.cmPerUnit;
    const count = Math.max(3, Math.round((r - l - 4) / apart));
    const from = row(top);
    return Array.from({ length: count }, (_, i): Fold => {
      const t = (i + 0.5 + (rnd() - 0.5) * 0.5) / count;
      const [x, y] = from(t, 2);
      const run = lerp(GATHER_RUN[0], GATHER_RUN[1], rnd()) / BODY_CANVAS.cmPerUnit;
      /* each its own: leaning a little either way, bowed, some deeper than others */
      const lean = (rnd() - 0.5) * 2.4;
      const bow = (rnd() - 0.5) * 1.6;
      const strength = 0.6 + rnd() * 0.6;
      return {
        ridge: [[x, y], [x + lean * 0.4 + bow, y + run * 0.4], [x + lean, y + run]],
        width: [1.5 + rnd(), 0.4],
        shadow: 0.34 * strength,
        light: 0.22 * strength,
        soft: 1,
      };
    });
  });
}

/**
 * A tiered skirt's gathers as shapes a print bends along — see `clothWarp`'s
 * `gathers`: a narrow band round each, narrowing as the gather relaxes. The
 * print is moved, never resized.
 */
export const tierRidges = (s: TierSpec): string =>
  tierGathers(s)
    .flat()
    .map(({ ridge, width }) => {
      const n = ridge.length - 1;
      const half = (i: number) => lerp(width[0], width[1], i / n) * 0.7;
      const side = (k: number) => ridge.map(([x, y], i) => [x + k * half(i), y] as Pt);
      return `M${[...side(-1), ...side(1).reverse()].map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")} Z`;
    })
    .join(" ");

/**
 * A tiered skirt's folds, lit as one piece of cloth from its seam to its hem.
 * Each tier is gathered into the seam above it — see `tierGathers` — and its
 * gathers relax into fewer, longer, softer folds that open within the tier's
 * first quarter and run on, hardly narrowing, to just short of the seam below:
 * so no tier darkens toward its foot, or lightens, and starts again below it.
 * The lower the tier, the more folds it has; the lowest's fall to the hem,
 * where it waves (`at`). Each seam reads as a seam from across the room: a
 * thin lit line, and a narrow soft shadow just under it, where the gathered
 * tier hangs from it — see `tierSeams`.
 *
 * They were the same stiff pipe folds in every tier, widest at its foot, with
 * a band of gathers and a seam fold under each seam: a stack of dark-footed
 * bands rather than one skirt. Then, lit evenly, its seams and gathers were too
 * fine to see on the whole figure, and it read as a plain A-line.
 */
export function tierFolds(s: TierSpec): Fold[] {
  const rnd = seeded(s.seed);
  const row = tierRow(s);
  const tops = [s.top, ...s.seams];
  const feet = [...s.seams, s.hem[0][1]];
  const gathers = tierGathers(s);
  const folds: Fold[] = gathers.flat();
  tops.forEach((top, k) => {
    const from = row(top);
    const to = row(feet[k]);
    const lowest = k === tops.length - 1;
    const gathered = gathers[k].length > 0;
    /* below the gathers, fewer, longer and softer folds, rising among their lower half where they relax into them */
    const n = 7 + 2 * k;
    const places = lowest ? s.at : Array.from({ length: n }, (_, i) => (i + 0.5 + (rnd() - 0.5) * 0.5) / n);
    for (const t of places) {
      const at = from(t, 5);
      const begin: Pt = [at[0], at[1] + (gathered ? lerp(18, 30, rnd()) : 2)];
      const sway = (rnd() - 0.5) * 5;
      const w = (6 + 1.5 * k) * (0.7 + rnd() * 0.5);
      const strength = 0.7 + rnd() * 0.4;
      const soft = Math.max(2, w * 0.5);
      if (lowest) {
        /* the lowest tier's open to the hem, reaching it where it waves — past it, which the region trims */
        const foot = along(s.hem[0], s.hem[1], t);
        const end: Pt = [foot[0], foot[1] + s.hemDip * Math.sin(Math.PI * t) + 12];
        folds.push({
          ridge: [0, 0.33, 0.66, 1].map((u) => [lerp(begin[0], end[0], u) + sway * Math.sin(Math.PI * u), lerp(begin[1], end[1], u)] as Pt),
          width: [0.8, w * 1.4],
          shadow: 0.36 * strength,
          light: 0.22 * strength,
          soft,
        });
        continue;
      }
      /* any other tier's open within its first quarter, and run on, hardly narrowing, to just short of the seam below */
      const foot = to(t, 4);
      const end: Pt = [foot[0], foot[1] - 2 - rnd() * 3];
      const p = (u: number): Pt => [lerp(begin[0], end[0], u) + sway * Math.sin(Math.PI * u), lerp(begin[1], end[1], u)];
      folds.push(
        { ridge: [p(0), p(0.12), p(0.25)], width: [0.5, w], shadow: 0.32 * strength, light: 0.2 * strength, soft },
        { ridge: [p(0.25), p(0.62), p(1)], width: [w, w * 0.8], shadow: 0.32 * strength, light: 0.2 * strength, soft }
      );
    }
  });
  /* the seams: a thin lit line right across, and a narrow soft shadow just under it */
  for (const seam of tierSeams(s)) {
    folds.push(
      { ridge: seam, width: [1, 1], shadow: 0, light: 0.4, soft: 1 },
      { ridge: seam, width: [TIER_SEAM_SHADOW, TIER_SEAM_SHADOW], shadow: 0.5, light: 0, soft: 1 }
    );
  }
  return folds;
}

export interface PleatSpec {
  /** Where the pleats start, left and right — a seam, or a jacket's hem it comes out from under — and the hem. */
  top: readonly [Pt, Pt];
  hem: readonly [Pt, Pt];
  hemDip: number;
  /** Where each pleat folds, across it from 0 to 1 — see `fallOf`. */
  lines: number[];
  /**
   * A flat panel down the centre front, x from its left edge to its right,
   * and how many pleats there are: they are laid either side of it instead —
   * see `pleatsBeside` — so none lies under a placket down it.
   */
  panel?: { count: number; x: readonly [number, number] };
}

/**
 * A pleated skirt's pleats: a line where each one folds, from where they
 * start to the hem, at its own place across it — spread with the skirt, so
 * they stay as far apart in step with it all the way down. Pressed, so each
 * is crisp and narrow: lit on the side toward the light, in shadow on the
 * other, where it lies over the next. They run a little past the hem, which
 * the region's mask trims. Light and shadow only: the print under them
 * stays whole, at its true size.
 */
export function pleatFolds(s: PleatSpec): Fold[] {
  if (s.panel) {
    /* beside a flat panel: each fold from its place across the top to its place across the hem */
    const { count, x } = s.panel;
    const tops = pleatsBeside(count, s.top[0][0], s.top[1][0], x);
    const feet = pleatsBeside(count, s.hem[0][0], s.hem[1][0], x);
    return tops.map((tx, i) => {
      const ty = (tx - s.top[0][0]) / (s.top[1][0] - s.top[0][0]);
      const t = (feet[i] - s.hem[0][0]) / (s.hem[1][0] - s.hem[0][0]);
      const top = along(s.top[0], s.top[1], ty);
      const foot = along(s.hem[0], s.hem[1], t);
      const end: Pt = [feet[i], foot[1] + s.hemDip * Math.sin(Math.PI * t) + 6];
      return { ridge: [top, along(top, end, 0.5), end], width: [1.2, 1.8], shadow: 0.5, light: 0.3, soft: 1 };
    });
  }
  return s.lines.map((t) => {
    const top = along(s.top[0], s.top[1], t);
    const foot = along(s.hem[0], s.hem[1], t);
    const end: Pt = [foot[0], foot[1] + s.hemDip * Math.sin(Math.PI * t) + 6];
    return { ridge: [top, along(top, end, 0.5), end], width: [1.2, 1.8], shadow: 0.5, light: 0.3, soft: 1 };
  });
}

/** How far above a trouser's hem the leg breaks over the foot: about 3.8 cm. */
const BREAK_ABOVE = 20;

export interface TrouserBodySpec {
  /** The left leg's outline, the waistband's lower edge, the crotch and the hem. */
  leg: string;
  bandY: number;
  crotchY: number;
  hemY: number;
  seed: number;
}

/**
 * A pressed trouser: a crease down the front of each leg from the waist to
 * the hem — a fold in the light, a thin soft highlight on the side facing it
 * and a little shadow on the other, subtle; drawn bright, it read as a white
 * stripe — and otherwise very little. A few soft folds at the top of the
 * thigh, where the cloth is drawn toward the crotch, and one soft fold across
 * the front a few centimetres above the hem, where the leg breaks over the
 * foot and the crease bends a little. That break was two short strokes
 * meeting in a point, which read as arrowheads.
 */
export function trouserFolds(s: TrouserBodySpec): Fold[] {
  const rows: Pt[] = [];
  for (let y = s.bandY + 8; y <= s.hemY - 6; y += 12) {
    const sp = rowSpan(s.leg, y);
    if (sp) rows.push([(sp[0] + sp[1]) / 2, y]);
  }
  /* smoothed, so the crease does not step where the leg leaves the trunk */
  const crease: Pt[] = rows.map(([, y], i) => {
    const near = rows.slice(Math.max(0, i - 2), i + 3);
    return [near.reduce((a, [x]) => a + x, 0) / near.length, y] as Pt;
  });
  const folds: Fold[] = [];
  /* the break: where the leg meets the foot, the crease bends a little inward below it */
  const breakY = s.hemY - BREAK_ABOVE;
  const bent = crease.map(([x, y]) => [y > breakY ? x + 1.5 : x, y] as Pt);
  if (bent.length >= 2) {
    folds.push({ ridge: bent, width: [1.8, 1.8], shadow: 0.14, light: 0.17, soft: 1.5 });
  }
  const top = rowSpan(s.leg, s.crotchY + 6);
  if (top) {
    const inner = top[1];
    folds.push(
      { ridge: bowed([inner - 4, s.crotchY + 8], [inner - 30, s.crotchY - 18], 1.5), width: [2.8, 0.5], shadow: 0.26, light: 0.15, soft: 4 },
      { ridge: bowed([inner - 5, s.crotchY + 18], [inner - 34, s.crotchY + 2], 1.5), width: [2.2, 0.4], shadow: 0.2, light: 0.12, soft: 4 }
    );
  }
  const across = rowSpan(s.leg, breakY);
  if (across) {
    const [x0, x1] = [across[0] + 5, across[1] - 5];
    const cx = (across[0] + across[1]) / 2;
    /* one soft fold across the front, sagging a little where it meets the crease */
    folds.push({
      ridge: [
        [x0, breakY - 1],
        [cx - 10, breakY + 0.5],
        [cx, breakY + 2],
        [cx + 10, breakY + 0.5],
        [x1, breakY - 1],
      ],
      width: [2.6, 2.6],
      shadow: 0.2,
      light: 0.14,
      soft: 4,
    });
  }
  return [...folds, ...folds.map(mirrorFold)];
}

export interface JacketBodySpec {
  /** The button the fronts close on. */
  button: Pt;
  /** The left side seam, top to bottom. */
  side: Pt[];
  /** A front dart: where it starts at the chest, its row there, and the row it ends at. */
  dart: { x: number; from: number; to: number };
  seed: number;
}

/**
 * A jacket's fronts: gentle folds pulled toward the button at the waist, and
 * a dart down each front that follows the body's own curve in and out rather
 * than running ruler-straight.
 */
export function jacketFolds(s: JacketBodySpec): Fold[] {
  const [bx, by] = s.button;
  const pulls: Fold[] = [
    { ridge: bowed([bx - 8, by - 3], [bx - 46, by - 24], -1.5), width: [3, 0.6], shadow: 0.26, light: 0.16, soft: 4 },
    { ridge: bowed([bx - 8, by + 5], [bx - 42, by + 22], 1.5), width: [2.6, 0.5], shadow: 0.22, light: 0.13, soft: 4 },
  ];
  /* the dart keeps its distance from the centre line in proportion to the body's */
  const at = (y: number) => xAt(s.side, y);
  const share = (300 - s.dart.x) / (300 - at(s.dart.from));
  const ridge: Pt[] = Array.from({ length: 9 }, (_, i) => {
    const y = s.dart.from + ((s.dart.to - s.dart.from) * i) / 8;
    return [300 - (300 - at(y)) * share, y] as Pt;
  });
  const dartFold: Fold = { ridge, width: [1.1, 0.5], shadow: 0.4, light: 0.2, soft: 1 };
  return [...pulls, dartFold, ...[...pulls, dartFold].map(mirrorFold)];
}

/**
 * The roll of a lapel along its fold line, from the gorge to the break: a lit
 * crest where the cloth turns over, and a soft shadow just outside it on the
 * lapel's face as it falls away. Given one lapel's fold line; the shadow falls
 * away from the centre line, whichever side it is on.
 */
export function lapelRoll(gorge: readonly [number, number], brk: readonly [number, number]): Fold[] {
  const ridge = Array.from({ length: 8 }, (_, i) => along([gorge[0], gorge[1]], [brk[0], brk[1]], i / 7));
  const out: Pt = [(gorge[0] + brk[0]) / 2 < 300 ? -1 : 1, 0];
  const off = ridge.map(([x, y]) => [x + out[0] * 3.5, y] as Pt);
  return [
    { ridge, width: [2.4, 2.4], shadow: 0, light: 0.34, soft: 2 },
    { ridge: off, width: [4, 4], shadow: 0.22, light: 0, soft: 3, shadowToward: out },
  ];
}

/* ------------------------------------------------------------------ drawing */

/** Toward the light, upper left, in canvas coordinates (y runs down). */
const LIGHT: Pt = [-Math.SQRT1_2, -Math.SQRT1_2];

/** The shadow a fully dark fold multiplies the cloth by. */
const SHADOW_GREY = "#4d4d4d";

/** Coordinates rounded to a tenth of a unit, so the markup is the same everywhere. */
const r1 = (v: number) => Math.round(v * 10) / 10;

/** One flank of a fold as a closed shape: the ridge, and the ridge pushed out to one side. */
function flank(fold: Fold, lit: boolean): string {
  const { ridge, width } = fold;
  const n = ridge.length;
  const out: Pt[] = ridge.map(([x, y], i) => {
    const [px, py] = ridge[Math.max(0, i - 1)];
    const [qx, qy] = ridge[Math.min(n - 1, i + 1)];
    const len = Math.hypot(qx - px, qy - py) || 1;
    // the ridge's normal, turned to face the light (lit) or away from it
    let nx = -(qy - py) / len;
    let ny = (qx - px) / len;
    // the lit flank faces the light, unless the fold says where its shadow falls
    const [lx, ly] = fold.shadowToward ? [-fold.shadowToward[0], -fold.shadowToward[1]] : LIGHT;
    const facing = nx * lx + ny * ly > 0;
    if (facing !== lit) {
      nx = -nx;
      ny = -ny;
    }
    const w = lerp(width[0], width[1], n === 1 ? 0 : i / (n - 1));
    return [x + nx * w, y + ny * w];
  });
  const pts = [...ridge, ...out.reverse()];
  return `M${pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join(" L")} Z`;
}

/** The softness levels folds are drawn at; each fold takes the nearest. */
const SOFTNESS = [1, 2, 4, 6, 9] as const;
const level = (soft: number) =>
  SOFTNESS.reduce((best, s) => (Math.abs(s - soft) < Math.abs(best - soft) ? s : best), SOFTNESS[0]);

/** The blur filters folds are drawn through. Put once in a region's `defs`. */
export function foldDefs(uid: Uid): ReactNode {
  return (
    <>
      {SOFTNESS.map((s) => (
        <filter
          key={s}
          id={uid(`fold-soft-${s}`)}
          x="-30%"
          y="-30%"
          width="160%"
          height="160%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation={s} />
        </filter>
      ))}
    </>
  );
}

function drawFlanks(uid: Uid, folds: Fold[], lit: boolean): ReactNode {
  const groups = SOFTNESS.map((s) => ({ s, folds: folds.filter((f) => level(f.soft) === s) }));
  return (
    <>
      {groups
        .filter((g) => g.folds.length > 0)
        .map(({ s, folds: fs }) => (
          <g key={s} filter={`url(#${uid(`fold-soft-${s}`)})`}>
            {fs.map((f, i) => {
              const amount = lit ? f.light : f.shadow;
              if (amount <= 0) return null;
              return (
                <path
                  key={i}
                  d={flank(f, lit)}
                  fill={lit ? "#ffffff" : SHADOW_GREY}
                  fillOpacity={r1(Math.min(1, amount) * (lit ? 0.6 : 1) * 100) / 100}
                />
              );
            })}
          </g>
        ))}
    </>
  );
}

/** The folds' shadowed flanks — for a region's `shading`, which multiplies — and, on a cloth with a sheen, the deeper shadow beside their crests. */
export const foldShadows = (uid: Uid, folds: Fold[]): ReactNode => (
  <>
    {drawFlanks(uid, folds, false)}
    <FoldShade uid={uid} folds={folds} />
  </>
);

/**
 * Where on a fold's lit flank a smooth cloth's highlight lies, as shares of
 * the flank's width from the ridge out: just off the crest, toward the light,
 * where the cloth turns its face to the lamp — see `crest`.
 */
export const CREST: readonly [from: number, to: number] = [0.1, 0.42];

/** The ridge's normal at each point, turned toward the light — the side a fold's lit flank lies on. */
function litNormals(fold: Fold): Pt[] {
  const { ridge } = fold;
  const n = ridge.length;
  return ridge.map((_, i) => {
    const [px, py] = ridge[Math.max(0, i - 1)];
    const [qx, qy] = ridge[Math.min(n - 1, i + 1)];
    const len = Math.hypot(qx - px, qy - py) || 1;
    let nx = -(qy - py) / len;
    let ny = (qx - px) / len;
    if (nx * LIGHT[0] + ny * LIGHT[1] <= 0) {
      nx = -nx;
      ny = -ny;
    }
    return [nx, ny];
  });
}

/**
 * The band along a fold's crest a smooth cloth shines in: from `CREST[0]` to
 * `CREST[1]` of the lit flank's width out from the ridge, the way the flank
 * itself widens along it.
 */
export function crest(fold: Fold): string {
  const { ridge, width } = fold;
  const n = ridge.length;
  const normals = litNormals(fold);
  const at = (share: number) =>
    ridge.map(([x, y], i): Pt => {
      const w = lerp(width[0], width[1], n === 1 ? 0 : i / (n - 1)) * share;
      return [x + normals[i][0] * w, y + normals[i][1] * w];
    });
  const pts = [...at(CREST[0]), ...at(CREST[1]).reverse()];
  return `M${pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join(" L")} Z`;
}

/**
 * Where beside a fold's crest a smooth cloth's shadow deepens, as shares of
 * the shadowed flank's width from the ridge out: right against the crest, on
 * the side turned away from the light — see `shade`.
 */
export const SHADE: readonly [from: number, to: number] = [0.04, 0.55];

/**
 * The band beside a fold's crest a smooth cloth's shadow deepens in: from
 * `SHADE[0]` to `SHADE[1]` of the shadowed flank's width out from the ridge,
 * on the side away from the light — the crest's highlight's other side.
 */
export function shade(fold: Fold): string {
  const { ridge, width } = fold;
  const n = ridge.length;
  const normals = litNormals(fold).map(([x, y]): Pt => [-x, -y]);
  const at = (share: number) =>
    ridge.map(([x, y], i): Pt => {
      const w = lerp(width[0], width[1], n === 1 ? 0 : i / (n - 1)) * share;
      return [x + normals[i][0] * w, y + normals[i][1] * w];
    });
  const pts = [...at(SHADE[0]), ...at(SHADE[1]).reverse()];
  return `M${pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join(" L")} Z`;
}

/** How deep the shadow beside a fold's crest falls, for a look: with the fold's own shadow, down to the look's deepest. */
export const shadeOpacity = (fold: Fold, look: SheenLook): number =>
  Math.floor(Math.min(look.shadeMax, (look.shade * fold.shadow) / 0.5) * 100) / 100;

/**
 * The deeper shadow beside each fold's crest, on a cloth with a sheen —
 * multiplied, in the region's shading; on a matte cloth, nothing. A satin
 * reads as one by this as much as by its highlight: bright, and right beside
 * it dark. Cool (`SHADE_COLOR`), so on a warm cloth it falls grey-beige; and
 * through the crest's own blur, sharp across the fold and drawn out along the
 * grain. The folds that shine (`FoldSheen`), and that have a shadow side.
 */
export function FoldShade({ uid, folds }: { uid: Uid; folds: Fold[] }) {
  const sheen = useContext(SheenContext);
  if (!sheen) return null;
  const lit = folds.filter((f) => f.light > 0 && f.shadow > 0 && !f.shadowToward);
  return (
    <>
      {SOFTNESS.map((s) => {
        const at = lit.filter((f) => level(f.soft) === s);
        if (at.length === 0) return null;
        return (
          <Fragment key={s}>
            {alongGrain(
              sheen,
              `url(#${uid(`sheen-shade-${s}`)})`,
              at.map((f, i) => <path key={i} d={shade(f)} fill={SHADE_COLOR} fillOpacity={shadeOpacity(f, sheen.look)} />)
            )}
          </Fragment>
        );
      })}
    </>
  );
}

/** How bright a fold's crest shines, for a look: with the fold's own light, up to the look's most. */
export const crestOpacity = (fold: Fold, look: SheenLook): number =>
  Math.floor(Math.min(look.crestMax, (look.crest * fold.light) / 0.3) * 100) / 100;

/**
 * The highlight along each fold's crest, on a cloth with a sheen — the
 * region's, from `SheenContext`; on a matte cloth, nothing. Only a fold that
 * catches the light shines: a shadow thrown on the cloth (`shadowToward`) is
 * no crest. Drawn out along the grain (`alongGrain`), each softness level
 * through its own blur, as the folds' flanks are.
 */
export function FoldSheen({ uid, folds }: { uid: Uid; folds: Fold[] }) {
  const sheen = useContext(SheenContext);
  if (!sheen) return null;
  const lit = folds.filter((f) => f.light > 0 && !f.shadowToward);
  return (
    <>
      {SOFTNESS.map((s) => {
        const at = lit.filter((f) => level(f.soft) === s);
        if (at.length === 0) return null;
        return (
          <Fragment key={s}>
            {alongGrain(
              sheen,
              `url(#${uid(`sheen-crest-${s}`)})`,
              at.map((f, i) => <path key={i} d={crest(f)} fill={sheen.tint} fillOpacity={crestOpacity(f, sheen.look)} />)
            )}
          </Fragment>
        );
      })}
    </>
  );
}

/** The folds' lit flanks — for a region's `light`, which screens — and, on a cloth with a sheen, the highlight along their crests. */
export const foldLights = (uid: Uid, folds: Fold[]): ReactNode => (
  <>
    {drawFlanks(uid, folds, true)}
    <FoldSheen uid={uid} folds={folds} />
  </>
);
