import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MannequinStage } from "@/components/visualizer/MannequinStage";
import { historyReducer, type History } from "@/components/visualizer/history";
import { garmentById, garments } from "@/lib/data/garments";
import { collarsForGarment, tiesFor } from "@/lib/data/collars";
import { necklinesForGarment } from "@/lib/data/necklines";
import { PLAIN_BLACK, PLAIN_WHITE, fabricById, fabrics as library, tieStartOn } from "@/lib/data/fabrics";
import { DEFAULT_SKIN_TONE } from "@/lib/data/skinTones";
import { collarArt, type GarmentChoice } from "./art";
import { SHIRT_COLLAR } from "./art/female/collars/shirt";
import { MALE_SHIRT_COLLAR } from "./art/male/collars/shirt";
import { peterPan } from "./art/female/collarCuts";
import { BOW_SHADOW } from "./art/female/tieArt";
import { BUTTERFLY, KNOT_DROP, NECKTIE, RIBBON_BOW, butterflyAt, necktieTo, ribbonAt, ribbonUnder, shirtTie, type ShirtTieStyle, type TieFit } from "./art/shirtTies";
import { WAISTBAND as SKIRT_BAND, skirtFor } from "./art/female/skirtCut";
import { WAISTBAND as HER_TROUSERS_BAND, legsFor as herLegs } from "./art/female/trousersCut";
import { WAISTBAND as HIS_TROUSERS_BAND, legsFor as hisLegs } from "./art/male/trousersCut";
import { NECK_BASE_SEAM as HER_SEAM } from "./art/female/yoke";
import { NECK_BASE_SEAM as HIS_SEAM } from "./art/male/yoke";
import { FLAT_LIT } from "./shading";
import { GARMENT_LAYERS } from "./drawOrder";
import { NECKLINE_TIED } from "./necklines";
import { draft, outline, type Pt } from "./fit";
import { insideRings, ringsOf } from "./stripes";
import { choiceOf, clothOf, collarOf, cutFrom, regionsOf, setBelt, setCollar, setNeckline, setSkirt, setTie, tieOf, tiePlacesOf, tiesOffered, wear } from "./outfit";
import type { BodyType, Fabric, FabricRegionId, Outfit, TieId, WornGarment } from "@/types";

/*
  The ties a collar draws, knotted under it (round 25's fixes, the user's
  photos ShirtCollarTie, ShirtCollarBowtie, WomenRibbon, femaleBowtieMenTie,
  bowtieMen, bowtieSize and TiePositions-Shapes): a necktie only under a
  shirt collar — her blouse, the shirt-dress, his shirt; never a thobe or a
  polo, never a neckline with no collar — and a bow tie with one, or her
  ribbon bow under a Peter Pan. The shirt collar wraps the neck: it stands
  3–4 cm up each side, its fold a wide V down to where its halves meet just
  above the top button, the neck showing in it. Every tie sits at the bottom
  of the V: the necktie's knot snug there, the points over its sides, its
  blade straight down the middle to the middle of the waistband; her bow and
  his bow tie on the leaves, the collar touching only their tops — hers full
  and round, its tails straight down side by side, twisting slightly; his
  wider than his neck, no wider than his head. Lit flat and crisp; a new one
  in plain black; under a jacket, in its opening.
*/

const white = fabricById("fb-white")!;
const black = fabricById("fb-black-crepe")!;
const CM = 0.19;
const SHIRTED = ["female-blouse", "female-dress", "male-shirt"];

const one = (worn: WornGarment[], id: string) => worn.find((w) => w.garmentId === id)!;
/** A garment as it arrives, cut to a neckline if given, and others worn with it. */
const wearing = (ids: string[], neckline?: string) => {
  let worn: WornGarment[] = [];
  for (const id of ids) worn = wear(worn, cutFrom(garmentById(id)!, white.id));
  return neckline ? setNeckline(worn, ids[0], neckline) : worn;
};
/** The stage, every region white but a black tie. */
const draw = (body: BodyType, worn: WornGarment[]) => {
  const fabrics: Record<string, Partial<Record<FabricRegionId, Fabric>>> = {};
  for (const w of worn) {
    const regions: Partial<Record<FabricRegionId, Fabric>> = {};
    for (const r of regionsOf(garmentById(w.garmentId)!, w)) regions[r] = r === "tie" ? black : (fabricById(clothOf(w, r) ?? w.fabrics[r] ?? white.id) ?? white);
    fabrics[w.garmentId] = regions;
  }
  const outfit: Outfit = { bodyType: body, skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
  return renderToStaticMarkup(<MannequinStage outfit={outfit} fabrics={fabrics} zoom={1} focus={[300, 500]} />);
};
/** The `d` of every path a piece of art draws. */
const pathsOf = (node: React.ReactNode) => [...renderToStaticMarkup(<svg>{node}</svg>).matchAll(/ d="([^"]+)"/g)].map((m) => m[1]);
const points = (d: string): Pt[] => ringsOf(d).flat();
const box = (ds: string[]) => {
  const pts = ds.flatMap(points);
  return { x0: Math.min(...pts.map(([x]) => x)), x1: Math.max(...pts.map(([x]) => x)), y0: Math.min(...pts.map(([, y]) => y)), y1: Math.max(...pts.map(([, y]) => y)) };
};
const lengthOf = (line: Pt[]) => line.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - line[i][0], p[1] - line[i][1]), 0);
const mid = (band: readonly [number, number]) => (band[0] + band[1]) / 2;

