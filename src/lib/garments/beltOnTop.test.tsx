import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MannequinStage } from "@/components/visualizer/MannequinStage";
import { garmentById } from "@/lib/data/garments";
import { collarById } from "@/lib/data/collars";
import { fabricById } from "@/lib/data/fabrics";
import { DEFAULT_SKIN_TONE } from "@/lib/data/skinTones";
import { GARMENT_LAYERS } from "./drawOrder";
import { DEFAULT_SKIRT, beltFor, frontButtons, sashFor, sashOn, tiePoint } from "./art/female/dressCut";
import { sailorOn } from "./art/female/collarCuts";
import { tieAt } from "./art/female/ties";
import { collarArt } from "./art";
import { Buckle } from "./art/buckle";
import { ringsOf } from "./stripes";
import { choiceOf, clothOf, cutFrom, regionsOf, setBelt, setButtons, setCollar, setNeckline, setSkirt, setStripes, setTie, setTieAt, wear } from "./outfit";
import type { BeltId, Fabric, FabricRegionId, Outfit, WaistId, WornGarment } from "@/types";

const dress = garmentById("female-dress")!;
const jacket = garmentById("female-jacket")!;
const linen = fabricById("fb-apricot-linen")!;
const red = fabricById("fb-red")!;
const white = fabricById("fb-white")!;
const SAILOR = "female-sailor-collar";
const WAISTS: WaistId[] = ["empire", "natural", "dropped"];
const BELTS: Exclude<BeltId, "none">[] = ["self", "brown", "black", "sash", "ribbon"];

const one = (worn: WornGarment[]) => worn.find((w) => w.garmentId === dress.id)!;
/** The dress cut to a neckline, at a waist. */
const dressed = (cut: string, waist: WaistId = "natural") =>
  setSkirt(setNeckline(wear([], cutFrom(dress, linen.id)), dress.id, `female-${cut}-neckline`), dress.id, { ...DEFAULT_SKIRT, waist });
/** The whole stage, as the app draws it. */
const draw = (worn: WornGarment[], cloths: Partial<Record<FabricRegionId, Fabric>> = {}) => {
  const fabrics: Record<string, Partial<Record<FabricRegionId, Fabric>>> = {};
  for (const w of worn) {
    const garment = garmentById(w.garmentId)!;
    const regions: Partial<Record<FabricRegionId, Fabric>> = {};
    for (const r of regionsOf(garment, w)) regions[r] = (w.garmentId === dress.id ? cloths[r] : undefined) ?? fabricById(clothOf(w, r) ?? w.fabrics[r] ?? linen.id) ?? linen;
    fabrics[w.garmentId] = regions;
  }
  const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
  return renderToStaticMarkup(<MannequinStage outfit={outfit} fabrics={fabrics} zoom={1} focus={[300, 500]} />);
};
/** Where a part's own drawing starts in the stage's markup: every id of its region carries its key — see `MannequinStage`. */
const start = (html: string, key: string) => {
  const i = html.indexOf(`-${key}-`);
  expect(i, key).toBeGreaterThan(0);
  return i;
};
const BELT = `${dress.id}-bottom-over`;
const buckleOf = (worn: WornGarment[]) =>
  renderToStaticMarkup(<svg><Buckle {...beltFor({ ...DEFAULT_SKIRT, ...choiceOf(one(worn)).skirt }).buckle} /></svg>).replace(/^<svg>|<\/svg>$/g, "");
const lowest = (paths: string[]) => Math.max(...paths.flatMap((d) => ringsOf(d).flat().map(([, y]) => y)));

