import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { insideRing, panelStripes, sailor, type SailorPanel } from "./art/female/collarCuts";
import { STRIPES } from "./stripes";
import { bodiceFor } from "./art/female/dressCut";
import { collarOf, cutFrom, regionsOf, setCollar, setNeckline, setStripes, stripesOf, stripesOnOf, wear } from "./outfit";
import { BODY_CANVAS } from "../mannequin/bodies";
import { MannequinStage } from "@/components/visualizer/MannequinStage";
import { collarById, stripesFor } from "@/lib/data/collars";
import { contrastingPlain, fabricById, fabrics } from "@/lib/data/fabrics";
import { garmentById } from "@/lib/data/garments";
import { DEFAULT_SKIN_TONE } from "@/lib/data/skinTones";
import { hexToLab } from "@/lib/color/cielab";
import { fabricAverageColor } from "@/lib/fabrics/patterns";
import type { Pt } from "./fit";
import type { Fabric, FabricRegionId, Outfit, WornGarment } from "@/types";

/**
 * Round 15: the sailor collar, rebuilt from the user's photographs of real
 * ones. Seen from the front: two flat panels lying on the shoulders, wide
 * over them, out close to the shoulder point, and narrowing smoothly down to
 * the V's point at mid-chest; no stubs at the neck, the panels' inner edges
 * following the V's edges all the way up; and, if chosen, one or two thin
 * stripes along the outer edge in a second cloth.
 */

const CM = BODY_CANVAS.cmPerUnit;
const { vee, parts } = bodiceFor("v").cut;
const APEX = vee!.apex;
const panels = sailor();
const SIDES: { side: string; panel: SailorPanel; edge: Pt[]; shoulder: Pt[]; out: -1 | 1 }[] = [
  { side: "left", panel: panels.left, edge: vee!.left, shoulder: parts!.strapLeft, out: -1 },
  { side: "right", panel: panels.right, edge: [...vee!.right].reverse(), shoulder: [...parts!.strapRight].reverse(), out: 1 },
];

/** A polyline, finely: a point every tenth of a unit or so. */
const fine = (pts: Pt[]): Pt[] =>
  pts.slice(1).flatMap((b, i) => {
    const a = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 10));
    return Array.from({ length: n + 1 }, (_, k) => [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n] as Pt);
  });
const distanceTo = (pts: Pt[], [x, y]: Pt) => Math.min(...pts.map(([a, b]) => Math.hypot(a - x, b - y)));
const length = (pts: Pt[]) => pts.slice(1).reduce((s, b, i) => s + Math.hypot(b[0] - pts[i][0], b[1] - pts[i][1]), 0);
/** The shoulder line's height at `x`, between its two ends. */
const heightAt = (line: Pt[], x: number) => {
  for (let i = 1; i < line.length; i++) {
    const [a, b] = [line[i - 1], line[i]];
    if ((x - a[0]) * (x - b[0]) <= 0 && a[0] !== b[0]) return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
  }
  return null;
};