/** Each body's shirt collar: where its halves meet, the side of the neck where it stands, its fold, its points, the seam it is sewn to there, and its band's button under where the halves meet. */
const COLLARS = {
  female: { asset: "female-shirt-collar-front", meet: [SHIRT_COLLAR.meet[0], SHIRT_COLLAR.meet[1]] as Pt, side: [SHIRT_COLLAR.side[0], SHIRT_COLLAR.side[1]] as Pt, roll: SHIRT_COLLAR.roll, tip: [SHIRT_COLLAR.tip[0], SHIRT_COLLAR.tip[1]] as Pt, seam: HER_SEAM, band: 4, bandR: 2 },
  male: { asset: "male-shirt-collar-front", meet: [MALE_SHIRT_COLLAR.meet[0], MALE_SHIRT_COLLAR.meet[1]] as Pt, side: [MALE_SHIRT_COLLAR.side[0], MALE_SHIRT_COLLAR.side[1]] as Pt, roll: MALE_SHIRT_COLLAR.roll, tip: [MALE_SHIRT_COLLAR.tip[0], MALE_SHIRT_COLLAR.tip[1]] as Pt, seam: HIS_SEAM, band: 4, bandR: 2.2 },
} as const;
const TIED: GarmentChoice = { tieAt: "neck", tieUnder: true, wraps: true };
/** The collar's leaves, as it lays them again over a tie knotted under them. */
const leavesOf = (body: BodyType) => pathsOf(collarArt(COLLARS[body].asset)!.cut!({ ...TIED, tie: "necktie" }).collar!.over!.shape("#000"));
const leafRings = (body: BodyType) => leavesOf(body).map(ringsOf);
/** How each body's shirt collar fits a tie: a necktie to `to`, either bow at the bottom of the V. */
const fitOf = (body: BodyType, to = necktieTo(body, {})): TieFit => {
  const meet = COLLARS[body].meet;
  return { meet, to, bow: body === "female" ? ribbonAt(meet) : butterflyAt(meet) };
};
/** The collar's front, every piece in front of the neck — its band and its leaves — as the stage draws it with no tie. */
const frontOf = (body: BodyType) => pathsOf(collarArt(COLLARS[body].asset)!.regions.collar!.shape("#000")).map(ringsOf);
/** His head's width, measured off the photograph as the checker measures it — the median row from under the crown to the jaw, so his ears do not count: 15.0 cm. */
const HIS_HEAD = 79;
/** A Peter Pan on a cut — a top's crew neck with none — where its rounded ends meet, its halves, and her bow under it. */
const ppOf = (cut?: "round" | "scoop" | "boat") => {
  const halves = peterPan(cut);
  const meet: Pt = [halves.left[0][0], halves.left[0][1]];
  const rings = [ringsOf(outline(halves.left)), ringsOf(outline(halves.right))];
  return { meet, rings, bow: ribbonUnder(rings, meet), bowUnder: true as const };
};
/** The fold's row at a column — the collar's top edge, where its leaves turn, running down in a V: interpolated along it. */
const rollAt = (body: BodyType, x: number) => {
  const roll = COLLARS[body].roll;
  for (let i = 1; i < roll.length; i++) {
    const [[ax, ay], [bx, by]] = [roll[i - 1], roll[i]];
    if ((ax - x) * (bx - x) <= 0 && ax !== bx) return ay + ((x - ax) * (by - ay)) / (bx - ax);
  }
  return Math.min(...roll.map(([, y]) => y));
};
/**
 * The share of a bow's loops that shows past a collar — measured here on its
 * own, every half unit over each loop as drawn, not by `ribbonUnder`'s count.
 */
const showing = (loops: string[], collar: Pt[][][]) => {
  let [all, seen] = [0, 0];
  for (const d of loops) {
    const ring = ringsOf(d);
    const b = box([d]);
    for (let y = b.y0 + 0.25; y < b.y1; y += 0.5)
      for (let x = b.x0 + 0.25; x < b.x1; x += 0.5) {
        if (!insideRings(ring, [x, y])) continue;
        all++;
        if (!collar.some((piece) => insideRings(piece, [x, y]))) seen++;
      }
  }
  return seen / all;
};

