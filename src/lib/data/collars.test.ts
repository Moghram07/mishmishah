import { describe, expect, it } from "vitest";
import { bodies } from "@/lib/mannequin/bodies";
import { garments } from "./garments";
import {
  collarById,
  collars,
  collarsFor,
  collarsForGarment,
  defaultCollar,
} from "./collars";
import type { BodyType, GarmentCategory } from "@/types";

/**
 * The shape of the collar catalogue.
 *
 * A collar is cut against one figure's neck points and sewn to one kind of
 * neckline, so "which body" and "which category" are not labels — they decide
 * what the picker offers, what survives a mannequin switch and what the
 * renderer will draw. The geometry behind those claims is checked by
 * `npm run check:garments`, which walks every collar against every garment it
 * names; what is asserted here is that the records themselves hold together.
 */

const BODY_TYPES = Object.keys(bodies) as BodyType[];
const CATEGORIES: GarmentCategory[] = [...new Set(garments.map((g) => g.category))];

describe("every collar belongs to exactly one body", () => {
  it("gives every collar a body that exists", () => {
    for (const collar of collars) {
      expect(BODY_TYPES, collar.id).toContain(collar.gender);
    }
  });

  it("uses each id once, and never one a garment could answer to", () => {
    const ids = collars.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(garments.some((g) => g.id === id), id).toBe(false);
    }
  });

  it("names the body it is cut for in its id", () => {
    for (const collar of collars) {
      expect(collar.id.startsWith(`${collar.gender}-`), collar.id).toBe(true);
      expect(collar.id.endsWith("-collar"), collar.id).toBe(true);
    }
  });

  it("splits the whole catalogue between the wardrobes", () => {
    const total = BODY_TYPES.reduce((n, b) => n + collarsFor(b).length, 0);
    expect(total).toBe(collars.length);
  });
});

describe("a collar is only ever offered where it fits", () => {
  it("fits at least one real category", () => {
    for (const collar of collars) {
      expect(collar.compatibleWith.length, collar.id).toBeGreaterThan(0);
      for (const category of collar.compatibleWith) {
        expect(CATEGORIES, `${collar.id} → ${category}`).toContain(category);
      }
    }
  });

  it("is never selectable on a garment from another body", () => {
    // The assertion the male mannequin bug taught us to write, one layer up:
    // eligibility has to be a rule, not a hope.
    for (const garment of garments) {
      for (const collar of collarsForGarment(garment)) {
        expect(collar.gender, `${collar.id} on ${garment.id}`).toBe(
          garment.gender
        );
      }
    }
  });

  it("is never offered on a garment that has no neckline for one", () => {
    for (const garment of garments.filter((g) => !g.acceptsCollar)) {
      expect(collarsForGarment(garment), garment.id).toHaveLength(0);
    }
  });

  it("gives both wardrobes collars of their own", () => {
    // The male wardrobe used to draw its collars inside its garments, and that
    // is precisely why they were the worst-looking pieces in the app: the
    // geometry checks walk the *records*, so a collar that is not one is a
    // collar nothing measures. Every top with a neckline now leaves it to a
    // record, and nothing in the renderer changed to allow it.
    for (const body of BODY_TYPES) {
      expect(collarsFor(body).length, body).toBeGreaterThan(0);
    }
    for (const garment of garments) {
      if (!garment.acceptsCollar) continue;
      expect(
        garment.fabricRegions.includes("collar"),
        `${garment.id} draws its own collar and accepts a swappable one`
      ).toBe(false);
      expect(collarsForGarment(garment).length, garment.id).toBeGreaterThan(0);
    }
  });
});

describe("every collar declares how big it is", () => {
  // The drawing is measured against these bands by `npm run check:garments`;
  // what is asserted here is that the bands themselves say something. A
  // footprint wide enough to admit anything is not a constraint.
  it("gives a band that is ordered, positive and not open-ended", () => {
    for (const collar of collars) {
      for (const axis of ["width", "drop"] as const) {
        const [lo, hi] = collar.footprint[axis];
        expect(lo, `${collar.id} ${axis}`).toBeGreaterThan(0);
        expect(hi, `${collar.id} ${axis}`).toBeGreaterThan(lo);
        expect(hi - lo, `${collar.id} ${axis} band`).toBeLessThanOrEqual(8);
      }
    }
  });

  it("does not declare nine collars to be the same size", () => {
    // The records have to disagree before the drawings can. If every band
    // overlapped every other, the drawings could all be one shape and still
    // satisfy every one of them.
    const widths = collars.map((c) => c.footprint.width);
    const lo = Math.min(...widths.map(([a]) => a));
    const hi = Math.max(...widths.map(([, b]) => b));
    expect(hi / lo).toBeGreaterThan(2.5);
  });

  it("declares the shortest band each body has the smallest, and the sailor the widest", () => {
    const by = (id: string) => collarById(id)!.footprint;
    // By area, not by width. Bands round the same throat are the same width;
    // what separates them is height, and `check:garments` compares them by
    // area for the same reason. Each body's own: her mandarin, his short
    // regular collar, a band two and a half centimetres tall.
    const area = (f: { width: number[]; drop: number[] }) =>
      f.width[1] * f.drop[1];
    for (const [body, smallest] of [["female", "female-mandarin-collar"], ["male", "male-regular-short-collar"]] as const) {
      for (const other of collars.filter((c) => c.gender === body && c.id !== smallest)) {
        expect(area(other.footprint), `${other.id} vs ${smallest}`).toBeGreaterThan(area(by(smallest)));
      }
    }
    for (const other of collars.filter((c) => c.id !== "female-sailor-collar")) {
      expect(other.footprint.width[0], `${other.id} vs sailor`).toBeLessThan(
        by("female-sailor-collar").width[0]
      );
    }
  });
});

