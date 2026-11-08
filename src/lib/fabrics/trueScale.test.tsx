import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductTemplate } from "@/components/visualizer/ProductTemplate";
import { MannequinStage } from "@/components/visualizer/MannequinStage";
import { BODY_CANVAS } from "@/lib/mannequin/bodies";
import { fabrics } from "@/lib/data/fabrics";
import { garments } from "@/lib/data/garments";
import { DEFAULT_SKIN_TONE } from "@/lib/data/skinTones";
import { fabricRepeatCm } from "@/lib/fabrics/patterns";
import { printKeep } from "@/lib/fabrics/printScale";
import { PRODUCT_CANVAS, products } from "@/lib/products/registry";
import { cutFrom } from "@/lib/garments/outfit";
import { shapeLengths } from "@/lib/garments/skirts";
import type { Fabric, FabricRegionId, Outfit } from "@/types";

/**
 * The visualizer's one promise, checked where it is kept: every print, on
 * every product and every garment, at every zoom the slider offers, is drawn
 * at its true size — one repeat to a tile, `repeatCm` wide on the piece —
 * and so the right number of times across it. Never a stand-in drawn bigger
 * because the true one is small on screen: a small repeat is softened in its
 * own drawing, at its own size (see `printScale.ts`).
 *
 * Run alone with `npm run check:scale`.
 */

/** The zoom slider's steps: 1× to 8× by halves. */
const ZOOMS = Array.from({ length: 15 }, (_, i) => 1 + i / 2);
/** What a stage measures before it can — see `useRenderedWidth`. */
const RENDER_PX = 440;

/** Every print tile a markup draws: the pattern's size, and the drawing inside it. */
function tilesOf(html: string) {
  return [
    ...html.matchAll(/<pattern id="([^"]*-pattern)"[^>]*? width="([^"]+)" height="([^"]+)"[^>]*>(.*?)<\/pattern>/g),
  ].map(([, id, w, h, inner]) => {
    const images = [...inner.matchAll(/<image href="([^"]*)" x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/g)];
    return {
      id,
      w: Number(w),
      h: Number(h),
      images: images.map(([, href, x, y, iw, ih]) => ({ softened: href.includes("feGaussianBlur"), x: +x, y: +y, w: +iw, h: +ih })),
      /** anything else laid in the tile — the old stand-in's flat colour was a rect */
      extra: inner.replace(/<image[^>]*?(\/>|><\/image>)/g, "").length,
    };
  });
}

/** The left and right of everything a piece of markup draws, read off its rects and absolute path points. */
function spanOf(html: string): [number, number] {
  const xs: number[] = [];
  for (const [, x, w] of html.matchAll(/<rect[^>]*? x="([^"]+)"[^>]*? width="([^"]+)"/g)) xs.push(+x, +x + +w);
  for (const [, d] of html.matchAll(/<path[^>]*? d="([^"]+)"/g)) {
    const tokens = d.match(/[MLQCZ]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
    let i = 0;
    for (const t of tokens) {
      if (/[A-Z]/.test(t)) {
        i = 0;
        continue;
      }
      if (i % 2 === 0) xs.push(Number(t));
      i++;
    }
  }
  return [Math.min(...xs), Math.max(...xs)];
}

/** One fabric of each repeat size the catalogue has. */
const byRepeat = [...new Map(fabrics.map((f) => [fabricRepeatCm(f), f])).values()];

function expectTrueTiles(html: string, repeat: number, screenPxPerUnit: number, label: string) {
  const tiles = tilesOf(html);
  expect(tiles.length, `${label}: no print drawn`).toBeGreaterThan(0);
  const keep = printKeep(repeat * screenPxPerUnit);
  for (const t of tiles) {
    expect(t.w, `${label}: ${t.id} is ${t.w} units, the repeat is ${repeat}`).toBeCloseTo(repeat, 9);
    expect(t.h, `${label}: ${t.id} height`).toBeCloseTo(repeat, 9);
    expect(t.images.length, `${label}: ${t.id} lays ${t.images.length} drawings`).toBe(1);
    expect(t.extra, `${label}: ${t.id} lays more than its drawing`).toBe(0);
    const [img] = t.images;
    expect([img.x, img.y, img.w, img.h], `${label}: ${t.id}'s drawing fills its tile`).toEqual([0, 0, t.w, t.h]);
    expect(img.softened, `${label}: softened at ${(repeat * screenPxPerUnit).toFixed(1)} px a repeat`).toBe(keep < 1);
  }
}

