import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MannequinStage } from "@/components/visualizer/MannequinStage";
import { garmentById } from "@/lib/data/garments";
import { fabricById } from "@/lib/data/fabrics";
import { DEFAULT_SKIN_TONE } from "@/lib/data/skinTones";
import { necklinesForGarment } from "@/lib/data/necklines";
import { sleeveLengthsFor, sleeveTypesFor } from "@/lib/data/sleeves";
import { bodiceFor, dressEdges, dressStripes } from "./art/female/dressCut";
import { NECKLINE_IDS, NECKLINE_SLEEVES } from "./necklines";
import { STRIPES, densify, insideRings, ringsOf, stripeSides, type StripeSides } from "./stripes";
import { choiceOf, collarsFitting, cutFrom, necklineOf, regionsOf, setCollar, setNeckline, setSleeve, setStripeEdges, setStripes, stripeEdgesOf, wear } from "./outfit";
import type { Edge } from "./edges";
import type { Fabric, FabricRegionId, Outfit, StripeEdgeId, WornGarment } from "@/types";
import type { GarmentChoice } from "./art";
import type { Pt } from "./fit";

const dress = garmentById("female-dress")!;
const TOGGLE: Record<Edge["kind"], StripeEdgeId> = { neckline: "neckline", sleeve: "sleeves", hem: "hem", collar: "collar", belt: "belt" };
const lengthOf = (pts: Pt[]) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
/** A point inside a row: between its two sides at its middle. */
const inRow = (r: StripeSides): Pt => {
  const a = r.near[Math.floor(r.near.length / 2)];
  const b = r.far.reduce((best, q) => (Math.hypot(q[0] - a[0], q[1] - a[1]) < Math.hypot(best[0] - a[0], best[1] - a[1]) ? q : best), r.far[0]);
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
};

