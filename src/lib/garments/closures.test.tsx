import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { garmentById, garments } from "@/lib/data/garments";
import { beltsFor, buttonsFor } from "@/lib/data/closures";
import { NECKLINE_IDS } from "./necklines";
import { BELT_WIDTH, BUTTONED_CUTS, BUTTON_LAST, LEATHER, PLACKET_HALF } from "./closures";
import { HEM_AT, shapeLengths } from "./skirts";
import { beltOf, buttonsOf, cutFrom, setBelt, setButtons, setNeckline, wear } from "./outfit";
import {
  FRONT_X,
  PANEL,
  across,
  beltFor,
  bodiceFor,
  cloth,
  covers,
  frontButtons,
  seamAt,
  skirtFor,
  skirtPlacketFor,
} from "./art/female/dressCut";
import { dressFront, skirtFolds } from "./art/female/dress";
import { bowCollarFront } from "./art/female/collars/bow";
import { BODY_CANVAS } from "../mannequin/bodies";
import type { BeltId, ButtonsId, SkirtChoice, WaistId } from "@/types";

const cm = (u: number) => u * BODY_CANVAS.cmPerUnit;
const dress = garmentById("female-dress")!;
const WAISTS: WaistId[] = ["empire", "natural", "dropped"];
/** Every skirt the dress is cut with, at every waist. */
const SKIRTS: SkirtChoice[] = WAISTS.flatMap((waist) =>
  dress.skirt!.shapes.flatMap((shape) => shapeLengths(shape, dress.skirt!.lengths).map((length) => ({ shape, length, waist })))
);
const placketOf = (cut: string, waist: WaistId) => frontButtons({ neckline: cut, skirt: { shape: "flared", length: "midi", waist }, buttons: "hem" });

describe("buttons and belt: what is offered", () => {
  it("offers buttons on the seven cuts with a straight centre front, the shirt-dress always buttoned, and a belt on every cut — the wrap its sash alone", () => {
    expect(dress.buttons).toEqual({ offered: ["none", "waist", "hem"], default: "none", rows: ["one", "two"] });
    expect(dress.belts).toEqual({ offered: ["none", "self", "brown", "black", "sash", "ribbon"], default: "none" });
    /* not the keyhole, which closes with its own button and loop; not the halter, wrap, cowl or one-shoulder */
    expect([...BUTTONED_CUTS].sort()).toEqual(["boat", "collared", "high", "off-shoulder", "round", "scoop", "square", "sweetheart", "v"]);
    for (const cut of ["keyhole", "halter", "wrap", "cowl", "asymmetrical"]) expect(buttonsFor(dress, cut), cut).toEqual([]);
    /* over a mermaid, to the waist only: its flare is cut in panels */
    expect(buttonsFor(dress, "round", "mermaid").map((b) => b.id)).toEqual(["none", "waist"]);
    expect(buttonsFor(dress, "collared", "mermaid").map((b) => b.id)).toEqual(["waist"]);
    for (const shape of dress.skirt!.shapes.filter((s) => s !== "mermaid")) {
      expect(buttonsFor(dress, "round", shape).map((b) => b.id), shape).toEqual(["none", "waist", "hem"]);
    }
    for (const cut of NECKLINE_IDS) {
      const buttons = buttonsFor(dress, cut).map((b) => b.id);
      const want = cut === "collared" ? ["waist", "hem"] : BUTTONED_CUTS.includes(cut) ? ["none", "waist", "hem"] : [];
      expect(buttons, cut).toEqual(want);
      expect(beltsFor(dress, cut).map((b) => b.id), cut).toEqual(cut === "wrap" ? ["sash"] : ["none", "self", "brown", "black", "sash", "ribbon"]);
    }
    expect(buttonsFor(dress, "round").map((b) => b.name.ar)).toEqual(["بدون", "حتى الخصر", "حتى الأسفل"]);
    expect(beltsFor(dress, "round").map((b) => b.name.ar)).toEqual(["بدون", "قماش", "جلد بني", "جلد أسود", "حزام فيونكة", "شريطة"]);
    /* nothing else takes either */
    for (const g of garments) if (g.id !== "female-dress") expect([g.buttons, g.belts], g.id).toEqual([undefined, undefined]);
  });

  it("is a choice on the worn dress, resolved against its cut when read, and waits out a cut that cannot take it", () => {
    let worn = wear([], cutFrom(dress, "fb-apricot-linen"));
    expect([buttonsOf(worn[0]), beltOf(worn[0])]).toEqual(["none", "none"]);
    worn = setBelt(setButtons(worn, dress.id, "hem"), dress.id, "brown");
    expect([buttonsOf(worn[0]), beltOf(worn[0])]).toEqual(["hem", "brown"]);
    /* a wrap: no buttons, and its own sash for a belt whatever was chosen — and both come back with a cut that takes them */
    const wrap = setNeckline(worn, dress.id, "female-wrap-neckline");
    expect([buttonsOf(wrap[0]), beltOf(wrap[0])]).toEqual([undefined, "sash"]);
    expect(beltOf(setNeckline(wrap, dress.id, "female-v-neckline")[0])).toBe("brown");
    const cowl = setNeckline(worn, dress.id, "female-cowl-neckline");
    expect([buttonsOf(cowl[0]), beltOf(cowl[0])]).toEqual([undefined, "brown"]);
    expect(buttonsOf(setNeckline(wrap, dress.id, "female-v-neckline")[0])).toBe("hem");
    /* the shirt-dress arrives buttoned to the waist and is never without its buttons */
    const shirt = setNeckline(wear([], cutFrom(dress, "fb-apricot-linen")), dress.id, "female-collared-neckline");
    expect(buttonsOf(shirt[0])).toBe("waist");
    expect(buttonsOf(setButtons(shirt, dress.id, "none")[0])).toBe("waist");
    expect(buttonsOf(setButtons(shirt, dress.id, "hem")[0])).toBe("hem");
    /* to the hem over a mermaid is to the waist, and to the hem again over a skirt that opens */
    const mermaid = worn.map((w) => ({ ...w, skirt: { shape: "mermaid" as const, length: "midi" as const, waist: "natural" as const } }));
    expect(buttonsOf(mermaid[0])).toBe("waist");
    expect(buttonsOf({ ...mermaid[0], skirt: { ...mermaid[0].skirt, shape: "pleated" } })).toBe("hem");
    expect(buttonsOf(setButtons(mermaid, dress.id, "none")[0])).toBe("none");
  });
});

