import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductTemplate, productPanBy } from "@/components/visualizer/ProductTemplate";
import { fabrics } from "@/lib/data/fabrics";
import { HARDWARE, PRODUCT_CANVAS, productByKind, products } from "./registry";

const linen = fabrics.find((f) => f.id === "fb-apricot-linen")!;
const stage = (kind: Parameters<typeof productByKind>[0], props: { zoom?: number; pan?: [number, number] } = {}) =>
  renderToStaticMarkup(<ProductTemplate kind={kind} fabrics={{ main: linen }} {...props} />);

describe("the Home stage", () => {
  it("draws each product as its pieces, back to front, so a piece in front hides the outlines behind it", () => {
    /* a part that returned one group would be one piece, and every outline in it would show through */
    const pieces = (kind: Parameters<typeof productByKind>[0]) =>
      productByKind(kind).parts.flatMap((p) => {
        const node = p.shape("#fff") as { props?: { children?: unknown } };
        return [node.props?.children ?? node].flat(2);
      }).length;
    // a back, three back cushions, the base, three seat cushions, two arms
    expect(pieces("sofa")).toBe(10);
    // the back, then the seat in front of its lower corners
    expect(pieces("chair")).toBe(2);
  });

  it("draws an edge dark where it lies on the product, and keeps the page's rim only round the outside", () => {
    for (const p of products) {
      const html = stage(p.kind);
      expect(html, p.kind).toMatch(/mask="url\(#[^)]*-under-dark\)"/);
      expect(html, p.kind).toMatch(/mask="url\(#[^)]*-under-rim\)"/);
    }
  });

  it("gives its hardware an outline in the page's text colour, so it shows on a dark page", () => {
    for (const [kind, pieces] of Object.entries(HARDWARE)) {
      const html = stage(kind as Parameters<typeof productByKind>[0]);
      const outlined = html.match(/stroke="currentColor" stroke-opacity="0.35"/g) ?? [];
      expect(outlined.length, kind).toBe(pieces!.length);
    }
  });

  it("lets a close-up be dragged, and never off the canvas", () => {
    const [w] = PRODUCT_CANVAS;
    // at 2×, a 200-unit window round the sofa's focus at (200, 200), dragged 100 px left on a 400 px stage: 50 units right
    const moved = productPanBy([0, 0], -100, 0, 2, 400, "sofa");
    expect(moved).toEqual([50, 0]);
    expect(stage("sofa", { zoom: 2, pan: moved })).toContain('viewBox="150 100 200 200"');
    // dragged far past the edge, it stops where the window meets the canvas's edge
    const far = productPanBy([0, 0], -10_000, -10_000, 2, 400, "sofa");
    expect(far).toEqual([w - 100 - 200, w - 100 - 200]);
    // at 1× there is nowhere to go
    expect(productPanBy([0, 0], -100, 40, 1, 400, "sofa")).toEqual([0, 0]);
  });
});
