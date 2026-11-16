import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MannequinStage } from "@/components/visualizer/MannequinStage";
import { historyReducer, type History } from "@/components/visualizer/history";
import { garmentById, garments } from "@/lib/data/garments";
import { collarsForGarment, tiesFor } from "@/lib/data/collars";
import { necklinesForGarment } from "@/lib/data/necklines";
import { fabricById } from "@/lib/data/fabrics";
import { DEFAULT_SKIN_TONE } from "@/lib/data/skinTones";
import { collarArt, type GarmentChoice } from "./art";
import { SHIRT_COLLAR } from "./art/female/collars/shirt";
import { MALE_SHIRT_COLLAR } from "./art/male/collars/shirt";
import { BOW_SHADOW } from "./art/female/tieArt";
import { BUTTERFLY, KNOT_DROP, NECKTIE, RIBBON_BOW, shirtTie, type ShirtTieStyle } from "./art/shirtTies";
import { standFrontEdges as herStand } from "./art/female/yoke";
import { standFrontEdges as hisStand } from "./art/male/yoke";
import { FLAT_LIT } from "./shading";
import { GARMENT_LAYERS } from "./drawOrder";
import { NECKLINE_TIED } from "./necklines";
import { draft, type Pt } from "./fit";
import { insideRings, ringsOf } from "./stripes";
import { choiceOf, clothOf, collarOf, cutFrom, regionsOf, setCollar, setNeckline, setTie, tieOf, tiePlacesOf, tiesOffered, wear } from "./outfit";
import type { BodyType, Fabric, FabricRegionId, Outfit, TieId, WornGarment } from "@/types";

/*
  The necktie and the bow tie belong on a shirt collar (round 25's fix, the
  user's photos ShirtCollarTie and ShirtCollarBowtie): offered only with one —
  her blouse, the shirt-dress, his shirt; never a thobe or a polo, never a
  neckline with no collar — knotted round its band under the leaves, the
  collar closed at the top; the necktie's knot snug between the points, which
  lie over its sides, its blade straight down the middle to the waist; her
  bow tie the belt bow, smaller, his a butterfly; lit flat and crisp; under a
  jacket, in its opening.
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

/** Each body's shirt collar: where its leaves meet, its drawing, its roll line, and the waist its necktie ends at. */
const COLLARS = {
  female: { asset: "female-shirt-collar-front", meet: [SHIRT_COLLAR.meet[0], SHIRT_COLLAR.meet[1]] as Pt, roll: herStand(SHIRT_COLLAR.stand).top, waist: draft("female").waistY, band: 15, bandR: 2 },
  male: { asset: "male-shirt-collar-front", meet: [MALE_SHIRT_COLLAR.meet[0], MALE_SHIRT_COLLAR.meet[1]] as Pt, roll: hisStand(MALE_SHIRT_COLLAR.stand).top, waist: draft("male").waistY, band: 20, bandR: 2.2 },
} as const;
const TIED: GarmentChoice = { tieAt: "neck", tieBand: true };
/** The collar's leaves, as it lays them again over a necktie's knot. */
const leavesOf = (body: BodyType) => pathsOf(collarArt(COLLARS[body].asset)!.cut!({ ...TIED, tie: "necktie" }).collar!.over!.shape("#000"));
/** The roll line's row at a column — the collar's top edge, where its leaves turn: interpolated along it. */
const rollAt = (body: BodyType, x: number) => {
  const roll = COLLARS[body].roll;
  for (let i = 1; i < roll.length; i++) {
    const [[ax, ay], [bx, by]] = [roll[i - 1], roll[i]];
    if ((ax - x) * (bx - x) <= 0 && ax !== bx) return ay + ((x - ax) * (by - ay)) / (bx - ax);
  }
  return Math.min(...roll.map(([, y]) => y));
};