describe("buttons and belt: the dress as it arrives is untouched", () => {
  it("draws the dress unbuttoned and unbelted exactly as before, and the shirt-dress's own buttons at her waist", () => {
    for (const id of NECKLINE_IDS) {
      expect(bodiceFor(id, undefined, "natural", "none"), id).toBe(bodiceFor(id));
      expect(cloth({ neckline: id, buttons: "none", belt: "none" }), id).toEqual(cloth({ neckline: id }));
    }
    expect(frontButtons({}).groups).toEqual([]);
    expect(dressFront.cut!({ buttons: "none", belt: "none" })).toEqual(dressFront.cut!({}));
    const own = bodiceFor("collared").cut.buttons!;
    expect(frontButtons({ neckline: "collared", buttons: "waist" }).groups).toEqual([own]);
    expect(frontButtons({ neckline: "collared" }).groups).toEqual([own]);
    expect(renderToStaticMarkup(<>{dressFront.cutTrim!({ neckline: "collared", buttons: "waist" })}</>)).toBe(
      renderToStaticMarkup(<>{dressFront.cutTrim!({ neckline: "collared" })}</>)
    );
  });
});

describe("buttons down the front", () => {
  it("sews a 3 cm placket down the centre front of every buttoned cut, on the bodice and never in its opening", () => {
    for (const cut of BUTTONED_CUTS.filter((c) => c !== "collared")) {
      for (const waist of WAISTS) {
        const b = bodiceFor(cut, undefined, waist, "waist");
        const p = b.placket!;
        const name = `${cut} · ${waist}`;
        expect(b.pieces[1], name).toBe(p.path);
        expect(p.foot, name).toBe(seamAt(waist));
        const body = b.pieces[0];
        for (let y = p.top; y <= p.foot - 1; y += 3) {
          for (let x = FRONT_X - 8; x <= FRONT_X + 8; x += 2) expect(covers(body, x, y), `${name} at ${x}, ${y}`).toBe(true);
        }
        /* and it starts where the cloth does at the centre front, not lower */
        expect(covers(body, FRONT_X, p.top - 3), name).toBe(false);
        expect(cm(across(p.path, (p.top + p.foot) / 2)![1] - across(p.path, (p.top + p.foot) / 2)![0]), name).toBeCloseTo(3.04, 1);
      }
    }
  }, 30_000);

  it("runs it on through every skirt to its hem, never past it", () => {
    for (const skirt of SKIRTS) {
      const sk = skirtFor(undefined, skirt);
      const p = skirtPlacketFor(undefined, skirt);
      const name = `${skirt.shape} ${skirt.length} · ${skirt.waist}`;
      expect(p.top, name).toBe(sk.waistY);
      /* every point of the placket on the skirt */
      for (let y = p.top + 1; y < p.hem - 12; y += 12) {
        for (let x = FRONT_X - 8; x <= FRONT_X + 8; x += 4) {
          if (covers(p.path, x, y)) expect(covers(sk.path, x, y), `${name} at ${x}, ${y}`).toBe(true);
        }
      }
      /* and closely along its foot, where it meets the hem */
      for (let y = p.hem - 12; y < p.hem + 2; y += 0.5) {
        for (let x = FRONT_X - 8; x <= FRONT_X + 8; x += 1) {
          if (covers(p.path, x, y)) expect(covers(sk.path, x, y), `${name} at ${x}, ${y}`).toBe(true);
        }
      }
      /* down to the hem at the centre front, and not past it */
      expect(covers(p.path, FRONT_X, p.hem - 1), name).toBe(true);
      expect(covers(p.path, FRONT_X, p.hem + 0.5), name).toBe(false);
      expect(covers(sk.path, FRONT_X, p.hem - 0.25), name).toBe(true);
      expect(Math.abs(p.hem - HEM_AT[skirt.length]), name).toBeLessThan(30);
      /* worn — but never down a mermaid, which buttons to the waist */
      if (skirt.shape === "mermaid") expect(cloth({ neckline: "round", skirt, buttons: "hem" }), name).not.toContain(p.path);
      else expect(cloth({ neckline: "round", skirt, buttons: "hem" }), name).toContain(p.path);
      expect(cloth({ neckline: "round", skirt, buttons: "waist" }), name).not.toContain(p.path);
    }
  }, 30_000);

  it("spaces the buttons evenly, 7 to 8 cm apart — 6.7 on an off-shoulder's short bodice — from just below the opening to just above the seam", () => {
    let [lo, hi] = [Infinity, 0];
    for (const cut of BUTTONED_CUTS) {
      for (const waist of WAISTS) {
        const run = frontButtons({ neckline: cut, skirt: { shape: "flared", length: "midi", waist }, buttons: "waist" });
        const g = run.groups[run.groups.length - 1];
        const ys = g.at.map(([, y]) => y);
        const name = `${cut} · ${waist}`;
        for (const [x] of g.at) expect(x, name).toBeCloseTo(FRONT_X, 9);
        const gaps = ys.slice(1).map((y, i) => y - ys[i]);
        for (const gap of gaps) expect(gap, name).toBeCloseTo(run.pitch!, 6);
        const pitch = cm(run.pitch!);
        [lo, hi] = [Math.min(lo, pitch), Math.max(hi, pitch)];
        expect(pitch, name).toBeLessThanOrEqual(8.001);
        expect(pitch, name).toBeGreaterThanOrEqual(cut === "off-shoulder" ? 6.6 : 7);
        expect(ys[ys.length - 1], name).toBeCloseTo(seamAt(waist) - BUTTON_LAST, 6);
        /* the first just below the opening — or a band — and not far below it */
        const first = cut === "collared" ? bodiceFor(cut).cut.buttons!.at[0][1] : bodiceFor(cut, undefined, waist, "waist").placket!.first;
        expect(ys[0], name).toBeGreaterThanOrEqual(first - 1e-9);
        expect(ys[0] - first, name).toBeLessThanOrEqual(16 + 1e-9);
        /* and each whole on the bodice */
        for (const y of ys) expect(covers(bodiceFor(cut, undefined, waist).pieces[0], FRONT_X, y - g.r), `${name} y ${y}`).toBe(true);
      }
    }
    expect(lo).toBeGreaterThan(6.6);
    expect(hi).toBeLessThan(8);
  });

  it("carries them on to the hem at the same spacing, the last clear of the hem, none of them half under a belt", () => {
    for (const cut of BUTTONED_CUTS) {
      for (const skirt of SKIRTS) {
        const name = `${cut}, ${skirt.shape} ${skirt.length} · ${skirt.waist}`;
        const toWaist = frontButtons({ neckline: cut, skirt, buttons: "waist" });
        const toHem = frontButtons({ neckline: cut, skirt, buttons: "hem" });
        const w = toWaist.groups[toWaist.groups.length - 1].at.map(([, y]) => y);
        const g = toHem.groups[toHem.groups.length - 1];
        const h = g.at.map(([, y]) => y);
        expect(h.slice(0, w.length), name).toEqual(w);
        if (skirt.shape === "mermaid") {
          /* a mermaid buttons to the waist only, asked what it may: no placket down its skirt */
          expect(h, name).toEqual(w);
          expect(cloth({ neckline: cut, skirt, buttons: "hem" }), name).toEqual(cloth({ neckline: cut, skirt, buttons: "waist" }));
          continue;
        }
        expect(h.length, name).toBeGreaterThan(w.length);
        h.slice(1).forEach((y, i) => expect(y - h[i], name).toBeCloseTo(toHem.pitch!, 6));
        const hem = skirtPlacketFor(undefined, skirt).hem;
        const gap = hem - h[h.length - 1];
        /* clear of the hem by 4 cm or so, and no more than a spacing and a half above it — fixed numbers, not the share it is drafted by */
        expect(cm(gap), name).toBeGreaterThanOrEqual(3.9);
        expect(cm(gap), name).toBeLessThanOrEqual(13);
        const belt = beltFor(skirt);
        for (const y of h) {
          const [top, bottom] = [y - g.r, y + g.r];
          const under = top >= belt.top && bottom <= belt.bottom;
          const clear = bottom <= belt.top - 1 || top >= belt.bottom + 1;
          expect(under || clear, `${name}: the button at y ${y}`).toBe(true);
        }
      }
    }
  }, 30_000);

  it("keeps a keyhole to its own button and loop, and buttons no cut that cannot take it, whatever is asked", () => {
    expect(frontButtons({ neckline: "keyhole", buttons: "hem" }).groups).toEqual([bodiceFor("keyhole").cut.buttons]);
    expect(bodiceFor("keyhole", undefined, "natural", "hem")).toBe(bodiceFor("keyhole"));
    expect(cloth({ neckline: "keyhole", buttons: "hem" })).toEqual(cloth({ neckline: "keyhole" }));
    for (const cut of ["wrap", "cowl", "asymmetrical", "halter"]) {
      expect(frontButtons({ neckline: cut, buttons: "hem" }).groups, cut).toEqual([]);
      expect(cloth({ neckline: cut, buttons: "hem" }), cut).toEqual(cloth({ neckline: cut }));
    }
  });

  it("starts a sweetheart's buttons below its centre dip", () => {
    for (const waist of WAISTS) {
      const b = bodiceFor("sweetheart", undefined, waist, "waist");
      const body = b.pieces[0];
      /* the dip is the lowest of its top edge across the placket: the placket starts at it */
      let dip = 0;
      for (let x = FRONT_X - 8; x <= FRONT_X + 8; x += 0.5) {
        let y = 150;
        while (!covers(body, x, y) && y < 400) y += 0.25;
        dip = Math.max(dip, y);
      }
      const run = frontButtons({ neckline: "sweetheart", skirt: { shape: "flared", length: "midi", waist }, buttons: "waist" });
      const first = run.groups[0].at[0][1] - run.groups[0].r;
      expect(first, waist).toBeGreaterThan(dip + 2);
      expect(b.placket!.top, waist).toBeGreaterThanOrEqual(dip);
      expect(b.placket!.top - dip, waist).toBeLessThan(1.5);
    }
  });

  it("lays a pleated skirt's pleats either side of a flat panel under the placket, buttoned to the hem: none under it, its hem level across it", () => {
    for (const waist of WAISTS) {
      for (const length of dress.skirt!.lengths) {
        const skirt: SkirtChoice = { shape: "pleated", length, waist };
        const name = `${length} · ${waist}`;
        /* the panel, 3–4 cm across, the placket inside it */
        expect(cm(PANEL[1] - PANEL[0]), name).toBeGreaterThanOrEqual(3);
        expect(cm(PANEL[1] - PANEL[0]), name).toBeLessThanOrEqual(4);
        const folds = skirtFolds(undefined, skirt, true);
        expect(folds.length, name).toBe(14);
        for (const f of folds) {
          /* each fold's ridge and its flank stay clear of the placket */
          const reach = Math.max(...f.width);
          for (let k = 0; k + 1 < f.ridge.length; k++) {
            for (let s = 0; s <= 10; s++) {
              const x = f.ridge[k][0] + ((f.ridge[k + 1][0] - f.ridge[k][0]) * s) / 10;
              expect(Math.abs(x - FRONT_X), `${name}: a pleat at x ${x.toFixed(1)}`).toBeGreaterThanOrEqual(PLACKET_HALF + reach);
            }
          }
        }
        /* the hem across the panel is level — no pleat steps in it — and steps at each of its edges */
        const hem = skirtFor(undefined, skirt, true).hem;
        const inPanel = hem.filter(([x]) => x > PANEL[0] + 0.01 && x < PANEL[1] - 0.01).map(([, y]) => y);
        expect(inPanel.length, name).toBeGreaterThan(0);
        expect(Math.max(...inPanel) - Math.min(...inPanel), name).toBeLessThan(0.5);
        for (const edge of PANEL) {
          const at = hem.filter(([x]) => Math.abs(x - edge) < 0.01).map(([, y]) => y);
          expect(at.length, `${name}: the hem at ${edge}`).toBe(2);
          expect(Math.abs(at[0] - at[1]), name).toBeGreaterThan(1);
        }
        /* without buttons to the hem, its pleats as they were: one at the centre front */
        expect(skirtFor(undefined, skirt, false)).toBe(skirtFor(undefined, skirt));
        expect(skirtFolds(undefined, skirt).some((f) => Math.abs(f.ridge[0][0] - 300) < 0.5), name).toBe(true);
        expect(cloth({ neckline: "round", skirt, buttons: "waist" }), name).toContain(skirtFor(undefined, skirt).path);
        expect(cloth({ neckline: "round", skirt, buttons: "hem" }), name).toContain(skirtFor(undefined, skirt, true).path);
      }
    }
  });
});

