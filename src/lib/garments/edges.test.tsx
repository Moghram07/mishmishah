import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MannequinStage } from "@/components/visualizer/MannequinStage";
import { garmentById } from "@/lib/data/garments";
import { fabricById } from "@/lib/data/fabrics";
import { DEFAULT_SKIN_TONE } from "@/lib/data/skinTones";
import { necklinesForGarment } from "@/lib/data/necklines";
import { sleeveCuffsFor, sleeveLengthsFor, sleeveTypesFor } from "@/lib/data/sleeves";
import { skirtLengthsFor, skirtShapesFor, waistsFor } from "@/lib/data/skirts";
import { buttonsFor } from "@/lib/data/closures";
import { DRESS_EDGE_SPECS, DRESS_POINT_SPEC, NECK_CENTRE, bodiceFor, dressEdges, dressPoints } from "./art/female/dressCut";
import { TIE_AT, panelStripes, sailor, sailorEdges } from "./art/female/collarCuts";
import { tieAt } from "./art/female/ties";
import { NECKLINE_TIED, neckLandmarks } from "./necklines";
import { NECKLINE_EDGED, NECKLINE_IDS } from "./necklines";
import { BAND_STRIPE_ROOM, STRIPES, fittedBands, insideRings, ringsOf, stripesAlong } from "./stripes";
import type { Edge, EdgeOffer } from "./edges";
import {
  choiceOf,
  collarsFitting,
  cutFrom,
  necklineOf,
  regionsOf,
  setButtons,
  setCollar,
  setNeckline,
  setSkirt,
  setSleeve,
  setTie,
  wear,
} from "./outfit";
import type { Fabric, FabricRegionId, Outfit, SleeveTypeId, WornGarment } from "@/types";
import type { Pt } from "./fit";

const dress = garmentById("female-dress")!;
const offer: EdgeOffer = { sleeves: dress.sleeves!, skirt: { ...dress.skirt!, waists: dress.skirt!.waists ?? ["natural"] }, buttons: dress.buttons!.offered };
const kinds = (edges: Edge[]) => edges.map((e) => `${e.kind}${e.side === undefined ? "" : e.side}`);

/** The farthest any point of one set of rows lies from the matching row of the other — infinite if they differ in number. */
function rowsApart(a: { d: string }[], b: { d: string }[]): number {
  if (a.length !== b.length) return Infinity;
  const toLine = (p: Pt, q: Pt[]) =>
    Math.min(
      ...q.map((x, i) => {
        const y = q[(i + 1) % q.length];
        const [dx, dy] = [y[0] - x[0], y[1] - x[1]];
        const t = Math.max(0, Math.min(1, ((p[0] - x[0]) * dx + (p[1] - x[1]) * dy) / (dx * dx + dy * dy || 1e-9)));
        return Math.hypot(p[0] - x[0] - t * dx, p[1] - x[1] - t * dy);
      })
    );
  let m = 0;
  a.forEach((row, i) => {
    const [p, q] = [ringsOf(row.d)[0] ?? [], ringsOf(b[i].d)[0] ?? []];
    for (const x of p) m = Math.max(m, toLine(x, q));
    for (const x of q) m = Math.max(m, toLine(x, p));
  });
  return m;
}

