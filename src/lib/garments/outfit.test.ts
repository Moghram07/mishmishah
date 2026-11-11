import { describe, expect, it } from "vitest";
import { garmentById, garments, garmentsFor } from "@/lib/data/garments";
import { collars } from "@/lib/data/collars";
import { bodies } from "@/lib/mannequin/bodies";
import { collarArt, garmentArt } from "./art";
import {
  changeBody,
  collarOf,
  conflicts,
  counterpart,
  coveredZones,
  cutFrom,
  effectiveCoverage,
  isWearing,
  regionsOf,
  setCollar,
  stack,
  takeOff,
  visibleStack,
  wear,
  wornOn,
} from "./outfit";
import type { BodyType, WornGarment } from "@/types";

/**
 * Dressing rules.
 *
 * The mannequin renderer draws whatever these functions hand it, so every way
 * an outfit can go wrong is decided here: two tops on at once, a dress worn
 * over trousers, a shirt still being drawn under a fastened jacket, a garment
 * left on a body it was never cut for. None of it needs a DOM.
 */

const BODY_TYPES = Object.keys(bodies) as BodyType[];

const g = (id: string) => {
  const found = garmentById(id);
  // With twelve ids across two wardrobes, "cannot read properties of
  // undefined" three frames down is not a useful way to learn about a typo.
  if (!found) throw new Error(`no garment "${id}"`);
  return found;
};
const on = (id: string): WornGarment => cutFrom(g(id), "fb-any");
const ids = (worn: WornGarment[]) => worn.map((w) => w.garmentId).sort();
const drawn = (worn: WornGarment[]) =>
  visibleStack(worn).map((e) => e.garment.id);

describe("what can be worn with what", () => {
  it("replaces a garment on the same layer", () => {
    // Two tops is not an outfit; the second one wins.
    const worn = wear(wear([], on("female-t-shirt")), on("female-blouse"));
    expect(ids(worn)).toEqual(["female-blouse"]);
  });

  it("keeps garments on different layers", () => {
    const worn = wear(wear([], on("female-t-shirt")), on("female-trousers"));
    expect(ids(worn)).toEqual(["female-t-shirt", "female-trousers"]);
  });

  it("clears both halves when a dress goes on", () => {
    const dressed = wear(wear([], on("female-blouse")), on("female-trousers"));
    expect(ids(wear(dressed, on("female-dress")))).toEqual(["female-dress"]);
  });

  it("clears the dress when a bottom goes on over it", () => {
    // The skirt says nothing about dresses — the dress says it about skirts,
    // and the rule has to read in both directions or order decides the answer.
    expect(g("female-skirt").incompatibleWith).not.toContain("female-dress");
    expect(ids(wear(wear([], on("female-dress")), on("female-skirt")))).toEqual(
      ["female-skirt"]
    );
  });

  it("replaces trousers with a skirt", () => {
    expect(
      ids(wear(wear([], on("female-trousers")), on("female-skirt")))
    ).toEqual(["female-skirt"]);
  });

  it("never leaves two of the same garment on", () => {
    const worn = wear(wear([], on("female-jacket")), on("female-jacket"));
    expect(ids(worn)).toEqual(["female-jacket"]);
  });

  it("takes a garment off without touching the rest", () => {
    const worn = wear(wear([], on("female-t-shirt")), on("female-trousers"));
    expect(ids(takeOff(worn, "female-t-shirt"))).toEqual(["female-trousers"]);
    expect(isWearing(takeOff(worn, "female-t-shirt"), "female-t-shirt")).toBe(
      false
    );
  });

  it("says a garment conflicts with itself", () => {
    expect(conflicts(g("female-jacket"), g("female-jacket"))).toBe(true);
  });
});

