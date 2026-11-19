import type { BodyType } from "@/types";
import { edgeAt, profileFor, type BodyEdge } from "@/lib/mannequin/profile";

/**
 * Where the body turns cloth toward the light — for a cloth with a sheen
 * (see `garments/sheen.tsx`): the tops of the shoulders, the tops of the
 * sleeves over the deltoid, and her upper chest. The light is the shading's,
 * from the upper left, so the left of each is lit more than the right.
 *
 * Read off the measured body (`mannequin/profile.ts`),
 * not placed by eye: the shoulder strip follows the shoulder's own slope, the
 * sleeve's follows the outside of the arm, so they sit where her shoulder and
 * his arm actually are. Drawn into the region they fall on and masked to it:
 * on cloth they shine, over skin they are not drawn.
 */
export interface BodyHighlight {
  /** The shape, in canvas units. */
  d: string;
  /** How bright, against the form's brightest: 0 to 1. */
  strength: number;
  /**
   * Spread wide and soft rather than kept to its shape — her chest's broad
   * sheen, drawn through `sheen-chest` instead of `sheen-body`.
   */
  broad?: true;
}

type Pt = [number, number];
const r1 = (v: number) => Math.round(v * 10) / 10;
const CANVAS_W = 600;

/** The edge's x at row `y`, if it is sampled there. */
const at = (edge: BodyEdge, y: number) => {
  const i = Math.round((y - edge.fromY) / edge.step);
  return i >= 0 && i < edge.x.length ? edge.x[i] : null;
};

/**
 * A strip just inside the left outline between two rows: from `from` to
 * `to` units in from the edge, along its own inward normal — the cloth lying
 * over the curve, a little in from where it turns out of sight.
 */
function strip(edge: BodyEdge, y0: number, y1: number, from: number, to: number): Pt[][] {
  const pts: Pt[] = [];
  for (let y = y0; y <= y1; y += edge.step) {
    const x = at(edge, y);
    if (x !== null) pts.push([x, y]);
  }
  if (pts.length < 3) return [];
  const inner: Pt[] = [];
  const outer: Pt[] = [];
  pts.forEach(([x, y], i) => {
    const [px, py] = pts[Math.max(0, i - 1)];
    const [qx, qy] = pts[Math.min(pts.length - 1, i + 1)];
    const len = Math.hypot(qx - px, qy - py) || 1;
    // the left outline runs down the body; its inside is on the right of it
    const [nx, ny] = [(qy - py) / len, -(qx - px) / len];
    inner.push([x + nx * from, y + ny * from]);
    outer.push([x + nx * to, y + ny * to]);
  });
  return [[...inner, ...outer.reverse()]];
}

/**
 * Her upper chest, as one band from shoulder to shoulder — where a fitted
 * bodice turns up toward the light, above the bust — returned as its left
 * half (x from just inside the shoulder to the centre line). The band rises
 * to the shoulders, as the body does, and thins toward them; mirrored, the
 * two halves meet edge to edge on the centre line, and blurred together they
 * are one sheen, brighter on the lit side.
 *
 * It replaced a highlight on each breast: two round lights read as two spots
 * and drew the eye to them. A satin bodice catches the light across the whole
 * of the upper chest, not at two points.
 */
export const CHEST = {
  /** In from the shoulder point, where the band ends. */
  inset: 15,
  /** Its top on the centre line, below the shoulder point. */
  drop: 22,
  /** How much higher it is at the shoulders than at the centre. */
  rise: 16,
  /** Its depth on the centre line, and at its ends. */
  depth: [30, 20] as const,
};

function chestHalf(shoulderX: number, shoulderY: number): Pt[] {
  const x0 = shoulderX + CHEST.inset;
  const span = 300 - x0;
  const top: Pt[] = [];
  const bottom: Pt[] = [];
  for (let k = 0; k <= 11; k++) {
    const x = x0 + (span * k) / 11;
    // u: 1 at the shoulder end, 0 at the centre line
    const u = (300 - x) / span;
    const y = shoulderY + CHEST.drop - CHEST.rise * u * u;
    const depth = CHEST.depth[0] + (CHEST.depth[1] - CHEST.depth[0]) * u * u;
    top.push([x, y]);
    bottom.push([x, y + depth]);
  }
  return [...top, ...bottom.reverse()];
}

const path = (poly: Pt[]) => `M${poly.map(([x, y]) => `${r1(x)} ${r1(y)}`).join(" L")} Z`;
const mirror = (poly: Pt[]): Pt[] => poly.map(([x, y]) => [CANVAS_W - x, y]);

/**
 * The highlights the body throws on a cloth with a sheen. `bust` false for a
 * robe — an abaya, a thobe — hung from the shoulders and falling clear of her
 * figure: no chest band on it.
 */
export function bodyHighlights(body: BodyType, { bust = true }: { bust?: boolean } = {}): BodyHighlight[] {
  const p = profileFor(body);
  const top = p.armOuter.fromY;
  const out: BodyHighlight[] = [];
  const both = (polys: Pt[][], left: number, right: number) => {
    for (const poly of polys) {
      out.push({ d: path(poly), strength: left });
      out.push({ d: path(mirror(poly)), strength: right });
    }
  };
  // the top of each shoulder: from beside the neck out to the shoulder point, just inside the line
  both(strip(p.armOuter, top + 2, p.shoulderPointY, 2, 11), 1, 0.5);
  // the top of each sleeve, over the deltoid: the outside of the arm from the shoulder point down
  both(strip(p.armOuter, p.shoulderPointY - 2, Math.min(p.armpitY, p.shoulderPointY + 40), 2, 13), 0.9, 0.3);
  // her upper chest: one broad band above the bust, shoulder to shoulder, its left half lit more
  if (bust && body === "female") {
    const half = chestHalf(edgeAt(p.armOuter, p.shoulderPointY) ?? 197, p.shoulderPointY);
    out.push({ d: path(half), strength: 0.8, broad: true });
    out.push({ d: path(mirror(half)), strength: 0.5, broad: true });
  }
  return out;
}

