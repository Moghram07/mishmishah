import { describe, expect, it } from "vitest";
import { arc, blade, flip, mirror, shrink, type Point } from "./collar";

/**
 * The geometry every collar is drawn from.
 *
 * Worth testing because it is load-bearing in a way a drawing is not: every
 * collar in the wardrobe gets its right-hand side from `mirror`, its topstitch
 * from `shrink`, and its outline from `blade`. A silent bug in any of the three
 * is a silent bug in thirteen collars at once — and `check:garments` would not
 * catch most of them, because a wrong curve is still a curve in the right place.
 *
 * The geometry these produce is checked against the body by
 * `npm run check:garments`; what is asserted here is that the tools themselves
 * behave.
 */

const AXIS = 600;

/** Every number in a path, as pairs. */
const points = (d: string): [number, number][] => {
  const n = (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);
  return Array.from({ length: n.length / 2 }, (_, i) => [n[i * 2], n[i * 2 + 1]]);
};

describe("mirror", () => {
  it("reflects every x about the centre line and leaves y alone", () => {
    const d = "M262 200 L286 214 L272 254 Z";
    expect(mirror(d)).toBe("M338 200 L314 214 L328 254 Z");
  });

  it("handles cubics, quadratics and the implicit line-tos after an M", () => {
    expect(mirror("M300 206 C288 206 275 198 268 180 Z")).toBe(
      "M300 206 C312 206 325 198 332 180 Z"
    );
    expect(mirror("M268 180 Q280 200 300 210 Z")).toBe(
      "M332 180 Q320 200 300 210 Z"
    );
    // pairs after an M are line-tos, and their x has to move too
    expect(mirror("M268 180 272 190 280 200 Z")).toBe(
      "M332 180 328 190 320 200 Z"
    );
  });

  it("round-trips, which is what stops a pair of sides drifting", () => {
    for (const d of [
      "M262 200 L286 214 L272 254 L252 232 Z",
      "M268 180 C272 240 328 240 332 180 C329 214 271 214 268 180 Z",
      blade(
        [
          [296, 191],
          [270, 179],
          [256, 192],
          [286, 243],
        ],
        [3, 2, 1.5, -2]
      ),
    ]) {
      const there = mirror(d);
      expect(there).not.toBe(d.replace(/\s+/g, " "));
      expect(mirror(there)).toBe(d.replace(/\s+/g, " "));
    }
  });

  it("does not leave a number stuck to its command letter", () => {
    // `M 338` is legal SVG but every path in this codebase is written `M338`,
    // and a mirrored one is read beside the original it came from.
    expect(mirror("M262 200 L286 214 Z")).not.toMatch(/[A-Z] /);
  });
});

describe("blade", () => {
  const CORNERS: Point[] = [
    [296, 191],
    [270, 179],
    [286, 243],
  ];

  it("starts at the first corner, closes, and bends every edge", () => {
    const d = blade(CORNERS, [3, 2, -2]);
    expect(d.startsWith("M296 191")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    // one cubic per edge, and never a straight line-to: cloth has no straight
    // edges, and `check:garments` measures exactly that.
    expect(d.match(/C/g)).toHaveLength(CORNERS.length);
    expect(d).not.toMatch(/L/);
  });

  it("puts a bowed edge off its own chord, and an unbowed one on it", () => {
    const straight = points(blade(CORNERS, [0, 0, 0]));
    const bowed = points(blade(CORNERS, [6, 0, 0]));
    // the first edge's two control points move; the rest of the path does not
    expect(bowed[1]).not.toEqual(straight[1]);
    expect(bowed[2]).not.toEqual(straight[2]);
    expect(bowed.slice(3)).toEqual(straight.slice(3));
  });

  it("reverses which way an edge bows when the bow flips sign", () => {
    const left = points(blade(CORNERS, [5, 0, 0]))[1];
    const right = points(blade(CORNERS, [-5, 0, 0]))[1];
    const chord = points(blade(CORNERS, [0, 0, 0]))[1];
    expect(Math.sign(left[0] - chord[0])).toBe(-Math.sign(right[0] - chord[0]));
    expect(Math.sign(left[1] - chord[1])).toBe(-Math.sign(right[1] - chord[1]));
  });
});

describe("arc", () => {
  it("ends where it was told to, whatever the bow", () => {
    for (const bow of [-8, 0, 8]) {
      expect(arc([260, 180], [300, 220], bow).endsWith("300 220")).toBe(true);
    }
  });
});

describe("shrink", () => {
  const CORNERS: Point[] = [
    [280, 190],
    [320, 190],
    [320, 240],
    [280, 240],
  ];

  it("pulls every corner in toward the centre", () => {
    const inner = shrink(CORNERS, 4);
    const cx = 300;
    const cy = 215;
    for (const [i, [x, y]] of inner.entries()) {
      const [ox, oy] = CORNERS[i];
      expect(Math.hypot(x - cx, y - cy)).toBeLessThan(
        Math.hypot(ox - cx, oy - cy)
      );
    }
  });

  it("moves each corner by the distance it was asked for", () => {
    for (const [i, [x, y]] of shrink(CORNERS, 6).entries()) {
      const [ox, oy] = CORNERS[i];
      expect(Math.hypot(x - ox, y - oy)).toBeCloseTo(6, 1);
    }
  });

  it("leaves the shape where it is when asked for nothing", () => {
    expect(shrink(CORNERS, 0)).toEqual(CORNERS);
  });
});

describe("flip", () => {
  it("reflects corners the way mirror reflects a path", () => {
    const corners: Point[] = [
      [268, 180],
      [296, 191],
    ];
    expect(flip(corners)).toEqual([
      [AXIS - 268, 180],
      [AXIS - 296, 191],
    ]);
  });
});
