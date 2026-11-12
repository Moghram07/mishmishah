import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MannequinStage } from "@/components/visualizer/MannequinStage";
import { FabricRegion } from "@/components/visualizer/FabricRegion";
import { STRIPE_COUNTS, collarById, stripeEdgesFor, stripesFor, tiesFor } from "@/lib/data/collars";
import { NECKLINE_IDS } from "./necklines";
import { fabricById } from "@/lib/data/fabrics";
import { garmentById } from "@/lib/data/garments";
import { DEFAULT_SKIN_TONE } from "@/lib/data/skinTones";
import { BODY_CANVAS } from "../mannequin/bodies";
import { bodiceFor, dressStripes, drawnBodice, skirtFor } from "./art/female/dressCut";
import { TIE_AT, sailorTie } from "./art/female/collarCuts";
import { SKIRT_SHAPES, shapeLengths, WAISTS } from "./skirts";
import { SLEEVE_KINDS } from "./sleeves";
import { STRIPES, clipTo, insideRings, ringsOf } from "./stripes";
import {
  collarOf,
  cutFrom,
  regionsOf,
  setButtons,
  setCollar,
  setNeckline,
  setSkirt,
  setSleeve,
  setStripes,
  setStripeEdges,
  setTie,
  stripeEdgesOf,
  choiceOf,
  stripesOf,
  stripesOnOf,
  toggleStripeEdge,
  tieOf,
  wear,
} from "./outfit";
import type { GarmentChoice } from "./art";
import type { Pt } from "./fit";
import type { Fabric, FabricRegionId, Outfit, SkirtChoice, SleeveChoice, StripeEdgeId, WornGarment } from "@/types";

/**
 * Round 16: more sailor styles, from the user's photographs — stripes
 * «بدون · شريط · شريطان · ثلاثة شرائط», how far they go «الياقة · الياقة
 * والأكمام · الياقة والأكمام والذيل», a tie at the V «بدون · عقدة · ربطة عنق»,
 * and a boat neckline's own stripes, with no collar. Each on every sleeve,
 * length and shape the dress offers.
 */

const CM = BODY_CANVAS.cmPerUnit;
const COUNTS = ["one", "two", "three"] as const;
const n = { one: 1, two: 2, three: 3 } as const;
/** A stripe's points: its outline as drawn, straight runs only. */
const pointsOf = (d: string): Pt[] => {
  const v = (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);
  const out: Pt[] = [];
  for (let i = 0; i + 1 < v.length; i += 2) out.push([v[i], v[i + 1]]);
  return out;
};
const fine = (pts: Pt[]): Pt[] =>
  pts.slice(1).flatMap((b, i) => {
    const a = pts[i];
    const k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 4));
    return Array.from({ length: k + 1 }, (_, j) => [a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k] as Pt);
  });
const distanceTo = (pts: Pt[], [x, y]: Pt) => Math.min(...pts.map(([a, b]) => Math.hypot(a - x, b - y)));
/** Every point of a stripe on the piece it lies on, or on its outline. */
const onPiece = (stripe: string, piece: string) => {
  const rings = ringsOf(piece);
  const edge = fine(rings.flat());
  return pointsOf(stripe).every((p) => insideRings(rings, p) || distanceTo(edge, p) < 0.15);
};

const V: GarmentChoice = { neckline: "v", opening: "v" };
/** How far the stripes went in round 16 — the collar alone, the sleeves too, the hem too — as the edges toggled now. */
type Reach = "neck" | "sleeves" | "hem";
const reach = (first: StripeEdgeId, at: Reach): StripeEdgeId[] => (at === "neck" ? [first] : at === "sleeves" ? [first, "sleeves"] : [first, "sleeves", "hem"]);
const striped = (count: (typeof COUNTS)[number], at: Reach, more: GarmentChoice = {}): GarmentChoice => ({
  ...V,
  stripes: { count, on: reach("collar", at) },
  ...more,
});

/** Every sleeve the dress offers on its V, at every length, and a long one with each cuff. */
const SLEEVES: SleeveChoice[] = [
  ...(["set-in", "drop", "raglan", "kimono", "dolman", "puff", "bishop", "bell", "flutter", "cap"] as const).flatMap((type) =>
    SLEEVE_KINDS[type].lengths.map((length) => ({ type, length }))
  ),
  ...(["plain", "formal", "french"] as const).map((cuff) => ({ type: "set-in" as const, length: "long" as const, cuff })),
];
/** Every skirt the dress offers: each shape at its lengths at the natural waist, and each other waist. */
const SKIRTS: SkirtChoice[] = [
  ...SKIRT_SHAPES.flatMap((shape) => shapeLengths(shape, ["knee", "midi", "maxi"]).map((length) => ({ shape, length, waist: "natural" as const }))),
  ...WAISTS.filter((w) => w !== "natural").flatMap((waist) => SKIRT_SHAPES.map((shape) => ({ shape, length: "midi" as const, waist }))),
];