describe("a collar that stands has to wrap the neck", () => {
  it("gives every standing collar a behindBody piece", () => {
    // The half that passes behind the throat. Without it the band stops dead
    // at the silhouette and reads as paint on skin, which is what the first
    // two attempts looked like — the geometry is checked by check:garments,
    // and what is asserted here is that the record cannot omit it.
    for (const collar of collars) {
      if (collar.build.stand <= 0) continue;
      expect(collar.asset.behindBody, collar.id).toBeDefined();
    }
  });

  it("sews every standing collar to an opening at the base of the neck", () => {
    // A band hung from a crew neck stands on the chest, thirty units below the
    // neck it is supposed to wrap.
    for (const collar of collars) {
      if (collar.build.stand <= 0) continue;
      expect(collar.opening, collar.id).not.toBe("round");
    }
  });

  it("gives a flat collar no stand and no band behind", () => {
    // It lies on the garment round the opening it is sewn to — a round neck,
    // or a sailor's V — never at the base of the neck, where a band stands.
    for (const collar of collars) {
      if (collar.build.stand > 0) continue;
      expect(collar.asset.behindBody, collar.id).toBeUndefined();
      for (const opening of collar.cuts ?? [collar.opening]) expect(["round", "v"], collar.id).toContain(opening);
    }
  });

  it("spans a real range of stands, none of them nominal", () => {
    // This used to assert the turtleneck was the tallest, which stopped being
    // true when the ruff became a ring standing round the throat rather than a
    // horseshoe hanging below it — and "tallest" was never the property worth
    // pinning. What matters is that the heights genuinely differ: they were
    // once nine numbers describing one shared 22-unit band.
    const standing = collars
      .map((c) => c.build.stand)
      .filter((n) => n > 0)
      .sort((a, b) => a - b);
    expect(standing.length).toBeGreaterThan(4);
    expect(standing[standing.length - 1] / standing[0]).toBeGreaterThan(3);
    expect(new Set(standing).size).toBeGreaterThan(standing.length / 2);
  });

  it("keeps the mandarin a band and the Peter Pan flat", () => {
    expect(collarById("female-mandarin-collar")!.build.fall).toBe("none");
    expect(collarById("female-turtleneck-collar")!.build.fall).toBe("none");
    expect(collarById("female-peter-pan-collar")!.build.stand).toBe(0);
  });
});

describe("a collar claims only the zones it covers", () => {
  it("claims nothing, because none of them cover a zone end to end", () => {
    // Two used to claim one: the cowl the upper chest, the turtleneck the neck.
    // The cowl is gone, and the turtleneck is a band at the throat now rather
    // than a tube to the collarbone — it covers the neck one sees but not the
    // `neck` *zone*, which runs to y 200.
    //
    // A claim is geometry, not decoration: `check:garments` measures it against
    // the collar's own cloth and fails a collar that claims a zone it leaves
    // bare, because coverage erases the photograph and a claim nothing paints
    // back is a hole in the body. So none of them claim anything.
    for (const collar of collars) {
      expect(collar.coverage, collar.id).toEqual([]);
    }
  });
});

describe("a garment finishes its own neck or leaves it to a collar", () => {
  it("never does both", () => {
    // Two drawings claiming the `collar` region would fight over one fabric.
    for (const garment of garments) {
      if (!garment.acceptsCollar) continue;
      expect(garment.fabricRegions, garment.id).not.toContain("collar");
    }
  });

  it("only names a default it can actually wear", () => {
    for (const garment of garments) {
      if (!garment.defaultCollar) continue;
      expect(garment.acceptsCollar, garment.id).toBe(true);
      const collar = collarById(garment.defaultCollar);
      expect(collar, `${garment.id} → ${garment.defaultCollar}`).toBeDefined();
      expect(collarsForGarment(garment)).toContain(collar);
      expect(defaultCollar(garment)).toBe(collar);
    }
  });

  it("keeps the blouse and the jacket looking as they always did", () => {
    // Their collar and lapel were lifted out of the drawings into records;
    // arriving without them would be a visible regression, not a refactor.
    expect(defaultCollar(garments.find((g) => g.id === "female-blouse")!)?.id).toBe(
      "female-shirt-collar"
    );
    expect(defaultCollar(garments.find((g) => g.id === "female-jacket")!)?.id).toBe(
      "female-notched-collar"
    );
  });
});
