import { describe, expect, it } from "vitest";
import { garmentById } from "@/lib/data/garments";
import { effectiveCoverage, skirtOf } from "./outfit";
import { HEM_AT, SKIRT_LENGTHS, SKIRT_SHAPES, shapeLengths } from "./skirts";
import { skirtLengthsFor, skirtShapes, skirtShapesFor } from "@/lib/data/skirts";
import { DEFAULT_SKIRT as DRESS_DEFAULT, WAIST_Y, details, seamAt, skirtFor as dressSkirt } from "./art/female/dressCut";
import { DEFAULT_SKIRT as SKIRT_DEFAULT, cloth, skirtFor } from "./art/female/skirtCut";
import { BUST } from "./art/female/yoke";
import { draft } from "./fit";

/** A closed outline's leftmost x on a row. */
const leftAt = (path: string, y: number): number => {
  const n = (path.match(/-?[0-9]*[.]?[0-9]+/g) ?? []).map(Number);
  let left = Infinity;
  for (let i = 0; i + 3 < n.length; i += 2) {
    const [ax, ay, bx, by] = [n[i], n[i + 1], n[i + 2], n[i + 3]];
    if ((ay <= y && by > y) || (by <= y && ay > y)) left = Math.min(left, ax + ((y - ay) * (bx - ax)) / (by - ay));
  }
  return left;
};

