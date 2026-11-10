import { describe, expect, it } from "vitest";
import { outline, type Neckline, type Pt } from "./fit";
import { PETER_PAN, peterPan } from "./art/female/collarCuts";
import { bodiceFor, covers } from "./art/female/dressCut";
import { opening } from "./art/female/yoke";
import { BODY_CANVAS } from "../mannequin/bodies";

/**
 * Round 14: the Peter Pan, rebuilt from the user's photographs of real ones —
 * small, about 5–7 cm deep, lying flat right round the neckline; two rounded
 * ends that just meet at centre front, with no line down the middle; on a
 * scoop or a boat following that neckline at the same small width.
 */

const CM = BODY_CANVAS.cmPerUnit;
/** Every opening it is sewn to: a top's crew neck, and the dress's three round cuts. */
const ON: [string, Neckline, ReturnType<typeof peterPan>][] = [
  ["top", opening(34), peterPan()],
  ...(["round", "scoop", "boat"] as const).map((cut): [string, Neckline, ReturnType<typeof peterPan>] => [cut, bodiceFor(cut).cut.neck!, peterPan(cut)]),
];

/** The seam, finely: the half-ellipse the opening is cut on. */
const seamOf = (n: Neckline): Pt[] =>
  Array.from({ length: 721 }, (_, i) => {
    const t = (i / 720) * Math.PI;
    return [n.center + n.half * Math.cos(t), n.seamY + n.dip * Math.sin(t)] as Pt;
  });
const distanceTo = (pts: Pt[], [x, y]: Pt) => Math.min(...pts.map(([a, b]) => Math.hypot(a - x, b - y)));
/** How far inside the opening's ellipse a point is: below 1 is in the opening. */
const radius = (n: Neckline, [x, y]: Pt) => Math.hypot((x - n.center) / n.half, (y - n.seamY) / n.dip);

describe("the Peter Pan", () => {
  it("is 5–7 cm of cloth from the seam at its widest, and no wider anywhere", () => {
    const W = PETER_PAN.width * CM;
    expect(W).toBeGreaterThanOrEqual(5);
    expect(W).toBeLessThanOrEqual(7);
    for (const [name, neck, pp] of ON) {
      const seam = seamOf(neck);
      for (const free of pp.free) {
        const from = free.map((p) => distanceTo(seam, p) * CM);
        expect(Math.max(...from), name).toBeLessThanOrEqual(W + 0.05);
        expect(Math.max(...from), name).toBeGreaterThan(W - 0.2);
        /*
          Held at that width along a longer neckline, between its rounded end
          and where it turns over the shoulder; round a crew neck the one
          flows into the other over the collarbone.
        */
        const full = from.filter((d) => d > W - 0.1).length;
        expect(full, name).toBeGreaterThanOrEqual(name === "scoop" || name === "boat" ? 4 : 1);
      }
    }
  });

  it("lies flat outside the opening, never over it", () => {
    for (const [name, neck, pp] of ON) {
      for (const half of [pp.left, pp.right]) {
        for (const p of half) expect(radius(neck, p), `${name} ${p}`).toBeGreaterThan(0.995);
      }
    }
  });

  it("has two rounded front ends that just meet at the neck, and no line down the middle", () => {
    for (const [name, neck, pp] of ON) {
      const front: Pt = [neck.center, neck.seamY + neck.dip];
      const [left, right] = [outline(pp.left), outline(pp.right)];
      // both halves start at the neckline's centre-front point, and their free edges end there
      for (const half of [pp.left, pp.right]) expect(Math.hypot(half[0][0] - front[0], half[0][1] - front[1]), name).toBeLessThan(0.01);
      for (const free of pp.free) expect(Math.hypot(free.at(-1)![0] - front[0], free.at(-1)![1] - front[1]), name).toBeLessThan(0.01);
      // just below the neck the two touch, the centre covered, or all but
      expect(covers(left, front[0] - 0.6, front[1] + 2) || covers(right, front[0] + 0.6, front[1] + 2), name).toBe(true);
      // and they part below it over a V of the garment: no seam where they butt down to the collar's foot
      for (const below of [12, 20, 26]) {
        expect(covers(left, front[0], front[1] + below), `${name} ${below}`).toBe(false);
        expect(covers(right, front[0], front[1] + below), `${name} ${below}`).toBe(false);
      }
      // each half's front end rounded: the foot of its curve is out on the lobe, at least 3 cm from the centre, not at it
      for (const free of pp.free) {
        const foot = free.reduce((a, b) => (b[1] > a[1] ? b : a));
        expect(Math.abs(foot[0] - front[0]) * CM, name).toBeGreaterThan(3);
      }
    }
  });

  it("turns over each shoulder, its end lying along the shoulder line", () => {
    const shoulders = (cut?: "round" | "scoop" | "boat") => {
      const p = bodiceFor(cut ?? "round").cut.parts!;
      return [p.strapLeft, [...p.strapRight].reverse()];
    };
    for (const [name, , pp] of ON) {
      const lines = shoulders(name === "top" ? undefined : (name as "round" | "scoop" | "boat"));
      pp.free.forEach((free, side) => {
        const end = free[0];
        const along = lines[side];
        const fine: Pt[] = along.slice(1).flatMap((b, i) => {
          const a = along[i];
          return Array.from({ length: 20 }, (_, k) => [a[0] + ((b[0] - a[0]) * k) / 20, a[1] + ((b[1] - a[1]) * k) / 20] as Pt);
        });
        expect(distanceTo(fine, end), `${name} ${side}`).toBeLessThan(0.5);
        // below the collar point it turned at, never above it beside the neck
        expect(end[1], `${name} ${side}`).toBeGreaterThan(along[0][1]);
        // and out past the collar point its edge lies on the shoulder, never standing up off it
        const outward = side === 0 ? -1 : 1;
        const shoulderAt = (x: number) => {
          for (let i = 1; i < along.length; i++) {
            const [a, b] = [along[i - 1], along[i]];
            if ((x - a[0]) * (x - b[0]) <= 0 && a[0] !== b[0]) return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
          }
          return -Infinity;
        };
        for (const p of free.filter(([x]) => (x - along[0][0]) * outward > 0)) {
          expect(p[1], `${name} ${side} at ${p}`).toBeGreaterThan(shoulderAt(p[0]) - 0.5);
        }
      });
    }
  });

  it("is the same collar on every cut, only laid along each one's neckline", () => {
    const deep = (pp: ReturnType<typeof peterPan>, n: Neckline) =>
      Math.max(...pp.free.flatMap((f) => f.map((p) => distanceTo(seamOf(n), p))));
    const [top, ...cuts] = ON.map(([, n, pp]) => deep(pp, n));
    for (const d of cuts) expect(Math.abs(d - top) * CM).toBeLessThan(0.3);
  });
});
