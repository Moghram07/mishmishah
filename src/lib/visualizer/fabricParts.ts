import type { Garment, Localized, WornGarment } from "@/types";
import { clothOf, regionsOf } from "@/lib/garments/outfit";

/**
 * The phone's fabrics panel offers the whole of a garment first —
 * «الفستان كله» — so a dress takes one pick, not one for its top and one
 * for its bottom; the same for a garment with a placket, a collar or a belt,
 * which otherwise would keep the old cloth on the part not picked.
 *
 * What the first chip calls the whole of each: Arabic agrees with the
 * garment, so each is written out. A garment of one part has no such chip.
 */
export const WHOLE_NAMES: Readonly<Record<string, Localized>> = {
  "female-dress": { ar: "الفستان كله", en: "Whole dress" },
  "female-blouse": { ar: "البلوزة كلها", en: "Whole blouse" },
  "female-t-shirt": { ar: "التي شيرت كله", en: "Whole T-shirt" },
  "female-jacket": { ar: "الجاكيت كله", en: "Whole jacket" },
  "male-t-shirt": { ar: "التي شيرت كله", en: "Whole T-shirt" },
  "male-shirt": { ar: "القميص كله", en: "Whole shirt" },
  "male-polo": { ar: "البولو كله", en: "Whole polo" },
  "male-jacket": { ar: "الجاكيت كله", en: "Whole jacket" },
  "male-thobe": { ar: "الثوب كله", en: "Whole thobe" },
};

/** Whether the panel offers the whole of this garment as worn: it has a name for it, and more than one part. */
export const offersWhole = (garment: Garment, worn: WornGarment) =>
  Boolean(WHOLE_NAMES[garment.id]) && regionsOf(garment, worn).length > 1;

/**
 * The garment cut from one cloth in one pick: its own parts — a dress's top
 * and bottom, a thobe's body and placket — and every part now in the same
 * cloth as them, a collar or a belt of its own cloth. A part in a cloth of
 * its own — the sailor's white stripes, a red tie — keeps it; a part with no
 * cloth yet already follows the garment (`clothOf`).
 */
export function wearWhole(worn: WornGarment, garment: Garment, fabricId: string): WornGarment {
  const own = garment.fabricRegions;
  const main = clothOf(worn, own[0]);
  const fabrics = { ...worn.fabrics };
  for (const region of regionsOf(garment, worn)) {
    const cloth = worn.fabrics[region];
    if (own.includes(region) || (cloth !== undefined && cloth === main)) fabrics[region] = fabricId;
  }
  return { ...worn, fabrics };
}
