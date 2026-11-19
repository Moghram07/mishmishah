import { describe, expect, it } from "vitest";
import { bodyById } from "@/lib/mannequin/bodies";
import { profileFor } from "@/lib/mannequin/profile";
import { frameFor, type Viewport } from "@/lib/mannequin/frame";
import { centreOf, frameOf, movedView, nextZoom, partView, viewForPart, WHOLE_VIEW, MOST_ZOOM, type StageView } from "./stageView";

/** The phone stage the layout leaves on an iPhone 13 in Safari, and one held sideways. */
const PORTRAIT: Viewport = { width: 390, height: 366, inset: [10, 10, 10, 10] };
const LANDSCAPE: Viewport = { width: 380, height: 330, inset: [10, 10, 10, 10] };
const inFrame = (f: { x: number; y: number; w: number; h: number }, [x, y]: readonly [number, number]) =>
  x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h;

describe("the phone stage: zoom to the part", () => {
  it("frames each part on the body it is worn on, and the whole figure for the rest", () => {
    for (const body of ["female", "male"] as const) {
      const a = bodyById(body).anchors;
      const p = profileFor(body);
      for (const viewport of [PORTRAIT, LANDSCAPE]) {
        const shows = (part: string, points: [number, number][]) => {
          const v = partView(part, body);
          expect(v, part).not.toBeNull();
          expect(v!.zoom, part).toBeGreaterThan(1);
          expect(v!.zoom, part).toBeLessThanOrEqual(MOST_ZOOM);
          const f = frameFor(v!.zoom, v!.focus, [0, 0], viewport);
          for (const pt of points) expect(inFrame(f, pt), `${body} ${part} shows ${pt}`).toBe(true);
          return f;
        };
        // the neckline: chin to bust, shoulder to shoulder — and close: under half the figure's height
        const neck = shows("neckline", [[a.centerX, a.chinY], [a.centerX, a.bustY], [a.shoulderX.left, a.shoulderY], [a.shoulderX.right, a.shoulderY]]);
        expect(neck.h).toBeLessThan((a.floorY - a.crownY) / 2);
        // the sleeves: both shoulders down to both wrists
        shows("sleeve", [[a.shoulderX.left, a.shoulderY], [a.shoulderX.right, a.shoulderY], [a.centerX - 110, p.wristY], [a.centerX + 110, p.wristY]]);
        // the waist and the belt: the waist and the hip; the belt also a sash's tails, 36 cm under it
        shows("waist", [[a.centerX, a.waistY], [a.centerX, a.hipY]]);
        shows("belt", [[a.centerX, a.waistY], [a.centerX, a.waistY + 36 / 0.19 - 20]]);
        shows("cuff", [[a.centerX - 110, p.wristY], [a.centerX + 110, p.wristY]]);
        shows("collar", [[a.centerX, a.shoulderY - 30], [a.centerX, a.shoulderY + 40]]);
        // what reads only as a whole stays whole
        for (const part of ["pieces", "skirt", "front", "leg", "stripes", "fabrics"]) expect(partView(part, body), part).toBeNull();
      }
    }
    // a part's own focus, a collar's or a tie's, wins
    expect(partView("collar", "female", [300, 190])!.focus).toEqual([300, 190]);
  });

  it("never moves a view the viewer set; there is always a way back to the whole figure", () => {
    const neck = partView("neckline", "female")!;
    const belt = partView("belt", "female")!;
    // the app follows the categories
    let view = viewForPart(WHOLE_VIEW, neck);
    expect(view).toEqual({ zoom: neck.zoom, centre: neck.focus, by: "app" });
    view = viewForPart(view, belt);
    expect(view.centre).toEqual(belt.focus);
    view = viewForPart(view, null);
    expect(view).toEqual(WHOLE_VIEW);
    // the viewer zooms in themselves: the next category leaves their view where it is
    const theirs: StageView = { zoom: 2.6, centre: [250, 600], by: "viewer" };
    expect(viewForPart(theirs, neck)).toBe(theirs);
    expect(viewForPart(theirs, null)).toBe(theirs);
    // back at the whole figure — the way back — the categories frame their parts again
    expect(viewForPart(WHOLE_VIEW, neck).by).toBe("app");
    expect(frameOf(WHOLE_VIEW, PORTRAIT)).toEqual(frameFor(1, null, [0, 0], PORTRAIT));
  });

  it("the zoom button steps 2×, 4×, and back to the whole figure", () => {
    expect([1, 2, 4].map(nextZoom)).toEqual([2, 4, 1]);
    // from a pinch in between, to the next step up
    expect([1.4, 2.6, 7].map(nextZoom)).toEqual([2, 4, 1]);
  });

  it("a pinch keeps the point under the fingers under them, and stays on the figure", () => {
    const start: StageView = { zoom: 2, centre: [300, 300], by: "app" };
    const f0 = frameOf(start, PORTRAIT);
    const s0 = PORTRAIT.width / f0.w;
    const from: [number, number] = [150, 200];
    const to: [number, number] = [170, 180];
    const under = [f0.x + from[0] / s0, f0.y + from[1] / s0];
    const moved = movedView(start, PORTRAIT, from, to, 1.5);
    expect(moved.by).toBe("viewer");
    expect(moved.zoom).toBeCloseTo(3);
    const f1 = frameOf(moved, PORTRAIT);
    const s1 = PORTRAIT.width / f1.w;
    expect(f1.x + to[0] / s1).toBeCloseTo(under[0], 6);
    expect(f1.y + to[1] / s1).toBeCloseTo(under[1], 6);
    // a drag far past the edge stops at it: the stored centre is the frame's own
    const dragged = movedView(moved, PORTRAIT, [100, 100], [5000, 5000], 1);
    expect(dragged.centre).toEqual(centreOf(frameOf(dragged, PORTRAIT)));
    // pinched out past the whole figure, it is the whole figure — the app's again
    expect(movedView(start, PORTRAIT, from, to, 0.3)).toEqual(WHOLE_VIEW);
    // and never closer than the closest zoom
    expect(movedView(start, PORTRAIT, from, to, 50).zoom).toBe(MOST_ZOOM);
  });
});
