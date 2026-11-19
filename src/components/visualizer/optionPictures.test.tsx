import { Fragment } from "react";
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { MannequinStage } from "./MannequinStage";
import { fabricById } from "@/lib/data/fabrics";
import { garmentsFor } from "@/lib/data/garments";
import { necklinesForGarment } from "@/lib/data/necklines";
import { sleeveCuffsFor, sleeveLengthsFor, sleeveTypesFor } from "@/lib/data/sleeves";
import { beltsFor } from "@/lib/data/closures";
import { tiesFor } from "@/lib/data/collars";
import { DEFAULT_SKIN_TONE } from "@/lib/data/skinTones";
import { collarsFitting, cutFrom, necklineOf, setCollar, setNeckline, setSleeve, sleeveOf, tiesOffered } from "@/lib/garments/outfit";
import { writeSheet } from "@/lib/garments/writeSheet";
import { PICTURES, pictureKey } from "@/lib/visualizer/optionPictures";
import { PICTURE_VIEWPORT, pictureRecipes, type PictureRecipe } from "@/lib/visualizer/pictureRecipes";
import type { Fabric, FabricRegionId, Outfit } from "@/types";

/**
 * The phone's option pictures (`lib/visualizer/optionPictures.ts`): every
 * option the panel can offer has one, each is small, and each is still the
 * drawing it was made from. When a garment's drawing changes, the last test
 * fails until the pictures are made again:
 *
 *     SHEETS=1 npx vitest run src/components/visualizer/optionPictures.test.tsx
 *     node scripts/option-pictures.mjs     (with the dev server on :3000)
 */

const SHEET = ".preview/option-pictures/sheet.html";
const DRAWN = ".preview/option-pictures/drawn.json";
const PUBLIC = "public/options";

const fabricsOf = (r: PictureRecipe) => {
  const out: Record<string, Partial<Record<FabricRegionId, Fabric>>> = {};
  for (const w of r.worn) {
    const regions: Partial<Record<FabricRegionId, Fabric>> = {};
    for (const [region, id] of Object.entries(w.fabrics)) if (id) regions[region as FabricRegionId] = fabricById(id)!;
    out[w.garmentId] = regions;
  }
  return out;
};

/** Every option the panel offers, by picture key — walked the way the panel lists them, cut by cut. */
function offered(): Set<string> {
  const keys = new Set<string>();
  for (const body of ["female", "male"] as const) {
    for (const g of garmentsFor(body)) {
      keys.add(pictureKey(g.id, "garment"));
      const base = [cutFrom(g, "fb-cream")];
      const necks = necklinesForGarment(g);
      for (const n of necks) keys.add(pictureKey(g.id, "neckline", n.id));
      for (const nid of necks.length ? necks.map((n) => n.id) : [undefined]) {
        const worn = nid ? setNeckline(base, g.id, nid) : base;
        const neckline = necklineOf(worn[0]);
        const types = sleeveTypesFor(g, neckline);
        for (const t of types) keys.add(pictureKey(g.id, "sleeve", t));
        const collars = collarsFitting(g, worn[0]);
        if (collars.length > 0) keys.add(pictureKey(g.id, "collar", "none"));
        for (const c of [undefined, ...collars.map((c) => c.id)]) {
          if (c) keys.add(pictureKey(g.id, "collar", c));
          const collared = setCollar(worn, g.id, c);
          const ties = tiesFor(tiesOffered(collared[0]), g.gender);
          // a choice of one is no choice: the panel offers ties only from two up
          if (ties.length > 1) for (const t of ties) keys.add(pictureKey(g.id, "tie", t.id));
        }
        const belts = beltsFor(g, neckline?.cut);
        if (belts.length > 1) for (const b of belts) keys.add(pictureKey(g.id, "belt", b.id));
        for (const t of types) {
          for (const length of sleeveLengthsFor(t, neckline, g)) {
            const sleeve = sleeveOf(setSleeve(worn, g.id, { type: t, length } as never)[0]);
            if (sleeve) for (const c of sleeveCuffsFor(g, sleeve)) keys.add(pictureKey(g.id, "cuff", c));
          }
        }
      }
    }
  }
  return keys;
}

