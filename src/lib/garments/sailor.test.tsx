import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SAILOR_STRIPES, insideRing, sailor, type SailorPanel } from "./art/female/collarCuts";
import { bodiceFor } from "./art/female/dressCut";
import { collarOf, cutFrom, regionsOf, setCollar, setNeckline, setTrim, trimOf, wear } from "./outfit";
import { BODY_CANVAS } from "../mannequin/bodies";
import { MannequinStage } from "@/components/visualizer/MannequinStage";
import { collarById, trimsFor } from "@/lib/data/collars";
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

describe("its trim", () => {
  it("is two thin stripes on each panel, parallel to its outer edge", () => {
    for (const { side, panel } of SIDES) {
      expect(panel.stripes, side).toHaveLength(2);
      expect(panel.stripeEdges, side).toHaveLength(2);
      const outer = fine(panel.outer);
      panel.stripeEdges.forEach(([near, far], i) => {
        const [from, to] = SAILOR_STRIPES[i];
        // every point of each long edge at its own distance in from the outer edge
        for (const p of near.slice(1, -1)) expect(distanceTo(outer, p), `${side} ${i} near ${p}`).toBeCloseTo(from, 0);
        for (const p of far.slice(1, -1)) expect(distanceTo(outer, p), `${side} ${i} far ${p}`).toBeCloseTo(to, 0);
        // thin: 0.5–0.8 cm wide, the first set in from the edge
        expect((to - from) * CM).toBeGreaterThan(0.5);
        expect((to - from) * CM).toBeLessThan(0.8);
      });
      expect(SAILOR_STRIPES[0][0] * CM).toBeGreaterThan(0.6);
    }
  });

  it("lies on the panel, running over the shoulder at the top and cut off by the V near the point", () => {
    for (const { side, panel, edge, shoulder } of SIDES) {
      const ring = fine([...panel.ring, panel.ring[0]]);
      for (const [near, far] of panel.stripeEdges) {
        for (const p of [...near, ...far]) {
          expect(insideRing(panel.ring, p) || distanceTo(ring, p) < 0.1, `${side} ${p}`).toBe(true);
        }
        for (const run of [near, far]) {
          expect(distanceTo(fine(shoulder), run[0]), `${side} top`).toBeLessThan(0.6);
          expect(distanceTo(fine(edge), run.at(-1)!), `${side} foot`).toBeLessThan(0.6);
          // long: most of the way down the panel
          expect(length(run) * CM, side).toBeGreaterThan(10);
        }
      }
    }
  });
});

describe("choosing the trim", () => {
  const dress = garmentById("female-dress")!;
  const linen = fabricById("fb-apricot-linen")!;
  const sewn = (collar = "female-sailor-collar") => {
    let worn = wear([], cutFrom(dress, linen.id));
    worn = setNeckline(worn, dress.id, "female-v-neckline");
    return setCollar(worn, dress.id, collar);
  };
  const one = (worn: WornGarment[]) => worn.find((w) => w.garmentId === dress.id)!;

  it("is offered on the sailor collar only, plain by default", () => {
    for (const id of ["female-peter-pan-collar", "female-shirt-collar", "female-mandarin-collar"]) {
      expect(trimsFor(collarById(id)), id).toEqual([]);
    }
    expect(trimsFor(collarById("female-sailor-collar")).map((t) => t.id)).toEqual(["none", "stripes"]);
    expect(collarOf(one(sewn()))?.id).toBe("female-sailor-collar");
    expect(trimOf(one(sewn()))).toBe("none");
    expect(regionsOf(dress, one(sewn()))).not.toContain("trim");
  });

  it("puts the stripes in a cloth of their own, a region of the garment, and takes them off again", () => {
    const black = fabricById("fb-black-crepe")!;
    const on = one(setTrim(sewn(), dress.id, "stripes", black.id));
    expect(trimOf(on)).toBe("stripes");
    expect(regionsOf(dress, on)).toContain("trim");
    expect(on.fabrics.trim).toBe(black.id);
    expect(on.fabrics.collar).toBe(linen.id);
    // a cloth already chosen for them is kept
    const again = one(setTrim([on], dress.id, "stripes", "fb-rose-silk"));
    expect(again.fabrics.trim).toBe(black.id);
    const off = one(setTrim([on], dress.id, "none"));
    expect(trimOf(off)).toBe("none");
    expect(regionsOf(dress, off)).not.toContain("trim");
    expect(off.fabrics.trim).toBeUndefined();
  });

  it("comes off with the collar, or when the collar changes to one that takes none", () => {
    const on = setTrim(sewn(), dress.id, "stripes", "fb-black-crepe");
    const bare = one(setCollar(on, dress.id, undefined));
    expect(bare.trim).toBeUndefined();
    expect(bare.fabrics.trim).toBeUndefined();
    // changed straight to a collar that takes no trim
    const swapped = one(setCollar(on, dress.id, "female-peter-pan-collar"));
    expect(swapped.trim).toBeUndefined();
    expect(swapped.fabrics.trim).toBeUndefined();
    // and as the panel does it: the V offers the sailor alone, so cut it round — which takes the collar off — and sew a Peter Pan on
    const round = setNeckline(on, dress.id, "female-round-neckline");
    const pp = one(setCollar(round, dress.id, "female-peter-pan-collar"));
    expect(pp.trim).toBeUndefined();
    expect(pp.fabrics.trim).toBeUndefined();
    expect(trimOf(pp)).toBeUndefined();
  });

  it("arrives in the plain cloth that stands out most against the collar's: white on dark cloth", () => {
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

  it("is drawn on the figure only when it is on", () => {
    const draw = (trimmed: boolean) => {
      const stripes = fabricById("fb-black-crepe")!;
      let worn = sewn();
      if (trimmed) worn = setTrim(worn, dress.id, "stripes", stripes.id);
      const regions: Partial<Record<FabricRegionId, Fabric>> = {};
      for (const r of regionsOf(dress, one(worn))) regions[r] = r === "trim" ? stripes : linen;
      const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
      return renderToStaticMarkup(<MannequinStage outfit={outfit} fabrics={{ [dress.id]: regions }} zoom={4} focus={[300, 222]} />);
    };
    const plain = draw(false);
    const trimmed = draw(true);
    expect(plain).not.toContain("female-sailor-collar-trim-pattern");
    expect(trimmed).toContain("female-sailor-collar-trim-pattern");
    // all four stripes, each its own piece
    const stripeD = [...panels.left.stripes, ...panels.right.stripes];
    for (const d of stripeD) expect(trimmed).toContain(`d="${d}"`);
  });
});