describe("draw order", () => {
  it("puts a bottom under a top and a top under outerwear", () => {
    const worn = [
      on("female-jacket"),
      on("female-trousers"),
      on("female-t-shirt"),
    ];
    expect(stack(worn).map((e) => e.garment.id)).toEqual([
      "female-trousers",
      "female-t-shirt",
      "female-jacket",
    ]);
  });

  it("ignores a garment id that no longer exists", () => {
    const worn: WornGarment[] = [
      { garmentId: "monocle", fabrics: {}, stitch: {} },
      on("female-skirt"),
    ];
    expect(stack(worn).map((e) => e.garment.id)).toEqual(["female-skirt"]);
  });
});

describe("coverage decides what is still visible", () => {
  it("keeps drawing a t-shirt under a jacket, because the V shows it", () => {
    // This used to assert the opposite, and the opposite used to be right:
    // both garments covered `torso` and `upperArm` and nothing else existed
    // between the neck and the bust, so the jacket covered everything the
    // t-shirt did. Adding `upperChest` to the vocabulary made the jacket's
    // deep V a fact the rules can see — it covers no chest, the t-shirt does,
    // so the t-shirt is no longer hidden. What showed through that V before
    // was the photograph's bare skin.
    const worn = wear(wear([], on("female-t-shirt")), on("female-jacket"));
    expect(g("female-jacket").coverage).not.toContain("upperChest");
    expect(g("female-t-shirt").coverage).toContain("upperChest");
    expect(drawn(worn)).toEqual(["female-t-shirt", "female-jacket"]);
  });

  it("draws the t-shirt alone the moment the jacket comes off", () => {
    const worn = wear(wear([], on("female-t-shirt")), on("female-jacket"));
    expect(drawn(takeOff(worn, "female-jacket"))).toEqual(["female-t-shirt"]);
  });

  it("keeps drawing a dress under a jacket, because its skirt still shows", () => {
    const worn = wear(wear([], on("female-dress")), on("female-jacket"));
    expect(drawn(worn)).toEqual(["female-dress", "female-jacket"]);
  });

  it("keeps drawing trousers under a jacket", () => {
    const worn = wear(wear([], on("female-trousers")), on("female-jacket"));
    expect(drawn(worn)).toEqual(["female-trousers", "female-jacket"]);
  });

  it("stops drawing trousers under a thobe, with no rule saying so", () => {
    // A thobe is worn over trousers and covers every zone they cover, so
    // coverage alone hides them. No `incompatibleWith` entry is involved, and
    // they come back untouched the moment it comes off.
    expect(g("male-thobe").incompatibleWith).toEqual([]);
    const worn = wear(wear([], on("male-trousers")), on("male-thobe"));
    expect(ids(worn)).toEqual(["male-thobe", "male-trousers"]);
    expect(drawn(worn)).toEqual(["male-thobe"]);
    expect(drawn(takeOff(worn, "male-thobe"))).toEqual(["male-trousers"]);
  });

  it("hides every zone the outfit covers, and no others", () => {
    // The t-shirt's short sleeve ends above the elbow, so it spans none of the
    // upper-arm zone and claims none of it — the arm below the cuff is drawn.
    const worn = wear(wear([], on("female-t-shirt")), on("female-trousers"));
    expect([...coveredZones(worn)].sort()).toEqual([
      "calf",
      "hip",
      "knee",
      "shoulderCap",
      "thigh",
      "torso",
      "upperChest",
    ]);
  });

  it("leaves the head, neck, hands and feet bare whatever is worn", () => {
    for (const body of BODY_TYPES) {
      const everything = garmentsFor(body).reduce<WornGarment[]>(
        (worn, garment) => wear(worn, cutFrom(garment, "fb-any")),
        []
      );
      const covered = coveredZones(everything);
      for (const zone of ["head", "neck", "hand", "foot"] as const) {
        expect(covered.has(zone), `${body} / ${zone}`).toBe(false);
      }
    }
  });
});

