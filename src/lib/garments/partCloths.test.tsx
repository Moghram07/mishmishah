import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MannequinStage } from "@/components/visualizer/MannequinStage";
import { garmentById } from "@/lib/data/garments";
import { fabricById } from "@/lib/data/fabrics";
import { DEFAULT_SKIN_TONE } from "@/lib/data/skinTones";
import { necklinesForGarment } from "@/lib/data/necklines";
import { sleeveCuffById, sleeveCuffsFor, sleeveLengthsFor, sleeveTypesFor } from "@/lib/data/sleeves";
import { beltsFor } from "@/lib/data/closures";
import { regionLabel } from "@/lib/data/fabricRegions";
import { stripeEdgesFor } from "@/lib/data/collars";
import { BANDED_TYPES, SLEEVE_KINDS, WIDE_BAND, cuffsOffered, hasSleeveEnd } from "./sleeves";
import { beltFor, bodiceFor, dressEdges, dressStripes, sleeveEndPieces } from "./art/female/dressCut";
import { STRIPES, ringsOf, stripeSides } from "./stripes";
import {
  choiceOf,
  clothOf,
  cutFrom,
  necklineOf,
  partsOf,
  regionsOf,
  setBelt,
  setNeckline,
  setSleeve,
  setStripeEdges,
  setStripes,
  stripeEdgesOf,
  wear,
} from "./outfit";
import type { Fabric, FabricRegionId, Outfit, SleeveChoice, StripeEdgeId, WornGarment } from "@/types";
import type { GarmentChoice } from "./art";
import type { Pt } from "./fit";

const dress = garmentById("female-dress")!;
const blouse = garmentById("female-blouse")!;
const linen = fabricById("fb-apricot-linen")!;
const white = fabricById("fb-white")!;
const red = fabricById("fb-red")!;
const one = (worn: WornGarment[]) => worn.find((w) => w.garmentId === dress.id)!;
const box = (pts: Pt[]) => {
  const xs = pts.map(([x]) => x);
  const ys = pts.map(([, y]) => y);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};

/** The dress on the figure, each region in the cloth given — or its own. */
const draw = (worn: WornGarment[], cloths: Partial<Record<FabricRegionId, Fabric>> = {}, zoom = 1, focus: [number, number] = [300, 500]) => {
  const w = one(worn);
  const regions: Partial<Record<FabricRegionId, Fabric>> = {};
  for (const r of regionsOf(dress, w)) regions[r] = cloths[r] ?? fabricById(clothOf(w, r) ?? linen.id)!;
  const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
  return renderToStaticMarkup(<MannequinStage outfit={outfit} fabrics={{ [dress.id]: regions }} zoom={zoom} focus={focus} />);
};