describe("stripes round each sleeve's hem", () => {
  it("go on every sleeve and length the dress offers on its V, both arms, the chosen count, on the cloth", () => {
    for (const sleeve of SLEEVES) {
      for (const count of COUNTS) {
        const choice = striped(count, "sleeves", { sleeve });
        const b = drawnBodice(choice);
        const { top } = dressStripes(choice);
        const name = `${sleeve.type} ${sleeve.length}${sleeve.cuff ? ` ${sleeve.cuff}` : ""} ${count}`;
        // each arm has at least the count, on its own side of her
        const left = top.filter((s) => pointsOf(s.d)[0][0] < 300);
        const right = top.filter((s) => pointsOf(s.d)[0][0] > 300);
        expect(left.length, name).toBeGreaterThanOrEqual(n[count]);
        expect(right.length, name).toBeGreaterThanOrEqual(n[count]);
        for (const s of top) expect(onPiece(s.d, b.pieces[s.piece]), `${name} piece ${s.piece}`).toBe(true);
      }
    }
  }, 120_000);

  it("lie on a sleeve's band or cuff, where it has one at its end, as braid round a cuff does", () => {
    const banded = SLEEVES.filter((sleeve) => (drawnBodice(striped("two", "sleeves", { sleeve })).sleeveCut?.bands.length ?? 0) > 0);
    expect(banded.length).toBeGreaterThanOrEqual(5);
    for (const sleeve of banded) {
      const choice = striped("two", "sleeves", { sleeve });
      const b = drawnBodice(choice);
      const bands = new Set(b.sleeveCut!.bands.map((d) => b.pieces.indexOf(d)));
      const on = dressStripes(choice).top.filter((st) => bands.has(st.piece));
      const name = `${sleeve.type} ${sleeve.length} ${sleeve.cuff ?? ""}`;
      expect(on.length, name).toBeGreaterThanOrEqual(2);
      for (const st of on) {
        const ys = pointsOf(st.d).map(([, y]) => y);
        const foot = Math.max(...ringsOf(b.pieces[st.piece]).flat().map(([, y]) => y));
        // a real stripe, not a hairline, set in from the band's foot and well down it
        expect((Math.max(...ys) - Math.min(...ys)) * CM, name).toBeGreaterThan(0.3);
        expect((foot - Math.max(...ys)) * CM, name).toBeGreaterThan(0.3);
        expect((foot - Math.max(...ys)) * CM, name).toBeLessThan(2.5);
      }
    }
  });

  it("lie near the hem: no stripe more than its distance in, and a few units of turn, from the sleeve's end", () => {
    for (const sleeve of SLEEVES.filter((s) => s.type !== "cap")) {
      const choice = striped("three", "sleeves", { sleeve });
      const k = drawnBodice(choice).sleeveCut!;
      /* the sleeve's end: its hem, and the outline of any band sewn on below it */
      const hem = [...fine(k.raw?.hem ?? k.left.cutOn!.hem), ...(k.bands[0] ? fine(ringsOf(k.bands[0])[0]) : [])];
      const far = STRIPES.three[2][1];
      for (const s of dressStripes(choice).top.filter((st) => pointsOf(st.d)[0][0] < 300)) {
        for (const p of pointsOf(s.d)) expect(distanceTo(hem, p), `${sleeve.type} ${sleeve.length} ${p}`).toBeLessThan(far + 4);
      }
    }
  });

  it("go on no sleeve that is not there, and nowhere on the sleeves while they stay on the collar", () => {
    for (const type of ["set-in", "cap", "kimono", "puff"] as const) {
      expect(dressStripes(striped("three", "sleeves", { sleeve: { type, length: "sleeveless" } })).top, type).toEqual([]);
    }
    expect(dressStripes(striped("three", "neck")).top).toEqual([]);
    expect(dressStripes(striped("three", "neck")).bottom).toEqual([]);
    expect(dressStripes(striped("three", "sleeves")).bottom).toEqual([]);
    // and with no stripes chosen, nothing
    expect(dressStripes(V)).toEqual({ top: [], bottom: [], belt: [] });
  });
});

