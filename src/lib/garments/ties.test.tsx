import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MannequinStage } from "@/components/visualizer/MannequinStage";
import { garmentById } from "@/lib/data/garments";
import { fabricById } from "@/lib/data/fabrics";
import { DEFAULT_SKIN_TONE } from "@/lib/data/skinTones";
import { tiePlacesFor, tiesFor } from "@/lib/data/collars";
import { NECKLINE_IDS, NECKLINE_TIED } from "./necklines";
import { BELT_SIDE_IN, beltFor, bodiceFor, dressPoints, skirtFor, tiePoint } from "./art/female/dressCut";
import { TIE_AT } from "./art/female/collarCuts";
import { SCARF, TIE_DROP, scarfFolds, tieAt, type TieStyle } from "./art/female/ties";
import { bodyById } from "@/lib/mannequin/bodies";
import { shapeLengths } from "./skirts";
import { insideRings, ringsOf } from "./stripes";
import { Buckle } from "./art/buckle";
import {
  choiceOf,
  clothOf,
  cutFrom,
  regionsOf,
  setBelt,
  setCollar,
  setNeckline,
  setStripeEdges,
  setStripes,
  setTie,
  setTieAt,
  tieAtOf,
  tieOf,
  tiePlacesOf,
  tiesOffered,
  wear,
} from "./outfit";
import type { Fabric, FabricRegionId, Outfit, WornGarment } from "@/types";
import type { Pt } from "./fit";

const dress = garmentById("female-dress")!;
const linen = fabricById("fb-apricot-linen")!;
const red = fabricById("fb-red")!;
const white = fabricById("fb-white")!;
const one = (worn: WornGarment[]) => worn.find((w) => w.garmentId === dress.id)!;
const dressed = (cut: string, collar?: string) => {
  const w = setNeckline(wear([], cutFrom(dress, linen.id)), dress.id, `female-${cut}-neckline`);
  return collar ? setCollar(w, dress.id, collar) : w;
};
const box = (paths: string[]) => {
  const pts = paths.flatMap((d) => ringsOf(d).flat());
  const xs = pts.map(([x]) => x);
  const ys = pts.map(([, y]) => y);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};
const draw = (worn: WornGarment[], cloths: Partial<Record<FabricRegionId, Fabric>> = {}) => {
  const regions: Partial<Record<FabricRegionId, Fabric>> = {};
  for (const r of regionsOf(dress, one(worn))) regions[r] = cloths[r] ?? fabricById(clothOf(one(worn), r) ?? one(worn).fabrics[r] ?? linen.id) ?? linen;
  const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
  return renderToStaticMarkup(<MannequinStage outfit={outfit} fabrics={{ [dress.id]: regions }} zoom={1} focus={[300, 500]} />);
};
const CM = 0.19;

