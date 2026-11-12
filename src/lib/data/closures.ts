import type { BeltId, ButtonsId, Garment, SkirtShapeId } from "@/types";
import { beltsOn, buttonsOn } from "@/lib/garments/closures";

/**
 * A dress's buttons and belts, by name. Which a dress can wear on which cut
 * is decided in `lib/garments/closures.ts` — buttons down a straight centre
 * front only, a belt on any cut but a wrap — and read from there, so the
 * picker and the drawing cannot disagree.
 */
export interface Choice<Id extends string> {
  id: Id;
  name: { en: string; ar: string };
}

const BUTTON_NAMES: Record<ButtonsId, { en: string; ar: string }> = {
  none: { en: "None", ar: "بدون" },
  waist: { en: "To the waist", ar: "حتى الخصر" },
  hem: { en: "All the way down", ar: "حتى الأسفل" },
};

const BELT_NAMES: Record<BeltId, { en: string; ar: string }> = {
  none: { en: "None", ar: "بدون" },
  /* in any cloth now, the dress's own to begin with — see `clothOf` */
  self: { en: "Fabric", ar: "قماش" },
  brown: { en: "Brown leather", ar: "جلد بني" },
  black: { en: "Black leather", ar: "جلد أسود" },
};

/** The buttons a garment can be worn with, cut as it is: none where its cut cannot be buttoned, and only to the waist over a mermaid. */
export const buttonsFor = (garment: Garment, cut: string | undefined, shape?: SkirtShapeId): Choice<ButtonsId>[] =>
  garment.buttons && cut ? buttonsOn(cut, garment.buttons.offered, shape).map((id) => ({ id, name: BUTTON_NAMES[id] })) : [];

/** The belts a garment can be worn with, cut as it is: none on a cut that ties its own. */
export const beltsFor = (garment: Garment, cut: string | undefined): Choice<BeltId>[] =>
  garment.belts && cut ? beltsOn(cut, garment.belts.offered).map((id) => ({ id, name: BELT_NAMES[id] })) : [];
