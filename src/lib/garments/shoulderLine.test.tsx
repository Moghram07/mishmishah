import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { garmentsFor } from "@/lib/data/garments";
import { necklinesForGarment } from "@/lib/data/necklines";
import { sleeveLengthsFor, sleeveTypesFor } from "@/lib/data/sleeves";
import { garmentArt } from "./art";
import { choiceOf, collarOf, cutFrom, necklineOf, setNeckline, setSleeve } from "./outfit";
import { ringsOf } from "./stripes";
import type { Pt } from "./fit";
import type { BodyType, FabricRegionId, WornGarment } from "@/types";

/**
 * The shoulder line runs on into the sleeve.
 *
 * Walked out from the neck over each shoulder, the top of the cloth never
 * drops (or rises) at once and then carries on at a shoulder's slope: a step
 * in the outline at the shoulder seam. It did, on both shoulders: her crew and
 * V dropped two units straight down just before the sleeve, where the neck's
 * edge let go of the seam, and every bishop, bell and flutter sleeve's head
 * stood two units above the shoulder point, its outer edge starting at the
 * point below it.
 */

/** How far apart the columns the outline is read in stand, in units. */
const COLUMN = 0.1;
/** A step: the outline moves this far up or down within two columns… */
const STEP = 0.8;
/**
 * …and outward of it carries on no steeper than this over a unit and a half,
 * as a shoulder does (the steps were 1.4 at most) — not down an arm, as a drop
 * shoulder's seam runs, at 2.2 to 2.6.
 */
const SHOULDER_SLOPE = 1.8;
/** The outer shoulder, each side: this far out from the centre and beyond, clear of every neckline's corners. */
const OUTER = 70;
const ROWS: [number, number] = [150, 280];

/** Each piece of a garment's cloth as worn, as rings of points. */
function cloth(w: WornGarment, front: string, regions: readonly FabricRegionId[]): Pt[][] {
  const art = garmentArt(front)!;
  const choice = choiceOf(w);
  const collar = collarOf(w);
  const cut = art.cut?.(choice);
  const rings: Pt[][] = [];
  for (const r of new Set<FabricRegionId>([...(Object.keys(art.regions) as FabricRegionId[]), ...regions])) {
    /* a collar and a tie lie at the neck, inside the outer shoulder */
    if (r === "collar" || r === "tie") continue;
    const drawing = cut?.[r] ?? (collar && art.variants?.[collar.opening]?.[r]) ?? art.regions[r];
    if (!drawing) continue;
    for (const m of renderToStaticMarkup(<svg>{drawing.shape("red")}</svg>).matchAll(/ d="([^"]+)"/g)) rings.push(...ringsOf(m[1]));
  }
  return rings;
}

/** The steps in the top of the cloth, walking out from `from` to `to`. */
function steps(rings: Pt[][], from: number, to: number): string[] {
  const dir = Math.sign(to - from);
  const [lo, hi] = [Math.min(from, to), Math.max(from, to)];
  /* the sides that reach the band: the rest cannot be its top */
  const sides: [Pt, Pt][] = [];
  for (const ring of rings)
    for (let k = 0; k < ring.length; k++) {
      const a = ring[k];
      const b = ring[(k + 1) % ring.length];
      if (Math.max(a[0], b[0]) < lo || Math.min(a[0], b[0]) > hi || Math.max(a[1], b[1]) < ROWS[0] || Math.min(a[1], b[1]) > ROWS[1]) continue;
      sides.push([a, b]);
    }
  const top: Pt[] = [];
  for (let x = from; dir > 0 ? x <= to : x >= to; x += dir * COLUMN) {
    let y = Infinity;
    for (const [a, b] of sides) {
      if ((a[0] - x) * (b[0] - x) > 0 || a[0] === b[0]) continue;
      const at = a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
      if (at >= ROWS[0] && at <= ROWS[1]) y = Math.min(y, at);
    }
    if (y < Infinity) top.push([x, y]);
  }
  const out: string[] = [];
  for (let k = 1; k < top.length; k++) {
    const [x, y] = top[k];
    if (k < 2 || Math.abs(x - top[k - 2][0]) > COLUMN * 2.5 || Math.abs(y - top[k - 2][1]) < STEP) continue;
    const far = top.findIndex(([fx], j) => j > k && Math.abs(fx - x) >= 1.5);
    if (far < 0) continue;
    if (Math.abs((top[far][1] - y) / (top[far][0] - x)) > SHOULDER_SLOPE) continue;
    out.push(`${(y - top[k - 2][1]).toFixed(2)} at ${x.toFixed(1)},${y.toFixed(1)}`);
    k += 2;
  }
  return out;
}

describe("the shoulder line", () => {
  it("runs on into every sleeve and armhole without a step, on every garment, both shoulders", () => {
    const found: string[] = [];
    let walked = 0;
    for (const body of ["female", "male"] as BodyType[])
      for (const g of garmentsFor(body)) {
        const base = [cutFrom(g, "fb-sky-linen")];
        /* the dress in the cuts whose shoulder lines are drafted differently: the crew and V from the neck's points, and the high */
        const cuts = necklinesForGarment(g)
          .map((n) => n.id)
          .filter((id) => g.id !== "female-dress" || ["female-round-neckline", "female-v-neckline", "female-high-neckline"].includes(id));
        for (const cut of cuts.length ? cuts : [undefined]) {
          const worn = cut ? setNeckline(base, g.id, cut) : base;
          const neckline = necklineOf(worn[0]);
          const types = sleeveTypesFor(g, neckline);
          const sleeves: [string, WornGarment[]][] = types.length
            ? types.flatMap((type) => sleeveLengthsFor(type, neckline, g).map((length) => [`${type} ${length}`, setSleeve(worn, g.id, { type, length } as never)] as [string, WornGarment[]]))
            : [["as it comes", worn]];
          for (const [name, w] of sleeves) {
            const rings = cloth(w.find((x) => x.garmentId === g.id)!, g.asset.front, g.fabricRegions as FabricRegionId[]);
            if (!rings.length) continue;
            walked++;
            for (const [side, from, to] of [["left", 300 - OUTER, 140], ["right", 300 + OUTER, 460]] as const)
              for (const s of steps(rings, from, to)) found.push(`${g.id}${cut ? ` (${cut})` : ""}, ${name}, ${side}: ${s}`);
          }
        }
      }
    expect(walked, "garments walked").toBeGreaterThan(150);
    expect(found).toEqual([]);
  }, 120_000);
});
