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
import { TIE_AT, panelStripes, sailor, sailorEdges, sailorTie } from "./art/female/collarCuts";
import { NECKLINE_EDGED } from "./necklines";
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
  it("are its sleeves' hems and its skirt's — and a boat neckline's, with no collar over it", () => {
    expect(kinds(dressEdges({ neckline: "v" }))).toEqual(["sleeve0", "sleeve1", "hem"]);
    expect(kinds(dressEdges({ neckline: "boat" }))).toEqual(["neckline", "sleeve0", "sleeve1", "hem"]);
    expect(kinds(dressEdges({ neckline: "boat", opening: "round" }))).toEqual(["sleeve0", "sleeve1", "hem"]);
    // no sleeve, no sleeve edge; a cut with none, none either
    expect(kinds(dressEdges({ neckline: "boat", sleeve: { type: "set-in", length: "sleeveless" } }))).toEqual(["neckline", "hem"]);
    expect(kinds(dressEdges({ neckline: "halter" }))).toEqual(["hem"]);
    // the neckline's only where it is drafted
    expect(NECKLINE_EDGED).toEqual(["boat"]);
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
          expect(stripesAlong(declared[i], STRIPES.three).map((s) => s.d), what).toEqual(stripesAlong(e, STRIPES.three).map((s) => s.d));
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
    for (const { cut } of DRESS_POINT_SPEC.every()) {
      const parts = bodiceFor(cut).cut.parts;
      const centre = parts ? (parts.neck[0] + parts.neckRight[0]) / 2 : NECK_CENTRE;
      for (const p of dressPoints({ neckline: cut })) expect(Math.abs(p.at[0] - centre), cut).toBeLessThan(0.5);
    }
    // a round neck's at its lowest, on her throat's centre
    expect(dressPoints({ neckline: "round" })[0].at[0]).toBeCloseTo(NECK_CENTRE, 6);
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
    const tie = markup.indexOf(`d="${sailorTie("necktie").pieces[0]}"`);
    expect(lastButton).toBeGreaterThan(0);
    expect(tie).toBeGreaterThan(lastButton);
  });
});
