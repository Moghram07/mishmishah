import type { Category, CategoryKey } from "@/types";
import { FEATURES } from "@/lib/features";

/** Categories that belong to the home products (see `lib/features.ts`). */
const HOME_ONLY: CategoryKey[] = ["furniture", "curtains"];

const ALL: Category[] = [
  { key: "fashion", label: { en: "Fashion", ar: "أزياء" }, color: "#FF6A2C" },
  { key: "furniture", label: { en: "Furniture", ar: "أثاث" }, color: "#3E8564" },
  { key: "curtains", label: { en: "Curtains", ar: "ستائر" }, color: "#3F6FB0" },
  { key: "luxury", label: { en: "Luxury", ar: "فاخرة" }, color: "#9E3311" },
  { key: "wedding", label: { en: "Wedding", ar: "أعراس" }, color: "#D98BA6" },
];

/**
 * The categories offered for browsing — only those our fabrics actually
 * serve. Rugs, outdoor and accessories wait until there are fabrics for them;
 * furniture and curtains return with the home products.
 */
export const categories: Category[] = FEATURES.home
  ? ALL
  : ALL.filter((c) => !HOME_ONLY.includes(c.key));
