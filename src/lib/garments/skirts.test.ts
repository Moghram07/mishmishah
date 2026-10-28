import { describe, expect, it } from "vitest";
import { garmentById } from "@/lib/data/garments";
import { skirtOf } from "./outfit";
import { DEFAULT_SKIRT as DRESS_DEFAULT } from "./art/female/dressCut";
import { DEFAULT_SKIRT as SKIRT_DEFAULT, cloth } from "./art/female/skirtCut";

describe("skirts", () => {
  it("draws each garment's skirt as its record says it arrives", () => {
    expect(garmentById("female-dress")!.skirt!.default).toEqual(DRESS_DEFAULT);
    expect(garmentById("female-skirt")!.skirt!.default).toEqual(SKIRT_DEFAULT);
  });

  it("resolves a skirt to what its garment offers", () => {
    expect(skirtOf({ garmentId: "female-dress", fabrics: {}, stitch: {} })).toEqual(DRESS_DEFAULT);
    /* a length the dress is not cut in falls back to its own */
    expect(
      skirtOf({ garmentId: "female-dress", skirt: { shape: "flared", length: "knee" }, fabrics: {}, stitch: {} })
    ).toEqual(DRESS_DEFAULT);
    /* a skirt sits on its own band: it takes no waist */
    expect(
      skirtOf({ garmentId: "female-skirt", skirt: { shape: "flared", length: "knee", waist: "natural" }, fabrics: {}, stitch: {} })
    ).toEqual(SKIRT_DEFAULT);
    expect(skirtOf({ garmentId: "female-blouse", fabrics: {}, stitch: {} })).toBeUndefined();
  });

  it("draws the skirt's band, except under a jacket, which hides it", () => {
    expect(cloth()).toHaveLength(2);
    expect(cloth({ inside: { y: 513, x: 190 } })).toHaveLength(1);
  });
});
