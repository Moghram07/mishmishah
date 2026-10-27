import type { FabricRegionId, Localized } from "@/types";

/**
 * What each fabric region is called.
 *
 * The names live here rather than on every garment record, because a collar is
 * a collar on a blouse and on a coat. A garment record therefore lists region
 * *ids* only — one less thing to translate twice.
 */
const LABELS: Record<FabricRegionId, Localized> = {
  body: { en: "Body", ar: "الجسم" },
  top: { en: "Top", ar: "الأعلى" },
  bottom: { en: "Bottom", ar: "الأسفل" },
  collar: { en: "Collar", ar: "الياقة" },
  placket: { en: "Placket", ar: "شريط الأزرار" },
  lapel: { en: "Lapel", ar: "طيّة الصدر" },
  sleeve: { en: "Sleeve", ar: "الكم" },
  cuff: { en: "Cuff", ar: "الكبك" },
  waistband: { en: "Waistband", ar: "الحزام" },
};

export const regionLabel = (id: FabricRegionId): Localized =>
  LABELS[id] ?? { en: id, ar: id };
