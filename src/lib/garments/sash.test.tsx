import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MannequinStage } from "@/components/visualizer/MannequinStage";
import { garmentById } from "@/lib/data/garments";
import { fabricById } from "@/lib/data/fabrics";
import { DEFAULT_SKIN_TONE } from "@/lib/data/skinTones";
import { beltsFor, bowPlacesFor } from "@/lib/data/closures";
import { tiesFor } from "@/lib/data/collars";
import { BOW_REACH, SASHED_CUTS, SASHES, isSash, type SashId } from "./closures";
import { NECKLINE_IDS } from "./necklines";
import { BELT_SIDE_IN, DEFAULT_SKIRT, FRONT_X, beltFor, beltWorn, bowPlaceOf, bodiceFor, dressPoints, narrowSkirt, sashFor, sashOf, sashOn, skirtFor, tiePoint } from "./art/female/dressCut";
import { dressFront } from "./art/female/dress";
import { BOW_TAILS, SCARF, TIE_DROP, bowAt, tieAt } from "./art/female/ties";
import { BOW_SHADOW, bowLayers, tieArt } from "./art/female/tieArt";
import type { RegionArt } from "./art/index";
import { Buckle } from "./art/buckle";
import { bodyById } from "@/lib/mannequin/bodies";
import { shapeLengths } from "./skirts";
import { insideRings, ringsOf } from "./stripes";
import {
  beltOf,
  bowAtOf,
  bowPlacesOf,
  choiceOf,
  clothOf,
  cutFrom,
  partsOf,
  regionsOf,
  setBelt,
  setBowAt,
  setNeckline,
  setTie,
  setTieAt,
  tieAtOf,
  tieOf,
  tiePlacesOf,
  wear,
} from "./outfit";
import type { BowAtId, Fabric, FabricRegionId, Outfit, SkirtChoice, WaistId, WornGarment } from "@/types";
import type { Pt } from "./fit";

const dress = garmentById("female-dress")!;
const linen = fabricById("fb-apricot-linen")!;
const black = fabricById("fb-black-crepe")!;
const one = (worn: WornGarment[]) => worn.find((w) => w.garmentId === dress.id)!;
const dressed = (cut: string) => setNeckline(wear([], cutFrom(dress, linen.id)), dress.id, `female-${cut}-neckline`);
const CM = 0.19;
const WAISTS: WaistId[] = ["empire", "natural", "dropped"];
const KINDS = Object.keys(SASHES) as SashId[];
const PLACES: BowAtId[] = ["front", "side"];
/** Both her arms where the photograph is drawn again over the clothes: the forearms' and the hands' zones. */
const ARMS = (["forearm", "hand"] as const).flatMap((z) => ringsOf(bodyById("female").zones[z]!));
const box = (paths: string[]) => {
  const pts = paths.flatMap((d) => ringsOf(d).flat());
  const xs = pts.map(([x]) => x);
  const ys = pts.map(([, y]) => y);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};
/** Where a row, or a column, crosses an outline. */
const xsAt = (rings: Pt[][], y: number) =>
  rings.flatMap((r) =>
    r.flatMap((a, i) => {
      const q = r[(i + 1) % r.length];
      return (a[1] - y) * (q[1] - y) < 0 ? [a[0] + ((y - a[1]) * (q[0] - a[0])) / (q[1] - a[1])] : [];
    })
  );
const ysAt = (rings: Pt[][], x: number) =>
  rings.flatMap((r) =>
    r.flatMap((a, i) => {
      const q = r[(i + 1) % r.length];
      return (a[0] - x) * (q[0] - x) < 0 ? [a[1] + ((x - a[0]) * (q[1] - a[1])) / (q[0] - a[0])] : [];
    })
  );
