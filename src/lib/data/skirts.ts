import type { Garment, SkirtLengthId } from "@/types";
import { SKIRT_LENGTHS } from "@/lib/garments/skirts";

/**
 * The skirt catalogue: the lengths a skirt is cut at, by name. The geometry
 * lives in `lib/garments/skirts.ts`, and the ids are read from there, so the
 * catalogue and the drafting cannot disagree about what a length is.
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
