/*
  Plain `.ts`, relative and extensioned, and no JSX — so `scripts/
  preview-garments.mjs` imports it and checks the skirts the app draws. See
  `art/female/dressCut.ts` for why that matters.
*/
import { column, draft, foldPlaces, sideRun, type Tuck } from "./fit.ts";
import type { BodyZone, SkirtChoice, SkirtLengthId, SkirtShapeId, WaistId } from "@/types";

/**
 * A skirt — the skirt garment's, or a dress's below its waist seam — is cut
 * from shared parts: a shape and a length. What stays each garment's own is how
 * it finishes its skirt: where the top edge sits, whether it has a band, how
 * its hem falls. A dress's skirt is sewn under its bodice; a skirt sits on its
 * own waistband.
 */
export interface SkirtFinish {
  /** How far below the body's own waist its top edge sits; negative is above. */
  rise: number;
  /** Its ease at the waist, held down to the hip. */
  ease: number;
  /** How far its hem drops at centre front, where it turns toward you. */
  dip: number;
  /** A waistband this deep, cut from the skirt's own edge. */
  band?: number;
  /** A hem that waves where the folds reach it — see `column`. */
  wave?: { at: number[]; depth: number };
}

/**
 * How each shape is cut — see `column`. Each is one line down her, however
 * long: a knee skirt is the maxi cut shorter, never a steeper skirt.
 *
 * - **A-line** is straight from where it leaves her, 22 units out in every
 *   100 down: from its seam, or, where she widens faster than that below it,
 *   from her high hip — at her own waist, about y 410, and at an empire's,
 *   which falls close to her as far as her waist first. It reaches her arms,
 *   so a sleeve is drawn in front of it (`wide`).
 * - **Flared** is fitted to the hip and flares from there, 80 units out by
 *   y 760: the dress's own flare.
 * - **Pencil** is fitted to the hip and hangs from it on a line leaning in by
 *   4 units in every 100 — 10 by her knee, about 1.9 cm a side — never
 *   closer to her than its ease.
 * - **Mermaid** follows her hips and thighs in to just above her knee, y 650,
 *   and opens there as a bell, slowly and then fast: 75 units out by her
 *   ankle, y 890.
 * - **Circle** is cut as a full circle of cloth, so it stands out from its
 *   seam at once — 55 units out in every 100 down at her waist — and less
 *   and less below, until it hangs plumb from her ankle, y 890 (`plumb`):
 *   full from the seam, falling straight below the knee. Its cloth falls in
 *   deep folds, and its hem waves deeply where they reach it (`waves`).
 * - **Pleated** is an A-line pressed into pleats: its outline the A-line's,
 *   and across it, pleat lines from the seam to the hem — 14 pleats across
 *   the front — where its hem steps a little at each (`pleats`).
 * - **Tiered** is three tiers sewn one under another, each cut fuller than
 *   the one above and gathered into the seam: one flowing line from where it
 *   leaves her to its hem, the A-line's, kinking out only a little at each
 *   seam — 2.4 units, under half a centimetre — as the tier under it is
 *   gathered fuller (`tiers`). It was a 10-unit step at each, which read as
 *   a stack of steps rather than a dress. The seams are 30 and 62 in every
 *   100 of the way from its seam to its hem, so it has three tiers at every
 *   length, each a little longer than the one above. Its hem waves softly
 *   where its lowest tier's folds reach it (`waves`).
 *
 * And how each falls: `dip` is its share of its garment's hem's sag — a
 * narrow hem sags less at the front. A `fitted` shape is darted to her
 * rather than gathered: a dress's skirt in it is not gathered into the seam.
 * A circle and a pleated skirt are neither: a circle is cut to fit the waist
 * as it is, and a pleated skirt's pleats take it in. A tiered skirt is
 * gathered, at its seam and at each of its tiers'.
 *
 * `lengths` are the lengths a shape is cut at, where not every one: a
 * mermaid's flare opens above the knee, so it is cut at midi and maxi only.
 */
interface ShapeCut {
  flare: number;
  flareTo: number;
  flareFrom?: number;
  curve?: number;
  taper?: number;
  straight?: number;
  plumb?: number;
  dip?: number;
  fitted?: boolean;
  wide?: boolean;
  /** Its folds' count across it — a tiered skirt's lowest tier's — and how deep and how wide its hem waves under each. */
  waves?: { count: number; depth: number; width: number };
  /** How many pleats across the front, and how far its hem steps down to each one's fold. */
  pleats?: { count: number; step: number };
  /** Where its tiers are sewn together, as shares of the way from its seam to its hem, and how far out each steps. */
  tiers?: { at: readonly number[]; out: number };
  lengths?: readonly SkirtLengthId[];
}
const SHAPES: Record<SkirtShapeId, ShapeCut> = {
  aline: { flare: 0, flareTo: 760, straight: 0.22, fitted: true, wide: true },
  flared: { flare: 80, flareTo: 760 },
  circle: { flare: 0, flareTo: 760, straight: 0.55, plumb: 890, wide: true, waves: { count: 11, depth: 6, width: 11 } },
  pencil: { flare: 0, flareTo: 760, taper: 0.04, dip: 0.5, fitted: true },
  pleated: { flare: 0, flareTo: 760, straight: 0.22, wide: true, pleats: { count: 14, step: 1.6 } },
  tiered: { flare: 0, flareTo: 760, straight: 0.22, wide: true, tiers: { at: [0.3, 0.62], out: 2.4 }, waves: { count: 13, depth: 2.5, width: 9 } },
  mermaid: { flare: 75, flareFrom: 650, flareTo: 890, curve: 1.3, dip: 0.75, fitted: true, lengths: ["midi", "maxi"] },
};

