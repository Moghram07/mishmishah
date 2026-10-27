import { describe, expect, it } from "vitest";
import { BODY_CANVAS } from "./bodies";
import { WHOLE, frameFor, panBy } from "./frame";
import { collarArt, garmentArt } from "@/lib/garments/art";
import { collars } from "@/lib/data/collars";
import { garments } from "@/lib/data/garments";

/**
 * The close-up, and why it needed testing.
 *
 * Zooming had one job and could not do it: the camera always landed on the
 * middle of the canvas, so however far you zoomed in you got the hips. The
 * cause was a lookup in the wrong place — a collar's `focus` was being read off
 * the *garment's* art, and a collar is not a region of a garment's art, it is
 * an asset of its own. `garmentArt(shirt).regions.collar` is `undefined` for
 * every garment in the wardrobe, and `undefined` fell through to "centre of the
 * canvas".
 *
 * Nothing could catch that, because the viewBox was computed inside a render
 * and thrown straight at an attribute. It is a function now, and these are the
 * questions worth asking of it.
 */

const [VX, VY, VW, VH] = BODY_CANVAS.viewBox.split(" ").map(Number);

describe("the close-up frames what it is pointed at", () => {
  it("shows the whole figure at zoom 1", () => {
    const f = frameFor(1);
    expect(f.viewBox).toBe(BODY_CANVAS.viewBox);
  });

  it("cannot be moved at zoom 1, however it is aimed", () => {
    // There is nowhere to move to: the frame is already the whole canvas.
    expect(frameFor(1, [300, 172]).viewBox).toBe(BODY_CANVAS.viewBox);
    expect(frameFor(1, [300, 172], [90, -400]).viewBox).toBe(BODY_CANVAS.viewBox);
  });

  it("puts the point it is aimed at inside the frame", () => {
    const collar: [number, number] = [300, 172];
    for (const zoom of [2, 3, 4, 6, 8]) {
      const f = frameFor(zoom, collar);
      expect(collar[0], `x at ${zoom}x`).toBeGreaterThanOrEqual(f.x);
      expect(collar[0], `x at ${zoom}x`).toBeLessThanOrEqual(f.x + f.w);
      expect(collar[1], `y at ${zoom}x`).toBeGreaterThanOrEqual(f.y);
      expect(collar[1], `y at ${zoom}x`).toBeLessThanOrEqual(f.y + f.h);
    }
  });

  it("does not quietly recentre on the middle of the body", () => {
    // The bug, stated as a test: a collar close-up must not show the hips.
    const f = frameFor(4, [300, 172]);
    expect(f.y + f.h).toBeLessThan(WHOLE[1]);
  });

  it("never leaves the canvas, however far it is aimed or dragged", () => {
    for (const zoom of [1.5, 3, 8]) {
      for (const aim of [
        [0, 0],
        [600, 1000],
        [300, 6],
        [-500, 2000],
      ] as [number, number][]) {
        const f = frameFor(zoom, aim, [900, -900]);
        expect(f.x, `x ${zoom} ${aim}`).toBeGreaterThanOrEqual(VX - 0.001);
        expect(f.y, `y ${zoom} ${aim}`).toBeGreaterThanOrEqual(VY - 0.001);
        expect(f.x + f.w, `r ${zoom} ${aim}`).toBeLessThanOrEqual(VX + VW + 0.001);
        expect(f.y + f.h, `b ${zoom} ${aim}`).toBeLessThanOrEqual(VY + VH + 0.001);
      }
    }
  });

  it("moves when it is dragged", () => {
    const still = frameFor(4, [300, 500]);
    const dragged = frameFor(4, [300, 500], [0, -120]);
    expect(dragged.y).toBeLessThan(still.y);
    // ...and can be dragged all the way up to the collar
    const up = frameFor(4, [300, 500], [0, -400]);
    expect(up.y).toBeLessThan(200);
  });
});

/**
 * The stage, not the figure's box.
 *
 * Zoomed in, the close-up used to be cut square on four sides in the middle of
 * an empty stage, because it was drawn into a box the figure's shape. It is
 * drawn into the whole stage now, with room kept under the figure for the
 * mannequin controls.
 */