describe("the belt", () => {
  it("lies over the waist seam at every waist, 3.4 cm deep, a little past the dress at its sides, its buckle at the centre front", () => {
    expect(cm(BELT_WIDTH)).toBeGreaterThanOrEqual(3);
    expect(cm(BELT_WIDTH)).toBeLessThanOrEqual(4);
    for (const skirt of SKIRTS) {
      const belt = beltFor(skirt);
      const sk = skirtFor(undefined, skirt);
      const seam = seamAt(skirt.waist);
      const name = `${skirt.shape} ${skirt.length} · ${skirt.waist}`;
      expect(belt.bottom - belt.top, name).toBe(BELT_WIDTH);
      /* over the seam where it shows: the skirt's top edge and the fold just under it, and the topstitch */
      expect(belt.top, name).toBeLessThan(sk.waistY);
      expect(belt.bottom, name).toBeGreaterThan(seam - 2);
      const body = bodiceFor("round", undefined, skirt.waist).pieces[0];
      for (const [x, y] of belt.left) {
        const dress = Math.min(y <= seam ? (across(body, y)?.[0] ?? Infinity) : Infinity, y >= sk.waistY ? (across(sk.path, y)?.[0] ?? Infinity) : Infinity);
        expect(dress - x, `${name} y ${y}`).toBeGreaterThanOrEqual(0.2);
        expect(dress - x, `${name} y ${y}`).toBeLessThanOrEqual(3);
      }
      expect([belt.buckle.x, belt.buckle.y], name).toEqual([FRONT_X, belt.mid]);
    }
  });

  it("is drawn over the dress behind its sleeves: in its own cloth, cut from elsewhere on the roll, or in brown or black leather; a buckle over it", () => {
    const kinds: ("self" | "brown" | "black")[] = ["self", "brown", "black"];
    for (const belt of kinds) {
      const sleeve = { type: "bishop", length: "long" } as const;
      const regions = dressFront.cut!({ belt, sleeve, skirt: { shape: "flared", length: "midi", waist: "empire" } });
      const over = regions.bottom!.over!;
      expect(over.under, belt).toEqual(bodiceFor("round", sleeve, "empire").armCover);
      if (belt === "self") {
        expect(over.solid).toBeUndefined();
        expect(over.grain?.shift).toBeDefined();
      } else expect(over.solid, belt).toBe(LEATHER[belt]);
      // its buckle on it, drawn with the belt rather than the buttons, which lie under it
      expect(renderToStaticMarkup(<>{dressFront.beltTrim!({ belt })}</>), belt).toContain("#b8944c");
      expect(renderToStaticMarkup(<>{dressFront.cutTrim!({ belt })}</>), belt).not.toContain("#b8944c");
    }
    /* no belt on a wrap, whatever is asked, but its own sash: no buckle */
    expect(dressFront.cut!({ neckline: "wrap", belt: "brown" }).bottom!.over!.cloth).toBe("belt");
    expect(dressFront.cut!({ neckline: "wrap", belt: "brown" }).bottom!.over!.solid).toBeUndefined();
    expect(renderToStaticMarkup(<>{dressFront.beltTrim!({ neckline: "wrap", belt: "brown" })}</>)).toBe("");
    expect(renderToStaticMarkup(<>{dressFront.cutTrim!({ neckline: "wrap", belt: "brown" })}</>)).toBe("");
  });
});

