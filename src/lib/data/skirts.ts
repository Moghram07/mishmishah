import type { Garment, SkirtLengthId, SkirtShapeId, WaistId } from "@/types";
import { SKIRT_LENGTHS, SKIRT_SHAPES, WAISTS, shapeLengths } from "@/lib/garments/skirts";

/**
 * The skirt catalogue: the shapes a skirt is cut to, the lengths it is cut at
 * and the waists a dress's hangs from, by name. The geometry lives in
 * `lib/garments/skirts.ts`, and the ids are read from there, so the catalogue
 * and the drafting cannot disagree about what a shape, a length or a waist is.
 */

export interface SkirtShape {
  id: SkirtShapeId;
  name: { en: string; ar: string };
}

const SHAPE_NAMES: Record<SkirtShapeId, { en: string; ar: string }> = {
  aline: { en: "A-line", ar: "A لاين" },
  flared: { en: "Flared", ar: "نص كلوش" },
  circle: { en: "Circle", ar: "كلوش" },
  pencil: { en: "Pencil", ar: "قلم" },
  pleated: { en: "Pleated", ar: "بليسيه" },
  mermaid: { en: "Mermaid", ar: "سمكة" },
};

export const skirtShapes: SkirtShape[] = SKIRT_SHAPES.map((id) => ({ id, name: SHAPE_NAMES[id] }));

/** The shapes a garment's skirt is cut to, in the order the picker offers them. */
export const skirtShapesFor = (garment: Garment): SkirtShape[] =>
  skirtShapes.filter((s) => garment.skirt?.shapes.includes(s.id));

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

/**
 * The lengths a garment's skirt is cut at, shortest first — in a shape, those
 * of them that shape is cut at: a mermaid's, midi and maxi.
 */
export const skirtLengthsFor = (garment: Garment, shape?: SkirtShapeId): SkirtLength[] => {
  const offered = garment.skirt?.lengths ?? [];
  const cut = shape ? shapeLengths(shape, offered) : offered;
  return skirtLengths.filter((l) => cut.includes(l.id));
};

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