describe("stripes round the skirt's hem", () => {
  it("go round every skirt the dress offers, at every length and waist, the chosen count, on the skirt", () => {
    for (const skirt of SKIRTS) {
      for (const count of COUNTS) {
        const choice = striped(count, "hem", { skirt });
        const { bottom } = dressStripes(choice);
        const name = `${skirt.shape} ${skirt.length} ${skirt.waist} ${count}`;
        const sk = skirtFor(undefined, skirt);
        expect(bottom.filter((s) => s.piece === 0).length, name).toBe(n[count]);
        for (const s of bottom) expect(onPiece(s.d, sk.path), name).toBe(true);
      }
    }
  }, 120_000);

  it("run level with the hem, each at its own height above it — over a wave, a pleat's step or a flare", () => {
    for (const skirt of SKIRTS) {
      const choice = striped("three", "hem", { skirt });
      const sk = skirtFor(undefined, skirt);
      const hem = fine(sk.hem);
      /* the hem's row at a column: where the hem passes beneath it — none at a pleat's step, where it has two */
      const hemAt = (x: number) => {
        const ys = hem.filter(([hx]) => Math.abs(hx - x) < 1.5).map(([, y]) => y);
        return ys.length && Math.max(...ys) - Math.min(...ys) < 1 ? ys[0] : null;
      };
      dressStripes(choice).bottom.forEach((s, i) => {
        const [near, far] = STRIPES.three[i];
        const pts = pointsOf(s.d);
        /* away from the sides, where a stripe meets the skirt's edge on a slant */
        const xs = pts.map(([x]) => x);
        const [x0, x1] = [Math.min(...xs) + 8, Math.max(...xs) - 8];
        for (const [x, y] of pts.filter(([px]) => px > x0 && px < x1)) {
          const row = hemAt(x);
          if (row === null) continue;
          const up = row - y;
          /* every stripe set in past the hem's turn: the first one starts 2–2.5 cm up, the last ends under 5 cm */
          expect(up - near, `${skirt.shape} ${skirt.length} ${i} at ${x}`).toBeGreaterThan(6.8);
          expect(up - far, `${skirt.shape} ${skirt.length} ${i} at ${x}`).toBeLessThan(9.2);
          expect(up * CM).toBeLessThan(5);
        }
        // nearly the width of the hem: right round it, as far as the front shows
        expect((Math.max(...xs) - Math.min(...xs)) / (sk.hem.at(-1)![0] - sk.hem[0][0]), `${skirt.shape} ${skirt.length}`).toBeGreaterThan(0.85);
      });
    }
  }, 120_000);

  it("run on across a placket buttoned to the hem, as across the skirt", () => {
    const choice = striped("two", "hem", { buttons: "hem" });
    const { bottom } = dressStripes(choice);
    expect(bottom.filter((s) => s.piece === 0)).toHaveLength(2);
    expect(bottom.filter((s) => s.piece === 1)).toHaveLength(2);
  });

  it("go on the sleeves as well when they go to the hem", () => {
    const { top, bottom } = dressStripes(striped("one", "hem"));
    expect(top.length).toBeGreaterThanOrEqual(2);
    expect(bottom.length).toBeGreaterThanOrEqual(1);
  });
});

describe("a stripe cut to its piece", () => {
  it("keeps to the part of the piece its middle lies on, never bridging a gap to another", () => {
    /* a U: two arms joined at the foot, a gap between them */
    const u = "M0 0 L10 0 L10 30 L30 30 L30 0 L40 0 L40 40 L0 40 Z";
    const guide: Pt[] = Array.from({ length: 41 }, (_, i) => [i - 0.5 + 0.5, 10] as Pt);
    const left = clipTo(ringsOf(u), guide, 5);
    expect(Math.min(...left.map(([x]) => x))).toBeCloseTo(0, 1);
    expect(Math.max(...left.map(([x]) => x))).toBeCloseTo(10, 1);
    const right = clipTo(ringsOf(u), guide, 35);
    expect(Math.min(...right.map(([x]) => x))).toBeCloseTo(30, 1);
    // its middle off the piece: nothing
    expect(clipTo(ringsOf(u), guide, 20)).toEqual([]);
  });
});