describe("a garment is only ever worn on the body it is cut for", () => {
  it("drops a garment belonging to the other body", () => {
    const worn = [on("female-dress"), on("male-thobe")];
    expect(ids(wornOn(worn, "male"))).toEqual(["male-thobe"]);
    expect(ids(wornOn(worn, "female"))).toEqual(["female-dress"]);
  });

  it("erases nothing when the only garment is cut for another body", () => {
    // The bug this whole change exists for. A female dress reaching the male
    // renderer erased his torso, hip and thigh — zones its drawing never
    // reaches — and he came through the hole. Guard first, then derive.
    const strays = [on("female-dress")];
    expect(coveredZones(wornOn(strays, "male")).size).toBe(0);
    expect(visibleStack(wornOn(strays, "male"))).toEqual([]);
  });
});

describe("switching body", () => {
  it("finds a counterpart for every garment on every body", () => {
    // Totality is what keeps the mannequin from being left bare.
    for (const garment of garments) {
      for (const body of BODY_TYPES) {
        const swap = counterpart(garment, body);
        expect(swap, `${garment.id} → ${body}`).toBeDefined();
        expect(swap!.gender).toBe(body);
      }
    }
  });

  it("changes nothing when the body is already right", () => {
    const worn = wear(wear([], on("female-dress")), on("female-jacket"));
    expect(ids(changeBody(worn, "female"))).toEqual(ids(worn));
  });

  it("swaps a dress for a thobe and back again", () => {
    const toMale = changeBody([on("female-dress")], "male");
    expect(ids(toMale)).toEqual(["male-thobe"]);
    expect(ids(changeBody(toMale, "female"))).toEqual(["female-dress"]);
  });

  it("round-trips the pieces both wardrobes have", () => {
    for (const piece of ["t-shirt", "trousers", "jacket"]) {
      const there = changeBody([on(`female-${piece}`)], "male");
      expect(ids(there)).toEqual([`male-${piece}`]);
      expect(ids(changeBody(there, "female"))).toEqual([`female-${piece}`]);
    }
  });

  it("falls back to the category when the piece does not exist", () => {
    // There is no male blouse and no male skirt; he gets a top and a bottom.
    expect(counterpart(g("female-blouse"), "male")!.category).toBe("top");
    expect(counterpart(g("female-skirt"), "male")!.id).toBe("male-trousers");
  });

  it("carries the cloth across the change of pattern", () => {
    // The dress is cut from `top`/`bottom`; the thobe from `body`/`placket`,
    // plus the `collar` of whichever collar it arrives wearing. None of those
    // names exist on the dress, so every one of them falls back to the cloth
    // the dress was mostly made of — which is the rule: switching body changes
    // the pattern, never the cloth.
    const dress: WornGarment = {
      garmentId: "female-dress",
      fabrics: { top: "fb-silk", bottom: "fb-silk" },
      stitch: { top: "gold" },
    };
    const [thobe] = changeBody([dress], "male");
    expect(thobe.garmentId).toBe("male-thobe");
    expect(thobe.fabrics).toEqual({
      body: "fb-silk",
      placket: "fb-silk",
      collar: "fb-silk",
    });
  });

  it("never leaves two garments that conflict", () => {
    // A blouse and a t-shirt both become male tops — only one may survive.
    const swapped = changeBody(
      [on("female-blouse"), on("female-t-shirt")],
      "male"
    );
    expect(swapped).toHaveLength(1);
    expect(garmentById(swapped[0].garmentId)!.gender).toBe("male");
  });

  it("keeps a full outfit whole", () => {
    const worn = wear(
      wear(wear([], on("female-t-shirt")), on("female-trousers")),
      on("female-jacket")
    );
    expect(ids(changeBody(worn, "male"))).toEqual([
      "male-jacket",
      "male-t-shirt",
      "male-trousers",
    ]);
  });

  it("leaves an empty outfit empty, and drops unknown garments", () => {
    expect(changeBody([], "male")).toEqual([]);
    expect(
      changeBody([{ garmentId: "monocle", fabrics: {}, stitch: {} }], "male")
    ).toEqual([]);
  });
});