describe("the bow collar", () => {
  /** Each piece's outline as points: the band, the two tails, the two loops and the knot, in drawing order. */
  const pieces = (() => {
    const markup = renderToStaticMarkup(<>{bowCollarFront.regions.collar!.shape("#fff")}</>);
    return [...markup.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]);
  })();
  const box = (d: string) => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let y = 150; y < 320; y += 0.5) {
      const s = across(d, y);
      if (s) {
        xs.push(...s);
        ys.push(y);
      }
    }
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  };
  const [, tailL, tailR, loopL, loopR, knot] = pieces;

  it("ties soft, flat loops, wider than they are tall, pinched into a small knot centred on her neck", () => {
    expect(pieces).toHaveLength(6);
    for (const loop of [loopL, loopR]) {
      const b = box(loop);
      expect(b.x1 - b.x0).toBeGreaterThan(1.4 * (b.y1 - b.y0));
      /* pinched: much narrower where it goes into the knot than at its end */
      const near = b.x0 < FRONT_X ? b.x1 - 1 : b.x0 + 1;
      const far = b.x0 < FRONT_X ? b.x0 + 3 : b.x1 - 3;
      const tall = (x: number) => {
        let n = 0;
        for (let y = b.y0; y <= b.y1; y += 0.25) if (covers(loop, x, y)) n += 0.25;
        return n;
      };
      let most = 0;
      for (let x = Math.ceil(b.x0); x <= b.x1; x += 1) most = Math.max(most, tall(x));
      expect(tall(near)).toBeLessThan(0.65 * most);
      expect(tall(far)).toBeGreaterThan(0);
    }
    const k = box(knot);
    expect(cm(k.x1 - k.x0)).toBeLessThan(3.5);
    expect((k.x0 + k.x1) / 2).toBeCloseTo(FRONT_X, 0);
    expect((box(loopL).x0 + box(loopR).x1) / 2).toBeCloseTo(FRONT_X, 0);
  });

  it("hangs long tails to the middle of her chest, lying apart, cut on a slant", () => {
    for (const tail of [tailL, tailR]) {
      const b = box(tail);
      expect(b.y1).toBeGreaterThan(275);
      expect(b.y1).toBeLessThan(295);
      expect(cm(b.y1 - b.y0)).toBeGreaterThan(15);
      /* the end on a slant: just above its lowest point only its outer corner is left */
      const mid = (y: number) => ((s) => (s[0] + s[1]) / 2)(across(tail, y)!);
      const width = (y: number) => ((s) => s[1] - s[0])(across(tail, y)!);
      expect(width(b.y1 - 1)).toBeLessThan(0.5 * width(b.y1 - 12));
      if (mid(b.y1 - 12) < FRONT_X) expect(mid(b.y1 - 1)).toBeLessThan(mid(b.y1 - 12) - 2);
      else expect(mid(b.y1 - 1)).toBeGreaterThan(mid(b.y1 - 12) + 2);
    }
    /* apart at their ends */
    const end = Math.min(box(tailL).y1, box(tailR).y1) - 12;
    expect(across(tailR, end)![0] - across(tailL, end)![1]).toBeGreaterThan(15);
  });
});
