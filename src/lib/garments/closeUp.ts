import type { FabricRegionId, Garment, WornGarment } from "@/types";
import { collarArt, garmentArt } from "./art";
import { collarOf } from "./outfit";

/**
 * Where a close-up should point when a given region is being edited.
 *
 * Each region's drawing carries its own `focus` — the point the camera should
 * sit on when that region is what you are working on. A collar's is up at the
 * throat, a trouser leg's is down at the knee.
 *
 * The catch, and the bug this exists to fix: **a collar is not a region of a
 * garment's art.** It is a separate, swappable asset with art of its own, which
 * is the whole reason nine collars can be sewn to one blouse. Asking a
 * garment's art for a `"collar"` region returns `undefined` on every garment in
 * the wardrobe — and `undefined` fell through to "the centre of the canvas", so
 * choosing a collar and zooming in framed the hips. There was no way to look at
 * a collar at all, which is exactly what it looked like.
 *
 * Lives here rather than inside the component so it can be tested, which is the
 * other half of why it went unnoticed: a viewBox computed in a render and
 * thrown at an attribute has nothing to assert against.
 */
export function focusOf(
  garment: Garment,
  worn: WornGarment | undefined,
  region: FabricRegionId
): readonly [number, number] | undefined {
  if (region === "collar" && worn) {
    const collar = collarOf(worn);
    const focus = collar
      ? collarArt(collar.asset.front)?.regions.collar?.focus
      : undefined;
    if (focus) return focus;
  }
  return garmentArt(garment.asset.front)?.regions[region]?.focus;
}