describe("a collar is a part of the garment it is sewn to", () => {
  const blouse = () => cutFrom(g("female-blouse"), "fb-any");

  it("arrives on the garments that name a default", () => {
    // The blouse's collar used to be inside its drawing. It is a record now,
    // and the blouse still turns up wearing it.
    expect(blouse().collarId).toBe("female-shirt-collar");
    expect(collarOf(blouse())?.id).toBe("female-shirt-collar");
    expect(on("female-t-shirt").collarId).toBeUndefined();
  });

  it("adds its coverage to the garment's rather than replacing it", () => {
    // No collar in the catalogue claims a body zone any more — the cowl is
    // gone and the turtleneck is a band at the throat rather than a tube to
    // the collarbone — so the half of this rule with data behind it is that
    // sewing a collar on never *loses* a zone the garment covers. The union
    // arm goes untested until a collar earns a claim again; `check:garments`
    // is what would police the claim itself if one did.
    const bare = on("female-t-shirt");
    const worn = setCollar([bare], "female-t-shirt", "female-turtleneck-collar");
    const before = effectiveCoverage(g("female-t-shirt"), bare);
    const after = effectiveCoverage(g("female-t-shirt"), worn[0]);
    expect(after).toEqual(expect.arrayContaining(before));
    expect(new Set(after).size).toBe(after.length);
    // And the renderer no longer erases the photograph's neck under it.
    expect(coveredZones(worn).has("neck")).toBe(false);
  });

  it("takes a fabric region of its own, cut from the same cloth to start", () => {
    const worn = setCollar([on("female-t-shirt")], "female-t-shirt", "female-bow-collar");
    expect(regionsOf(g("female-t-shirt"), worn[0])).toEqual(["body", "collar"]);
    expect(worn[0].fabrics.collar).toBe("fb-any");
  });

  it("takes the region away again when it comes off", () => {
    const worn = setCollar([blouse()], "female-blouse", undefined);
    expect(worn[0].collarId).toBeUndefined();
    expect(worn[0].fabrics.collar).toBeUndefined();
    // the garment's own regions, and no collar among them
    expect(regionsOf(g("female-blouse"), worn[0])).toEqual(g("female-blouse").fabricRegions);
    expect(regionsOf(g("female-blouse"), worn[0])).not.toContain("collar");
  });

  it("refuses one cut for another body, or for another neckline", () => {
    // The renderer's guard: however the state got here, this is not a collar.
    const stale = { ...on("female-t-shirt"), collarId: "female-notched-collar" };
    expect(collarOf(stale)).toBeUndefined();
    const nonsense = { ...on("female-trousers"), collarId: "female-bow-collar" };
    expect(collarOf(nonsense)).toBeUndefined();
    expect(effectiveCoverage(g("female-trousers"), nonsense)).toEqual(
      g("female-trousers").coverage
    );
  });

  it("is dropped by a body switch the male wardrobe cannot answer", () => {
    // He has no collars of his own yet, so his shirt keeps the one it draws.
    const moved = changeBody([blouse()], "male");
    expect(moved[0].collarId).toBeUndefined();
    expect(collarOf(moved[0])).toBeUndefined();
  });
});

describe("every garment record matches its drawing", () => {
  for (const garment of garments) {
    it(`${garment.id} draws each region it declares`, () => {
      const art = garmentArt(garment.asset.front);
      expect(art).toBeDefined();
      // A region declared but not drawn is a blank area the fabric picker
      // still offers; a region drawn but not declared never gets a fabric.
      expect(Object.keys(art!.regions).sort()).toEqual(
        [...garment.fabricRegions].sort()
      );
    });
  }

  it("names its drawing after itself", () => {
    for (const garment of garments) {
      expect(garment.fabricRegions.length).toBeGreaterThan(0);
      expect(garment.asset.front).toBe(`${garment.id}-front`);
    }
  });

  for (const collar of collars) {
    it(`${collar.id} is drawn as one region of cloth`, () => {
      const art = collarArt(collar.asset.front);
      expect(art).toBeDefined();
      // and its trim, for a collar that takes one — the sailor's stripes, in their own cloth
      expect(Object.keys(art!.regions)).toEqual(collar.trims ? ["collar", "trim"] : ["collar"]);
      expect(collar.asset.front).toBe(`${collar.id}-front`);
    });
  }
});