describe("a necktie and a bow tie, knotted under a collar", () => {
  it("names her bow tie «فيونكة» and his «بابيون», and offers both on her blouse, the shirt-dress and his shirt, as they arrive", () => {
    expect(tiesFor(["necktie", "bowtie"], "female").map((t) => t.name.ar)).toEqual(["ربطة عنق", "فيونكة"]);
    expect(tiesFor(["necktie", "bowtie"], "male").map((t) => t.name.ar)).toEqual(["ربطة عنق", "بابيون"]);
    expect([tiesFor(["bowtie"], "female")[0].name.en, tiesFor(["bowtie"], "male")[0].name.en]).toEqual(["Bow", "Bow tie"]);
    for (const [id, neckline] of [["female-blouse"], ["female-dress", "female-collared-neckline"], ["male-shirt"]] as const) {
      const w = one(wearing([id], neckline), id);
      expect(collarOf(w)?.ties, id).toEqual({ offered: ["necktie", "bowtie"], under: ["necktie", "bowtie"] });
      expect(tiesOffered(w), id).toEqual(["none", "necktie", "bowtie"]);
      for (const style of ["necktie", "bowtie"] as const) expect(tiePlacesOf(w, style), `${id} ${style}`).toEqual(["neck"]);
    }
  });

  it("offers a necktie only under a shirt collar, and a bow tie under one or her Peter Pan, on those three — never a thobe or a polo, never a neckline with no collar; the scarf, the knot and the sailor's ties as they were", () => {
    for (const g of garments) {
      const cuts = necklinesForGarment(g).map((n) => n.id);
      for (const neckline of cuts.length ? cuts : [undefined])
        for (const collarId of [undefined, ...collarsForGarment(g).map((c) => c.id)]) {
          let worn = wear([], cutFrom(g, white.id));
          if (neckline) worn = setNeckline(worn, g.id, neckline);
          worn = setCollar(worn, g.id, collarId);
          const w = one(worn, g.id);
          /* the collar it actually wears: one that fits the cut */
          const collar = collarOf(w);
          const cut = neckline?.replace(/^female-|-neckline$/g, "");
          const centred = cut === undefined || (NECKLINE_TIED as readonly string[]).includes(cut);
          const shirt = /-shirt-collar$/.test(collar?.id ?? "");
          const pp = collar?.id === "female-peter-pan-collar";
          const tag = `${g.id} ${cut ?? "-"} ${collar?.id ?? "no collar"}`;
          const at = (style: TieId) => tiePlacesOf(w, style).includes("neck");
          expect(at("bowtie"), tag).toBe(SHIRTED.includes(g.id) && (shirt || pp) && centred);
          expect(at("necktie"), tag).toBe(centred && ((SHIRTED.includes(g.id) && shirt) || (g.id === "female-dress" && collar?.id === "female-sailor-collar")));
          /* the knot and the scarf: the dress's, at a neck with no collar, or over a sailor's or a Peter Pan's — as before */
          const over = !collar || collar.id === "female-sailor-collar" || pp;
          for (const style of ["knot", "scarf"] as const) expect(at(style), `${tag} ${style}`).toBe(g.id === "female-dress" && centred && cut !== undefined && over);
          if (!SHIRTED.includes(g.id)) expect(tiesOffered(w), tag).toEqual([]);
        }
    }
    // her blouse in a Peter Pan: her bow alone; the dress's: the knot, her bow and the scarf
    expect(tiesOffered(one(setCollar(wearing(["female-blouse"]), "female-blouse", "female-peter-pan-collar"), "female-blouse"))).toEqual(["none", "bowtie"]);
    expect(tiesOffered(one(setCollar(wearing(["female-dress"], "female-round-neckline"), "female-dress", "female-peter-pan-collar"), "female-dress"))).toEqual(["none", "knot", "bowtie", "scarf"]);
    // a thobe and a polo in his shirt collar: still no tie
    for (const id of ["male-thobe", "male-polo"]) expect(tiesOffered(one(setCollar(wearing([id]), id, "male-shirt-collar"), id)), id).toEqual([]);
  });

  it("takes a tie off with a neckline or a collar that cannot take it, as any choice that no longer fits — and undo brings it back", () => {
    const pp = (w: WornGarment[], id: string) => setCollar(w, id, "female-peter-pan-collar");
    const cases: [string, (w: WornGarment[]) => WornGarment[], ShirtTieStyle[], (w: WornGarment[]) => WornGarment[]][] = [
      ["female-dress", (w) => setNeckline(w, "female-dress", "female-round-neckline"), ["necktie", "bowtie"], (w) => setNeckline(w, "female-dress", "female-collared-neckline")],
      ["female-blouse", (w) => setCollar(w, "female-blouse", "female-mandarin-collar"), ["necktie", "bowtie"], (w) => w],
      ["male-shirt", (w) => setCollar(w, "male-shirt", "male-mandarin-collar"), ["necktie", "bowtie"], (w) => w],
      /* her bow under a Peter Pan: off with a cut it does not follow, or a collar that takes no bow */
      ["female-dress", (w) => setNeckline(w, "female-dress", "female-v-neckline"), ["bowtie"], (w) => pp(setNeckline(w, "female-dress", "female-round-neckline"), "female-dress")],
      ["female-blouse", (w) => setCollar(w, "female-blouse", "female-mandarin-collar"), ["bowtie"], (w) => pp(w, "female-blouse")],
    ];
    for (const [id, change, styles, dress] of cases)
      for (const style of styles) {
        const tag = `${id} ${style} ${collarOf(one(dress(wearing([id])), id))?.id}`;
        let h: History<WornGarment[]> = { past: [], present: dress(wearing([id])), future: [] };
        h = historyReducer(h, { type: "set", next: (w) => setTie(w, id, style, PLAIN_BLACK) });
        const tied = h.present;
        expect([tieOf(one(tied, id)), one(tied, id).fabrics.tie], tag).toEqual([style, PLAIN_BLACK]);
        h = historyReducer(h, { type: "set", next: change });
        const off = one(h.present, id);
        expect([off.tie, off.tieAt, off.fabrics.tie, tieOf(off) ?? "none"], tag).toEqual([undefined, undefined, undefined, "none"]);
        expect(regionsOf(garmentById(id)!, off), tag).not.toContain("tie");
        h = historyReducer(h, { type: "undo" });
        expect(h.present, tag).toEqual(tied);
        expect(tieOf(one(h.present, id)), tag).toBe(style);
        h = historyReducer(h, { type: "redo" });
        expect(one(h.present, id).tie, tag).toBeUndefined();
      }
    // from a shirt collar to a Peter Pan her bow stays, a necktie goes
    const blouse = (style: ShirtTieStyle) => one(setCollar(setTie(wearing(["female-blouse"]), "female-blouse", style, PLAIN_BLACK), "female-blouse", "female-peter-pan-collar"), "female-blouse");
    expect(tieOf(blouse("bowtie"))).toBe("bowtie");
    expect(blouse("necktie").tie).toBeUndefined();
  });

  it("starts a new necktie or bow tie in black on a light shirt and in white on a dark one; one on keeps its cloth; the knot and the scarf as before", () => {
    const plain = fabricById(PLAIN_BLACK)!;
    expect([plain.motif, plain.colorName?.en]).toEqual(["solid", "Black"]);
    expect([fabricById(PLAIN_WHITE)!.motif, fabricById(PLAIN_WHITE)!.colorName?.en]).toEqual(["solid", "White"]);
    // black on light shirts, white on dark ones — navy, black, any dark colour — so a new tie always shows
    for (const [shirt, start] of [["fb-white", PLAIN_BLACK], ["fb-off-white", PLAIN_BLACK], ["fb-navy", PLAIN_WHITE], ["fb-black-crepe", PLAIN_WHITE], ["fb-red", PLAIN_WHITE]] as const)
      expect(tieStartOn(fabricById(shirt)!).id, shirt).toBe(start);
    // every cloth in the library gets the one of the two that stands further from it in lightness
    for (const f of library) expect([PLAIN_BLACK, PLAIN_WHITE], f.id).toContain(tieStartOn(f).id);
    for (const [ids, neckline] of [[["female-blouse", "female-skirt"]], [["female-dress"], "female-collared-neckline"], [["male-shirt", "male-trousers"]]] as const)
      for (const style of ["necktie", "bowtie"] as const) {
        const id = ids[0];
        const tag = `${id} ${style}`;
        const tied = setTie(wearing([...ids], neckline), id, style, PLAIN_BLACK);
        expect(one(tied, id).fabrics.tie, tag).toBe(PLAIN_BLACK);
        // the other style keeps the cloth the tie has: black, or what was chosen for it
        const other = style === "necktie" ? "bowtie" : "necktie";
        expect(one(setTie(tied, id, other, PLAIN_BLACK), id).fabrics.tie, tag).toBe(PLAIN_BLACK);
        const red = tied.map((w) => (w.garmentId === id ? { ...w, fabrics: { ...w.fabrics, tie: "fb-red" } } : w));
        expect(one(setTie(red, id, other, PLAIN_BLACK), id).fabrics.tie, tag).toBe("fb-red");
      }
    // a knot on a Peter Pan as before, in the collar's cloth; her bow after it, new, in black
    let dress = setCollar(wearing(["female-dress"], "female-round-neckline"), "female-dress", "female-peter-pan-collar");
    dress = setTie(dress, "female-dress", "knot", PLAIN_BLACK);
    expect(one(dress, "female-dress").fabrics.tie).toBe(white.id);
    expect(one(setTie(dress, "female-dress", "bowtie", PLAIN_BLACK), "female-dress").fabrics.tie).toBe(PLAIN_BLACK);
    // with no black given, as before: the collar's cloth
    expect(one(setTie(wearing(["female-blouse"]), "female-blouse", "necktie"), "female-blouse").fabrics.tie).toBe(white.id);
  });

  it("knots the necktie under the collar's points and lays both bows on its leaves, at the bottom of the V, over the placket's buttons, with the band's button under the knot", () => {
    const cases: [BodyType, string[], string?][] = [
      ["female", ["female-blouse", "female-skirt"]],
      ["female", ["female-dress"], "female-collared-neckline"],
      ["male", ["male-shirt", "male-trousers"]],
    ];
    for (const [body, ids, neckline] of cases)
      for (const style of ["necktie", "bowtie"] as const) {
        const tag = `${ids[0]} ${style}`;
        const c = COLLARS[body];
        const worn = setTie(wearing(ids, neckline), ids[0], style, PLAIN_BLACK);
        expect(choiceOf(one(worn, ids[0])), tag).toMatchObject({ tie: style, tieAt: "neck", tieUnder: true });
        const html = draw(body, worn);
        const tie = shirtTie(style, body, fitOf(body, body === "female" ? mid(SKIRT_BAND) : mid(HIS_TROUSERS_BAND)));
        const knot = html.indexOf(`d="${tie.knot}"`);
        expect(knot, tag).toBeGreaterThan(0);
        // the collar first, then the tie
        const [leaf] = leavesOf(body);
        expect(html.indexOf(`d="${leaf}"`), tag).toBeLessThan(knot);
        // a necktie's knot under the leaves, laid again over it — only over the tie; a bow on them, nothing laid over it
        const fall = html.indexOf(`-${ids[0]}-${collarOf(one(worn, ids[0]))!.id}-fall-`);
        expect(tie.under, tag).toBe(style === "necktie");
        if (style === "necktie") {
          expect(fall, tag).toBeGreaterThan(knot);
          expect(html.indexOf(`d="${leaf}"`, knot), tag).toBeGreaterThan(knot);
        } else expect(fall, tag).toBe(-1);
        // the placket's buttons under the tie
        for (const m of html.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)" fill="#2b211b"/g)) {
          const [x, y] = [Number(m[1]), Number(m[2])];
          if (Math.abs(x - 299) < 4 && y > 200 && y < 520) expect(m.index!, `${tag} button at ${y}`).toBeLessThan(knot);
        }
        // the band's button, just under where the halves meet: under the knot, not drawn — and drawn with no tie on
        const button = `cy="${c.meet[1] + c.band}" r="${c.bandR}"`;
        expect(html.includes(button), tag).toBe(false);
        expect(draw(body, wearing(ids, neckline)).includes(button), `${tag}, untied`).toBe(true);
      }
    // her bow under a Peter Pan: drawn by the collar, its halves laid again over it
    for (const [ids, neckline, cut] of [[["female-blouse", "female-skirt"], undefined, undefined], [["female-dress"], "female-round-neckline", "round"]] as const) {
      const id = ids[0];
      const worn = setTie(setCollar(wearing([...ids], neckline), id, "female-peter-pan-collar"), id, "bowtie", PLAIN_BLACK);
      expect(choiceOf(one(worn, id)), id).toMatchObject({ tie: "bowtie", tieAt: "neck", tieUnder: true });
      const html = draw("female", worn);
      const knot = html.indexOf(`d="${shirtTie("bowtie", "female", { ...ppOf(cut), to: 0 }).knot}"`);
      expect(knot, id).toBeGreaterThan(0);
      expect(html.indexOf(`-${id}-female-peter-pan-collar-fall-`), id).toBeGreaterThan(knot);
      // and the dress draws no knot of its own there
      expect((html.match(/-tie-/g) ?? []).length, id).toBeGreaterThan(0);
    }
    // the order the stage keeps: the placket's buttons, then the tie, then the collar over it
    expect(GARMENT_LAYERS.indexOf("trim")).toBeLessThan(GARMENT_LAYERS.indexOf("tie"));
    expect(GARMENT_LAYERS.indexOf("tie")).toBeLessThan(GARMENT_LAYERS.indexOf("fall"));
    expect(GARMENT_LAYERS.indexOf("belt")).toBeLessThan(GARMENT_LAYERS.indexOf("tie"));
  }, 60_000);

  it("wraps the shirt collar round the neck: standing 3–4 cm at its sides, its fold a wide V down to where its halves meet, the neck showing in it — every tie at the bottom of the V", () => {
    for (const body of ["female", "male"] as const) {
      const c = COLLARS[body];
      const leaves = leafRings(body);
      // closed: each leaf runs to the point where the halves meet
      for (const ring of leaves) expect(Math.min(...ring.flat().map(([x, y]) => Math.hypot(x - c.meet[0], y - c.meet[1]))), body).toBeLessThan(0.5);
      // it stands up each side of the neck, 3–4 cm above the seam there
      expect((c.seam - c.side[1]) * CM, body).toBeGreaterThan(3);
      expect((c.seam - c.side[1]) * CM, body).toBeLessThan(4);
      // its halves meet at centre front, 3–6 cm below its sides: a V
      expect((c.meet[1] - c.side[1]) * CM, body).toBeGreaterThan(3);
      expect((c.meet[1] - c.side[1]) * CM, body).toBeLessThan(6);
      // its fold runs down from each side to where they meet, never climbing, lowest there; wide — its arms come in over 35° from upright
      const roll = c.roll;
      const m = roll.findIndex(([x, y]) => Math.hypot(x - c.meet[0], y - c.meet[1]) < 0.6);
      expect(m, body).toBeGreaterThan(0);
      for (let i = 1; i < roll.length; i++) expect(i <= m ? roll[i][1] >= roll[i - 1][1] - 0.05 : roll[i][1] <= roll[i - 1][1] + 0.05, `${body} fold at ${i}`).toBe(true);
      expect(Math.max(...roll.map(([, y]) => y)), body).toBeLessThan(c.meet[1] + 0.3);
      for (const near of [roll[m - 2], roll[m + 2]]) expect((Math.atan2(Math.abs(c.meet[0] - near[0]), c.meet[1] - near[1]) * 180) / Math.PI, body).toBeGreaterThan(35);
      // the neck shows in the V: nothing of the collar's front above its fold, between its sides
      const front = frontOf(body);
      for (let x = c.side[0] + 2; x < 2 * c.meet[0] - c.side[0] - 2; x += 1)
        for (let y = c.side[1] - 4; y < rollAt(body, x) - 1; y += 1) expect(front.some((ring) => insideRings(ring, [x, y])), `${body} at ${x.toFixed(1)}, ${y}`).toBe(false);
      // the leaves fall from the fold, their points below where the halves meet
      expect(c.tip[1], body).toBeGreaterThan(c.meet[1]);
      // its back turns round the neck at each side, rounding over from where the fold starts there — not a box behind the collar
      const back = pathsOf(collarArt(`${body}-shirt-collar-behind`)!.regions.collar!.shape("#000")).flatMap(ringsOf);
      const outAt = (y: number) => {
        const xs = back.flatMap((r) =>
          r.flatMap((p, k) => {
            const q = r[(k + 1) % r.length];
            return (p[1] - y) * (q[1] - y) <= 0 && p[1] !== q[1] ? [p[0] + ((y - p[1]) * (q[0] - p[0])) / (q[1] - p[1])] : [];
          })
        );
        return c.side[0] - Math.min(...xs);
      };
      expect(outAt(c.side[1] + 16), body).toBeGreaterThan(2);
      expect(outAt(c.side[1] + 1), body).toBeLessThan(0.6 * outAt(c.side[1] + 16));
      // every tie's knot at the bottom of the V, on the middle
      for (const style of ["necktie", "bowtie"] as const) {
        const knot = box([shirtTie(style, body, fitOf(body)).knot]);
        expect(knot.y0 - c.meet[1], `${body} ${style}`).toBeGreaterThanOrEqual(0);
        expect(knot.y0 - c.meet[1], `${body} ${style}`).toBeLessThan(2.5);
        expect(Math.abs((knot.x0 + knot.x1) / 2 - c.meet[0]), `${body} ${style}`).toBeLessThan(0.15);
        // nothing of any tie above the fold — no band round the neck
        for (const [x, y] of shirtTie(style, body, fitOf(body)).pieces.flatMap(points)) expect(y, `${body} ${style} at ${x.toFixed(1)}`).toBeGreaterThan(rollAt(body, x));
      }
      // the necktie's knot: about 3.6 cm across for her, 4.2 for him, 4 and 4.8 tall; its top corners under the leaves, either side
      const [kt, kb, kh] = NECKTIE[body].knot;
      expect(box([shirtTie("necktie", body, fitOf(body)).knot]).y0, body).toBeCloseTo(c.meet[1] + KNOT_DROP, 6);
      expect(kt * CM, body).toBeGreaterThan(body === "female" ? 3.3 : 3.9);
      expect(kt * CM, body).toBeLessThan(body === "female" ? 3.9 : 4.5);
      expect(kh * CM, body).toBeGreaterThan(body === "female" ? 3.7 : 4.5);
      expect(kb, body).toBeLessThan(kt);
      for (const side of [-1, 1]) expect(leaves.some((ring) => insideRings(ring, [c.meet[0] + (side * kt) / 2 - side, c.meet[1] + KNOT_DROP + 1])), `${body} ${side}`).toBe(true);
    }
  });

  it("keeps the shirt collar as it was on a garment it does not wrap — his thobe, his polo, her t-shirt: its fold level, its band and buttons where they were", () => {
    /* the collar a choice draws: its cut's, else its own */
    const pathOf = (asset: string, choice: GarmentChoice) => pathsOf((collarArt(asset)!.cut!(choice).collar ?? collarArt(asset)!.regions.collar!).shape("#000"));
    for (const [body, ids, collar, rows] of [
      ["male", ["male-thobe"], "male-shirt-collar", [14, 24]],
      ["male", ["male-polo", "male-trousers"], "male-shirt-collar", [20]],
      ["female", ["female-t-shirt", "female-skirt"], "female-shirt-collar", [15]],
    ] as const) {
      const id = ids[0];
      const worn = setCollar(wearing([...ids]), id, collar);
      const w = one(worn, id);
      expect(collarOf(w)?.id, id).toBe(collar);
      expect(choiceOf(w).wraps, id).toBeUndefined();
      // its own shape: the level fold — where its leaves meet, on the band's top, within a few units of its sides' height (the V's is 23 and 25 below)
      const level = pathOf(`${collar}-front`, choiceOf(w));
      const v = pathOf(`${collar}-front`, { wraps: true });
      expect(level, id).not.toEqual(v);
      const [mx, my] = level[1].match(/^M([\d.]+) ([\d.]+)/)!.slice(1).map(Number);
      const top = Math.min(...level.flatMap((d) => ringsOf(d).flat().map(([, y]) => y)));
      expect(my - top, id).toBeLessThan(6);
      // drawn so on the stage, not the V; its band's buttons where they were, under where the leaves meet
      const html = draw(body, worn);
      expect(html.includes(`d="${level[1]}"`), id).toBe(true);
      expect(html.includes(`d="${v[1]}"`), id).toBe(false);
      for (const dy of rows) expect(html.includes(`cy="${my + dy}"`), `${id} button ${dy}`).toBe(true);
      // and no tie offered there
      expect(tiesOffered(w), id).toEqual([]);
      expect(mx, id).toBeGreaterThan(290);
    }
    // the three it wraps: her blouse, the shirt-dress, his shirt
    for (const [ids, neckline] of [[["female-blouse"]], [["female-dress"], "female-collared-neckline"], [["male-shirt"]]] as const) expect(choiceOf(one(wearing([...ids], neckline), ids[0])).wraps, ids[0]).toBe(true);
  }, 60_000);

  it("hangs the necktie straight down the middle, widening gently, to a point", () => {
    for (const body of ["female", "male"] as const) {
      const c = COLLARS[body];
      const to = necktieTo(body, {});
      const tie = shirtTie("necktie", body, fitOf(body, to));
      const blade = tie.parts.find((p) => p.id === "blade")!.pieces[0];
      const ring = ringsOf(blade);
      const pts = ring.flat();
      // ends in a point on the middle
      const tip = pts.reduce((a, b) => (b[1] > a[1] ? b : a));
      /* the path is written to a tenth of a unit */
      expect(Math.abs(tip[1] - to), body).toBeLessThan(0.1);
      expect(Math.abs(tip[0] - c.meet[0]), body).toBeLessThan(0.1);
      expect(tie.tip, body).toEqual([c.meet[0], to]);
      // straight down the middle: as wide either side of it at every row, and widening down to above the point
      const [, widest] = NECKTIE[body].blade;
      const knotFoot = box([tie.knot]).y1;
      let last = 0;
      for (let y = knotFoot + 1; y < to - widest / 2 - 1; y += 2) {
        const xs: number[] = [];
        for (const r of ring)
          for (let i = 0; i < r.length; i++) {
            const [a, b] = [r[i], r[(i + 1) % r.length]];
            if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) xs.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
          }
        const [l, rr] = [Math.min(...xs), Math.max(...xs)];
        expect(Math.abs((l + rr) / 2 - c.meet[0]), `${body} at ${y}`).toBeLessThan(0.3);
        expect(rr - l, `${body} at ${y}`).toBeGreaterThanOrEqual(last - 0.05);
        last = rr - l;
      }
      // as wide as it was — 5.5 cm for her, 7.4 for him — and gently: under 6° a side
      expect(widest * CM, body).toBeGreaterThan(body === "female" ? 5 : 7);
      expect(widest * CM, body).toBeLessThan(body === "female" ? 6 : 8);
      const [under] = NECKTIE[body].blade;
      expect((Math.atan2((widest - under) / 2, to - widest / 2 - knotFoot) * 180) / Math.PI, body).toBeLessThan(6);
    }
  });

  it("ends the necktie at the middle of the waistband it is worn over — the skirt's, the trousers' — or of the dress's belt, or at its waist seam", () => {
    // the waistbands, as each is drawn: its band's own top and bottom rows
    const rows = (d: string) => [box([d]).y0, box([d]).y1];
    for (const [band, drawn] of [[SKIRT_BAND, skirtFor().band], [HER_TROUSERS_BAND, herLegs().band], [HIS_TROUSERS_BAND, hisLegs().band]] as const)
      rows(drawn).forEach((y, i) => expect(Math.abs(y - band[i]), `${band} drawn ${rows(drawn)}`).toBeLessThan(0.6));
    const waist = draft("female").waistY;
    const cases: [string, BodyType, string[], (w: WornGarment[]) => WornGarment[], number, string?][] = [
      ["blouse over a skirt", "female", ["female-blouse", "female-skirt"], (w) => w, mid(SKIRT_BAND)],
      ["blouse over trousers", "female", ["female-blouse", "female-trousers"], (w) => w, mid(HER_TROUSERS_BAND)],
      ["blouse alone", "female", ["female-blouse"], (w) => w, mid(SKIRT_BAND)],
      ["shirt over trousers", "male", ["male-shirt", "male-trousers"], (w) => w, mid(HIS_TROUSERS_BAND)],
      ["shirt alone", "male", ["male-shirt"], (w) => w, mid(HIS_TROUSERS_BAND)],
      ["shirt-dress", "female", ["female-dress"], (w) => w, waist, "female-collared-neckline"],
      ["shirt-dress, belted", "female", ["female-dress"], (w) => setBelt(w, "female-dress", "self"), waist - 6, "female-collared-neckline"],
      ["shirt-dress, dropped, leather belt", "female", ["female-dress"], (w) => setBelt(setSkirt(w, "female-dress", { shape: "flared", length: "midi", waist: "dropped" }), "female-dress", "brown"), waist + 70 - 6, "female-collared-neckline"],
      ["shirt-dress, empire", "female", ["female-dress"], (w) => setSkirt(w, "female-dress", { shape: "flared", length: "midi", waist: "empire" }), waist - 36, "female-collared-neckline"],
    ];
    for (const [tag, body, ids, dress, to, neckline] of cases) {
      const worn = setTie(dress(wearing(ids, neckline)), ids[0], "necktie", PLAIN_BLACK);
      const tie = shirtTie("necktie", body, fitOf(body, to));
      const blade = tie.parts.find((p) => p.id === "blade")!.pieces[0];
      expect(draw(body, worn).includes(`d="${blade}"`), `${tag}: its point at ${to}`).toBe(true);
      // lower than the waist it used to stop at, over a skirt or trousers
      if (ids.length > 1) expect(to, tag).toBeGreaterThan(draft(body).waistY + 15);
    }
  }, 60_000);

  it("ties her bow full and round, the collar touching only the top of its loops — on the leaves of the blouse's and the shirt-dress's collar, under a Peter Pan — its knot clear in the middle, its tails straight down side by side, twisting slightly", () => {
    const shirt = { ...fitOf("female"), rings: frontOf("female"), tag: "shirt collar" };
    const pps = (["top", "round", "scoop", "boat"] as const).map((cut) => ({ ...ppOf(cut === "top" ? undefined : cut), to: 0, tag: `Peter Pan ${cut}` }));
    for (const fit of [shirt, ...pps]) {
      const { meet, rings, tag } = fit;
      const tie = shirtTie("bowtie", "female", fit);
      const knot = box([tie.knot]);
      const loops = tie.parts.find((p) => p.id === "loops")!.pieces;
      /* the path is written to a tenth of a unit */
      expect(Math.abs((knot.x0 + knot.x1) / 2 - meet[0]), tag).toBeLessThan(0.15);
      if ("bowUnder" in fit) {
        // under a Peter Pan, just below where its ends meet: the ends over the loops' tops only — nine tenths of the loops showing, each a little under them
        expect(tie.under, tag).toBe(true);
        expect(knot.y0, tag).toBeGreaterThan(meet[1] + KNOT_DROP);
        for (const d of loops) expect(showing([d], rings), tag).toBeLessThan(0.995);
        expect(showing(loops, rings), tag).toBeGreaterThan(0.9);
        for (const d of loops) {
          const b = box([d]);
          for (let y = tie.at[1] + 0.25; y < b.y1; y += 0.5)
            for (let x = b.x0 + 0.25; x < b.x1; x += 0.5) if (insideRings(ringsOf(d), [x, y])) expect(rings.some((r) => insideRings(r, [x, y])), `${tag} at ${x}, ${y}`).toBe(false);
        }
        for (const [, y] of tie.pieces.flatMap(points)) expect(y, tag).toBeGreaterThan(meet[1]);
      } else {
        // on a shirt collar's leaves, at the bottom of the V: the loops in full; the collar's points behind them, none of the collar beside or below their lower half
        expect(tie.under, tag).toBe(false);
        expect(knot.y0 - meet[1], tag).toBeGreaterThanOrEqual(0);
        expect(knot.y0 - meet[1], tag).toBeLessThan(2.5);
        const tip = COLLARS.female.tip;
        for (const side of [-1, 1]) expect(loops.some((d) => insideRings(ringsOf(d), [side < 0 ? tip[0] : 2 * meet[0] - tip[0], tip[1]])), `${tag} point ${side}`).toBe(true);
        const all = box(loops);
        const bow = tie.pieces.map(ringsOf);
        for (let y = tie.at[1] + 0.5; y < all.y1 + 4; y += 1)
          for (let x = all.x0 - 3; x < all.x1 + 3; x += 1)
            if (rings.some((r) => insideRings(r, [x, y]))) expect(bow.some((r) => insideRings(r, [x, y])), `${tag}: the collar in sight at ${x.toFixed(1)}, ${y.toFixed(1)}`).toBe(true);
      }
      // the loops: 10–12 cm across, each 4–5 cm tall and about as long as it is tall — full and round, not a flat strip
      const all = box(loops);
      expect((all.x1 - all.x0) * CM, tag).toBeGreaterThan(10);
      expect((all.x1 - all.x0) * CM, tag).toBeLessThan(12);
      for (const d of loops) {
        const b = box([d]);
        expect((b.y1 - b.y0) * CM, tag).toBeGreaterThan(4);
        expect((b.y1 - b.y0) * CM, tag).toBeLessThan(5);
        expect(b.y1 - b.y0, tag).toBeGreaterThan(0.75 * (b.x1 - b.x0));
      }
      // the knot small, a little narrower than the ribbon, drawn over the loops in the middle
      expect(knot.x1 - knot.x0, tag).toBeLessThan(RIBBON_BOW.width);
      expect(knot.x1 - knot.x0, tag).toBeGreaterThan(0.75 * RIBBON_BOW.width);
      expect(tie.pieces[tie.pieces.length - 1], tag).toBe(tie.knot);
      // two tails, one each side, never crossing; straight down, under 3°; slightly apart, 0.5–2 cm; 15–20 cm; the ribbon's width, 2.5–3 cm; twisting slightly; cut on a slant
      const lines = tie.tailLines!;
      expect(lines.length, tag).toBe(2);
      const tails = tie.parts.filter((p) => p.id.startsWith("tail")).map((p) => p.pieces[0]);
      const [left, right] = tails.map((d) => box([d]));
      expect(left.x1, tag).toBeLessThan(meet[0]);
      expect(right.x0, tag).toBeGreaterThan(meet[0]);
      expect((right.x0 - left.x1) * CM, tag).toBeGreaterThan(0.5);
      expect((right.x0 - left.x1) * CM, tag).toBeLessThan(2);
      lines.forEach((line, i) => {
        const n = line.length - 1;
        const [a, b] = [line[0], line[n]];
        expect((Math.atan2(Math.abs(b[0] - a[0]), b[1] - a[1]) * 180) / Math.PI, `${tag} tail ${i}`).toBeLessThan(3);
        expect(lengthOf(line) * CM, `${tag} tail ${i}`).toBeGreaterThan(15);
        expect(lengthOf(line) * CM, `${tag} tail ${i}`).toBeLessThan(20);
        // across it at a row: its two edges where the row crosses it
        const across = (y: number) => {
          const xs = ringsOf(tails[i]).flatMap((r) =>
            r.flatMap((p, k) => {
              const q = r[(k + 1) % r.length];
              return (p[1] - y) * (q[1] - y) <= 0 && p[1] !== q[1] ? [p[0] + ((y - p[1]) * (q[0] - p[0])) / (q[1] - p[1])] : [];
            })
          );
          return [Math.min(...xs), Math.max(...xs)];
        };
        const [mx, my] = line[Math.floor(n / 2)];
        const [l, r] = across(my);
        expect(Math.abs((l + r) / 2 - mx), `${tag} tail ${i}`).toBeLessThan(0.5);
        expect((r - l) * CM, `${tag} tail ${i}`).toBeGreaterThan(2.5);
        expect((r - l) * CM, `${tag} tail ${i}`).toBeLessThan(3);
        // a slight twist: from two fifths of the way down to its last sixth, it draws in by a tenth to three tenths somewhere
        let narrowest = r - l;
        for (let k = Math.ceil(0.4 * n); k <= Math.floor(0.85 * n); k++) {
          const [p, q] = across(line[k][1]);
          narrowest = Math.min(narrowest, q - p);
        }
        expect(1 - narrowest / (r - l), `${tag} tail ${i}`).toBeGreaterThan(0.1);
        expect(1 - narrowest / (r - l), `${tag} tail ${i}`).toBeLessThan(0.3);
        // cut on a slant: its lowest point on its outer side, a fifth of the ribbon's width below its inner corner
        const low = points(tails[i]).reduce((p, q) => (q[1] > p[1] ? q : p));
        expect(Math.sign(low[0] - b[0]), `${tag} tail ${i}`).toBe(Math.sign(b[0] - meet[0]));
        /* its inner corner, read well inside its inner half — the cut's own middle sits on the line */
        const innerLow = Math.max(...points(tails[i]).filter(([x]) => -Math.sign(b[0] - meet[0]) * (x - b[0]) > 0.3 * RIBBON_BOW.width).map(([, y]) => y));
        expect(low[1] - innerLow, `${tag} tail ${i}`).toBeGreaterThan(0.2 * RIBBON_BOW.width);
      });
      // its folds and shading: on the loops, the knot, and each tail — the twist's crease among them
      for (const part of tie.parts) expect(part.folds.length, `${tag} ${part.id}`).toBeGreaterThan(2);
    }
  });

  it("ties his bow tie at the bottom of the V on the leaves, wider than his neck and no wider than his head, the collar's points touching only its top, with no tails", () => {
    const c = COLLARS.male;
    const tie = shirtTie("bowtie", "male", fitOf("male"));
    const all = box(tie.pieces);
    // no tails: nothing below its wings
    expect(all.y1).toBeLessThanOrEqual(tie.at[1] + BUTTERFLY.wing + 0.5);
    expect(tie.tailLines).toBeUndefined();
    expect(tie.under).toBe(false);
    // wider than his neck — measured at its narrowest — and no wider than his head (the photo bowtieSize); a classic bow's depth
    let neck = Infinity;
    for (let y = 145; y <= 170; y++) neck = Math.min(neck, draft("male").neck(y).width);
    expect(all.x1 - all.x0).toBeGreaterThan(neck);
    expect(all.x1 - all.x0).toBeLessThanOrEqual(HIS_HEAD);
    expect((all.y1 - all.y0) * CM).toBeGreaterThan(4.5);
    expect((all.y1 - all.y0) * CM).toBeLessThan(6.5);
    expect((all.x0 + all.x1) / 2).toBeCloseTo(c.meet[0], 1);
    // its knot at the bottom of the V
    const knot = box([tie.knot]);
    expect(knot.y0 - c.meet[1]).toBeGreaterThanOrEqual(0);
    expect(knot.y0 - c.meet[1]).toBeLessThan(2.5);
    // the collar's points behind its wings, none of the collar beside or below their lower half
    const wings = tie.parts.find((p) => p.id === "wings")!.pieces;
    for (const side of [-1, 1]) expect(wings.some((d) => insideRings(ringsOf(d), [side < 0 ? c.tip[0] : 2 * c.meet[0] - c.tip[0], c.tip[1]])), `point ${side}`).toBe(true);
    const front = frontOf("male");
    const bow = tie.pieces.map(ringsOf);
    for (let y = tie.at[1] + 0.5; y < all.y1 + 4; y += 1)
      for (let x = all.x0 - 3; x < all.x1 + 3; x += 1)
        if (front.some((r) => insideRings(r, [x, y]))) expect(bow.some((r) => insideRings(r, [x, y])), `the collar in sight at ${x.toFixed(1)}, ${y.toFixed(1)}`).toBe(true);
  });

  it("lights each tie flat and crisp, as the round 24 bows — one flat tone, crisp edges, a narrow sharp shadow, no blur, no relief — in a cloth of its own", () => {
    const uid = (name: string) => `u-${name}`;
    const arts = [
      ...(["female", "male"] as const).flatMap((body) =>
        (["necktie", "bowtie"] as ShirtTieStyle[]).map((style) => ({ tag: `${body} ${style}`, art: collarArt(COLLARS[body].asset)!.cut!({ ...TIED, tie: style }).tie! }))
      ),
      ...([undefined, "female-round-neckline"] as const).map((neckline) => ({
        tag: `her bow under a Peter Pan ${neckline ?? ""}`,
        art: collarArt("female-peter-pan-collar-front")!.cut!({ ...TIED, tie: "bowtie", ...(neckline ? { neckline: neckline.replace(/^female-|-neckline$/g, "") } : {}) }).tie!,
      })),
    ];
    for (const { tag, art } of arts) {
      expect(art, tag).toBeDefined();
      expect(art.shadow, tag).toEqual(BOW_SHADOW);
      expect(art.surface, tag).toBeUndefined();
      const html = renderToStaticMarkup(
        <svg>
          {art.defs!(uid)}
          {art.shading!(uid)}
          {art.light!(uid)}
        </svg>
      );
      expect(html, tag).toContain(`fill="${FLAT_LIT}"`);
      // every blur it is drawn through — its folds' and its edge light's: none softer than a fold's soft turn, 2 units
      const used = new Set([...html.matchAll(/filter="url\(#([^)]+)\)"/g)].map((m) => m[1]));
      expect(used.size, tag).toBeGreaterThan(0);
      for (const id of used) {
        const def = new RegExp(`<filter id="${id}"[^>]*>[\\s\\S]*?stdDeviation="([\\d.]+)"`).exec(html);
        expect(def, `${tag} ${id}`).not.toBeNull();
        expect(Number(def![1]), `${tag} ${id}`).toBeLessThanOrEqual(2);
      }
    }
    // its own cloth: a region of the garment, drawn in whatever is chosen for it
    const worn = setTie(wearing(["male-shirt", "male-trousers"]), "male-shirt", "necktie", PLAIN_BLACK);
    expect(regionsOf(garmentById("male-shirt")!, one(worn, "male-shirt"))).toContain("tie");
    expect(draw("male", worn)).toContain(`-male-shirt-male-shirt-collar-tie-`);
  });

  it("shows a necktie in a jacket's opening, under the jacket", () => {
    for (const [body, ids] of [
      ["male", ["male-shirt", "male-trousers", "male-jacket"]],
      ["female", ["female-blouse", "female-skirt", "female-jacket"]],
    ] as const) {
      const worn = setTie(wearing([...ids]), ids[0], "necktie", PLAIN_BLACK);
      const html = draw(body, worn);
      const knot = html.indexOf(`d="${shirtTie("necktie", body, fitOf(body)).knot}"`);
      expect(knot, body).toBeGreaterThan(0);
      // inside the group the jacket's mask holds, still open where the tie is drawn
      const held = html.search(new RegExp(`<g mask="url\\(#[^)"]*-inside-${ids[2]}\\)">`));
      expect(held, body).toBeGreaterThan(0);
      expect(held, body).toBeLessThan(knot);
      const between = html.slice(held, knot);
      expect((between.match(/<g[\s>]/g) ?? []).length - (between.match(/<\/g>/g) ?? []).length, body).toBeGreaterThanOrEqual(1);
      // and the jacket's own cloth after it, over it
      expect(html.indexOf(`-${ids[2]}-`, knot), body).toBeGreaterThan(knot);
    }
  }, 60_000);
});
