import { afterEach, describe, expect, it, vi } from "vitest";
import { filterReach, limitedCount, limitedRegion, limitToView, type Box } from "./viewRegions";

/** Just enough of an SVG element for `limitToView`, counting every attribute written. */
class Node {
  attrs = new Map<string, string>();
  children: Node[] = [];
  parentElement: Node | null = null;
  box = { x: 0, y: 0, width: 0, height: 0 };
  static writes = 0;
  constructor(
    public tagName: string,
    attrs: Record<string, string> = {}
  ) {
    for (const [k, v] of Object.entries(attrs)) this.attrs.set(k, v);
  }
  get id() {
    return this.attrs.get("id") ?? "";
  }
  getAttribute(n: string) {
    return this.attrs.get(n) ?? null;
  }
  hasAttribute(n: string) {
    return this.attrs.has(n);
  }
  setAttribute(n: string, v: string) {
    Node.writes++;
    this.attrs.set(n, v);
  }
  removeAttribute(n: string) {
    Node.writes++;
    this.attrs.delete(n);
  }
  add(...nodes: Node[]) {
    for (const c of nodes) {
      c.parentElement = this;
      this.children.push(c);
    }
    return this;
  }
  all(): Node[] {
    return this.children.flatMap((c) => [c, ...c.all()]);
  }
  querySelectorAll(sel: string) {
    if (sel === "filter, mask") return this.all().filter((e) => e.tagName === "filter" || e.tagName === "mask");
    if (sel === "[filter], [mask]") return this.all().filter((e) => e.hasAttribute("filter") || e.hasAttribute("mask"));
    throw new Error(sel);
  }
  querySelector(sel: string) {
    if (sel === "use") return this.all().find((e) => e.tagName === "use") ?? null;
    throw new Error(sel);
  }
  getBBox() {
    return this.box;
  }
  region() {
    return Object.fromEntries([...this.attrs].filter(([k]) => /^(filterUnits|maskUnits|x|y|width|height)$/.test(k)));
  }
}

