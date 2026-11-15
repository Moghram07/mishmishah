import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MannequinStage } from "@/components/visualizer/MannequinStage";
import { garmentById } from "@/lib/data/garments";
import { fabricById } from "@/lib/data/fabrics";
import { DEFAULT_SKIN_TONE } from "@/lib/data/skinTones";
import { buttonRowsFor } from "@/lib/data/closures";
import { BUTTONED_CUTS, DOUBLE_CUTS } from "./closures";
import { NECKLINE_IDS } from "./necklines";
import { beltFor, cloth, drawnBodice, frontButtons, FRONT_X, seamAt, DEFAULT_SKIRT } from "./art/female/dressCut";
import { insideRings, ringsOf } from "./stripes";
import { buttonRowsOf, buttonRowsOffered, choiceOf, cutFrom, regionsOf, setButtonRows, setButtons, setNeckline, setSkirt, wear } from "./outfit";
import type { Fabric, FabricRegionId, Outfit, WaistId, WornGarment } from "@/types";

const dress = garmentById("female-dress")!;
const linen = fabricById("fb-apricot-linen")!;
const one = (worn: WornGarment[]) => worn.find((w) => w.garmentId === dress.id)!;
const dressed = (cut: string) => setNeckline(wear([], cutFrom(dress, linen.id)), dress.id, `female-${cut}-neckline`);
const CM = 0.19;
const WAISTS: WaistId[] = ["empire", "natural", "dropped"];
const draw = (worn: WornGarment[]) => {
  const regions: Partial<Record<FabricRegionId, Fabric>> = {};
  for (const r of regionsOf(dress, one(worn))) regions[r] = linen;
  const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
  return renderToStaticMarkup(<MannequinStage outfit={outfit} fabrics={{ [dress.id]: regions }} zoom={1} focus={[300, 500]} />);
};

