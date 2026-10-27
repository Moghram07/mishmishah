import { describe, expect, it } from "vitest";
import { bodies } from "@/lib/mannequin/bodies";
import {
  defaultGarment,
  garmentPiece,
  garments,
  garmentsFor,
} from "./garments";
import type { BodyType, GarmentCategory } from "@/types";

/**
 * The shape of the wardrobes.
 *
 * A garment is cut against one figure's anchors, so "which body is this for"
 * is not a label — it decides what may be offered, what survives a body switch
 * and what the renderer is allowed to draw. Everything downstream of that
 * assumes the invariants below, so they are asserted rather than assumed.
 */

const BODY_TYPES = Object.keys(bodies) as BodyType[];

describe("every garment belongs to exactly one body", () => {
  it("gives every garment a body that exists", () => {
    for (const garment of garments) {
      expect(BODY_TYPES, `${garment.id}`).toContain(garment.gender);
    }
  });

  it("uses each id once across both wardrobes", () => {
    // `garmentById` is a flat lookup, so a collision silently shadows.
    const ids = garments.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("prefixes every id with the body it is cut for", () => {
    // `garmentPiece` slices this prefix off to pair a garment with its
    // counterpart on the other body — the scheme is load-bearing, not cosmetic.
    for (const garment of garments) {
      expect(garment.id.startsWith(`${garment.gender}-`), garment.id).toBe(true);
      expect(garmentPiece(garment)).not.toBe("");
    }
  });

  it("splits the whole catalogue between the wardrobes, six each", () => {
    const total = BODY_TYPES.reduce((n, b) => n + garmentsFor(b).length, 0);
    expect(total).toBe(garments.length);
    for (const body of BODY_TYPES) {
      expect(garmentsFor(body), body).toHaveLength(6);
    }
  });

  it("never names a garment from the other body in incompatibleWith", () => {
    for (const garment of garments) {
      for (const other of garment.incompatibleWith) {
        const found = garments.find((g) => g.id === other);
        expect(found, `${garment.id} → ${other}`).toBeDefined();
        expect(found!.gender, `${garment.id} → ${other}`).toBe(garment.gender);
      }
    }
  });
});

describe("the two wardrobes line up", () => {
  it("offers every category on both bodies", () => {
    // This is what makes `counterpart` total: whatever is being worn, the
    // other body has something in the same category to swap to, so switching
    // never leaves the mannequin bare.
    const categories = (body: BodyType): GarmentCategory[] =>
      [...new Set(garmentsFor(body).map((g) => g.category))].sort();

    const [first, ...rest] = BODY_TYPES;
    for (const body of rest) {
      expect(categories(body), body).toEqual(categories(first));
    }
  });

  it("dresses each body in a garment cut for it", () => {
    for (const body of BODY_TYPES) {
      expect(defaultGarment(body).gender, body).toBe(body);
    }
  });
});

describe("every top has sleeves", () => {
  it("covers the upper arm on everything worn above the waist", () => {
    // Not a style rule. In a front view the arm hangs over the torso, and a
    // 2D stack has no depth to separate them — so a top that leaves the upper
    // arm bare cannot be drawn correctly at all.
    for (const garment of garments) {
      if (garment.category === "bottom") continue;
      expect(garment.coverage, garment.id).toContain("upperArm");
    }
  });
});
