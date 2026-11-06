import type { Garment, LegId } from "@/types";
import { LEG_SHAPES } from "@/lib/garments/legs";

/**
 * The trouser legs, by name: straight, slim and wide. The geometry lives in
 * `lib/garments/legs.ts`, and the ids are read from there, so the catalogue and
 * the drafting cannot disagree about what a leg is.
 */
export interface Leg {
  id: LegId;
  name: { en: string; ar: string };
}

const LEG_NAMES: Record<LegId, { en: string; ar: string }> = {
  straight: { en: "Straight", ar: "مستقيم" },
  slim: { en: "Slim", ar: "ضيق" },
  wide: { en: "Wide", ar: "واسع" },
};

export const legs: Leg[] = LEG_SHAPES.map((id) => ({ id, name: LEG_NAMES[id] }));

/** The legs a pair of trousers can be cut with, in the order the picker offers them. */
export const legsFor = (garment: Garment): Leg[] => legs.filter((l) => garment.legs?.offered.includes(l.id));