describe("the belt, worn over the dress", () => {
  it("draws the wrap's sash over its sailor collar and the collar's stripes, at each waist — the collar ending under it", () => {
    for (const waist of WAISTS) {
      const worn = setStripes(setCollar(dressed("wrap", waist), dress.id, SAILOR), dress.id, "two", red.id);
      const html = draw(worn, { collar: white, belt: red });
      const collar = start(html, `${dress.id}-${SAILOR}`);
      const belt = start(html, BELT);
      // the collar first, its stripes with it; the sash after both, so over them
      expect(belt, waist).toBeGreaterThan(collar);
      const stripes = html.indexOf(`-${dress.id}-${SAILOR}-inlay-pattern`);
      expect(stripes, waist).toBeGreaterThan(collar);
      expect(stripes, waist).toBeLessThan(belt);
      // the collar runs down the wrap's edge to under the sash, its end between the band's edges
      const sash = sashOn({ ...DEFAULT_SKIRT, waist }, "sash", "side");
      const end = lowest(sailorOn("wrap", waist).map((p) => p.path));
      expect(end, waist).toBeGreaterThan(sash.top + 4);
      expect(end, waist).toBeLessThan(sash.bottom - 4);
      // the bow on the sash is the sash's, drawn with it
      for (const d of sashFor(choiceOf(one(worn)))!.bow.pieces) expect(html.indexOf(`d="${d}"`, belt), waist).toBeGreaterThan(belt);
    }
  }, 60_000);

  it("draws the buttons under every belt at every waist, and the buckle over a buckled one", () => {
    for (const waist of WAISTS) {
      for (const kind of BELTS) {
        const tag = `${kind} · ${waist}`;
        const worn = setBelt(setButtons(dressed("round", waist), dress.id, "waist"), dress.id, kind);
        const choice = choiceOf(one(worn));
        const html = draw(worn);
        const belt = start(html, BELT);
        // the last button at the waist, which the belt lies over
        const group = frontButtons(choice).groups.at(-1)!;
        const [x, y] = group.at.at(-1)!;
        const b = kind === "sash" || kind === "ribbon" ? sashFor(choice)! : beltFor(choice.skirt);
        expect(y + group.r, tag).toBeGreaterThan(b.top);
        const button = html.indexOf(`cx="${x}" cy="${y}" r="${group.r}"`);
        expect(button, tag).toBeGreaterThan(0);
        expect(button, tag).toBeLessThan(belt);
        // a leather or fabric belt's buckle on it; a sash or a ribbon is tied in its bow
        const buckle = html.indexOf(buckleOf(worn));
        if (kind === "sash" || kind === "ribbon") expect(buckle, tag).toBe(-1);
        else expect(buckle, tag).toBeGreaterThan(belt);
      }
    }
    // the shirt-dress's own buttons, to its waist, and two rows: under the belt too
    for (const worn of [setBelt(setButtons(dressed("collared"), dress.id, "waist"), dress.id, "self"), setBelt(setButtons(dressed("v"), dress.id, "hem"), dress.id, "ribbon")]) {
      const html = draw(worn);
      const belt = start(html, BELT);
      for (const g of frontButtons(choiceOf(one(worn))).groups) for (const [x, y] of g.at) expect(html.indexOf(`cx="${x}" cy="${y}" r="${g.r}"`)).toBeLessThan(belt);
    }
  }, 60_000);

  it("draws a bow tied on a fabric belt over the belt, and a tie at the neck over everything", () => {
    for (const waist of WAISTS) {
      const belted = setBelt(setCollar(dressed("v", waist), dress.id, SAILOR), dress.id, "self");
      for (const at of ["belt-front", "belt-side"] as const) {
        const worn = setTieAt(setTie(belted, dress.id, "knot"), dress.id, at);
        const html = draw(worn, { tie: red });
        const belt = start(html, BELT);
        expect(start(html, `${dress.id}-${SAILOR}-tie`), `${at} · ${waist}`).toBeGreaterThan(belt);
        // tied, not buckled
        expect(html.indexOf(buckleOf(worn)), `${at} · ${waist}`).toBe(-1);
      }
      // a necktie at the V's point reaches the belt at the empire waist, and hangs over it
      const worn = setTie(belted, dress.id, "necktie");
      const html = draw(worn, { tie: red });
      expect(start(html, `${dress.id}-${SAILOR}-tie`), waist).toBeGreaterThan(start(html, BELT));
      const point = tiePoint(choiceOf(one(worn)))!;
      if (waist === "empire") expect(lowest(tieAt("necktie", point, "neck").pieces)).toBeGreaterThan(beltFor({ ...DEFAULT_SKIRT, waist }).top);
    }
  }, 60_000);

  it("keeps the collar exactly as it is with no belt", () => {
    const sailor = collarArt(collarById(SAILOR)!.asset.front)!;
    for (const waist of WAISTS) {
      const skirt = { ...DEFAULT_SKIRT, waist };
      const bare = sailor.cut!({ neckline: "v", skirt }).collar;
      for (const belt of BELTS) expect(sailor.cut!({ neckline: "v", skirt, belt }).collar, `${belt} · ${waist}`).toBe(bare);
      // and with no belt nothing is drawn over the dress's own parts
      const html = draw(setCollar(dressed("v", waist), dress.id, SAILOR), { collar: white });
      expect(html.includes(`-${BELT}-`), waist).toBe(false);
    }
  });

  it("keeps a jacket over the belt: the belt is drawn inside it, and the jacket after it", () => {
    const worn = wear(setBelt(dressed("round"), dress.id, "sash"), cutFrom(jacket, linen.id));
    expect(worn.map((w) => w.garmentId)).toContain(jacket.id);
    const html = draw(worn);
    const belt = start(html, BELT);
    // inside the group the jacket's mask holds — whatever is worn under it — still open where the belt is drawn
    const held = html.search(new RegExp(`<g mask="url\\(#[^)"]*-inside-${jacket.id}\\)">`));
    expect(held, "the jacket's mask").toBeGreaterThan(0);
    expect(held).toBeLessThan(start(html, `${dress.id}-top`));
    const between = html.slice(held, belt);
    expect((between.match(/<g[\s>]/g) ?? []).length - (between.match(/<\/g>/g) ?? []).length).toBeGreaterThanOrEqual(1);
    // and the jacket's own cloth after it, over it
    expect(html.indexOf(`-${jacket.id}-`, belt), "the jacket").toBeGreaterThan(belt);
  });

  it("names the order: the belt after the cloth, the buttons and the collar; its buckle and any tie after the belt", () => {
    const at = (layer: (typeof GARMENT_LAYERS)[number]) => GARMENT_LAYERS.indexOf(layer);
    for (const under of ["cloth", "buttons", "collar"] as const) expect(at("belt"), under).toBeGreaterThan(at(under));
    for (const over of ["buckle", "tie"] as const) expect(at(over), over).toBeGreaterThan(at("belt"));
  });
});
