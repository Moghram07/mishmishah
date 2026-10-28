import type { Garment, SkirtLengthId, WaistId } from "@/types";
import { SKIRT_LENGTHS, WAISTS } from "@/lib/garments/skirts";

/**
 * The skirt catalogue: the lengths a skirt is cut at and the waists a dress's
 * hangs from, by name. The geometry lives in `lib/garments/skirts.ts`, and the
 * ids are read from there, so the catalogue and the drafting cannot disagree
 * about what a length or a waist is.
 */

export interface SkirtLength {
  id: SkirtLengthId;
  name: { en: string; ar: string };
}

const LENGTH_NAMES: Record<SkirtLengthId, { en: string; ar: string }> = {
  knee: { en: "Knee", ar: "للركبة" },
  midi: { en: "Midi", ar: "ميدي" },
  maxi: { en: "Maxi", ar: "ماكسي" },
};

export const skirtLengths: SkirtLength[] = SKIRT_LENGTHS.map((id) => ({
  id,
  name: LENGTH_NAMES[id],
}));

/** The lengths a garment's skirt is cut at, shortest first. */
export const skirtLengthsFor = (garment: Garment): SkirtLength[] =>
  skirtLengths.filter((l) => garment.skirt?.lengths.includes(l.id));

export interface Waist {
  id: WaistId;
  name: { en: string; ar: string };
}

const WAIST_NAMES: Record<WaistId, { en: string; ar: string }> = {
  empire: { en: "Empire", ar: "عالٍ" },
  natural: { en: "Natural", ar: "طبيعي" },
  dropped: { en: "Dropped", ar: "منخفض" },
};

export const waists: Waist[] = WAISTS.map((id) => ({ id, name: WAIST_NAMES[id] }));

/** The waists a garment's skirt hangs from, highest first — a dress's; a skirt has its own band. */
export const waistsFor = (garment: Garment): Waist[] =>
  waists.filter((w) => garment.skirt?.waists?.includes(w.id));
