import { describe, expect, it } from "vitest";
import { garmentById, garments } from "@/lib/data/garments";
import { sleeveLengthsFor, sleeveTypesFor } from "@/lib/data/sleeves";
import { necklineById } from "@/lib/data/necklines";
import { cutFrom, effectiveCoverage, setNeckline, setSleeve, sleeveOf } from "./outfit";
import { SLEEVE_KINDS, cuffsOffered, hemRow, top } from "./sleeves";
import * as femaleYoke from "./art/female/yoke";
import * as maleYoke from "./art/male/yoke";
import { DEFAULT_SLEEVE as DRESS_DEFAULT } from "./art/female/dressCut";
import { DEFAULT_SLEEVE as F_TEE } from "./art/female/tShirt";
import { DEFAULT_SLEEVE as F_BLOUSE } from "./art/female/blouse";
import { DEFAULT_SLEEVE as M_TEE } from "./art/male/tShirt";
import { DEFAULT_SLEEVE as M_SHIRT } from "./art/male/shirt";
import { DEFAULT_SLEEVE as M_POLO } from "./art/male/polo";
import { DEFAULT_SLEEVE as M_THOBE } from "./art/male/thobe";
import type { BodyType, SleeveChoice } from "@/types";
import type { ReactElement } from "react";
import type { GarmentArt } from "./art/index";
import { BODY_CANVAS } from "@/lib/mannequin/bodies";

