import { describe, expect, it } from "vitest";
import { garmentById } from "@/lib/data/garments";
import { frontsFor } from "@/lib/data/fronts";
import { effectiveCoverage, frontOf, setFront } from "./outfit";
import { CLOSED_STITCH, ROBE, cloth } from "./art/female/abayaCut";
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
    expect(cloth({ front: "open" })).toEqual([ROBE.open.right, ROBE.open.left, ROBE.sleeveLeft, ROBE.sleeveRight]);
    expect(cloth({ front: "closed" })).toEqual([ROBE.closed.body, ROBE.sleeveLeft, ROBE.sleeveRight]);
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