describe("ties anywhere", () => {
  it("names the scarf «وشاح» and the places «عند الرقبة · الحزام من الأمام · الحزام من الجنب»", () => {
    expect(tiesFor(dress.ties!.offered).map((t) => t.name.ar)).toEqual(["بدون", "عقدة", "ربطة عنق", "وشاح"]);
    expect(tiePlacesFor(["neck", "belt-front", "belt-side"]).map((p) => p.name.ar)).toEqual(["عند الرقبة", "الحزام من الأمام", "الحزام من الجنب"]);
  });

  it("is knotted at the neck on every cut with a centre front, with no collar or one a tie goes over — and nowhere else", () => {
    for (const cut of NECKLINE_IDS) {
      /* the cut alone — the shirt-dress's cut arrives wearing its shirt collar, taken off here */
      const places = tiePlacesOf(one(setCollar(dressed(cut), dress.id, undefined)));
      expect(places.includes("neck"), cut).toBe(NECKLINE_TIED.includes(cut));
      // the list the offer reads is the cuts the drawing has the point on
      expect(dressPoints({ neckline: cut }).some((p) => p.kind === "neck"), cut).toBe(NECKLINE_TIED.includes(cut));
    }
    // over the sailor on every cut it follows, and over the Peter Pan
    for (const cut of ["v", "boat", "wrap", "round", "square", "scoop"]) expect(tiePlacesOf(one(dressed(cut, "female-sailor-collar"))), cut).toContain("neck");
    expect(tiePlacesOf(one(dressed("round", "female-peter-pan-collar")))).toContain("neck");
    // not under a bow collar, its own tie, nor a standing collar, which covers the neck
    for (const collar of ["female-bow-collar", "female-mandarin-collar", "female-shirt-collar"]) expect(tiePlacesOf(one(dressed("high", collar))), collar).not.toContain("neck");
    // the shirt-dress's cut as it arrives, in its shirt collar
    expect(tiePlacesOf(one(dressed("collared")))).not.toContain("neck");
  });

  it("is knotted on a fabric belt at its front or its side — not a leather one, not a necktie, and never on a wrap", () => {
    expect(tiePlacesOf(one(setBelt(dressed("round"), dress.id, "self")))).toEqual(["neck", "belt-front", "belt-side"]);
    expect(tiePlacesOf(one(setBelt(dressed("round"), dress.id, "self")), "necktie")).toEqual(["neck"]);
    expect(tiePlacesOf(one(setBelt(dressed("round"), dress.id, "brown")))).toEqual(["neck"]);
    // a sweetheart has no neck to tie at: only the belt, and so no necktie
    const sweet = one(setBelt(dressed("sweetheart"), dress.id, "self"));
    expect(tiePlacesOf(sweet)).toEqual(["belt-front", "belt-side"]);
    expect(tiesOffered(sweet)).toEqual(["none", "knot", "scarf"]);
    // nowhere at all: no tie row
    expect(tiesOffered(one(dressed("sweetheart")))).toEqual([]);
    expect(tieOf(one(dressed("sweetheart")))).toBeUndefined();
    // the wrap takes no belt but its own sash, which is tied in its own bow: the neck alone
    expect(tiePlacesOf(one(setBelt(dressed("wrap"), dress.id, "self")))).toEqual(["neck"]);
    // a sash is tied in its own bow too: no tie on it
    expect(tiePlacesOf(one(setBelt(dressed("round"), dress.id, "sash")))).toEqual(["neck"]);
    expect(tiePlacesOf(one(setBelt(dressed("round"), dress.id, "ribbon")))).toEqual(["neck"]);
  });

  it("goes where it is put while the place is there, and moves to the next when it goes — coming off only with nowhere left", () => {
    let worn = setBelt(dressed("round"), dress.id, "self");
    worn = setTie(worn, dress.id, "scarf");
    expect(tieAtOf(one(worn))).toBe("neck");
    worn = setTieAt(worn, dress.id, "belt-side");
    expect(choiceOf(one(worn))).toMatchObject({ tie: "scarf", tieAt: "belt-side" });
    // the belt taken off: back at the neck
    const unbelted = one(setBelt(worn, dress.id, "none"));
    expect([tieOf(unbelted), tieAtOf(unbelted)]).toEqual(["scarf", "neck"]);
    // a cut with no neck and no belt: it comes off, cloth and place with it
    const bare = one(setNeckline(setBelt(worn, dress.id, "none"), dress.id, "female-sweetheart-neckline"));
    expect([bare.tie, bare.tieAt, bare.fabrics.tie, tieOf(bare)]).toEqual([undefined, undefined, undefined, undefined]);
    // on a sweetheart, tied on its belt: the belt taken off takes the tie with it, and putting it back brings none
    const sweet = setTieAt(setTie(setBelt(dressed("sweetheart"), dress.id, "self"), dress.id, "scarf"), dress.id, "belt-side");
    const unbelt = one(setBelt(sweet, dress.id, "none"));
    expect([unbelt.tie, unbelt.tieAt, unbelt.fabrics.tie]).toEqual([undefined, undefined, undefined]);
    expect(tieOf(one(setBelt([unbelt], dress.id, "self")))).toBe("none");
    // a necktie with only a belt left to hang from comes off too
    const necktie = one(setNeckline(setTie(setBelt(dressed("round"), dress.id, "self"), dress.id, "necktie"), dress.id, "female-sweetheart-neckline"));
    expect([necktie.tie, tieOf(necktie)]).toEqual([undefined, "none"]);
  });

  it("arrives in the stripes' cloth when it wears stripes, else in the cloth of what it is knotted on", () => {
    // at the neck with no collar: the bodice's
    expect(one(setTie(dressed("v"), dress.id, "scarf")).fabrics.tie).toBe(linen.id);
    // over a collar cut from another cloth: the collar's
    const collared = setCollar(dressed("boat"), dress.id, "female-sailor-collar").map((w) => (w.garmentId === dress.id ? { ...w, fabrics: { ...w.fabrics, collar: white.id } } : w));
    expect(one(setTie(collared, dress.id, "scarf")).fabrics.tie).toBe(white.id);
    // striped: the stripes'
    expect(one(setTie(setStripes(collared, dress.id, "two", red.id), dress.id, "scarf")).fabrics.tie).toBe(red.id);
    // on a sweetheart's belt cut from white: the belt's
    const belted = setBelt(dressed("sweetheart"), dress.id, "self").map((w) => (w.garmentId === dress.id ? { ...w, fabrics: { ...w.fabrics, belt: white.id } } : w));
    expect(one(setTie(belted, dress.id, "knot")).fabrics.tie).toBe(white.id);
  });

  it("draws a tie on a plain dress — no collar, no stripes, no belt — in a cloth of its own", () => {
    for (const cut of NECKLINE_TIED.filter((c) => c !== "collared")) {
      const worn = setTie(dressed(cut), dress.id, "scarf");
      expect(regionsOf(dress, one(worn)), cut).toContain("tie");
      const html = draw(worn, { tie: red });
      const point = tiePoint(choiceOf(one(worn)))!;
      for (const d of tieAt("scarf", point).pieces) expect(html, cut).toContain(`d="${d}"`);
    }
  });

  it("draws the knot and the necktie at the V exactly as round 16 did", () => {
    for (const style of ["knot", "necktie"] as const) {
      const { pieces } = tieAt(style, TIE_AT);
      const html = draw(setTie(dressed("v", "female-sailor-collar"), dress.id, style));
      for (const d of pieces) expect(html, style).toContain(`d="${d}"`);
    }
  });

  it("draws the scarf as soft cloth, as photo 1's: a full 5 cm knot, broad tails of different lengths, curved, splayed, cut on a slant", () => {
    const at: Pt = [300, 250];
    const { parts } = tieAt("scarf", at);
    // the knot: about 5 cm across, and full — every side bowed out, not a square
    const knot = box([parts.knot]);
    expect((knot.x1 - knot.x0) * CM).toBeGreaterThan(4.6);
    expect((knot.x1 - knot.x0) * CM).toBeLessThan(5.8);
    expect((knot.y1 - knot.y0) * CM).toBeGreaterThan(3.5);
    expect(SCARF.knot.bows.every((b) => b >= 1.5)).toBe(true);
    const [l, r] = parts.tails!.map((d) => box([d]));
    // splayed apart, one each side of the point
    expect(l.x0).toBeLessThan(at[0] - 35);
    expect(r.x1).toBeGreaterThan(at[0] + 30);
    // of different lengths: 9.5–13 cm below the point, 1.5–3 cm apart
    for (const t of [l, r]) {
      expect((t.y1 - at[1]) * CM).toBeGreaterThan(9.5);
      expect((t.y1 - at[1]) * CM).toBeLessThan(13.5);
    }
    expect((l.y1 - r.y1) * CM).toBeGreaterThan(1.5);
    expect((l.y1 - r.y1) * CM).toBeLessThan(3);
    expect(TIE_DROP.scarf).toBeCloseTo(Math.max(l.y1, r.y1) - at[1], 6);
    for (const piece of [SCARF.long, SCARF.short]) {
      const [a, b, c, d] = piece.corners;
      // broad: 2–2.6 cm at the knot, 4–5 cm at the end
      expect(Math.hypot(a[0] - d[0], a[1] - d[1]) * CM).toBeGreaterThan(2);
      expect(Math.hypot(b[0] - c[0], b[1] - c[1]) * CM).toBeGreaterThan(4);
      expect(Math.hypot(b[0] - c[0], b[1] - c[1]) * CM).toBeLessThan(5);
      // a little curved: the outer side hollowed, the inner full
      expect(piece.bows[0]).toBeLessThan(-1);
      expect(piece.bows[2]).toBeGreaterThan(1);
      // cut on a slant, the outer corner lower
      expect(b[1] - c[1]).toBeGreaterThan(2.5);
    }
    // soft folds down each tail and drawn into the knot
    const folds = scarfFolds(at);
    expect(folds.tails.length).toBeGreaterThanOrEqual(4);
    expect(folds.knot.length).toBeGreaterThanOrEqual(3);
  });

  it("sets the belt's points on its middle row: its front where the buckle is, its side toward her left, where every tie fits on the dress and clear of her arm", () => {
    const arm = (["forearm", "hand"] as const).flatMap((z) => ringsOf(bodyById("female").zones[z]!).filter((r) => r.every(([x]) => x > 300)));
    for (const shape of dress.skirt!.shapes)
      for (const length of shapeLengths(shape, dress.skirt!.lengths))
        for (const waist of ["empire", "natural", "dropped"] as const) {
          const skirt = { shape, length, waist };
          const tag = `${shape} ${length} ${waist}`;
          const b = beltFor(skirt);
          const points = dressPoints({ neckline: "round", belt: "self", skirt });
          const front = points.find((p) => p.kind === "belt-front")!.at;
          const side = points.find((p) => p.kind === "belt-side")!.at;
          expect(front).toEqual([b.buckle.x, b.mid]);
          expect(side[1]).toBe(b.mid);
          const ring = ringsOf(b.path);
          expect(insideRings(ring, front) && insideRings(ring, side), tag).toBe(true);
          // toward her left: at least BELT_SIDE_IN in from the belt's end — the belt bow's loop further, about 7 cm — and clear of the front's tie
          const end = Math.max(...ring.flat().filter(([, y]) => Math.abs(y - b.mid) < 1.5).map(([x]) => x));
          expect(end - side[0], tag).toBeGreaterThan(BELT_SIDE_IN - 0.01);
          expect(side[0] - front[0], tag).toBeGreaterThan(20);
          // every tie the belt takes, knotted there, sized for the belt: on the dress — the bodice above it, the belt, the skirt below it — and off her arm, where nothing would hide a loop or a tail
          const skirtRings = ringsOf(skirtFor(undefined, skirt).path);
          const bodyRings = ringsOf(bodiceFor("round", undefined, waist).pieces[0]);
          for (const style of ["knot", "scarf"] as const)
            for (const d of tieAt(style, side, "belt-side").pieces)
              for (const q of ringsOf(d).flat()) {
                /* on the bodice, the belt, or the skirt below it — each its own outline: they overlap at the seam */
                expect(insideRings(bodyRings, q) || insideRings(ring, q) || insideRings(skirtRings, q), `${tag} ${style} at ${q.map((v) => v.toFixed(1))}`).toBe(true);
                expect(insideRings(arm, q), `${tag} ${style} on her arm at ${q.map((v) => v.toFixed(1))}`).toBe(false);
              }
        }
    // no fabric belt, no belt points
    expect(dressPoints({ neckline: "round", belt: "brown" }).map((p) => p.kind)).toEqual(["neck"]);
  }, 60_000);

  it("draws each style at each place it is offered, over the belt, and unbuckles a belt tied at its front", () => {
    const belted = setBelt(dressed("round"), dress.id, "self");
    const buckled = draw(belted);
    for (const style of ["knot", "scarf", "necktie"] as TieStyle[]) {
      for (const at of tiePlacesOf(one(belted), style)) {
        const worn = setTieAt(setTie(belted, dress.id, style), dress.id, at);
        const choice = choiceOf(one(worn));
        const point = tiePoint(choice)!;
        expect(point, `${style} ${at}`).toEqual(dressPoints(choice).find((p) => p.kind === at)!.at);
        const html = draw(worn, { tie: red });
        for (const d of tieAt(style, point, at).pieces) expect(html, `${style} ${at}`).toContain(`d="${d}"`);
        // drawn after the belt, so over it
        const beltAt = html.indexOf(`d="${beltFor(choice.skirt).path}"`);
        expect(beltAt, `${style} ${at}`).toBeGreaterThan(0);
        expect(html.indexOf(`d="${tieAt(style, point, at).parts.knot}"`), `${style} ${at}`).toBeGreaterThan(beltAt);
        // tied on the belt, front or side, it is tied, not buckled — the tie is its fastening; tied at the neck its buckle stays
        const buckle = renderToStaticMarkup(<svg><Buckle {...beltFor(choice.skirt).buckle} /></svg>).replace(/^<svg>|<\/svg>$/g, "");
        expect(buckled.includes(buckle)).toBe(true);
        expect(html.includes(buckle), `${style} ${at}`).toBe(at === "neck");
      }
    }
    // a tie on a sailor collar's boat, over the collar
    const sailor = setTie(dressed("boat", "female-sailor-collar"), dress.id, "scarf");
    const html = draw(sailor, { collar: white, tie: red });
    const knot = tieAt("scarf", dressPoints({ neckline: "boat" })[0].at).parts.knot;
    expect(html.indexOf(`d="${knot}"`)).toBeGreaterThan(html.indexOf("female-sailor-collar"));
  }, 60_000);
});
