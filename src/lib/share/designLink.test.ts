import { describe, expect, it } from "vitest";
import { LOOKS } from "@/lib/data/looks";
import { garmentById, garments, garmentsFor } from "@/lib/data/garments";
import { necklines, necklinesForGarment } from "@/lib/data/necklines";
import { collars } from "@/lib/data/collars";
import { fabricById, fabrics, offeredFabrics } from "@/lib/data/fabrics";
import { sleeveCuffsFor, sleeveLengthsFor, sleeveTypesFor } from "@/lib/data/sleeves";
import { skirtLengthsFor } from "@/lib/data/skirts";
import { beltsFor, buttonsFor } from "@/lib/data/closures";
import { DEFAULT_SKIN_TONE } from "@/lib/data/skinTones";
import { historyReducer, type History } from "@/components/visualizer/history";
import {
  bowPlacesOf,
  buttonRowsOffered,
  choiceOf,
  clothOf,
  collarOf,
  collarsFitting,
  cutFrom,
  necklineOf,
  regionsOf,
  setBelt,
  setBowAt,
  setButtonRows,
  setButtons,
  setCollar,
  setFront,
  setLeg,
  setNeckline,
  setSkirt,
  setSleeve,
  setStripes,
  setTie,
  setTieAt,
  skirtOf,
  sleeveOf,
  stack,
  stripeEdgesOf,
  tiePlacesOf,
  tiesOffered,
  toggleStripeEdge,
  wear,
} from "@/lib/garments/outfit";
import type { BodyType, Outfit, WornGarment } from "@/types";
import { designLink, designPayload, readDesign, wearSent } from "./designLink";
import { DESIGN_HASH, sentPayload } from "./sentLink";

/**
 * A design sent as a link: catalogue ids only, read back strictly — every
 * design the panel can make comes back exactly as it was sent, and anything
 * a link asks for that is not offered is left out, counted, never thrown.
 */

const FALLBACK = offeredFabrics[0].id;
const outfitOf = (body: BodyType, worn: WornGarment[], direction = 0): Outfit => ({ bodyType: body, skinTone: DEFAULT_SKIN_TONE, worn, direction });

/** A design as the stage draws it: each garment's choices, its collar, and the cloth of every part. */
const drawnAs = (worn: WornGarment[]) =>
  stack(worn)
    .map(({ garment, worn: w }) => ({
      garment: garment.id,
      choice: choiceOf(w),
      collar: collarOf(w)?.id,
      cloths: Object.fromEntries(regionsOf(garment, w).map((r) => [r, fabricById(clothOf(w, r) ?? "")?.id ?? FALLBACK])),
    }))
    .sort((a, b) => a.garment.localeCompare(b.garment));

/** Send a design and open it again. */
const roundTrip = (outfit: Outfit) => {
  const payload = designPayload(outfit, FALLBACK);
  return { payload, read: readDesign(payload, FALLBACK) };
};