const lengthOf = (line: Pt[]) => line.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - line[i][0], p[1] - line[i][1]), 0);
/** How far from vertical a line runs, in degrees — to the right positive — from its start to `upTo` of the way along. */
const angleOf = (line: Pt[], upTo = 1) => {
  const [a, b] = [line[0], line[Math.round(upTo * (line.length - 1))]];
  return (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI;
};
const draw = (worn: WornGarment[], cloths: Partial<Record<FabricRegionId, Fabric>> = {}) => {
  const regions: Partial<Record<FabricRegionId, Fabric>> = {};
  for (const r of regionsOf(dress, one(worn))) regions[r] = cloths[r] ?? fabricById(clothOf(one(worn), r) ?? one(worn).fabrics[r] ?? linen.id) ?? linen;
  const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
  return renderToStaticMarkup(<MannequinStage outfit={outfit} fabrics={{ [dress.id]: regions }} zoom={1} focus={[300, 500]} />);
};

describe("the sash and the belt bow", () => {
  it("names the sash «حزام فيونكة» and the ribbon «شريطة» among the belts, and the bow's places «من الأمام · من الجنب»; the scarf tie keeps «وشاح»", () => {
    expect(beltsFor(dress, "round").map((b) => [b.id, b.name.ar])).toEqual([
      ["none", "بدون"],
      ["self", "قماش"],
      ["brown", "جلد بني"],
      ["black", "جلد أسود"],
      ["sash", "حزام فيونكة"],
      ["ribbon", "شريطة"],
    ]);
    expect(bowPlacesFor(["front", "side"]).map((p) => p.name.ar)).toEqual(["من الأمام", "من الجنب"]);
    expect(tiesFor(dress.ties!.offered).find((t) => t.id === "scarf")!.name.ar).toBe("وشاح");
    // a sash about 6 cm, a ribbon about 3
    expect(SASHES.sash.width * CM).toBeGreaterThan(5);
    expect(SASHES.sash.width * CM).toBeLessThan(7);
    expect(SASHES.ribbon.width * CM).toBeGreaterThan(2.5);
    expect(SASHES.ribbon.width * CM).toBeLessThan(3.5);
  });

  it("is tied at the front or at her side, as chosen — a wrap's at its side alone, and the wrap wears its sash whatever belt is asked for", () => {
    expect(SASHED_CUTS).toEqual(["wrap"]);
    for (const cut of NECKLINE_IDS) {
      const plain = one(dressed(cut));
      const sashed = one(setBelt(dressed(cut), dress.id, "sash"));
      const ribboned = one(setBelt(dressed(cut), dress.id, "ribbon"));
      if (cut === "wrap") {
        // its sash, always: no other belt, and no choice of place
        expect(beltsFor(dress, cut).map((b) => b.id)).toEqual(["sash"]);
        expect([beltOf(plain), beltOf(sashed), beltOf(ribboned), beltOf(one(setBelt(dressed(cut), dress.id, "brown")))]).toEqual(["sash", "sash", "sash", "sash"]);
        expect([bowPlacesOf(plain), bowAtOf(plain)]).toEqual([["side"], "side"]);
        expect(bowAtOf(one(setBowAt(dressed(cut), dress.id, "front")))).toBe("side");
        expect(choiceOf(plain)).toMatchObject({ belt: "sash", bowAt: "side" });
        expect(sashOf({ neckline: cut })).toBe("sash");
        expect(beltWorn({ neckline: cut, belt: "brown" })).toBe("sash");
        expect(bowPlaceOf({ neckline: cut, bowAt: "front" })).toBe("side");
      } else {
        expect([beltOf(plain), bowPlacesOf(plain), bowAtOf(plain)], cut).toEqual(["none", [], undefined]);
        expect([beltOf(sashed), bowPlacesOf(sashed), bowAtOf(sashed)], cut).toEqual(["sash", ["front", "side"], "front"]);
        expect([beltOf(ribboned), bowAtOf(one(setBowAt([ribboned], dress.id, "side")))], cut).toEqual(["ribbon", "side"]);
        expect(choiceOf(one(setBowAt([sashed], dress.id, "side"))), cut).toMatchObject({ belt: "sash", bowAt: "side" });
        expect(choiceOf(plain).bowAt, cut).toBeUndefined();
        expect(sashOf({ neckline: cut }), cut).toBeUndefined();
        expect(sashOf({ neckline: cut, belt: "ribbon" }), cut).toBe("ribbon");
        expect(beltWorn({ neckline: cut, belt: "brown" }), cut).toBe("brown");
      }
    }
    // the place chosen waits out a cut that cannot take it, and comes back
    let worn = setBowAt(setBelt(dressed("round"), dress.id, "sash"), dress.id, "side");
    worn = setNeckline(worn, dress.id, "female-wrap-neckline");
    expect([beltOf(one(worn)), bowAtOf(one(worn))]).toEqual(["sash", "side"]);
    worn = setNeckline(worn, dress.id, "female-v-neckline");
    expect([beltOf(one(worn)), bowAtOf(one(worn))]).toEqual(["sash", "side"]);
    // and a leather belt chosen before a wrap comes back after it
    const leather = setNeckline(setNeckline(setBelt(dressed("round"), dress.id, "black"), dress.id, "female-wrap-neckline"), dress.id, "female-round-neckline");
    expect(beltOf(one(leather))).toBe("black");
  });

  it("takes a cloth of its own, the skirt's to begin with, and no tie on it: a tie on the belt moves to the neck or comes off", () => {
    const sashed = one(setBelt(dressed("round"), dress.id, "sash"));
    expect(partsOf(sashed)).toContain("belt");
    expect(regionsOf(dress, sashed)).toEqual(["top", "bottom", "belt"]);
    expect(clothOf(sashed, "belt")).toBe(linen.id);
    expect(regionsOf(dress, one(dressed("wrap")))).toEqual(["top", "bottom", "belt"]);
    expect(isSash(beltOf(one(dressed("wrap"))))).toBe(true);
    // a sash is tied in its own bow: the tie keeps the neck alone
    expect(tiePlacesOf(sashed)).toEqual(["neck"]);
    let worn = setTieAt(setTie(setBelt(dressed("round"), dress.id, "self"), dress.id, "knot"), dress.id, "belt-side");
    expect(tieAtOf(one(worn))).toBe("belt-side");
    worn = setBelt(worn, dress.id, "sash");
    expect([tieOf(one(worn)), tieAtOf(one(worn))]).toEqual(["knot", "neck"]);
    // on a sweetheart, with no neck, it comes off
    const sweet = setBelt(setTieAt(setTie(setBelt(dressed("sweetheart"), dress.id, "self"), dress.id, "knot"), dress.id, "belt-front"), dress.id, "ribbon");
    expect([one(sweet).tie, tieOf(one(sweet)), tiePlacesOf(one(sweet))]).toEqual([undefined, undefined, []]);
  });

  it("is a band its cloth's width round the waist where a belt is, gathered in under the knot, tied at the centre front or in from her left", () => {
    for (const kind of KINDS)
      for (const place of PLACES)
        for (const shape of dress.skirt!.shapes)
          for (const length of shapeLengths(shape, dress.skirt!.lengths))
            for (const waist of WAISTS) {
              const skirt: SkirtChoice = { shape, length, waist };
              const tag = `${kind} ${place} ${shape} ${length} ${waist}`;
              const s = sashOn(skirt, kind, place);
              const b = beltFor(skirt);
              const w = SASHES[kind].width;
              expect(s.bottom - s.top, tag).toBe(w);
              expect(s.mid, tag).toBe(b.mid);
              const sk = skirtFor(undefined, skirt);
              expect(s.top, tag).toBeLessThan(sk.waistY);
              expect(s.bottom, tag).toBeGreaterThan(sk.waistY + 3);
              // its ends where the belt's are, row for row where they share one, and on its outline
              const band = ringsOf(s.path);
              for (const [x, y] of s.left) {
                const beltRow = b.left.find(([, by]) => Math.abs(by - y) < 0.01);
                if (beltRow) expect(x, `${tag} y ${y}`).toBeCloseTo(beltRow[0], 6);
                expect(band.flat().some(([px, py]) => Math.abs(px - x) < 0.01 && Math.abs(py - y) < 0.01), `${tag} y ${y}`).toBe(true);
              }
              // its depth: nearly full away from the knot, the knot's height under it
              const depthAt = (x: number) => {
                const ys = ysAt(band, x);
                return Math.max(...ys) - Math.min(...ys);
              };
              expect(depthAt(s.knot[0] - 1.6 * w), tag).toBeGreaterThan(w - 1.2);
              expect(depthAt(s.knot[0]), tag).toBeLessThan(w - 1);
              expect(depthAt(s.knot[0]), tag).toBeGreaterThan(0.6 * w);
              // the knot on its middle row, at the front or in from her left end — where every tie on a belt is knotted
              expect(s.knot[1], tag).toBe(s.mid);
              expect(insideRings(band, s.knot), tag).toBe(true);
              const points = dressPoints({ neckline: "round", belt: "self", skirt });
              if (place === "front") expect(s.knot[0], tag).toBe(FRONT_X);
              else {
                expect(s.knot, tag).toEqual(points.find((p) => p.kind === "belt-side")!.at);
                const end = Math.max(...band.flat().filter(([, y]) => Math.abs(y - s.mid) < 1.5).map(([x]) => x));
                expect(end - s.knot[0], tag).toBeGreaterThan(BELT_SIDE_IN - 0.01);
                expect(s.knot[0] - FRONT_X, tag).toBeGreaterThan(20);
              }
              expect(s.bow.width, tag).toBe(w);
              expect(s.bow.reach, tag).toBe(BOW_REACH[place]);
            }
  }, 60_000);

  it("ties the belt bow as the photos': soft loops widening and drooping to a dimpled end, folds fanning from the knot; long tails crossing under the knot and spreading in an upside-down V, twisting, cut on a slant or notched", () => {
    const at: Pt = [300, 344];
    for (const w of [SASHES.sash.width, SASHES.ribbon.width])
      for (const [place, fitted] of [
        ["front", false],
        ["front", true],
        ["side", false],
      ] as [BowAtId, boolean][]) {
        const tag = `${w} ${place}${fitted ? ", narrow" : ""}`;
        const bow = bowAt(at, place, w, fitted);
        expect(bow.pieces, tag).toEqual([...bow.parts.tails, ...bow.parts.loops, bow.parts.knot]);
        // the knot: a little narrower than the cloth, centred
        const knot = box([bow.parts.knot]);
        expect(knot.x1 - knot.x0, tag).toBeGreaterThan(0.6 * w);
        expect(knot.x1 - knot.x0, tag).toBeLessThan(w);
        expect((knot.x0 + knot.x1) / 2, tag).toBeCloseTo(at[0], 3);
        // the loops: mirrored, reaching as declared — 10.6 cm at the front, 7 at the side — as tall as the cloth and a little more
        const loops = box(bow.parts.loops);
        expect(Math.abs(loops.x1 - at[0] - BOW_REACH[place]), tag).toBeLessThan(1);
        expect(Math.abs(at[0] - loops.x0 - BOW_REACH[place]), tag).toBeLessThan(1);
        expect(loops.y1 - loops.y0, tag).toBeGreaterThan(1.1 * w);
        expect(loops.y1 - loops.y0, tag).toBeLessThan(1.45 * w);
        // each loop, not a box: widening to its outer end, drooping there, its end dimpled where the cloth folds back
        const loop = ringsOf(bow.parts.loops[0]);
        const column = (x: number) => {
          const ys = ysAt(loop, x);
          return { span: Math.max(...ys) - Math.min(...ys), mid: (Math.max(...ys) + Math.min(...ys)) / 2 };
        };
        const [nearKnot, nearEnd] = [column(at[0] - 0.4 * w), column(at[0] - BOW_REACH[place] + 0.25 * w)];
        expect(nearEnd.span, tag).toBeGreaterThan(1.4 * nearKnot.span);
        expect(nearEnd.mid, tag).toBeGreaterThan(at[1] + 1);
        const tips: number[] = [];
        for (let y = loops.y0 + 0.5; y < loops.y1 - 0.5; y += 0.5) tips.push(Math.min(...xsAt(loop, y)));
        const dimpled = tips.some((x, i) => x >= Math.min(...tips.slice(0, i + 1)) + 0.04 * w && x >= Math.min(...tips.slice(i)) + 0.04 * w);
        expect(dimpled, tag).toBe(true);
        // folds fanning out from the knot: a loop's outer two crests further apart at its end than at the knot
        const fan = bow.folds.loops.slice(0, 6).filter((f) => f[4] <= 1);
        const spread = (k: number) => Math.abs(fan[2][0][k][1] - fan[0][0][k][1]);
        expect(spread(fan[0][0].length - 1), tag).toBeGreaterThan(1.8 * spread(0));

        // the tails: the longer in front, crossing over the other under the knot — each leaves from the side the other falls to
        const [back, front] = bow.tailLines;
        expect(lengthOf(front), tag).toBeGreaterThan(lengthOf(back));
        expect(Math.sign(front[0][0] - back[0][0]), tag).toBe(-Math.sign(front[front.length - 1][0] - back[back.length - 1][0]));
        // 30–40 cm along each, 2–6 cm apart
        for (const l of [back, front]) {
          expect(lengthOf(l) * CM, tag).toBeGreaterThan(30);
          expect(lengthOf(l) * CM, tag).toBeLessThan(40);
        }
        expect((lengthOf(front) - lengthOf(back)) * CM, tag).toBeGreaterThan(2);
        expect((lengthOf(front) - lengthOf(back)) * CM, tag).toBeLessThan(6);
        // an upside-down V, one falling to each side
        expect(Math.sign(angleOf(back)), tag).toBe(-Math.sign(angleOf(front)));
        if (place === "front") {
          // about 25° from vertical over a full skirt, about 20° over a narrow one
          for (const l of [back, front]) {
            expect(Math.abs(angleOf(l)), tag).toBeGreaterThan(fitted ? 18 : 23);
            expect(Math.abs(angleOf(l)), tag).toBeLessThan(30);
          }
        } else {
          // at her side: the one falling in over the skirt about 25°; the one falling out leaving near 20° and easing toward vertical
          const [inward, outward] = angleOf(back) < 0 ? [back, front] : [front, back];
          expect(Math.abs(angleOf(inward)), tag).toBeGreaterThan(22);
          expect(Math.abs(angleOf(inward)), tag).toBeLessThan(30);
          expect(Math.abs(angleOf(outward, 0.25)), tag).toBeGreaterThan(17);
          expect(Math.abs(angleOf(outward)), tag).toBeGreaterThan(10);
        }
        bow.tailLines.forEach((l, k) => {
          const rings = ringsOf(bow.parts.tails[k]);
          // narrowing halfway down, where it twists
          const across = (t: number) => {
            const xs = xsAt(rings, l[Math.round(t * (l.length - 1))][1]);
            return Math.max(...xs) - Math.min(...xs);
          };
          expect(across(0.5), tag).toBeLessThan(0.88 * Math.min(across(0.3), across(0.72)));
          // its end: on a slant, the outer corner lower — or, a ribbon's, notched in a V
          const end = l[l.length - 1];
          const [ax, ay] = [end[0] - l[l.length - 2][0], end[1] - l[l.length - 2][1]];
          const al = Math.hypot(ax, ay);
          const along: Pt = [ax / al, ay / al];
          const dir = Math.sign(end[0] - l[0][0]);
          const out: Pt = -along[1] * dir >= 0 ? [-along[1], along[0]] : [along[1], -along[0]];
          const pts = rings.flat().map(([x, y]) => ({ down: (x - end[0]) * along[0] + (y - end[1]) * along[1], across: (x - end[0]) * out[0] + (y - end[1]) * out[1] }));
          const lowest = (keep: (p: { across: number }) => boolean) => Math.max(...pts.filter(keep).map((p) => p.down));
          if (bow.ends === "slant") expect(lowest((p) => p.across > 0.3 * w) - lowest((p) => p.across < -0.3 * w), tag).toBeGreaterThan(0.2 * w);
          else {
            expect(lowest((p) => Math.abs(p.across) < 0.08 * w), tag).toBeLessThan(-0.3 * w);
            expect(lowest((p) => p.across > 0.35 * w), tag).toBeGreaterThan(-0.1 * w);
            expect(lowest((p) => p.across < -0.35 * w), tag).toBeGreaterThan(-0.1 * w);
          }
        });
        expect(bow.ends, tag).toBe(w < 20 ? "notch" : "slant");
        // every fold crisp: a crest no softer than 1 over a broad turn no softer than 2
        for (const f of [...bow.folds.tails.flat(), ...bow.folds.loops, ...bow.folds.knot]) expect(f[4], tag).toBeLessThanOrEqual(2);
        for (const t of bow.folds.tails) expect(t.filter((f) => f[4] <= 1).length, tag).toBeGreaterThanOrEqual(5);
        expect(bow.folds.loops.filter((f) => f[4] <= 1).length, tag).toBeGreaterThanOrEqual(8);
      }
    expect(BOW_REACH.front * CM).toBeGreaterThan(10);
    expect(BOW_REACH.front * CM).toBeLessThan(11.5);
    expect(BOW_REACH.side * CM).toBeGreaterThan(6.5);
    expect(BOW_REACH.side * CM).toBeLessThan(7.5);
    expect(BOW_TAILS.map((t) => t * CM)).toEqual([36.1, 32.3].map((v) => expect.closeTo(v, 1)));
  });

  it("sizes a tie for where it is knotted: at the neck as before; on a belt, the knot is the belt bow and the scarf a sash's cloth", () => {
    const at: Pt = [300, 344];
    // the knot on a belt is the bow, at the front and at the side — and over a narrow skirt at the front, its narrower V
    expect(tieAt("knot", at, "belt-front").pieces).toEqual(bowAt(at, "front").pieces);
    expect(tieAt("knot", at, "belt-side").pieces).toEqual(bowAt(at, "side").pieces);
    expect(tieAt("knot", at, "belt-front", true).pieces).toEqual(bowAt(at, "front", SASHES.sash.width, true).pieces);
    expect(bowAt(at, "front", SASHES.sash.width, true).pieces).not.toEqual(bowAt(at, "front").pieces);
    // a narrow skirt is a pencil or a mermaid
    expect(dress.skirt!.shapes.filter((shape) => narrowSkirt({ ...DEFAULT_SKIRT, shape }))).toEqual(["pencil", "mermaid"]);
    // and drawn so: a knot on a fabric belt over a pencil skirt in the narrow V, over a flared one in the full V
    for (const shape of ["pencil", "flared"] as const) {
      const worn = setTieAt(setTie(setBelt(dressed("round"), dress.id, "self"), dress.id, "knot"), dress.id, "belt-front").map((x) => (x.garmentId === dress.id ? { ...x, skirt: { ...DEFAULT_SKIRT, shape } } : x));
      const html = draw(worn);
      const point = tiePoint(choiceOf(one(worn)))!;
      const narrow = shape === "pencil";
      expect(html, shape).toContain(`d="${tieAt("knot", point, "belt-front", narrow).parts.tails![1]}"`);
      expect(html, shape).not.toContain(`d="${tieAt("knot", point, "belt-front", !narrow).parts.tails![1]}"`);
    }
    // at the neck, the small bow it always was: about 6 cm across, 5.6 below its point
    const neck = box(tieAt("knot", at).pieces);
    expect((neck.x1 - neck.x0) * CM).toBeLessThan(7);
    expect(neck.y1 - at[1]).toBeCloseTo(TIE_DROP.knot, 6);
    expect(tieAt("knot", at, "neck").pieces).toEqual(tieAt("knot", at).pieces);
    // the scarf on a belt: a knot about 7 cm, tails 30 to 40 cm; at the neck as it was
    const scarf = tieAt("scarf", at, "belt-front");
    const knot = box([scarf.parts.knot]);
    expect((knot.x1 - knot.x0) * CM).toBeGreaterThan(5.5);
    expect((knot.x1 - knot.x0) * CM).toBeLessThan(7);
    const [l, r] = scarf.parts.tails!.map((d) => box([d]));
    for (const t of [l, r]) {
      expect((t.y1 - at[1]) * CM).toBeGreaterThan(30);
      expect((t.y1 - at[1]) * CM).toBeLessThan(40);
    }
    expect((l.y1 - r.y1) * CM).toBeGreaterThan(3);
    expect(tieAt("scarf", at, "belt-side").pieces).toEqual(scarf.pieces);
    const small = box(tieAt("scarf", at).pieces);
    expect(small.y1 - at[1]).toBeCloseTo(TIE_DROP.scarf, 6);
    expect(tieAt("scarf", at, "neck").pieces).toEqual([...[SCARF.long, SCARF.short].map(() => expect.any(String)), expect.any(String)]);
    // the necktie is the necktie wherever it is asked for
    expect(tieAt("necktie", at, "belt-front").pieces).toEqual(tieAt("necktie", at).pieces);
  });

  it("fits the bow on the dress — on the bodice, the band and the skirt, clear of both her arms — at the front and at her side, over every skirt, and hangs it in front of the skirt's folds", () => {
    for (const kind of KINDS)
      for (const shape of dress.skirt!.shapes)
        for (const length of shapeLengths(shape, dress.skirt!.lengths))
          for (const waist of WAISTS)
            for (const place of PLACES) {
              const skirt: SkirtChoice = { shape, length, waist };
              const tag = `${kind} ${place} ${shape} ${length} ${waist}`;
              const s = sashOn(skirt, kind, place);
              const band = ringsOf(s.path);
              const body = ringsOf(bodiceFor("round", undefined, waist).pieces[0]);
              const sk = ringsOf(skirtFor(undefined, skirt).path);
              for (const d of s.bow.pieces)
                for (const q of ringsOf(d).flat()) {
                  expect(insideRings(body, q) || insideRings(band, q) || insideRings(sk, q), `${tag} at ${q.map((v) => v.toFixed(1))}`).toBe(true);
                  expect(insideRings(ARMS, q), `${tag} on her arm at ${q.map((v) => v.toFixed(1))}`).toBe(false);
                }
            }
    // drawn with the skirt, over it, after the skirt's own cloth — so the tails hang in front of its folds
    const worn = setBowAt(setBelt(dressed("round"), dress.id, "sash"), dress.id, "side");
    const html = draw(worn, { belt: black });
    const s = sashFor(choiceOf(one(worn)))!;
    const skirtAt = html.indexOf(`d="${skirtFor(undefined, DEFAULT_SKIRT).path}"`);
    const bandAt = html.indexOf(`d="${s.path}"`);
    const knotAt = html.indexOf(`d="${s.bow.parts.knot}"`);
    expect(skirtAt).toBeGreaterThan(0);
    expect(bandAt).toBeGreaterThan(skirtAt);
    expect(knotAt).toBeGreaterThan(bandAt);
    for (const d of s.bow.pieces) expect(html).toContain(`d="${d}"`);
    expect(html).toContain("female-dress-bottom-over");
  }, 60_000);

  it("draws a sash with no buckle, in the belt's cloth, and the wrap's in place of its old knot", () => {
    const regions = dressFront.cut!({ belt: "sash", bowAt: "front", skirt: DEFAULT_SKIRT });
    const over = regions.bottom!.over!;
    expect([over.cloth, over.solid, over.outline]).toEqual(["belt", undefined, "soft"]);
    const buckle = renderToStaticMarkup(<svg><Buckle {...beltFor(DEFAULT_SKIRT).buckle} /></svg>).replace(/^<svg>|<\/svg>$/g, "");
    expect(renderToStaticMarkup(<>{dressFront.cutTrim!({ belt: "self" })}</>)).toContain(buckle);
    for (const belt of ["sash", "ribbon"] as const) expect(renderToStaticMarkup(<>{dressFront.cutTrim!({ belt })}</>)).not.toContain(buckle);
    // the wrap: its sash at its side over the skirt, and nothing of its own over the bodice any more
    for (const waist of WAISTS) {
      const wrap = dressFront.cut!({ neckline: "wrap", skirt: { ...DEFAULT_SKIRT, waist } });
      expect(wrap.top!.over, waist).toBeUndefined();
      expect(wrap.bottom!.over!.cloth, waist).toBe("belt");
      const s = sashOn({ ...DEFAULT_SKIRT, waist }, "sash", "side");
      const html = draw(setNeckline(wear([], cutFrom(dress, linen.id)), dress.id, "female-wrap-neckline").map((w) => (w.garmentId === dress.id ? { ...w, skirt: { ...DEFAULT_SKIRT, waist } } : w)));
      for (const d of s.bow.pieces) expect(html, waist).toContain(`d="${d}"`);
      expect(html, waist).toContain(`d="${s.path}"`);
    }
    // a belt asked for on a wrap draws its sash all the same
    expect(dressFront.cut!({ neckline: "wrap", belt: "black" }).bottom!.over!.solid).toBeUndefined();
    // and the tie at the neck of a wrap stays where it was
    expect(tiePoint({ neckline: "wrap", tie: "scarf", tieAt: "neck" })).toEqual(dressPoints({ neckline: "wrap" })[0].at);
  });

  it("gathers the band where the bow pulls it: folds drawing in toward the knot, on the band, showing past the loops at her side", () => {
    for (const kind of KINDS)
      for (const place of PLACES)
        for (const waist of WAISTS) {
          const tag = `${kind} ${place} ${waist}`;
          const s = sashOn({ ...DEFAULT_SKIRT, waist }, kind, place);
          const band = ringsOf(s.path);
          const w = SASHES[kind].width;
          expect(s.gathers.length, tag).toBeGreaterThanOrEqual(3);
          for (const [ridge, , , , soft] of s.gathers) {
            for (const q of ridge) expect(insideRings(band, q), `${tag} at ${q.map((v) => v.toFixed(1))}`).toBe(true);
            // drawing in: nearer the knot, nearer the band's middle row
            const [far, , near] = ridge;
            expect(Math.abs(near[0] - s.knot[0]), tag).toBeLessThan(Math.abs(far[0] - s.knot[0]));
            expect(Math.abs(near[1] - s.mid), tag).toBeLessThanOrEqual(Math.abs(far[1] - s.mid) + 1e-9);
            expect(soft, tag).toBeLessThanOrEqual(2);
          }
          if (place === "side") {
            // toward the front they start well past the loops' end, where they show
            const inner = s.gathers.filter(([ridge]) => ridge[0][0] < s.knot[0]);
            expect(inner.length, tag).toBeGreaterThanOrEqual(3);
            for (const [ridge] of inner) expect(s.knot[0] - ridge[0][0], tag).toBeGreaterThan(s.bow.reach + 0.4 * w);
          }
        }
    // a sash's band visibly drawn in just past its loops at her side
    const s = sashOn(DEFAULT_SKIRT, "sash", "side");
    const ys = ysAt(ringsOf(s.path), s.knot[0] - s.bow.reach - 1);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(SASHES.sash.width - 1);
  });

  it("draws and lights the belt bow crisply in any cloth — the knot a tie makes on a belt exactly as a sash's: a narrow sharp shadow, no surface, light only on what shows of each part", () => {
    const uid = (name: string) => `t-${name}`;
    const at: Pt = [300, 344];
    for (const [where, place] of [
      ["belt-front", "front"],
      ["belt-side", "side"],
    ] as const) {
      const art = tieArt("knot", at, where);
      const layers = bowLayers(bowAt(at, place));
      for (const pass of ["defs", "shading", "light"] as const) {
        expect(renderToStaticMarkup(<svg>{art[pass]!(uid)}</svg>), `${where} ${pass}`).toBe(renderToStaticMarkup(<svg>{layers[pass](uid)}</svg>));
      }
      expect(art.shadow, where).toEqual(BOW_SHADOW);
      expect(art.surface, where).toBeUndefined();
      // light only on what shows: the edge light and the folds' in each part's own mask — two tails, the loops, the knot
      const light = renderToStaticMarkup(<svg>{layers.light(uid)}</svg>);
      expect(light.split('<g mask="url(#t-bow-').length - 1, where).toBe(4);
      expect(light.split("url(#t-crisp-edge)").length - 1, where).toBe(4);
    }
    // the knot at the neck is lit as it always was, not as the bow
    expect(renderToStaticMarkup(<svg>{tieArt("knot", at).shading!(uid)}</svg>)).not.toBe(renderToStaticMarkup(<svg>{tieArt("knot", at, "belt-front").shading!(uid)}</svg>));
    // the shadow under the bow's edges narrow and sharp, so a dark or printed bow keeps its edges
    expect(BOW_SHADOW.soft).toBeLessThanOrEqual(1);
    expect(BOW_SHADOW.width).toBeLessThanOrEqual(3);
    // a sash the same: the region's shadow the bow's, and no surface to soften its print
    for (const place of PLACES) {
      const sash = dressFront.cut!({ belt: "sash", bowAt: place }).bottom!.over!;
      expect(sash.shadow, place).toEqual(BOW_SHADOW);
      expect(sash.surface, place).toBeUndefined();
    }
  });

  it("draws the sash's bow where it is tied, however often it is moved", () => {
    const shapeOf = (over: RegionArt) => renderToStaticMarkup(<svg>{over.shape("#fff")}</svg>);
    const empire: SkirtChoice = { ...DEFAULT_SKIRT, waist: "empire" };
    for (const [skirt, order] of [
      [DEFAULT_SKIRT, ["front", "side"]],
      [empire, ["side", "front"]],
    ] as [SkirtChoice, BowAtId[]][]) {
      for (const place of [...order, ...order]) {
        const over = dressFront.cut!({ belt: "sash", bowAt: place, skirt }).bottom!.over!;
        expect(shapeOf(over), `${skirt.waist} ${place}`).toContain(`d="${sashOn(skirt, "sash", place).bow.parts.knot}"`);
      }
    }
  });
});
