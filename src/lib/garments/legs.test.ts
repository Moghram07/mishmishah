import { describe, expect, it } from "vitest";
import { garmentById } from "@/lib/data/garments";
import { legsFor as legsOffered } from "@/lib/data/legs";
import { cutFrom, legOf, setLeg, switchBody, wear } from "./outfit";
import { rowSpan } from "./folds";
import { draft, trousers } from "./fit";
import { LEG_SHAPES } from "./legs";
import { BODY_CANVAS } from "../mannequin/bodies";
import * as her from "./art/female/trousersCut";
import * as his from "./art/male/trousersCut";
import { DEFAULT_SKIN_TONE } from "@/lib/data/skinTones";
import type { BodyType, Outfit } from "@/types";

const CUTS = { female: her, male: his } as const;
const BODIES = ["female", "male"] as const;
const cm = (u: number) => u * BODY_CANVAS.cmPerUnit;

/** A leg's left piece across a row: its outside and its inseam. */
const across = (path: string, y: number): [number, number] => rowSpan(path, y)!;
/** The rows from just under the crotch to just above the hem, every few units. */
const rows = (body: BodyType, from = draft(body).crotchY + 4): number[] => {
  const out: number[] = [];
  for (let y = from; y < her.HEM_Y - 2; y += 4) out.push(y);
  return out;
};
const kneeOf = (body: BodyType) => (draft(body).crotchY + her.HEM_Y) / 2;

describe("trouser legs", () => {
  it("offers straight, slim and wide on both bodies, and arrives straight, as each cut module says", () => {
    for (const body of BODIES) {
      const g = garmentById(`${body}-trousers`)!;
      expect(g.legs, body).toEqual({ offered: ["straight", "slim", "wide"], default: "straight" });
      expect(CUTS[body].DEFAULT_LEG, body).toBe(g.legs!.default);
      expect(legsOffered(g).map((l) => l.id)).toEqual([...LEG_SHAPES]);
    }
    expect(legsOffered(garmentById("female-trousers")!).map((l) => l.name.ar)).toEqual(["مستقيم", "ضيق", "واسع"]);
    /* nothing else takes a leg */
    for (const id of ["female-skirt", "female-dress", "male-thobe"]) expect(garmentById(id)!.legs, id).toBeUndefined();
  });

  it("cuts the straight leg exactly as the trousers always were", () => {
    for (const body of BODIES) {
      const own = trousers(body, CUTS[body].SPEC);
      for (const L of [CUTS[body].legsFor(), CUTS[body].legsFor(undefined, "straight")]) {
        expect([L.left, L.right, L.band, L.seam, L.stitch], body).toEqual([own.left, own.right, own.band, own.seam, own.stitch]);
      }
    }
  });

  it("changes nothing above the crotch: the band, the fly, the pockets and the loops are the same in every leg", () => {
    for (const body of BODIES) {
      const straight = CUTS[body].legsFor();
      for (const leg of ["slim", "wide"] as const) {
        const L = CUTS[body].legsFor(undefined, leg);
        expect(L.band, `${body} ${leg}`).toBe(straight.band);
        expect(L.details, `${body} ${leg}`).toEqual(straight.details);
        for (let y = L.waistY + 2; y < draft(body).crotchY; y += 6) expect(across(L.left, y), `${body} ${leg} y ${y}`).toEqual(across(straight.left, y));
      }
    }
  });

  it("cuts a slim leg straight to the knee, then in to the ankle: narrower at the hem, never inside her, the legs further apart", () => {
    for (const body of BODIES) {
      const d = draft(body);
      const knee = kneeOf(body);
      const straight = CUTS[body].legsFor();
      const slim = CUTS[body].legsFor(undefined, "slim");
      for (const y of rows(body)) {
        const [so, si] = across(straight.left, y);
        const [o, i] = across(slim.left, y);
        const name = `${body} y ${y}`;
        if (y < knee - 6) {
          expect([o, i], name).toEqual([so, si]);
          continue;
        }
        /* never wider than the straight leg, never closer to the other leg — within a fifth of a unit, the curve's handles moving where it bends off it */
        expect(o, name).toBeGreaterThanOrEqual(so - 0.2);
        expect(i, name).toBeLessThanOrEqual(si + 0.2);
        /* and never closer to her than a few units, outside and in */
        expect(d.legOutAt(y, 0) - o, name).toBeGreaterThanOrEqual(4);
        expect(i - d.legInAt(y, 0), name).toBeGreaterThanOrEqual(3.5);
      }
      /* at the hem, at least 1.5 cm narrower than straight, and narrower than at its knee */
      const width = (L: { left: string }, y: number) => ((s) => s[1] - s[0])(across(L.left, y));
      const hem = her.HEM_Y - 6;
      expect(cm(width(straight, hem) - width(slim, hem)), body).toBeGreaterThanOrEqual(1.5);
      expect(width(slim, hem), body).toBeLessThan(width(slim, knee) - 5);
    }
  });

  it("cuts a wide leg as wide all the way down as at the top of the thigh, wider at the hem, its inseam where the straight leg's is", () => {
    for (const body of BODIES) {
      const straight = CUTS[body].legsFor();
      const wide = CUTS[body].legsFor(undefined, "wide");
      const top = ((s) => s[1] - s[0])(across(wide.left, draft(body).crotchY + 4));
      for (const y of rows(body)) {
        const [o, i] = across(wide.left, y);
        const [so, si] = across(straight.left, y);
        const name = `${body} y ${y}`;
        /* the inseam stays put, so the legs stay apart: all the width goes outward */
        expect(i, name).toBeCloseTo(si, 6);
        expect(o, name).toBeLessThanOrEqual(so + 0.01);
        expect(i - o, name).toBeGreaterThanOrEqual(top - 1);
      }
      const hem = her.HEM_Y - 6;
      const [o, i] = across(wide.left, hem);
      const [so, si] = across(straight.left, hem);
      expect((i - o) / (si - so), body).toBeGreaterThanOrEqual(1.4);
    }
  });

  it("is a choice on the worn trousers, resolved when read, and carried across to the other body", () => {
    const worn = wear([], cutFrom(garmentById("female-trousers")!, "fb-apricot-linen"));
    expect(legOf(worn[0])).toBe("straight");
    const wide = setLeg(worn, "female-trousers", "wide");
    expect(legOf(wide[0])).toBe("wide");
    /* a leg it does not offer falls back to how it arrives */
    expect(legOf({ ...worn[0], leg: "palazzo" as never })).toBe("straight");
    /* none for a garment with no choice of leg */
    expect(legOf(cutFrom(garmentById("female-skirt")!, "fb-apricot-linen"))).toBeUndefined();
    const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn: wide };
    const him = switchBody(outfit, "male", "fb-apricot-linen");
    const trousersOn = him.worn.find((w) => w.garmentId === "male-trousers")!;
    expect(legOf(trousersOn)).toBe("wide");
  });
});