describe("the sailor collar's panels", () => {
  it("lie on the shoulders, out to within 1–2.5 cm of the shoulder point", () => {
    for (const { side, panel, shoulder } of SIDES) {
      const line = fine(shoulder);
      expect(distanceTo(line, panel.corner), side).toBeLessThan(0.3);
      // the corner, measured back along the shoulder from the shoulder point
      const tip = shoulder.at(-1)!;
      const k = line.findIndex((p) => Math.hypot(p[0] - panel.corner[0], p[1] - panel.corner[1]) < 0.3);
      const short = length(line.slice(k)) * CM;
      expect(short, side).toBeGreaterThan(1);
      expect(short, side).toBeLessThan(2.5);
      expect(Math.abs(tip[1] - panel.corner[1]), side).toBeLessThan(6);
      // and every point of its top edge on the shoulder line, collar point to corner
      const top = panel.ring.slice(0, panel.ring.findIndex((p) => p === panel.outer[1]));
      expect(top.length, side).toBeGreaterThan(10);
      for (const p of top) expect(distanceTo(line, p), `${side} ${p}`).toBeLessThan(0.6);
    }
  });

  it("stand nowhere above the shoulder line, and have no stub at the neck: the inner edge is the V's, all the way up", () => {
    for (const { side, panel, edge, shoulder } of SIDES) {
      // nothing of the panel above the shoulder, anywhere along it
      for (const p of panel.ring) {
        const h = heightAt(shoulder, p[0]);
        if (h !== null) expect(p[1], `${side} ${p}`).toBeGreaterThan(h - 0.6);
      }
      // its highest point is the collar point, at the top of the V
      expect(Math.min(...panel.ring.map(([, y]) => y)), side).toBeCloseTo(shoulder[0][1], 1);
      // every point of the V's edge, point to collar point, on the panel's outline
      const ring = fine([...panel.ring, panel.ring[0]]);
      for (const p of fine(edge)) expect(distanceTo(ring, p), `${side} ${p}`).toBeLessThan(0.3);
      // and nothing of it in the opening
      const opening = [...vee!.right, ...vee!.left.slice(1)];
      for (const p of panel.ring) {
        if (insideRing(opening, p)) expect(distanceTo(fine(opening), p), `${side} ${p}`).toBeLessThan(0.5);
      }
    }
  });

  it("narrow smoothly to the V's point, where the two meet", () => {
    for (const { side, panel, edge } of SIDES) {
      expect(panel.outer.at(-1)![0], side).toBeCloseTo(APEX[0], 1);
      expect(panel.outer.at(-1)![1], side).toBeCloseTo(APEX[1], 1);
      // the point is the panel's lowest
      expect(Math.max(...panel.ring.map(([, y]) => y)), side).toBeCloseTo(APEX[1], 1);
      // its width across, outer edge to V, falls steadily from the shoulder to nothing
      const v = fine(edge);
      const widths = panel.outer.map((p) => distanceTo(v, p));
      expect(widths[0] * CM, side).toBeGreaterThan(9);
      for (let i = 1; i < widths.length; i++) expect(widths[i], `${side} ${i}`).toBeLessThan(widths[i - 1] + 0.05);
      expect(widths.at(-1)!, side).toBeLessThan(0.1);
      // the outer edge turns smoothly: no corner along it
      const turn = (i: number) => {
        const [a, b, c] = [panel.outer[i - 1], panel.outer[i], panel.outer[i + 1]];
        const d = Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0]);
        return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) * (180 / Math.PI);
      };
      for (let i = 1; i < panel.outer.length - 1; i++) expect(turn(i), `${side} ${i}`).toBeLessThan(4);
    }
  });

  it("bow their free edge outward, as a broad panel hangs: 1.2–2 cm off the straight line", () => {
    for (const { side, panel, shoulder } of SIDES) {
      const [a, b] = [panel.corner, APEX];
      const off = (p: Pt) => ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) / Math.hypot(b[0] - a[0], b[1] - a[1]);
      const most = panel.outer.reduce((m, p) => (Math.abs(off(p)) > Math.abs(off(m)) ? p : m));
      expect(Math.abs(off(most)) * CM, side).toBeGreaterThan(1.2);
      expect(Math.abs(off(most)) * CM, side).toBeLessThan(2);
      // away from the collar point: outward, not into the panel
      expect(Math.sign(off(most)), side).not.toBe(Math.sign(off(shoulder[0])));
    }
  });

  it("reach no further out than their corner, so neither lies over the arm or the sleeve", () => {
    for (const { side, panel, out } of SIDES) {
      for (const p of panel.ring) expect((p[0] - panel.corner[0]) * out, `${side} ${p}`).toBeLessThan(0.05);
    }
  });

  it("are drawn as measured: each path passes through every point of its V edge, its shoulder and its corner", () => {
    /* the on-curve ends of each command: M's point, and the last pair of each C */
    const ends = (d: string): Pt[] =>
      [...d.matchAll(/([MLC])([^MLCZ]*)/g)].map(([, , args]) => {
        const n = (args.match(/-?\d*\.?\d+/g) ?? []).map(Number);
        return [n[n.length - 2], n[n.length - 1]] as Pt;
      });
    for (const { side, panel, edge, shoulder } of SIDES) {
      const drawn = ends(panel.path);
      const on = (p: Pt) => distanceTo(drawn, p) < 0.15;
      for (const p of edge) expect(on(p), `${side} V ${p}`).toBe(true);
      for (const p of shoulder.filter((q) => (q[0] - panel.corner[0]) * (q[0] - shoulder[0][0]) <= 0)) {
        expect(on(p), `${side} shoulder ${p}`).toBe(true);
      }
      expect(on(panel.corner), side).toBe(true);
      // and its free edge is the outer edge measured
      expect(ends(panel.free)[0][0]).toBeCloseTo(panel.corner[0], 0);
      expect(ends(panel.free).at(-1)![1]).toBeCloseTo(APEX[1], 0);
    }
  });

  it("are the same panel on either side, each cut to its own shoulder", () => {
    const [l, r] = SIDES.map(({ panel }) => panel);
    // her neck is three units left of her shoulders' centre: alike to within that, not mirrored about either
    expect(Math.abs(APEX[0] - l.corner[0] - (r.corner[0] - APEX[0]))).toBeLessThan(8);
    expect(Math.abs(l.corner[1] - r.corner[1])).toBeLessThan(1);
    const across = (p: SailorPanel) => Math.max(...p.ring.map(([x]) => x)) - Math.min(...p.ring.map(([x]) => x));
    expect(Math.abs(across(l) - across(r)) * CM).toBeLessThan(1.5);
  });
});

