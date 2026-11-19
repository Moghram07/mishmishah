import { describe, expect, it } from "vitest";
import { LOOKS, looksFor } from "./looks";
import { garmentById } from "./garments";
import { fabricById, offeredFabrics } from "./fabrics";
import {
  beltOf,
  bowAtOf,
  buttonRowsOf,
  buttonsOf,
  clothOf,
  collarOf,
  frontOf,
  legOf,
  necklineOf,
  skirtOf,
  sleeveOf,
  stripesOf,
  stripesOnOf,
  tieAtOf,
  tieOf,
} from "@/lib/garments/outfit";
import type { WornGarment } from "@/types";

/** What each look should come out as, read back through the resolvers — anything a helper dropped shows here. */
const EXPECTED: Record<string, Record<string, Record<string, unknown>>> = {
  sailor: {
    "female-dress": {
      neckline: "female-boat-neckline", collar: "female-sailor-collar", stripes: "three", stripesOn: ["collar", "hem"],
      tie: "scarf", tieAt: "neck", buttons: "waist", rows: "two", sleeve: { type: "set-in", length: "sleeveless" },
      skirt: { shape: "pleated", length: "midi" }, cloth: { top: "fb-navy", bottom: "fb-navy", collar: "fb-navy", trim: "fb-white", tie: "fb-red" },
    },
  },
  "shirt-dress": {
    "female-dress": {
      neckline: "female-collared-neckline", collar: "female-shirt-collar", buttons: "hem", belt: "self",
      sleeve: { type: "set-in", length: "short" }, skirt: { shape: "aline", length: "midi" }, cloth: { top: "fb-blue-pinstripe", belt: "fb-blue-pinstripe" },
    },
  },
  "modest-maxi": {
    "female-dress": {
      neckline: "female-high-neckline", sleeve: { type: "set-in", length: "long", cuff: "plain" }, skirt: { shape: "flared", length: "maxi" }, cloth: { top: "fb-ivory-roses" },
    },
  },
  abaya: {
    "female-dress": { skirt: { shape: "aline", length: "maxi" }, cloth: { top: "fb-black-crepe" } },
    "female-abaya": { front: "closed", sleeve: { type: "bell", length: "long" }, cloth: { body: "fb-black-crepe-satin" } },
  },
  evening: {
    "female-dress": {
      neckline: "female-boat-neckline", sleeve: { type: "bell", length: "long" }, skirt: { shape: "flared", length: "maxi" },
      belt: "sash", bowAt: "front", cloth: { top: "fb-emerald-satin", bottom: "fb-emerald-satin", belt: "fb-emerald-satin" },
    },
  },
  "white-thobe": { "male-thobe": { collar: "male-regular-collar", sleeve: { type: "set-in", length: "long", cuff: "french" }, cloth: { body: "fb-snow-white" } } },
  "winter-thobe": { "male-thobe": { collar: "male-mandarin-collar", sleeve: { type: "set-in", length: "long", cuff: "plain" }, cloth: { body: "fb-winter-navy" } } },
  "summer-linen": {
    "male-shirt": { collar: "male-shirt-collar", sleeve: { type: "set-in", length: "short" }, cloth: { body: "fb-sky-linen" } },
    "male-trousers": { leg: "straight", cloth: { body: "fb-natural-linen" } },
  },
  suit: {
    "male-shirt": { sleeve: { type: "set-in", length: "long", cuff: "formal" }, tie: "necktie", cloth: { body: "fb-snow-white", tie: "fb-burgundy-satin" } },
    "male-trousers": { leg: "straight", cloth: { body: "fb-navy-pinstripe" } },
    "male-jacket": { cloth: { body: "fb-navy-pinstripe" } },
  },
};

const read = (w: WornGarment) => ({
  neckline: necklineOf(w)?.id,
  collar: collarOf(w)?.id,
  stripes: stripesOf(w),
  stripesOn: stripesOnOf(w),
  tie: tieOf(w),
  tieAt: tieAtOf(w),
  buttons: buttonsOf(w),
  rows: buttonRowsOf(w),
  belt: beltOf(w),
  bowAt: bowAtOf(w),
  // a plain hem is no cuff, whether it says "none" or nothing
  sleeve: (() => {
    const s = sleeveOf(w);
    return s && { type: s.type, length: s.length, ...(s.cuff && s.cuff !== "none" ? { cuff: s.cuff } : {}) };
  })(),
  skirt: (() => {
    const s = skirtOf(w);
    return s && { shape: s.shape, length: s.length };
  })(),
  front: frontOf(w),
  leg: legOf(w),
});

describe("the ready-made looks", () => {
  it("are her five and his four, each named in Arabic and English, the evening dress among hers", () => {
    expect(looksFor("female").map((l) => l.id)).toEqual(["sailor", "shirt-dress", "modest-maxi", "abaya", "evening"]);
    expect(looksFor("male").map((l) => l.id)).toEqual(["white-thobe", "winter-thobe", "summer-linen", "suit"]);
    for (const l of LOOKS) {
      expect(l.name.ar, l.id).toMatch(/[؀-ۿ]/);
      expect(l.name.en, l.id).toMatch(/^[A-Z][a-z ]+$/);
    }
    expect(looksFor("female").find((l) => l.id === "evening")!.name).toEqual({ ar: "فستان سهرة", en: "Evening dress" });
  });

  it("come out exactly as planned: every choice lands, none is dropped on the way", () => {
    for (const look of LOOKS) {
      const worn = look.worn();
      const want = EXPECTED[look.id];
      expect(worn.map((w) => w.garmentId), look.id).toEqual(Object.keys(want));
      for (const w of worn) {
        expect(garmentById(w.garmentId)!.gender, `${look.id}: ${w.garmentId} on the wrong body`).toBe(look.body);
        const got = read(w);
        const { cloth, ...choices } = want[w.garmentId];
        for (const [key, value] of Object.entries(choices)) expect(got[key as keyof typeof got], `${look.id} ${w.garmentId} ${key}`).toEqual(value);
        for (const [region, id] of Object.entries(cloth as Record<string, string>)) expect(clothOf(w, region as never), `${look.id} ${w.garmentId} ${region}`).toBe(id);
      }
    }
  });

  it("are cut from our own samples, each garment in a cloth that suits it — a tie in one marked for ties", () => {
    const offered = new Set(offeredFabrics.map((f) => f.id));
    for (const look of LOOKS) {
      for (const w of look.worn()) {
        for (const id of Object.values(w.fabrics)) expect(offered.has(id!), `${look.id}: ${id} is not one of our samples`).toBe(true);
        const main = fabricById(clothOf(w, garmentById(w.garmentId)!.fabricRegions[0])!)!;
        expect(main.suits, `${look.id}: ${main.id} on ${w.garmentId}`).toContain(w.garmentId);
      }
    }
    // the suit's necktie, a tie proper, is in a cloth marked for ties (the sailor's scarf is the dress's own trimming)
    const shirt = LOOKS.find((l) => l.id === "suit")!.worn().find((w) => w.garmentId === "male-shirt")!;
    expect(fabricById(clothOf(shirt, "tie")!)!.suits).toContain("tie");
  });
});