describe("a boat neckline's own stripes", () => {
  const boat = (count: (typeof COUNTS)[number], sleeve?: SleeveChoice, at: Reach = "neck"): GarmentChoice => ({
    neckline: "boat",
    stripes: { count, on: reach("neckline", at) },
    ...(sleeve ? { sleeve } : {}),
  });

  it("run along its edge and the shoulders either side, on the bodice, at their own distance in", () => {
    for (const sleeve of [undefined, { type: "set-in", length: "sleeveless" } as SleeveChoice, { type: "puff", length: "short" } as SleeveChoice]) {
      for (const count of COUNTS) {
        const choice = boat(count, sleeve);
        const b = drawnBodice(choice);
        const { top, bottom } = dressStripes(choice);
        const name = `${sleeve?.type ?? "default"} ${sleeve?.length ?? ""} ${count}`;
        expect(bottom, name).toEqual([]);
        expect(top.filter((s) => s.piece === 0), name).toHaveLength(n[count]);
        for (const s of top) expect(onPiece(s.d, b.pieces[s.piece]), name).toBe(true);
        /* across the bust: from shoulder to shoulder, the whole width of the neckline and more */
        for (const s of top) {
          const xs = pointsOf(s.d).map(([x]) => x);
          expect(Math.min(...xs), name).toBeLessThan(b.cut.neck!.center - b.cut.neck!.half - 10);
          expect(Math.max(...xs), name).toBeGreaterThan(b.cut.neck!.center + b.cut.neck!.half + 10);
        }
      }
    }
  });

  it("lie parallel to the neckline at the centre front: each stripe its own distance below it", () => {
    const choice = boat("three");
    const neck = drawnBodice(choice).cut.neck!;
    const bottomOfNeck = neck.seamY + neck.dip;
    dressStripes(choice).top.forEach((s, i) => {
      const [near, far] = STRIPES.three[i];
      const atCentre = pointsOf(s.d).filter(([x]) => Math.abs(x - neck.center) < 4).map(([, y]) => y - bottomOfNeck);
      expect(Math.min(...atCentre)).toBeCloseTo(near, 0);
      expect(Math.max(...atCentre)).toBeCloseTo(far, 0);
    });
  });

  it("go round the sleeves' hems and the skirt's as well, as far as asked, the neckline's kept", () => {
    const neckline = (choice: GarmentChoice) => dressStripes(choice).top.filter((st) => st.piece === 0);
    for (const sleeve of [undefined, { type: "puff", length: "short" } as SleeveChoice, { type: "set-in", length: "long", cuff: "plain" } as SleeveChoice]) {
      const name = `${sleeve?.type ?? "default"} ${sleeve?.length ?? ""}`;
      const alone = boat("three", sleeve);
      const b = drawnBodice(alone);
      for (const at of ["sleeves", "hem"] as const) {
        const choice = boat("three", sleeve, at);
        const { top, bottom } = dressStripes(choice);
        // the neckline's stripes as they were, and the sleeves' as on a sailor dress cut the same
        expect(neckline(choice), `${name} ${at}`).toEqual(neckline(alone));
        const onSleeves = top.filter((st) => st.piece !== 0);
        const sailor = dressStripes(striped("three", at, sleeve ? { sleeve } : {})).top;
        expect(onSleeves.length, `${name} ${at}`).toBeGreaterThanOrEqual(6);
        for (const st of onSleeves) expect(onPiece(st.d, b.pieces[st.piece]), `${name} ${at}`).toBe(true);
        expect(onSleeves.map((st) => st.d).sort(), `${name} ${at}`).toEqual(sailor.map((st) => st.d).sort());
        expect(bottom.length > 0, `${name} ${at}`).toBe(at === "hem");
      }
    }
    // sleeveless, only the neckline's: no armhole stripes
    const bare = boat("three", { type: "set-in", length: "sleeveless" }, "hem");
    expect(dressStripes(bare).top).toEqual(neckline(boat("three", { type: "set-in", length: "sleeveless" })));
    expect(dressStripes(bare).bottom.length).toBeGreaterThan(0);
  });
});