/** Each figure's markup, its ids made the same whatever its place on the page — the drawing, and nothing else. */
const drawnHash = (markup: string) =>
  createHash("sha256").update(markup.replace(/(["#(])R[0-9A-Za-z]{1,12}-/g, "$1X-")).digest("hex").slice(0, 12);

describe("the phone's option pictures", () => {
  const recipes = pictureRecipes();

  it("every option the panel offers has a picture, made and on disk", () => {
    const keys = new Set(recipes.map((r) => r.key));
    expect(keys.size, "two recipes for one picture").toBe(recipes.length);
    const want = offered();
    for (const key of want) {
      expect(keys.has(key), `no recipe for ${key}`).toBe(true);
      expect(PICTURES[key], `no picture for ${key} — make the pictures (see this file's header)`).toBeDefined();
      expect(existsSync(join(PUBLIC, `${key}.webp`)), `${key}.webp missing`).toBe(true);
    }
    // and none for an option no longer offered
    for (const key of Object.keys(PICTURES)) expect(keys.has(key), `${key} is not offered any more`).toBe(true);
  });

  it("is light: each picture a few kilobytes, all of them about a megabyte", () => {
    let total = 0;
    for (const key of Object.keys(PICTURES)) {
      const size = statSync(join(PUBLIC, `${key}.webp`)).size;
      expect(size, key).toBeLessThan(14_000);
      total += size;
    }
    expect(total).toBeLessThan(1_300_000);
    // nothing else left lying in the folder
    const files = readdirSync(PUBLIC, { recursive: true }).filter((f) => String(f).endsWith(".webp"));
    expect(files.length).toBe(Object.keys(PICTURES).length);
  });

  it("each picture is still the drawing it was made from", () => {
    const figures = recipes.map((r) => {
      const outfit: Outfit = { bodyType: r.body, skinTone: DEFAULT_SKIN_TONE, direction: 0, worn: r.worn };
      return (
        <figure key={r.key} id={r.key} style={{ width: PICTURE_VIEWPORT.width, height: PICTURE_VIEWPORT.height }}>
          <MannequinStage outfit={outfit} fabrics={fabricsOf(r)} zoom={r.zoom} focus={r.focus} viewport={PICTURE_VIEWPORT} />
        </figure>
      );
    });
    // one render for the whole sheet: separate ones repeat ids, and a hidden figure's defs would serve another's
    const markup = renderToStaticMarkup(<>{figures.map((f, i) => <Fragment key={i}>{f}</Fragment>)}</>);
    const parts = markup.split(/(?=<figure id=")/).filter((s) => s.startsWith("<figure"));
    expect(parts.length).toBe(recipes.length);
    const drawn: Record<string, string> = {};
    for (const part of parts) {
      const key = /^<figure id="([^"]+)"/.exec(part)![1];
      expect(part.includes("<svg"), key).toBe(true);
      drawn[key] = drawnHash(part);
    }
    writeSheet(
      SHEET,
      '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' +
        "<style>html,body{margin:0;background:transparent}figure{margin:0;color:#241e19}svg{width:100%;height:100%;display:block}</style>" +
        markup
    );
    if (process.env.SHEETS) {
      mkdirSync(".preview/option-pictures", { recursive: true });
      writeFileSync(DRAWN, JSON.stringify(drawn, null, 1));
    }
    const stale = Object.keys(drawn).filter((key) => PICTURES[key] && PICTURES[key].drawn !== drawn[key]);
    expect(stale, "these pictures were drawn from an older drawing — make the pictures again (see this file's header)").toEqual([]);
  }, 180_000);
});
