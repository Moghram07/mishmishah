import { describe, expect, it } from "vitest";
import { BODY_CANVAS } from "@/lib/mannequin/bodies";
import { frameFor } from "@/lib/mannequin/frame";
import { collars, collarsForGarment } from "@/lib/data/collars";
import { garments, garmentById } from "@/lib/data/garments";
import { fabrics } from "@/lib/data/fabrics";
import { cutFrom, setCollar, setNeckline } from "./outfit";
import { necklinesForGarment } from "@/lib/data/necklines";
import { focusOf } from "./closeUp";
import { renderToStaticMarkup } from "react-dom/server";
import { MannequinStage } from "@/components/visualizer/MannequinStage";
import type { Fabric, FabricRegionId } from "@/types";
import { DEFAULT_SKIN_TONE } from "@/lib/data/skinTones";

/**
 * Pointing the close-up at the thing being edited.
 *
 * The bug, in one sentence: a collar's `focus` was read off the garment's art,
 * a collar is not a region of a garment's art, so every collar resolved to
 * `undefined` and `undefined` meant "the centre of the canvas" — the hips. You
 * could pick a collar, zoom to 8×, and still be looking at a waistband.
 */

const cloth = fabrics[0].id;
/**
 * A garment wearing a collar, cut — where it takes a neckline — to one that can
 * carry it, which is the only way the picker ever offers a collar.
 */
const wornWith = (garmentId: string, collarId?: string) => {
  const garment = garmentById(garmentId)!;
  let worn = [cutFrom(garment, cloth)];
  const collar = collars.find((c) => c.id === collarId);
  /* the openings it is sewn into on a garment with a choice of cut — see `Collar.cuts` */
  const openings = collar ? (collar.cuts ?? [collar.opening]) : [];
  const cut = necklinesForGarment(garment).find((n) => n.opening !== null && openings.includes(n.opening) && !n.wants);
  if (cut) worn = setNeckline(worn, garment.id, cut.id);
  if (collarId) worn = setCollar(worn, garment.id, collarId);
  return { garment, worn: worn[0] };
};

describe("a close-up points at the region being edited", () => {
  it("finds a collar's focus, on every collar it can be sewn", () => {
    for (const collar of collars) {
      for (const garment of garments.filter((g) =>
        collarsForGarment(g).includes(collar)
      )) {
        const { worn } = wornWith(garment.id, collar.id);
        const focus = focusOf(garment, worn, "collar");
        expect(focus, `${garment.id} + ${collar.id}`).toBeDefined();
        // At the throat, not at the waist.
        expect(focus![1], `${garment.id} + ${collar.id}`).toBeLessThan(260);
      }
    }
  });

  it("frames the collar rather than the hips once zoomed", () => {
    const { garment, worn } = wornWith("female-blouse", "female-shirt-collar");
    const focus = focusOf(garment, worn, "collar");
    const frame = frameFor(4, focus);
    // The whole frame sits above the middle of the figure.
    expect(frame.y + frame.h).toBeLessThan(BODY_CANVAS.height / 2);
  });

  it("still points at a garment's own regions", () => {
    for (const garment of garments) {
      const { worn } = wornWith(garment.id);
      for (const region of garment.fabricRegions) {
        expect(
          focusOf(garment, worn, region),
          `${garment.id}/${region}`
        ).toBeDefined();
      }
    }
  });

  it("gives back nothing for a collar region with no collar on", () => {
    // Which is right: there is no collar to look at, so the stage frames the
    // whole figure rather than guessing. Taken off explicitly — `cutFrom`
    // sews on a default collar, so a freshly cut garment always has one.
    const garment = garmentById("female-blouse")!;
    const bare = setCollar([cutFrom(garment, cloth)], garment.id, undefined)[0];
    expect(focusOf(garment, bare, "collar")).toBeUndefined();
  });

  it("points somewhere different for a collar than for the body", () => {
    // The regression, stated directly: these two used to be the same point,
    // because both fell through to the centre of the canvas.
    const { garment, worn } = wornWith("male-shirt", "male-shirt-collar");
    const body = focusOf(garment, worn, garment.fabricRegions[0]);
    const collar = focusOf(garment, worn, "collar");
    expect(collar).toBeDefined();
    expect(body).toBeDefined();
    expect(collar![1]).toBeLessThan(body![1]);
  });
});

/**
 * The same thing again, through the real component.
 *
 * `focusOf` and `frameFor` can both be right while nothing connects them —
 * which is exactly the state this was in, since the viewBox was computed inline
 * from a lookup that always failed. So this renders the actual stage and reads
 * the actual attribute.
 */
describe("the stage frames what it is handed", () => {
  const dress = (collarId?: string) => {
    const garment = garmentById("female-blouse")!;
    const worn = collarId
      ? setCollar([cutFrom(garment, cloth)], garment.id, collarId)
      : setCollar([cutFrom(garment, cloth)], garment.id, undefined);
    const regions: Partial<Record<FabricRegionId, Fabric>> = {};
    for (const r of [...garment.fabricRegions, "collar" as const]) {
      regions[r] = fabrics[0];
    }
    return {
      garment,
      worn,
      outfit: {
        bodyType: "female" as const,
        skinTone: DEFAULT_SKIN_TONE,
        direction: 0,
        worn,
      },
      fabrics: { [garment.id]: regions },
    };
  };

  const viewBoxOf = (markup: string) =>
    (markup.match(/viewBox="([^"]+)"/)?.[1] ?? "")
      .split(" ")
      .map(Number);

  it("puts the collar in shot when zoomed on a collar", () => {
    const d = dress("female-shirt-collar");
    const focus = focusOf(d.garment, d.worn[0], "collar");
    const markup = renderToStaticMarkup(
      <MannequinStage outfit={d.outfit} fabrics={d.fabrics} zoom={4} focus={focus} />
    );
    const [, y, , h] = viewBoxOf(markup);
    expect(y + h).toBeLessThan(BODY_CANVAS.height / 2);
  });

  it("shows the whole figure at 1×", () => {
    const d = dress("female-shirt-collar");
    const markup = renderToStaticMarkup(
      <MannequinStage outfit={d.outfit} fabrics={d.fabrics} zoom={1} />
    );
    expect(viewBoxOf(markup).join(" ")).toBe(BODY_CANVAS.viewBox);
  });

  it("moves when it is panned, and stays on the canvas", () => {
    const d = dress("female-shirt-collar");
    const at = (pan: [number, number]) =>
      viewBoxOf(
        renderToStaticMarkup(
          <MannequinStage
            outfit={d.outfit}
            fabrics={d.fabrics}
            zoom={4}
            focus={[300, 500]}
            pan={pan}
          />
        )
      );
    const still = at([0, 0]);
    const up = at([0, -300]);
    expect(up[1]).toBeLessThan(still[1]);
    // dragged far past the top, the frame stops at the canvas edge
    const way = at([0, -5000]);
    expect(way[1]).toBeGreaterThanOrEqual(6);
  });
});