describe("choosing the stripes, the edges they go along, and the tie", () => {
  const dress = garmentById("female-dress")!;
  const linen = fabricById("fb-apricot-linen")!;
  const one = (worn: WornGarment[]) => worn.find((w) => w.garmentId === dress.id)!;
  const dressed = (neckline: string, collar?: string) => {
    let worn = setNeckline(wear([], cutFrom(dress, linen.id)), dress.id, `female-${neckline}-neckline`);
    if (collar) worn = setCollar(worn, dress.id, collar);
    return worn;
  };
  const sailor = () => dressed("v", "female-sailor-collar");

  it("offers the counts, the edges and the ties by the names asked for", () => {
    const c = collarById("female-sailor-collar");
    expect(stripesFor(dress.stripes).map((s) => s.name.ar)).toEqual(["بدون", "شريط", "شريطان", "ثلاثة شرائط"]);
    expect(stripesFor(dress.stripes).map((s) => s.id)).toEqual(STRIPE_COUNTS);
    expect(stripeEdgesFor(["collar", "neckline", "sleeves", "hem"]).map((s) => s.name.ar)).toEqual(["الياقة", "الرقبة", "الأكمام", "الذيل"]);
    expect(tiesFor(c).map((s) => s.name.ar)).toEqual(["بدون", "عقدة", "ربطة عنق"]);
    // the sailor's free edge takes them; no other collar's
    expect(c?.takesStripes).toBe(true);
    for (const id of ["female-peter-pan-collar", "female-shirt-collar", "female-bow-collar"]) {
      expect(collarById(id)?.takesStripes, id).toBeUndefined();
      expect(tiesFor(collarById(id)), id).toEqual([]);
    }
  });

  it("offers each edge the dress has as it is cut: the collar's, or the neckline's; the sleeves' and the hem", () => {
    expect(stripeEdgesOf(one(sailor()))).toEqual(["collar", "sleeves", "hem"]);
    expect(stripeEdgesOf(one(dressed("square")))).toEqual(["neckline", "sleeves", "hem"]);
    // a collar that takes none covers the neckline and offers nothing of its own
    expect(stripeEdgesOf(one(dressed("round", "female-peter-pan-collar")))).toEqual(["sleeves", "hem"]);
    // no sleeves, no sleeve edge
    expect(stripeEdgesOf(one(dressed("halter")))).toEqual(["neckline", "hem"]);
    expect(stripeEdgesOf(one(setSleeve(dressed("round"), dress.id, { type: "set-in", length: "sleeveless" })))).toEqual(["neckline", "hem"]);
    // every cut, with no collar, has a neckline edge to offer
    for (const cut of NECKLINE_IDS) {
      const w = one(setCollar(dressed(cut), dress.id, undefined));
      expect(stripeEdgesOf(w), cut).toContain("neckline");
    }
  });

  it("sews them along the neck first, then along each edge toggled, in one cloth and count", () => {
    let worn = setStripes(sailor(), dress.id, "three", "fb-white");
    expect(stripesOnOf(one(worn))).toEqual(["collar"]);
    worn = toggleStripeEdge(worn, dress.id, "hem");
    expect(stripesOnOf(one(worn))).toEqual(["collar", "hem"]);
    worn = toggleStripeEdge(worn, dress.id, "sleeves");
    expect(stripesOnOf(one(worn))).toEqual(["collar", "sleeves", "hem"]);
    expect(regionsOf(dress, one(worn)).filter((r) => r === "trim")).toHaveLength(1);
    worn = toggleStripeEdge(worn, dress.id, "collar");
    expect(stripesOnOf(one(worn))).toEqual(["sleeves", "hem"]);
    // every edge taken off: none drawn, no cloth for them
    worn = toggleStripeEdge(toggleStripeEdge(worn, dress.id, "sleeves"), dress.id, "hem");
    expect(stripesOnOf(one(worn))).toEqual([]);
    expect(regionsOf(dress, one(worn))).not.toContain("trim");
    expect(choiceOf(one(worn)).stripes).toBeUndefined();
    // and with nothing at the neck, the first edge it has
    expect(stripesOnOf(one(setStripes(dressed("round", "female-peter-pan-collar"), dress.id, "two", "fb-white")))).toEqual(["sleeves"]);
  });

  it("keeps them through a recut, along the edges it still has — at the neck again where all of them went", () => {
    // a sailor dress recut to a boat: its collar and tie go, its braid stays at the neck, with its cloth and its other edges
    let sailed = setStripeEdges(setStripes(sailor(), dress.id, "three", "fb-white"), dress.id, ["collar", "sleeves"]);
    sailed = setTie(sailed, dress.id, "knot");
    const recut = one(setNeckline(sailed, dress.id, "female-boat-neckline"));
    expect(collarOf(recut)).toBeUndefined();
    expect([stripesOf(recut), stripesOnOf(recut), recut.fabrics.trim]).toEqual(["three", ["neckline", "sleeves"], "fb-white"]);
    expect(tieOf(recut)).toBeUndefined();
    // only the collar's chosen: recut, along the neckline instead
    const neckOnly = one(setNeckline(setStripes(sailor(), dress.id, "two", "fb-white"), dress.id, "female-boat-neckline"));
    expect(stripesOnOf(neckOnly)).toEqual(["neckline"]);
    // and the other way: braid chosen along a neckline goes to a sailor collar sewn over it
    const onCollar = one(setCollar(setStripeEdges(setStripes(dressed("v"), dress.id, "two", "fb-white"), dress.id, ["neckline", "hem"]), dress.id, "female-sailor-collar"));
    expect(stripesOnOf(onCollar)).toEqual(["collar", "hem"]);
    // a Peter Pan over the neckline: the neckline's go, the count stays for the other edges
    const pp = one(setCollar(setStripeEdges(setStripes(dressed("boat"), dress.id, "two", "fb-white"), dress.id, ["neckline", "hem"]), dress.id, "female-peter-pan-collar"));
    expect([stripesOf(pp), stripesOnOf(pp)]).toEqual(["two", ["hem"]]);
  });

  it("ties a plain collar in its own cloth and a striped one in the stripes' cloth, keeps a tie cloth of its own, and unties", () => {
    // striped, the tie starts in the stripes' cloth, which shows on any print
    const striped = setTie(setStripes(sailor(), dress.id, "two", "fb-white"), dress.id, "knot");
    expect(one(striped).fabrics.tie).toBe("fb-white");
    expect(one(striped).fabrics.collar).toBe(linen.id);
    // cut from a cloth of its own, it keeps it from a knot to a necktie, stripes or no
    const own = striped.map((w) => (w.garmentId === dress.id ? { ...w, fabrics: { ...w.fabrics, tie: "fb-rose-silk" } } : w));
    expect(one(setTie(own, dress.id, "necktie")).fabrics.tie).toBe("fb-rose-silk");
    let worn = setTie(sailor(), dress.id, "knot");
    expect(tieOf(one(worn))).toBe("knot");
    expect(regionsOf(dress, one(worn))).toContain("tie");
    expect(one(worn).fabrics.tie).toBe(linen.id);
    // its own cloth, kept from a knot to a necktie
    worn = worn.map((w) => (w.garmentId === dress.id ? { ...w, fabrics: { ...w.fabrics, tie: "fb-rose-silk" } } : w));
    worn = setTie(worn, dress.id, "necktie");
    expect(one(worn).fabrics.tie).toBe("fb-rose-silk");
    const off = one(setTie(worn, dress.id, "none"));
    expect(tieOf(off)).toBe("none");
    expect(regionsOf(dress, off)).not.toContain("tie");
    expect(off.fabrics.tie).toBeUndefined();
  });

  it("takes the tie off with the collar, and moves its braid to the neckline beneath", () => {
    let worn = setTie(setStripes(sailor(), dress.id, "two", "fb-white"), dress.id, "necktie");
    worn = setStripeEdges(worn, dress.id, ["collar", "hem"]);
    const bare = one(setCollar(worn, dress.id, undefined));
    expect(bare.tie).toBeUndefined();
    expect(bare.fabrics.tie).toBeUndefined();
    // the collar's rows go to the neckline beneath; the hem keeps its own
    expect(stripesOnOf(bare)).toEqual(["neckline", "hem"]);
    expect(bare.fabrics.trim).toBe("fb-white");
    // the stripes taken off: their cloth and edges go
    const none = one(setStripes(worn, dress.id, "none"));
    for (const key of ["stripesOn"] as const) expect(none[key], key).toBeUndefined();
    expect(none.fabrics.trim).toBeUndefined();
  });
});