describe("the stage's filters and masks limited to what is on screen", () => {
  it("measures how far a filter reaches: blurs, erosion, offsets, displacement, lighting — added up", () => {
    expect(filterReach([])).toBe(1);
    // a blur reaches 3.5 sigma; of two, the larger
    expect(filterReach([{ tag: "feGaussianBlur", stdDeviation: "4" }])).toBe(1 + 14);
    expect(filterReach([{ tag: "feGaussianBlur", stdDeviation: "2.5 5.5" }])).toBe(1 + 3.5 * 5.5);
    // the warp's chain: blur, two offsets, displacement — every step's reach added
    expect(
      filterReach([
        { tag: "feGaussianBlur", stdDeviation: "10" },
        { tag: "feColorMatrix" },
        { tag: "feOffset", dx: "-6", dy: "0" },
        { tag: "feOffset", dx: "0", dy: "-6" },
        { tag: "feComposite" },
        { tag: "feDisplacementMap", scale: "5" },
      ])
    ).toBe(1 + 35 + 6 + 6 + 2.5);
    expect(filterReach([{ tag: "feMorphology", radius: "3" }])).toBe(4);
    expect(filterReach([{ tag: "feDiffuseLighting" }])).toBe(2);
    // pointwise primitives reach nothing
    expect(filterReach([{ tag: "feColorMatrix" }, { tag: "feComponentTransfer" }, { tag: "feFlood" }, { tag: "feMerge" }])).toBe(1);
    // a tile depends on the region itself: never limited
    expect(filterReach([{ tag: "feTile" }])).toBe(Infinity);
  });

  it("cuts a region to the view and its margin, the cut edges whole device pixels from the region's own corner", () => {
    const s = 3.37; // device px per unit: the neckline's 3× on an iPhone
    const view: Box = [126, 82, 474, 411];
    // the whole canvas: cut on every side
    const cut = limitedRegion([0, 0, 600, 1000], view, 70, s)!;
    expect(cut[0]).toBeLessThanOrEqual(126 - 70);
    expect(cut[1]).toBeLessThanOrEqual(82 - 70);
    expect(cut[2]).toBeGreaterThanOrEqual(474 + 70);
    expect(cut[3]).toBeGreaterThanOrEqual(411 + 70);
    // never more than a device pixel past the margin, and on the region's own pixel grid
    expect(126 - 70 - cut[0]).toBeLessThan(1 / s + 1e-9);
    for (const [edge, origin] of [[cut[0], 0], [cut[1], 0], [cut[2], 0], [cut[3], 0]]) {
      const px = (edge - origin) * s;
      expect(Math.abs(px - Math.round(px))).toBeLessThan(1e-6);
    }
    // a piece inside the view keeps its own region exactly
    expect(limitedRegion([200, 150, 380, 300], view, 70, s)).toEqual([200, 150, 380, 300]);
    // cut on one side only: the other three stay as they were, and nothing grows past the original
    const one = limitedRegion([240.4, 150.7, 380.2, 900.9], view, 70, s)!;
    expect([one[0], one[1], one[2]]).toEqual([240.4, 150.7, 380.2]);
    expect(one[3]).toBeLessThan(900.9);
    expect(one[3]).toBeGreaterThanOrEqual(411 + 70);
    const px = (one[3] - 150.7) * s;
    expect(Math.abs(px - Math.round(px))).toBeLessThan(1e-6);
    // wholly off screen: nothing to draw
    expect(limitedRegion([0, 700, 600, 1000], view, 70, s)).toBeNull();
  });

  describe("on a stage", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("writes only what changes, keeps React's own later changes, and puts back exactly what is no longer cut", () => {
      vi.stubGlobal("window", { devicePixelRatio: 3 });
      const canvas = { filterUnits: "userSpaceOnUse", x: "0", y: "0", width: "600", height: "1000" };
      const wide = new Node("filter", { id: "wide", ...canvas }).add(new Node("feGaussianBlur", { stdDeviation: "2" }));
      const piece = new Node("filter", { id: "piece" }).add(new Node("feColorMatrix"));
      const shared = new Node("filter", { id: "shared" }).add(new Node("feOffset", { dx: "3", dy: "4" }));
      const hem = new Node("filter", { id: "hem", filterUnits: "userSpaceOnUse", x: "0", y: "800", width: "600", height: "200" });
      const mask = new Node("mask", { id: "under", maskUnits: "userSpaceOnUse", x: "0", y: "0", width: "600", height: "1000" });
      const bodice = new Node("path", { filter: "url(#piece)" });
      bodice.box = { x: 150, y: 250, width: 300, height: 400 };
      const svg = new Node("svg").add(
        new Node("defs").add(wide, piece, shared, hem, mask),
        new Node("g", { filter: "url(#wide)", mask: "url(#under)" }),
        bodice,
        new Node("path", { filter: "url(#shared)" }),
        new Node("path", { filter: "url(#shared)" }),
        new Node("path", { filter: "url(#hem)" })
      );
      const at = (x: number, y: number, w: number, h: number) => {
        Object.assign(svg, { viewBox: { baseVal: { x, y, width: w, height: h } }, clientWidth: 390 });
        limitToView(svg as unknown as SVGSVGElement, new Set());
      };

      /* a close-up at 4×: the canvas-wide filter and mask, and the one piece's own, cut to the view and its margin */
      at(200, 300, 150, 150);
      for (const def of [wide, mask, piece]) {
        const [x, y, w, h] = ["x", "y", "width", "height"].map((a) => Number(def.getAttribute(a)));
        expect(def.getAttribute(def === mask ? "maskUnits" : "filterUnits")).toBe("userSpaceOnUse");
        // the margin: twice the furthest reach, a blur of 2 — 1 + 7 units
        expect(x).toBeLessThanOrEqual(200 - 16);
        expect(x).toBeGreaterThan(200 - 16 - 1 / 7.8);
        expect(x + w).toBeGreaterThanOrEqual(350 + 16);
        expect(y + h).toBeLessThan(450 + 16 + 1 / 7.8);
      }
      // a filter two elements share is left alone; one wholly off screen draws nothing
      expect(shared.region()).toEqual({});
      expect(hem.region()).toEqual({ filterUnits: "userSpaceOnUse", x: "200", y: "300", width: "0", height: "0" });
      expect(limitedCount(svg as unknown as SVGSVGElement)).toBe(4);

      // the same view again: nothing written
      Node.writes = 0;
      at(200, 300, 150, 150);
      expect(Node.writes).toBe(0);

      /* React draws again: the canvas-wide filter a new height, and the piece's filter gains a second user */
      wide.attrs.set("height", "900");
      svg.add(new Node("path", { filter: "url(#piece)" }));
      at(200, 300, 150, 150);
      expect(piece.region()).toEqual({});
      expect(Number(wide.getAttribute("height"))).toBeLessThan(200);

      /* the whole figure again: everything exactly as React drew it, with React's new height */
      at(0, 0, 600, 1000);
      expect(wide.region()).toEqual({ ...canvas, height: "900" });
      expect(mask.region()).toEqual({ maskUnits: "userSpaceOnUse", x: "0", y: "0", width: "600", height: "1000" });
      expect(hem.region()).toEqual({ filterUnits: "userSpaceOnUse", x: "0", y: "800", width: "600", height: "200" });
      expect(piece.region()).toEqual({});
      expect(limitedCount(svg as unknown as SVGSVGElement)).toBe(0);
    });
  });
});