/** A seeded random number in [0, 1): the same outfits every run. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("a point on a piece of cloth", () => {
  /* the even-odd rule, every side of every ring: what `insideRings` answers by its rows */
  const everySide = (rings: Pt[][], [x, y]: Pt) => {
    let hit = false;
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
      }
    }
    return hit;
  };

  it("is answered by its row exactly as by every side — on a bodice, a skirt, a band and a collar panel", () => {
    const b = bodiceFor("boat", { type: "puff", length: "short" });
    const pieces = [...b.pieces, ...dressEdges({ neckline: "v", skirt: { shape: "tiered", length: "maxi", waist: "natural" } }).flatMap((e) => e.pieces.map((p) => p.d)), sailor().left.path];
    const next = rng(7);
    let tried = 0;
    for (const d of pieces) {
      const rings = ringsOf(d);
      const pts = rings.flat();
      const xs = pts.map(([x]) => x);
      const ys = pts.map(([, y]) => y);
      const [x0, x1, y0, y1] = [Math.min(...xs) - 5, Math.max(...xs) + 5, Math.min(...ys) - 5, Math.max(...ys) + 5];
      for (let k = 0; k < 400; k++) {
        const p: Pt = [x0 + next() * (x1 - x0), y0 + next() * (y1 - y0)];
        expect(insideRings(rings, p), `${p}`).toBe(everySide(rings, p));
        tried++;
      }
      /* and on its own corners and sides, where a row's edge falls */
      for (const p of pts.slice(0, 200)) expect(insideRings(rings, p)).toBe(everySide(rings, p));
    }
    expect(tried).toBeGreaterThan(3000);
  });

  it("reads each outline once, and the same each time", () => {
    const d = sailor().right.path;
    expect(ringsOf(d)).toBe(ringsOf(d));
    expect(ringsOf(d)[0].length).toBeGreaterThan(50);
  });
});

describe("the dress's edges", () => {
  it("are its neckline's, with no collar over it, its sleeves' hems and its skirt's", () => {
    expect(kinds(dressEdges({ neckline: "v" }))).toEqual(["neckline", "sleeve0", "sleeve1", "hem"]);
    expect(kinds(dressEdges({ neckline: "boat" }))).toEqual(["neckline", "sleeve0", "sleeve1", "hem"]);
    expect(kinds(dressEdges({ neckline: "boat", opening: "round" }))).toEqual(["sleeve0", "sleeve1", "hem"]);
    // no sleeve, no sleeve edge; a halter's neckline is its two armholes up to the band
    expect(kinds(dressEdges({ neckline: "boat", sleeve: { type: "set-in", length: "sleeveless" } }))).toEqual(["neckline", "hem"]);
    expect(kinds(dressEdges({ neckline: "halter" }))).toEqual(["neckline0", "neckline1", "hem"]);
    // every cut has its neckline drafted but the cowl, whose drape is its own trimming
    expect(NECKLINE_EDGED).toEqual(NECKLINE_IDS.filter((c) => c !== "cowl"));
    for (const cut of NECKLINE_IDS) expect(kinds(dressEdges({ neckline: cut })).some((k) => k.startsWith("neckline")), cut).toBe(cut !== "cowl");
  });

  it("are each built again from what they declare, and each declared shape is listed", () => {
    for (const spec of DRESS_EDGE_SPECS) {
      const keys = spec.every(offer);
      expect(keys.length, spec.kind).toBeGreaterThan(10);
      for (const key of keys) {
        const choice = spec.choiceFor(key);
        /* the round trip: a declared shape, made into a choice, declares itself */
        expect(spec.shapedBy(choice), `${spec.kind} ${JSON.stringify(key)}`).toEqual(key);
        expect(dressEdges(choice).filter((e) => e.kind === spec.kind).length, `${spec.kind} ${JSON.stringify(key)}`).toBeGreaterThan(0);
      }
    }
    expect(DRESS_POINT_SPEC.every().every((k) => JSON.stringify(DRESS_POINT_SPEC.shapedBy(DRESS_POINT_SPEC.choiceFor(k))) === JSON.stringify(k))).toBe(true);
  }, 120_000);

  it("are shaped by nothing they do not declare, on dresses made in the panel's own way", () => {
    const linen = fabricById("fb-apricot-linen")!;
    const next = rng(18);
    const pick = <T,>(list: readonly T[]): T => list[Math.floor(next() * list.length)];
    const one = (worn: WornGarment[]) => worn.find((w) => w.garmentId === dress.id)!;
    let compared = 0;
    for (let n = 0; n < 40; n++) {
      /* each choice the panel would offer, as the panel offers it */
      let worn = setNeckline(wear([], cutFrom(dress, linen.id)), dress.id, pick(necklinesForGarment(dress)).id);
      const neckline = necklineOf(one(worn));
      const types = sleeveTypesFor(dress, neckline);
      const type: SleeveTypeId = types.length ? pick(types) : "set-in";
      const length = pick(sleeveLengthsFor(type, neckline, dress));
      const cuffs = sleeveCuffsFor(dress, { type, length });
      worn = setSleeve(worn, dress.id, { type, length, ...(cuffs.length ? { cuff: pick(cuffs) } : {}) });
      const shape = pick(skirtShapesFor(dress)).id;
      worn = setSkirt(worn, dress.id, { shape, length: pick(skirtLengthsFor(dress, shape)).id, waist: pick(waistsFor(dress)).id });
      const buttons = buttonsFor(dress, neckline?.cut, shape);
      if (buttons.length) worn = setButtons(worn, dress.id, pick(buttons).id);
      const collars = collarsFitting(dress, one(worn));
      if (collars.length && next() < 0.5) worn = setCollar(worn, dress.id, pick(collars).id);
      const choice = choiceOf(one(worn));
      const full = dressEdges(choice);
      for (const spec of DRESS_EDGE_SPECS) {
        const mine = full.filter((e) => e.kind === spec.kind);
        const declared = dressEdges(spec.choiceFor(spec.shapedBy(choice))).filter((e) => e.kind === spec.kind);
        const what = `${spec.kind} of ${JSON.stringify(choice)}`;
        expect(declared.length, what).toBe(mine.length);
        mine.forEach((e, i) => {
          expect(declared[i].line, what).toEqual(e.line);
          expect(declared[i].room, what).toBe(e.room);
          /* the same rows, to a tenth of a centimetre: where a row is cut to its cloth, the cut is found to a few hundredths */
          expect(rowsApart(stripesAlong(declared[i], STRIPES.three), stripesAlong(e, STRIPES.three)), what).toBeLessThan(0.5);
          compared++;
        });
      }
      expect(dressPoints(choice)).toEqual(dressPoints(DRESS_POINT_SPEC.choiceFor(DRESS_POINT_SPEC.shapedBy(choice))));
    }
    expect(compared).toBeGreaterThan(60);
  }, 120_000);

  it("fit stripes to a band narrower than they are deep, and leave them alone elsewhere", () => {
    const edge = (room?: number): Edge => ({ kind: "sleeve", line: [[0, 0], [10, 0]], pieces: [], lay: { by: "level", into: [0, -1], inset: 0 }, ...(room === undefined ? {} : { room }) });
    expect(fittedBands(edge(), STRIPES.three)).toBe(STRIPES.three);
    expect(fittedBands(edge(40), STRIPES.three)).toBe(STRIPES.three);
    const fitted = fittedBands(edge(10), STRIPES.three);
    // the last stripe ends the band's clear room short of its top
    expect(fitted[2][1]).toBeCloseTo(10 - BAND_STRIPE_ROOM, 6);
    expect(fitted[0][0]).toBeLessThan(STRIPES.three[0][0]);
  });
});

