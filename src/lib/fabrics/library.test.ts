import { describe, expect, it } from "vitest";
import { fabricById, fabrics, offeredFabrics } from "@/lib/data/fabrics";
import { garmentById } from "@/lib/data/garments";
import { COLOR_FAMILIES, MATERIALS, patternOf } from "./filters";
import { MOTIFS, SURFACES, fabricRepeatCm, fabricSurface } from "./patterns";
import type { ColorFamily, Fabric, FabricMotif } from "@/types";

/**
 * The sample library, as the beta asked for it (2026-11-17): about sixty
 * fabrics, drawn in code at a true repeat each; plain colours from the
 * neutrals to the brights and pastels; every type's surface and every
 * pattern; the thobe's whites and winter colours and the abaya's blacks.
 * Each a named sample — no shop, no price.
 */
const motifOf = (f: Fabric) => (f.source === "procedural" ? f.motif : undefined);
const withMotif = (m: FabricMotif) => fabrics.filter((f) => motifOf(f) === m);

describe("the sample library", () => {
  it("is about sixty fabrics, and the seven satins (2026-11-18), each its own", () => {
    expect(fabrics.length).toBe(68);
    expect(new Set(fabrics.map((f) => f.id)).size).toBe(fabrics.length);
    expect(new Set(fabrics.map((f) => f.name.en)).size, "English names").toBe(fabrics.length);
    expect(new Set(fabrics.map((f) => f.name.ar)).size, "Arabic names").toBe(fabrics.length);
  });

  it("names every fabric in Arabic and English, its type, colour family and the garments it suits — a sample, no shop or price", () => {
    const fields = new Set(["id", "name", "source", "motif", "palette", "color", "material", "colorName", "colorFamily", "texture", "categories", "suits", "hidden", "sheen"]);
    for (const f of fabrics) {
      expect(f.name.en.trim(), f.id).not.toBe("");
      expect(f.name.ar, f.id).toMatch(/[؀-ۿ]/);
      expect(MATERIALS, f.id).toContain(f.material);
      expect(COLOR_FAMILIES.map((c) => c.id), f.id).toContain(f.colorFamily);
      expect(f.suits.length, f.id).toBeGreaterThan(0);
      for (const g of f.suits) expect(garmentById(g), `${f.id} suits ${g}`).toBeDefined();
      expect(new Set(f.suits).size, f.id).toBe(f.suits.length);
      // drawn in code, nothing found online; nothing a shop would add: no price, stock, store or rating
      expect(f.source, f.id).toBe("procedural");
      for (const key of Object.keys(f)) expect(fields, `${f.id}.${key}`).toContain(key);
      // a true repeat, from its motif
      expect(fabricRepeatCm(f), f.id).toBeGreaterThan(0);
      expect(fabricRepeatCm(f), f.id).toBe(MOTIFS[motifOf(f)!].repeatCm);
    }
  });

  it("has plain colours from the neutrals and earth tones to the brights and pastels", () => {
    const plain = fabrics.filter((f) => patternOf(f) === "solid");
    expect(plain.length).toBeGreaterThanOrEqual(24);
    const families = new Set(plain.map((f) => f.colorFamily));
    for (const family of COLOR_FAMILIES.map((c) => c.id)) expect(families, family).toContain(family);
    // the earth tones by name: camel, brown, olive
    for (const id of ["fb-camel", "fb-chocolate", "fb-olive-linen"]) expect(plain.map((f) => f.id)).toContain(id);
  });

  it("has every type's surface: cotton, linen with slubs, crepe, denim's streaks, a knit's columns, wool's flecks, satin's sheen", () => {
    expect(withMotif("solid").filter((f) => f.material === "cotton").length, "plain cotton").toBeGreaterThan(0);
    expect(withMotif("slub").filter((f) => f.material === "linen").length, "linen with slubs").toBeGreaterThan(0);
    for (const material of ["crepe", "denim", "wool", "jersey", "satin"] as const) {
      expect(fabrics.filter((f) => f.material === material).length, material).toBeGreaterThan(0);
    }
    // every denim, knit and wool, old and new, in its material's surface — over a plain cloth or a print alike
    for (const f of fabrics) {
      const own = SURFACES[f.material];
      expect(fabricSurface(f), f.id).toBe(own);
      if (["denim", "jersey", "wool"].includes(f.material)) expect(own, f.id).toBeDefined();
    }
    // a crepe's pebbles and a nida's grain are finer than any screen shows: no surface, drawn plain
    for (const f of fabrics.filter((x) => x.material === "crepe" || x.material === "nida")) {
      expect([fabricSurface(f), motifOf(f)], f.id).toEqual([undefined, "solid"]);
    }
    // the silks and the satins shine; nothing else does — see sheen.test
    expect(fabrics.filter((f) => f.sheen).map((f) => [f.id, f.sheen])).toEqual([
      ["fb-rose-silk", "medium"],
      ["fb-midnight-floral", "medium"],
      ["fb-ivory-damask", "medium"],
      ["fb-ivory-satin", "bright"],
      ["fb-champagne-satin", "bright"],
      ["fb-emerald-satin", "bright"],
      ["fb-burgundy-satin", "bright"],
      ["fb-navy-satin", "bright"],
      ["fb-black-satin", "bright"],
      ["fb-black-crepe-satin", "soft"],
    ]);
    // no sheer cloth among the new ones (the blush chiffon is from before)
    expect(fabrics.filter((f) => f.texture === "sheer").map((f) => f.id)).toEqual(["fb-blush-chiffon"]);
  });

  it("has every pattern, small and large, at its true size", () => {
    const patterns: FabricMotif[] = ["pinstripe", "wideStripe", "gingham", "tartan", "houndstooth", "herringbone", "dots", "dotsLarge", "floral", "floralLarge", "paisley", "geometric"];
    for (const m of patterns) expect(withMotif(m).length, m).toBeGreaterThan(0);
    // small and large are sizes, not names
    expect(MOTIFS.dotsLarge.repeatCm).toBeGreaterThan(MOTIFS.dots.repeatCm);
    expect(MOTIFS.floralLarge.repeatCm).toBeGreaterThan(MOTIFS.floral.repeatCm);
    expect(MOTIFS.wideStripe.repeatCm).toBeGreaterThan(MOTIFS.pinstripe.repeatCm);
  });

  it("has the thobe's whites and winter colours, and the abaya's blacks", () => {
    const thobe = fabrics.filter((f) => f.suits.includes("male-thobe"));
    expect(thobe.filter((f) => f.colorFamily === "white" && patternOf(f) === "solid").length).toBeGreaterThanOrEqual(3);
    for (const family of ["grey", "navy", "brown", "green"] as ColorFamily[]) {
      expect(thobe.some((f) => f.colorFamily === family && f.material === "wool"), `a winter thobe in ${family}`).toBe(true);
    }
    const abaya = fabrics.filter((f) => f.suits.includes("female-abaya"));
    for (const material of ["crepe", "nida"]) {
      expect(abaya.some((f) => f.colorFamily === "black" && f.material === material), `an abaya black in ${material}`).toBe(true);
    }
    // and the black with a soft sheen
    expect(abaya.some((f) => f.colorFamily === "black" && f.sheen === "soft"), "an abaya black with a soft sheen").toBe(true);
  });

  it("keeps the sheer chiffon but does not offer it, until sheer cloth can be drawn", () => {
    const chiffon = fabricById("fb-blush-chiffon")!;
    expect([chiffon.hidden, chiffon.texture]).toEqual([true, "sheer"]);
    expect(offeredFabrics.map((f) => f.id)).not.toContain("fb-blush-chiffon");
    // nothing else is held back
    expect(offeredFabrics.length).toBe(fabrics.length - 1);
    expect(fabrics.filter((f) => f.hidden).map((f) => f.id)).toEqual(["fb-blush-chiffon"]);
  });

  it("draws every linen and every denim alike: the linen's slubs, the denim's streaks", () => {
    for (const f of fabrics) {
      if (f.material === "linen") expect(motifOf(f), f.id).toBe("slub");
      if (f.material === "denim") expect([motifOf(f), fabricSurface(f)], f.id).toEqual(["solid", SURFACES.denim]);
    }
    expect(fabrics.filter((f) => f.material === "linen").length).toBe(5);
    expect(fabrics.filter((f) => f.material === "denim").length).toBe(3);
  });

  it("keeps the first eighteen samples, first in the library", () => {
    expect(fabrics.slice(0, 18).map((f) => f.id)).toEqual([
      "fb-apricot-linen", "fb-saffron-stripe", "fb-rose-silk", "fb-indigo-plaid", "fb-emerald-velvet", "fb-terracotta-herring",
      "fb-cream-dots", "fb-midnight-floral", "fb-desert-geo", "fb-denim-classic", "fb-blush-chiffon", "fb-forest-plaid",
      "fb-ivory-damask", "fb-black-crepe", "fb-white", "fb-off-white", "fb-red", "fb-navy",
    ]);
  });
});
