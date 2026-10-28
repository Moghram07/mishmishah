/*
  Plain `.ts`, relative and extensioned, and no JSX — so `scripts/
  preview-garments.mjs` imports it and checks the skirts the app draws. See
  `art/female/dressCut.ts` for why that matters.
*/
import { column, type Tuck } from "./fit.ts";
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
 * - **Flared** is fitted to the hip and flares from there, 80 units out by
 *   y 760: the dress's own flare.
 * - **Pencil** is fitted to the hip and hangs from it on a line leaning in by
 *   4 units in every 100 — 10 by her knee, about 1.9 cm a side — never
 *   closer to her than its ease.
 * - **Mermaid** follows her hips and thighs in to just above her knee, y 650,
 *   and opens there as a bell, slowly and then fast: 75 units out by her
 *   ankle, y 890.
 *
 * And how each falls: `dip` is its share of its garment's hem's sag — a
 * narrow hem sags less at the front. A `fitted` shape is darted to her
 * rather than gathered: a dress's skirt in it is not gathered into the seam.
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
  dip?: number;
  fitted?: boolean;
  lengths?: readonly SkirtLengthId[];
}
const SHAPES: Record<SkirtShapeId, ShapeCut> = {
  flared: { flare: 80, flareTo: 760 },
  pencil: { flare: 0, flareTo: 760, taper: 0.04, dip: 0.5, fitted: true },
  mermaid: { flare: 75, flareFrom: 650, flareTo: 890, curve: 1.3, dip: 0.75, fitted: true, lengths: ["midi", "maxi"] },
};

/** The shapes, fullest first — the order the picker offers them in. */
export const SKIRT_SHAPES: readonly SkirtShapeId[] = ["flared", "pencil", "mermaid"];

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
 * gathered. See `ShapeCut`.
 */
export const fallOf = (shape: SkirtShapeId): { from?: number; dip: number; fitted: boolean } => {
  const s = SHAPES[shape];
  return {
    ...(s.flareFrom !== undefined ? { from: s.flareFrom } : {}),
    dip: s.dip ?? 1,
    fitted: s.fitted ?? false,
  };
};

/**
 * How far below her own waist each waist's seam is sewn: empire under the
 * bust — 50 units up, about 9.5 cm, and 10 below the crease under it at
 * y 290; natural at the waist itself; dropped at the low hip — 70 units,
 * about 13 cm down, between the waist at y 350 and the hip at 454.
 */
export const WAIST_DROP: Record<WaistId, number> = {
  empire: -50,
  natural: 0,
  dropped: 70,
};

/** The waists, highest first — the order the picker offers them in. */
export const WAISTS: readonly WaistId[] = ["empire", "natural", "dropped"];

/**
 * Whether a skirt hangs from a seam above her waist — an empire's — rather
 * than resting on her: it falls past her waist, beside her arms.
 */
export const hangs = (skirt: SkirtChoice): boolean => WAIST_DROP[skirt.waist ?? "natural"] < 0;

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
  const { flare, flareTo, flareFrom, curve, taper, dip = 1 } = SHAPES[skirt.shape];
  const drop = WAIST_DROP[skirt.waist ?? "natural"];
  return column("female", {
    rise: finish.rise + drop,
    ...(hangs(skirt) ? { hang: drop } : {}),
    toY: HEM_AT[skirt.length],
    ease: finish.ease,
    flare,
    flareTo,
    ...(flareFrom !== undefined ? { flareFrom } : {}),
    ...(curve !== undefined ? { curve } : {}),
    ...(taper !== undefined ? { taper } : {}),
    dip: finish.dip * dip,
    ...(finish.band ? { band: finish.band } : {}),
    /* a hem waves where folds reach it, and one that does not flare has none */
    ...(finish.wave && flare > 0 ? { wave: finish.wave } : {}),
    ...(inside ? { inside } : {}),
  });
}