describe("two rows of buttons", () => {
  it("names them «صف واحد · صفّان»", () => {
    expect(buttonRowsFor(["one", "two"]).map((r) => r.name.ar)).toEqual(["صف واحد", "صفّان"]);
  });

  it("are offered buttoned to the waist, on every buttoned cut but the shirt-dress's", () => {
    expect(DOUBLE_CUTS).toEqual(BUTTONED_CUTS.filter((c) => c !== "collared"));
    for (const cut of NECKLINE_IDS) {
      const waisted = one(setButtons(dressed(cut), dress.id, "waist"));
      expect(buttonRowsOffered(waisted).length > 0, cut).toBe(DOUBLE_CUTS.includes(cut));
      // not unbuttoned, nor to the hem
      expect(buttonRowsOffered(one(dressed(cut))), cut).toEqual([]);
      expect(buttonRowsOffered(one(setButtons(dressed(cut), dress.id, "hem"))), cut).toEqual([]);
    }
  });

  it("resolve back to one row wherever two are not offered, and to two again when they are", () => {
    let worn = setButtonRows(setButtons(dressed("boat"), dress.id, "waist"), dress.id, "two");
    expect([buttonRowsOf(one(worn)), choiceOf(one(worn)).buttonRows]).toEqual(["two", "two"]);
    // to the hem: one row down the placket
    const hem = one(setButtons(worn, dress.id, "hem"));
    expect([buttonRowsOf(hem), choiceOf(hem).buttonRows]).toEqual(["one", undefined]);
    // recut to the shirt-dress: its own placket
    expect(buttonRowsOf(one(setNeckline(worn, dress.id, "female-collared-neckline")))).toBe("one");
    // and back to the waist on the boat: two again, as chosen
    worn = setButtons(setButtons(worn, dress.id, "hem"), dress.id, "waist");
    expect(buttonRowsOf(one(worn))).toBe("two");
    // unbuttoned, no rows at all
    expect(buttonRowsOf(one(setButtons(worn, dress.id, "none")))).toBeUndefined();
  });

  it("stand either side of the centre front, about 10 cm apart, level, evenly spaced, the last about 5 cm above the seam — whole on the bodice, clear of a belt", () => {
    for (const cut of DOUBLE_CUTS)
      for (const waist of WAISTS) {
        const tag = `${cut} ${waist}`;
        const skirt = { ...DEFAULT_SKIRT, waist };
        const choice = { neckline: cut, skirt, buttons: "waist" as const, buttonRows: "two" as const };
        const { groups, pitch } = frontButtons(choice);
        expect(groups, tag).toHaveLength(1);
        const { at, r } = groups[0];
        const xs = [...new Set(at.map(([x]) => x))].sort((a, b) => a - b);
        expect(xs, tag).toHaveLength(2);
        expect((xs[0] + xs[1]) / 2, tag).toBeCloseTo(FRONT_X, 6);
        expect((xs[1] - xs[0]) * CM, tag).toBeGreaterThan(9);
        expect((xs[1] - xs[0]) * CM, tag).toBeLessThan(11);
        const rows = (x: number) => at.filter(([bx]) => bx === x).map(([, y]) => y);
        expect(rows(xs[0]), tag).toEqual(rows(xs[1]));
        const ys = rows(xs[0]);
        const gaps = ys.slice(1).map((y, i) => y - ys[i]);
        for (const g of gaps) expect(g, tag).toBeCloseTo(pitch!, 6);
        if (gaps.length) {
          expect(pitch! * CM, tag).toBeGreaterThan(7);
          expect(pitch! * CM, tag).toBeLessThan(11.5);
        }
        expect((seamAt(waist) - ys[ys.length - 1]) * CM, tag).toBeGreaterThan(4);
        expect((seamAt(waist) - ys[ys.length - 1]) * CM, tag).toBeLessThan(6);
        // whole on the bodice, as drawn: its own body piece, nothing of the cut drawn over a button
        const b = drawnBodice(choice);
        const body = ringsOf(b.pieces[0]);
        const over = b.pieces.slice(1).map((d) => ringsOf(d));
        for (const [x, y] of at)
          for (const [dx, dy] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) {
            expect(insideRings(body, [x + dx, y + dy]), `${tag} at ${x.toFixed(0)},${y.toFixed(0)}`).toBe(true);
            for (const piece of over) expect(insideRings(piece, [x + dx, y + dy]), `${tag} under a piece at ${x.toFixed(0)},${y.toFixed(0)}`).toBe(false);
          }
        // above a belt, never under it
        expect(ys[ys.length - 1] + r, tag).toBeLessThan(beltFor(skirt).top - 1);
      }
  }, 60_000);

  it("are sewn on the bodice itself, with no placket; one row keeps its placket as before", () => {
    for (const cut of DOUBLE_CUTS.filter((c) => c !== "off-shoulder")) {
      const two = { neckline: cut, buttons: "waist" as const, buttonRows: "two" as const };
      expect(cloth(two), cut).toEqual(cloth({ neckline: cut }));
      expect(drawnBodice(two).placket, cut).toBeUndefined();
      expect(drawnBodice({ neckline: cut, buttons: "waist" }).placket, cut).toBeDefined();
    }
    // one row exactly as it was
    expect(frontButtons({ neckline: "round", buttons: "waist" }).groups[0].at.every(([x]) => x === FRONT_X)).toBe(true);
  });

  it("are drawn on the figure, the same over every skirt", () => {
    const worn = setButtonRows(setButtons(dressed("boat"), dress.id, "waist"), dress.id, "two");
    const html = draw(worn);
    const { at } = frontButtons(choiceOf(one(worn))).groups[0];
    for (const [x, y] of at) expect(html).toContain(`cx="${x}" cy="${y}"`);
    // and no placket drawn under them; one row keeps its own
    const placket = drawnBodice({ neckline: "boat", buttons: "waist" }).placket!.path;
    expect(html).not.toContain(`d="${placket}"`);
    expect(draw(setButtonRows(worn, dress.id, "one"))).toContain(`d="${placket}"`);
    for (const shape of dress.skirt!.shapes) {
      const other = setSkirt(worn, dress.id, { shape, length: "midi", waist: "natural" });
      expect(frontButtons(choiceOf(one(other))).groups, shape).toEqual(frontButtons(choiceOf(one(worn))).groups);
    }
  }, 60_000);
});