describe("skirts", () => {
  it("draws each garment's skirt as its record says it arrives", () => {
    expect(garmentById("female-dress")!.skirt!.default).toEqual(DRESS_DEFAULT);
    expect(garmentById("female-skirt")!.skirt!.default).toEqual(SKIRT_DEFAULT);
  });

  it("resolves a skirt to what its garment offers", () => {
    expect(skirtOf({ garmentId: "female-dress", fabrics: {}, stitch: {} })).toEqual(DRESS_DEFAULT);
    expect(
      skirtOf({ garmentId: "female-dress", skirt: { shape: "flared", length: "maxi" }, fabrics: {}, stitch: {} })
    ).toEqual({ ...DRESS_DEFAULT, length: "maxi" });
    /* a skirt sits on its own band: it takes no waist */
    expect(
      skirtOf({ garmentId: "female-skirt", skirt: { shape: "flared", length: "knee", waist: "natural" }, fabrics: {}, stitch: {} })
    ).toEqual({ ...SKIRT_DEFAULT, length: "knee" });
    expect(skirtOf({ garmentId: "female-blouse", fabrics: {}, stitch: {} })).toBeUndefined();
  });

  it("ends every shape at every length it is cut at on its row, the same on both garments", () => {
    for (const shape of SKIRT_SHAPES) {
      for (const length of shapeLengths(shape, SKIRT_LENGTHS)) {
        expect(dressSkirt(undefined, { ...DRESS_DEFAULT, shape, length }).hemLeft[1], `${shape} ${length}`).toBe(HEM_AT[length]);
        expect(skirtFor(undefined, { ...SKIRT_DEFAULT, shape, length }).hemLeft[1], `${shape} ${length}`).toBe(HEM_AT[length]);
      }
    }
  });

  it("cuts each shape the same at every length: a shorter skirt is the longer one cut short", () => {
    /*
      Where the shortest length ends, the maxi is as wide, to a few
      millimetres: the side hangs taut from the hip to wherever its hem is, so
      a longer skirt's side runs a hair inside a shorter one's corner.
    */
    for (const shape of SKIRT_SHAPES) {
      const [shortest] = shapeLengths(shape, SKIRT_LENGTHS);
      const short = dressSkirt(undefined, { ...DRESS_DEFAULT, shape, length: shortest }).hemLeft;
      const maxi = dressSkirt(undefined, { ...DRESS_DEFAULT, shape, length: "maxi" }).path;
      expect(Math.abs(leftAt(maxi, short[1] - 0.01) - short[0]), shape).toBeLessThan(2);
    }
  });

  it("offers a mermaid at midi and maxi only, and cuts one asked for at the knee at midi", () => {
    const dress = garmentById("female-dress")!;
    expect(skirtLengthsFor(dress, "mermaid").map((l) => l.id)).toEqual(["midi", "maxi"]);
    expect(skirtLengthsFor(dress, "pencil").map((l) => l.id)).toEqual(["knee", "midi", "maxi"]);
    expect(skirtLengthsFor(dress).map((l) => l.id)).toEqual(["knee", "midi", "maxi"]);
    expect(
      skirtOf({ garmentId: "female-dress", skirt: { shape: "mermaid", length: "knee", waist: "empire" }, fabrics: {}, stitch: {} })
    ).toEqual({ shape: "mermaid", length: "midi", waist: "empire" });
    expect(skirtOf({ garmentId: "female-skirt", skirt: { shape: "mermaid", length: "knee" }, fabrics: {}, stitch: {} })).toEqual({
      shape: "mermaid",
      length: "midi",
    });
    /* and back to a shape cut at the knee, the knee it was asked for */
    expect(skirtOf({ garmentId: "female-skirt", skirt: { shape: "pencil", length: "knee" }, fabrics: {}, stitch: {} })!.length).toBe("knee");
  });

  it("hangs a pencil from the hip, leaning in, and never closer to her than its ease", () => {
    const d = draft("female");
    const pencil = (length: "knee" | "midi" | "maxi") => dressSkirt(undefined, { ...DRESS_DEFAULT, shape: "pencil", length }).path;
    const her = (y: number) => (y < d.crotchY ? d.sideAt(y, 0) : d.legOutAt(y, 0));
    for (const length of ["knee", "midi", "maxi"] as const) {
      const hem = HEM_AT[length];
      /* narrower at the hem than at the hip: it leans in, never out */
      expect(leftAt(pencil(length), hem - 1), length).toBeGreaterThan(leftAt(pencil(length), d.hipY) + 8);
      for (let y = d.hipY; y < hem; y += 10) {
        expect(her(y) - leftAt(pencil(length), y), `${length} y ${y}`).toBeGreaterThan(3.5);
      }
    }
    /* and far narrower than a flared skirt at its hem */
    expect(leftAt(pencil("midi"), 750)).toBeGreaterThan(leftAt(dressSkirt(undefined, DRESS_DEFAULT).path, 750) + 50);
  });

  it("fits a mermaid to her down to the knee, and flares it below", () => {
    const d = draft("female");
    const mermaid = dressSkirt(undefined, { ...DRESS_DEFAULT, shape: "mermaid", length: "maxi" }).path;
    /* close to her thighs: within its ease and the cloth's bridge of her outer leg */
    for (let y = d.crotchY + 10; y <= 650; y += 20) {
      expect(d.legOutAt(y, 0) - leftAt(mermaid, y), `y ${y}`).toBeLessThan(8);
    }
    /* narrowest by her knee, and widest at the hem — wider each step down */
    const at = (y: number) => 300 - leftAt(mermaid, y);
    expect(at(650)).toBeLessThan(at(d.hipY));
    for (let y = 660; y + 30 < 890; y += 30) expect(at(y + 30), `y ${y + 30}`).toBeGreaterThan(at(y));
    expect(at(885) - at(650)).toBeGreaterThan(50);
  });

  it("offers the shapes by name, fullest first, on the dress and the skirt alike", () => {
    for (const id of ["female-dress", "female-skirt"]) {
      expect(skirtShapesFor(garmentById(id)!).map((s) => s.id), id).toEqual(["flared", "pencil", "mermaid"]);
    }
    expect(skirtShapes.map((s) => s.name.ar)).toEqual(["كلوش", "قلم", "سمكة"]);
  });

  it("hides more of the leg the longer it is", () => {
    const zones = (length: "knee" | "midi" | "maxi") =>
      effectiveCoverage(garmentById("female-dress")!, { garmentId: "female-dress", skirt: { ...DRESS_DEFAULT, length }, fabrics: {}, stitch: {} });
    /* the dress as it arrives hides exactly what it always has: its short sleeve leaves the upper arm */
    expect(zones("midi")).toEqual(["shoulderCap", "torso", "hip", "thigh"]);
    expect(zones("maxi")).toEqual(expect.arrayContaining(["thigh", "knee", "calf"]));
    expect(zones("knee")).not.toContain("calf");
  });

  it("sews a dropped waist's skirt on at its seam, 13 cm below her own", () => {
    expect(seamAt("dropped")).toBe(WAIST_Y + 70);
    /* the skirt starts under the bodice's hem, as at her own waist */
    expect(dressSkirt(undefined, { ...DRESS_DEFAULT, waist: "dropped" }).waistY).toBe(seamAt("dropped") - 8);
    expect(dressSkirt(undefined, DRESS_DEFAULT).waistY).toBe(WAIST_Y - 8);
  });

  it("sews an empire waist's skirt on under the bust, and hangs it past her waist to the hip", () => {
    expect(seamAt("empire")).toBe(WAIST_Y - 50);
    expect(seamAt("empire")).toBeGreaterThan(BUST.creaseY);
    const empire = dressSkirt(undefined, { ...DRESS_DEFAULT, waist: "empire" });
    const natural = dressSkirt(undefined, DRESS_DEFAULT);
    expect(empire.waistY).toBe(seamAt("empire") - 8);
    /* clear of her waist, where a skirt sewn there is on it */
    expect(leftAt(empire.path, WAIST_Y)).toBeLessThan(leftAt(natural.path, WAIST_Y) - 10);
    /* never back in toward it, from the seam down to the hip */
    const { hipY } = draft("female");
    for (let y = seamAt("empire") + 6; y <= hipY; y += 6) {
      expect(leftAt(empire.path, y), `y ${y}`).toBeLessThanOrEqual(leftAt(empire.path, y - 6) + 0.1);
    }
    /* and on the hip, as the skirt sewn at her waist is, and the same below it */
    for (const y of [hipY, 600, 750]) expect(Math.abs(leftAt(empire.path, y) - leftAt(natural.path, y)), `y ${y}`).toBeLessThan(0.5);
  });

  it("moves the bodice's details with its waist", () => {
    for (const waist of ["empire", "natural", "dropped"] as const) {
      const seam = seamAt(waist);
      expect(details("wrap", waist).tie![1], waist).toBe(seam);
      const buttons = details("collared", waist).buttons!;
      expect(Math.max(...buttons.at.map(([, y]) => y)) + buttons.r, waist).toBeLessThan(seam);
      expect(details("sweetheart", waist).seams.length, waist).toBe(2);
    }
    /* the buttons run down the bodice to its seam: up under the bust, or on down a dropped one */
    const low = (waist: "empire" | "natural" | "dropped") => Math.max(...details("collared", waist).buttons!.at.map(([, y]) => y));
    expect(low("dropped")).toBeGreaterThan(low("natural") + 60);
    expect(low("empire")).toBeLessThan(low("natural") - 40);
  });

  it("draws the skirt's band, except under a jacket, which hides it", () => {
    expect(cloth()).toHaveLength(2);
    expect(cloth({ inside: { y: 513, x: 190 } })).toHaveLength(1);
  });
});
