import type { ColorFamily, Fabric, FabricMaterial, FabricMotif, Localized } from "@/types";

/**
 * How the fabric library is narrowed: by colour, by type, by pattern — the
 * three a customer asks for at a fabric shop's counter. Shared by the
 * visualizer's picker, the visualizer page and Discover, so a fabric is found
 * under the same names everywhere.
 */

/** The colour filter's families, as a swatch book runs: the light neutrals to black, then the colours round the wheel. */
export const COLOR_FAMILIES: readonly { id: ColorFamily; hex: string; name: Localized }[] = [
  { id: "white", hex: "#FAFAF8", name: { en: "White", ar: "أبيض" } },
  { id: "cream", hex: "#F1E6CC", name: { en: "Cream", ar: "كريمي" } },
  { id: "beige", hex: "#D6C3A3", name: { en: "Beige", ar: "بيج" } },
  { id: "brown", hex: "#7A5235", name: { en: "Brown", ar: "بني" } },
  { id: "grey", hex: "#9A9B9F", name: { en: "Grey", ar: "رمادي" } },
  { id: "black", hex: "#1C1B1D", name: { en: "Black", ar: "أسود" } },
  { id: "navy", hex: "#1F2A44", name: { en: "Navy", ar: "كحلي" } },
  { id: "blue", hex: "#3F6FB0", name: { en: "Blue", ar: "أزرق" } },
  { id: "green", hex: "#3E8564", name: { en: "Green", ar: "أخضر" } },
  { id: "yellow", hex: "#E3B23C", name: { en: "Yellow", ar: "أصفر" } },
  { id: "orange", hex: "#FF8C54", name: { en: "Orange", ar: "برتقالي" } },
  { id: "red", hex: "#C62630", name: { en: "Red", ar: "أحمر" } },
  { id: "pink", hex: "#E58FB0", name: { en: "Pink", ar: "وردي" } },
  { id: "purple", hex: "#8B6BB8", name: { en: "Purple", ar: "بنفسجي" } },
];

/** The type filter's order: the everyday cloths first. */
export const MATERIALS: readonly FabricMaterial[] = [
  "cotton",
  "linen",
  "crepe",
  "nida",
  "jersey",
  "denim",
  "wool",
  "silk",
  "velvet",
  "chiffon",
  "leather",
];

/**
 * What the pattern filter calls a fabric. A plain cloth is plain whatever its
 * surface — a linen's slubs, a crepe's grain and a denim's twill are its type,
 * not a pattern; a pattern goes by its family, small or large.
 */
export type PatternFamily =
  | "solid"
  | "stripe"
  | "plaid"
  | "houndstooth"
  | "herringbone"
  | "dots"
  | "floral"
  | "paisley"
  | "geometric"
  | "damask";

const PATTERN_OF: Record<FabricMotif, PatternFamily> = {
  solid: "solid",
  slub: "solid",
  crepe: "solid",
  nida: "solid",
  twill: "solid",
  suiting: "solid",
  jersey: "solid",
  stripe: "stripe",
  pinstripe: "stripe",
  wideStripe: "stripe",
  plaid: "plaid",
  gingham: "plaid",
  tartan: "plaid",
  houndstooth: "houndstooth",
  herringbone: "herringbone",
  dots: "dots",
  dotsLarge: "dots",
  floral: "floral",
  floralLarge: "floral",
  paisley: "paisley",
  geometric: "geometric",
  damask: "damask",
};

export const PATTERN_FAMILIES: readonly PatternFamily[] = [
  "solid",
  "stripe",
  "plaid",
  "houndstooth",
  "herringbone",
  "dots",
  "floral",
  "paisley",
  "geometric",
  "damask",
];

/** Its pattern family — none for a photograph, which says nothing of its pattern. */
export function patternOf(fabric: Fabric): PatternFamily | undefined {
  return fabric.source === "procedural" ? PATTERN_OF[fabric.motif] : undefined;
}

/**
 * Whether it has a print to see — a pattern, which a close-up brings out. A
 * plain cloth has none: its surface (a plain weave, a linen's slubs, a crepe's
 * grain, a twill, a knit) is drawn at its true size, finer than a screen shows
 * even close up, so zooming in on it shows nothing more.
 */
export const hasPrint = (fabric: Fabric) => patternOf(fabric) !== "solid";

export interface FabricFilter {
  color?: ColorFamily;
  material?: FabricMaterial;
  pattern?: PatternFamily;
}

export const isFiltered = (f: FabricFilter) => Boolean(f.color || f.material || f.pattern);

/** The fabrics that pass every filter set. */
export function filterFabrics(list: readonly Fabric[], f: FabricFilter): Fabric[] {
  return list.filter(
    (x) =>
      (!f.color || x.colorFamily === f.color) &&
      (!f.material || x.material === f.material) &&
      (!f.pattern || patternOf(x) === f.pattern)
  );
}

export interface FilterChoice<T> {
  id: T;
  /** How many fabrics it would show, with the other two filters as they are — 0, it is shown but cannot be picked. */
  count: number;
}

/**
 * What each filter offers: every value some fabric in the list has, in its
 * order, each counted against the other two filters as set — so a choice that
 * would empty the grid is shown dimmed rather than taken away, and nothing
 * moves under a finger.
 */
export function filterChoices(list: readonly Fabric[], f: FabricFilter) {
  const count = <T,>(values: readonly T[], of: (x: Fabric) => T | undefined, others: FabricFilter) => {
    const pool = filterFabrics(list, others);
    return values
      .filter((v) => list.some((x) => of(x) === v))
      .map((id): FilterChoice<T> => ({ id, count: pool.filter((x) => of(x) === id).length }));
  };
  return {
    colors: count(
      COLOR_FAMILIES.map((c) => c.id),
      (x) => x.colorFamily,
      { ...f, color: undefined }
    ),
    materials: count(MATERIALS, (x) => x.material, { ...f, material: undefined }),
    patterns: count(PATTERN_FAMILIES, patternOf, { ...f, pattern: undefined }),
  };
}

export const colorFamilyById = (id: ColorFamily) => COLOR_FAMILIES.find((c) => c.id === id)!;

/**
 * A swatch book's order: by colour family, plain before patterned within one,
 * then as the library lists them.
 */
export function swatchOrder(list: readonly Fabric[]): Fabric[] {
  const colour = (x: Fabric) => COLOR_FAMILIES.findIndex((c) => c.id === x.colorFamily);
  const pattern = (x: Fabric) => {
    const p = patternOf(x);
    return p ? PATTERN_FAMILIES.indexOf(p) : PATTERN_FAMILIES.length;
  };
  return list
    .map((x, i) => ({ x, i }))
    .sort((a, b) => colour(a.x) - colour(b.x) || pattern(a.x) - pattern(b.x) || a.i - b.i)
    .map(({ x }) => x);
}
