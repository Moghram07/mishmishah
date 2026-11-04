import { describe, expect, it } from "vitest";
import { garmentById, garments } from "@/lib/data/garments";
import { frontsFor } from "@/lib/data/fronts";
import { sleeveLengthsFor, sleeveTypeName, sleeveTypesFor } from "@/lib/data/sleeves";
import { effectiveCoverage, frontOf, setFront, sleeveOf } from "./outfit";
import { CLOSED_STITCH, ROBE, cloth, enclosesFor, robeFor } from "./art/female/abayaCut";
import { draft } from "./fit";
import { ROBE_TYPES } from "./sleeves";
import type { WornGarment } from "@/types";

const worn = (garmentId: string, extra: Partial<WornGarment> = {}): WornGarment => ({
  garmentId,
  fabrics: {},
  stitch: {},
  ...extra,
});

describe("her abaya, open and closed", () => {
  it("is offered open and closed, and arrives open", () => {
    const abaya = garmentById("female-abaya")!;
    expect(abaya.fronts).toEqual({ offered: ["open", "closed"], default: "open" });
    expect(frontsFor(abaya).map((f) => [f.name.en, f.name.ar])).toEqual([
      ["Open", "مفتوحة"],
      ["Closed", "مقفلة"],
    ]);
    /* nothing else in the wardrobe is worn open or closed */
    expect(frontsFor(garmentById("female-jacket")!)).toEqual([]);
  });

  it("resolves its front to what it offers", () => {
    expect(frontOf(worn("female-abaya"))).toBe("open");
    expect(frontOf(worn("female-abaya", { front: "closed" }))).toBe("closed");
    expect(frontOf(worn("female-dress", { front: "closed" }))).toBeUndefined();
  });

  it("closes the abaya and nothing else", () => {
    const outfit = [worn("female-dress"), worn("female-abaya")];
    const closed = setFront(outfit, "female-abaya", "closed");
    expect(closed.map((w) => w.front)).toEqual([undefined, "closed"]);
    expect(frontOf(closed[1])).toBe("closed");
  });

  it("claims no more of her closed than open: its cloth paints over the rest", () => {
    const abaya = garmentById("female-abaya")!;
    expect(effectiveCoverage(abaya, worn("female-abaya", { front: "closed" }))).toEqual(
      effectiveCoverage(abaya, worn("female-abaya"))
    );
  });

  it("is one panel closed, two fronts open, with the same sleeves", () => {
    expect(cloth()).toEqual(cloth({ front: "open" }));
    expect(cloth({ front: "open" })).toEqual([ROBE.open.right, ROBE.open.left, ...ROBE.sleeves]);
    expect(cloth({ front: "closed" })).toEqual([ROBE.closed.body, ...ROBE.sleeves]);
    expect(ROBE.sleeves).toHaveLength(2);
  });

  it("is cut with a regular, a wide, a kimono and a butterfly sleeve, all long, named as an abaya's are", () => {
    const abaya = garmentById("female-abaya")!;
    expect(sleeveTypesFor(abaya)).toEqual(["set-in", "bell", "kimono", "butterfly"]);
    expect(sleeveTypesFor(abaya).map((t) => sleeveTypeName(abaya, t).ar)).toEqual(["عادي", "واسع", "كيمونو", "فراشة"]);
    expect(sleeveTypesFor(abaya).map((t) => sleeveTypeName(abaya, t).en)).toEqual(["Regular", "Wide", "Kimono", "Butterfly"]);
    for (const type of sleeveTypesFor(abaya)) expect(sleeveLengthsFor(type, undefined, abaya), type).toEqual(["long"]);
    /* a kimono is long on the abaya alone: the dress still cuts it short or to the elbow, and names its sleeves its own way */
    const dress = garmentById("female-dress")!;
    expect(sleeveLengthsFor("kimono", undefined, dress)).toEqual(["sleeveless", "short", "elbow"]);
    expect(sleeveTypeName(dress, "set-in").ar).toBe("مركّب");
    expect(sleeveTypeName(dress, "bell").ar).toBe("جرسي");
    /* the butterfly is a robe's alone: nothing else offers it */
    expect(ROBE_TYPES).toEqual(["butterfly"]);
    expect(garments.filter((g) => g.sleeves?.types.includes("butterfly")).map((g) => g.id)).toEqual(["female-abaya"]);
  });

  it("resolves its sleeve to a long one of the four, and arrives in the regular one", () => {
    expect(sleeveOf(worn("female-abaya"))).toEqual({ type: "set-in", length: "long" });
    expect(sleeveOf(worn("female-abaya", { sleeve: { type: "kimono", length: "short" } }))).toEqual({ type: "kimono", length: "long" });
    expect(sleeveOf(worn("female-abaya", { sleeve: { type: "butterfly", length: "long" } }))).toEqual({ type: "butterfly", length: "long" });
    expect(sleeveOf(worn("female-abaya", { sleeve: { type: "puff", length: "elbow" } }))).toEqual({ type: "set-in", length: "long" });
  });

  it("holds what is under it to the sleeve it is worn with: its cuffs where that sleeve ends", () => {
    for (const type of ["set-in", "bell", "kimono", "butterfly"] as const) {
      const r = robeFor({ sleeve: { type, length: "long" } });
      /* a butterfly has no sleeve piece: its wings are its body — but it lies over both arms all the same */
      expect(r.sleeves, type).toHaveLength(type === "butterfly" ? 0 : 2);
      expect(r.sleeveAreas, type).toHaveLength(2);
      expect(r.encloses.cuff, type).toBe(480);
      expect(r.encloses.windows, type).toHaveLength(2);
      expect(enclosesFor({ sleeve: { type, length: "long" } })).toBe(r.encloses);
    }
    /* a kimono's body leaves its side from a deeper underarm */
    expect(robeFor({ sleeve: { type: "kimono", length: "long" } }).underarm).toBeGreaterThan(ROBE.underarm);
  });

  it("hangs its butterfly's wings from her arms to the hem, as a cape", () => {
    const sleeve = { type: "butterfly", length: "long" } as const;
    const r = robeFor({ sleeve });
    const side = r.cut.left.side;
    /* its body and its wings are one: nothing but its fronts, open, or its one panel, closed */
    expect(cloth({ sleeve })).toEqual([r.open.right, r.open.left]);
    expect(cloth({ sleeve, front: "closed" })).toEqual([r.closed.body]);
    /* its side runs from the shoulder's end — where its kimono leaves the shoulder too — round the arm to the hem */
    expect(side[0]).toEqual(robeFor({ sleeve: { type: "kimono", length: "long" } }).cut.left.cutOn!.out[0]);
    expect(side[side.length - 1][1]).toBe(906);
    /* below where it leaves the arm, one straight line at its wings' slope, 10 out in every 100 down */
    const below = side.filter(([, y]) => y >= r.underarm);
    for (const [x, y] of below) expect(x + 0.1 * y).toBeCloseTo(below[0][0] + 0.1 * below[0][1], 6);
    /* clear of her arm and her hand all the way down, by the sleeve's room over a sleeve worn under it */
    const arm = draft("female");
    for (let y = Math.ceil(r.underarm); y <= arm.armEndY; y++) {
      const [x0, y0] = below[0];
      expect(arm.armOutAt(y, 0) - (x0 - 0.1 * (y - y0)), `y ${y}`).toBeGreaterThan(9.5);
    }
    /* so it is fuller at the hem than the robe cut with a sleeve */
    expect(r.encloses.hem.x).toBeLessThan(ROBE.encloses.hem.x - 25);
    /* and its hand comes out under a lip across the wrist, dipping under it */
    const wrist = r.cut.left.wrist!;
    expect(wrist[0][1]).toBe(478);
    expect(Math.max(...wrist.map(([, y]) => y))).toBeGreaterThan(482);
    expect(wrist[0][0]).toBeLessThan(arm.armOutAt(480, 0));
    expect(wrist[wrist.length - 1][0]).toBeGreaterThan(arm.armInAt(480, 0));
    expect(r.sleeveEdges).toHaveLength(2);
  });

  it("fastens closed under a seam down the centre line, topstitched beside it on the front that laps over", () => {
    const { seam } = ROBE.closed;
    expect(seam.every(([x]) => x === 300)).toBe(true);
    /* from just under the neckline's dip to the hem, which dips at the centre too */
    expect(seam[0][1]).toBeGreaterThan(190);
    expect(seam[0][1]).toBeLessThan(196);
    expect(seam[seam.length - 1][1]).toBeGreaterThan(906);
    expect(CLOSED_STITCH.every(([x]) => x === 295)).toBe(true);
    expect(CLOSED_STITCH[CLOSED_STITCH.length - 1][1]).toBeLessThan(seam[seam.length - 1][1] - 10);
  });
});