describe("its stripes", () => {
  it("are one, two or three thin stripes on each panel, parallel to its outer edge", () => {
    for (const count of ["one", "two", "three"] as const) {
      const bands = STRIPES[count];
      expect(bands).toHaveLength({ one: 1, two: 2, three: 3 }[count]);
      for (const { side, panel } of SIDES) {
        const { paths, edges } = panelStripes(panel, bands);
        expect(paths, `${count} ${side}`).toHaveLength(bands.length);
        const outer = fine(panel.outer);
        edges.forEach(([near, far], i) => {
          const [from, to] = bands[i];
          // every point of each long edge at its own distance in from the outer edge
          for (const p of near.slice(1, -1)) expect(distanceTo(outer, p), `${count} ${side} ${i} near ${p}`).toBeCloseTo(from, 0);
          for (const p of far.slice(1, -1)) expect(distanceTo(outer, p), `${count} ${side} ${i} far ${p}`).toBeCloseTo(to, 0);
          // thin: 0.5–0.8 cm wide, apart, the first set in from the edge
          expect((to - from) * CM).toBeGreaterThan(0.5);
          expect((to - from) * CM).toBeLessThan(0.8);
          if (i > 0) expect((from - bands[i - 1][1]) * CM).toBeGreaterThan(0.35);
        });
        expect(bands[0][0] * CM).toBeGreaterThan(0.7);
      }
    }
    // two is the pair the collar was approved with
    expect(STRIPES.two).toEqual([
      [4.5, 7.9],
      [10.7, 14.1],
    ]);
  });

  it("lie on the panel, running over the shoulder at the top and cut off by the V near the point", () => {
    for (const count of ["one", "two", "three"] as const) {
      for (const { side, panel, edge, shoulder } of SIDES) {
        const ring = fine([...panel.ring, panel.ring[0]]);
        for (const [near, far] of panelStripes(panel, STRIPES[count]).edges) {
          for (const p of [...near, ...far]) {
            expect(insideRing(panel.ring, p) || distanceTo(ring, p) < 0.1, `${count} ${side} ${p}`).toBe(true);
          }
          for (const run of [near, far]) {
            expect(distanceTo(fine(shoulder), run[0]), `${count} ${side} top`).toBeLessThan(0.6);
            expect(distanceTo(fine(edge), run.at(-1)!), `${count} ${side} foot`).toBeLessThan(0.6);
            // long: most of the way down the panel
            expect(length(run) * CM, `${count} ${side}`).toBeGreaterThan(9);
          }
        }
      }
    }
  });
});

