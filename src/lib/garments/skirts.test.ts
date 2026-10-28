import { describe, expect, it } from "vitest";
import { garmentById } from "@/lib/data/garments";
import { effectiveCoverage, skirtOf } from "./outfit";
import { HEM_AT, SKIRT_LENGTHS } from "./skirts";
import { DEFAULT_SKIRT as DRESS_DEFAULT, WAIST_Y, details, seamAt, skirtFor as dressSkirt } from "./art/female/dressCut";
import { DEFAULT_SKIRT as SKIRT_DEFAULT, cloth, skirtFor } from "./art/female/skirtCut";

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

  it("ends every length on its row, the same on both garments", () => {
    for (const length of SKIRT_LENGTHS) {
      expect(dressSkirt(undefined, { ...DRESS_DEFAULT, length }).hemLeft[1], length).toBe(HEM_AT[length]);
      expect(skirtFor(undefined, { ...SKIRT_DEFAULT, length }).hemLeft[1], length).toBe(HEM_AT[length]);
    }
  });

  it("cuts one shape at every length: a shorter skirt is the longer one cut short", () => {
    /*
      Where the knee length ends, the maxi is as wide, to a few millimetres:
      the side hangs taut from the hip to wherever its hem is, so a longer
      skirt's side runs a hair inside a shorter one's corner.
    */
    const knee = dressSkirt(undefined, { ...DRESS_DEFAULT, length: "knee" }).hemLeft;
    const maxi = dressSkirt(undefined, { ...DRESS_DEFAULT, length: "maxi" }).path;
    const xs = (maxi.match(/-?[0-9]*[.]?[0-9]+/g) ?? []).map(Number);
    let at = Infinity;
    for (let i = 0; i + 3 < xs.length; i += 2) {
      const [ax, ay, bx, by] = [xs[i], xs[i + 1], xs[i + 2], xs[i + 3]];
      if (ay <= knee[1] && by > knee[1]) at = Math.min(at, ax + ((knee[1] - ay) * (bx - ax)) / (by - ay));
    }
    expect(Math.abs(at - knee[0])).toBeLessThan(2);
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

  it("moves the bodice's details down with a dropped waist", () => {
    for (const waist of ["natural", "dropped"] as const) {
      const seam = seamAt(waist);
      expect(details("wrap", waist).tie![1], waist).toBe(seam);
      const buttons = details("collared", waist).buttons!;
      expect(Math.max(...buttons.at.map(([, y]) => y)) + buttons.r, waist).toBeLessThan(seam);
      expect(details("sweetheart", waist).seams.length, waist).toBe(2);
    }
    /* the dropped waist's buttons run on down the longer bodice */
    const low = (waist: "natural" | "dropped") => Math.max(...details("collared", waist).buttons!.at.map(([, y]) => y));
    expect(low("dropped")).toBeGreaterThan(low("natural") + 60);
  });

  it("draws the skirt's band, except under a jacket, which hides it", () => {
    expect(cloth()).toHaveLength(2);
    expect(cloth({ inside: { y: 513, x: 190 } })).toHaveLength(1);
  });
});