/** The shapes, in the order the picker offers them. */
export const SKIRT_SHAPES: readonly SkirtShapeId[] = ["aline", "flared", "circle", "pencil", "pleated", "tiered", "mermaid"];

/** The seed a circle's folds are placed by — see `foldPlaces` — so its hem and its folds agree. */
const WAVE_SEED = 41;

/**
 * How far out a straight shape's side comes between two rows — an A-line's
 * line, a circle's bowed one — or nothing: see `ShapeCut` and `sideRun`.
 */
export const fallRun = (shape: SkirtShapeId): ((from: number, to: number) => number) | undefined => {
  const { straight, plumb } = SHAPES[shape];
  if (straight === undefined) return undefined;
  return sideRun(straight, plumb !== undefined ? { top: draft("female").waistY, plumb } : undefined);
};

/** Of the lengths a garment offers, those a shape is cut at — see `ShapeCut`. */
export const shapeLengths = (shape: SkirtShapeId, offered: readonly SkirtLengthId[]): SkirtLengthId[] =>
  offered.filter((length) => SHAPES[shape].lengths?.includes(length) ?? true);

/**
 * A skirt as it can be cut, of the lengths its garment offers: at its own
 * length, or at the nearest its shape is cut at — a mermaid asked for at the
 * knee is cut at midi.
 */
export function cutAs(skirt: SkirtChoice, offered: readonly SkirtLengthId[]): SkirtChoice {
  const lengths = shapeLengths(skirt.shape, offered);
  if (lengths.length === 0 || lengths.includes(skirt.length)) return skirt;
  const off = (length: SkirtLengthId) => Math.abs(HEM_AT[length] - HEM_AT[skirt.length]);
  return { ...skirt, length: lengths.reduce((best, length) => (off(length) < off(best) ? length : best)) };
}

/**
 * How a shape's cloth falls, for its folds: the row they are released at, if
 * lower than the hip — where it starts to flare, a mermaid's above the knee —
 * its share of its garment's hem sag, and whether it is fitted rather than
 * gathered. A circle's folds fall from its seam at `waves`, where its hem
 * waves under them, and so do a tiered skirt's lowest tier's, from the seam
 * above it; a pleated skirt has its `pleats`' lines across it, 0 to 1, where
 * its hem steps. See `ShapeCut`.
 */
export const fallOf = (
  shape: SkirtShapeId
): { from?: number; dip: number; fitted: boolean; waves?: number[]; pleats?: number[] } => {
  const s = SHAPES[shape];
  return {
    ...(s.flareFrom !== undefined ? { from: s.flareFrom } : {}),
    dip: s.dip ?? 1,
    fitted: s.fitted ?? false,
    ...(s.waves ? { waves: foldPlaces(s.waves.count, WAVE_SEED) } : {}),
    ...(s.pleats ? { pleats: pleatLines(s.pleats.count) } : {}),
  };
};

/** Where `count` pleats fold, across the front from 0 to 1: evenly, so the two halves mirror. */
const pleatLines = (count: number): number[] => Array.from({ length: count - 1 }, (_, i) => (i + 1) / count);

/**
 * How far below her own waist each waist's seam is sewn: empire just under
 * the bust — 36 units up, about 6.8 cm, which is 2.7 cm below the lower curve
 * of her bust at y 300, so the bodice covers all of it; natural at the waist
 * itself; dropped at the low hip — 70 units, about 13 cm down, between the
 * waist at y 350 and the hip at 454.
 *
 * The empire's was 50 up, 10 below the darkest of the shading under her bust
 * at y 290 — but that is its underside, and the seam crossed the bust's lower
 * curve, level with a short sleeve's hem.
 */
export const WAIST_DROP: Record<WaistId, number> = {
  empire: -36,
  natural: 0,
  dropped: 70,
};

/** The waists, highest first — the order the picker offers them in. */
export const WAISTS: readonly WaistId[] = ["empire", "natural", "dropped"];

