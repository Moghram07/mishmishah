import { describe, expect, it } from "vitest";
import { fabrics } from "@/lib/data/fabrics";
import { MOTIFS, fabricHasDirection, fabricSurface } from "./patterns";
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
    expect(offered).toEqual([
      "floral",
      "floralLarge",
      "geometric",
      "gingham",
      "herringbone",
      "houndstooth",
      "paisley",
      "pinstripe",
      "plaid",
      "stripe",
      "tartan",
      "wideStripe",
      // and a linen's slubs, which run across the cloth
      "slub",
    ].sort());
    // a weave the same every way round is not asked: a plain weave, dots, a medallion
    for (const m of ["solid", "dots", "dotsLarge", "damask"] as const) expect(MOTIFS[m].directional, m).toBe(false);
  });

  it("is offered for a plain cloth whose surface runs one way, or whose sheen is drawn out along the grain", () => {
    for (const f of fabrics) {
      if (f.source !== "procedural") continue;
      const own = MOTIFS[f.motif].directional;
      const surface = Boolean(fabricSurface(f)?.directional);
      expect(fabricHasDirection(f), f.id).toBe(own || surface || Boolean(f.sheen));
    }
    // a denim's streaks, a knit's columns and a wool's flecks run down the warp; a satin's shine is drawn out along it
    for (const id of ["fb-denim-classic", "fb-indigo-denim", "fb-grey-jersey", "fb-winter-grey", "fb-ivory-satin", "fb-soft-sheen-black"]) {
      expect(fabricHasDirection(fabrics.find((f) => f.id === id)!), id).toBe(true);
    }
    // a crepe, a nida, a cotton: nothing that shows which way it is cut
    for (const id of ["fb-black-crepe", "fb-burgundy-crepe", "fb-black-nida", "fb-white", "fb-cream"]) {
      expect(fabricHasDirection(fabrics.find((f) => f.id === id)!), id).toBe(false);
    }
  });

  it("comes from the motif for every sample fabric with no surface and no sheen", () => {
    for (const f of fabrics) {
      if (f.source !== "procedural" || fabricSurface(f) || f.sheen) continue;
      expect(fabricHasDirection(f), f.id).toBe(MOTIFS[f.motif].directional);
    }
    // the plain ones are never asked — plain all through: no surface, no sheen
    const plain = fabrics.filter((f) => f.source === "procedural" && f.motif === "solid" && !fabricSurface(f) && !f.sheen);
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
      colorFamily: "grey",
      texture: "woven",
      categories: ["fashion"],
      suits: [],
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
