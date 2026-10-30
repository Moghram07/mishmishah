import type { FrontId, Garment } from "@/types";

/**
 * How a robe is worn at the front, by name: hanging open, or closed down the
 * centre on hidden snaps. The drafting is `robe` in `lib/garments/sleeves.ts`.
 */
export interface Front {
  id: FrontId;
  name: { en: string; ar: string };
}

const FRONT_NAMES: Record<FrontId, { en: string; ar: string }> = {
  open: { en: "Open", ar: "مفتوحة" },
  closed: { en: "Closed", ar: "مقفلة" },
};

const FRONTS: FrontId[] = ["open", "closed"];

export const fronts: Front[] = FRONTS.map((id) => ({ id, name: FRONT_NAMES[id] }));

/** The fronts a garment can be worn with, open first. */
export const frontsFor = (garment: Garment): Front[] =>
  fronts.filter((f) => garment.fronts?.offered.includes(f.id));
