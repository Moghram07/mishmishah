import type { BodyType } from "@/types";
import { profileFor, type BodyEdge } from "@/lib/mannequin/profile";
import { BUST } from "./art/female/yoke";

/**
 * Where the body turns cloth toward the light — for a cloth with a sheen
 * (see `garments/sheen.tsx`): the tops of the shoulders, the tops of the
 * sleeves over the deltoid, and her bust. The light is the shading's, from the
 * upper left, so the left of each is lit more than the right.
 *
 * Read off the measured body (`mannequin/profile.ts`, the bust from `BUST`),
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

/** A soft ellipse, turned `deg`, as a polygon. */
function ellipse([cx, cy]: Pt, rx: number, ry: number, deg: number): Pt[] {
  const a = (deg * Math.PI) / 180;
  return Array.from({ length: 16 }, (_, k) => {
    const t = (k / 16) * Math.PI * 2;
    const [x, y] = [Math.cos(t) * rx, Math.sin(t) * ry];
    return [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)] as Pt;
  });
}

const path = (poly: Pt[]) => `M${poly.map(([x, y]) => `${r1(x)} ${r1(y)}`).join(" L")} Z`;
const mirror = (poly: Pt[]): Pt[] => poly.map(([x, y]) => [CANVAS_W - x, y]);

/**
 * The highlights the body throws on a cloth with a sheen. `bust` false for a
 * robe — an abaya, a thobe — hung from the shoulders and falling clear of it.
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
  // her bust: the upper left of each, where it turns toward the light
  if (bust && body === "female") {
    const [[lx, ly], [rx, ry]] = BUST.points;
    out.push({ d: path(ellipse([lx - 8, ly - 11], 15, 10, -30)), strength: 0.9 });
    out.push({ d: path(ellipse([rx - 8, ry - 11], 15, 10, -30)), strength: 0.7 });
  }
  return out;
}
