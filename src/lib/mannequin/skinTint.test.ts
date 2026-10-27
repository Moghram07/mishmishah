import { describe, expect, it } from "vitest";
import { chroma, hexToRgb, hue, rgbToLab, type Rgb } from "@/lib/color/cielab";
import { skinTones } from "@/lib/data/skinTones";
import { profiles } from "./profile";
import { skinTint, tinted } from "./skinTint";

/**
 * A tone over the photograph: the body's median, highlight and shadow worked
 * through the same tables the SVG filter applies, for every tone on both
 * bodies. The contact sheet (`.preview/skin-tones.html`) asks the same
 * questions by eye.
 */

const LEVEL = 1 / 255;
const bodies = Object.entries(profiles);

const render = (hex: string, light: { median: number; highlight: number }, grey: number): Rgb => {
  const [r, g, b] = skinTint(hex, light);
  return [tinted(r, grey), tinted(g, grey), tinted(b, grey)];
};

describe("a skin tone over the photograph", () => {
  it("renders the photograph's median as the measured colour", () => {
    for (const tone of skinTones) {
      for (const [body, { light }] of bodies) {
        const got = render(tone.color, light, light.median);
        const want = hexToRgb(tone.color);
        for (let c = 0; c < 3; c++) {
          expect(Math.abs(got[c] - want[c]), `${tone.id} ${body}`).toBeLessThan(LEVEL);
        }
      }
    }
  });

  it("keeps the photograph's highlight short of white", () => {
    for (const tone of skinTones) {
      for (const [body, { light }] of bodies) {
        for (const c of render(tone.color, light, light.highlight)) {
          expect(c, `${tone.id} ${body}`).toBeLessThan(1);
        }
      }
    }
  });

  it("turns redder in shadow, never greyer", () => {
    for (const tone of skinTones) {
      for (const [body, { light }] of bodies) {
        const lit = rgbToLab(render(tone.color, light, light.median));
        for (const depth of [0.8, 0.6]) {
          const shade = rgbToLab(render(tone.color, light, light.median * depth));
          const at = `${tone.id} ${body} at ${depth}`;
          expect(shade[1], at).toBeGreaterThan(0);
          expect(shade[2], at).toBeGreaterThan(0);
          // redder: the hue swings toward red, by a little
          expect(hue(shade), at).toBeLessThan(hue(lit));
          expect(hue(shade), at).toBeGreaterThan(hue(lit) - 15);
          // not greyer: as colourful for its lightness as the lit skin
          expect(chroma(shade) / shade[0], at).toBeGreaterThanOrEqual(chroma(lit) / lit[0]);
        }
      }
    }
  });

  it("keeps lit skin the tone's own hue", () => {
    for (const tone of skinTones) {
      for (const [body, { light }] of bodies) {
        const lit = rgbToLab(render(tone.color, light, light.median));
        const bright = rgbToLab(render(tone.color, light, (light.median + light.highlight) / 2));
        expect(Math.abs(hue(bright) - hue(lit)), `${tone.id} ${body}`).toBeLessThan(2);
      }
    }
  });

  it("keeps the light and the shadow visible on every tone", () => {
    for (const tone of skinTones) {
      for (const [body, { light }] of bodies) {
        const shadow = light.median * 0.85;
        const hi = render(tone.color, light, light.highlight);
        const lo = render(tone.color, light, shadow);
        // Green carries most of the lightness and follows the photograph
        // exactly: the photograph's own light and shadow, in every tone.
        expect(hi[1] / lo[1], `${tone.id} ${body}`).toBeCloseTo(light.highlight / shadow, 2);
        // and the difference is one an eye sees, on the deepest tone too
        expect(rgbToLab(hi)[0] - rgbToLab(lo)[0], `${tone.id} ${body}`).toBeGreaterThan(4);
        expect((hi[0] - lo[0]) / LEVEL, `${tone.id} ${body}`).toBeGreaterThan(15);
      }
    }
  });
});