describe("the tie at the V", () => {
  const box = (pieces: string[]) => {
    const pts = pieces.flatMap(pointsOf);
    const xs = pts.map(([x]) => x);
    const ys = pts.map(([, y]) => y);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  };

  it("is knotted at the point of the V, over it, centred on it", () => {
    const apex = bodiceFor("v").cut.vee!.apex;
    expect(TIE_AT).toEqual(apex);
    for (const kind of ["knot", "necktie"] as const) {
      const { parts, pieces } = sailorTie(kind);
      const knot = ringsOf(parts.knot);
      expect(insideRings(knot, [apex[0], apex[1] + 0.5]), kind).toBe(true);
      // the knot right at the point: its top within a centimetre above it
      expect((apex[1] - box([parts.knot]).y0) * CM, kind).toBeLessThan(1);
      expect(box([parts.knot]).y0, kind).toBeLessThan(apex[1]);
      const b = box(pieces);
      expect(Math.abs((b.x0 + b.x1) / 2 - apex[0]), kind).toBeLessThan(0.3);
      // the knot drawn last, over everything else
      expect(pieces.at(-1), kind).toBe(parts.knot);
    }
  });

  it("as a knot, is a small bow: loops either side, short tails falling below, under 8 × 7 cm", () => {
    const { parts, pieces } = sailorTie("knot");
    const b = box(pieces);
    expect((b.x1 - b.x0) * CM).toBeLessThan(8);
    expect((b.x1 - b.x0) * CM).toBeGreaterThan(5);
    expect((b.y1 - b.y0) * CM).toBeLessThan(7);
    expect(parts.loops).toHaveLength(2);
    expect(parts.tails).toHaveLength(2);
    // the loops out to either side, the tails below the knot
    const [l, r] = parts.loops!.map((d) => box([d]));
    expect(l.x1).toBeLessThan(TIE_AT[0]);
    expect(r.x0).toBeGreaterThan(TIE_AT[0]);
    for (const t of parts.tails!) expect(box([t]).y1).toBeGreaterThan(box([parts.knot]).y1 + 15);
  });

  it("as a necktie, hangs down the centre to a point 10–15 cm below the V, 4–7 cm wide", () => {
    const { parts } = sailorTie("necktie");
    const blade = box([parts.blade!]);
    expect((blade.y1 - TIE_AT[1]) * CM).toBeGreaterThan(10);
    expect((blade.y1 - TIE_AT[1]) * CM).toBeLessThan(15);
    expect((blade.x1 - blade.x0) * CM).toBeGreaterThan(4);
    expect((blade.x1 - blade.x0) * CM).toBeLessThan(7);
    // its lowest point is its pointed end, on the centre line
    const low = pointsOf(parts.blade!).reduce((a, p) => (p[1] > a[1] ? p : a));
    expect(Math.abs(low[0] - TIE_AT[0])).toBeLessThan(0.5);
  });
});

