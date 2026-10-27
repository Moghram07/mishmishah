import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductTemplate } from "@/components/visualizer/ProductTemplate";
import { fabricById } from "@/lib/data/fabrics";
import { TILE_PX, fabricTileSvg } from "./patterns";
import type { FabricMotif } from "@/types";

/**
 * Grain rotation.
 *
 * A stripe has 180° rotational symmetry, so it genuinely looks identical at 0°
 * and 180° — that is the motif, not the maths, and it once got reported as a
 * doubling bug. These tests pin the two things that would make it a real bug:
 * the angle being applied more than once, and the floral losing the direction
 * that makes a rotation visible at all.
 *
 * (No JSX here on purpose — the app's tsconfig sets jsx: "preserve" for Next,
 * and `createElement` keeps the test runner out of that argument entirely.)
 */

const floral = fabricById("fb-midnight-floral")!;

/** The pillow is a single part, so exactly one pattern should be emitted. */
function render(direction: number): string {
  return renderToStaticMarkup(
    createElement(ProductTemplate, {
      kind: "pillow",
      fabrics: { main: floral },
      direction,
      stitch: { main: "hidden" },
    })
  );
}

const rotations = (markup: string) =>
  [...markup.matchAll(/rotate\(\s*(-?[\d.]+)/g)].map((m) => Number(m[1]));

describe("grain angle is applied exactly once", () => {
  for (const angle of [0, 45, 90, 180, 270, 315]) {
    it(`emits a single rotate(${angle}) for a one-part product`, () => {
      const markup = render(angle);

      // One part ⇒ one <pattern> ⇒ one rotation. A second rotate() anywhere
      // (on the tile, on the filled path, on a wrapping <g>) doubles the turn.
      expect(markup.match(/<pattern/g)).toHaveLength(1);
      expect(rotations(markup)).toEqual([angle]);
    });
  }

  it("does not scale the angle (0–360 in, 0–360 out)", () => {
    // Catches `angle * 2`, or a slider mapped to 0–720.
    for (const angle of [30, 200, 359]) {
      expect(rotations(render(angle))).toEqual([angle]);
    }
  });

  it("rotates about a fixed pivot so the motif does not drift", () => {
    // rotate(a) alone pivots at the user-space origin, which swings the lattice
    // out from under a product drawn around (200,200).
    expect(render(45)).toMatch(/rotate\(45 200 200\)/);
  });
});

/* ------------------------------------------------------------------------ */

/** Coordinate pairs drawn in a tile — circle centres and path vertices. */
function drawnPoints(svg: string): string[] {
  const pts: Array<[number, number]> = [];
  for (const m of svg.matchAll(
    /<circle[^>]*cx="(-?[\d.]+)"[^>]*cy="(-?[\d.]+)"/g
  )) {
    pts.push([Number(m[1]), Number(m[2])]);
  }
  for (const m of svg.matchAll(/\sd="([^"]+)"/g)) {
    const nums = (m[1].match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  }
  return pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).sort();
}

/** Is the tile unchanged by a 180° turn about its centre? */
function isHalfTurnSymmetric(motif: FabricMotif): boolean {
  const svg = fabricTileSvg(
    { base: "#000000", accent: "#111111", highlight: "#222222", motif },
    TILE_PX
  );
  const original = drawnPoints(svg);
  const reflected = original
    .map((p) => {
      const [x, y] = p.split(",").map(Number);
      return `${(TILE_PX - x).toFixed(1)},${(TILE_PX - y).toFixed(1)}`;
    })
    .sort();
  return original.join("|") === reflected.join("|");
}

describe("the floral stays directional", () => {
  it("is not symmetric under a half turn, so 0° and 180° really differ", () => {
    expect(isHalfTurnSymmetric("floral")).toBe(false);
  });

  it("renders differently at 0, 90, 180 and 270", () => {
    const seen = [0, 90, 180, 270].map(render);
    expect(new Set(seen).size).toBe(4);
  });

  it("detects symmetry where it exists (control)", () => {
    // `dots` is a symmetric lattice — if this reported false, the assertion
    // above would be passing for the wrong reason.
    expect(isHalfTurnSymmetric("dots")).toBe(true);
  });
});
