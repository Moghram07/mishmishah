import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MannequinStage } from "@/components/visualizer/MannequinStage";
import { fabrics } from "@/lib/data/fabrics";
import { garmentById } from "@/lib/data/garments";
import { DEFAULT_SKIN_TONE } from "@/lib/data/skinTones";
import { cutFrom, setFront, setNeckline } from "./outfit";
import type { Fabric, FabricRegionId, Outfit, WornGarment } from "@/types";

/**
 * The back of a crew or a V, drawn behind the neck — see `GarmentArt.behindBody`.
 *
 * Inside an abaya it stood above the abaya's shoulder line, a sliver of the
 * dress at each side of the neck: the abaya's own back lies over it, so it is
 * hidden there (`Encloses.hidesBackNeck`). A jacket's collar stands round the
 * neck, and it still shows inside it, as it always has.
 */

const linen = fabrics.find((f) => f.id === "fb-sky-linen")!;
const BACK = "female-dress-back-neck";

function stage(worn: WornGarment[]): string {
  const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
  const regions = (id: string) =>
    Object.fromEntries(garmentById(id)!.fabricRegions.map((r) => [r, linen])) as Partial<Record<FabricRegionId, Fabric>>;
  return renderToStaticMarkup(
    <MannequinStage outfit={outfit} fabrics={Object.fromEntries(worn.map((w) => [w.garmentId, regions(w.garmentId)]))} />
  );
}

const dress = (neck: string) => setNeckline([cutFrom(garmentById("female-dress")!, linen.id)], "female-dress", `female-${neck}-neckline`);
const abaya = (front: "open" | "closed") => setFront([cutFrom(garmentById("female-abaya")!, linen.id)], "female-abaya", front);
const jacket = () => [cutFrom(garmentById("female-jacket")!, linen.id)];

describe("the back of a crew or a V", () => {
  it("is hidden inside an abaya, open or closed", () => {
    for (const neck of ["round", "v"]) {
      for (const front of ["open", "closed"] as const) expect(stage([...dress(neck), ...abaya(front)]), `${neck} · ${front}`).not.toContain(BACK);
    }
  });

  it("shows on the dress alone and inside a jacket's collar, as before", () => {
    for (const neck of ["round", "v"]) {
      expect(stage(dress(neck)), neck).toContain(BACK);
      expect(stage([...dress(neck), ...jacket()]), `${neck} · jacket`).toContain(BACK);
    }
  });
});