describe("a wide band «شريط عريض»", () => {
  it("is offered on the dress at every length of a sewn sleeve, beside the cuffs on a long one — and nowhere else", () => {
    expect(sleeveCuffById("band")!.name.ar).toBe("شريط عريض");
    for (const type of dress.sleeves!.types) {
      for (const length of SLEEVE_KINDS[type].lengths) {
        const offered = cuffsOffered(dress.sleeves!.cuffs, { type, length });
        expect(offered.includes("band"), `${type} ${length}`).toBe(BANDED_TYPES.includes(type));
        if (length !== "long" && BANDED_TYPES.includes(type)) expect(offered, `${type} ${length}`).toEqual(["none", "band"]);
      }
      expect(cuffsOffered(dress.sleeves!.cuffs, { type, length: "sleeveless" }), type).toEqual([]);
    }
    expect(cuffsOffered(dress.sleeves!.cuffs, { type: "set-in", length: "long" })).toEqual(["none", "plain", "formal", "french", "band"]);
    // the blouse does not offer one
    for (const length of ["short", "elbow", "long"] as const) expect(cuffsOffered(blouse.sleeves!.cuffs, { type: "set-in", length }).includes("band"), length).toBe(false);
  });

  it("is sewn at the sleeve's hem, about 4.9 cm deep, as wide as the sleeve, on both arms", () => {
    for (const type of BANDED_TYPES) {
      for (const length of SLEEVE_KINDS[type].lengths) {
        const plain = bodiceFor("round", { type, length });
        const banded = bodiceFor("round", { type, length, cuff: "band" });
        const k = banded.sleeveCut!;
        expect(k.bands, `${type} ${length}`).toHaveLength(2);
        const band = box(ringsOf(k.bands[0]).flat());
        const hem = box(plain.sleeveCut!.raw!.hem);
        // its foot on the plain sleeve's hem; its depth the wide band's
        expect(Math.abs(band.y1 - hem.y1), `${type} ${length} foot`).toBeLessThan(3);
        expect(((band.y1 - band.y0) * 0.19), `${type} ${length} depth`).toBeGreaterThan(4.4);
        expect(((band.y1 - band.y0) * 0.19), `${type} ${length} depth`).toBeLessThan(5.6);
        // as wide as the sleeve's end, within a few millimetres
        expect(Math.abs(band.x1 - band.x0 - (hem.x1 - hem.x0)), `${type} ${length} width`).toBeLessThan(6);
        // the other arm's, mirrored
        const right = box(ringsOf(k.bands[1]).flat());
        expect(Math.abs(right.x0 - (600 - band.x1)), `${type} ${length} mirror`).toBeLessThan(0.5);
        expect(band.y1 - band.y0).toBeCloseTo(WIDE_BAND, 0);
      }
    }
  });

  it("takes its stripes centred across it, an even margin of the band either side", () => {
    for (const count of ["one", "two", "three"] as const) {
      const choice: GarmentChoice = { neckline: "round", sleeve: { type: "set-in", length: "short", cuff: "band" }, stripes: { count, on: ["sleeves"] } };
      const edge = dressEdges(choice).find((e) => e.kind === "sleeve" && e.side === 0)!;
      expect(edge.centred).toBe(true);
      const band = box(ringsOf(bodiceFor("round", choice.sleeve!, "natural").sleeveCut!.bands[0]).flat());
      const rows = stripeSides(edge, STRIPES[count]).flatMap((r) => [...r.near, ...r.far]);
      const ys = rows.map(([, y]) => y);
      const [top, foot] = [Math.min(...ys) - band.y0, band.y1 - Math.max(...ys)];
      expect(Math.abs(top - foot), count).toBeLessThan(1.5);
    }
  });
});

