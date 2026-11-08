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
  it("offers her five legs and him three — palazzo and flare are hers — and arrives straight, as each cut module says", () => {
    const offered = { female: ["straight", "slim", "wide", "palazzo", "flare"], male: ["straight", "slim", "wide"] };
    for (const body of BODIES) {
      const g = garmentById(`${body}-trousers`)!;
      expect(g.legs, body).toEqual({ offered: offered[body], default: "straight" });
      expect(CUTS[body].DEFAULT_LEG, body).toBe(g.legs!.default);
      expect(legsOffered(g).map((l) => l.id), body).toEqual(LEG_SHAPES.filter((l) => offered[body].includes(l)));
    }
    expect(legsOffered(garmentById("female-trousers")!).map((l) => l.name.ar)).toEqual(["مستقيم", "ضيق", "واسع", "بالاتسو", "شارلستون"]);
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

  it("cuts a palazzo wider than a wide leg, its legs apart above the knee and meeting at the centre below it, never crossing", () => {
    const d = draft("female");
    const knee = kneeOf("female");
    const from = her.meetsFrom("palazzo")!;
    expect(from, "starts to meet between the crotch and the knee").toBeGreaterThan(d.crotchY + 40);
    expect(from).toBeLessThan(knee);
    for (const leg of ["straight", "slim", "wide", "flare"] as const) expect(her.meetsFrom(leg), leg).toBeUndefined();
    const straight = her.legsFor();
    const wide = her.legsFor(undefined, "wide");
    const palazzo = her.legsFor(undefined, "palazzo");
    for (const y of rows("female")) {
      const [o, i] = across(palazzo.left, y);
      const name = `y ${y}`;
      /* never past the centre line: the legs meet there, and do not cross */
      expect(i, name).toBeLessThanOrEqual(300 + 0.01);
      /* above where they start to meet, the inseam is the straight leg's: the same daylight between the legs */
      if (y < from) expect(i, name).toBeCloseTo(across(straight.left, y)[1], 6);
      /* below the knee, on the centre line */
      if (y >= knee) expect(i, name).toBeCloseTo(300, 6);
      /* and fuller than a wide leg all the way down */
      expect(o, name).toBeLessThanOrEqual(across(wide.left, y)[0] + 0.01);
    }
    /* below the knee the two legs lie against each other: a centre seam, not an edge */
    expect(palazzo.seam.split("M").length, "the centre front seam and the seam below the knee").toBeGreaterThan(2);
    const hem = her.HEM_Y - 6;
    expect(cm(((s) => s[1] - s[0])(across(palazzo.left, hem))), "a palazzo's hem, each leg").toBeGreaterThan(20);
  });

  it("cuts a flare straight to the knee, then opening outward to the hem, faster toward it, its inseam where the straight leg's is", () => {
    const knee = kneeOf("female");
    const straight = her.legsFor();
    const flare = her.legsFor(undefined, "flare");
    const width = (L: { left: string }, y: number) => ((s) => s[1] - s[0])(across(L.left, y));
    for (const y of rows("female")) {
      const [o, i] = across(flare.left, y);
      const [so, si] = across(straight.left, y);
      const name = `y ${y}`;
      expect(i, name).toBeCloseTo(si, 6);
      if (y < knee - 6) expect(o, name).toBeCloseTo(so, 6);
      else expect(o, name).toBeLessThanOrEqual(so + 0.01);
    }
    const hem = her.HEM_Y - 6;
    const kneeW = width(flare, knee);
    expect(width(flare, hem) / kneeW, "its hem at least half again the knee").toBeGreaterThanOrEqual(1.5);
    /* opening slowly just below the knee and faster toward the hem: a bell, not a cone */
    const third = (hem - knee) / 3;
    const steps = [0, 1, 2].map((k) => width(flare, knee + third * (k + 1)) - width(flare, knee + third * k));
    expect(steps[1], "faster in the middle third than the first").toBeGreaterThan(steps[0]);
    expect(steps[2], "and fastest in the last").toBeGreaterThan(steps[1]);
  });

  it("is a choice on the worn trousers, resolved when read, and carried across to the other body", () => {
    const worn = wear([], cutFrom(garmentById("female-trousers")!, "fb-apricot-linen"));
    expect(legOf(worn[0])).toBe("straight");
    const wide = setLeg(worn, "female-trousers", "wide");
    expect(legOf(wide[0])).toBe("wide");
    /* a leg it does not offer falls back to how it arrives */
    expect(legOf({ ...worn[0], leg: "culotte" as never })).toBe("straight");
    /* none for a garment with no choice of leg */
    expect(legOf(cutFrom(garmentById("female-skirt")!, "fb-apricot-linen"))).toBeUndefined();
    const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn: wide };
    const him = switchBody(outfit, "male", "fb-apricot-linen");
    const trousersOn = him.worn.find((w) => w.garmentId === "male-trousers")!;
    expect(legOf(trousersOn)).toBe("wide");
    /* and a leg his trousers do not offer comes across as how they arrive */
    const palazzo = { ...outfit, worn: setLeg(worn, "female-trousers", "palazzo") };
    expect(legOf(switchBody(palazzo, "male", "fb-apricot-linen").worn.find((w) => w.garmentId === "male-trousers")!)).toBe("straight");
  });
});
