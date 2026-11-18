import { describe, expect, it } from "vitest";
import { fabrics } from "@/lib/data/fabrics";
import { COLOR_FAMILIES, PATTERN_FAMILIES, filterChoices, filterFabrics, hasPrint, isFiltered, patternOf, swatchOrder } from "./filters";
import { MOTIFS } from "./patterns";
import type { FabricMotif } from "@/types";

describe("the fabric filters", () => {
  it("find a fabric by its colour family, its type and its pattern family", () => {
    expect(filterFabrics(fabrics, {})).toHaveLength(fabrics.length);
    const navy = filterFabrics(fabrics, { color: "navy" });
    expect(navy.length).toBeGreaterThan(3);
    for (const f of navy) expect(f.colorFamily, f.id).toBe("navy");
    // the plain linens: the apricot and the four with their slubs
    expect(filterFabrics(fabrics, { material: "linen", pattern: "solid" }).map((f) => f.id).sort()).toEqual(
      ["fb-apricot-linen", "fb-mustard-linen", "fb-natural-linen", "fb-olive-linen", "fb-sky-linen"].sort()
    );
    // all three at once
    expect(filterFabrics(fabrics, { color: "red", material: "cotton", pattern: "plaid" }).map((f) => f.id)).toEqual(["fb-red-gingham"]);
    expect(isFiltered({})).toBe(false);
    expect(isFiltered({ pattern: "dots" })).toBe(true);
  });

  it("call a plain cloth plain whatever its surface, and a pattern by its family, small or large", () => {
    const plain: FabricMotif[] = ["solid", "slub"];
    for (const f of fabrics) {
      if (f.source !== "procedural") continue;
      expect(PATTERN_FAMILIES, f.id).toContain(patternOf(f));
      expect(patternOf(f) === "solid", f.id).toBe(plain.includes(f.motif));
    }
    // every motif has a family
    for (const m of Object.keys(MOTIFS) as FabricMotif[]) {
      const one = fabrics.find((f) => f.source === "procedural" && f.motif === m);
      if (one) expect(patternOf(one), m).toBeDefined();
    }
  });

  it("offer only what the library has, each counted against the other two — a choice that would leave nothing is offered at 0", () => {
    const all = filterChoices(fabrics, {});
    expect(all.colors.map((c) => c.id)).toEqual(COLOR_FAMILIES.map((c) => c.id));
    for (const c of all.colors) expect(c.count, c.id).toBe(fabrics.filter((f) => f.colorFamily === c.id).length);
    // with a colour chosen, the types and patterns count only that colour's
    const navy = filterChoices(fabrics, { color: "navy" });
    for (const m of navy.materials) expect(m.count, m.id).toBe(fabrics.filter((f) => f.colorFamily === "navy" && f.material === m.id).length);
    expect(navy.materials.some((m) => m.count === 0)).toBe(true);
    // its own row is not narrowed by itself: every colour still offered, counted against the others (none)
    expect(navy.colors).toEqual(all.colors);
    // and choosing only what is offered at more than 0 never empties the grid
    for (const m of navy.materials.filter((m) => m.count > 0)) expect(filterFabrics(fabrics, { color: "navy", material: m.id }).length).toBe(m.count);
  });

  it("ask for a close-up only of a print: never of a plain cloth's surface, which no zoom shows more of", () => {
    for (const f of fabrics) {
      if (f.source !== "procedural") continue;
      const plain = ["solid", "slub"].includes(f.motif);
      expect(hasPrint(f), f.id).toBe(!plain);
    }
    // the denims, the crepes, the knit, the wools, the satins: no print (a surface is not one — see zoomHint)
    for (const id of ["fb-denim-classic", "fb-indigo-denim", "fb-burgundy-crepe", "fb-black-nida", "fb-grey-jersey", "fb-winter-grey", "fb-apricot-linen", "fb-ivory-satin"]) {
      expect(hasPrint(fabrics.find((f) => f.id === id)!), id).toBe(false);
    }
    // a print, small or large: the hint, when it is too small to read
    for (const id of ["fb-navy-pinstripe", "fb-grey-herringbone", "fb-houndstooth", "fb-red-gingham", "fb-cream-dots"]) {
      expect(hasPrint(fabrics.find((f) => f.id === id)!), id).toBe(true);
    }
  });

  it("lay the swatches out as a swatch book: by colour family, plain before patterned", () => {
    const ordered = swatchOrder(fabrics);
    expect(ordered).toHaveLength(fabrics.length);
    const rank = (id: string) => COLOR_FAMILIES.findIndex((c) => c.id === id);
    for (let i = 1; i < ordered.length; i++) {
      const [a, b] = [ordered[i - 1], ordered[i]];
      expect(rank(a.colorFamily), `${a.id} before ${b.id}`).toBeLessThanOrEqual(rank(b.colorFamily));
      if (a.colorFamily === b.colorFamily && patternOf(b) === "solid") expect(patternOf(a), `${a.id} before ${b.id}`).toBe("solid");
    }
    expect(ordered[0].colorFamily).toBe("white");
  });
});
