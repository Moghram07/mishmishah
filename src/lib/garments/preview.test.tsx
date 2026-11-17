import { Fragment } from "react";
import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { MannequinStage } from "@/components/visualizer/MannequinStage";
import { collarById, collars, collarsForGarment } from "@/lib/data/collars";
import { collarArt, garmentArt } from "@/lib/garments/art";
import { BAND_FOOT } from "@/lib/garments/art/male/yoke";
import { fabrics } from "@/lib/data/fabrics";
import { garmentById } from "@/lib/data/garments";
import { necklinesForGarment } from "@/lib/data/necklines";
import { cutFrom, setCollar, setNeckline } from "@/lib/garments/outfit";
import type { BodyType, Fabric, FabricRegionId, Outfit } from "@/types";
import { DEFAULT_SKIN_TONE } from "@/lib/data/skinTones";

/**
 * Every collar, actually rendered.
 *
 * `npm run check:garments` reads the `*_PATH` constants out of each drawing's
 * source and measures where that cloth lands on the body. It is the check that
 * fails a build, and it has one blind spot it cannot close: it never runs the
 * components. A collar whose `shape()` forgot one of its own paths, or whose
 * `defs` and `shading` disagree about a gradient id, passes every geometric
 * test in this project and then renders wrong — or renders nothing.
 *
 * So this puts each collar through the real `MannequinStage`, on the real body,
 * in real cloth, and asserts that what comes out is a collar. It also writes
 * `.preview/collars.html` and `.preview/closeup.html` on the way past, because
 * the question these were rebuilt to answer — do they look like cloth — is not
 * one any assertion can settle. Open those, or point a browser at them.
 *
 * They pull the mannequin photograph through a `<base href>` on **port 3000**,
 * which is where `npm run dev` serves. That is deliberate: it means looking at
 * a collar never needs `npm run build`, and a production build is what leaves
 * artifacts in `.next` that break the next `npm run dev`. Start the dev server,
 * run the tests, open the file.
 */

const fabricById = (id: string) => fabrics.find((f) => f.id === id)!;
const linen = () => fabricById("fb-apricot-linen");

/** A garment each collar can actually be sewn to. */
const wearer = (body: BodyType, collarId: string) => {
  const collar = collars.find((c) => c.id === collarId)!;
  if (collar.compatibleWith.includes("outerwear")) {
    return garmentById(`${body}-jacket`)!;
  }
  /* a collar no top takes goes on the long garment that does: her sailor on the dress, cut to take it; his regular collars on the thobe */
  if (!collar.compatibleWith.includes("top")) return garmentById(body === "male" ? "male-thobe" : "female-dress")!;
  if (body === "female") return garmentById("female-blouse")!;
  /* the thobe's band collars on the thobe — the regular ones are its alone; the rest on his shirt */
  return garmentById(
    ["male-regular-collar", "male-regular-short-collar", "male-mandarin-collar"].includes(collar.id) ? "male-thobe" : "male-shirt"
  )!;
};

/** The cut a garment with a choice of neckline needs to take a collar: the first that presents an opening it is sewn into. */
const cutFor = (garment: ReturnType<typeof wearer>, collarId: string) => {
  const collar = collars.find((c) => c.id === collarId)!;
  const openings = collar.cuts ?? [collar.opening];
  return necklinesForGarment(garment).find((n) => n.opening !== null && openings.includes(n.opening) && !n.wants);
};

function stage(body: BodyType, collarId: string, cloth: Fabric) {
  const garment = wearer(body, collarId);
  const cut = cutFor(garment, collarId);
  const worn = setCollar(
    cut ? setNeckline([cutFrom(garment, cloth.id)], garment.id, cut.id) : [cutFrom(garment, cloth.id)],
    garment.id,
    collarId
  );
  const outfit: Outfit = { bodyType: body, skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };

  const regions: Partial<Record<FabricRegionId, Fabric>> = {};
  for (const region of [...garment.fabricRegions, "collar" as const]) {
    regions[region] = cloth;
  }

  return (
    <MannequinStage
      outfit={outfit}
      fabrics={{ [garment.id]: regions }}
      zoom={3.4}
      focus={[300, 208]}
    />
  );
}

function tile(body: BodyType, collarId: string, cloth: Fabric) {
  const collar = collars.find((c) => c.id === collarId)!;
  return (
    <figure>
      {stage(body, collarId, cloth)}
      <figcaption>
        {collar.name.en} · {wearer(body, collarId).name.en} · {cloth.name.en}
      </figcaption>
    </figure>
  );
}

