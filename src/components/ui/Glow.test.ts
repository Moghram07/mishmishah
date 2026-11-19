import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { covered, glowGradient } from "./Glow";

/** Every source file under a folder, tests left out. */
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.(tsx?|css)$/.test(name) && !/\.test\./.test(name) ? [p] : [];
  });

describe("a glow", () => {
  it("is a blurred disc, worked out: right at the centre, falling all the way, gone three blurs past the edge", () => {
    for (const [R, s] of [[96, 64], [128, 64], [48, 40]]) {
      // at the centre, the share of the disc a Gaussian covers is 1 − e^(−R²/2σ²)
      expect(covered(0, R, s), `${R}/${s} centre`).toBeCloseTo(1 - Math.exp(-(R * R) / (2 * s * s)), 4);
      let last = Infinity;
      for (let r = 0; r <= R + 3 * s; r += 8) {
        const v = covered(r, R, s);
        expect(v, `${R}/${s} at ${r}`).toBeLessThanOrEqual(last + 1e-9);
        last = v;
      }
      expect(covered(R + 3 * s, R, s), `${R}/${s} at its reach`).toBeLessThan(0.02);
    }
    // a disc blurred hardly at all is the disc: full inside, half at its edge, nothing outside
    expect(covered(0, 100, 2)).toBeCloseTo(1, 3);
    expect(covered(100, 100, 2)).toBeCloseTo(0.5, 1);
    expect(covered(120, 100, 2)).toBeCloseTo(0, 3);
  });

  it("is drawn as a gradient in its own colour, from the blurred disc's centre out to nothing", () => {
    const g = glowGradient(96, 64, "#FF6A2C", 0.25);
    expect(g.startsWith("radial-gradient(circle closest-side, rgba(255,106,44,")).toBe(true);
    expect(g.endsWith("rgba(255,106,44,0) 100%)")).toBe(true);
    const centre = Number(/rgba\(255,106,44,([\d.]+)\) 0%/.exec(g)![1]);
    expect(centre).toBeCloseTo(0.25 * (1 - Math.exp(-1.125)), 3);
  });

  it("is never a CSS blur filter anywhere on the site: under one, Safari on an iPhone painted the page's first tile black", () => {
    const bad = [...walk("src/components"), ...walk("src/app")].flatMap((f) => {
      // the code, not what its comments say about it
      const src = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
      // Tailwind's blur classes (a backdrop blur is another thing), and filter: blur() written out
      return [...src.matchAll(/(?<![\w-])blur-(?:none|sm|md|lg|xl|2xl|3xl|\[[^\]]+\])(?![\w-])|filter:\s*["'`]?blur\(/g)].map((m) => `${f}: ${m[0]}`);
    });
    expect(bad).toEqual([]);
  });
});