describe("drawn on the figure", () => {
  const dress = garmentById("female-dress")!;
  const linen = fabricById("fb-apricot-linen")!;
  const white = fabricById("fb-white")!;
  const draw = (worn: WornGarment[], tieCloth?: Fabric) => {
    const w = worn.find((x) => x.garmentId === dress.id)!;
    const regions: Partial<Record<FabricRegionId, Fabric>> = {};
    for (const r of regionsOf(dress, w)) regions[r] = r === "trim" ? white : r === "tie" ? tieCloth ?? linen : linen;
    const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
    return renderToStaticMarkup(<MannequinStage outfit={outfit} fabrics={{ [dress.id]: regions }} zoom={1} focus={[300, 500]} />);
  };
  const base = () => setCollar(setNeckline(wear([], cutFrom(dress, linen.id)), dress.id, "female-v-neckline"), dress.id, "female-sailor-collar");

  it("draws the stripes in their cloth on the collar, the sleeves and the skirt, as far as they go", () => {
    const at = (to: Reach) => draw(setStripeEdges(setStripes(base(), dress.id, "two", white.id), dress.id, reach("collar", to)));
    const has = (markup: string, region: string) => markup.includes(`female-dress-${region}-inlay-pattern`);
    const collar = at("neck");
    expect(has(collar, "female-sailor-collar")).toBe(true);
    expect(has(collar, "top")).toBe(false);
    expect(has(collar, "bottom")).toBe(false);
    const sleeves = at("sleeves");
    expect(has(sleeves, "top")).toBe(true);
    expect(has(sleeves, "bottom")).toBe(false);
    const hem = at("hem");
    expect(has(hem, "top")).toBe(true);
    expect(has(hem, "bottom")).toBe(true);
    // with none chosen, none drawn anywhere
    expect(draw(base())).not.toContain("inlay-pattern");
  });

  it("draws a boat neckline's stripes on the bodice", () => {
    let worn = setNeckline(wear([], cutFrom(dress, linen.id)), dress.id, "female-boat-neckline");
    worn = setStripes(worn, dress.id, "three", white.id);
    const markup = draw(worn);
    expect(markup).toContain("female-dress-top-inlay-pattern");
    const choice: GarmentChoice = { neckline: "boat", stripes: { count: "three", on: ["neckline"] } };
    for (const s of dressStripes(choice).top) expect(markup).toContain(`d="${s.d}"`);
    expect(markup).not.toContain("female-dress-bottom-inlay-pattern");
    // as far as the hem: the skirt's too, and the sleeves' drawn
    const hem = draw(setStripeEdges(worn, dress.id, ["neckline", "sleeves", "hem"]));
    expect(hem).toContain("female-dress-bottom-inlay-pattern");
    for (const s of dressStripes({ ...choice, stripes: { ...choice.stripes!, on: ["neckline", "sleeves", "hem"] } }).top) expect(hem).toContain(`d="${s.d}"`);
  });

  it("draws the tie over the collar in its own cloth, the knot or the necktie as chosen", () => {
    const silk = fabricById("fb-rose-silk")!;
    for (const kind of ["knot", "necktie"] as const) {
      const markup = draw(setTie(base(), dress.id, kind), silk);
      expect(markup, kind).toContain("female-dress-female-sailor-collar-tie-pattern");
      for (const d of sailorTie(kind).pieces) expect(markup, kind).toContain(`d="${d}"`);
      // after the collar
      expect(markup.indexOf("female-sailor-collar-tie-pattern"), kind).toBeGreaterThan(markup.indexOf("female-dress-female-sailor-collar-pattern"));
    }
    expect(draw(base())).not.toContain("tie-pattern");
  });

  it("puts every stripe of a piece in the piece's own light: after its cloth, before its form", () => {
    const markup = renderToStaticMarkup(
      <svg>
        <FabricRegion
          uidBase="t"
          drawing={{
            shape: (fill) => <path d="M100 100 L200 100 L200 200 L100 200 Z" fill={fill} />,
            surface: { blur: 6, relief: 2 },
            inlay: [{ piece: 0, d: "M100 180 L200 180 L200 186 L100 186 Z" }],
          }}
          fabric={fabricById("fb-midnight-floral")!}
          inlayFabric={white}
          cmPerUnit={CM}
          pxPerUnit={1}
          direction={0}
          pivot={[300, 500]}
          canvas={[600, 1000]}
          stitch="tonal"
        />
      </svg>
    );
    const cloth = markup.indexOf(`fill="url(#t-pattern)"`);
    const stripe = markup.indexOf(`d="M100 180 L200 180 L200 186 L100 186 Z"`);
    const form = markup.indexOf(`filter="url(#t-surface)"`);
    expect(cloth).toBeGreaterThan(0);
    expect(stripe).toBeGreaterThan(cloth);
    expect(form).toBeGreaterThan(stripe);
    expect(markup).toContain(`id="t-inlay-pattern"`);
    // no cloth for them, no stripes
    const without = renderToStaticMarkup(
      <svg>
        <FabricRegion
          uidBase="t"
          drawing={{ shape: (fill) => <path d="M100 100 L200 100 L200 200 L100 200 Z" fill={fill} />, inlay: [{ piece: 0, d: "M100 180 L200 180 L200 186 L100 186 Z" }] }}
          fabric={fabricById("fb-midnight-floral")!}
          cmPerUnit={CM}
          pxPerUnit={1}
          direction={0}
          pivot={[300, 500]}
          canvas={[600, 1000]}
          stitch="tonal"
        />
      </svg>
    );
    expect(without).not.toContain("M100 180 L200 180");
  });

  it("works with every sleeve and skirt the dress offers, stripes to the hem and a necktie on", () => {
    for (const sleeve of SLEEVES) {
      let worn = setSleeve(base(), dress.id, sleeve);
      worn = setStripeEdges(setStripes(worn, dress.id, "three", white.id), dress.id, ["collar", "sleeves", "hem"]);
      worn = setTie(worn, dress.id, "necktie");
      const markup = draw(worn);
      expect(markup, `${sleeve.type} ${sleeve.length}`).toContain("female-dress-top-inlay-pattern");
      expect(markup, `${sleeve.type} ${sleeve.length}`).toContain("female-dress-bottom-inlay-pattern");
    }
    for (const skirt of SKIRTS.slice(0, 21)) {
      let worn = setSkirt(base(), dress.id, skirt);
      worn = setButtons(worn, dress.id, "hem");
      worn = setStripeEdges(setStripes(worn, dress.id, "one", white.id), dress.id, ["collar", "sleeves", "hem"]);
      expect(draw(worn), `${skirt.shape} ${skirt.length}`).toContain("female-dress-bottom-inlay-pattern");
    }
  }, 120_000);
});
