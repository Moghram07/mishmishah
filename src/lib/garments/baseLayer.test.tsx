import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MannequinStage } from "@/components/visualizer/MannequinStage";
import { fabrics } from "@/lib/data/fabrics";
import { garmentById } from "@/lib/data/garments";
import { DEFAULT_SKIN_TONE } from "@/lib/data/skinTones";
import { BASE_GREY, BASE_PIECES, baseLayer } from "./baseLayer";
import { cutFrom } from "./outfit";
import type { BodyType, Fabric, FabricRegionId, Outfit } from "@/types";

/**
 * The base layer as the stage draws it — see `baseLayer.ts`.
 *
 * What shows of it, and what it leaves bare, is measured against every outfit
 * the picker allows by `check:garments`, which draws no React. This pins the
 * wiring that check cannot see: the stage draws exactly the pieces the rule
 * gives, and draws them inside a jacket.
 */

const linen = fabrics.find((f) => f.id === "fb-apricot-linen")!;

function stage(body: BodyType, ids: string[]): string {
  const worn = ids.map((id) => cutFrom(garmentById(id)!, linen.id));
  const outfit: Outfit = { bodyType: body, skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
  const regions = (id: string) =>
    Object.fromEntries(garmentById(id)!.fabricRegions.map((r) => [r, linen])) as Partial<Record<FabricRegionId, Fabric>>;
  return renderToStaticMarkup(
    <MannequinStage outfit={outfit} fabrics={Object.fromEntries(ids.map((id) => [id, regions(id)]))} />
  );
}

/** How many of the base layer's shapes a markup fills: the tank is one, the shorts two. */
const shapes = (markup: string) => markup.split(`fill="${BASE_GREY}"`).length - 1;
const TANK = BASE_PIECES.female.tank!.shapes.length;
const SHORTS = BASE_PIECES.female.shorts.shapes.length;

describe("the base layer on the stage", () => {
  it("is a tank and shorts on her and shorts on him, and only what the outfit leaves showing", () => {
    const cases: [BodyType, string[], number][] = [
      ["female", [], TANK + SHORTS],
      ["female", ["female-t-shirt"], SHORTS],
      ["female", ["female-blouse"], SHORTS],
      ["female", ["female-trousers"], TANK],
      ["female", ["female-skirt"], TANK],
      ["female", ["female-t-shirt", "female-skirt"], 0],
      ["female", ["female-dress"], 0],
      ["female", ["female-dress", "female-jacket"], 0],
      ["female", ["female-jacket"], TANK + SHORTS],
      ["female", ["female-jacket", "female-trousers"], TANK],
      ["male", [], BASE_PIECES.male.shorts.shapes.length],
      ["male", ["male-polo"], BASE_PIECES.male.shorts.shapes.length],
      ["male", ["male-trousers"], 0],
      ["male", ["male-thobe"], 0],
      ["male", ["male-jacket"], BASE_PIECES.male.shorts.shapes.length],
    ];
    for (const [body, ids, count] of cases) {
      const drawn = baseLayer(body, ids.map((id) => garmentById(id)!.category));
      expect(drawn.flatMap((p) => p.shapes).length, `${body} in ${ids.join(" + ") || "nothing"}`).toBe(count);
      expect(shapes(stage(body, ids)), `${body} in ${ids.join(" + ") || "nothing"}`).toBe(count);
    }
  });

  it("is drawn inside a jacket, so with no top under it the tank shows only in its opening", () => {
    // the jacket over nothing else: the base layer is the one thing inside it
    const insideJacket = (markup: string) => (markup.match(/mask="url\(#[^"]*inside-female-jacket\)"/g) ?? []).length;
    expect(insideJacket(stage("female", ["female-jacket"]))).toBe(1);
    // and a jacket over a dress holds the dress — the base layer is not drawn at all
    expect(shapes(stage("female", ["female-dress", "female-jacket"]))).toBe(0);
  });
});