describe("the sailor collar's edges and the dress's points", () => {
  it("are the panels' free edges, laying the same stripes the panels did", () => {
    const edges = sailorEdges();
    expect(edges.map((e) => [e.kind, e.side, e.lay.by])).toEqual([
      ["collar", 0, "own"],
      ["collar", 1, "own"],
    ]);
    const { left, right } = sailor();
    for (const count of ["one", "two", "three"] as const) {
      expect(stripesAlong(edges[0], STRIPES[count]).map((s) => s.d)).toEqual(panelStripes(left, STRIPES[count]).paths);
      expect(stripesAlong(edges[1], STRIPES[count]).map((s) => s.d)).toEqual(panelStripes(right, STRIPES[count]).paths);
      expect(stripesAlong(edges[1], STRIPES[count]).every((s) => s.piece === 1)).toBe(true);
    }
  });

  it("set the tie at the V's neck point, and every neck point on its opening's own centre line", () => {
    expect(dressPoints({ neckline: "v" })).toEqual([{ kind: "neck", at: TIE_AT, down: [0, 1] }]);
    for (const { cut, waist } of DRESS_POINT_SPEC.every({ sleeves: { types: [] }, skirt: { shapes: [], lengths: [], waists: ["empire", "natural", "dropped"] }, buttons: [] })) {
      const choice = DRESS_POINT_SPEC.choiceFor({ cut, waist });
      // the bodice as drawn with a tie at its neck: no collar on it, bare — see `CutSpec.bare`
      const outline = ringsOf(bodiceFor(cut, undefined, choice.skirt?.waist, "none", false, false, true).pieces[0]);
      for (const p of dressPoints(choice)) {
        /* the opening's own middle, a little above the point: halfway between its two edges there — a wrap's mirrored about a line that leans */
        const top = bodiceFor(cut, undefined, "natural", "none", false, false, true).cut.parts?.neck[1] ?? p.at[1] - 12;
        const y = p.at[1] - Math.max(1, Math.min(6, (p.at[1] - top) / 2));
        const xs = outline.flatMap((ring) => ring.flatMap((a, i) => {
          const b = ring[(i + 1) % ring.length];
          return (a[1] - y) * (b[1] - y) < 0 ? [a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1])] : [];
        })).sort((a, b) => a - b);
        const right = xs.findIndex((x) => x > p.at[0]);
        expect(right, cut).toBeGreaterThan(0);
        expect(Math.abs(p.at[0] - (xs[right - 1] + xs[right]) / 2), `${cut} ${waist ?? ""}`).toBeLessThan(0.5);
      }
    }
    // every cut a tie can be knotted at the neck of has the point, and no other
    for (const { cut } of DRESS_POINT_SPEC.every()) expect(dressPoints({ neckline: cut }).length, cut).toBe(NECKLINE_TIED.includes(cut) ? 1 : 0);
    // a round neck's at its lowest, on her throat's centre — the axis of her neck's landmarks, the crew is cut about
    expect(dressPoints({ neckline: "round" })[0].at[0]).toBeCloseTo(neckLandmarks("female").axis, 6);
  });
});