describe("stripes on any edge", () => {
  it("offer, on every dress the panel can make, exactly the edges the drawing has", () => {
    const linen = fabricById("fb-apricot-linen")!;
    const one = (worn: WornGarment[]) => worn.find((w) => w.garmentId === dress.id)!;
    let tried = 0;
    for (const n of necklinesForGarment(dress)) {
      let worn = setNeckline(wear([], cutFrom(dress, linen.id)), dress.id, n.id);
      const types = sleeveTypesFor(dress, necklineOf(one(worn)));
      for (const type of types.length ? types : (["set-in"] as const)) {
        for (const length of types.length ? sleeveLengthsFor(type, necklineOf(one(worn)), dress) : (["short"] as const)) {
          if (types.length) worn = setSleeve(worn, dress.id, { type, length });
          for (const collar of [undefined, ...collarsFitting(dress, one(worn)).map((c) => c.id)]) {
            const w = one(setCollar(worn, dress.id, collar));
            const drawn = new Set(dressEdges(choiceOf(w)).map((e) => TOGGLE[e.kind]));
            if (w.collarId && collar === "female-sailor-collar") drawn.add("collar");
            expect(new Set(stripeEdgesOf(w)), `${n.cut} ${type} ${length} ${collar ?? "no collar"}`).toEqual(drawn);
            tried++;
          }
        }
      }
    }
    expect(tried).toBeGreaterThan(200);
  }, 120_000);

  it("go along every cut's neckline: all three rows, on the cloth, the length of it", () => {
    for (const cut of NECKLINE_IDS) {
      const choice: GarmentChoice = { neckline: cut, stripes: { count: "three", on: ["neckline"] } };
      const edges = dressEdges(choice).filter((e) => e.kind === "neckline");
      expect(edges.length, cut).toBeGreaterThan(0);
      for (const e of edges) {
        const rows = stripeSides(e, STRIPES.three);
        for (let i = 0; i < 3; i++) {
          const mine = rows.filter((r) => r.stripe === i);
          expect(mine.length, `${cut} row ${i + 1}`).toBeGreaterThan(0);
          for (const r of mine) {
            const piece = e.pieces.find((p) => p.index === r.piece)!;
            expect(insideRings(ringsOf(piece.d), inRow(r)), `${cut} row ${i + 1} on its cloth`).toBe(true);
          }
        }
      }
      // and drawn on the bodice
      expect(dressStripes(choice).top.length, cut).toBeGreaterThan(0);
    }
  });

  it("turn a V's point and a square's corners in one row each, not broken at the corner", () => {
    for (const cut of ["v", "square"] as const) {
      const [e] = dressEdges({ neckline: cut }).filter((x) => x.kind === "neckline");
      const rows = stripeSides(e, STRIPES.three);
      // one run per row on the bodice: the row goes round the corner unbroken
      for (let i = 0; i < 3; i++) expect(rows.filter((r) => r.stripe === i && r.piece === 0).length, `${cut} row ${i + 1}`).toBe(1);
    }
    // a V's deepest row passes below its point, square to both sides: a chevron
    const vee = bodiceFor("v").cut.vee!;
    const [e] = dressEdges({ neckline: "v" }).filter((x) => x.kind === "neckline");
    const deepest = stripeSides(e, STRIPES.three).filter((r) => r.stripe === 2 && r.piece === 0)[0];
    const below = deepest.far.filter(([x]) => Math.abs(x - vee.apex[0]) < 1).map(([, y]) => y - vee.apex[1]);
    expect(Math.max(...below)).toBeGreaterThan(STRIPES.three[2][1]);
  });

  it("meet in a mitre where a cap sleeve's edge meets the neckline, on every cut that keeps both sleeves: no row over another", () => {
    for (const cut of NECKLINE_IDS.filter((c) => NECKLINE_SLEEVES[c] === "both")) {
      const choice: GarmentChoice = { neckline: cut, sleeve: { type: "cap", length: "short" }, stripes: { count: "three", on: ["neckline", "sleeves"] } };
      const edges = dressEdges(choice).filter((e) => e.kind === "neckline" || e.kind === "sleeve");
      expect(edges.filter((e) => e.meets).length, cut).toBeGreaterThan(0);
      const rows = edges.map((e) => stripeSides(e, STRIPES.three));
      for (let a = 0; a < edges.length; a++) {
        for (let b = 0; b < edges.length; b++) {
          if (a === b) continue;
          const theirs = rows[b].map((r) => [...r.near, ...[...r.far].reverse()]);
          for (const r of rows[a]) expect(theirs.some((ring) => insideRings([ring], inRow(r))), `${cut}: a ${edges[a].kind} row lies on a ${edges[b].kind} row`).toBe(false);
        }
      }
    }
  });

  it("are drawn finer to pass where the cloth between two edges narrows — the cap beside a square — and run on unbroken", () => {
    const narrow = dressEdges({ neckline: "square", sleeve: { type: "cap", length: "short" }, stripes: { count: "three", on: ["sleeves"] } });
    const cap = narrow.find((e) => e.kind === "sleeve" && e.side === 0)!;
    expect(cap.room).toBeDefined();
    expect(cap.room!).toBeLessThan(STRIPES.three[2][1]);
    const rows = stripeSides(cap, STRIPES.three);
    const along = lengthOf(cap.line);
    for (let i = 0; i < 3; i++) {
      const run = rows.filter((r) => r.stripe === i).reduce((s, r) => s + lengthOf(r.near), 0);
      expect(run / along, `row ${i + 1}`).toBeGreaterThan(0.6);
    }
    // on a round neck the cap has room: no fitting
    const wide = dressEdges({ neckline: "round", sleeve: { type: "cap", length: "short" }, stripes: { count: "three", on: ["sleeves"] } });
    expect(wide.find((e) => e.kind === "sleeve")!.room).toBeUndefined();
    // both striped on the square: they share it, each finer than either alone
    const both = dressEdges({ neckline: "square", sleeve: { type: "cap", length: "short" }, stripes: { count: "three", on: ["neckline", "sleeves"] } });
    expect(both.find((e) => e.kind === "sleeve" && e.side === 0)!.room!).toBeLessThan(cap.room!);
  });

  it("go up a halter's two armholes to its band, a mirrored pair", () => {
    const halves = dressEdges({ neckline: "halter" }).filter((e) => e.kind === "neckline");
    expect(halves.map((e) => e.side)).toEqual([0, 1]);
    const band = ringsOf(bodiceFor("halter").cut.extras[0]);
    for (const e of halves) expect(e.line.filter((p) => insideRings(band, p)).length).toBe(0);
    const [l, r] = halves.map((e) => e.line);
    const span = (pts: Pt[]) => [Math.min(...pts.map(([x]) => x)), Math.max(...pts.map(([x]) => x))];
    const [ll, lr] = span(l);
    const [rl, rr] = span(r);
    expect(Math.abs(300 - lr - (rl - 300))).toBeLessThan(7);
    expect(Math.abs(300 - ll - (rr - 300))).toBeLessThan(7);
  });

  it("are drawn on the figure along each edge toggled, and nowhere else", () => {
    const linen = fabricById("fb-apricot-linen")!;
    const white = fabricById("fb-white")!;
    const draw = (worn: WornGarment[]) => {
      const w = worn.find((x) => x.garmentId === dress.id)!;
      const regions: Partial<Record<FabricRegionId, Fabric>> = {};
      for (const r of regionsOf(dress, w)) regions[r] = r === "trim" ? white : linen;
      const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
      return renderToStaticMarkup(<MannequinStage outfit={outfit} fabrics={{ [dress.id]: regions }} zoom={1} focus={[300, 500]} />);
    };
    const base = setStripes(setNeckline(wear([], cutFrom(dress, linen.id)), dress.id, "female-square-neckline"), dress.id, "two", white.id);
    const has = (markup: string, region: string) => markup.includes(`female-dress-${region}-inlay-pattern`);
    // the neckline alone, first: on the bodice only
    const neck = draw(base);
    expect([has(neck, "top"), has(neck, "bottom")]).toEqual([true, false]);
    // the hem alone: on the skirt only
    const hem = draw(setStripeEdges(base, dress.id, ["hem"]));
    expect([has(hem, "top"), has(hem, "bottom")]).toEqual([false, true]);
    // every edge
    const all = draw(setStripeEdges(base, dress.id, ["neckline", "sleeves", "hem"]));
    expect([has(all, "top"), has(all, "bottom")]).toEqual([true, true]);
    for (const s of dressStripes({ neckline: "square", stripes: { count: "two", on: ["neckline", "sleeves", "hem"] } }).bottom) expect(all).toContain(`d="${s.d}"`);
  });
});