describe("every collar renders as a collar", () => {
  const drawn = new Map<string, string>();

  for (const collar of collars) {
    it(`draws ${collar.id}`, () => {
      const markup = renderToStaticMarkup(
        stage(collar.gender, collar.id, linen())
      );
      drawn.set(collar.id, markup);

      // cloth, its fixed light, and the mask that keeps that light inside it
      expect(markup).toContain("<pattern");
      expect(markup).toContain("mix-blend-mode:multiply");
      expect(markup).toContain("<mask");

      // A collar is several pieces — a band and a fall at the least, plus the
      // garment and its sleeves. A handful of paths is a collar that lost most
      // of itself somewhere between `shape()` and the page.
      expect((markup.match(/<path /g) ?? []).length, collar.id).toBeGreaterThan(6);

      // Every gradient and filter the shading reaches for must have been
      // declared. A `url(#…)` with no matching id paints nothing, in black.
      for (const attr of ["fill", "filter"] as const) {
        const used = markup.matchAll(
          new RegExp(`${attr}="url\\(#([^)]+)\\)"`, "g")
        );
        for (const [, id] of used) {
          expect(
            markup.includes(`id="${id}"`),
            `${collar.id}: ${attr} refers to "${id}", which nothing declares`
          ).toBe(true);
        }
      }
    });
  }

  it("draws a different thing for every collar", () => {
    // Nine of these were once one shape in nine costumes. `check:garments`
    // catches that by bounding box; this catches it by output, which is the
    // other half of the same question.
    const byBody = new Map<BodyType, string[]>();
    for (const collar of collars) {
      const seen = byBody.get(collar.gender) ?? [];
      // ids are salted per render, so compare the geometry and not the ids
      seen.push((drawn.get(collar.id) ?? "").replace(/id="[^"]*"/g, ""));
      byBody.set(collar.gender, seen);
    }
    for (const [body, markups] of byBody) {
      expect(new Set(markups).size, body).toBe(markups.length);
    }
  });
});

describe("a look at them", () => {
  const page = (title: string, width: number, body: string) =>
    `<!doctype html><meta charset="utf-8"><title>${title}</title>
<base href="http://localhost:3000/">
<style>
  body { margin: 0; padding: 22px; background: #FBF7F0; font: 13px/1.4 system-ui, sans-serif; color: #1B1714; }
  h2 { font-size: 14px; font-weight: 600; margin: 26px 0 10px; }
  .row { display: flex; flex-wrap: wrap; gap: 12px; }
  figure { width: ${width}px; margin: 0; }
  svg { width: ${width}px; height: ${width}px; background: #fff; border-radius: 12px; display: block; }
  figcaption { margin-top: 6px; font-size: 11px; color: #6B6055; }
</style>
${body}`;

  /* sheets only when images are being made: see vitest.config.mts */
  it.skipIf(!process.env.SHEETS)("writes .preview/collars.html", () => {
    const rows: [string, BodyType, Fabric][] = [
      ["male · plain linen", "male", linen()],
      [
        "male · stripe (the grain must break at the seam)",
        "male",
        fabricById("fb-saffron-stripe"),
      ],
      ["female · plain linen", "female", linen()],
      [
        "female · plaid (the grain must break at the seam)",
        "female",
        fabricById("fb-indigo-plaid"),
      ],
    ];
    /*
      Rendered as one tree. `useId` restarts at "R1" for every
      `renderToStaticMarkup` call, so a tile per call gave all thirteen collars
      the same id namespace and the browser resolved every `url(#…)` to the
      first declaration on the page — a sheet that showed collars wearing each
      other's masks.
    */
    const body = renderToStaticMarkup(
      <>
        {rows.map(([title, who, cloth]) => (
          <Fragment key={title}>
            <h2>{title}</h2>
            <div className="row">
              {collars
                .filter((c) => c.gender === who)
                .map((c) => (
                  <Fragment key={c.id}>{tile(who, c.id, cloth)}</Fragment>
                ))}
            </div>
          </Fragment>
        ))}
      </>
    );
    writeFileSync(".preview/collars.html", page("Collars", 200, body));
  });

  it.skipIf(!process.env.SHEETS)("writes .preview/closeup.html", () => {
    const big: [BodyType, string, string][] = [
      ["female", "female-turtleneck-collar", "fb-apricot-linen"],
      ["female", "female-ruffled-collar", "fb-apricot-linen"],
      ["female", "female-mandarin-collar", "fb-apricot-linen"],
      ["female", "female-peter-pan-collar", "fb-apricot-linen"],
      ["male", "male-shirt-collar", "fb-apricot-linen"],
      ["male", "male-shirt-collar", "fb-saffron-stripe"],
    ];
    const body = renderToStaticMarkup(
      <div className="row">
        {big.map(([who, id, cloth], i) => (
          <Fragment key={i}>{tile(who, id, fabricById(cloth))}</Fragment>
        ))}
      </div>
    );
    writeFileSync(".preview/closeup.html", page("Collars, close up", 400, body));
  });
});

describe("his band collars, and the buttons under them", () => {
  const offered = (id: string) => collarsForGarment(garmentById(id)!).map((c) => c.id);
  /** Each button's row, from a piece of hardware as drawn: its dark disc, not the light on its face. */
  const rows = (node: unknown) =>
    [...renderToStaticMarkup(node as React.ReactElement).matchAll(/<circle cx="[-\d.]+" cy="([-\d.]+)" r="[\d.]+" fill="#2b211b"/g)].map(([, y]) => Number(y));

  it("names the thobe's collar for what it is, and the thobe arrives in it", () => {
    expect(collarById("male-regular-collar")!.name).toEqual({ en: "Regular collar", ar: "رقبة عادي" });
    expect(collarById("male-regular-short-collar")!.name.ar).toBe("رقبة عادي قصير");
    expect(collarById("male-mandarin-collar")!.name.ar).toBe("رقبة صيني");
    expect(garmentById("male-thobe")!.defaultCollar).toBe("male-regular-collar");
    // everything else keeps its own
    expect(garmentById("male-shirt")!.defaultCollar).toBe("male-shirt-collar");
    expect(garmentById("male-polo")!.defaultCollar).toBe("male-polo-collar");
  });

  it("offers the regular collars on the thobe alone, and the mandarin on all three", () => {
    for (const id of ["male-regular-collar", "male-regular-short-collar"]) {
      expect(offered("male-thobe"), id).toContain(id);
      expect(offered("male-shirt"), id).not.toContain(id);
      expect(offered("male-polo"), id).not.toContain(id);
    }
    for (const id of ["male-thobe", "male-shirt", "male-polo"]) expect(offered(id), id).toContain("male-mandarin-collar");
  });

  it("closes a regular band with a tab and its buttons, and leaves a mandarin open, with none", () => {
    expect(collarById("male-regular-collar")!.build.front).toBe("tab");
    expect(collarById("male-regular-short-collar")!.build.front).toBe("tab");
    expect(collarById("male-mandarin-collar")!.build.front).toBe("open");
    const onBand = (id: string) => collarArt(collarById(id)!.asset.front)?.bandButtons?.(1);
    expect(rows(onBand("male-regular-collar"))).toHaveLength(2);
    expect(rows(onBand("male-regular-short-collar"))).toHaveLength(1);
    expect(onBand("male-mandarin-collar")).toBeUndefined();
  });

  it("buttons a regular band down the same line as the thobe's placket", () => {
    const xs = (node: unknown) =>
      [...renderToStaticMarkup(node as React.ReactElement).matchAll(/<circle cx="([-d.]+)" cy="[-d.]+" r="([d.]+)" fill="#2b211b"/g)].map(([, x]) => Number(x));
    const placket = xs(garmentArt(garmentById("male-thobe")!.asset.front)!.bandTrim);
    for (const id of ["male-regular-collar", "male-regular-short-collar"]) {
      for (const x of xs(collarArt(collarById(id)!.asset.front)!.bandButtons!(1))) expect(x, id).toBeCloseTo(placket[0], 5);
    }
  });

  it("draws every button solid", () => {
    const art = garmentArt(garmentById("male-thobe")!.asset.front)!;
    const markup = renderToStaticMarkup(art.bandTrim as React.ReactElement);
    expect(markup).toContain('fill="#2b211b"');
    expect(markup).not.toMatch(/fill="#2b211b" opacity/);
  });

  it("starts each placket's buttons just under a band, and spaces them evenly", () => {
    for (const id of ["male-thobe", "male-shirt", "male-polo"]) {
      const art = garmentArt(garmentById(id)!.asset.front)!;
      const ys = rows(art.bandTrim);
      expect(ys[0] - BAND_FOOT, id).toBeGreaterThan(4);
      expect(ys[0] - BAND_FOOT, id).toBeLessThan(12);
      const gaps = ys.slice(1).map((y, i) => y - ys[i]);
      for (const gap of gaps) expect(gap, id).toBeCloseTo(gaps[0], 1);
      // and ends where the garment's own row does
      expect(ys[ys.length - 1], id).toBeCloseTo(Math.max(...rows(art.openingTrim?.high ?? art.trim)), 0);
    }
  });
});
