import type { StitchColor } from "@/types";

/**
 * Topstitch thread colors, picked per garment part. `tonal` is the thread a
 * tailor reaches for by default — it takes the color of the fabric it sits on,
 * so it is resolved at render time rather than stored here.
 */
export const stitchColors: StitchColor[] = [
  { id: "hidden", label: { en: "Hidden", ar: "مخفية" }, color: null },
  { id: "tonal", label: { en: "Tonal", ar: "بلون القماش" }, color: null },
  { id: "cream", label: { en: "Cream", ar: "كريمي" }, color: "#FBF7F0" },
  { id: "apricot", label: { en: "Apricot", ar: "مشمشي" }, color: "#FF6A2C" },
  { id: "charcoal", label: { en: "Charcoal", ar: "فحمي" }, color: "#1B1714" },
  { id: "gold", label: { en: "Gold", ar: "ذهبي" }, color: "#E8A13A" },
];

export const stitchById = (id: string) =>
  stitchColors.find((s) => s.id === id) ?? stitchColors[0];