describe("a necktie and a bow tie, on a shirt collar", () => {
  it("names the bow tie «بابيون», and offers both on her blouse, the shirt-dress and his shirt, as they arrive", () => {
    expect(tiesFor(["necktie", "bowtie"]).map((t) => t.name.ar)).toEqual(["ربطة عنق", "بابيون"]);
    for (const [id, neckline] of [["female-blouse"], ["female-dress", "female-collared-neckline"], ["male-shirt"]] as const) {
      const w = one(wearing([id], neckline), id);
      expect(collarOf(w)?.ties, id).toEqual({ offered: ["necktie", "bowtie"], band: true });
      expect(tiesOffered(w), id).toEqual(["none", "necktie", "bowtie"]);
      for (const style of ["necktie", "bowtie"] as const) expect(tiePlacesOf(w, style), `${id} ${style}`).toEqual(["neck"]);
    }
  });

  it("offers them only under a shirt collar, on those three — never a thobe or a polo, never a neckline with no collar; the scarf, the knot and the sailor's ties as they were", () => {
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
          const shirt = collar?.ties?.band === true;
          const tag = `${g.id} ${cut ?? "-"} ${collar?.id ?? "no collar"}`;
          const at = (style: TieId) => tiePlacesOf(w, style).includes("neck");
          expect(at("bowtie"), tag).toBe(SHIRTED.includes(g.id) && shirt && centred);
          expect(at("necktie"), tag).toBe(centred && ((SHIRTED.includes(g.id) && shirt) || (g.id === "female-dress" && collar?.id === "female-sailor-collar")));
          /* the knot and the scarf: the dress's, at a neck with no collar, or over a sailor's or a Peter Pan's — as before */
          const over = !collar || collar.id === "female-sailor-collar" || collar.id === "female-peter-pan-collar";
          for (const style of ["knot", "scarf"] as const) expect(at(style), `${tag} ${style}`).toBe(g.id === "female-dress" && centred && cut !== undefined && over);
          if (!SHIRTED.includes(g.id)) expect(tiesOffered(w), tag).toEqual([]);
        }
    }
    // a thobe and a polo in his shirt collar: still no tie
    for (const id of ["male-thobe", "male-polo"]) expect(tiesOffered(one(setCollar(wearing([id]), id, "male-shirt-collar"), id)), id).toEqual([]);
  });

  it("takes a tie off with a neckline or a collar that cannot take it, as any choice that no longer fits — and undo brings it back", () => {
    const cases: [string, (w: WornGarment[]) => WornGarment[], string?][] = [
      ["female-dress", (w) => setNeckline(w, "female-dress", "female-round-neckline"), "female-collared-neckline"],
      ["female-blouse", (w) => setCollar(w, "female-blouse", "female-mandarin-collar")],
      ["male-shirt", (w) => setCollar(w, "male-shirt", "male-mandarin-collar")],
    ];
    for (const [id, change, neckline] of cases)
      for (const style of ["necktie", "bowtie"] as const) {
        const tag = `${id} ${style}`;
        let h: History<WornGarment[]> = { past: [], present: wearing([id], neckline), future: [] };
        h = historyReducer(h, { type: "set", next: (w) => setTie(w, id, style) });
        const tied = h.present;
        expect([tieOf(one(tied, id)), one(tied, id).fabrics.tie], tag).toEqual([style, white.id]);
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
  });

  it("knots the necktie under the collar's points and the bow tie over them, over the placket's buttons, with the band's button under the knot", () => {
    const cases: [BodyType, string[], string?][] = [
      ["female", ["female-blouse", "female-skirt"]],
      ["female", ["female-dress"], "female-collared-neckline"],
      ["male", ["male-shirt", "male-trousers"]],
    ];
    for (const [body, ids, neckline] of cases)
      for (const style of ["necktie", "bowtie"] as const) {
        const tag = `${ids[0]} ${style}`;
        const c = COLLARS[body];
        const worn = setTie(wearing(ids, neckline), ids[0], style);
        expect(choiceOf(one(worn, ids[0])), tag).toMatchObject({ tie: style, tieAt: "neck", tieBand: true });
        const html = draw(body, worn);
        const tie = shirtTie(style, body, c.meet, c.waist);
        const knot = html.indexOf(`d="${tie.knot}"`);
        expect(knot, tag).toBeGreaterThan(0);
        // the collar first, then the tie
        const [leaf] = leavesOf(body);
        expect(html.indexOf(`d="${leaf}"`), tag).toBeLessThan(knot);
        // a necktie's knot under the leaves, laid again over it — only over the tie; a bow tie over them
        const fall = html.indexOf(`-${ids[0]}-${collarOf(one(worn, ids[0]))!.id}-fall-`);
        if (style === "necktie") {
          expect(fall, tag).toBeGreaterThan(knot);
          expect(html.indexOf(`d="${leaf}"`, knot), tag).toBeGreaterThan(knot);
        } else expect(fall, tag).toBe(-1);
        // the placket's buttons under the tie
        for (const m of html.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)" fill="#2b211b"/g)) {
          const [x, y] = [Number(m[1]), Number(m[2])];
          if (Math.abs(x - 299) < 4 && y > 200 && y < 520) expect(m.index!, `${tag} button at ${y}`).toBeLessThan(knot);
        }
        // the band's button, under the knot: not drawn — and drawn with no tie on
        const button = `cy="${c.meet[1] + c.band}" r="${c.bandR}"`;
        expect(html.includes(button), tag).toBe(false);
        expect(draw(body, wearing(ids, neckline)).includes(button), `${tag}, untied`).toBe(true);
      }
    // the order the stage keeps: the placket's buttons, then the tie, then the leaves over it
    expect(GARMENT_LAYERS.indexOf("trim")).toBeLessThan(GARMENT_LAYERS.indexOf("tie"));
    expect(GARMENT_LAYERS.indexOf("tie")).toBeLessThan(GARMENT_LAYERS.indexOf("fall"));
    expect(GARMENT_LAYERS.indexOf("belt")).toBeLessThan(GARMENT_LAYERS.indexOf("tie"));
  });

  it("closes the collar at the top: the knot snug where the leaves meet, its sides under them, its band never showing", () => {
    for (const body of ["female", "male"] as const) {
      const c = COLLARS[body];
      const leaves = leavesOf(body).map(ringsOf);
      // the leaves still meet: each runs to the point where they meet
      for (const ring of leaves) expect(Math.min(...ring.flat().map(([x, y]) => Math.hypot(x - c.meet[0], y - c.meet[1]))), body).toBeLessThan(0.5);
      const tie = shirtTie("necktie", body, c.meet, c.waist);
      const knot = box([tie.knot]);
      const [kt, kb, kh] = NECKTIE[body].knot;
      expect(knot.y0, body).toBeCloseTo(c.meet[1] + KNOT_DROP, 6);
      expect(knot.y1 - knot.y0, body).toBeGreaterThan(kh - 0.01);
      // a knot about 3.6 cm across for her, 4.2 for him; 4 and 4.8 cm tall
      expect(kt * CM, body).toBeGreaterThan(body === "female" ? 3.3 : 3.9);
      expect(kt * CM, body).toBeLessThan(body === "female" ? 3.9 : 4.5);
      expect(kh * CM, body).toBeGreaterThan(body === "female" ? 3.7 : 4.5);
      // its top corners run on under the leaves, either side
      for (const side of [-1, 1]) expect(leaves.some((ring) => insideRings(ring, [c.meet[0] + (side * kt) / 2 - side, c.meet[1] + KNOT_DROP + 1])), `${body} ${side}`).toBe(true);
      // nothing of any tie above the roll line — no band round the neck
      for (const style of ["necktie", "bowtie"] as const)
        for (const [x, y] of shirtTie(style, body, c.meet, c.waist).pieces.flatMap(points)) expect(y, `${body} ${style} at ${x.toFixed(1)}`).toBeGreaterThan(rollAt(body, x));
      expect(kb, body).toBeLessThan(kt);
    }
  });

  it("hangs the necktie straight down the middle, widening gently, to a point at the waist", () => {
    for (const body of ["female", "male"] as const) {
      const c = COLLARS[body];
      const tie = shirtTie("necktie", body, c.meet, c.waist);
      const blade = tie.parts.find((p) => p.id === "blade")!.pieces[0];
      const ring = ringsOf(blade);
      const pts = ring.flat();
      // ends in a point at the waist, on the middle
      const tip = pts.reduce((a, b) => (b[1] > a[1] ? b : a));
      /* the path is written to a tenth of a unit */
      expect(Math.abs(tip[1] - c.waist), body).toBeLessThan(0.1);
      expect(Math.abs(tip[0] - c.meet[0]), body).toBeLessThan(0.1);
      expect(tie.tip, body).toEqual([c.meet[0], c.waist]);
      // straight down the middle: as wide either side of it at every row, and widening down to above the point
      const [, widest] = NECKTIE[body].blade;
      const knotFoot = box([tie.knot]).y1;
      let last = 0;
      for (let y = knotFoot + 1; y < c.waist - widest / 2 - 1; y += 2) {
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
      // gently: from about 2 cm under the knot to 5.5 cm for her, 7.4 for him — under 6° a side
      expect(widest * CM, body).toBeGreaterThan(body === "female" ? 5 : 7);
      expect(widest * CM, body).toBeLessThan(body === "female" ? 6 : 8);
      const [under] = NECKTIE[body].blade;
      expect((Math.atan2((widest - under) / 2, c.waist - widest / 2 - knotFoot) * 180) / Math.PI, body).toBeLessThan(6);
    }
  });

  it("ties her bow tie as the round 24 bow, smaller: right under where the points meet, loops flat sideways, tails 15–20 cm in a slight upside-down V, cut on a slant", () => {
    const c = COLLARS.female;
    const tie = shirtTie("bowtie", "female", c.meet, c.waist);
    const knot = box([tie.knot]);
    expect(knot.y0 - c.meet[1], "right under where the points meet").toBeGreaterThanOrEqual(0);
    expect(knot.y0 - c.meet[1]).toBeLessThan(3);
    expect((knot.x0 + knot.x1) / 2).toBeCloseTo(c.meet[0], 3);
    // a small knot, about 1.8 cm
    expect((knot.x1 - knot.x0) * CM).toBeLessThan(2.2);
    // two loops, flat and sideways: each far wider than it is tall, reaching about 6 cm
    const loops = tie.parts.find((p) => p.id === "loops")!.pieces.map((d) => box([d]));
    for (const l of loops) expect(l.x1 - l.x0).toBeGreaterThan(1.75 * (l.y1 - l.y0));
    expect(tie.reach! * CM).toBeGreaterThan(5.5);
    expect(tie.reach! * CM).toBeLessThan(6.5);
    // two tails, 15–20 cm along them, falling in a slight upside-down V: one each side, 5–15° from upright
    const lines = tie.tailLines!;
    expect(lines.length).toBe(2);
    const sides = new Set<number>();
    for (const line of lines) {
      let length = 0;
      for (let i = 1; i < line.length; i++) length += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
      expect(length * CM).toBeGreaterThan(15);
      expect(length * CM).toBeLessThan(20);
      const [a, b] = [line[0], line[line.length - 1]];
      const angle = (Math.atan2(Math.abs(b[0] - a[0]), b[1] - a[1]) * 180) / Math.PI;
      expect(angle).toBeGreaterThan(5);
      expect(angle).toBeLessThan(15);
      sides.add(Math.sign(b[0] - c.meet[0]));
    }
    expect([...sides].sort()).toEqual([-1, 1]);
    // cut on a slant — each tail's lowest point on its outer side
    expect(RIBBON_BOW.ends).toBe("slant");
    tie.parts
      .filter((p) => p.id.startsWith("tail"))
      .forEach((p, i) => {
        const pts = points(p.pieces[0]);
        const low = pts.reduce((a, b) => (b[1] > a[1] ? b : a));
        const end = lines[i][lines[i].length - 1];
        expect(Math.sign(low[0] - end[0]), `tail ${i}`).toBe(Math.sign(end[0] - c.meet[0]));
      });
  });

  it("ties his bow tie as a classic small butterfly with no tails, right under where the points meet", () => {
    const c = COLLARS.male;
    const tie = shirtTie("bowtie", "male", c.meet, c.waist);
    const all = box(tie.pieces);
    // no tails: nothing below its wings
    expect(all.y1).toBeLessThanOrEqual(tie.at[1] + BUTTERFLY.wing + 0.5);
    expect(tie.tailLines).toBeUndefined();
    // about 11 cm across and 5 cm deep
    expect((all.x1 - all.x0) * CM).toBeGreaterThan(10.5);
    expect((all.x1 - all.x0) * CM).toBeLessThan(11.6);
    expect((all.y1 - all.y0) * CM).toBeGreaterThan(4.5);
    expect((all.y1 - all.y0) * CM).toBeLessThan(5.4);
    expect((all.x0 + all.x1) / 2).toBeCloseTo(c.meet[0], 3);
    // its knot just under where the points meet
    const knot = box([tie.knot]);
    expect(knot.y0 - c.meet[1]).toBeGreaterThan(0);
    expect(knot.y0 - c.meet[1]).toBeLessThan(8);
  });

  it("lights each tie flat and crisp, as the round 24 bows — one flat tone, crisp edges, a narrow sharp shadow, no blur, no relief — in a cloth of its own", () => {
    const uid = (name: string) => `u-${name}`;
    for (const body of ["female", "male"] as const)
      for (const style of ["necktie", "bowtie"] as ShirtTieStyle[]) {
        const tag = `${body} ${style}`;
        const art = collarArt(COLLARS[body].asset)!.cut!({ ...TIED, tie: style }).tie!;
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
    const worn = setTie(wearing(["male-shirt", "male-trousers"]), "male-shirt", "necktie");
    expect(regionsOf(garmentById("male-shirt")!, one(worn, "male-shirt"))).toContain("tie");
    expect(draw("male", worn)).toContain(`-male-shirt-male-shirt-collar-tie-`);
  });

  it("shows a necktie in a jacket's opening, under the jacket", () => {
    for (const [body, ids] of [
      ["male", ["male-shirt", "male-trousers", "male-jacket"]],
      ["female", ["female-blouse", "female-skirt", "female-jacket"]],
    ] as const) {
      const c = COLLARS[body];
      const worn = setTie(wearing([...ids]), ids[0], "necktie");
      const html = draw(body, worn);
      const knot = html.indexOf(`d="${shirtTie("necktie", body, c.meet, c.waist).knot}"`);
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
  });
});