describe("a part in a cloth of its own", () => {
  it("is offered for the sleeves' ends exactly where the drawing has them, on every dress the panel can make", () => {
    let tried = 0;
    for (const n of necklinesForGarment(dress)) {
      const cut = setNeckline(wear([], cutFrom(dress, linen.id)), dress.id, n.id);
      const types = sleeveTypesFor(dress, necklineOf(one(cut)));
      for (const type of types) {
        for (const length of sleeveLengthsFor(type, necklineOf(one(cut)), dress)) {
          const cuffs = sleeveCuffsFor(dress, { type, length });
          for (const cuff of cuffs.length ? cuffs : [undefined]) {
            const sleeve: SleeveChoice = { type, length, ...(cuff ? { cuff } : {}) };
            const w = one(setSleeve(cut, dress.id, sleeve));
            const drawn = sleeveEndPieces(choiceOf(w)).length > 0;
            expect(partsOf(w).includes("cuff"), `${n.cut} ${type} ${length} ${cuff ?? ""}`).toBe(drawn);
            tried++;
          }
        }
      }
    }
    expect(tried).toBeGreaterThan(300);
    expect(hasSleeveEnd({ type: "set-in", length: "short", cuff: "band" })).toBe(true);
    expect(hasSleeveEnd({ type: "set-in", length: "short" })).toBe(false);
  }, 120_000);

  it("lists the cuffs and a fabric belt among the dress's parts, each arriving in the cloth it is sewn to", () => {
    let worn = setSleeve(wear([], cutFrom(dress, linen.id)), dress.id, { type: "set-in", length: "short", cuff: "band" });
    worn = setBelt(worn, dress.id, "self");
    const w = one(worn);
    expect(regionsOf(dress, w)).toEqual(["top", "bottom", "cuff", "belt"]);
    expect(regionLabel("cuff").ar).toBe("الكبك");
    expect(regionLabel("belt").ar).toBe("الحزام");
    expect([clothOf(w, "cuff"), clothOf(w, "belt")]).toEqual([linen.id, linen.id]);
    // each in the cloth of the part it is sewn to: the cuffs the bodice's, the belt the skirt's
    const parted = { ...w, fabrics: { ...w.fabrics, top: red.id, bottom: white.id } };
    expect([clothOf(parted, "cuff"), clothOf(parted, "belt")]).toEqual([red.id, white.id]);
    // chosen, its own
    const own = { ...w, fabrics: { ...w.fabrics, cuff: white.id } };
    expect(clothOf(own, "cuff")).toBe(white.id);
    // leather is its own colour: no cloth to choose
    expect(regionsOf(dress, one(setBelt(worn, dress.id, "brown")))).not.toContain("belt");
    // no band, no cuff part; the belt «قماش»
    expect(regionsOf(dress, one(setSleeve(worn, dress.id, { type: "set-in", length: "short" })))).not.toContain("cuff");
    expect(beltsFor(dress, "round").find((b) => b.id === "self")!.name.ar).toBe("قماش");
    // the blouse lists none
    const parts = regionsOf(blouse, setSleeve(wear([], cutFrom(blouse, linen.id)), blouse.id, { type: "set-in", length: "long", cuff: "french" })[0]);
    expect(parts.includes("cuff") || parts.includes("belt")).toBe(false);
  });

  it("draws exactly as before in the cloth it is sewn to, and laid whole over its piece in another", () => {
    const banded = setBelt(setSleeve(wear([], cutFrom(dress, linen.id)), dress.id, { type: "set-in", length: "long", cuff: "french" }), dress.id, "self");
    const same = draw(banded, { cuff: linen, belt: linen });
    const plain = draw(banded);
    expect(same).toBe(plain);
    expect(same).not.toContain("cuff-pattern");
    // in white: the cuff pattern, laid over each cuff piece exactly, after the bodice's cloth
    const own = draw(banded, { cuff: white });
    expect(own).toContain("female-dress-top-cuff-pattern");
    const b = bodiceFor("round", { type: "set-in", length: "long", cuff: "french" }, "natural");
    for (const piece of sleeveEndPieces(choiceOf(one(banded)))) {
      const at = own.indexOf(`<path d="${b.pieces[piece]}"></path>`);
      expect(at, `cuff ${piece} laid over`).toBeGreaterThan(0);
      expect(at).toBeGreaterThan(own.indexOf("female-dress-top-cuff-pattern"));
      /* warped as its piece is — the bodice's cloth is — so the cuff's edge is the piece's */
      const group = own.slice(own.lastIndexOf("<g", at), at);
      expect(group, `cuff ${piece} warped`).toContain("-warp)");
    }
    // the belt in white: the skirt's over-drawing cut from the belt's cloth
    const belt = draw(banded, { belt: white });
    expect(belt).not.toBe(plain);
    expect(belt).toContain(white.id === linen.id ? "" : "female-dress-bottom-over");
  });

  it("takes stripes along a fabric belt, centred across it, on the belt alone", () => {
    expect(stripeEdgesFor(["belt"])[0].name.ar).toBe("الحزام");
    let worn = setBelt(wear([], cutFrom(dress, linen.id)), dress.id, "self");
    expect(stripeEdgesOf(one(worn))).toContain("belt");
    expect(stripeEdgesOf(one(setBelt(worn, dress.id, "black")))).not.toContain("belt");
    worn = setStripeEdges(setStripes(worn, dress.id, "two", red.id), dress.id, ["belt"]);
    const choice = choiceOf(one(worn));
    const { top, bottom, belt } = dressStripes(choice);
    expect([top.length, bottom.length]).toEqual([0, 0]);
    expect(belt.length).toBeGreaterThanOrEqual(2);
    const b = beltFor(choice.skirt);
    for (const count of ["one", "two", "three"] as const) {
      const edge = dressEdges({ ...choice, stripes: { count, on: ["belt"] as StripeEdgeId[] } }).find((e) => e.kind === "belt")!;
      const ys = stripeSides(edge, STRIPES[count]).flatMap((r) => [...r.near, ...r.far]).map(([, y]) => y);
      expect(Math.min(...ys), count).toBeGreaterThan(b.top);
      expect(Math.max(...ys), count).toBeLessThan(b.bottom);
      expect(Math.abs(Math.min(...ys) - b.top - (b.bottom - Math.max(...ys))), count).toBeLessThan(1.5);
    }
    // drawn on the belt, in the stripes' cloth
    const markup = draw(worn, { trim: red });
    expect(markup).toContain("female-dress-bottom-over-inlay-pattern");
  });
});
