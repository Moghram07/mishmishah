import { garmentById } from "@/lib/data/garments";
import type { Fabric, Localized } from "@/types";

/**
 * The garments a fabric suits, by name, each once — her T-shirt and his are
 * one «تي شيرت», as are the two pairs of trousers and the two jackets.
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
  return out;
}