describe("choosing the stripes", () => {
  const dress = garmentById("female-dress")!;
  const linen = fabricById("fb-apricot-linen")!;
  const sewn = (collar = "female-sailor-collar") => {
    let worn = wear([], cutFrom(dress, linen.id));
    worn = setNeckline(worn, dress.id, "female-v-neckline");
    return setCollar(worn, dress.id, collar);
  };
  const one = (worn: WornGarment[]) => worn.find((w) => w.garmentId === dress.id)!;

  it("are offered on the sailor collar — none, one, two or three — plain by default", () => {
    for (const id of ["female-peter-pan-collar", "female-shirt-collar", "female-mandarin-collar"]) {
      expect(collarById(id)?.takesStripes, id).toBeUndefined();
    }
    expect(collarById("female-sailor-collar")?.takesStripes).toBe(true);
    expect(stripesFor(dress.stripes).map((t) => t.id)).toEqual(["none", "one", "two", "three"]);
    expect(collarOf(one(sewn()))?.id).toBe("female-sailor-collar");
    expect(stripesOf(one(sewn()))).toBe("none");
    expect(regionsOf(dress, one(sewn()))).not.toContain("trim");
  });

  it("put the stripes in a cloth of their own, a region of the garment, and take them off again", () => {
    const black = fabricById("fb-black-crepe")!;
    const on = one(setStripes(sewn(), dress.id, "two", black.id));
    expect(stripesOf(on)).toBe("two");
    expect(regionsOf(dress, on)).toContain("trim");
    expect(on.fabrics.trim).toBe(black.id);
    expect(on.fabrics.collar).toBe(linen.id);
    // a new count keeps the cloth already chosen for them
    const again = one(setStripes([on], dress.id, "three", "fb-rose-silk"));
    expect(stripesOf(again)).toBe("three");
    expect(again.fabrics.trim).toBe(black.id);
    const off = one(setStripes([on], dress.id, "none"));
    expect(stripesOf(off)).toBe("none");
    expect(regionsOf(dress, off)).not.toContain("trim");
    expect(off.fabrics.trim).toBeUndefined();
  });

  it("go from the collar with it — to the neckline beneath, at the neck — and from the neck under a collar that takes none", () => {
    const on = setStripes(sewn(), dress.id, "two", "fb-black-crepe");
    // taken off: the V's own neckline takes the braid at the neck, in the same cloth
    const bare = one(setCollar(on, dress.id, undefined));
    expect([stripesOf(bare), stripesOnOf(bare), bare.fabrics.trim]).toEqual(["two", ["neckline"], "fb-black-crepe"]);
    // a collar the V cannot take is no collar at all: its neckline keeps the braid
    expect(stripesOnOf(one(setCollar(on, dress.id, "female-peter-pan-collar")))).toEqual(["neckline"]);
    // cut round — which takes the sailor off — and a Peter Pan sewn over the neckline: nothing at the neck, none drawn, no cloth asked for
    const pp = one(setCollar(setNeckline(on, dress.id, "female-round-neckline"), dress.id, "female-peter-pan-collar"));
    expect(stripesOnOf(pp)).toEqual([]);
    expect(regionsOf(dress, pp)).not.toContain("trim");
  });

  it("arrive in the plain cloth that stands out most against the collar's: white on dark cloth", () => {
    const L = (f: Fabric) => hexToLab(fabricAverageColor(f))[0];
    for (const cloth of fabrics) {
      const stripes = contrastingPlain(cloth);
      expect(stripes.id, cloth.id).not.toBe(cloth.id);
      expect(stripes.source === "procedural" && stripes.motif, cloth.id).toBe("solid");
      // at least 30 L* apart: they show
      expect(Math.abs(L(stripes) - L(cloth)), cloth.id).toBeGreaterThan(30);
    }
    expect(contrastingPlain(fabricById("fb-apricot-linen")!).id).toBe("fb-black-crepe");
    // white on every dark cloth, as on a navy sailor collar
    const dark = fabrics.filter((f) => L(f) < 50);
    expect(dark.map((f) => f.id)).toEqual(expect.arrayContaining(["fb-midnight-floral", "fb-black-crepe", "fb-emerald-velvet"]));
    for (const f of dark) expect(contrastingPlain(f).id, f.id).toBe("fb-white");
  });

  it("are drawn on the collar, in their own cloth, only when they are on", () => {
    const draw = (count?: "one" | "two" | "three") => {
      const stripes = fabricById("fb-black-crepe")!;
      let worn = sewn();
      if (count) worn = setStripes(worn, dress.id, count, stripes.id);
      const regions: Partial<Record<FabricRegionId, Fabric>> = {};
      for (const r of regionsOf(dress, one(worn))) regions[r] = r === "trim" ? stripes : linen;
      const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
      return renderToStaticMarkup(<MannequinStage outfit={outfit} fabrics={{ [dress.id]: regions }} zoom={4} focus={[300, 222]} />);
    };
    expect(draw()).not.toContain("female-sailor-collar-inlay-pattern");
    for (const count of ["one", "two", "three"] as const) {
      const markup = draw(count);
      expect(markup, count).toContain("female-sailor-collar-inlay-pattern");
      // every stripe on both panels, each its own piece
      for (const panel of [panels.left, panels.right]) {
        for (const d of panelStripes(panel, STRIPES[count]).paths) expect(markup, count).toContain(`d="${d}"`);
      }
    }
  });
});