describe("every print at its true size", () => {
  it("on every Home product, in every fabric, at every zoom — and the right number of times across it", () => {
    for (const p of products) {
      const [left, right] = spanOf(renderToStaticMarkup(<svg>{p.parts.map((part) => part.shape("#fff"))}</svg>));
      expect((right - left) * p.cmPerUnit, `${p.kind}'s cloth is drawn ${(right - left) * p.cmPerUnit} cm wide`).toBeCloseTo(p.widthCm, 0);
      for (const fabric of fabrics) {
        const repeatCm = fabricRepeatCm(fabric);
        const repeat = repeatCm / p.cmPerUnit;
        for (const zoom of ZOOMS) {
          const html = renderToStaticMarkup(<ProductTemplate kind={p.kind} fabrics={{ main: fabric }} zoom={zoom} />);
          const label = `${p.kind} in ${fabric.id} at ${zoom}×`;
          expectTrueTiles(html, repeat, RENDER_PX / (PRODUCT_CANVAS[0] / zoom), label);
          /* repeats across the cloth: its drawn width over one tile, against its real width over one repeat */
          const across = (right - left) / tilesOf(html)[0].w;
          expect(across, `${label}: ${across.toFixed(2)} repeats across`).toBeCloseTo(p.widthCm / repeatCm, 1);
        }
      }
    }
  });

  it("on every garment, in every size of repeat, at every zoom", () => {
    for (const garment of garments) {
      for (const fabric of byRepeat) {
        const repeat = fabricRepeatCm(fabric) / BODY_CANVAS.cmPerUnit;
        const regions = Object.fromEntries(
          [...garment.fabricRegions, "collar"].map((r) => [r, fabric])
        ) as Partial<Record<FabricRegionId, Fabric>>;
        const outfit: Outfit = {
          bodyType: garment.gender,
          skinTone: DEFAULT_SKIN_TONE,
          direction: 0,
          worn: [cutFrom(garment, fabric.id)],
        };
        for (const zoom of ZOOMS) {
          const html = renderToStaticMarkup(
            <MannequinStage outfit={outfit} fabrics={{ [garment.id]: regions }} zoom={zoom} focus={[300, 420]} />
          );
          /* the stage measures its frame against the width it is drawn at: the home frame at 1×, a zoom'th of it in */
          const frameW = Number(html.match(/<svg[^>]*viewBox="[^ ]+ [^ ]+ ([^ ]+) [^"]+"/)?.[1]);
          expectTrueTiles(html, repeat, RENDER_PX / frameW, `${garment.id} in ${fabric.id} at ${zoom}×`);
        }
      }
    }
    /* about fourteen hundred stages: give them the time */
  }, 120_000);

  /*
    Every skirt style, in every size of repeat, at one zoom: a style changes
    the outline the print fills, never the print's own tile, so one zoom is
    enough to prove a style draws it at true size.
  */
  it("on every skirt style, in every size of repeat", () => {
    for (const garment of garments.filter((g) => g.skirt)) {
      const { default: own, shapes, lengths, waists } = garment.skirt!;
      for (const shape of shapes) for (const waist of waists ?? [undefined]) for (const length of shapeLengths(shape, lengths)) {
        for (const fabric of byRepeat) {
          const repeat = fabricRepeatCm(fabric) / BODY_CANVAS.cmPerUnit;
          const regions = Object.fromEntries(
            [...garment.fabricRegions, "collar"].map((r) => [r, fabric])
          ) as Partial<Record<FabricRegionId, Fabric>>;
          const outfit: Outfit = {
            bodyType: garment.gender,
            skinTone: DEFAULT_SKIN_TONE,
            direction: 0,
            worn: [{ ...cutFrom(garment, fabric.id), skirt: { ...own, shape, length, ...(waist ? { waist } : {}) } }],
          };
          const html = renderToStaticMarkup(
            <MannequinStage outfit={outfit} fabrics={{ [garment.id]: regions }} zoom={2} focus={[300, 640]} />
          );
          const frameW = Number(html.match(/<svg[^>]*viewBox="[^ ]+ [^ ]+ ([^ ]+) [^"]+"/)?.[1]);
          expectTrueTiles(html, repeat, RENDER_PX / frameW, `${garment.id}, ${shape} ${waist ?? ""} ${length}, in ${fabric.id}`);
        }
      }
    }
  }, 60_000);

  /*
    Every way a dress is buttoned and belted, at every waist, likewise at one
    zoom: a placket and a self-fabric belt are cut from the dress's cloth, and
    a leather belt takes none — but it is drawn as cloth is, and must never
    lay the print at another size.
  */
  it("on every way a dress is buttoned and belted, at every waist, in every size of repeat", () => {
    for (const garment of garments.filter((g) => g.buttons || g.belts)) {
      for (const buttons of garment.buttons?.offered ?? [undefined]) for (const belt of garment.belts?.offered ?? [undefined]) {
        for (const waist of garment.skirt?.waists ?? [undefined]) {
          for (const fabric of byRepeat) {
            const repeat = fabricRepeatCm(fabric) / BODY_CANVAS.cmPerUnit;
            const regions = Object.fromEntries(
              [...garment.fabricRegions, "collar"].map((r) => [r, fabric])
            ) as Partial<Record<FabricRegionId, Fabric>>;
            const worn = cutFrom(garment, fabric.id);
            const outfit: Outfit = {
              bodyType: garment.gender,
              skinTone: DEFAULT_SKIN_TONE,
              direction: 0,
              worn: [{ ...worn, ...(buttons ? { buttons } : {}), ...(belt ? { belt } : {}), ...(waist && garment.skirt ? { skirt: { ...garment.skirt.default, waist } } : {}) }],
            };
            const html = renderToStaticMarkup(
              <MannequinStage outfit={outfit} fabrics={{ [garment.id]: regions }} zoom={2} focus={[300, 380]} />
            );
            const frameW = Number(html.match(/<svg[^>]*viewBox="[^ ]+ [^ ]+ ([^ ]+) [^"]+"/)?.[1]);
            expectTrueTiles(html, repeat, RENDER_PX / frameW, `${garment.id}, buttons ${buttons}, belt ${belt}, ${waist ?? ""}, in ${fabric.id}`);
          }
        }
      }
    }
  }, 60_000);

  /* every way a robe is worn at the front, her abaya open and closed, with every sleeve it is cut with, likewise at one zoom */
  it("on every front a robe is worn with, and every sleeve, in every size of repeat", () => {
    for (const garment of garments.filter((g) => g.fronts)) {
      for (const front of garment.fronts!.offered) for (const type of garment.sleeves?.types ?? [undefined]) {
        for (const fabric of byRepeat) {
          const repeat = fabricRepeatCm(fabric) / BODY_CANVAS.cmPerUnit;
          const regions = Object.fromEntries(
            [...garment.fabricRegions, "collar"].map((r) => [r, fabric])
          ) as Partial<Record<FabricRegionId, Fabric>>;
          const outfit: Outfit = {
            bodyType: garment.gender,
            skinTone: DEFAULT_SKIN_TONE,
            direction: 0,
            worn: [{ ...cutFrom(garment, fabric.id), front, ...(type ? { sleeve: { type, length: garment.sleeves!.lengths?.[0] ?? "long" } } : {}) }],
          };
          const html = renderToStaticMarkup(
            <MannequinStage outfit={outfit} fabrics={{ [garment.id]: regions }} zoom={2} focus={[300, 420]} />
          );
          const frameW = Number(html.match(/<svg[^>]*viewBox="[^ ]+ [^ ]+ ([^ ]+) [^"]+"/)?.[1]);
          expectTrueTiles(html, repeat, RENDER_PX / frameW, `${garment.id}, ${front}, ${type ?? ""}, in ${fabric.id}`);
        }
      }
    }
  }, 60_000);
});