/**
 * Whether a skirt hangs from a seam above her waist — an empire's — rather
 * than resting on her: it falls from the seam past her ribs and her waist,
 * close to her, beside her arms — see `column`'s `hang`.
 */
export const hangs = (skirt: SkirtChoice): boolean => WAIST_DROP[skirt.waist ?? "natural"] < 0;

/**
 * Whether a skirt falls beside her arms — hung from above her waist, or cut
 * wide enough to reach them, an A-line — so that a sleeve hangs in front of
 * it rather than under it.
 */
export const besideArms = (skirt: SkirtChoice): boolean => hangs(skirt) || Boolean(SHAPES[skirt.shape].wide);

/** The lengths, shortest first — the order the picker offers them in. */
export const SKIRT_LENGTHS: readonly SkirtLengthId[] = ["knee", "midi", "maxi"];

/**
 * Where each length's hem falls at the side seams: her landmarks in
 * `mannequin/bodies.ts` — knee 686, ankle 906, floor 950 — at 0.19 cm a unit.
 */
export const HEM_AT: Record<SkirtLengthId, number> = {
  /* just over the knee */
  knee: 700,
  /* about 14 cm below the knee, where the dress has always ended */
  midi: 760,
  /* just above the foot, where the thobe stops */
  maxi: 890,
};

/**
 * The zones below the hip a skirt's length hides, added to its garment's own —
 * as a sleeve's length decides the arm. Every length covers the thigh; a maxi
 * the knee and the calf too. A midi passes over the knee as well, but claims
 * only the thigh, as the dress always has: a claim erases the photograph under
 * it, and nothing there shows.
 */
const LENGTH_ZONES: Record<SkirtLengthId, BodyZone[]> = {
  knee: ["thigh"],
  midi: ["thigh"],
  maxi: ["thigh", "knee", "calf"],
};

export const skirtCoverage = (skirt: SkirtChoice): BodyZone[] => LENGTH_ZONES[skirt.length];

/** A skirt as cut: its outline, its band, and where it starts and ends. */
export type CutSkirt = ReturnType<typeof column>;

/** One key per style, for the caches that keep each cut once. */
export const skirtKey = (skirt: SkirtChoice): string =>
  `${skirt.shape}|${skirt.length}|${skirt.waist ?? "natural"}`;

export const sameSkirt = (a: SkirtChoice, b: SkirtChoice): boolean => skirtKey(a) === skirtKey(b);

/**
 * One skirt, cut to a style: on its own, or under a jacket's hem — see
 * `tucked`. A dress's skirt is sewn on at its waist's seam, wherever that is;
 * from a seam above her waist it hangs — see `column`'s `hang`.
 */
export function skirtCut(finish: SkirtFinish, skirt: SkirtChoice, inside?: Tuck): CutSkirt {
  const { flare, flareTo, flareFrom, curve, taper, straight, plumb, dip = 1, waves, pleats, tiers } = SHAPES[skirt.shape];
  const fall = fallOf(skirt.shape);
  const drop = WAIST_DROP[skirt.waist ?? "natural"];
  /* a tiered skirt's seams, on its own rows: shares of the way from where it is sewn on — a dress's seam, a skirt's band — to its hem */
  const sewn = draft("female").waistY + drop + Math.max(0, finish.rise) + (finish.band ?? 0);
  const toY = HEM_AT[skirt.length];
  return column("female", {
    rise: finish.rise + drop,
    ...(hangs(skirt) ? { hang: drop } : {}),
    toY,
    ease: finish.ease,
    flare,
    flareTo,
    ...(flareFrom !== undefined ? { flareFrom } : {}),
    ...(curve !== undefined ? { curve } : {}),
    ...(taper !== undefined ? { taper } : {}),
    /*
      straight from its seam, a dress's — never from under its bodice — or from a skirt's own top edge;
      and never from above her own waist: hung from an empire's seam, it falls close to her to the waist first
    */
    ...(straight !== undefined
      ? { straight: { slope: straight, from: Math.max(0, drop) + Math.max(0, finish.rise), ...(plumb !== undefined ? { plumb } : {}) } }
      : {}),
    ...(tiers ? { tiers: { at: tiers.at.map((t) => sewn + (toY - sewn) * t), out: tiers.out } } : {}),
    dip: finish.dip * dip,
    ...(finish.band ? { band: finish.band } : {}),
    /*
      a hem waves where folds reach it, and one that does not flare has none; a circle's waves deeply under its
      own folds, on any garment, and a pleated skirt's steps at its pleats instead
    */
    ...(waves && fall.waves
      ? { wave: { at: fall.waves, depth: waves.depth, width: waves.width } }
      : pleats && fall.pleats
        ? { steps: { at: fall.pleats, depth: pleats.step } }
        : finish.wave && (flare > 0 || straight !== undefined)
          ? { wave: finish.wave }
          : {}),
    ...(inside ? { inside } : {}),
  });
}
