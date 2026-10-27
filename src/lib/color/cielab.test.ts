import { describe, expect, it } from "vitest";
import { ciede2000, hexToLab, ita, itaClass, labToHex, labToRgb, rgbToLab } from "./cielab";

describe("CIEDE2000", () => {
  // Sharma, Wu & Dalal (2005), "The CIEDE2000 color-difference formula:
  // implementation notes, supplementary test data, and mathematical
  // observations", Color Res. Appl. 30(1):21–30 — pairs 1, 7, 17 and 25.
  it.each([
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 0, 0], [50, -1, 2], 2.3669],
    [[50, 2.5, 0], [73, 25, -18], 27.1492],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
  ] as const)("matches the published test pair %#", (a, b, expected) => {
    expect(ciede2000(a, b)).toBeCloseTo(expected, 4);
    expect(ciede2000(b, a)).toBeCloseTo(expected, 4);
  });
});

describe("CIELAB and sRGB", () => {
  it("round-trips a skin colour", () => {
    const lab = [57.4, 12.0, 20.5] as const;
    const back = rgbToLab(labToRgb(lab));
    for (let i = 0; i < 3; i++) expect(back[i]).toBeCloseTo(lab[i], 1);
    expect(hexToLab(labToHex(lab))[0]).toBeCloseTo(57.4, 0);
  });

  it("puts white and black at the ends of L*", () => {
    expect(hexToLab("#ffffff")[0]).toBeCloseTo(100, 2);
    expect(hexToLab("#000000")[0]).toBeCloseTo(0, 2);
  });
});

describe("the Individual Typology Angle", () => {
  it("is atan((L* − 50) / b*) in degrees, and classes by it", () => {
    expect(ita([70, 10, 14])).toBeCloseTo((Math.atan(20 / 14) * 180) / Math.PI, 10);
    expect(itaClass([72, 10, 12])).toBe("very light");
    expect(itaClass([65, 10, 15])).toBe("light");
    expect(itaClass([60, 10, 16])).toBe("intermediate");
    expect(itaClass([55, 10, 18])).toBe("tan");
    expect(itaClass([45, 10, 17])).toBe("brown");
    expect(itaClass([35, 10, 14])).toBe("dark");
  });
});
