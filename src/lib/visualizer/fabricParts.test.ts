import { describe, expect, it } from "vitest";
import { garmentById, garmentsFor } from "@/lib/data/garments";
import { LOOKS } from "@/lib/data/looks";
import { collarsForGarment } from "@/lib/data/collars";
import { clothOf, cutFrom, regionsOf, setBelt } from "@/lib/garments/outfit";
import { offersWhole, wearWhole, WHOLE_NAMES } from "./fabricParts";

describe("the fabrics panel: the whole of a garment in one pick", () => {
  it("cuts its own parts and every part in the same cloth, and leaves a part in a cloth of its own", () => {
    // the sailor dress: navy top, bottom and collar; white stripes; a red scarf
    const sailor = LOOKS.find((l) => l.id === "sailor")!.worn()[0];
    const dress = garmentById("female-dress")!;
    expect(offersWhole(dress, sailor)).toBe(true);
    const after = wearWhole(sailor, dress, "fb-emerald-satin");
    for (const region of ["top", "bottom", "collar"] as const) expect(clothOf(after, region), region).toBe("fb-emerald-satin");
    expect(clothOf(after, "trim")).toBe("fb-white");
    expect(clothOf(after, "tie")).toBe("fb-red");
    // a belt with no cloth of its own follows the dress, as it always has; a self belt cut from it goes with it
    const belted = setBelt([cutFrom(dress, "fb-navy")], dress.id, "self")[0];
    expect(clothOf(wearWhole(belted, dress, "fb-red"), "belt")).toBe("fb-red");
    // the top and bottom go together even when they had been cut apart
    const split = { ...cutFrom(dress, "fb-navy"), fabrics: { top: "fb-navy", bottom: "fb-cream" } };
    const whole = wearWhole(split, dress, "fb-mint");
    expect([clothOf(whole, "top"), clothOf(whole, "bottom")]).toEqual(["fb-mint", "fb-mint"]);
    // and nothing else about the garment changes
    expect({ ...after, fabrics: {} }).toEqual({ ...sailor, fabrics: {} });
  });

  it("has a name for the whole of every garment that can be worn in more than one part, in Arabic and English", () => {
    for (const body of ["female", "male"] as const) {
      for (const g of garmentsFor(body)) {
        const parts = g.fabricRegions.length > 1 || collarsForGarment(g).length > 0;
        if (!parts) continue;
        const name = WHOLE_NAMES[g.id];
        expect(name, g.id).toBeDefined();
        // «… كله» or «… كلها»: the whole, agreeing with the garment
        expect(name.ar, g.id).toMatch(/ كله$| كلها$/);
        expect(name.en, g.id).toMatch(/^Whole /);
      }
    }
    // a garment of one part has no such chip: nothing to pick together
    const skirt = garmentById("female-skirt")!;
    expect(regionsOf(skirt, cutFrom(skirt, "fb-navy"))).toHaveLength(1);
    expect(offersWhole(skirt, cutFrom(skirt, "fb-navy"))).toBe(false);
  });
});