describe("drawn into the whole stage", () => {
  const stage = { width: 760, height: 780, inset: [28, 24, 150, 24] as const };
  const [top, right, bottom, left] = stage.inset;

  it("shows the whole figure at zoom 1, clear of the controls under it", () => {
    const f = frameFor(1, [300, 172], [90, -400], stage);
    const px = stage.width / f.w;
    expect((VX - f.x) * px).toBeGreaterThanOrEqual(left - 0.01);
    expect((VX + VW - f.x) * px).toBeLessThanOrEqual(stage.width - right + 0.01);
    expect((VY - f.y) * px).toBeGreaterThanOrEqual(top - 0.01);
    expect((VY + VH - f.y) * px).toBeLessThanOrEqual(stage.height - bottom + 0.01);
  });

  it("is the stage's shape at every zoom, so a close-up fills it edge to edge", () => {
    for (const zoom of [1, 1.5, 2, 4, 8]) {
      const f = frameFor(zoom, [300, 172], [0, 0], stage);
      expect(f.w / f.h, `${zoom}x`).toBeCloseTo(stage.width / stage.height, 6);
    }
  });

  it("puts the point it is aimed at inside the frame", () => {
    const collar: [number, number] = [300, 172];
    for (const zoom of [2, 4, 8]) {
      const f = frameFor(zoom, collar, [0, 0], stage);
      expect(collar[0]).toBeGreaterThanOrEqual(f.x);
      expect(collar[0]).toBeLessThanOrEqual(f.x + f.w);
      expect(collar[1]).toBeGreaterThanOrEqual(f.y);
      expect(collar[1]).toBeLessThanOrEqual(f.y + f.h);
    }
  });

  it("never shows more than zoom 1 does, however far it is dragged", () => {
    const home = frameFor(1, null, [0, 0], stage);
    for (const zoom of [1.5, 3, 8]) {
      for (const pan of [
        [900, -900],
        [-900, 900],
      ] as [number, number][]) {
        const f = frameFor(zoom, [300, 172], pan, stage);
        expect(f.x).toBeGreaterThanOrEqual(home.x - 0.001);
        expect(f.y).toBeGreaterThanOrEqual(home.y - 0.001);
        expect(f.x + f.w).toBeLessThanOrEqual(home.x + home.w + 0.001);
        expect(f.y + f.h).toBeLessThanOrEqual(home.y + home.h + 0.001);
      }
    }
  });

  it("drags at the stage's own scale, so the picture stays under the pointer", () => {
    const zoom = 4;
    const f = frameFor(zoom, [300, 500], [0, 0], stage);
    const [, dy] = panBy([0, 0], 0, 100, zoom, stage.width, stage);
    expect((-dy * stage.width) / f.w).toBeCloseTo(100, 6);
  });

  it("is the figure's own frame until the stage has been measured", () => {
    expect(frameFor(3, [300, 172], [0, 0], undefined).viewBox).toBe(
      frameFor(3, [300, 172]).viewBox
    );
    expect(frameFor(1, null, [0, 0], { width: 0, height: 0 }).viewBox).toBe(
      BODY_CANVAS.viewBox
    );
  });
});

describe("dragging maps screen pixels onto the canvas", () => {
  it("follows the pointer — drag down and the view goes up", () => {
    const [, y] = panBy([0, 0], 0, 60, 4, 480);
    expect(y).toBeLessThan(0);
  });

  it("moves less canvas per pixel the further in you are", () => {
    const near = Math.abs(panBy([0, 0], 0, 60, 2, 480)[1]);
    const far = Math.abs(panBy([0, 0], 0, 60, 8, 480)[1]);
    expect(far).toBeLessThan(near);
  });

  it("does nothing before the element has been measured", () => {
    expect(panBy([7, 9], 50, 50, 4, 0)).toEqual([7, 9]);
  });
});

/**
 * Where a region's close-up point actually lives.
 *
 * This is the test that would have caught it. A collar's `focus` is on the
 * collar's own art; asking a garment's art for a "collar" region gets nothing,
 * on every garment in the wardrobe.
 */
describe("every region a fabric can be cut for knows where to look", () => {
  it("does not find a collar on a garment's own art", () => {
    // Not a defect — a collar is a separate, swappable asset. It is only a
    // defect to *look* for it here, which is what the visualizer was doing.
    for (const g of garments) {
      expect(garmentArt(g.asset.front)?.regions.collar, g.id).toBeUndefined();
    }
  });

  it("finds it on the collar's own art, up at the throat", () => {
    for (const c of collars) {
      const focus = collarArt(c.asset.front)?.regions.collar?.focus;
      expect(focus, c.id).toBeDefined();
      // Well above the waist, or the close-up is pointed at the wrong thing.
      expect(focus![1], c.id).toBeLessThan(BODY_CANVAS.height / 3);
    }
  });

  it("gives every garment region a focus of its own", () => {
    for (const g of garments) {
      const art = garmentArt(g.asset.front);
      for (const region of g.fabricRegions) {
        expect(art?.regions[region]?.focus, `${g.id}/${region}`).toBeDefined();
      }
    }
  });
});
