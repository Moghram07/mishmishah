import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MannequinStage } from "@/components/visualizer/MannequinStage";
import { garmentById } from "@/lib/data/garments";
import { fabricById } from "@/lib/data/fabrics";
import { DEFAULT_SKIN_TONE } from "@/lib/data/skinTones";
import { collarById } from "@/lib/data/collars";
import { SLEEVE_KINDS, type SleeveChoice } from "./sleeves";
import { bodiceFor, seamAt, skirtTopAt } from "./art/female/dressCut";
import {
  ARMHOLE_CLEAR,
  COLLAR_CLOTH,
  SAILOR_BAND,
  SAILOR_CUTS,
  SAILOR_WIDTH,
  panelEdge,
  sailor,
  sailorEdges,
  sailorOn,
  type SailorPiece,
} from "./art/female/collarCuts";
import { sailorCollarFront } from "./art/female/collars/sailor";
import { STRIPES, cornersOf, densify, extend, fittedBands, insideRings, ringsOf, stripeSides, stripesAlong } from "./stripes";
import { choiceOf, collarOf, cutFrom, regionsOf, setCollar, setNeckline, setSleeve, setStripeEdges, setStripes, setTie, tieOf, wear } from "./outfit";
import type { Fabric, FabricRegionId, Outfit, WaistId, WornGarment } from "@/types";
import type { Pt } from "./fit";

const dress = garmentById("female-dress")!;
const SAILOR = "female-sailor-collar";
const linen = fabricById("fb-apricot-linen")!;
const one = (worn: WornGarment[]) => worn.find((w) => w.garmentId === dress.id)!;
const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** The distance from a point to a polyline. */
const toLine = (q: Pt, line: Pt[]) => {
  let m = Infinity;
  for (let i = 1; i < line.length; i++) {
    const [a, b] = [line[i - 1], line[i]];
    const ab: Pt = [b[0] - a[0], b[1] - a[1]];
    const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * ab[0] + (q[1] - a[1]) * ab[1]) / (ab[0] * ab[0] + ab[1] * ab[1] || 1)));
    m = Math.min(m, dist(q, [a[0] + ab[0] * t, a[1] + ab[1] * t]));
  }
  return m;
};
const toRing = (q: Pt, ring: Pt[]) => toLine(q, [...ring, ring[0]]);
/** Her shoulder points, where a set-in sleeve is sewn. */
const SHOULDER = { left: bodiceFor("round").cut.parts!.strapLeft.at(-1)!, right: bodiceFor("round").cut.parts!.strapRight[0] };
/**
 * The armholes beside the collar with a sleeve, from the shoulder down to the
 * underarm: the seam a set-in or dropped sleeve is sewn along, or the edge a
 * cap leaves round the arm; with none, or a raglan, a set-in sleeve's.
 */
const armholesWith = (sleeve?: SleeveChoice): { left: Pt[]; right: Pt[] } => {
  const own = sleeve && sleeve.length !== "sleeveless" && sleeve.type !== "raglan" ? sleeve : ({ type: "set-in", length: "short" } as SleeveChoice);
  const k = bodiceFor("round", own).sleeveCut!;
  if (k.seamed) return { left: ringsOf(k.seamed.seams[0])[0], right: ringsOf(k.seamed.seams[1])[0] };
  const left = k.left.armhole[0][1] <= k.left.armhole.at(-1)![1] ? k.left.armhole : [...k.left.armhole].reverse();
  return { left, right: left.map(([x, y]) => [600 - x, y] as Pt) };
};
const armholeAt = (armhole: Pt[], y: number) => {
  for (let i = 1; i < armhole.length; i++) {
    const [a, b] = [armhole[i - 1], armhole[i]];
    if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) return a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]);
  }
  return null;
};
const AROUND = ["boat", "round", "square", "scoop"] as const;
const CAP: SleeveChoice = { type: "cap", length: "short" };
const DROP: SleeveChoice = { type: "drop", length: "short" };

