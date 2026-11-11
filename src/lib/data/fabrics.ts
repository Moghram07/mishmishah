import type { Fabric } from "@/types";
import { assertMotifScale, fabricAverageColor } from "@/lib/fabrics/patterns";
import { hexToLab } from "@/lib/color/cielab";

/**
 * The fabric catalogue — plain data, no code.
 *
 * Adding a fabric is adding a record here. Note what is *not* in these records:
 * a print size. A procedural fabric's scale comes from its motif (all plaids
 * are 8 cm, full stop), which is what keeps two fabrics of the same motif from
 * drifting apart. A photographed fabric is the only kind that carries scale, as
 * `cmPerPixel` — set `source: "image"`, give an `imageUrl` and its measured
 * density (`cmPerPixelForDpi(300)` for a 300 DPI scan), and nothing else
 * changes.
 */
export const fabrics: Fabric[] = [
  {
    id: "fb-apricot-linen",
    name: { en: "Apricot Grove Linen", ar: "كتّان بستان المشمش" },
    source: "procedural",
    motif: "solid",
    palette: { base: "#FF8C54", accent: "#F0501A", highlight: "#FFD0B3" },
    color: "#FF6A2C",
    material: "linen",
    colorName: { en: "Apricot", ar: "مشمشي" },
    texture: "woven",
    categories: ["fashion", "home-decor", "curtains"],
  },
  {
    id: "fb-saffron-stripe",
    name: { en: "Saffron Cabana Stripe", ar: "خطوط الزعفران" },
    source: "procedural",
    motif: "stripe",
    palette: { base: "#FBF7F0", accent: "#E8A13A", highlight: "#FFFFFF" },
    color: "#E8A13A",
    material: "cotton",
    colorName: { en: "Saffron", ar: "زعفراني" },
    texture: "smooth",
    categories: ["fashion", "outdoor", "home-decor"],
  },
  {
    id: "fb-rose-silk",
    name: { en: "Rosewater Silk", ar: "حرير ماء الورد" },
    source: "procedural",
    motif: "solid",
    palette: { base: "#D98BA6", accent: "#B4708F", highlight: "#F4D6E1" },
    color: "#D98BA6",
    material: "silk",
    colorName: { en: "Rose", ar: "وردي" },
    texture: "smooth",
    categories: ["fashion", "wedding", "luxury"],
  },
  {
    id: "fb-indigo-plaid",
    name: { en: "Kyoto Indigo Plaid", ar: "كاروهات كيوتو النيلية" },
    source: "procedural",
    motif: "plaid",
    palette: { base: "#26456F", accent: "#3F6FB0", highlight: "#BCD3EF" },
    color: "#3F6FB0",
    material: "cotton",
    colorName: { en: "Indigo", ar: "نيلي" },
    texture: "woven",
    categories: ["fashion", "accessories"],
  },
  {
    id: "fb-emerald-velvet",
    name: { en: "Emerald Court Velvet", ar: "مخمل زمردي" },
    source: "procedural",
    motif: "solid",
    palette: { base: "#2F6B4F", accent: "#20503A", highlight: "#6FB893" },
    color: "#2F6B4F",
    material: "velvet",
    colorName: { en: "Emerald", ar: "زمردي" },
    texture: "pile",
    categories: ["furniture", "luxury", "home-decor"],
  },
  {
    id: "fb-terracotta-herring",
    name: { en: "Terracotta Herringbone", ar: "سنبلة قرميدي" },
    source: "procedural",
    motif: "herringbone",
    palette: { base: "#E7C6A8", accent: "#C4623A", highlight: "#F5E6D6" },
    color: "#C4623A",
    material: "wool",
    colorName: { en: "Terracotta", ar: "قرميدي" },
    texture: "woven",
    categories: ["fashion", "furniture"],
  },
  {
    id: "fb-cream-dots",
    name: { en: "Cream Confetti Dot", ar: "نقاط كريمية" },
    source: "procedural",
    motif: "dots",
    palette: { base: "#FBF7F0", accent: "#FF6A2C", highlight: "#E8A13A" },
    color: "#FBF7F0",
    material: "cotton",
    colorName: { en: "Cream", ar: "كريمي" },
    texture: "smooth",
    categories: ["fashion", "accessories", "home-decor"],
  },
  {
    id: "fb-midnight-floral",
    name: { en: "Midnight Bloom", ar: "زهور منتصف الليل" },
    source: "procedural",
    motif: "floral",
    palette: { base: "#1F2B45", accent: "#FF8C54", highlight: "#E8A13A" },
    color: "#1F2B45",
    material: "silk",
    colorName: { en: "Navy", ar: "كحلي" },
    texture: "smooth",
    categories: ["fashion", "wedding", "curtains", "luxury"],
  },
  {
    id: "fb-desert-geo",
    name: { en: "Desert Tile Geometric", ar: "نقش هندسي رملي" },
    source: "procedural",
    motif: "geometric",
    palette: { base: "#E7D3B4", accent: "#C4894B", highlight: "#8A5A2B" },
    color: "#D9B382",
    material: "cotton",
    colorName: { en: "Sand", ar: "رملي" },
    texture: "woven",
    categories: ["home-decor", "rugs", "furniture"],
  },
  {
    id: "fb-denim-classic",
    name: { en: "Selvedge Denim", ar: "دينم سيلفدج" },
    source: "procedural",
    motif: "solid",
    palette: { base: "#3A5A80", accent: "#2A4360", highlight: "#8FA9C4" },
    color: "#3A5A80",
    material: "denim",
    colorName: { en: "Blue", ar: "أزرق" },
    texture: "woven",
    categories: ["fashion", "accessories"],
  },
  {
    id: "fb-blush-chiffon",
    name: { en: "Blush Cloud Chiffon", ar: "شيفون وردي فاتح" },
    source: "procedural",
    motif: "solid",
    palette: { base: "#F3C9C2", accent: "#E4A79E", highlight: "#FCEAE6" },
    color: "#F3C9C2",
    material: "chiffon",
    colorName: { en: "Blush", ar: "وردي فاتح" },
    texture: "sheer",
    categories: ["fashion", "wedding", "curtains"],
  },
  {
    id: "fb-forest-plaid",
    name: { en: "Highland Forest Plaid", ar: "كاروهات أخضر داكن" },
    source: "procedural",
    motif: "plaid",
    palette: { base: "#264A38", accent: "#3E8564", highlight: "#D9B382" },
    color: "#3E8564",
    material: "wool",
    colorName: { en: "Green", ar: "أخضر" },
    texture: "woven",
    categories: ["fashion", "furniture", "outdoor"],
  },
  {
    id: "fb-ivory-damask",
    name: { en: "Palace Ivory Damask", ar: "دمشقي عاجي فاخر" },
    source: "procedural",
    motif: "damask",
    palette: { base: "#F2E7D2", accent: "#B99247", highlight: "#8A5A2B" },
    color: "#B99247",
    material: "silk",
    colorName: { en: "Ivory", ar: "عاجي" },
    texture: "smooth",
    categories: ["home-decor", "curtains", "luxury", "wedding"],
  },
  /* the plain black most abayas are cut from */
  {
    id: "fb-black-crepe",
    name: { en: "Black Crepe", ar: "كريب أسود" },
    source: "procedural",
    motif: "solid",
    palette: { base: "#1F1D1F", accent: "#0F0E10", highlight: "#4B474C" },
    color: "#161417",
    material: "crepe",
    colorName: { en: "Black", ar: "أسود" },
    texture: "smooth",
    categories: ["fashion"],
  },
  /* plain white: most thobes, and the stripes on a navy sailor collar */
  {
    id: "fb-white",
    name: { en: "White", ar: "أبيض" },
    source: "procedural",
    motif: "solid",
    palette: { base: "#FAFAF8", accent: "#E6E5E1", highlight: "#FFFFFF" },
    color: "#FAFAF8",
    material: "cotton",
    colorName: { en: "White", ar: "أبيض" },
    texture: "smooth",
    categories: ["fashion"],
  },
  /* white with a little warmth in it — softer than pure white, not as yellow as cream */
  {
    id: "fb-off-white",
    name: { en: "Off-white", ar: "أوفوايت" },
    source: "procedural",
    motif: "solid",
    palette: { base: "#F2EDE3", accent: "#DDD5C6", highlight: "#FAF7F1" },
    color: "#F2EDE3",
    material: "cotton",
    colorName: { en: "Off-white", ar: "أوفوايت" },
    texture: "smooth",
    categories: ["fashion"],
  },
];

// Fails loudly in dev if scale ever stops being motif-owned. See the note on
// `assertMotifScale` — this is the guard for a bug that already happened once.
assertMotifScale(fabrics);

export const fabricById = (id: string) => fabrics.find((f) => f.id === id);

/**
 * The plain cloth a collar's stripes arrive in, so they show from the first —
 * stripes cut from the collar's own cloth would not show at all: of the plain
 * samples, the one furthest from it in lightness (CIE L*, of each average
 * colour). On dark cloth that is the white, as on a navy sailor collar; on
 * light cloth, the black crepe.
 */
export function contrastingPlain(fabric: Fabric): Fabric {
  const lightness = (f: Fabric) => hexToLab(fabricAverageColor(f))[0];
  const own = lightness(fabric);
  const plain = fabrics.filter((f) => f.source === "procedural" && f.motif === "solid" && f.id !== fabric.id);
  return plain.reduce((best, f) => (Math.abs(lightness(f) - own) > Math.abs(lightness(best) - own) ? f : best));
}