/** The lowest and outermost points of a path, read off its numbers. */
function extent(d: string) {
  const n = (d.match(/-?[0-9]*[.]?[0-9]+/g) ?? []).map(Number);
  const xs = n.filter((_, i) => i % 2 === 0);
  const ys = n.filter((_, i) => i % 2 === 1);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

const drafts: Record<BodyType, ReturnType<typeof top>> = {
  female: top("female", {
    tip: [femaleYoke.TIP_LEFT[0], femaleYoke.TIP_LEFT[1]],
    neck: [femaleYoke.NECK_LEFT[0], femaleYoke.NECK_LEFT[1]],
    neckRight: [femaleYoke.NECK_RIGHT[0], femaleYoke.NECK_RIGHT[1]],
    shoulderEase: femaleYoke.SHOULDER_EASE,
    ease: 4,
    hemY: 498,
    dip: 10,
    sleeve: [4, 5],
    inner: [2, 4],
  }),
  male: top("male", {
    tip: [maleYoke.TIP_LEFT[0], maleYoke.TIP_LEFT[1]],
    neck: [maleYoke.NECK_LEFT[0], maleYoke.NECK_LEFT[1]],
    neckRight: [maleYoke.NECK_RIGHT[0], maleYoke.NECK_RIGHT[1]],
    shoulderEase: maleYoke.SHOULDER_EASE,
    ease: 4,
    hemY: 500,
    dip: 10,
    sleeve: [4, 5],
    inner: [2, 4],
  }),
};
const openings = { female: femaleYoke.opening(34).front, male: maleYoke.opening(32).front };

describe("the records and the drawings agree", () => {
  it("arrives in the sleeve its record names", () => {
    const pairs: [string, SleeveChoice][] = [
      ["female-t-shirt", F_TEE],
      ["female-blouse", F_BLOUSE],
      ["female-dress", DRESS_DEFAULT],
      ["male-t-shirt", M_TEE],
      ["male-shirt", M_SHIRT],
      ["male-polo", M_POLO],
      ["male-thobe", M_THOBE],
    ];
    for (const [id, drawn] of pairs) {
      expect(garmentById(id)!.sleeves!.default, id).toEqual(drawn);
    }
  });

  it("offers each body only the sleeves made for it", () => {
    for (const g of garments) {
      if (!g.sleeves) continue;
      for (const t of g.sleeves.types) {
        expect(SLEEVE_KINDS[t].bodies, `${g.id} / ${t}`).toContain(g.gender);
      }
      const d = g.sleeves.default;
      expect(sleeveLengthsFor(d.type), g.id).toContain(d.length);
    }
    // the jackets keep their own sleeve: it is what makes them jackets
    expect(garmentById("female-jacket")!.sleeves).toBeUndefined();
    expect(garmentById("male-jacket")!.sleeves).toBeUndefined();
  });
});

describe("lengths come from the arm", () => {
  it("run shoulder to wrist in order, on each body's own rows", () => {
    for (const body of ["female", "male"] as const) {
      const rows = (["short", "elbow", "three-quarter", "long"] as const).map(
        (length) => hemRow(body, { type: "set-in", length })!
      );
      expect([...rows].sort((a, b) => a - b), body).toEqual(rows);
    }
    // his elbow and wrist are his, not hers
    expect(hemRow("male", { type: "set-in", length: "elbow" })).not.toBe(
      hemRow("female", { type: "set-in", length: "elbow" })
    );
    expect(hemRow("female", { type: "set-in", length: "sleeveless" })).toBeNull();
  });

  it("ends every sleeve on its landmark row, and the right one mirrors the left", () => {
    for (const body of ["female", "male"] as const) {
      const T = drafts[body];
      for (const type of Object.keys(SLEEVE_KINDS) as (keyof typeof SLEEVE_KINDS)[]) {
        if (!SLEEVE_KINDS[type].bodies.includes(body)) continue;
        // an off-shoulder sleeve hangs from its cut's band, and is drafted there
        if (SLEEVE_KINDS[type].construction === "band") continue;
        for (const length of SLEEVE_KINDS[type].lengths) {
          const c = { type, length };
          const k = T.cut(c, T.frame(openings[body], c));
          if (k.sleeves.length === 0) continue;
          const row = hemRow(body, c)!;
          const left = extent(k.sleeves[0]);
          const right = extent(k.sleeves[1]);
          // a banded sleeve's hem is its band; the sleeve blouses just over it
          const hemAt = k.bands.length ? extent(k.bands[0]).maxY : left.maxY;
          expect(Math.abs(hemAt - row), `${body} ${type} ${length}`).toBeLessThan(8);
          expect(Math.abs(left.minX - (600 - right.maxX)), `${body} ${type} ${length}`).toBeLessThan(2);
        }
      }
    }
  });
});

describe("a choice that no longer fits is resolved, not drawn", () => {
  const dress = garmentById("female-dress")!;
  const worn = () => cutFrom(dress, "fb-apricot-linen");

  it("keeps a sleeve inside the lengths its type comes in", () => {
    const w = setSleeve([worn()], dress.id, { type: "bishop", length: "short" })[0];
    expect(sleeveOf(w)).toEqual({ type: "bishop", length: "three-quarter" });
  });

  it("offers one-shouldered cuts only sleeves that leave the shoulder alone", () => {
    const types = sleeveTypesFor(dress, necklineById("female-asymmetrical-neckline"));
    expect(types).toContain("puff");
    expect(types).not.toContain("raglan");
    expect(types).not.toContain("kimono");
    const w = setNeckline(
      setSleeve([worn()], dress.id, { type: "raglan", length: "elbow" }),
      dress.id,
      "female-asymmetrical-neckline"
    )[0];
    expect(sleeveOf(w)!.type).toBe("set-in");
  });

  it("offers no sleeve at all on a cut that has none", () => {
    const w = setNeckline([worn()], dress.id, "female-sweetheart-neckline")[0];
    expect(sleeveOf(w)).toBeUndefined();
  });

  it("never gives him a sleeve that is not made for him", () => {
    const tee = garmentById("male-t-shirt")!;
    const w = setSleeve([cutFrom(tee, "fb-apricot-linen")], tee.id, { type: "puff", length: "short" })[0];
    expect(sleeveOf(w)!.type).toBe("set-in");
  });

  it("claims the arm only as far as the sleeve reaches", () => {
    const tee = garmentById("female-t-shirt")!;
    const short = cutFrom(tee, "fb-apricot-linen");
    expect(effectiveCoverage(tee, short)).not.toContain("upperArm");
    const elbow = setSleeve([short], tee.id, { type: "set-in", length: "elbow" })[0];
    expect(effectiveCoverage(tee, elbow)).toContain("upperArm");
    const none = setSleeve([short], tee.id, { type: "set-in", length: "sleeveless" })[0];
    expect(effectiveCoverage(tee, none)).not.toContain("shoulderCap");
  });
});

describe("a cuff is a long sleeve's choice", () => {
  const thobe = garmentById("male-thobe")!;
  const worn = () => cutFrom(thobe, "fb-apricot-linen");
  const long: SleeveChoice = { type: "set-in", length: "long" };

  it("arrives in a plain cuff, and can be taken off", () => {
    expect(sleeveOf(worn())).toEqual({ ...long, cuff: "plain" });
    const bare = setSleeve([worn()], thobe.id, { ...long, cuff: "none" })[0];
    expect(sleeveOf(bare)).toEqual({ ...long, cuff: "none" });
  });

  it("offers no cuff on a shorter sleeve", () => {
    for (const length of ["short", "elbow", "three-quarter"] as const) {
      const w = setSleeve([worn()], thobe.id, { type: "set-in", length, cuff: "plain" })[0];
      expect(sleeveOf(w)).toEqual({ type: "set-in", length });
    }
  });

  it("offers it on every long sewn sleeve and the dolman, and never on a loose one", () => {
    for (const type of ["set-in", "drop", "raglan"] as const) {
      const w = setSleeve([worn()], thobe.id, { type, length: "long", cuff: "none" })[0];
      expect(sleeveOf(w)).toEqual({ type, length: "long", cuff: "none" });
      const fresh = setSleeve([worn()], thobe.id, { type, length: "long" })[0];
      expect(sleeveOf(fresh)!.cuff).toBe("plain");
    }
    for (const type of ["puff", "bishop", "bell", "flutter", "kimono", "cap"] as const) {
      expect(cuffsOffered(["none", "plain"], { type, length: "long" })).toEqual([]);
    }
    /* her dolman narrows to the wrist, so it takes a cuff */
    expect(cuffsOffered(["none", "plain"], { type: "dolman", length: "long" })).toEqual(["none", "plain"]);
  });

  it("offers a knit only its rib: never a shirt's cuff", () => {
    const tee = garmentById("male-t-shirt")!;
    const w = setSleeve([cutFrom(tee, "fb-apricot-linen")], tee.id, { ...long, cuff: "formal" })[0];
    expect(sleeveOf(w)).toEqual({ ...long, cuff: "none" });
    const polo = garmentById("male-polo")!;
    const p = setSleeve([cutFrom(polo, "fb-apricot-linen")], polo.id, long)[0];
    expect(sleeveOf(p)).toEqual({ ...long, cuff: "rib" });
  });

  it("arrives in each garment's own cuff", () => {
    const own = (id: string) => sleeveOf(cutFrom(garmentById(id)!, "fb-apricot-linen"));
    expect(own("male-shirt")).toEqual({ ...long, cuff: "formal" });
    expect(own("female-blouse")).toEqual({ ...long, cuff: "formal" });
    expect(own("male-thobe")).toEqual({ ...long, cuff: "plain" });
  });

  it("draws the cuff as a band of its own, and no band without one", async () => {
    const { CLOTH } = await import("./art/male/thobe");
    // body, two sleeves, and two cuffs — or no cuffs
    expect(CLOTH({ ...long, cuff: "plain" }, false)).toHaveLength(5);
    expect(CLOTH({ ...long, cuff: "none" }, false)).toHaveLength(3);
    // without one the sleeve runs on to the hem row, and ends there
    const hem = hemRow("male", long)!;
    const [, bare] = CLOTH({ ...long, cuff: "none" }, false);
    expect(extent(bare).maxY).toBeCloseTo(hem, 0);
  });
});

describe("a jacket's sleeve buttons", () => {
  /** The buttons at the sleeves' ends, read off the jacket's hardware as drawn: centre and radius. */
  const buttonsOf = async (art: GarmentArt) => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const markup = renderToStaticMarkup(art.trim as ReactElement);
    return [...markup.matchAll(/<circle cx="([-\d.]+)" cy="([-\d.]+)" r="([\d.]+)" fill="#2b211b"/g)].map(
      ([, x, y, r]) => ({ x: Number(x), y: Number(y), r: Number(r) })
    );
  };
  const cm = (u: number) => u * BODY_CANVAS.cmPerUnit;

  it.each([
    ["male", 4, 1.5],
    ["female", 3, 1.4],
  ] as const)("sews %s's in a touching row just above each sleeve's end", async (body, count, wide) => {
    const art = body === "male" ? (await import("./art/male/jacket")).maleJacketFront : (await import("./art/female/jacket")).jacketFront;
    const all = await buttonsOf(art);
    for (const side of [all.filter((b) => b.x < 300), all.filter((b) => b.x > 300)]) {
      expect(side).toHaveLength(count);
      const row = [...side].sort((a, b) => b.y - a.y);
      for (const b of row) expect(cm(2 * b.r)).toBeCloseTo(wide, 2);
      // each touches the one below: centres a button's width apart
      for (let i = 1; i < row.length; i++) {
        expect(Math.hypot(row[i].x - row[i - 1].x, row[i].y - row[i - 1].y)).toBeCloseTo(2 * row[i].r, 1);
      }
      // the lowest a little above the end of the sleeve, which the cuff under it shows below
      const gap = cm(art.encloses!.cuff - (row[0].y + row[0].r));
      expect(gap).toBeGreaterThan(1.5);
      expect(gap).toBeLessThan(2.5);
    }
    // the two rows one mirrored
    const left = all.filter((b) => b.x < 300).map((b) => [b.x, b.y]).sort((a, b) => a[1] - b[1]);
    const right = all.filter((b) => b.x > 300).map((b) => [600 - b.x, b.y]).sort((a, b) => a[1] - b[1]);
    left.forEach(([x, y], i) => {
      expect(right[i][0]).toBeCloseTo(x, 1);
      expect(right[i][1]).toBeCloseTo(y, 1);
    });
  });
});
