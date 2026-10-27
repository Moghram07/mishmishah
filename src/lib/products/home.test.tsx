import { describe, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductTemplate } from "@/components/visualizer/ProductTemplate";
import { MannequinStage } from "@/components/visualizer/MannequinStage";
import { BODY_CANVAS } from "@/lib/mannequin/bodies";
import { fabrics } from "@/lib/data/fabrics";
import { garmentById } from "@/lib/data/garments";
import { DEFAULT_SKIN_TONE } from "@/lib/data/skinTones";
import { fabricRepeatCm } from "@/lib/fabrics/patterns";
import { products } from "@/lib/products/registry";
import { cutFrom } from "@/lib/garments/outfit";
import type { Fabric, FabricRegionId, Outfit, ProductKind } from "@/types";

/**
 * Preview sheets for the Home products, and for small prints at true size —
 * written for `npm run shoot`, like the wardrobe's in `garments/look.test.tsx`.
 *
 * Every stage is drawn at the 440 px the code assumes before it can measure,
 * so what a sheet shows is what the app draws at that width: the print's size
 * on screen, and whether a repeat of a few pixels reads as cloth or as moiré.
 */

const f = (id: string) => fabrics.find((x) => x.id === id)!;
const PX = 440;
const THEMES = {
  light: { page: "#efeae4", stage: "#ffffff", text: "#1f1915", caption: "#555" },
  dark: { page: "#1a1714", stage: "#141110", text: "#f5f1ea", caption: "#b9b2a8" },
} as const;
type Theme = keyof typeof THEMES;

/** How many screen pixels one repeat of a fabric takes on a stage this wide. */
const repeatPx = (fabric: Fabric, cmPerUnit: number, unitsAcross: number) =>
  (fabricRepeatCm(fabric) / cmPerUnit) * (PX / unitsAcross);

function productTile(kind: ProductKind, fabricId: string, zoom: number, t: (typeof THEMES)[Theme]) {
  const p = products.find((x) => x.kind === kind)!;
  const fabric = f(fabricId);
  const px = repeatPx(fabric, p.cmPerUnit, 400 / zoom);
  return (
    <figure key={`${kind}-${fabricId}-${zoom}`} style={{ background: t.stage }}>
      <ProductTemplate kind={kind} fabrics={{ main: fabric }} zoom={zoom} />
      <figcaption style={{ color: t.caption }}>
        {`${kind} · ${fabric.name.en} · ${zoom}× · a ${fabricRepeatCm(fabric)} cm repeat is ${px.toFixed(1)} px`}
      </figcaption>
    </figure>
  );
}

function dressTile(fabricId: string, zoom: number, at: [number, number], t: (typeof THEMES)[Theme]) {
  const fabric = f(fabricId);
  const dress = garmentById("female-dress")!;
  const regions = Object.fromEntries(dress.fabricRegions.map((r) => [r, fabric])) as Partial<Record<FabricRegionId, Fabric>>;
  const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn: [cutFrom(dress, fabric.id)] };
  const px = repeatPx(fabric, BODY_CANVAS.cmPerUnit, 488 / zoom);
  return (
    <figure key={`dress-${fabricId}-${zoom}`} style={{ background: t.stage }}>
      <MannequinStage outfit={outfit} fabrics={{ [dress.id]: regions }} zoom={zoom} focus={at} />
      <figcaption style={{ color: t.caption }}>
        {`dress · ${fabric.name.en} · ${zoom}× · a ${fabricRepeatCm(fabric)} cm repeat is ${px.toFixed(1)} px`}
      </figcaption>
    </figure>
  );
}

/** One sheet: rows of tiles, `width`×`height` each, in a theme. */
function sheet(rows: ReactNode[][], theme: Theme, height = PX) {
  const t = THEMES[theme];
  const head = '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">';
  const css =
    `<style>body{margin:0;padding:14px;background:${t.page};font:12px system-ui}` +
    `.row{display:flex;flex-wrap:nowrap;width:max-content;gap:12px;margin-bottom:12px}` +
    `figure{margin:0;width:${PX}px;border-radius:10px;overflow:hidden}` +
    `svg{width:${PX}px;height:${height}px;display:block;color:${t.text};filter:drop-shadow(0 24px 48px rgba(27,23,20,0.22))}` +
    `figcaption{padding:4px 8px 6px;max-width:${PX - 16}px}</style>`;
  const body = renderToStaticMarkup(
    <>
      {rows.map((r, i) => (
        <div className="row" key={i}>
          {r}
        </div>
      ))}
    </>
  );
  return head + css + body;
}

const KINDS: ProductKind[] = ["sofa", "chair", "pillow", "curtain"];
const THEME_NAMES: Theme[] = ["light", "dark"];

describe("home products, light and dark", () => {
  mkdirSync(".preview/home", { recursive: true });
  it.each(KINDS.flatMap((k) => THEME_NAMES.map((theme) => [k, theme] as const)))(
    "writes .preview/home/r8-%s-%s.html",
    (kind, theme) => {
      const t = THEMES[theme];
      const tiles = [
        productTile(kind, "fb-apricot-linen", 1, t),
        productTile(kind, "fb-apricot-linen", 2.5, t),
        productTile(kind, "fb-indigo-plaid", 1, t),
        productTile(kind, "fb-indigo-plaid", 2.5, t),
      ];
      writeFileSync(`.preview/home/r8-${kind}-${theme}.html`, sheet([tiles], theme));
    }
  );
});

describe("small prints at true size, light and dark", () => {
  mkdirSync(".preview/home", { recursive: true });
  it.each(THEME_NAMES)("writes .preview/home/r8-small-curtain-%s.html", (theme) => {
    const t = THEMES[theme];
    const rows = [
      [productTile("curtain", "fb-apricot-linen", 1, t), productTile("curtain", "fb-apricot-linen", 4, t)],
      [
        productTile("curtain", "fb-saffron-stripe", 1, t),
        productTile("curtain", "fb-saffron-stripe", 2, t),
        productTile("curtain", "fb-saffron-stripe", 4, t),
      ],
      [productTile("curtain", "fb-midnight-floral", 1, t), productTile("curtain", "fb-midnight-floral", 4, t)],
    ];
    writeFileSync(`.preview/home/r8-small-curtain-${theme}.html`, sheet(rows, theme));
  });
  it.each(THEME_NAMES)("writes .preview/wardrobe/r8-small-dress-%s.html", (theme) => {
    const t = THEMES[theme];
    const bodice: [number, number] = [300, 330];
    const rows = [
      [dressTile("fb-apricot-linen", 1, [300, 500], t), dressTile("fb-apricot-linen", 3, bodice, t)],
      [dressTile("fb-terracotta-herring", 1, [300, 500], t), dressTile("fb-terracotta-herring", 3, bodice, t)],
    ];
    writeFileSync(`.preview/wardrobe/r8-small-dress-${theme}.html`, sheet(rows, theme, Math.round((PX * 986) / 488)));
  });
});
