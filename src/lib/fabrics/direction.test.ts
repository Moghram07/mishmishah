import { describe, expect, it } from "vitest";
import { fabrics } from "@/lib/data/fabrics";
import { MOTIFS, fabricHasDirection } from "./patterns";
import type { Fabric, FabricMotif } from "@/types";

/**
 * Which fabrics are offered a pattern direction — «طولي · عرضي · مائل».
 *
 * Only a pattern whose way round shows: a stripe, a check, a lattice that
 * turns to diamonds on the bias, a one-way print. A plain weave, scattered
 * dots and a symmetric medallion look the same whichever way they are cut,
 * and the panel does not ask.
 */
describe("a pattern direction", () => {
  it("is offered for stripes, checks, lattices and one-way prints, and nothing else", () => {
    const offered = (Object.keys(MOTIFS) as FabricMotif[]).filter((m) => MOTIFS[m].directional).sort();
    expect(offered).toEqual(["floral", "geometric", "herringbone", "plaid", "stripe"]);
  });

  it("comes from the motif for every sample fabric", () => {
    for (const f of fabrics) {
      if (f.source !== "procedural") continue;
      expect(fabricHasDirection(f), f.id).toBe(MOTIFS[f.motif].directional);
    }
    // the plain ones are never asked
    const plain = fabrics.filter((f) => f.source === "procedural" && f.motif === "solid");
    expect(plain.length).toBeGreaterThan(3);
    for (const f of plain) expect(fabricHasDirection(f), f.id).toBe(false);
  });

  it("is what a photographed fabric's record says, and none when it says nothing", () => {
    const photo = (directional?: boolean): Fabric => ({
      id: "fb-photo",
      name: { en: "Photo", ar: "صورة" },
      color: "#888888",
      material: "cotton",
      colorName: { en: "Grey", ar: "رمادي" },
      texture: "woven",
      categories: ["fashion"],
      source: "image",
      imageUrl: "/x.png",
      cmPerPixel: 0.02,
      ...(directional === undefined ? {} : { directional }),
    });
    expect(fabricHasDirection(photo())).toBe(false);
    expect(fabricHasDirection(photo(false))).toBe(false);
    expect(fabricHasDirection(photo(true))).toBe(true);
  });
});