describe("where parts touch", () => {
  it("draws a necktie over the buttons down the front", () => {
    const linen = fabricById("fb-apricot-linen")!;
    let worn = setNeckline(wear([], cutFrom(dress, linen.id)), dress.id, "female-v-neckline");
    worn = setButtons(worn, dress.id, "waist");
    worn = setCollar(worn, dress.id, "female-sailor-collar");
    worn = setTie(worn, dress.id, "necktie");
    const w = worn.find((x) => x.garmentId === dress.id)!;
    const regions: Partial<Record<FabricRegionId, Fabric>> = {};
    for (const r of regionsOf(dress, w)) regions[r] = linen;
    const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
    const markup = renderToStaticMarkup(<MannequinStage outfit={outfit} fabrics={{ [dress.id]: regions }} zoom={1} focus={[300, 500]} />);
    const lastButton = markup.lastIndexOf('fill="#2b211b"');
    const tie = markup.indexOf(`d="${tieAt("necktie", TIE_AT).pieces[0]}"`);
    expect(lastButton).toBeGreaterThan(0);
    expect(tie).toBeGreaterThan(lastButton);
  });
});

describe("a wrap's stripes", () => {
  it("run the top panel's whole edge, past the crossing to its waist, and the under panel's only to the crossing — at every waist", () => {
    for (const waist of ["empire", "natural", "dropped"] as const) {
      const choice = { neckline: "wrap", skirt: { shape: "flared", length: "midi", waist }, stripes: { count: "two", on: ["neckline"] } } as Parameters<typeof dressEdges>[0];
      // as drawn with no collar: bare — see `CutSpec.bare`
      const wrap = bodiceFor("wrap", undefined, waist, "none", false, false, true).cut.wrap!;
      const necks = dressEdges(choice).filter((e) => e.kind === "neckline");
      expect(necks, waist).toHaveLength(2);
      const ends = necks.map((e) => e.line[e.line.length - 1]);
      const near = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1;
      // the under panel's first, so the top one's lies over it; it stops where the two cross
      expect(near(ends[0], wrap.apex), `${waist}: under panel's to the crossing`).toBe(true);
      expect(near(ends[1], wrap.tie), `${waist}: top panel's to its waist`).toBe(true);
    }
  });
});