/* a fixed walk through the panel's choices: the same designs every run */
function random(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A design made the way a person makes one in the panel: garments put on,
 * then choices in any order, each from what the panel offers at that moment —
 * which leaves the stale choices a recut leaves behind, as the panel does.
 */
function designBy(rand: () => number, body: BodyType): WornGarment[] {
  const one = <T,>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];
  const cloth = () => one(offeredFabrics).id;
  let worn: WornGarment[] = [];
  for (let g = 0; g < 1 + Math.floor(rand() * 3); g++) {
    const garment = one(garmentsFor(body));
    worn = wear(worn, cutFrom(garment, cloth()));
    const id = garment.id;
    const w = () => worn.find((x) => x.garmentId === id)!;
    for (let step = 0; step < 14; step++) {
      switch (Math.floor(rand() * 13)) {
        case 0: {
          const cuts = necklinesForGarment(garment);
          if (cuts.length) worn = setNeckline(worn, id, one(cuts).id);
          break;
        }
        case 1: {
          const fit = collarsFitting(garment, w());
          if (fit.length) worn = setCollar(worn, id, rand() < 0.3 ? undefined : one(fit).id);
          break;
        }
        case 2: {
          if (!sleeveOf(w())) break;
          const type = one(sleeveTypesFor(garment, necklineOf(w())));
          const length = one(sleeveLengthsFor(type, necklineOf(w()), garment));
          const cuffs = sleeveCuffsFor(garment, { type, length });
          worn = setSleeve(worn, id, { type, length, ...(cuffs.length ? { cuff: one(cuffs) } : {}) });
          break;
        }
        case 3: {
          if (!garment.skirt || !skirtOf(w())) break;
          const shape = one(garment.skirt.shapes);
          const length = one(skirtLengthsFor(garment, shape)).id;
          const waist = garment.skirt.waists ? one(garment.skirt.waists) : undefined;
          worn = setSkirt(worn, id, { shape, length, ...(waist ? { waist } : {}) });
          break;
        }
        case 4:
          if (garment.fronts) worn = setFront(worn, id, one(garment.fronts.offered));
          break;
        case 5:
          if (garment.legs) worn = setLeg(worn, id, one(garment.legs.offered));
          break;
        case 6: {
          const belts = beltsFor(garment, necklineOf(w())?.cut);
          if (belts.length) worn = setBelt(worn, id, one(belts).id);
          const places = bowPlacesOf(w());
          if (places.length && rand() < 0.5) worn = setBowAt(worn, id, one(places));
          break;
        }
        case 7: {
          const buttons = buttonsFor(garment, necklineOf(w())?.cut, skirtOf(w())?.shape);
          if (buttons.length) worn = setButtons(worn, id, one(buttons).id);
          const rows = buttonRowsOffered(w());
          if (rows.length) worn = setButtonRows(worn, id, one(rows));
          break;
        }
        case 8:
          if (garment.stripes && stripeEdgesOf(w()).length) worn = setStripes(worn, id, one(garment.stripes.offered), cloth());
          break;
        case 9: {
          const edges = stripeEdgesOf(w());
          if (edges.length) worn = toggleStripeEdge(worn, id, one(edges));
          break;
        }
        case 10: {
          const ties = tiesOffered(w());
          if (!ties.length) break;
          worn = setTie(worn, id, one(ties), cloth());
          const tie = w().tie;
          const places = tie && tie !== "none" ? tiePlacesOf(w(), tie) : [];
          if (places.length && rand() < 0.5) worn = setTieAt(worn, id, one(places));
          break;
        }
        default: {
          /* a part in a cloth of its own */
          const region = one(regionsOf(garment, w()));
          worn = worn.map((x) => (x.garmentId === id ? { ...x, fabrics: { ...x.fabrics, [region]: cloth() } } : x));
        }
      }
    }
  }
  return worn;
}

