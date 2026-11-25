import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MannequinStage } from "@/components/visualizer/MannequinStage";
import { fabrics } from "@/lib/data/fabrics";
import { garmentById } from "@/lib/data/garments";
import { DEFAULT_SKIN_TONE } from "@/lib/data/skinTones";
import { NECKLINE_IDS } from "./necklines";
import { cutFrom, setFront, setNeckline } from "./outfit";
import type { Fabric, FabricRegionId, Outfit, WornGarment } from "@/types";

/**
 * Nothing of a dress behind the neck. The round and the V drew the back of
 * their neckline there, under the photograph, and it stood above the
 * shoulder line either side of the neck, a small round lump; now the
 * shoulder line meets the neck on them as it does on the high and the boat.
 * Under the photograph the stage draws only a collar's back.
 */

const linen = fabrics.find((f) => f.id === "fb-sky-linen")!;

function stage(worn: WornGarment[]): string {
  const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
  const regions = (id: string) =>
    Object.fromEntries(garmentById(id)!.fabricRegions.map((r) => [r, linen])) as Partial<Record<FabricRegionId, Fabric>>;
  return renderToStaticMarkup(
    <MannequinStage outfit={outfit} fabrics={Object.fromEntries(worn.map((w) => [w.garmentId, regions(w.garmentId)]))} />
  );
}

/** What the stage draws under the photograph: after its definitions, before the body's own picture. */
function underBody(markup: string): string {
  const from = markup.indexOf("</defs>");
  const to = markup.indexOf('<image href="/mannequin/');
  // both found, in that order: a stage drawn some other way fails here rather than passing with nothing to look at
  expect(from, "the stage's definitions").toBeGreaterThan(0);
  expect(to, "the photograph, after them").toBeGreaterThan(from);
  return markup.slice(from, to);
}

const dress = (neck: string) => setNeckline([cutFrom(garmentById("female-dress")!, linen.id)], "female-dress", `female-${neck}-neckline`);
const abaya = (front: "open" | "closed") => setFront([cutFrom(garmentById("female-abaya")!, linen.id)], "female-abaya", front);
const jacket = () => [cutFrom(garmentById("female-jacket")!, linen.id)];

describe("behind the neck", () => {
  it("draws nothing of the dress, on any neckline: the shoulder line meets the neck", () => {
    for (const neck of NECKLINE_IDS) expect(underBody(stage(dress(neck))), neck).not.toContain("female-dress");
  });

  it("nor of a round or a V inside an abaya, open or closed, or a jacket", () => {
    for (const neck of ["round", "v"]) {
      for (const front of ["open", "closed"] as const) expect(underBody(stage([...dress(neck), ...abaya(front)])), `${neck} · ${front}`).not.toContain("female-dress");
      expect(underBody(stage([...dress(neck), ...jacket()])), `${neck} · jacket`).not.toContain("female-dress");
    }
  });
});