/** The dress cut to `cut`, the sailor collar on it, each region in its own cloth — drawn. */
const dressed = (cut: string, more: (w: WornGarment[]) => WornGarment[] = (w) => w) =>
  more(setCollar(setNeckline(wear([], cutFrom(dress, linen.id)), dress.id, `female-${cut}-neckline`), dress.id, SAILOR));
const draw = (worn: WornGarment[], cloths: Partial<Record<FabricRegionId, Fabric>> = {}) => {
  const regions: Partial<Record<FabricRegionId, Fabric>> = {};
  for (const r of regionsOf(dress, one(worn))) regions[r] = cloths[r] ?? linen;
  const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
  return renderToStaticMarkup(<MannequinStage outfit={outfit} fabrics={{ [dress.id]: regions }} zoom={1} focus={[300, 500]} />);
};

describe("the sailor collar on every neckline it follows", () => {
  it("goes on the V, the boat, the wrap, the round, the square and the scoop, and stays on through a recut among them, its tie with it", () => {
    expect(collarById(SAILOR)!.necklines).toEqual([...SAILOR_CUTS]);
    let worn = setTie(dressed("v"), dress.id, "knot");
    expect(tieOf(one(worn))).toBe("knot");
    for (const cut of ["boat", "wrap", "round", "square", "scoop"]) {
      worn = setNeckline(worn, dress.id, `female-${cut}-neckline`);
      expect(collarOf(one(worn))?.id, cut).toBe(SAILOR);
      // its tie stays, knotted at the new cut's centre front, over the collar — see `tiePlacesOf`
      expect(tieOf(one(worn)), cut).toBe("knot");
      expect(regionsOf(dress, one(worn)), cut).toContain("tie");
    }
    // and off a cut it does not follow
    expect(collarOf(one(setNeckline(worn, dress.id, "female-high-neckline")))).toBeUndefined();
  });

  it("leaves the V exactly as approved", () => {
    const { left, right } = sailor();
    /* as drawn: its kind, side, line and pieces — the guide is a function, rebuilt each time */
    const shape = (edges: ReturnType<typeof sailorEdges>) => edges.map(({ kind, side, line, pieces, lay, room }) => ({ kind, side, line, pieces, by: lay.by, room }));
    expect(shape(sailorEdges("v"))).toEqual(shape([panelEdge(left, 0), panelEdge(right, 1)]));
    expect(shape(sailorEdges())).toEqual(shape(sailorEdges("v")));
    const lay = sailorEdges("v")[0].lay;
    for (const d of [4, 10]) expect(lay.by === "own" ? lay.inFrom(d) : null).toEqual(left.inFrom(d));
    expect(COLLAR_CLOTH["female-sailor-collar-front"]("v")).toEqual([left.path, right.path]);
    expect(COLLAR_CLOTH["female-sailor-collar-front"](undefined)).toEqual([left.path, right.path]);
    // the very drawing it was, plain and with every sleeve
    const plain = sailorCollarFront.regions.collar;
    expect(sailorCollarFront.cut!({ neckline: "v" }).collar).toBe(plain);
    expect(sailorCollarFront.cut!({ neckline: "v", sleeve: CAP }).collar).toBe(plain);
  });

  it("lies round a boat, a round neck, a square and a scoop: its inner edge the seam, 7.6 cm wide round the boat and 5.3 round the others, its ends on the shoulders, inside the armholes, mirrored", () => {
    for (const cut of AROUND) {
      for (const sleeve of [undefined, CAP, DROP, { type: "set-in", length: "sleeveless" } as SleeveChoice]) {
        const tag = `${cut} ${sleeve?.type ?? ""} ${sleeve?.length ?? ""}`;
        const pieces = sailorOn(cut, "natural", sleeve);
        expect(pieces, tag).toHaveLength(1);
        const [p] = pieces;
        const c = bodiceFor(cut, sleeve).cut;
        // sewn to the seam the whole way round, as the bodice is cut with this sleeve
        const seam = ringsOf(c.seam)[0];
        expect(Math.max(...seam.map((q) => toRing(q, p.ring))), tag).toBeLessThan(0.6);
        // as wide as it is meant to be at centre front, square off the seam's lowest point
        const low = seam.reduce((a, b) => (b[1] > a[1] ? b : a));
        const below = Math.min(...p.outer.filter(([x]) => Math.abs(x - low[0]) < 1).map(([, y]) => y));
        expect(below - low[1], tag).toBeGreaterThan(SAILOR_WIDTH[cut] - 1);
        expect(below - low[1], tag).toBeLessThan(SAILOR_WIDTH[cut] + 1);
        /* in centimetres, as asked: round the boat 7–8, as photo 1's; round the others 5–5.5 */
        const cm = (below - low[1]) * 0.19;
        if (cut === "boat") expect(cm, tag).toBeGreaterThan(7);
        if (cut === "boat") expect(cm, tag).toBeLessThan(8);
        if (cut !== "boat") expect(Math.abs(cm - 5.3), tag).toBeLessThan(0.3);
        // its ends on her shoulders, 1.6 cm short of each shoulder point — never out on a cap or a dropped shoulder's arm
        const [first, last] = [p.outer[0], p.outer[p.outer.length - 1]];
        expect(toLine(first, c.parts!.strapLeft), tag).toBeLessThan(0.5);
        expect(toLine(last, c.parts!.strapRight), tag).toBeLessThan(0.5);
        for (const [end, point] of [[first, SHOULDER.left], [last, SHOULDER.right]] as const) {
          expect(dist(end, point), tag).toBeGreaterThan(7.5);
          expect(dist(end, point), tag).toBeLessThan(10);
        }
        // and every point of its free edge a centimetre inside the armholes beside it
        const ARMHOLE = armholesWith(sleeve);
        for (const [x, y] of p.outer) {
          const side = x < 300 ? ARMHOLE.left : ARMHOLE.right;
          const at = armholeAt(side, y);
          if (at === null) continue;
          const clear = x < 300 ? x - at : at - x;
          expect(clear, `${tag} at ${x.toFixed(0)},${y.toFixed(0)}`).toBeGreaterThan(ARMHOLE_CLEAR - 0.5);
        }
        // mirrored about the opening's own centre, within her throat's offset
        const centre = (c.parts!.neck[0] + c.parts!.neckRight[0]) / 2;
        const far = Math.max(...p.outer.map(([x, y]) => toLine([2 * centre - x, y], p.outer)));
        expect(far, tag).toBeLessThan(2 * Math.abs(300 - 297.05) + 1.5);
      }
    }
  });

  it("is cut to the bodice as drawn: a cap or a dropped shoulder opens a boat and a square wider, and the collar follows; the same bodice, the same collar", () => {
    for (const cut of ["boat", "square"] as const) {
      expect(sailorOn(cut, "natural", CAP)).not.toBe(sailorOn(cut));
      expect(sailorOn(cut, "natural", DROP)).not.toBe(sailorOn(cut));
      for (const same of [{ type: "set-in", length: "long" }, { type: "set-in", length: "sleeveless" }, { type: "raglan", length: "short" }, { type: "kimono", length: "short" }] as SleeveChoice[])
        expect(sailorOn(cut, "natural", same), same.type).toBe(sailorOn(cut));
    }
    // the drawing asks for the collar as the bodice is cut
    const capped = sailorCollarFront.cut!({ neckline: "boat", sleeve: CAP }).collar!;
    expect(renderToStaticMarkup(<svg>{capped.shape("#000")}</svg>)).toContain(sailorOn("boat", "natural", CAP)[0].path);
    expect(COLLAR_CLOTH["female-sailor-collar-front"]("boat", CAP)).toEqual([sailorOn("boat", "natural", CAP)[0].path]);
  });

  it("runs down a wrap as two bands, the top one over the under one's end and on down its edge to the tie, at every waist", () => {
    for (const waist of ["empire", "natural", "dropped"] as WaistId[]) {
      const c = bodiceFor("wrap", undefined, waist).cut;
      const { edge, over, apex } = c.wrap!;
      const [under, top] = sailorOn("wrap", waist) as [SailorPiece, SailorPiece];
      // back to front: the under band first, on her left; the top band on her right, over it
      expect([under.side, top.side], waist).toEqual([1, 0]);
      // each band 5.3 cm wide along its edge of the V, halfway down
      for (const [band, line] of [[top, c.wrap!.edge.filter(([, y]) => y < apex[1])], [under, ringsOf(c.seam)[0].filter(([x, y]) => x > apex[0] + 2 && y < apex[1])]] as const) {
        const mid = line[Math.floor(line.length / 2)];
        expect(Math.min(...band.outer.map((o) => dist(o, mid))), waist).toBeGreaterThan(SAILOR_BAND - 1.5);
        expect(Math.min(...band.outer.map((o) => dist(o, mid))), waist).toBeLessThan(SAILOR_BAND + 1.5);
      }
      // the under band shows down to the top panel's edge, and goes under it there
      const end = under.ring.filter((q) => q[1] > apex[1] + 1);
      expect(end.length, waist).toBeGreaterThan(0);
      expect(Math.max(...end.map((q) => Math.min(toLine(q, over), toLine(q, under.outer)))), waist).toBeLessThan(0.6);
      // the top band lies along the edge past it: just to its side of that edge, all the way the under band's end runs, is the top band
      const goesUnder = end.filter((q) => toLine(q, over) < 0.6);
      for (const q of goesUnder) {
        const i = over.reduce((b, p, k) => (dist(p, q) < dist(over[b], q) ? k : b), 0);
        const u = [over[Math.min(i + 1, over.length - 1)][0] - over[Math.max(i - 1, 0)][0], over[Math.min(i + 1, over.length - 1)][1] - over[Math.max(i - 1, 0)][1]];
        const l = Math.hypot(u[0], u[1]);
        /* the top band's side: the left of its edge as it runs down */
        const into: Pt = [q[0] - (u[1] / l) * 1.5, q[1] + (u[0] / l) * 1.5];
        expect(insideRings([top.ring], into), `${waist} beside ${q.map((v) => v.toFixed(1))}`).toBe(true);
      }
      // and runs on down the edge, its full width, to where it goes into the waist seam under the skirt's top — level there, by the tie
      const level = skirtTopAt(waist);
      expect(level, waist).toBe(seamAt(waist) - 8);
      const foot = top.ring.filter((q) => Math.abs(q[1] - level) < 0.01);
      expect(foot.length, waist).toBeGreaterThanOrEqual(2);
      expect(Math.max(...top.ring.map(([, y]) => y)), waist).toBeLessThanOrEqual(level + 0.01);
      const [x0, x1] = [Math.min(...foot.map(([x]) => x)), Math.max(...foot.map(([x]) => x))];
      expect(toLine([x1, level], edge), waist).toBeLessThan(0.5);
      // as wide across the seam as a band its width laid down that slope is, and right beside the tie
      expect(x1 - x0, waist).toBeGreaterThan(SAILOR_BAND);
      expect(Math.abs(x1 - c.wrap!.tie[0]), waist).toBeLessThan(15);
      // its width the same the whole way down from the crossing
      const lower = edge.filter(([, y]) => y > apex[1] + 10 && y < level - 20);
      expect(lower.length, waist).toBeGreaterThan(3);
      for (const q of lower) {
        const d = Math.min(...top.outer.map((o) => dist(o, q)));
        expect(d, `${waist} at ${q.map((v) => v.toFixed(0))}`).toBeGreaterThan(SAILOR_BAND - 1.5);
        expect(d, `${waist} at ${q.map((v) => v.toFixed(0))}`).toBeLessThan(SAILOR_BAND + 1.5);
      }
    }
  });

  it("has outer edges that turn only where they are cut to: none round a boat, a round neck or a scoop, or down a wrap above its foot, the square's two lower corners — and, over a cap, where it follows the cap's edge into the side seam", () => {
    for (const cut of ["boat", "wrap", "round", "square", "scoop"] as const)
      for (const waist of (cut === "wrap" ? ["empire", "natural", "dropped"] : ["natural"]) as WaistId[])
        for (const sleeve of [undefined, CAP, DROP])
          for (const e of sailorEdges(cut, waist, sleeve)) {
            /* the line its stripes are laid from, run on past its ends — where a corner would mitre every row */
            /* a wrap's top band turns once more at its foot, where it goes level into the waist seam: its line taken above it */
            const line = cut === "wrap" && e.side === 0 ? e.line.filter(([, y]) => y < skirtTopAt(waist) - 4) : e.line;
            const turns = cornersOf(extend(densify(line, 1), 30));
            expect(turns.length, `${cut} ${waist} ${sleeve?.type ?? ""} side ${e.side ?? "-"}`).toBe(cut !== "square" ? 0 : sleeve === CAP ? 4 : 2);
          }
  });

  it("takes its stripes along its outer edge on every cut — fitted finer round the square's narrow corners, never cut off", () => {
    for (const cut of ["boat", "wrap", "round", "square", "scoop"] as const) {
      for (const count of ["one", "two", "three"] as const) {
        for (const e of sailorEdges(cut)) {
          const sides = stripeSides(e, STRIPES[count]);
          expect(new Set(sides.map((s) => s.stripe)).size, `${cut} ${count}`).toBe(STRIPES[count].length);
          // each the length of the edge's middle at least, deeper ones further in
          const along = e.line.slice(1).reduce((s, p, i) => s + dist(p, e.line[i]), 0);
          for (const s of sides) {
            const run = s.near.slice(1).reduce((t, p, i) => t + dist(p, s.near[i]), 0);
            expect(run, `${cut} ${count} stripe ${s.stripe}`).toBeGreaterThan(0.6 * along);
          }
        }
      }
    }
    // round the square, its corners leave it 2.5 cm deep: rows drawn finer to pass them
    const [sq] = sailorEdges("square");
    expect(sq.room).toBeGreaterThan(12);
    expect(sq.room).toBeLessThan(SAILOR_BAND);
    expect(fittedBands(sq, STRIPES.three).at(-1)![1]).toBeLessThanOrEqual(sq.room! - 1.4);
    for (const s of stripeSides(sq, STRIPES.three)) {
      // every row runs round both corners, shoulder to shoulder: its two ends either side of the opening
      expect(s.near[0][0], `stripe ${s.stripe}`).toBeLessThan(240);
      expect(s.near[s.near.length - 1][0], `stripe ${s.stripe}`).toBeGreaterThan(358);
    }
    // round the boat and the round neck, as they are
    for (const cut of ["boat", "round", "scoop"] as const) expect(fittedBands(sailorEdges(cut)[0], STRIPES.three)).toEqual(STRIPES.three);
  });

  it("is drawn on the figure on each cut, striped as chosen, in its own cloth", () => {
    const white = fabricById("fb-white")!;
    const red = fabricById("fb-red")!;
    for (const cut of ["boat", "wrap", "round", "square", "scoop"] as const) {
      const worn = dressed(cut, (w) => setStripeEdges(setStripes(w, dress.id, "two", red.id), dress.id, ["collar"]));
      expect(choiceOf(one(worn)).stripes, cut).toEqual({ count: "two", on: ["collar"] });
      const html = draw(worn, { collar: white, trim: red });
      for (const p of sailorOn(cut)) expect(html, cut).toContain(p.path);
      // its stripes, on its pieces
      const stripes = sailorEdges(cut).flatMap((e) => stripesAlong(e, STRIPES.two));
      expect(stripes.length, cut).toBeGreaterThanOrEqual(2);
      for (const st of stripes) expect(html, cut).toContain(st.d);
    }
    // with a sleeve that changes nothing at the neck, the same drawing
    const plain = draw(dressed("round"));
    expect(draw(dressed("round", (w) => setSleeve(w, dress.id, { type: "set-in", length: "long" })))).toContain(sailorOn("round")[0].path);
    expect(plain).toContain(sailorOn("round")[0].path);
    // and every sleeve on every cut it follows draws without error
    for (const cut of ["boat", "wrap", "round", "square", "scoop"] as const)
      for (const type of dress.sleeves!.types.filter((t) => SLEEVE_KINDS[t].construction !== "band"))
        expect(() => draw(dressed(cut, (w) => setSleeve(w, dress.id, { type, length: SLEEVE_KINDS[type].lengths[0] }))), `${cut} ${type}`).not.toThrow();
  }, 60_000);
});