describe("a design sent as a link", () => {
  it("is written in catalogue ids alone, each one the link can shorten and read back", () => {
    const word = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    for (const g of garments) expect(g.id, g.id).toMatch(new RegExp(`^${g.gender}-[a-z0-9]+(?:-[a-z0-9]+)*$`));
    for (const c of collars) expect(c.id, c.id).toMatch(new RegExp(`^${c.gender}-[a-z0-9]+(?:-[a-z0-9]+)*-collar$`));
    for (const f of fabrics) expect(f.id, f.id).toMatch(/^fb-[a-z0-9]+(?:-[a-z0-9]+)*$/);
    for (const n of necklines) {
      expect(n.id, n.id).toBe(`${n.gender}-${n.cut}-neckline`);
      expect(n.cut).toMatch(word);
    }
    for (const g of garments) {
      const ids = [
        ...g.fabricRegions,
        ...(g.partCloths ?? []),
        ...(g.sleeves?.types ?? []),
        ...(g.sleeves?.cuffs ?? []),
        ...(g.skirt ? [...g.skirt.shapes, ...g.skirt.lengths, ...(g.skirt.waists ?? [])] : []),
        ...(g.fronts?.offered ?? []),
        ...(g.legs?.offered ?? []),
        ...(g.belts?.offered ?? []),
        ...(g.buttons ? [...g.buttons.offered, ...(g.buttons.rows ?? [])] : []),
        ...(g.stripes?.offered ?? []),
        ...(g.ties?.offered ?? []),
      ];
      for (const id of ids) expect(id, `${g.id}: ${id}`).toMatch(word);
    }
  });

  it("brings every ready-made look back exactly as it was sent, nothing left out, in under 300 characters", () => {
    for (const look of LOOKS) {
      const outfit = outfitOf(look.body, look.worn());
      const { payload, read } = roundTrip(outfit);
      expect(read.skipped, look.id).toBe(0);
      expect(read.design?.body, look.id).toBe(look.body);
      expect(drawnAs(read.design!.worn), look.id).toEqual(drawnAs(outfit.worn));
      expect(designPayload(outfitOf(look.body, read.design!.worn), FALLBACK), look.id).toBe(payload);
      const link = designLink("https://www.mishmishah.com", outfit, FALLBACK);
      expect(link.length, `${look.id}: ${link}`).toBeLessThan(300);
      expect(link).toMatch(/^https:\/\/www\.mishmishah\.com\/#d=[A-Za-z0-9._~-]+$/);
    }
  });

  it("brings back every design the panel can make, on both bodies, in every grain", () => {
    const rand = random(20261127);
    let longest = 0;
    for (let i = 0; i < 1200; i++) {
      const body: BodyType = i % 2 ? "male" : "female";
      const outfit = outfitOf(body, designBy(rand, body), [0, 90, 45][i % 3]);
      const { payload, read } = roundTrip(outfit);
      longest = Math.max(longest, payload.length);
      expect(read.skipped, payload).toBe(0);
      expect(read.design?.direction, payload).toBe(outfit.direction);
      expect(drawnAs(read.design!.worn), payload).toEqual(drawnAs(outfit.worn));
      expect(designPayload({ ...outfit, worn: read.design!.worn }, FALLBACK)).toBe(payload);
    }
    expect(longest).toBeLessThan(2000);
  });

  it("carries nothing but the design: not the skin tone, not what the other mannequin wears", () => {
    const look = LOOKS.find((l) => l.id === "sailor")!;
    const outfit = outfitOf("female", look.worn());
    const payload = designPayload(outfit, FALLBACK);
    expect(designPayload({ ...outfit, skinTone: "tone-09" }, FALLBACK)).toBe(payload);
    expect(designPayload({ ...outfit, away: { male: LOOKS.find((l) => l.id === "suit")!.worn() } }, FALLBACK)).toBe(payload);
    expect(payload).toMatch(/^[A-Za-z0-9._~-]+$/);
  });

  it("is found only after #d= in the address", () => {
    expect(DESIGN_HASH).toBe("#d=");
    expect(sentPayload("#d=1.f.0~dress")).toBe("1.f.0~dress");
    expect(sentPayload("#shops")).toBeNull();
    expect(sentPayload("")).toBeNull();
  });
});

describe("opening a link that asks for what is not offered", () => {
  const read = (payload: string) => readDesign(payload, FALLBACK);
  const dress = (r: ReturnType<typeof read>) => r.design?.worn.find((w) => w.garmentId === "female-dress");

  it("leaves out each thing it does not know, or that this garment does not offer there, and opens the rest", () => {
    // a cloth we do not have, a hidden one, and a part the dress does not have
    const hidden = fabrics.find((f) => f.hidden)!;
    let r = read(`1.f.0~dress_f.no-such-cloth.bottom.${hidden.id.slice(3)}.lapel.navy`);
    expect(r.skipped).toBe(3);
    expect(dress(r)?.fabrics).toEqual({ top: FALLBACK, bottom: FALLBACK });
    // a garment we do not have, and his thobe on her: each left out, the dress still on
    r = read("1.f.0~cape_f.navy~thobe_f.navy~dress_f.navy");
    expect(r.skipped).toBe(2);
    expect(r.design?.worn.map((w) => w.garmentId)).toEqual(["female-dress"]);
    // a cut no dress is offered, a sleeve length a bishop does not come in, a cuff on a short sleeve
    r = read("1.f.0~dress_n.no-such-cut_f.navy");
    expect([r.skipped, necklineOf(dress(r)!)?.id]).toEqual([1, garmentById("female-dress")!.defaultNeckline]);
    r = read("1.f.0~dress_s.bishop.short_f.navy");
    expect(r.skipped).toBe(1);
    r = read("1.f.0~dress_n.round_s.set-in.short.french_f.navy");
    expect([r.skipped, sleeveOf(dress(r)!)?.length, sleeveOf(dress(r)!)?.cuff]).toEqual([1, "short", "none"]);
    // a mandarin on a halter: it does not fit the cut just made
    r = read("1.f.0~dress_n.halter_c.mandarin_f.navy");
    expect([r.skipped, collarOf(dress(r)!)]).toEqual([1, undefined]);
    // a mermaid at the knee, buttons down a wrap, a necktie with no shirt collar to sit under
    r = read("1.f.0~dress_k.mermaid.knee.natural_f.navy");
    expect([r.skipped, skirtOf(dress(r)!)?.shape]).toEqual([1, "mermaid"]);
    r = read("1.f.0~dress_n.wrap_u.hem_f.navy");
    expect(r.skipped).toBe(1);
    r = read("1.f.0~dress_n.round_c.none_t.necktie.neck_f.navy");
    expect(r.skipped).toBe(1);
    // a choice the link does not know, and one asked twice
    r = read("1.f.0~dress_z.what_n.round_n.v_f.navy");
    expect([r.skipped, necklineOf(dress(r)!)?.cut]).toEqual([2, "round"]);
    // two garments that cannot be worn together: the first stays
    r = read("1.f.0~dress_f.navy~skirt_f.navy");
    expect([r.skipped, r.design?.worn.map((w) => w.garmentId)]).toEqual([1, ["female-dress"]]);
    // an angle no one cuts
    r = read("1.f.30~dress_f.navy");
    expect([r.skipped, r.design?.direction]).toEqual([1, 0]);
  });

  it("opens nothing, and says so, from a link it cannot read at all — and never throws", () => {
    for (const bad of ["", "1", "2.f.0~dress_f.navy", "1.x.0~dress_f.navy", "1.f.0", "1.f.0~", "1.f.0~cape", "%E0%A4%A", "x".repeat(5000), "1.f.0~dress_f.navy".repeat(200)]) {
      const r = readDesign(bad, FALLBACK);
      expect(r.design, bad.slice(0, 40)).toBeNull();
      expect(r.skipped, bad.slice(0, 40)).toBeGreaterThan(0);
    }
  });

  it("reads a link broken anywhere without throwing, and only ever opens a design the panel could make", () => {
    const rand = random(7);
    const sent = LOOKS.map((l) => designPayload(outfitOf(l.body, l.worn()), FALLBACK));
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789.-_~%#=&?/ ";
    for (let i = 0; i < 3000; i++) {
      let p = sent[i % sent.length];
      const at = Math.floor(rand() * p.length);
      const op = i % 4;
      if (op === 0) p = p.slice(0, at);
      else if (op === 1) p = p.slice(0, at) + p.slice(at + 1 + Math.floor(rand() * 6));
      else if (op === 2) p = p.slice(0, at) + chars[Math.floor(rand() * chars.length)] + p.slice(at + 1);
      else p = p.slice(0, at) + chars[Math.floor(rand() * chars.length)] + p.slice(at);
      let r: ReturnType<typeof readDesign> | undefined;
      expect(() => (r = readDesign(p, FALLBACK)), p).not.toThrow();
      if (!r?.design) continue;
      // what opened is a design the panel could have made: sent again, it comes back whole
      const again = roundTrip(outfitOf(r.design.body, r.design.worn, r.design.direction));
      expect(again.read.skipped, p).toBe(0);
      expect(drawnAs(again.read.design!.worn), p).toEqual(drawnAs(r.design.worn));
    }
  });
});

describe("opening a sent design", () => {
  const state = (outfit: Outfit): History<{ outfit: Outfit }> => ({ past: [], present: { outfit }, future: [] });

  it("is one step undo takes back, after the visualizer opens — on the body it was made on", () => {
    const mine = outfitOf("female", LOOKS.find((l) => l.id === "evening")!.worn());
    const sent = readDesign(designPayload(outfitOf("male", LOOKS.find((l) => l.id === "suit")!.worn()), FALLBACK), FALLBACK).design!;
    // the visualizer opens — a fresh start — and the sent design goes on as one step
    let h = historyReducer(state(mine), { type: "rebase", next: (s) => s });
    h = historyReducer(h, { type: "set", next: (s) => ({ outfit: wearSent(s.outfit, sent, FALLBACK) }) });
    expect(h.present.outfit.bodyType).toBe("male");
    expect(drawnAs(h.present.outfit.worn)).toEqual(drawnAs(sent.worn));
    // her design is put away as it was, and the skin tone stays the viewer's
    expect(h.present.outfit.away?.female).toEqual(mine.worn);
    expect(h.present.outfit.skinTone).toBe(mine.skinTone);
    h = historyReducer(h, { type: "undo" });
    expect(h.present.outfit).toEqual(mine);
    expect(h.past).toHaveLength(0);
  });
});
