import { garmentById } from "@/lib/data/garments";
import type { Fabric, Localized } from "@/types";

/**
 * What a fabric suits that is not a garment: a tie — a necktie, a bow, a
 * scarf, worn on many garments — «ربطة», the user's word.
 */
export const SUIT_PARTS: Readonly<Record<string, Localized>> = {
  tie: { en: "Tie", ar: "ربطة" },
};

/**
 * The garments a fabric suits, by name, each once — her T-shirt and his are
 * one «تي شيرت», as are the two pairs of trousers and the two jackets — and
 * then any part it suits: a tie.
 */
export function suitsNames(fabric: Fabric): Localized[] {
  const seen = new Set<string>();
  const out: Localized[] = [];
  for (const id of fabric.suits) {
    const g = garmentById(id);
    if (!g || seen.has(g.name.en)) continue;
    seen.add(g.name.en);
    out.push(g.name);
  }
  for (const id of fabric.suits) if (SUIT_PARTS[id]) out.push(SUIT_PARTS[id]);
  return out;
}
