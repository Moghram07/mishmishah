import { describe, expect, it } from "vitest";
import {
  ITA_CLASSES,
  chroma,
  ciede2000,
  hexToLab,
  hue,
  ita,
  itaClass,
  labToHex,
} from "@/lib/color/cielab";
import { DEFAULT_SKIN_TONE, skinToneById, skinTones } from "./skinTones";
import { MEASURED_RANGE, MEASURED_SKIN } from "./skinMeasurements";

/**
 * The ten tones are real skin, measured — and distinct, and warm.
 *
 * Every limit here comes from the published measurements in
 * `skinMeasurements.ts` (Lu et al. 2026, Table 2), not from taste: a tone
 * that leaves the range of real skin fails, and so does a pair of neighbours
 * too close to tell apart.
 */

const labs = skinTones.map((t) => t.lab);
const label = (i: number) => `${skinTones[i].id} ${labs[i].map((v) => v.toFixed(1)).join(" ")}`;

describe("the data the tones come from", () => {
  it("is the published table", () => {
    expect(MEASURED_SKIN).toHaveLength(8);
    expect(MEASURED_SKIN.reduce((n, g) => n + g.subjects, 0)).toBe(2106);
    const african = MEASURED_SKIN.find((g) => g.group === "African")!;
    expect([african.L, african.b]).toEqual([[39.6, 6.7], [14.4, 4.3]]);
  });

  it("describes skin as warm, and as light and dark as people are", () => {
    expect(MEASURED_RANGE.a[0]).toBeGreaterThan(0);
    expect(MEASURED_RANGE.b[0]).toBeGreaterThan(0);
    expect(MEASURED_RANGE.L[0]).toBeGreaterThan(20);
    expect(MEASURED_RANGE.L[1]).toBeLessThan(80);
  });
});

describe("ten skin tones", () => {
  it("is ten, named Tone 1–10 and درجة 1–10", () => {
    expect(skinTones).toHaveLength(10);
    skinTones.forEach((t, i) => {
      expect(t.id).toBe(`tone-${String(i + 1).padStart(2, "0")}`);
      expect(t.label).toEqual({ en: `Tone ${i + 1}`, ar: `درجة ${i + 1}` });
    });
  });

  it("stays inside the range of real measured skin", () => {
    const { L, a, b, C, hue: h } = MEASURED_RANGE;
    labs.forEach((lab, i) => {
      expect(lab[0], label(i)).toBeGreaterThanOrEqual(L[0]);
      expect(lab[0], label(i)).toBeLessThanOrEqual(L[1]);
      expect(lab[1], label(i)).toBeGreaterThanOrEqual(a[0]);
      expect(lab[1], label(i)).toBeLessThanOrEqual(a[1]);
      expect(lab[2], label(i)).toBeGreaterThanOrEqual(b[0]);
      expect(lab[2], label(i)).toBeLessThanOrEqual(b[1]);
      expect(chroma(lab), label(i)).toBeGreaterThanOrEqual(C[0]);
      expect(chroma(lab), label(i)).toBeLessThanOrEqual(C[1]);
      expect(hue(lab), label(i)).toBeGreaterThanOrEqual(h[0]);
      expect(hue(lab), label(i)).toBeLessThanOrEqual(h[1]);
    });
  });

  it("is warm: red and yellow, never grey", () => {
    labs.forEach((lab, i) => {
      expect(lab[1], label(i)).toBeGreaterThan(5);
      expect(lab[2], label(i)).toBeGreaterThan(5);
      expect(chroma(lab), label(i)).toBeGreaterThan(12);
    });
  });

  it("covers every Individual Typology Angle class, lightest first", () => {
    expect(new Set(labs.map(itaClass))).toEqual(new Set(ITA_CLASSES.map((c) => c.name)));
    for (let i = 1; i < labs.length; i++) {
      expect(ita(labs[i]), label(i)).toBeLessThan(ita(labs[i - 1]));
    }
  });

  it("steps evenly in lightness", () => {
    const steps = labs.slice(1).map((lab, i) => labs[i][0] - lab[0]);
    for (const step of steps) expect(step).toBeCloseTo(steps[0], 9);
    expect(steps[0]).toBeGreaterThan(0);
  });

  it("never puts two neighbours closer than 4 in CIEDE2000", () => {
    for (let i = 1; i < labs.length; i++) {
      expect(ciede2000(labs[i - 1], labs[i]), `${label(i - 1)} → ${label(i)}`).toBeGreaterThanOrEqual(4);
    }
  });

  it("shows the measured colour itself, inside the screen's gamut", () => {
    skinTones.forEach((t, i) => {
      expect(t.color).toBe(labToHex(t.lab));
      // no channel clipped: the swatch reads back as the colour it stands for
      const back = hexToLab(t.color);
      expect(ciede2000(back, t.lab), label(i)).toBeLessThan(0.6);
    });
  });

  it("starts from a tone on the scale, and reads an old id as that tone", () => {
    expect(skinTones.map((t) => t.id)).toContain(DEFAULT_SKIN_TONE);
    for (const old of ["iii", "monk-05"]) expect(skinToneById(old).id).toBe(DEFAULT_SKIN_TONE);
  });
});