describe("braid along the neckline", () => {
  it("covers the neck edge's topstitch, as a collar does, and leaves it where the neckline is bare", () => {
    const linen = fabricById("fb-apricot-linen")!;
    const white = fabricById("fb-white")!;
    const cut = bodiceFor("square").cut;
    const neck = cut.neckStitch ?? cut.stitch;
    expect(neck.length).toBeGreaterThan(10);
    const draw = (edges: StripeEdgeId[]) => {
      let worn = setStripes(setNeckline(wear([], cutFrom(dress, linen.id)), dress.id, "female-square-neckline"), dress.id, "two", white.id);
      worn = setStripeEdges(worn, dress.id, edges);
      const w = worn.find((x) => x.garmentId === dress.id)!;
      const regions: Partial<Record<FabricRegionId, Fabric>> = {};
      for (const r of regionsOf(dress, w)) regions[r] = r === "trim" ? white : linen;
      const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
      /* close up: thread is drawn only from 2.5× — see `TONAL_THREAD` */
      return renderToStaticMarkup(<MannequinStage outfit={outfit} fabrics={{ [dress.id]: regions }} zoom={4} focus={[300, 230]} />);
    };
    const first = neck.split(" ").slice(0, 4).join(" ");
    expect(draw(["hem"])).toContain(first);
    expect(draw(["neckline", "hem"])).not.toContain(first);
  });
});

describe("rows along edges that meet", () => {
  it("never overlap anywhere along them — at a square's corner beside a cap sleeve too — on every cut that keeps both sleeves", () => {
    for (const cut of NECKLINE_IDS.filter((c) => NECKLINE_SLEEVES[c] === "both")) {
      for (const on of [["neckline", "sleeves"], ["neckline"], ["sleeves"]] as StripeEdgeId[][]) {
        const choice: GarmentChoice = { neckline: cut, sleeve: { type: "cap", length: "short" }, stripes: { count: "three", on } };
        const edges = dressEdges(choice).filter((e) => (e.kind === "neckline" && on.includes("neckline")) || (e.kind === "sleeve" && on.includes("sleeves")));
        const rows = edges.map((e) => stripeSides(e, STRIPES.three));
        for (let a = 0; a < edges.length; a++) {
          for (let b = 0; b < edges.length; b++) {
            if (a === b || edges[a].kind === edges[b].kind) continue;
            const theirs = rows[b].map((r) => [...r.near, ...[...r.far].reverse()]);
            /* every point along both sides of every row, a unit apart */
            const pts = rows[a].flatMap((r) => [...densify(r.near, 1), ...densify(r.far, 1)]);
            const over = pts.filter((p) => theirs.some((ring) => insideRings([ring], p))).length;
            expect(over, `${cut}, ${on.join(" + ")}: ${over} points of the ${edges[a].kind}'s rows on the ${edges[b].kind}'s`).toBeLessThan(4);
          }
        }
        // and every row on its own cloth: none past the edge it does not run along
        for (const [i, e] of edges.entries()) {
          for (const r of rows[i]) {
            const piece = e.pieces.find((p) => p.index === r.piece)!;
            expect(insideRings(ringsOf(piece.d), inRow(r)), `${cut} ${e.kind}`).toBe(true);
          }
        }
      }
    }
  }, 120_000);

  it("stay clear of the other edge where only one is striped: no row of the square's neckline past the cap's edge onto the arm", () => {
    const choice: GarmentChoice = { neckline: "square", sleeve: { type: "cap", length: "short" }, stripes: { count: "three", on: ["neckline"] } };
    const edges = dressEdges(choice);
    const neck = edges.find((e) => e.kind === "neckline")!;
    const cap = edges.find((e) => e.kind === "sleeve" && e.side === 0)!;
    const near = (p: Pt) =>
      Math.min(
        ...densify(cap.line, 0.5).map((q) => Math.hypot(p[0] - q[0], p[1] - q[1]))
      );
    /* the rows keep a little cloth between them and the cap's edge, away from the shoulder tip where the two edges meet */
    const tip = cap.line.reduce((best, q) => (Math.hypot(q[0] - neck.line[0][0], q[1] - neck.line[0][1]) < Math.hypot(best[0] - neck.line[0][0], best[1] - neck.line[0][1]) ? q : best), cap.line[0]);
    const pts = stripeSides(neck, STRIPES.three).flatMap((r) => densify(r.far, 1)).filter((p) => Math.hypot(p[0] - tip[0], p[1] - tip[1]) > 25);
    expect(Math.min(...pts.map(near))).toBeGreaterThan(0.5);
  });
});
