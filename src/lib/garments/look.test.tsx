import { Fragment, type ReactNode } from "react";
import { describe, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { MannequinStage } from "@/components/visualizer/MannequinStage";
import { contrastingPlain, fabrics } from "@/lib/data/fabrics";
import { garmentById } from "@/lib/data/garments";
import { collarOf, collarsFitting, cutFrom, setBelt, setButtons, setCollar, setFront, setLeg, setNeckline, setSkirt, setSleeve, setStripes, setStripesAt, setTie, regionsOf, skirtOf, wear } from "@/lib/garments/outfit";
import { ROBE_TYPES, SLEEVE_KINDS, SLEEVE_TYPES } from "@/lib/garments/sleeves";
import { necklineById, necklines, necklinesForGarment } from "@/lib/data/necklines";
import { collars, collarsForGarment } from "@/lib/data/collars";
import { sleeveLengthsFor, sleeveTypesFor } from "@/lib/data/sleeves";
import type { BeltId, BodyType, ButtonsId, Fabric, FabricRegionId, FrontId, LegId, Outfit, SkirtChoice, SkirtLengthId, SkirtShapeId, SleeveChoice, StripesAtId, StripesId, TieId, WaistId, WornGarment } from "@/types";
import { DEFAULT_SKIN_TONE, skinTones } from "@/lib/data/skinTones";
import { chroma, ciede2000, hexToRgb, hue, ita, itaClass } from "@/lib/color/cielab";
import { frameFor } from "@/lib/mannequin/frame";
import { bodyById } from "@/lib/mannequin/bodies";
import { garments } from "@/lib/data/garments";
import { focusOf } from "@/lib/garments/closeUp";
import { draft } from "@/lib/garments/fit";
import { SKIRT_SHAPES, shapeLengths } from "@/lib/garments/skirts";

/**
 * The wardrobe, dressed and photographed.
 *
 * `preview.test.tsx` does this for collars, one garment at a time, close up.
 * This is the other half: whole outfits on whole bodies, which is the only view
 * that answers "does this look like clothing" — a collar can be right while the
 * blouse under it reads as a cape.
 *
 * It asserts nothing, deliberately. Everything here that *can* be asserted is
 * asserted in `preview.test.tsx` or measured by `npm run check:garments`; what
 * is left is a judgement, and the job of this file is to put something in front
 * of an eye. Run it, then open `.preview/look.html` and `.preview/shoulders.html`
 * against a dev server on :3000 (they pull the mannequin photographs through a
 * `<base href>`, so a production build is never needed).
 */

const f = (id: string) => fabrics.find((x) => x.id === id)!;

export function tile(
  label: string, body: BodyType, ids: string[], clothId: string,
  zoom: number, focus: [number, number], collar?: string, neckline?: string,
  sleeve?: SleeveChoice
) {
  const cloth = f(clothId);
  let worn: WornGarment[] = [];
  const by: Record<string, Partial<Record<FabricRegionId, Fabric>>> = {};
  for (const id of ids) {
    const g = garmentById(id)!;
    worn = wear(worn, cutFrom(g, cloth.id));
    const regions: Partial<Record<FabricRegionId, Fabric>> = {};
    for (const r of g.fabricRegions) regions[r] = cloth;
    regions.collar = cloth;
    by[g.id] = regions;
  }
  if (collar) worn = setCollar(worn, ids[0], collar);
  if (neckline) worn = setNeckline(worn, ids[0], neckline);
  if (sleeve) worn = setSleeve(worn, ids[0], sleeve);
  const outfit: Outfit = { bodyType: body, skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
  return (
    <figure>
      <MannequinStage outfit={outfit} fabrics={by} zoom={zoom} focus={focus} />
      <figcaption>{label}</figcaption>
    </figure>
  );
}

export function page(tiles: React.ReactNode[], width = 420, bg = "#efeae4") {
  const head = '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">';
  const css = "<style>body{margin:0;padding:14px;background:" + bg + ";font:12px system-ui}" +
    ".row{display:flex;flex-wrap:wrap;gap:10px}figure{width:" + width + "px;margin:0}" +
    "svg{width:" + width + "px;height:" + width + "px;background:" + (bg === "#FF00FF" ? "#FF00FF" : "#fff") +
    ";border-radius:10px;display:block}figcaption{margin-top:5px;color:#555}</style>";
  /*
    One `renderToStaticMarkup` for the whole page, not one per tile. React's
    `useId` is unique within a render tree and restarts at "R1" for each new
    one, so rendering tiles separately gave every stage on the page the same id
    namespace: nine copies of `R1-front`, with the browser resolving all of them
    to whichever was declared first. That put bare arms through finished sleeves
    and white holes through jacket lapels — a preview that lied in the direction
    of a bug, which is the worst way for one to be wrong.
  */
  const body = renderToStaticMarkup(
    <>{tiles.map((t, i) => <Fragment key={i}>{t}</Fragment>)}</>
  );
  return head + css + '<div class="row">' + body + "</div>";
}

/** One outfit per row of the wardrobe, each wearing a collar it can take. */
const OUTFITS: [string, BodyType, string[], string | undefined][] = [
  ["t-shirt + trousers", "female", ["female-t-shirt", "female-trousers"], "female-shirt-collar"],
  ["blouse + skirt", "female", ["female-blouse", "female-skirt"], "female-shirt-collar"],
  ["dress", "female", ["female-dress"], "female-peter-pan-collar"],
  ["jacket + trousers", "female", ["female-jacket", "female-trousers"], "female-notched-collar"],
  ["t-shirt + trousers", "male", ["male-t-shirt", "male-trousers"], undefined],
  ["shirt + trousers", "male", ["male-shirt", "male-trousers"], "male-shirt-collar"],
  ["polo + trousers", "male", ["male-polo", "male-trousers"], "male-polo-collar"],
  ["jacket + trousers", "male", ["male-jacket", "male-trousers"], "male-notched-collar"],
  ["thobe", "male", ["male-thobe"], "male-regular-collar"],
];

const sheet = (zoom: number, focus: [number, number], bg?: string) =>
  page(
    OUTFITS.map(([label, body, ids, collar]) =>
      tile(body + " - " + label, body, ids, "fb-indigo-plaid", zoom, focus, collar)),
    300, bg
  );

describe("the wardrobe, to look at", () => {
  it("writes .preview/look.html", () => {
    writeFileSync(".preview/look.html", sheet(1.0, [300, 500]));
  });

  it("writes .preview/shoulders.html", () => {
    writeFileSync(".preview/shoulders.html", sheet(3.0, [300, 250]));
  });

  /*
    The same outfits over magenta. Nothing in the palette is near it, so any
    magenta left showing is cloth that failed to cover a body it claims to
    cover — the check that caught three separate "is that a hole?" questions
    that a white backdrop could not answer.
  */
  it("writes .preview/magenta.html", () => {
    writeFileSync(".preview/magenta.html", sheet(1.0, [300, 500], "#FF00FF"));
  });
});

/**
 * The fit sheet: the four things a garment has to get right about a body.
 *
 * Shoulder symmetry, the armhole, the daylight between the arms and the ribs,
 * and the daylight between the legs. Each is framed close enough to judge and
 * shown on both bodies side by side, because three of the four are different on
 * the two figures and the old wardrobe used one shape for both. Plain linen
 * rather than plaid: a check reads as structure and hides the silhouette, which
 * is the one thing these tiles exist to show.
 */
const FIT: [string, BodyType, string[], [number, number], number][] = [
  ["female · neck, plain", "female", ["female-t-shirt"], [300, 200], 5.2],
  ["male · neck, plain", "male", ["male-t-shirt"], [300, 200], 5.2],
  ["female · shoulder and armhole", "female", ["female-t-shirt"], [300, 268], 3.0],
  ["male · shoulder and armhole", "male", ["male-t-shirt"], [300, 290], 3.0],
  ["female · the arms hang clear", "female", ["female-t-shirt"], [300, 360], 2.2],
  ["male · the arms hang clear", "male", ["male-t-shirt"], [300, 380], 2.2],
  /* The hip and the thigh, which is where a trouser stops following a body
     first: the taut line down the outside of a leg bridges the hollow above
     the knee, and uncapped it stood the cloth 18 units clear of it. */
  ["female · hip and thigh", "female", ["female-trousers"], [300, 480], 1.9],
  ["male · hip and thigh", "male", ["male-trousers"], [300, 480], 1.9],
  ["female · trouser waist", "female", ["female-trousers"], [300, 380], 4.5],
  ["male · trouser waist", "male", ["male-trousers"], [300, 410], 4.5],
  ["female · between the legs", "female", ["female-trousers"], [300, 700], 1.7],
  ["male · between the legs", "male", ["male-trousers"], [300, 700], 1.7],
];

describe("the fit, close up", () => {
  it("writes .preview/fit.html", () => {
    writeFileSync(
      ".preview/fit.html",
      page(
        FIT.map(([label, body, ids, focus, zoom]) =>
          tile(label, body, ids, "fb-apricot-linen", zoom, focus)
        ),
        330
      )
    );
  });
});

/**
 * The close-up, aimed at four different places.
 *
 * Zooming used to frame the middle of the canvas whatever you were editing, so
 * every close-up was of the hips and a collar could not be looked at at all.
 * These four are the same figure at the same magnification, pointed at four
 * regions — which is the thing that was broken, shown rather than asserted.
 * `garments/closeUp.test.tsx` asserts it.
 */
const AIM: [string, [number, number], number][] = [
  ["the whole figure · 1×", [300, 500], 1],
  ["aimed at the collar · 4×", [300, 172], 4],
  ["aimed at the cuff · 4×", [300, 470], 4],
  ["aimed at the hem · 4×", [300, 640], 4],
];

describe("the close-up goes where it is pointed", () => {
  it("writes .preview/zoom.html", () => {
    writeFileSync(
      ".preview/zoom.html",
      page(
        AIM.map(([label, focus, zoom]) =>
          tile(
            label,
            "female",
            ["female-blouse", "female-trousers"],
            "fb-indigo-plaid",
            zoom,
            focus,
            "female-shirt-collar"
          )
        ),
        330
      )
    );
  });
});

/**
 * The fifteen necklines, on the dress.
 *
 * The real test of this feature, and the only one that can be: the checks in
 * `check:garments` say a cut is not broken — no holes, no wedge, no seam inside
 * the shoulder — and say nothing at all about whether it looks like the thing
 * it is named after. Plain linen rather than plaid, because a check reads as
 * structure and hides the silhouette, which is the whole subject here.
 */
describe("the necklines, to look at", () => {
  it("writes .preview/necklines.html", () => {
    writeFileSync(
      ".preview/necklines.html",
      page(
        necklines.map((n) =>
          tile(
            n.name.en,
            "female",
            ["female-dress"],
            "fb-apricot-linen",
            2.1,
            [300, 300],
            undefined,
            n.id
          )
        ),
        300
      )
    );
  });
});

/**
 * Every collar, head-on and close, on both figures.
 *
 * The sheet the ring problem was found on, and the one it has to stay off. A
 * collar is the one garment whose whole job happens in forty units of canvas,
 * and at the size the other sheets draw it you cannot tell a flat collar lying
 * on a neckline from a ring drawn round a neck — which is how the Peter Pan
 * shipped for as long as it did. Four and a half times, aimed at the throat.
 */
/**
 * Every sleeve, on both bodies: each type at each length it comes in, on the
 * t-shirt — the plainest body, so the sleeve is what is being looked at — and
 * the shoulder and armhole close up, where the join to the body is.
 */
describe("sleeves", () => {
  it.each(["female", "male"] as const)("writes .preview/sleeves-%s.html", (body) => {
    const tee = `${body}-t-shirt`;
    const tiles = SLEEVE_TYPES.filter((t) => SLEEVE_KINDS[t].bodies.includes(body) && SLEEVE_KINDS[t].construction !== "band" && !ROBE_TYPES.includes(t)).flatMap((type) =>
      SLEEVE_KINDS[type].lengths.map((length) =>
        tile(`${type} · ${length}`, body, [tee], "fb-apricot-linen", 1.5, [300, 340], undefined, undefined, { type, length })
      )
    );
    const close = SLEEVE_TYPES.filter((t) => SLEEVE_KINDS[t].bodies.includes(body) && SLEEVE_KINDS[t].construction !== "band" && !ROBE_TYPES.includes(t)).map((type) =>
      tile(`${type} · shoulder`, body, [tee], "fb-apricot-linen", 3.4, [228, 260], undefined, undefined, {
        type,
        length: SLEEVE_KINDS[type].lengths[0],
      })
    );
    writeFileSync(`.preview/sleeves-${body}.html`, page([...tiles, ...close], 260));
  });

  it("writes .preview/sleeves-dress.html", () => {
    const tiles = SLEEVE_TYPES.filter((type) => SLEEVE_KINDS[type].construction !== "band" && !ROBE_TYPES.includes(type)).map((type) => {
      const length = SLEEVE_KINDS[type].lengths[SLEEVE_KINDS[type].lengths.length - 1];
      return tile(`dress · ${type} ${length}`, "female", ["female-dress"], "fb-apricot-linen", 1.5, [300, 340], undefined, undefined, { type, length });
    });
    writeFileSync(".preview/sleeves-dress.html", page(tiles, 260));
  });
});

describe("collars, front-on", () => {
  it.each(["female", "male"] as const)("writes .preview/collarfront-%s.html", (body) => {
    const under = (c: (typeof collars)[number]) =>
      c.compatibleWith.includes("outerwear")
        ? `${body}-jacket`
        : !c.compatibleWith.includes("top")
          ? (body === "female" ? "female-dress" : "male-thobe")
          : body === "female"
            ? "female-blouse"
            : "male-shirt";
    /* a collar no top takes — the sailor — on the dress, cut to the V it is sewn down */
    const cutOf = (c: (typeof collars)[number]) => (c.cuts?.includes("v") ? `${body}-v-neckline` : undefined);
    writeFileSync(
      `.preview/collarfront-${body}.html`,
      page(
        collars
          .filter((c) => c.gender === body)
          .map((c) =>
            tile(c.name.en, body, [under(c)], "fb-apricot-linen", 4.4, [300, 205], c.id, cutOf(c))
          ),
        300
      )
    );
  });
});

/**
 * The ten measured skin tones on both bodies, bare, under the six they replace.
 *
 * The old six are drawn the way they were drawn — the tone multiplied over the
 * photograph by an `feColorMatrix` — so the comparison is like for like. Whole
 * figure first, then the torso close up, where light and shadow are easiest to
 * lose. `npm run shoot -- .preview/skin-tones.html` makes it a PNG.
 */
const OLD_TONES: [string, string][] = [
  ["Fair", "#F5DCCB"],
  ["Light", "#E8C1A2"],
  ["Medium", "#D2A47F"],
  ["Tan", "#B07D5A"],
  ["Brown", "#85583F"],
  ["Deep", "#573A2E"],
];

describe("skin tones", () => {
  it("writes .preview/skin-tones.html", () => {
    const TORSO: Record<BodyType, [number, number]> = { female: [300, 300], male: [300, 330] };
    const swatch = (color: string) => <i style={{ background: color }} />;

    /** A bare body tinted the old way: the tone times the photograph. */
    const before = (body: BodyType, [name, color]: [string, string], zoom: number, key: string) => {
      const [r, g, b] = hexToRgb(color);
      const frame = frameFor(zoom, zoom > 1 ? TORSO[body] : [300, 500]);
      return (
        <figure key={key}>
          <svg viewBox={frame.viewBox}>
            <filter id={key} colorInterpolationFilters="sRGB">
              <feColorMatrix type="matrix" values={`${r} 0 0 0 0  0 ${g} 0 0 0  0 0 ${b} 0 0  0 0 0 1 0`} />
            </filter>
            <image href={bodyById(body).view.front} x="0" y="0" width="600" height="1000" filter={`url(#${key})`} />
          </svg>
          <figcaption>{swatch(color)}{name} · {color}</figcaption>
        </figure>
      );
    };
    const now = (body: BodyType, tone: (typeof skinTones)[number], zoom: number, key: string) => {
      const outfit: Outfit = { bodyType: body, skinTone: tone.id, direction: 0, worn: [] };
      return (
        <figure key={key}>
          <MannequinStage outfit={outfit} fabrics={{}} zoom={zoom} focus={zoom > 1 ? TORSO[body] : [300, 500]} />
          <figcaption>{swatch(tone.color)}{tone.label.en} · {itaClass(tone.lab)} · {tone.color}</figcaption>
        </figure>
      );
    };
    const row = (title: string, tiles: React.ReactNode[]) => (
      <section>
        <h3>{title}</h3>
        <div className="row">{tiles}</div>
      </section>
    );
    const sheet = (zoom: number) =>
      (["female", "male"] as const).flatMap((body) => [
        row(`Before — six tones, multiplied over the photograph — ${body}`,
          OLD_TONES.map((t, i) => before(body, t, zoom, `old-${body}-${zoom}-${i}`))),
      ]).concat(
        (["female", "male"] as const).map((body) =>
          row(`Now — ten measured tones — ${body}`, skinTones.map((t, i) => now(body, t, zoom, `new-${body}-${zoom}-${i}`))))
      );
    const table = (
      <table>
        <thead>
          <tr><th>tone</th><th>L*</th><th>a*</th><th>b*</th><th>C*</th><th>hue</th><th>ITA</th><th>class</th><th>ΔE00 to previous</th><th>sRGB</th></tr>
        </thead>
        <tbody>
          {skinTones.map((t, i) => (
            <tr key={t.id}>
              <td>{swatch(t.color)}{t.label.en}</td>
              {[t.lab[0], t.lab[1], t.lab[2], chroma(t.lab), hue(t.lab), ita(t.lab)].map((v, k) => <td key={k}>{v.toFixed(1)}</td>)}
              <td>{itaClass(t.lab)}</td>
              <td>{i ? ciede2000(skinTones[i - 1].lab, t.lab).toFixed(2) : "—"}</td>
              <td>{t.color}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
    const html = renderToStaticMarkup(
      <>
        <h2>Whole figure</h2>
        {sheet(1)}
        <h2>Torso, close up</h2>
        {sheet(2.6)}
        <h2>The ten tones</h2>
        {table}
      </>
    );
    const css =
      "<style>body{margin:0;padding:16px 18px;background:#efeae4;font:12px system-ui;color:#333}" +
      "h1{font-size:15px;margin:0 0 4px}h2{font-size:14px;margin:18px 0 4px}h3{font-size:12px;margin:10px 0 5px;color:#555;font-weight:600}" +
      "p{margin:0;color:#666;max-width:1500px}.row{display:flex;gap:8px}figure{margin:0;width:140px}" +
      "svg{width:140px;height:283px;display:block;background:#fff;border-radius:8px}" +
      "figcaption{margin-top:4px;display:flex;align-items:center;gap:5px;font-size:10.5px;white-space:nowrap}" +
      "i{width:12px;height:12px;border-radius:50%;display:inline-block;border:1px solid #0002;flex:none;margin-right:4px;vertical-align:-2px}" +
      "table{border-collapse:collapse;margin-top:6px;background:#fff}td,th{padding:3px 9px;border-bottom:1px solid #eee;text-align:right}" +
      "td:first-child,th:first-child{text-align:left}</style>";
    const head =
      '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css +
      "<h1>Skin tones — measured skin against the six they replace</h1>" +
      "<p>Ten tones evenly spaced in L* across real skin measured by spectrophotometer (Lu, Xiao, Li &amp; Pointer 2026, " +
      "Skin Res Technol, doi:10.1111/srt.70343), covering every ITA class. Each is a tint over the one photograph " +
      "(mannequin/skinTint.ts): the photograph's median renders as the measured colour, and shadows turn slightly redder.</p>";
    writeFileSync(".preview/skin-tones.html", head + html);
  });
});

/**
 * Every garment on its own mannequin, for judging against references: the
 * whole figure and a close-up of the garment, in a plain cloth that hides
 * nothing. A jacket is shown over a top in a second cloth, so where one ends
 * and the other begins can be seen. `npm run shoot -- .preview/wardrobe/*.html`.
 */
describe("the wardrobe, one garment at a time", () => {
  const UNDER: Record<string, string> = {
    "female-jacket": "female-blouse",
    "male-jacket": "male-shirt",
  };
  /*
    Each garment twice: in a plain cloth, which shows the shape and the folds,
    and in a plaid, which shows the print is still at its true size under them
    — a fold that bent or scaled the checks would show at once.
  */
  it.each(garments.flatMap((g) => [[g.id, "fb-apricot-linen", ""], [g.id, "fb-indigo-plaid", "-print"]]))(
    "writes .preview/wardrobe/%s (%s)",
    (id, clothId, suffix) => {
    mkdirSync(".preview/wardrobe", { recursive: true });
    const g = garmentById(id)!;
    const cloth = f(clothId);
    const second = f("fb-rose-silk");
    let worn: WornGarment[] = [];
    const by: Record<string, Partial<Record<FabricRegionId, Fabric>>> = {};
    const dress = (gid: string, fabric: Fabric) => {
      const piece = garmentById(gid)!;
      worn = wear(worn, cutFrom(piece, fabric.id));
      const regions: Partial<Record<FabricRegionId, Fabric>> = { collar: fabric };
      for (const r of piece.fabricRegions) regions[r] = fabric;
      by[gid] = regions;
    };
    if (UNDER[id]) dress(UNDER[id], second);
    dress(id, cloth);
    const outfit: Outfit = { bodyType: g.gender, skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
    const mine = worn.find((w) => w.garmentId === id)!;
    const focus = focusOf(g, mine, g.fabricRegions[0]) ?? [300, 400];
    const html = renderToStaticMarkup(
      <div className="row">
        <figure>
          <MannequinStage outfit={outfit} fabrics={by} zoom={1} focus={[300, 500]} />
          <figcaption>{g.name.en} — whole figure</figcaption>
        </figure>
        <figure>
          <MannequinStage outfit={outfit} fabrics={by} zoom={2.2} focus={[focus[0], focus[1]]} />
          <figcaption>close-up at {focus.join(", ")}, 2.2×</figcaption>
        </figure>
      </div>
    );
    const css =
      "<style>body{margin:0;padding:14px;background:#efeae4;font:12px system-ui}" +
      ".row{display:flex;gap:12px}figure{margin:0}svg{width:400px;height:808px;display:block;" +
      "background:#fff;border-radius:10px}figcaption{margin-top:5px;color:#555}</style>";
    writeFileSync(
      `.preview/wardrobe/${id}${suffix}.html`,
      '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + html
    );
  });
});

/**
 * Checkpoint sheets — what a reviewer asks to see for one change: the thobe
 * whole, at the collar and at the sleeve; the shirt collar on every garment it
 * is offered on, beside the mandarin; and each sleeved top in a long sleeve.
 * Written into `.preview/wardrobe/` so `compare-preview.mjs` pairs them.
 */
describe("checkpoint sheets", () => {
  it("writes .preview/wardrobe/check-thobe.html", () => {
    writeFileSync(
      ".preview/wardrobe/check-thobe.html",
      page(
        [
          tile("thobe — whole", "male", ["male-thobe"], "fb-apricot-linen", 1, [300, 500], "male-shirt-collar"),
          tile("thobe — neck and collar", "male", ["male-thobe"], "fb-apricot-linen", 6, [300, 178], "male-shirt-collar"),
          tile("thobe — sleeve", "male", ["male-thobe"], "fb-apricot-linen", 2.6, [205, 390], "male-shirt-collar"),
        ],
        380
      )
    );
  });

  it("writes .preview/wardrobe/check-collar.html", () => {
    writeFileSync(
      ".preview/wardrobe/check-collar.html",
      page(
        [
          tile("thobe — shirt collar", "male", ["male-thobe"], "fb-apricot-linen", 5, [300, 182], "male-shirt-collar"),
          tile("thobe — mandarin", "male", ["male-thobe"], "fb-apricot-linen", 5, [300, 182], "male-mandarin-collar"),
          tile("shirt — shirt collar", "male", ["male-shirt"], "fb-apricot-linen", 5, [300, 182], "male-shirt-collar"),
          tile("polo — shirt collar", "male", ["male-polo"], "fb-apricot-linen", 5, [300, 182], "male-shirt-collar"),
          tile("shirt — whole", "male", ["male-shirt"], "fb-apricot-linen", 1.6, [300, 330], "male-shirt-collar"),
          tile("polo — whole", "male", ["male-polo"], "fb-apricot-linen", 1.6, [300, 330], "male-shirt-collar"),
        ],
        300
      )
    );
  });

  it.each(["female", "male"] as const)("writes .preview/wardrobe/check-sleeves-%s.html", (body) => {
    const tops = body === "female"
      ? ["female-t-shirt", "female-blouse", "female-dress"]
      : ["male-t-shirt", "male-shirt", "male-polo", "male-thobe"];
    const long: SleeveChoice = { type: "set-in", length: "long" };
    writeFileSync(
      `.preview/wardrobe/check-sleeves-${body}.html`,
      page(
        tops.flatMap((id) => [
          tile(`${id} — long sleeve`, body, [id], "fb-apricot-linen", 1.25, [300, 420], undefined, undefined, long),
          tile(`${id} — the sleeve`, body, [id], "fb-apricot-linen", 2.6, [body === "female" ? 214 : 205, 380], undefined, undefined, long),
        ]),
        260
      )
    );
  });
});

/**
 * The thobe, round 3: the sleeve from shoulder to cuff and the band and
 * placket, each at a size where they can be judged, beside the whole figure —
 * and the whole figure again in a plaid, so the print can be seen to keep its
 * size under the new shading.
 */
describe("thobe round 3", () => {
  const stage = (clothId: string, zoom: number, focus: [number, number]) => {
    const cloth = f(clothId);
    const g = garmentById("male-thobe")!;
    const worn = setCollar(wear([], cutFrom(g, cloth.id)), g.id, "male-regular-collar");
    const outfit: Outfit = { bodyType: "male", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
    return (
      <MannequinStage
        outfit={outfit}
        fabrics={{ [g.id]: { body: cloth, placket: cloth, collar: cloth } }}
        zoom={zoom}
        focus={focus}
      />
    );
  };
  const VIEWS: [name: string, label: string, clothId: string, zoom: number, focus: [number, number]][] = [
    ["whole", "whole", "fb-apricot-linen", 1, [300, 500]],
    ["sleeve", "sleeve, shoulder to cuff — 3×", "fb-apricot-linen", 3, [192, 342]],
    ["collar", "band and placket — 4×", "fb-apricot-linen", 4, [300, 262]],
    ["print", "whole, in a plaid", "fb-indigo-plaid", 1, [300, 500]],
    /* a dark solid, against the navy and brown references */
    ["navy", "whole, in a dark solid", "fb-denim-classic", 1, [300, 500]],
    ["navy-sleeve", "sleeve in a dark solid — 3×", "fb-denim-classic", 3, [192, 342]],
  ];
  const write = (file: string, html: string, w: number) => {
    const css =
      "<style>body{margin:0;padding:14px;background:#efeae4;font:12px system-ui}" +
      ".row{display:flex;gap:12px}figure{margin:0}svg{width:" + w + "px;height:" + Math.round(w * 2.02) +
      "px;display:block;background:#fff;border-radius:10px}figcaption{margin-top:5px;color:#555}</style>";
    mkdirSync(".preview/wardrobe", { recursive: true });
    writeFileSync(file, '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + html);
  };

  it("writes .preview/wardrobe/thobe-r3.html", () => {
    write(
      ".preview/wardrobe/thobe-r3.html",
      renderToStaticMarkup(
        <div className="row">
          {VIEWS.map(([name, label, cloth, zoom, focus]) => (
            <figure key={name}>
              {stage(cloth, zoom, focus)}
              <figcaption>{label}</figcaption>
            </figure>
          ))}
        </div>
      ),
      330
    );
  });

  /* each view on its own and large, for a before/after pair per view */
  it.each(VIEWS.map((v) => [v[0], v] as const))("writes .preview/wardrobe/thobe-r3-%s.html", (name, view) => {
    const [, label, cloth, zoom, focus] = view;
    write(
      `.preview/wardrobe/thobe-r3-${name}.html`,
      renderToStaticMarkup(
        <figure>
          {stage(cloth, zoom, focus)}
          <figcaption>{label}</figcaption>
        </figure>
      ),
      480
    );
  });
});

/** The thobe's two cuffs side by side: whole, and the sleeve close up, in a light and a dark cloth. */
describe("thobe cuffs", () => {
  it("writes .preview/wardrobe/thobe-cuffs.html", () => {
    const g = garmentById("male-thobe")!;
    const stage = (cuff: "none" | "plain", clothId: string, zoom: number, focus: [number, number]) => {
      const cloth = f(clothId);
      let worn = setCollar(wear([], cutFrom(g, cloth.id)), g.id, "male-regular-collar");
      worn = setSleeve(worn, g.id, { type: "set-in", length: "long", cuff });
      const outfit: Outfit = { bodyType: "male", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
      return (
        <MannequinStage
          outfit={outfit}
          fabrics={{ [g.id]: { body: cloth, placket: cloth, collar: cloth } }}
          zoom={zoom}
          focus={focus}
        />
      );
    };
    const LABEL = { none: "No cuff — بدون كبك", plain: "Plain cuff — كبك سادة" } as const;
    const row = (clothId: string) => (
      <div className="row">
        {(["none", "plain"] as const).map((cuff) => (
          <figure key={`w-${cuff}`}>
            {stage(cuff, clothId, 1, [300, 500])}
            <figcaption>{LABEL[cuff]}</figcaption>
          </figure>
        ))}
        {(["none", "plain"] as const).map((cuff) => (
          <figure key={`s-${cuff}`}>
            {stage(cuff, clothId, 3, [192, 342])}
            <figcaption>{LABEL[cuff]}, sleeve 3×</figcaption>
          </figure>
        ))}
      </div>
    );
    const css =
      "<style>body{margin:0;padding:14px;background:#efeae4;font:13px system-ui}" +
      ".row{display:flex;gap:12px;margin-bottom:14px}figure{margin:0}svg{width:300px;height:606px;display:block;" +
      "background:#fff;border-radius:10px}figcaption{margin-top:5px;color:#555}</style>";
    writeFileSync(
      ".preview/wardrobe/thobe-cuffs.html",
      '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' +
        css + renderToStaticMarkup(<>{row("fb-apricot-linen")}{row("fb-denim-classic")}</>)
    );
  });
});

/**
 * The shared sleeve, garment by garment: the whole figure and its own sleeve
 * close up, then the three set-in family constructions at their longest — so
 * every top shows the sleeve it arrives in and the ones it can be recut to.
 * The dress adds its one-sleeved cut, which drafts its body from the left half.
 */
describe("the shared sleeve", () => {
  const SHEETS: [id: string, extra?: { label: string; neckline: string; sleeve: SleeveChoice }][] = [
    ["male-thobe"],
    ["male-shirt"],
    ["male-t-shirt"],
    ["male-polo"],
    ["female-blouse"],
    ["female-t-shirt"],
    ["female-dress", { label: "asymmetrical, long set-in", neckline: "female-asymmetrical-neckline", sleeve: { type: "set-in", length: "long" } }],
  ];
  it.each(SHEETS.map(([id, extra]) => [id, extra] as const))("writes .preview/wardrobe/sleeves-%s.html", (id, extra) => {
    const g = garmentById(id)!;
    const body = g.gender;
    const d = draft(body);
    const y = (d.shoulderPointY + d.wristY + 12) / 2;
    const focus: [number, number] = [(d.armOutAt(y, 0) + d.armInAt(y, 0)) / 2 + 8, y];
    const cloth = f("fb-apricot-linen");
    const stage = (zoom: number, at: [number, number], sleeve?: SleeveChoice, neckline?: string) => {
      let worn = wear([], cutFrom(g, cloth.id));
      if (neckline) worn = setNeckline(worn, g.id, neckline);
      if (sleeve) worn = setSleeve(worn, g.id, sleeve);
      const regions: Partial<Record<FabricRegionId, Fabric>> = { collar: cloth };
      for (const r of g.fabricRegions) regions[r] = cloth;
      const outfit: Outfit = { bodyType: body, skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
      return <MannequinStage outfit={outfit} fabrics={{ [g.id]: regions }} zoom={zoom} focus={at} />;
    };
    const fig = (key: string, label: string, node: React.ReactNode) => (
      <figure key={key}>
        {node}
        <figcaption>{label}</figcaption>
      </figure>
    );
    const long = (type: "set-in" | "drop" | "raglan"): SleeveChoice => ({ type, length: "long" });
    const html = renderToStaticMarkup(
      <>
        <div className="row">
          {fig("whole", `${g.name.en} — whole, as it arrives`, stage(1, [300, 500]))}
          {fig("own", "its sleeve, 3×", stage(3, focus))}
          {extra && fig("extra", `${extra.label}`, stage(1, [300, 500], extra.sleeve, extra.neckline))}
        </div>
        <div className="row">
          {(["set-in", "drop", "raglan"] as const).map((type) => fig(type, `${type} long, 3×`, stage(3, focus, long(type))))}
        </div>
        {/* a garment that offers cuffs: each long sleeve again, without one */}
        {g.sleeves?.cuffs && (
          <div className="row">
            {(["set-in", "drop", "raglan"] as const).map((type) =>
              fig(`${type}-none`, `${type} long, no cuff, 3×`, stage(3, focus, { ...long(type), cuff: "none" }))
            )}
          </div>
        )}
      </>
    );
    const css =
      "<style>body{margin:0;padding:14px;background:#efeae4;font:12px system-ui}" +
      ".row{display:flex;gap:12px;margin-bottom:12px}figure{margin:0}svg{width:240px;height:485px;display:block;" +
      "background:#fff;border-radius:10px}figcaption{margin-top:5px;color:#555}</style>";
    writeFileSync(
      `.preview/wardrobe/sleeves-${id}.html`,
      '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + html
    );
  });
});

/** The jackets' sleeves, whole and close up — for the jacket step, not changed here. */
describe("jacket sleeves", () => {
  it("writes .preview/wardrobe/sleeves-jackets.html", () => {
    const tiles = (["male", "female"] as const).flatMap((body) => {
      const d = draft(body);
      const y = (d.shoulderPointY + d.wristY + 12) / 2;
      const focus: [number, number] = [(d.armOutAt(y, 0) + d.armInAt(y, 0)) / 2 + 8, y];
      const under = body === "male" ? "male-shirt" : "female-blouse";
      return [
        tile(`${body} jacket — whole`, body, [under, `${body}-jacket`], "fb-apricot-linen", 1, [300, 500]),
        tile(`${body} jacket — sleeve 3×`, body, [under, `${body}-jacket`], "fb-apricot-linen", 3, focus),
      ];
    });
    writeFileSync(".preview/wardrobe/sleeves-jackets.html", page(tiles, 300));
  });
});

/**
 * Each jacket over every top it can be worn over: the whole figure, and the
 * sleeve from shoulder to cuff — where an inner sleeve would show if it could.
 */
describe("jacket outfits", () => {
  const INNER: [body: BodyType, ids: string[]][] = [
    ["male", ["male-shirt", "male-t-shirt", "male-polo", "male-thobe"]],
    ["female", ["female-blouse", "female-t-shirt", "female-dress"]],
  ];
  it.each(INNER.flatMap(([body, ids]) => ids.map((id) => [id, body] as const)))(
    "writes .preview/wardrobe/jacket-over-%s.html",
    (id, body) => {
      const d = draft(body);
      const y = (d.shoulderPointY + d.wristY + 12) / 2;
      const focus: [number, number] = [(d.armOutAt(y, 0) + d.armInAt(y, 0)) / 2 + 2, y];
      const outer = `${body}-jacket`;
      const inner = f("fb-rose-silk");
      const cloth = f("fb-apricot-linen");
      const stage = (zoom: number, at: [number, number]) => {
        let worn: WornGarment[] = [];
        const by: Record<string, Partial<Record<FabricRegionId, Fabric>>> = {};
        for (const [gid, fabric] of [[id, inner], [outer, cloth]] as const) {
          const g = garmentById(gid)!;
          worn = wear(worn, cutFrom(g, fabric.id));
          const regions: Partial<Record<FabricRegionId, Fabric>> = { collar: fabric };
          for (const r of g.fabricRegions) regions[r] = fabric;
          by[gid] = regions;
        }
        const outfit: Outfit = { bodyType: body, skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
        return <MannequinStage outfit={outfit} fabrics={by} zoom={zoom} focus={at} />;
      };
      const name = garmentById(id)!.name.en;
      const html = renderToStaticMarkup(
        <div className="row">
          <figure>
            {stage(1, [300, 500])}
            <figcaption>jacket over {name} — whole</figcaption>
          </figure>
          <figure>
            {stage(3, focus)}
            <figcaption>the sleeve, shoulder to cuff, 3×</figcaption>
          </figure>
        </div>
      );
      const css =
        "<style>body{margin:0;padding:14px;background:#efeae4;font:12px system-ui}" +
        ".row{display:flex;gap:12px}figure{margin:0}svg{width:300px;height:606px;display:block;" +
        "background:#fff;border-radius:10px}figcaption{margin-top:5px;color:#555}</style>";
      writeFileSync(
        `.preview/wardrobe/jacket-over-${id}.html`,
        '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + html
      );
    }
  );
});

/** The thobe's shorter sleeves, whole and close up. */
describe("thobe short sleeves", () => {
  it("writes .preview/wardrobe/thobe-short-elbow.html", () => {
    const d = draft("male");
    const focus: [number, number] = [(d.armOutAt(330, 0) + d.armInAt(330, 0)) / 2 + 8, 330];
    const tiles = (["short", "elbow"] as const).flatMap((length) => {
      const sleeve: SleeveChoice = { type: "set-in", length };
      return [
        tile(`thobe, ${length} sleeve — whole`, "male", ["male-thobe"], "fb-apricot-linen", 1, [300, 500], "male-regular-collar", undefined, sleeve),
        tile(`thobe, ${length} sleeve — 3×`, "male", ["male-thobe"], "fb-apricot-linen", 3, focus, "male-regular-collar", undefined, sleeve),
      ];
    });
    writeFileSync(".preview/wardrobe/thobe-short-elbow.html", page(tiles, 300));
  });
});

/**
 * Round 2's folds, garment by garment: each in a full outfit, in a plain cloth
 * and in the plaid — the plaid shows the print keeps its true size under the
 * folds — whole and close up. The other pieces are in a second cloth, so where
 * this one ends can be seen.
 */
describe("body folds", () => {
  const SHEETS: [id: string, body: BodyType, outfit: string[], focus: [number, number], zoom: number][] = [
    ["female-skirt", "female", ["female-blouse", "female-skirt"], [300, 560], 2],
    ["female-t-shirt", "female", ["female-t-shirt", "female-trousers"], [300, 320], 2.2],
    ["male-t-shirt", "male", ["male-t-shirt", "male-trousers"], [300, 350], 2.2],
    ["male-polo", "male", ["male-polo", "male-trousers"], [300, 350], 2.2],
    ["male-shirt", "male", ["male-shirt", "male-trousers"], [300, 380], 2],
    ["female-blouse", "female", ["female-blouse", "female-trousers"], [300, 340], 2],
    ["male-trousers", "male", ["male-shirt", "male-trousers"], [300, 690], 1.8],
    ["female-trousers", "female", ["female-t-shirt", "female-trousers"], [300, 660], 1.8],
    ["male-jacket", "male", ["male-shirt", "male-trousers", "male-jacket"], [300, 360], 2],
    ["female-jacket", "female", ["female-blouse", "female-skirt", "female-jacket"], [300, 340], 2],
  ];
  it.each(SHEETS.map((s) => [s[0], s] as const))("writes .preview/wardrobe/folds-%s.html", (id, sheet) => {
    const [, body, ids, focus, zoom] = sheet;
    const other = f("fb-rose-silk");
    const stage = (clothId: string, z: number, at: [number, number], only?: string[]) => {
      const cloth = f(clothId);
      let worn: WornGarment[] = [];
      const by: Record<string, Partial<Record<FabricRegionId, Fabric>>> = {};
      for (const gid of only ?? ids) {
        const g = garmentById(gid)!;
        const fabric = gid === id ? cloth : other;
        worn = wear(worn, cutFrom(g, fabric.id));
        const regions: Partial<Record<FabricRegionId, Fabric>> = { collar: fabric };
        for (const r of g.fabricRegions) regions[r] = fabric;
        by[gid] = regions;
      }
      const outfit: Outfit = { bodyType: body, skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
      return <MannequinStage outfit={outfit} fabrics={by} zoom={z} focus={at} />;
    };
    const name = garmentById(id)!.name.en;
    const row = (clothId: string, label: string) => (
      <div className="row">
        <figure>
          {stage(clothId, 1, [300, 500])}
          <figcaption>{name}, {label} — whole</figcaption>
        </figure>
        <figure>
          {stage(clothId, zoom, focus)}
          <figcaption>{label}, {zoom}×</figcaption>
        </figure>
        {/* a skirt under a top hides its band: on its own, so the darts can be seen */}
        {id === "female-skirt" && (
          <figure>
            {stage(clothId, 3, [300, 420], [id])}
            <figcaption>{label}, on its own at the waist, 3×</figcaption>
          </figure>
        )}
      </div>
    );
    const css =
      "<style>body{margin:0;padding:14px;background:#efeae4;font:12px system-ui}" +
      ".row{display:flex;gap:12px;margin-bottom:12px}figure{margin:0}svg{width:280px;height:566px;display:block;" +
      "background:#fff;border-radius:10px}figcaption{margin-top:5px;color:#555}</style>";
    writeFileSync(
      `.preview/wardrobe/folds-${id}.html`,
      '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css +
        renderToStaticMarkup(<>{row("fb-apricot-linen", "plain")}{row("fb-indigo-plaid", "plaid")}</>)
    );
  });
});

/**
 * Each jacket over every bottom and full-length garment, whole and at the
 * jacket's hem — where a skirt or a thobe comes out from under it.
 */
describe("under the jacket's hem", () => {
  const OUTFITS: [name: string, body: BodyType, ids: string[], inner: string][] = [
    ["female-skirt", "female", ["female-blouse", "female-skirt", "female-jacket"], "female-skirt"],
    ["female-dress", "female", ["female-dress", "female-jacket"], "female-dress"],
    ["female-trousers", "female", ["female-blouse", "female-trousers", "female-jacket"], "female-trousers"],
    ["male-trousers", "male", ["male-shirt", "male-trousers", "male-jacket"], "male-trousers"],
    ["male-thobe", "male", ["male-thobe", "male-jacket"], "male-thobe"],
  ];
  it.each(OUTFITS.map((o) => [o[0], o] as const))("writes .preview/wardrobe/hem-%s.html", (name, o) => {
    const [, body, ids, inner] = o;
    const hemY = body === "male" ? 539 : 513;
    const stage = (z: number, at: [number, number]) => {
      let worn: WornGarment[] = [];
      const by: Record<string, Partial<Record<FabricRegionId, Fabric>>> = {};
      for (const gid of ids) {
        const g = garmentById(gid)!;
        const fabric = f(gid === inner ? "fb-indigo-plaid" : g.layer === "outer" ? "fb-apricot-linen" : "fb-rose-silk");
        worn = wear(worn, cutFrom(g, fabric.id));
        const regions: Partial<Record<FabricRegionId, Fabric>> = { collar: fabric };
        for (const r of g.fabricRegions) regions[r] = fabric;
        by[gid] = regions;
      }
      const outfit: Outfit = { bodyType: body, skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
      return <MannequinStage outfit={outfit} fabrics={by} zoom={z} focus={at} />;
    };
    const html = renderToStaticMarkup(
      <div className="row">
        <figure>
          {stage(1, [300, 500])}
          <figcaption>{garmentById(inner)!.name.en} under the jacket — whole</figcaption>
        </figure>
        <figure>
          {stage(3, [222, hemY + 20])}
          <figcaption>at the jacket's hem, 3×</figcaption>
        </figure>
      </div>
    );
    const css =
      "<style>body{margin:0;padding:14px;background:#efeae4;font:12px system-ui}" +
      ".row{display:flex;gap:12px}figure{margin:0}svg{width:300px;height:606px;display:block;" +
      "background:#fff;border-radius:10px}figcaption{margin-top:5px;color:#555}</style>";
    writeFileSync(
      `.preview/wardrobe/hem-${name}.html`,
      '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + html
    );
  });
});

/**
 * Round 3's cuffs, garment by garment: each cuff it offers on a long set-in
 * sleeve — whole, and the cuff close up — then its other long sleeves in the
 * cuff it arrives in.
 */
describe("cuffs", () => {
  const SHEETS: [id: string, cuffs: string[], others: SleeveChoice["type"][]][] = [
    ["male-shirt", ["none", "plain", "formal", "french"], ["drop", "raglan"]],
    ["male-thobe", ["none", "plain", "formal", "french"], ["drop", "raglan"]],
    ["female-blouse", ["none", "plain", "formal", "french"], ["drop", "raglan", "dolman"]],
    ["female-dress", ["none", "plain", "formal", "french"], ["drop", "raglan", "dolman"]],
    ["male-t-shirt", ["none", "rib"], ["drop", "raglan"]],
    ["female-t-shirt", ["none", "rib"], ["drop", "raglan", "dolman"]],
    ["male-polo", ["none", "rib"], ["drop", "raglan"]],
  ];
  it.each(SHEETS.map((s) => [s[0], s] as const))("writes .preview/wardrobe/cuffs-%s.html", (id, sheet) => {
    const [, cuffs, others] = sheet;
    const g = garmentById(id)!;
    const body = g.gender;
    const d = draft(body);
    const at: [number, number] = [(d.armOutAt(d.wristY, 0) + d.armInAt(d.wristY, 0)) / 2 + 4, d.wristY - 8];
    const cloth = f("fb-apricot-linen");
    const stage = (zoom: number, focus: [number, number], sleeve: SleeveChoice) => {
      let worn = setSleeve(wear([], cutFrom(g, cloth.id)), g.id, sleeve);
      if (id === "male-thobe") worn = setCollar(worn, g.id, "male-regular-collar");
      const regions: Partial<Record<FabricRegionId, Fabric>> = { collar: cloth };
      for (const r of g.fabricRegions) regions[r] = cloth;
      const outfit: Outfit = { bodyType: body, skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
      return <MannequinStage outfit={outfit} fabrics={{ [g.id]: regions }} zoom={zoom} focus={focus} />;
    };
    const long = (type: SleeveChoice["type"], cuff?: string): SleeveChoice =>
      ({ type, length: "long", ...(cuff ? { cuff } : {}) }) as SleeveChoice;
    const fig = (key: string, label: string, node: React.ReactNode) => (
      <figure key={key}>
        {node}
        <figcaption>{label}</figcaption>
      </figure>
    );
    const html = renderToStaticMarkup(
      <>
        <div className="row">{cuffs.map((c) => fig(`w-${c}`, `${c} — whole`, stage(1, [300, 500], long("set-in", c))))}</div>
        <div className="row">{cuffs.map((c) => fig(`c-${c}`, `${c} — the cuff, 4×`, stage(4, at, long("set-in", c))))}</div>
        <div className="row">{others.map((t) => fig(`o-${t}`, `${t} long, as it arrives — 4×`, stage(4, at, long(t))))}</div>
      </>
    );
    const css =
      "<style>body{margin:0;padding:14px;background:#efeae4;font:12px system-ui}" +
      ".row{display:flex;gap:12px;margin-bottom:12px}figure{margin:0}svg{width:220px;height:444px;display:block;" +
      "background:#fff;border-radius:10px}figcaption{margin-top:5px;color:#555}</style>";
    writeFileSync(
      `.preview/wardrobe/cuffs-${id}.html`,
      '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + html
    );
  });
});

/**
 * The fixes before the trousers step, each in light and in dark mode: her
 * shirt collar on everything that wears it, the polo's collar and sleeves,
 * both trousers on their own and in an outfit, and the dolman's cuff.
 */
describe("fixes, light and dark", () => {
  type Tile = { label: string; body: BodyType; ids: string[]; zoom: number; at: [number, number]; collar?: string; neckline?: string; sleeve?: SleeveChoice; cloth?: string };
  const SHEETS: [name: string, tiles: Tile[]][] = [
    ["collar", (["female-t-shirt", "female-blouse", "female-dress"] as const).flatMap((id) => [
      /* the dress takes a standing collar on a high neckline only, so it is cut to one first */
      { label: `${id} — whole`, body: "female" as const, ids: [id], zoom: 1, at: [300, 500] as [number, number], collar: "female-shirt-collar", ...(id === "female-dress" ? { neckline: "female-high-neckline" } : {}) },
      { label: `${id} — the collar, 5×`, body: "female" as const, ids: [id], zoom: 5, at: [300, 196] as [number, number], collar: "female-shirt-collar", ...(id === "female-dress" ? { neckline: "female-high-neckline" } : {}) },
    ])],
    /* his shirt collar, on the garments that wear it by default */
    ["collar-male", (["male-shirt", "male-thobe"] as const).flatMap((id) => [
      { label: `${id} — whole`, body: "male" as const, ids: [id], zoom: 1, at: [300, 500] as [number, number], collar: "male-shirt-collar" },
      { label: `${id} — the collar, 5×`, body: "male" as const, ids: [id], zoom: 5, at: [300, 186] as [number, number], collar: "male-shirt-collar" },
    ])],
    ["polo", [
      { label: "polo — whole", body: "male", ids: ["male-polo"], zoom: 1, at: [300, 500] },
      { label: "the collar, 5×", body: "male", ids: ["male-polo"], zoom: 5, at: [300, 196] },
      { label: "the sleeve, 4×", body: "male", ids: ["male-polo"], zoom: 4, at: [196, 300] },
      { label: "long, rib cuff — whole", body: "male", ids: ["male-polo"], zoom: 1, at: [300, 500], sleeve: { type: "set-in", length: "long" } },
    ]],
    /* the armband on every short sleeve the polo offers */
    ["polo-armbands", (["set-in", "drop", "raglan", "kimono"] as const).map((type) => ({
      label: `${type} short — the sleeve, 4×`,
      body: "male" as const,
      ids: ["male-polo"],
      zoom: 4,
      at: [196, 300] as [number, number],
      sleeve: { type, length: "short" as const, cuff: "rib" as const },
    }))],
    ...(["male", "female"] as const).map((body): [string, Tile[]] => [`trousers-${body}`, [
      { label: "on their own — whole", body, ids: [`${body}-trousers`], zoom: 1, at: [300, 500] },
      { label: "on their own — knee to hem, 2.4×", body, ids: [`${body}-trousers`], zoom: 2.4, at: [300, 790] },
      { label: "in an outfit — whole", body, ids: [`${body}-t-shirt`, `${body}-trousers`], zoom: 1, at: [300, 500] },
      { label: "in an outfit — waist and thigh, 2.4×", body, ids: [`${body}-t-shirt`, `${body}-trousers`], zoom: 2.4, at: [300, 520] },
    ]]),
    /* the cowl, and the off-shoulder at each length: whole, the neckline, and the arm, plain and print */
    ...([
      ["cowl", "female-cowl-neckline", undefined],
      ["off-shoulder-short", "female-off-shoulder-neckline", { type: "off-shoulder", length: "short" }],
      ["off-shoulder-elbow", "female-off-shoulder-neckline", { type: "off-shoulder", length: "elbow" }],
      ["off-shoulder-three-quarter", "female-off-shoulder-neckline", { type: "off-shoulder", length: "three-quarter" }],
      ["off-shoulder-long", "female-off-shoulder-neckline", { type: "off-shoulder", length: "long", cuff: "none" }],
      ["off-shoulder-long-cuffed", "female-off-shoulder-neckline", { type: "off-shoulder", length: "long", cuff: "formal" }],
    ] as [string, string, SleeveChoice | undefined][]).map(([name, neckline, sleeve]): [string, Tile[]] => [
      name,
      (["fb-apricot-linen", "fb-midnight-floral"] as const).flatMap((cloth) => {
        const kind = cloth === "fb-apricot-linen" ? "plain" : "print";
        const base = { body: "female" as const, ids: ["female-dress"], neckline, cloth, ...(sleeve ? { sleeve } : {}) };
        return [
          { ...base, label: `${name}, ${kind} — whole`, zoom: 1, at: [300, 500] as [number, number] },
          { ...base, label: `${name}, ${kind} — the neckline, 2.8×`, zoom: 2.8, at: [300, 250] as [number, number] },
          ...(sleeve && sleeve.length !== "short"
            ? [{ ...base, label: `${name}, ${kind} — the arm, 1.8×`, zoom: 1.8, at: [212, 390] as [number, number] }]
            : []),
        ];
      }),
    ]),
    /* cloth lying on cloth: a top's hem on the trousers, and the collared cut's placket on its bodice */
    ["cloth-on-cloth", [
      { label: "shirt over trousers — whole", body: "male", ids: ["male-shirt", "male-trousers"], zoom: 1, at: [300, 500] },
      { label: "the shirt's hem, 3×", body: "male", ids: ["male-shirt", "male-trousers"], zoom: 3, at: [300, 470] },
      { label: "blouse over trousers — whole", body: "female", ids: ["female-blouse", "female-trousers"], zoom: 1, at: [300, 500] },
      { label: "the blouse's hem, 3×", body: "female", ids: ["female-blouse", "female-trousers"], zoom: 3, at: [300, 450] },
      { label: "collared — whole", body: "female", ids: ["female-dress"], zoom: 1, at: [300, 500], neckline: "female-collared-neckline" },
      { label: "the placket, 4×", body: "female", ids: ["female-dress"], zoom: 4, at: [300, 215], neckline: "female-collared-neckline" },
    ]],
    /*
      The off-shoulder in every sleeve type and length it is to offer — whole,
      and the shoulder and underarm close up, plain and print. Typed out rather
      than asked of the picker, so the same tiles render before the types exist.
    */
    ["off-shoulder-sleeves", ([
      ["off-shoulder", "short"],
      ["off-shoulder", "elbow"],
      ["off-shoulder", "three-quarter"],
      ["off-shoulder", "long", "none"],
      ["off-shoulder", "long", "formal"],
      ["puff", "short"],
      ["puff", "elbow"],
      ["bishop", "three-quarter"],
      ["bishop", "long"],
      ["bell", "elbow"],
      ["bell", "three-quarter"],
      ["bell", "long"],
      ["flutter", "short"],
    ] as [SleeveChoice["type"], SleeveChoice["length"], SleeveChoice["cuff"]?][]).flatMap(([type, length, cuff]) =>
      (["fb-apricot-linen", "fb-midnight-floral"] as const).flatMap((cloth) => {
        const kind = cloth === "fb-apricot-linen" ? "plain" : "print";
        const name = `${type === "off-shoulder" ? "fitted" : type} ${length}${cuff ? ` ${cuff} cuff` : ""}`;
        const base = {
          body: "female" as const,
          ids: ["female-dress"],
          neckline: "female-off-shoulder-neckline",
          cloth,
          sleeve: { type, length, ...(cuff ? { cuff } : {}) },
        };
        return [
          { ...base, label: `${name}, ${kind} — whole`, zoom: 1, at: [300, 500] as [number, number] },
          { ...base, label: `${name}, ${kind} — shoulder and underarm, 3.2×`, zoom: 3.2, at: [226, 268] as [number, number] },
        ];
      })
    )],
    /* the off-shoulder's fitted sleeve at every length past the band, and its puff at both: whole, and the shoulder close up */
    ["off-shoulder-fit-puff", ([
      ["off-shoulder", "elbow"],
      ["off-shoulder", "three-quarter"],
      ["off-shoulder", "long", "none"],
      ["off-shoulder", "long", "formal"],
      ["puff", "short"],
      ["puff", "elbow"],
    ] as [SleeveChoice["type"], SleeveChoice["length"], SleeveChoice["cuff"]?][]).flatMap(([type, length, cuff]) =>
      (["fb-apricot-linen", "fb-midnight-floral"] as const).flatMap((cloth) => {
        const kind = cloth === "fb-apricot-linen" ? "plain" : "print";
        const name = `${type === "off-shoulder" ? "fitted" : type} ${length}${cuff ? ` ${cuff} cuff` : ""}`;
        const base = {
          body: "female" as const,
          ids: ["female-dress"],
          neckline: "female-off-shoulder-neckline",
          cloth,
          sleeve: { type, length, ...(cuff ? { cuff } : {}) },
        };
        return [
          { ...base, label: `${name}, ${kind} — whole`, zoom: 1, at: [300, 500] as [number, number] },
          { ...base, label: `${name}, ${kind} — the shoulder, 3.2×`, zoom: 3.2, at: [222, 268] as [number, number] },
        ];
      })
    )],
    /* her puff on the other garments that offer it, at both lengths */
    ["puff", (["female-t-shirt", "female-blouse", "female-dress"] as const).flatMap((id) =>
      (["short", "elbow"] as const).flatMap((length) =>
        (["fb-apricot-linen", "fb-midnight-floral"] as const).flatMap((cloth) => {
          const kind = cloth === "fb-apricot-linen" ? "plain" : "print";
          const base = { body: "female" as const, ids: [id], cloth, sleeve: { type: "puff" as const, length } };
          return [
            { ...base, label: `${id.slice(7)}, puff ${length}, ${kind} — whole`, zoom: 1, at: [300, 500] as [number, number] },
            { ...base, label: `${id.slice(7)}, puff ${length}, ${kind} — the shoulder, 3.2×`, zoom: 3.2, at: [222, 262] as [number, number] },
          ];
        })
      )
    )],
    /* her puff on the dress's other cuts: hung from the off-shoulder's band, and the one sleeve of the asymmetrical */
    ["puff-dress-cuts", (["female-off-shoulder-neckline", "female-asymmetrical-neckline"] as const).flatMap((neckline) =>
      (["short", "elbow"] as const).flatMap((length) =>
        (["fb-apricot-linen", "fb-midnight-floral"] as const).flatMap((cloth) => {
          const kind = cloth === "fb-apricot-linen" ? "plain" : "print";
          const cut = neckline.replace(/^female-/, "").replace(/-neckline$/, "");
          const base = { body: "female" as const, ids: ["female-dress"], neckline, cloth, sleeve: { type: "puff" as const, length } };
          return [
            { ...base, label: `dress, ${cut}, puff ${length}, ${kind} — whole`, zoom: 1, at: [300, 500] as [number, number] },
            { ...base, label: `dress, ${cut}, puff ${length}, ${kind} — the shoulder, 3.2×`, zoom: 3.2, at: [222, 268] as [number, number] },
          ];
        })
      )
    )],
    /*
      Every collar on every cut of the dress that offers it — whole, and the
      collar close up, plain and print: the Peter Pan on the three round
      openings, the six standing collars on each of the three high ones, and
      the sailor on the V. Typed out, so the same tiles render before and after.
    */
    ...(([
      ["collars-peter-pan", (["round", "scoop", "boat"] as const).map((cut) => [cut, "peter-pan"] as const)],
      ...(["high", "keyhole", "collared"] as const).map(
        (cut) =>
          [
            `collars-${cut}`,
            (["shirt", "mandarin", "bow", "sailor", "ruffled", "turtleneck"] as const).map((collar) => [cut, collar] as const),
          ] as const
      ),
      ["collars-v", [["v", "sailor"]] as const],
    ] as const) as unknown as [string, (readonly [string, string])[]][]).map(([name, pairs]): [string, Tile[]] => [
      name,
      pairs.flatMap(([cut, collar]) =>
        (["fb-apricot-linen", "fb-midnight-floral"] as const).flatMap((cloth) => {
          const kind = cloth === "fb-apricot-linen" ? "plain" : "print";
          const base = {
            body: "female" as const,
            ids: ["female-dress"],
            neckline: `female-${cut}-neckline`,
            collar: `female-${collar}-collar`,
            cloth,
          };
          return [
            { ...base, label: `${cut}, ${collar}, ${kind} — whole`, zoom: 1, at: [300, 500] as [number, number] },
            { ...base, label: `${cut}, ${collar}, ${kind} — the collar, 2.8×`, zoom: 2.8, at: [300, 250] as [number, number] },
          ];
        })
      ),
    ]),
    /*
      Round 2's cuts, each with every sleeve it offers — at the length the
      picker gives it first — whole and close up, plain and print: the
      sweetheart, which takes none; the square; the keyhole, with its closure
      close up; and the asymmetrical, with the retired one-shoulder look as it
      now opens. Typed out, so the same tiles render before and after.
    */
    ...(([
      ["r2-sweetheart", "sweetheart", [null]],
      ["r2-square", "square", [["set-in", "short"], ["drop", "short"], ["raglan", "short"], ["kimono", "short"], ["dolman", "three-quarter"], ["puff", "short"], ["bishop", "three-quarter"], ["bell", "elbow"], ["flutter", "short"], ["cap", "short"], ["set-in", "sleeveless"]]],
      ["r2-keyhole", "keyhole", [["set-in", "short"], ["drop", "short"], ["raglan", "short"], ["kimono", "short"], ["dolman", "three-quarter"], ["puff", "short"], ["bishop", "three-quarter"], ["bell", "elbow"], ["flutter", "short"], ["cap", "short"], ["set-in", "sleeveless"]]],
      ["r2-one-shoulder", "asymmetrical", [["set-in", "short"], ["puff", "short"], ["bishop", "three-quarter"], ["bell", "elbow"], ["flutter", "short"], ["set-in", "sleeveless"]]],
    ] as [string, string, ([SleeveChoice["type"], SleeveChoice["length"]] | null)[]][]).map(([name, cut, sleeves]): [string, Tile[]] => [
      name,
      [
        ...sleeves.flatMap((s) =>
          (["fb-apricot-linen", "fb-midnight-floral"] as const).flatMap((cloth) => {
            const kind = cloth === "fb-apricot-linen" ? "plain" : "print";
            const base = {
              body: "female" as const,
              ids: ["female-dress"],
              neckline: `female-${cut}-neckline`,
              cloth,
              ...(s ? { sleeve: { type: s[0], length: s[1] } } : {}),
            };
            const what = s ? `${s[0]} ${s[1]}` : "no sleeve";
            return [
              { ...base, label: `${cut}, ${what}, ${kind} — whole`, zoom: 1, at: [300, 500] as [number, number] },
              { ...base, label: `${cut}, ${what}, ${kind} — the neckline, 2.4×`, zoom: 2.4, at: [300, 250] as [number, number] },
            ];
          })
        ),
        /* the keyhole's closure, close up */
        ...(cut === "keyhole"
          ? (["fb-apricot-linen", "fb-midnight-floral"] as const).map((cloth) => ({
              body: "female" as const,
              ids: ["female-dress"],
              neckline: "female-keyhole-neckline",
              cloth,
              label: `keyhole, ${cloth === "fb-apricot-linen" ? "plain" : "print"} — the closure, 5×`,
              zoom: 5,
              at: [298, 200] as [number, number],
            }))
          : []),
        /* a look cut to the retired one-shoulder, as it now opens */
        ...(cut === "asymmetrical"
          ? (["fb-apricot-linen", "fb-midnight-floral"] as const).flatMap((cloth) => {
              const kind = cloth === "fb-apricot-linen" ? "plain" : "print";
              const base = { body: "female" as const, ids: ["female-dress"], neckline: "female-one-shoulder-neckline", cloth };
              return [
                { ...base, label: `a one-shoulder look, ${kind} — whole`, zoom: 1, at: [300, 500] as [number, number] },
                { ...base, label: `a one-shoulder look, ${kind} — the neckline, 2.4×`, zoom: 2.4, at: [300, 250] as [number, number] },
              ];
            })
          : []),
      ],
    ])),
    /* the halter: whole, the neckline, and its band at the throat close up */
    ["halter", (["fb-apricot-linen", "fb-midnight-floral"] as const).flatMap((cloth) => {
      const kind = cloth === "fb-apricot-linen" ? "plain" : "print";
      const base = { body: "female" as const, ids: ["female-dress"], neckline: "female-halter-neckline", cloth };
      return [
        { ...base, label: `halter, ${kind} — whole`, zoom: 1, at: [300, 500] as [number, number] },
        { ...base, label: `halter, ${kind} — the neckline, 2.8×`, zoom: 2.8, at: [300, 250] as [number, number] },
        { ...base, label: `halter, ${kind} — the band, 5×`, zoom: 5, at: [298, 200] as [number, number] },
      ];
    })],
    /* the wrap, in every sleeve it offers: whole, and the wrap and its tie close up, plain and print */
    ["wrap", sleeveTypesFor(garmentById("female-dress")!, necklineById("female-wrap-neckline")).flatMap((type) => {
      const length = SLEEVE_KINDS[type].lengths[0];
      return (["fb-apricot-linen", "fb-midnight-floral"] as const).flatMap((cloth) => {
        const kind = cloth === "fb-apricot-linen" ? "plain" : "print";
        const base = { body: "female" as const, ids: ["female-dress"], neckline: "female-wrap-neckline", cloth, sleeve: { type, length } };
        return [
          { ...base, label: `${type} ${length}, ${kind} — whole`, zoom: 1, at: [300, 500] as [number, number] },
          { ...base, label: `${type} ${length}, ${kind} — the wrap and tie, 2×`, zoom: 2, at: [305, 340] as [number, number] },
        ];
      });
    })],
    ["dolman", [
      { label: "blouse, dolman, formal cuff — whole", body: "female", ids: ["female-blouse"], zoom: 1, at: [300, 500], sleeve: { type: "dolman", length: "long", cuff: "formal" } },
      { label: "the cuff, 4×", body: "female", ids: ["female-blouse"], zoom: 4, at: [186, 460], sleeve: { type: "dolman", length: "long", cuff: "formal" } },
      { label: "t-shirt, dolman, rib cuff — the cuff, 4×", body: "female", ids: ["female-t-shirt"], zoom: 4, at: [186, 460], sleeve: { type: "dolman", length: "long", cuff: "rib" } },
      { label: "dress, dolman, plain cuff — the cuff, 4×", body: "female", ids: ["female-dress"], zoom: 4, at: [186, 460], sleeve: { type: "dolman", length: "long", cuff: "plain" } },
    ]],
  ];
  const THEMES = {
    light: { page: "#efeae4", stage: "#ffffff", text: "#1f1915", caption: "#555" },
    dark: { page: "#1a1714", stage: "#141110", text: "#f5f1ea", caption: "#b9b2a8" },
  } as const;
  it.each(SHEETS.flatMap(([name, tiles]) => (["light", "dark"] as const).map((theme) => [`${name}-${theme}`, tiles, theme] as const)))(
    "writes .preview/wardrobe/fix-%s.html",
    (file, tiles, theme) => {
      const t = THEMES[theme];
      const html = renderToStaticMarkup(
        <div className="row">
          {tiles.map((x, i) => {
            const fabric = f(x.cloth ?? "fb-apricot-linen");
            let worn: WornGarment[] = [];
            const by: Record<string, Partial<Record<FabricRegionId, Fabric>>> = {};
            for (const gid of x.ids) {
              const g = garmentById(gid)!;
              const cloth = gid.endsWith("trousers") || x.ids.length === 1 ? fabric : f("fb-rose-silk");
              worn = wear(worn, cutFrom(g, cloth.id));
              const regions: Partial<Record<FabricRegionId, Fabric>> = { collar: cloth };
              for (const r of g.fabricRegions) regions[r] = cloth;
              by[gid] = regions;
            }
            if (x.neckline) worn = setNeckline(worn, x.ids[0], x.neckline);
            if (x.collar) worn = setCollar(worn, x.ids[0], x.collar);
            if (x.sleeve) worn = setSleeve(worn, x.ids[0], x.sleeve);
            const outfit: Outfit = { bodyType: x.body, skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
            return (
              <figure key={i}>
                <MannequinStage outfit={outfit} fabrics={by} zoom={x.zoom} focus={x.at} />
                <figcaption>{x.label}</figcaption>
              </figure>
            );
          })}
        </div>
      );
      const css =
        `<style>body{margin:0;padding:14px;background:${t.page};font:12px system-ui}` +
        `.row{display:flex;flex-wrap:wrap;gap:12px}figure{margin:0}svg{width:220px;height:444px;display:block;` +
        `background:${t.stage};color:${t.text};border-radius:10px}figcaption{margin-top:5px;color:${t.caption}}</style>`;
      writeFileSync(
        `.preview/wardrobe/fix-${file}.html`,
        '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + html
      );
    }
  );
});

/**
 * The trousers' details, round 3 — the fly, the slanted pockets and the belt
 * loops — on both bodies: each pair on its own and under a t-shirt, which
 * hangs over the top of them, in a plain cloth and in the plaid, whole and the
 * waist close up, on a light page and a dark one. Bigger tiles than the fix
 * sheets, because the details are a centimetre across. Typed out, so the same
 * tiles render before and after.
 */
describe("trousers, light and dark", () => {
  const THEMES = {
    light: { page: "#efeae4", stage: "#ffffff", text: "#1f1915", caption: "#555" },
    dark: { page: "#1a1714", stage: "#141110", text: "#f5f1ea", caption: "#b9b2a8" },
  } as const;
  /* the waist close up: both side seams in, from the band to below the pockets */
  const WAIST: Record<BodyType, [number, number]> = { male: [300, 452], female: [300, 432] };
  const CLOTHS = [["fb-apricot-linen", "plain"], ["fb-indigo-plaid", "plaid"]] as const;
  it.each((["male", "female"] as const).flatMap((body) => (["light", "dark"] as const).map((theme) => [`${body}-${theme}`, body, theme] as const)))(
    "writes .preview/wardrobe/r3-trousers-%s.html",
    (file, body, theme) => {
      const t = THEMES[theme];
      const stage = (ids: string[], clothId: string, zoom: number, at: [number, number]) => {
        let worn: WornGarment[] = [];
        const by: Record<string, Partial<Record<FabricRegionId, Fabric>>> = {};
        for (const gid of ids) {
          const g = garmentById(gid)!;
          /* the trousers in the cloth being shown, a top over them in another */
          const cloth = gid.endsWith("trousers") ? f(clothId) : f("fb-rose-silk");
          worn = wear(worn, cutFrom(g, cloth.id));
          const regions: Partial<Record<FabricRegionId, Fabric>> = { collar: cloth };
          for (const r of g.fabricRegions) regions[r] = cloth;
          by[gid] = regions;
        }
        const outfit: Outfit = { bodyType: body, skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
        return <MannequinStage outfit={outfit} fabrics={by} zoom={zoom} focus={at} />;
      };
      const rows = ([
        ["on their own", [`${body}-trousers`]],
        ["under a t-shirt", [`${body}-t-shirt`, `${body}-trousers`]],
      ] as const).map(([what, ids]) => (
        <div key={what} className="row">
          {CLOTHS.flatMap(([cloth, kind]) => [
            <figure key={`${cloth}-whole`}>
              {stage([...ids], cloth, 1, [300, 500])}
              <figcaption>{`${body} trousers ${what}, ${kind} — whole`}</figcaption>
            </figure>,
            <figure key={`${cloth}-waist`}>
              {stage([...ids], cloth, 2.5, WAIST[body])}
              <figcaption>{`${body} trousers ${what}, ${kind} — the waist, 2.5×`}</figcaption>
            </figure>,
          ])}
        </div>
      ));
      const css =
        `<style>body{margin:0;padding:14px;background:${t.page};font:12px system-ui}` +
        `.row{display:flex;flex-wrap:nowrap;width:max-content;gap:12px;margin-bottom:12px}figure{margin:0}` +
        `svg{width:360px;height:727px;display:block;background:${t.stage};color:${t.text};border-radius:10px}` +
        `figcaption{margin-top:5px;color:${t.caption}}</style>`;
      writeFileSync(
        `.preview/wardrobe/r3-trousers-${file}.html`,
        '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + renderToStaticMarkup(<>{rows}</>)
      );
    }
  );
});

/**
 * Skirt lengths, on a light page and a dark one, in a plain cloth and a print:
 * the dress in long sleeves, and the skirt under a long-sleeved blouse, at
 * every length each one offers — so the same sheet shows whatever lengths the
 * code has, before and after they change.
 */
describe("skirt lengths, light and dark", () => {
  const THEMES = {
    light: { page: "#efeae4", stage: "#ffffff", text: "#1f1915", caption: "#555" },
    dark: { page: "#1a1714", stage: "#141110", text: "#f5f1ea", caption: "#b9b2a8" },
  } as const;
  const CLOTHS = [["fb-apricot-linen", "plain"], ["fb-indigo-plaid", "plaid"]] as const;
  const LOOKS = [
    ["dress", "female-dress", ["female-dress"]],
    ["skirt", "female-skirt", ["female-blouse", "female-skirt"]],
  ] as const;
  it.each(["light", "dark"] as const)("writes .preview/wardrobe/styles3-lengths-%s.html", (theme) => {
    const t = THEMES[theme];
    const stage = (skirtId: string, ids: readonly string[], clothId: string, length: string) => {
      let worn: WornGarment[] = [];
      const by: Record<string, Partial<Record<FabricRegionId, Fabric>>> = {};
      for (const gid of ids) {
        const g = garmentById(gid)!;
        /* the skirted garment in the cloth being shown, a top over it in another */
        const cloth = gid === skirtId ? f(clothId) : f("fb-rose-silk");
        worn = wear(worn, cutFrom(g, cloth.id));
        const regions: Partial<Record<FabricRegionId, Fabric>> = { collar: cloth };
        for (const r of g.fabricRegions) regions[r] = cloth;
        by[gid] = regions;
      }
      worn = setSleeve(worn, ids[0], { type: "set-in", length: "long" });
      worn = worn.map((w) => {
        const skirt = w.garmentId === skirtId ? skirtOf(w) : undefined;
        return skirt ? { ...w, skirt: { ...skirt, length } as typeof skirt } : w;
      });
      const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
      return <MannequinStage outfit={outfit} fabrics={by} zoom={1} focus={[300, 500]} />;
    };
    const rows = LOOKS.flatMap(([name, skirtId, ids]) =>
      CLOTHS.map(([cloth, kind]) => (
        <div key={`${name}-${cloth}`} className="row">
          {garmentById(skirtId)!.skirt!.lengths.map((length) => (
            <figure key={length}>
              {stage(skirtId, ids, cloth, length)}
              <figcaption>{`${name}, ${length}, long sleeves, ${kind}`}</figcaption>
            </figure>
          ))}
        </div>
      ))
    );
    const css =
      `<style>body{margin:0;padding:14px;background:${t.page};font:12px system-ui}` +
      `.row{display:flex;flex-wrap:nowrap;width:max-content;gap:12px;margin-bottom:12px}figure{margin:0}` +
      `svg{width:300px;height:500px;display:block;background:${t.stage};color:${t.text};border-radius:10px}` +
      `figcaption{margin-top:5px;color:${t.caption}}</style>`;
    writeFileSync(
      `.preview/wardrobe/styles3-lengths-${theme}.html`,
      '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + renderToStaticMarkup(<>{rows}</>)
    );
  });
});

/**
 * Every neckline at every waist the dress is cut with, on a light page and a
 * dark one: in a plain cloth in the sleeve it arrives in, and in a print in
 * long sleeves — so the same sheet shows whatever waists the code has.
 */
describe("dress waists, light and dark", () => {
  const THEMES = {
    light: { page: "#efeae4", stage: "#ffffff", text: "#1f1915", caption: "#555" },
    dark: { page: "#1a1714", stage: "#141110", text: "#f5f1ea", caption: "#b9b2a8" },
  } as const;
  const ROWS = [
    ["fb-apricot-linen", "plain", null],
    ["fb-indigo-plaid", "plaid, long sleeves", { type: "set-in", length: "long" }],
  ] as const;
  it.each(["light", "dark"] as const)("writes .preview/wardrobe/styles4-waists-%s.html", (theme) => {
    const t = THEMES[theme];
    const dress = garmentById("female-dress")!;
    const stage = (necklineId: string, waist: string, clothId: string, sleeve: SleeveChoice | null) => {
      const cloth = f(clothId);
      let worn = wear([], cutFrom(dress, cloth.id));
      worn = setNeckline(worn, dress.id, necklineId);
      if (sleeve) worn = setSleeve(worn, dress.id, sleeve);
      worn = worn.map((w) => {
        const skirt = skirtOf(w);
        return skirt ? { ...w, skirt: { ...skirt, waist } as typeof skirt } : w;
      });
      const regions: Partial<Record<FabricRegionId, Fabric>> = { collar: cloth };
      for (const r of dress.fabricRegions) regions[r] = cloth;
      const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
      return <MannequinStage outfit={outfit} fabrics={{ [dress.id]: regions }} zoom={1} focus={[300, 500]} />;
    };
    const rows = (dress.skirt!.waists ?? ["natural"]).flatMap((waist) =>
      ROWS.map(([cloth, kind, sleeve]) => (
        <div key={`${waist}-${cloth}`} className="row">
          {necklinesForGarment(dress).map((n) => (
            <figure key={n.id}>
              {stage(n.id, waist, cloth, sleeve)}
              <figcaption>{`${n.cut}, ${waist} waist, ${kind}`}</figcaption>
            </figure>
          ))}
        </div>
      ))
    );
    const css =
      `<style>body{margin:0;padding:14px;background:${t.page};font:12px system-ui}` +
      `.row{display:flex;flex-wrap:nowrap;width:max-content;gap:10px;margin-bottom:12px}figure{margin:0;width:220px}` +
      `svg{width:220px;height:367px;display:block;background:${t.stage};color:${t.text};border-radius:10px}` +
      `figcaption{margin-top:5px;color:${t.caption}}</style>`;
    writeFileSync(
      `.preview/wardrobe/styles4-waists-${theme}.html`,
      '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + renderToStaticMarkup(<>{rows}</>)
    );
  });
});

/**
 * The sleeves beside an empire waist's skirt, on a light page and a dark one.
 * Hung from under the bust, the skirt falls past her waist beside her arms, so
 * each sleeve whose shape it changes — the long ones, and those cut to swing
 * free over it — is shown at her own waist and at the empire, whole in a print
 * and its arm close up in a plain cloth, where an edge shows best.
 */
describe("sleeves at an empire waist, light and dark", () => {
  const THEMES = {
    light: { page: "#efeae4", stage: "#ffffff", text: "#1f1915", caption: "#555" },
    dark: { page: "#1a1714", stage: "#141110", text: "#f5f1ea", caption: "#b9b2a8" },
  } as const;
  const SLEEVES: [neckline: string, sleeve: SleeveChoice][] = [
    ["round", { type: "set-in", length: "long" }],
    ["round", { type: "raglan", length: "long" }],
    ["round", { type: "drop", length: "long" }],
    ["round", { type: "dolman", length: "long" }],
    ["round", { type: "puff", length: "elbow" }],
    ["round", { type: "bishop", length: "long" }],
    ["round", { type: "bell", length: "elbow" }],
    ["round", { type: "bell", length: "long" }],
    ["off-shoulder", { type: "bishop", length: "long" }],
  ];
  it.each(["light", "dark"] as const)("writes .preview/wardrobe/styles5-sleeves-%s.html", (theme) => {
    const t = THEMES[theme];
    const dress = garmentById("female-dress")!;
    const stage = (cut: string, sleeve: SleeveChoice, waist: "natural" | "empire", clothId: string, zoom: number) => {
      const cloth = f(clothId);
      let worn = wear([], cutFrom(dress, cloth.id));
      worn = setNeckline(worn, dress.id, `female-${cut}-neckline`);
      worn = setSleeve(worn, dress.id, sleeve);
      worn = worn.map((w) => {
        const skirt = skirtOf(w);
        return skirt ? { ...w, skirt: { ...skirt, waist } } : w;
      });
      const regions: Partial<Record<FabricRegionId, Fabric>> = { collar: cloth };
      for (const r of dress.fabricRegions) regions[r] = cloth;
      const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
      /* close up: the left arm beside the skirt, from the seam to the hand */
      const focus: [number, number] = zoom > 1 ? [228, 380] : [300, 500];
      return <MannequinStage outfit={outfit} fabrics={{ [dress.id]: regions }} zoom={zoom} focus={focus} />;
    };
    const rows = SLEEVES.map(([cut, sleeve]) => {
      const name = `${cut === "round" ? "" : `${cut}, `}${sleeve.type} ${sleeve.length}`;
      return (
        <div key={name} className="row">
          {([["fb-midnight-floral", 1, "print"], ["fb-apricot-linen", 2.4, "plain, 2.4×"]] as const).flatMap(([cloth, zoom, kind]) =>
            (["natural", "empire"] as const).map((waist) => (
              <figure key={`${cloth}-${waist}`}>
                {stage(cut, sleeve, waist, cloth, zoom)}
                <figcaption>{`${name}, ${waist} waist, ${kind}`}</figcaption>
              </figure>
            ))
          )}
        </div>
      );
    });
    const css =
      `<style>body{margin:0;padding:14px;background:${t.page};font:12px system-ui}` +
      `.row{display:flex;flex-wrap:nowrap;width:max-content;gap:10px;margin-bottom:12px}figure{margin:0;width:220px}` +
      `svg{width:220px;height:367px;display:block;background:${t.stage};color:${t.text};border-radius:10px}` +
      `figcaption{margin-top:5px;color:${t.caption}}</style>`;
    writeFileSync(
      `.preview/wardrobe/styles5-sleeves-${theme}.html`,
      '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + renderToStaticMarkup(<>{rows}</>)
    );
  });
});

/**
 * Skirt shapes, on a light page and a dark one: every shape at every length,
 * on the dress at every waist and on the skirt under a blouse — in a plain
 * cloth in the sleeve each arrives in, and in a print in long sleeves — so the
 * same sheet shows whatever shapes the code has.
 */
describe("skirt shapes, light and dark", () => {
  const THEMES = {
    light: { page: "#efeae4", stage: "#ffffff", text: "#1f1915", caption: "#555" },
    dark: { page: "#1a1714", stage: "#141110", text: "#f5f1ea", caption: "#b9b2a8" },
  } as const;
  const CLOTHS = [
    ["fb-apricot-linen", "plain", null],
    ["fb-midnight-floral", "print, long sleeves", { type: "set-in", length: "long" }],
  ] as const;
  type Look = { name: string; skirtId: string; ids: string[]; waist?: WaistId };
  it.each(["light", "dark"] as const)("writes .preview/wardrobe/styles6-shapes-%s.html", (theme) => {
    const t = THEMES[theme];
    const dress = garmentById("female-dress")!;
    const looks: Look[] = [
      ...(dress.skirt!.waists ?? []).map((waist) => ({ name: `dress, ${waist} waist`, skirtId: dress.id, ids: [dress.id], waist })),
      { name: "skirt", skirtId: "female-skirt", ids: ["female-blouse", "female-skirt"] },
    ];
    const stage = (look: Look, clothId: string, sleeve: SleeveChoice | null, shape: SkirtShapeId, length: SkirtLengthId) => {
      let worn: WornGarment[] = [];
      const by: Record<string, Partial<Record<FabricRegionId, Fabric>>> = {};
      for (const gid of look.ids) {
        const g = garmentById(gid)!;
        /* the skirted garment in the cloth being shown, a top over it in another */
        const cloth = gid === look.skirtId ? f(clothId) : f("fb-rose-silk");
        worn = wear(worn, cutFrom(g, cloth.id));
        const regions: Partial<Record<FabricRegionId, Fabric>> = { collar: cloth };
        for (const r of g.fabricRegions) regions[r] = cloth;
        by[gid] = regions;
      }
      if (sleeve) worn = setSleeve(worn, look.ids[0], sleeve);
      worn = worn.map((w) => {
        const skirt = w.garmentId === look.skirtId ? skirtOf(w) : undefined;
        return skirt ? { ...w, skirt: { ...skirt, shape, length, ...(look.waist ? { waist: look.waist } : {}) } } : w;
      });
      const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
      return <MannequinStage outfit={outfit} fabrics={by} zoom={1} focus={[300, 500]} />;
    };
    const rows = looks.flatMap((look) => {
      const offer = garmentById(look.skirtId)!.skirt!;
      return CLOTHS.map(([cloth, kind, sleeve]) => (
        <div key={`${look.name}-${cloth}`} className="row">
          {offer.shapes.flatMap((shape) =>
            shapeLengths(shape, offer.lengths).map((length) => (
              <figure key={`${shape}-${length}`}>
                {stage(look, cloth, sleeve, shape, length)}
                <figcaption>{`${look.name}, ${shape}, ${length}, ${kind}`}</figcaption>
              </figure>
            ))
          )}
        </div>
      ));
    });
    const css =
      `<style>body{margin:0;padding:14px;background:${t.page};font:12px system-ui}` +
      `.row{display:flex;flex-wrap:nowrap;width:max-content;gap:10px;margin-bottom:12px}figure{margin:0;width:220px}` +
      `svg{width:220px;height:367px;display:block;background:${t.stage};color:${t.text};border-radius:10px}` +
      `figcaption{margin-top:5px;color:${t.caption}}</style>`;
    writeFileSync(
      `.preview/wardrobe/styles6-shapes-${theme}.html`,
      '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + renderToStaticMarkup(<>{rows}</>)
    );
  });
});

/**
 * The A-line, on a light page and a dark one, where it meets her arms: at
 * every waist in long sleeves of three kinds — whole in a print, and the
 * wrist close up in a plain cloth, where the sleeve hangs in front of the
 * skirt — and under her jacket, the dress at every waist and the skirt at
 * every length, with the jacket's cuff close up, where a skirt this wide
 * shows beside it.
 */
describe("the A-line, light and dark", () => {
  const THEMES = {
    light: { page: "#efeae4", stage: "#ffffff", text: "#1f1915", caption: "#555" },
    dark: { page: "#1a1714", stage: "#141110", text: "#f5f1ea", caption: "#b9b2a8" },
  } as const;
  const SLEEVES: SleeveChoice[] = [
    { type: "set-in", length: "long" },
    { type: "bell", length: "long" },
    { type: "dolman", length: "long" },
  ];
  type Tile = { caption: string; ids: string[]; skirted: string; skirt: Partial<SkirtChoiceLike>; sleeve: SleeveChoice; cloth: string; zoom: number; focus: [number, number] };
  type SkirtChoiceLike = { shape: SkirtShapeId; length: SkirtLengthId; waist: WaistId };
  it.each(["light", "dark"] as const)("writes .preview/wardrobe/styles7-aline-%s.html", (theme) => {
    const t = THEMES[theme];
    const d = draft("female");
    /* the left wrist, and a little in from it, where the sleeve's end meets the skirt */
    const wrist: [number, number] = [(d.armOutAt(d.wristY, 0) + d.armInAt(d.wristY, 0)) / 2 + 10, d.wristY];
    const stage = (tile: Tile) => {
      let worn: WornGarment[] = [];
      const by: Record<string, Partial<Record<FabricRegionId, Fabric>>> = {};
      for (const gid of tile.ids) {
        const g = garmentById(gid)!;
        /* the skirted garment in the cloth being shown, anything over or under it in others */
        const cloth = gid === tile.skirted ? f(tile.cloth) : gid.endsWith("jacket") ? f("fb-indigo-plaid") : f("fb-rose-silk");
        worn = wear(worn, cutFrom(g, cloth.id));
        const regions: Partial<Record<FabricRegionId, Fabric>> = { collar: cloth };
        for (const r of g.fabricRegions) regions[r] = cloth;
        by[gid] = regions;
      }
      worn = setSleeve(worn, tile.ids[0], tile.sleeve);
      worn = worn.map((w) => {
        const skirt = w.garmentId === tile.skirted ? skirtOf(w) : undefined;
        return skirt ? { ...w, skirt: { ...skirt, ...tile.skirt } } : w;
      });
      const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
      return <MannequinStage outfit={outfit} fabrics={by} zoom={tile.zoom} focus={tile.focus} />;
    };
    const dress = "female-dress";
    const rows: Tile[][] = [
      /* every waist, in three long sleeves: whole in a print, the wrist close up in a plain cloth */
      ...(["empire", "natural", "dropped"] as const).map((waist) =>
        SLEEVES.flatMap((sleeve): Tile[] => [
          { caption: `${waist} waist, ${sleeve.type} long, print`, ids: [dress], skirted: dress, skirt: { shape: "aline", waist }, sleeve, cloth: "fb-midnight-floral", zoom: 1, focus: [300, 500] },
          { caption: `${waist} waist, ${sleeve.type} long, plain, the wrist 2.4×`, ids: [dress], skirted: dress, skirt: { shape: "aline", waist }, sleeve, cloth: "fb-apricot-linen", zoom: 2.4, focus: wrist },
        ])
      ),
      /* under her jacket: the dress at every waist, whole and the cuff close up */
      (["empire", "natural", "dropped"] as const).flatMap((waist): Tile[] => [
        { caption: `under the jacket, ${waist} waist, plain`, ids: [dress, "female-jacket"], skirted: dress, skirt: { shape: "aline", waist }, sleeve: { type: "set-in", length: "long" }, cloth: "fb-apricot-linen", zoom: 1, focus: [300, 500] },
        { caption: `under the jacket, ${waist} waist, the cuff 2.4×`, ids: [dress, "female-jacket"], skirted: dress, skirt: { shape: "aline", waist }, sleeve: { type: "set-in", length: "long" }, cloth: "fb-apricot-linen", zoom: 2.4, focus: wrist },
      ]),
      /* and the skirt, under a blouse and the jacket, at every length, with the cuff close up */
      [
        ...(["knee", "midi", "maxi"] as const).map((length): Tile => ({
          caption: `skirt under the jacket, ${length}, print`, ids: ["female-blouse", "female-skirt", "female-jacket"], skirted: "female-skirt", skirt: { shape: "aline", length }, sleeve: { type: "set-in", length: "long" }, cloth: "fb-midnight-floral", zoom: 1, focus: [300, 500],
        })),
        { caption: "skirt under the jacket, midi, the cuff 2.4×", ids: ["female-blouse", "female-skirt", "female-jacket"], skirted: "female-skirt", skirt: { shape: "aline", length: "midi" }, sleeve: { type: "set-in", length: "long" }, cloth: "fb-apricot-linen", zoom: 2.4, focus: wrist },
      ],
    ];
    const html = renderToStaticMarkup(
      <>
        {rows.map((row, r) => (
          <div key={r} className="row">
            {row.map((tile) => (
              <figure key={tile.caption}>
                {stage(tile)}
                <figcaption>{tile.caption}</figcaption>
              </figure>
            ))}
          </div>
        ))}
      </>
    );
    const css =
      `<style>body{margin:0;padding:14px;background:${t.page};font:12px system-ui}` +
      `.row{display:flex;flex-wrap:nowrap;width:max-content;gap:10px;margin-bottom:12px}figure{margin:0;width:220px}` +
      `svg{width:220px;height:367px;display:block;background:${t.stage};color:${t.text};border-radius:10px}` +
      `figcaption{margin-top:5px;color:${t.caption}}</style>`;
    writeFileSync(
      `.preview/wardrobe/styles7-aline-${theme}.html`,
      '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + html
    );
  });
});

/**
 * The circle and the pleated skirt, on a light page and a dark one, close up
 * where each is its own: the pleats from the seam and the hem stepped at them,
 * the circle standing out from its seam and its hem waving under its folds —
 * on the dress and on the skirt, in a plain cloth and a print. Then her wrist
 * beside each in three long sleeves, hanging in front of it, and each under
 * her jacket, whole and with the cuff close up.
 */
describe("the circle and the pleated skirt, light and dark", () => {
  const THEMES = {
    light: { page: "#efeae4", stage: "#ffffff", text: "#1f1915", caption: "#555" },
    dark: { page: "#1a1714", stage: "#141110", text: "#f5f1ea", caption: "#b9b2a8" },
  } as const;
  type Tile = { caption: string; ids: string[]; skirted: string; skirt: Partial<{ shape: SkirtShapeId; length: SkirtLengthId; waist: WaistId }>; sleeve?: SleeveChoice; cloth: string; zoom: number; focus: [number, number] };
  const PLAIN = "fb-apricot-linen";
  const PRINT = "fb-midnight-floral";
  const DRESS = ["female-dress"];
  const SKIRT = ["female-blouse", "female-skirt"];
  it.each(["light", "dark"] as const)("writes .preview/wardrobe/styles8-circle-pleated-%s.html", (theme) => {
    const t = THEMES[theme];
    const d = draft("female");
    const wrist: [number, number] = [(d.armOutAt(d.wristY, 0) + d.armInAt(d.wristY, 0)) / 2 + 10, d.wristY];
    const stage = (tile: Tile) => {
      let worn: WornGarment[] = [];
      const by: Record<string, Partial<Record<FabricRegionId, Fabric>>> = {};
      for (const gid of tile.ids) {
        const g = garmentById(gid)!;
        /* the skirted garment in the cloth being shown, anything over or under it in others */
        const cloth = gid === tile.skirted ? f(tile.cloth) : gid.endsWith("jacket") ? f("fb-indigo-plaid") : f("fb-rose-silk");
        worn = wear(worn, cutFrom(g, cloth.id));
        const regions: Partial<Record<FabricRegionId, Fabric>> = { collar: cloth };
        for (const r of g.fabricRegions) regions[r] = cloth;
        by[gid] = regions;
      }
      if (tile.sleeve) worn = setSleeve(worn, tile.ids[0], tile.sleeve);
      worn = worn.map((w) => {
        const skirt = w.garmentId === tile.skirted ? skirtOf(w) : undefined;
        return skirt ? { ...w, skirt: { ...skirt, ...tile.skirt } } : w;
      });
      const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
      return <MannequinStage outfit={outfit} fabrics={by} zoom={tile.zoom} focus={tile.focus} />;
    };
    /* one shape, on the dress and on the skirt: whole, where it starts, and its hem, each close up */
    const closeUps = (shape: SkirtShapeId, cloth: string, kind: string): Tile[] =>
      [
        ["dress", DRESS, "female-dress", 380] as const,
        ["skirt", SKIRT, "female-skirt", 400] as const,
      ].flatMap(([name, ids, skirted, top]) => [
        { caption: `${name}, ${shape}, midi, ${kind}`, ids, skirted, skirt: { shape, length: "midi" }, cloth, zoom: 1, focus: [300, 500] },
        { caption: `${name}, ${shape}, from the ${name === "dress" ? "seam" : "band"} 2.4×`, ids, skirted, skirt: { shape, length: "midi" }, cloth, zoom: 2.4, focus: [300, top] },
        { caption: `${name}, ${shape}, the hem 2.4×`, ids, skirted, skirt: { shape, length: "midi" }, cloth, zoom: 2.4, focus: [shape === "circle" ? 180 : 220, 745] },
      ]);
    const LONG: SleeveChoice[] = [
      { type: "set-in", length: "long" },
      { type: "bell", length: "long" },
      { type: "dolman", length: "long" },
    ];
    const UNDER = ["female-jacket"];
    const rows: Tile[][] = [
      closeUps("pleated", PLAIN, "plain"),
      closeUps("pleated", PRINT, "print"),
      closeUps("circle", PLAIN, "plain"),
      closeUps("circle", PRINT, "print"),
      /* her wrist beside each, in three long sleeves, hanging in front of it */
      (["circle", "pleated"] as const).flatMap((shape) =>
        LONG.map((sleeve): Tile => ({
          caption: `${shape}, ${sleeve.type} long, plain, the wrist 2.4×`, ids: DRESS, skirted: "female-dress", skirt: { shape }, sleeve, cloth: PLAIN, zoom: 2.4, focus: wrist,
        }))
      ),
      /* under her jacket: whole, and the cuff close up */
      (["circle", "pleated"] as const).flatMap((shape): Tile[] => [
        { caption: `dress under the jacket, ${shape}, plain`, ids: [...DRESS, ...UNDER], skirted: "female-dress", skirt: { shape }, sleeve: { type: "set-in", length: "long" }, cloth: PLAIN, zoom: 1, focus: [300, 500] },
        { caption: `skirt under the jacket, ${shape}, midi, print`, ids: [...SKIRT, ...UNDER], skirted: "female-skirt", skirt: { shape, length: "midi" }, sleeve: { type: "set-in", length: "long" }, cloth: PRINT, zoom: 1, focus: [300, 500] },
        { caption: `dress under the jacket, ${shape}, the cuff 2.4×`, ids: [...DRESS, ...UNDER], skirted: "female-dress", skirt: { shape }, sleeve: { type: "set-in", length: "long" }, cloth: PLAIN, zoom: 2.4, focus: wrist },
      ]),
    ];
    const html = renderToStaticMarkup(
      <>
        {rows.map((row, r) => (
          <div key={r} className="row">
            {row.map((tile) => (
              <figure key={tile.caption}>
                {stage(tile)}
                <figcaption>{tile.caption}</figcaption>
              </figure>
            ))}
          </div>
        ))}
      </>
    );
    const css =
      `<style>body{margin:0;padding:14px;background:${t.page};font:12px system-ui}` +
      `.row{display:flex;flex-wrap:nowrap;width:max-content;gap:10px;margin-bottom:12px}figure{margin:0;width:220px}` +
      `svg{width:220px;height:367px;display:block;background:${t.stage};color:${t.text};border-radius:10px}` +
      `figcaption{margin-top:5px;color:${t.caption}}</style>`;
    writeFileSync(
      `.preview/wardrobe/styles8-circle-pleated-${theme}.html`,
      '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + html
    );
  });
});

/**
 * The tiered skirt, on a light page and a dark one, close up where it is its
 * own: gathered into its seam or its band, each tier gathered into the seam
 * above it and stepping out at the side there, and its hem — on the dress and
 * on the skirt, in a plain cloth and a print. Then her wrist beside it in
 * three long sleeves, hanging in front of it; under her jacket, whole and
 * with the cuff close up; under a blouse; and at an empire waist, maxi.
 */
describe("the tiered skirt, light and dark", () => {
  const THEMES = {
    light: { page: "#efeae4", stage: "#ffffff", text: "#1f1915", caption: "#555" },
    dark: { page: "#1a1714", stage: "#141110", text: "#f5f1ea", caption: "#b9b2a8" },
  } as const;
  type Tile = { caption: string; ids: string[]; skirted: string; skirt: Partial<{ shape: SkirtShapeId; length: SkirtLengthId; waist: WaistId }>; sleeve?: SleeveChoice; cloth: string; zoom: number; focus: [number, number] };
  const PLAIN = "fb-apricot-linen";
  const PRINT = "fb-midnight-floral";
  const DRESS = ["female-dress"];
  const SKIRT = ["female-blouse", "female-skirt"];
  it.each(["light", "dark"] as const)("writes .preview/wardrobe/styles9-tiered-%s.html", (theme) => {
    const t = THEMES[theme];
    const d = draft("female");
    const wrist: [number, number] = [(d.armOutAt(d.wristY, 0) + d.armInAt(d.wristY, 0)) / 2 + 10, d.wristY];
    const stage = (tile: Tile) => {
      let worn: WornGarment[] = [];
      const by: Record<string, Partial<Record<FabricRegionId, Fabric>>> = {};
      for (const gid of tile.ids) {
        const g = garmentById(gid)!;
        /* the skirted garment in the cloth being shown, anything over or under it in others */
        const cloth = gid === tile.skirted ? f(tile.cloth) : gid.endsWith("jacket") ? f("fb-indigo-plaid") : f("fb-rose-silk");
        worn = wear(worn, cutFrom(g, cloth.id));
        const regions: Partial<Record<FabricRegionId, Fabric>> = { collar: cloth };
        for (const r of g.fabricRegions) regions[r] = cloth;
        by[gid] = regions;
      }
      if (tile.sleeve) worn = setSleeve(worn, tile.ids[0], tile.sleeve);
      worn = worn.map((w) => {
        const skirt = w.garmentId === tile.skirted ? skirtOf(w) : undefined;
        return skirt ? { ...w, skirt: { ...skirt, ...tile.skirt } } : w;
      });
      const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
      return <MannequinStage outfit={outfit} fabrics={by} zoom={tile.zoom} focus={tile.focus} />;
    };
    const TIERED = { shape: "tiered", length: "midi" } as const;
    /* on the dress and on the skirt: whole, where it is sewn on, its first tier's seam at the side, and its hem, each close up */
    const closeUps = (cloth: string, kind: string): Tile[] =>
      [
        ["dress", DRESS, "female-dress", 380, 476] as const,
        ["skirt", SKIRT, "female-skirt", 400, 495] as const,
      ].flatMap(([name, ids, skirted, top, seam]) => [
        { caption: `${name}, tiered, midi, ${kind}`, ids, skirted, skirt: TIERED, cloth, zoom: 1, focus: [300, 500] },
        { caption: `${name}, tiered, from the ${name === "dress" ? "seam" : "band"} 2.4×`, ids, skirted, skirt: TIERED, cloth, zoom: 2.4, focus: [300, top] },
        { caption: `${name}, tiered, a tier's seam 2.4×`, ids, skirted, skirt: TIERED, cloth, zoom: 2.4, focus: [200, seam] },
        { caption: `${name}, tiered, the hem 2.4×`, ids, skirted, skirt: TIERED, cloth, zoom: 2.4, focus: [220, 745] },
      ]);
    const LONG: SleeveChoice[] = [
      { type: "set-in", length: "long" },
      { type: "bell", length: "long" },
      { type: "dolman", length: "long" },
    ];
    const UNDER = ["female-jacket"];
    const rows: Tile[][] = [
      closeUps(PLAIN, "plain"),
      closeUps(PRINT, "print"),
      [
        /* her wrist beside it, in three long sleeves, hanging in front of it */
        ...LONG.map((sleeve): Tile => ({
          caption: `tiered, ${sleeve.type} long, plain, the wrist 2.4×`, ids: DRESS, skirted: "female-dress", skirt: { shape: "tiered" }, sleeve, cloth: PLAIN, zoom: 2.4, focus: wrist,
        })),
        /* under her jacket: whole, and the cuff close up */
        { caption: "dress under the jacket, tiered, plain", ids: [...DRESS, ...UNDER], skirted: "female-dress", skirt: { shape: "tiered" }, sleeve: { type: "set-in", length: "long" }, cloth: PLAIN, zoom: 1, focus: [300, 500] },
        { caption: "skirt under the jacket, tiered, midi, print", ids: [...SKIRT, ...UNDER], skirted: "female-skirt", skirt: TIERED, sleeve: { type: "set-in", length: "long" }, cloth: PRINT, zoom: 1, focus: [300, 500] },
        { caption: "dress under the jacket, tiered, the cuff 2.4×", ids: [...DRESS, ...UNDER], skirted: "female-dress", skirt: { shape: "tiered" }, sleeve: { type: "set-in", length: "long" }, cloth: PLAIN, zoom: 2.4, focus: wrist },
        /* a blouse over it, at maxi; and the dress at an empire waist, maxi, in long sleeves */
        { caption: "blouse over tiered, maxi, print", ids: SKIRT, skirted: "female-skirt", skirt: { shape: "tiered", length: "maxi" }, cloth: PRINT, zoom: 1, focus: [300, 500] },
        { caption: "dress, empire waist, tiered, maxi, long sleeves, print", ids: DRESS, skirted: "female-dress", skirt: { shape: "tiered", length: "maxi", waist: "empire" }, sleeve: { type: "set-in", length: "long" }, cloth: PRINT, zoom: 1, focus: [300, 500] },
      ],
    ];
    const html = renderToStaticMarkup(
      <>
        {rows.map((row, r) => (
          <div key={r} className="row">
            {row.map((tile) => (
              <figure key={tile.caption}>
                {stage(tile)}
                <figcaption>{tile.caption}</figcaption>
              </figure>
            ))}
          </div>
        ))}
      </>
    );
    const css =
      `<style>body{margin:0;padding:14px;background:${t.page};font:12px system-ui}` +
      `.row{display:flex;flex-wrap:nowrap;width:max-content;gap:10px;margin-bottom:12px}figure{margin:0;width:220px}` +
      `svg{width:220px;height:367px;display:block;background:${t.stage};color:${t.text};border-radius:10px}` +
      `figcaption{margin-top:5px;color:${t.caption}}</style>`;
    writeFileSync(
      `.preview/wardrobe/styles9-tiered-${theme}.html`,
      '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + html
    );
  });

  /*
    Every waist and every length, on the dress and on the skirt under a
    blouse, in a plain cloth in the sleeve it arrives in and in a print in
    long sleeves: one row each, its three lengths whole, then a tier's seam
    and the hem close up at midi.
  */
  it.each(["light", "dark"] as const)("writes .preview/wardrobe/styles9-tiered-all-%s.html", (theme) => {
    const t = THEMES[theme];
    const LONG: SleeveChoice = { type: "set-in", length: "long" };
    const stage = (ids: string[], skirted: string, skirt: Partial<{ shape: SkirtShapeId; length: SkirtLengthId; waist: WaistId }>, cloth: string, sleeve: SleeveChoice | null, zoom: number, focus: [number, number]) => {
      let worn: WornGarment[] = [];
      const by: Record<string, Partial<Record<FabricRegionId, Fabric>>> = {};
      for (const gid of ids) {
        const g = garmentById(gid)!;
        const c = gid === skirted ? f(cloth) : f("fb-rose-silk");
        worn = wear(worn, cutFrom(g, c.id));
        const regions: Partial<Record<FabricRegionId, Fabric>> = { collar: c };
        for (const r of g.fabricRegions) regions[r] = c;
        by[gid] = regions;
      }
      if (sleeve) worn = setSleeve(worn, ids[0], sleeve);
      worn = worn.map((w) => {
        const own = w.garmentId === skirted ? skirtOf(w) : undefined;
        return own ? { ...w, skirt: { ...own, ...skirt } } : w;
      });
      const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
      return <MannequinStage outfit={outfit} fabrics={by} zoom={zoom} focus={focus} />;
    };
    const looks = [
      ...(["empire", "natural", "dropped"] as const).map((waist) => ({ name: `dress, ${waist} waist`, ids: DRESS, skirted: "female-dress", waist: waist as WaistId | undefined, seam: 476 })),
      { name: "skirt", ids: SKIRT, skirted: "female-skirt", waist: undefined, seam: 495 },
    ];
    const rows = looks.flatMap((look) =>
      (
        [
          [PLAIN, "plain", null],
          [PRINT, "print, long sleeves", LONG],
        ] as const
      ).map(([cloth, kind, sleeve]) => {
        const skirt = (length: SkirtLengthId) => ({ shape: "tiered" as const, length, ...(look.waist ? { waist: look.waist } : {}) });
        const tiles: [string, ReactNode][] = [
          ...(["knee", "midi", "maxi"] as const).map((length): [string, ReactNode] => [`${look.name}, tiered, ${length}, ${kind}`, stage(look.ids, look.skirted, skirt(length), cloth, sleeve, 1, [300, 500])]),
          [`${look.name}, tiered, midi, ${kind}, a tier's seam 2.4×`, stage(look.ids, look.skirted, skirt("midi"), cloth, sleeve, 2.4, [235, look.seam])],
          [`${look.name}, tiered, midi, ${kind}, the hem 2.4×`, stage(look.ids, look.skirted, skirt("midi"), cloth, sleeve, 2.4, [235, 745])],
        ];
        return (
          <div key={`${look.name}-${kind}`} className="row">
            {tiles.map(([caption, node]) => (
              <figure key={caption}>
                {node}
                <figcaption>{caption}</figcaption>
              </figure>
            ))}
          </div>
        );
      })
    );
    const css =
      `<style>body{margin:0;padding:14px;background:${t.page};font:12px system-ui}` +
      `.row{display:flex;flex-wrap:nowrap;width:max-content;gap:10px;margin-bottom:12px}figure{margin:0;width:220px}` +
      `svg{width:220px;height:367px;display:block;background:${t.stage};color:${t.text};border-radius:10px}` +
      `figcaption{margin-top:5px;color:${t.caption}}</style>`;
    writeFileSync(
      `.preview/wardrobe/styles9-tiered-all-${theme}.html`,
      '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + renderToStaticMarkup(<>{rows}</>)
    );
  });
});

/**
 * A top over the skirt, on a light page and a dark one: her blouse and her
 * t-shirt over it in every shape at midi, and the circle at maxi, in a plain
 * cloth and a print — and close up at the top's hem, where the skirt comes
 * out from under it, for the three that reach past a top.
 */
describe("a top over the skirt, light and dark", () => {
  const THEMES = {
    light: { page: "#efeae4", stage: "#ffffff", text: "#1f1915", caption: "#555" },
    dark: { page: "#1a1714", stage: "#141110", text: "#f5f1ea", caption: "#b9b2a8" },
  } as const;
  type Tile = { caption: string; top: string; skirt: { shape: SkirtShapeId; length: SkirtLengthId }; cloth: string; zoom: number; focus: [number, number] };
  it.each(["light", "dark"] as const)("writes .preview/wardrobe/top-over-skirt-%s.html", (theme) => {
    const t = THEMES[theme];
    const stage = (tile: Tile) => {
      let worn: WornGarment[] = [];
      const by: Record<string, Partial<Record<FabricRegionId, Fabric>>> = {};
      for (const gid of [tile.top, "female-skirt"]) {
        const g = garmentById(gid)!;
        /* the skirt in the cloth being shown, the top over it in another */
        const cloth = gid === "female-skirt" ? f(tile.cloth) : f("fb-rose-silk");
        worn = wear(worn, cutFrom(g, cloth.id));
        const regions: Partial<Record<FabricRegionId, Fabric>> = { collar: cloth };
        for (const r of g.fabricRegions) regions[r] = cloth;
        by[gid] = regions;
      }
      worn = worn.map((w) => {
        const skirt = w.garmentId === "female-skirt" ? skirtOf(w) : undefined;
        return skirt ? { ...w, skirt: { ...skirt, ...tile.skirt } } : w;
      });
      const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
      return <MannequinStage outfit={outfit} fabrics={by} zoom={tile.zoom} focus={tile.focus} />;
    };
    const offer = garmentById("female-skirt")!.skirt!;
    const rows: Tile[][] = (["female-blouse", "female-t-shirt"] as const).flatMap((top) =>
      (
        [
          ["fb-apricot-linen", "plain"],
          ["fb-midnight-floral", "print"],
        ] as const
      ).map(([cloth, kind]): Tile[] => {
        const name = top === "female-blouse" ? "blouse" : "t-shirt";
        return [
          ...offer.shapes.map((shape): Tile => ({ caption: `${name} over ${shape}, midi, ${kind}`, top, skirt: { shape, length: "midi" }, cloth, zoom: 1, focus: [300, 500] })),
          { caption: `${name} over circle, maxi, ${kind}`, top, skirt: { shape: "circle", length: "maxi" }, cloth, zoom: 1, focus: [300, 500] },
          ...(["aline", "circle", "pleated"] as const).map((shape): Tile => ({
            caption: `${name} over ${shape}, its hem 2.4×`, top, skirt: { shape, length: "midi" }, cloth, zoom: 2.4, focus: [235, 445],
          })),
        ];
      })
    );
    const html = renderToStaticMarkup(
      <>
        {rows.map((row, r) => (
          <div key={r} className="row">
            {row.map((tile) => (
              <figure key={tile.caption}>
                {stage(tile)}
                <figcaption>{tile.caption}</figcaption>
              </figure>
            ))}
          </div>
        ))}
      </>
    );
    const css =
      `<style>body{margin:0;padding:14px;background:${t.page};font:12px system-ui}` +
      `.row{display:flex;flex-wrap:nowrap;width:max-content;gap:10px;margin-bottom:12px}figure{margin:0;width:220px}` +
      `svg{width:220px;height:367px;display:block;background:${t.stage};color:${t.text};border-radius:10px}` +
      `figcaption{margin-top:5px;color:${t.caption}}</style>`;
    writeFileSync(
      `.preview/wardrobe/top-over-skirt-${theme}.html`,
      '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + html
    );
  });
});

/**
 * Her abaya, on a light page and a dark one: on its own in black crepe, a
 * plain cloth and a print, with its opening, cuff and hem close up — and over
 * what she wears, each outfit beside the same outfit under the abaya: the
 * dress in several styles, a blouse with a skirt or trousers, a t-shirt with
 * a skirt, and nothing but her base layer.
 */
describe("abaya, light and dark", () => {
  const THEMES = {
    light: { page: "#efeae4", stage: "#ffffff", text: "#1f1915", caption: "#555" },
    dark: { page: "#1a1714", stage: "#141110", text: "#f5f1ea", caption: "#b9b2a8" },
  } as const;
  type Look = {
    name: string;
    wear: [id: string, cloth: string][];
    sleeve?: [id: string, choice: SleeveChoice];
    skirt?: [id: string, choice: Partial<{ shape: SkirtShapeId; length: SkirtLengthId; waist: WaistId }>];
  };
  const LONG: SleeveChoice = { type: "set-in", length: "long" };
  const OUTFITS: Look[] = [
    { name: "the dress as it arrives", wear: [["female-dress", "fb-apricot-linen"]] },
    { name: "the dress, long sleeves, print", wear: [["female-dress", "fb-midnight-floral"]], sleeve: ["female-dress", LONG] },
    { name: "empire A-line maxi, long sleeves", wear: [["female-dress", "fb-indigo-plaid"]], sleeve: ["female-dress", LONG], skirt: ["female-dress", { shape: "aline", length: "maxi", waist: "empire" }] },
    { name: "mermaid maxi", wear: [["female-dress", "fb-rose-silk"]], skirt: ["female-dress", { shape: "mermaid", length: "maxi" }] },
    { name: "blouse, A-line maxi skirt", wear: [["female-blouse", "fb-cream-dots"], ["female-skirt", "fb-terracotta-herring"]], skirt: ["female-skirt", { shape: "aline", length: "maxi" }] },
    { name: "blouse, trousers", wear: [["female-blouse", "fb-rose-silk"], ["female-trousers", "fb-denim-classic"]] },
    { name: "t-shirt, skirt", wear: [["female-t-shirt", "fb-saffron-stripe"], ["female-skirt", "fb-emerald-velvet"]] },
    { name: "nothing under it", wear: [] },
  ];
  const ABAYA_CLOTH = "fb-black-crepe";
  it.each(["light", "dark"] as const)("writes .preview/wardrobe/abaya-a1-%s.html", (theme) => {
    const t = THEMES[theme];
    const stage = (look: Look, abaya: string | null, zoom = 1, focus: [number, number] = [300, 500]) => {
      let worn: WornGarment[] = [];
      const by: Record<string, Partial<Record<FabricRegionId, Fabric>>> = {};
      const all: [string, string][] = abaya ? [...look.wear, ["female-abaya", abaya]] : look.wear;
      for (const [gid, clothId] of all) {
        const g = garmentById(gid)!;
        const cloth = f(clothId);
        worn = wear(worn, cutFrom(g, cloth.id));
        const regions: Partial<Record<FabricRegionId, Fabric>> = { collar: cloth };
        for (const r of g.fabricRegions) regions[r] = cloth;
        by[gid] = regions;
      }
      if (look.sleeve) worn = setSleeve(worn, look.sleeve[0], look.sleeve[1]);
      if (look.skirt) {
        const [sid, choice] = look.skirt;
        worn = worn.map((w) => {
          const skirt = w.garmentId === sid ? skirtOf(w) : undefined;
          return skirt ? { ...w, skirt: { ...skirt, ...choice } } : w;
        });
      }
      const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
      return <MannequinStage outfit={outfit} fabrics={by} zoom={zoom} focus={focus} />;
    };
    const d = draft("female");
    const alone: Look = { name: "the abaya", wear: [] };
    const overDress: Look = OUTFITS[1];
    const rows: { caption: string; node: React.ReactNode }[][] = [
      /* on its own, in black crepe, a plain cloth and a print, and close up in black */
      [
        ...([[ABAYA_CLOTH, "black crepe"], ["fb-apricot-linen", "plain"], ["fb-midnight-floral", "print"]] as const).map(([cloth, kind]) => ({
          caption: `the abaya, ${kind}`,
          node: stage(alone, cloth),
        })),
        { caption: "black crepe, the opening under the neck, 2.4×", node: stage(alone, ABAYA_CLOTH, 2.4, [300, 260]) },
        { caption: "black crepe, the cuff, 2.4×", node: stage(alone, ABAYA_CLOTH, 2.4, [(d.armOutAt(d.wristY, 0) + d.armInAt(d.wristY, 0)) / 2, d.wristY]) },
        { caption: "black crepe, the hem, 2.4×", node: stage(alone, ABAYA_CLOTH, 2.4, [300, 860]) },
        { caption: "over the dress, print, the opening, 2.4×", node: stage(overDress, ABAYA_CLOTH, 2.4, [300, 330]) },
        { caption: "over the dress, print, the cuff, 2.4×", node: stage(overDress, ABAYA_CLOTH, 2.4, [(d.armOutAt(d.wristY, 0) + d.armInAt(d.wristY, 0)) / 2, d.wristY]) },
      ],
      /* over what she wears: each outfit, then the same under the abaya */
      ...[OUTFITS.slice(0, 4), OUTFITS.slice(4)].map((outfits) =>
        outfits.flatMap((look) => [
          { caption: look.name, node: stage(look, null) },
          { caption: `${look.name}, under the abaya`, node: stage(look, ABAYA_CLOTH) },
        ])
      ),
    ];
    const html = renderToStaticMarkup(
      <>
        {rows.map((row, r) => (
          <div key={r} className="row">
            {row.map((tile) => (
              <figure key={tile.caption}>
                {tile.node}
                <figcaption>{tile.caption}</figcaption>
              </figure>
            ))}
          </div>
        ))}
      </>
    );
    const css =
      `<style>body{margin:0;padding:14px;background:${t.page};font:12px system-ui}` +
      `.row{display:flex;flex-wrap:nowrap;width:max-content;gap:10px;margin-bottom:12px}figure{margin:0;width:220px}` +
      `svg{width:220px;height:367px;display:block;background:${t.stage};color:${t.text};border-radius:10px}` +
      `figcaption{margin-top:5px;color:${t.caption}}</style>`;
    writeFileSync(
      `.preview/wardrobe/abaya-a1-${theme}.html`,
      '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + html
    );
  });

  /*
    Round A2, the abaya closed on hidden snaps: on its own in black crepe, a
    plain cloth and a print, with its neckline and the top of its seam, the
    seam's foot at the hem and its cuff close up; its neckline
    over a print dress and over a collared blouse; and each outfit under it
    open, then closed.
  */
  it.each(["light", "dark"] as const)("writes .preview/wardrobe/abaya-a2-%s.html", (theme) => {
    const t = THEMES[theme];
    const stage = (look: Look, front: FrontId, zoom = 1, focus: [number, number] = [300, 500], abaya = ABAYA_CLOTH) => {
      let worn: WornGarment[] = [];
      const by: Record<string, Partial<Record<FabricRegionId, Fabric>>> = {};
      for (const [gid, clothId] of [...look.wear, ["female-abaya", abaya] as [string, string]]) {
        const g = garmentById(gid)!;
        const cloth = f(clothId);
        worn = wear(worn, cutFrom(g, cloth.id));
        const regions: Partial<Record<FabricRegionId, Fabric>> = { collar: cloth };
        for (const r of g.fabricRegions) regions[r] = cloth;
        by[gid] = regions;
      }
      if (look.sleeve) worn = setSleeve(worn, look.sleeve[0], look.sleeve[1]);
      if (look.skirt) {
        const [sid, choice] = look.skirt;
        worn = worn.map((w) => {
          const skirt = w.garmentId === sid ? skirtOf(w) : undefined;
          return skirt ? { ...w, skirt: { ...skirt, ...choice } } : w;
        });
      }
      worn = setFront(worn, "female-abaya", front);
      const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
      return <MannequinStage outfit={outfit} fabrics={by} zoom={zoom} focus={focus} />;
    };
    const d = draft("female");
    const cuff: [number, number] = [(d.armOutAt(d.wristY, 0) + d.armInAt(d.wristY, 0)) / 2, d.wristY];
    const alone: Look = { name: "the abaya", wear: [] };
    const rows: { caption: string; node: React.ReactNode }[][] = [
      /* on its own, closed, in black crepe, a plain cloth and a print, and close up */
      [
        ...([[ABAYA_CLOTH, "black crepe"], ["fb-apricot-linen", "plain"], ["fb-midnight-floral", "print"]] as const).map(([cloth, kind]) => ({
          caption: `closed, ${kind}`,
          node: stage(alone, "closed", 1, [300, 500], cloth),
        })),
        { caption: "closed, the neckline and the seam's top, 2.4×", node: stage(alone, "closed", 2.4, [300, 250]) },
        { caption: "closed, the seam at the hem, 2.4×", node: stage(alone, "closed", 2.4, [300, 860]) },
        { caption: "closed, the cuff, 2.4×", node: stage(alone, "closed", 2.4, cuff) },
        { caption: "closed over the dress, print, the neckline, 2.4×", node: stage(OUTFITS[1], "closed", 2.4, [300, 250]) },
        { caption: "closed over the blouse, its collar, 2.4×", node: stage(OUTFITS[5], "closed", 2.4, [300, 250]) },
      ],
      /* over what she wears: each outfit under it open, then closed */
      ...[OUTFITS.slice(0, 4), OUTFITS.slice(4)].map((outfits) =>
        outfits.flatMap((look) => [
          { caption: `${look.name}, open`, node: stage(look, "open") },
          { caption: `${look.name}, closed`, node: stage(look, "closed") },
        ])
      ),
    ];
    const html = renderToStaticMarkup(
      <>
        {rows.map((row, r) => (
          <div key={r} className="row">
            {row.map((tile) => (
              <figure key={tile.caption}>
                {tile.node}
                <figcaption>{tile.caption}</figcaption>
              </figure>
            ))}
          </div>
        ))}
      </>
    );
    const css =
      `<style>body{margin:0;padding:14px;background:${t.page};font:12px system-ui}` +
      `.row{display:flex;flex-wrap:nowrap;width:max-content;gap:10px;margin-bottom:12px}figure{margin:0;width:220px}` +
      `svg{width:220px;height:367px;display:block;background:${t.stage};color:${t.text};border-radius:10px}` +
      `figcaption{margin-top:5px;color:${t.caption}}</style>`;
    writeFileSync(
      `.preview/wardrobe/abaya-a2-${theme}.html`,
      '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + html
    );
  });

  /*
    Round A3, the abaya's wide and kimono sleeves: whole, open in black crepe,
    a plain cloth and a print, and closed; close up at the shoulder and the
    cuff, on its own and over a print dress in long sleeves; and over a few
    outfits, open and closed.
  */
  it.each(["light", "dark"] as const)("writes .preview/wardrobe/abaya-a3-%s.html", (theme) => {
    const t = THEMES[theme];
    const WIDE: SleeveChoice = { type: "bell", length: "long" };
    const KIMONO: SleeveChoice = { type: "kimono", length: "long" };
    const stage = (look: Look, front: FrontId, sleeve: SleeveChoice, zoom = 1, focus: [number, number] = [300, 500], abaya = ABAYA_CLOTH) => {
      let worn: WornGarment[] = [];
      const by: Record<string, Partial<Record<FabricRegionId, Fabric>>> = {};
      for (const [gid, clothId] of [...look.wear, ["female-abaya", abaya] as [string, string]]) {
        const g = garmentById(gid)!;
        const cloth = f(clothId);
        worn = wear(worn, cutFrom(g, cloth.id));
        const regions: Partial<Record<FabricRegionId, Fabric>> = { collar: cloth };
        for (const r of g.fabricRegions) regions[r] = cloth;
        by[gid] = regions;
      }
      if (look.sleeve) worn = setSleeve(worn, look.sleeve[0], look.sleeve[1]);
      if (look.skirt) {
        const [sid, choice] = look.skirt;
        worn = worn.map((w) => {
          const skirt = w.garmentId === sid ? skirtOf(w) : undefined;
          return skirt ? { ...w, skirt: { ...skirt, ...choice } } : w;
        });
      }
      worn = setSleeve(setFront(worn, "female-abaya", front), "female-abaya", sleeve);
      const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
      return <MannequinStage outfit={outfit} fabrics={by} zoom={zoom} focus={focus} />;
    };
    const d = draft("female");
    const cuff: [number, number] = [(d.armOutAt(d.wristY, 0) + d.armInAt(d.wristY, 0)) / 2, d.wristY];
    const shoulder: [number, number] = [215, 300];
    const alone: Look = { name: "the abaya", wear: [] };
    const plain = "fb-apricot-linen";
    const rows: { caption: string; node: React.ReactNode }[][] = [
      /* whole: open in three cloths, each sleeve; and closed */
      [
        ...([[WIDE, "wide"], [KIMONO, "kimono"]] as const).flatMap(([sleeve, name]) =>
          ([[ABAYA_CLOTH, "black crepe"], [plain, "plain"], ["fb-midnight-floral", "print"]] as const).map(([cloth, kind]) => ({
            caption: `${name}, open, ${kind}`,
            node: stage(alone, "open", sleeve, 1, [300, 500], cloth),
          }))
        ),
        { caption: "wide, closed, black crepe", node: stage(alone, "closed", WIDE) },
        { caption: "kimono, closed, black crepe", node: stage(alone, "closed", KIMONO) },
      ],
      /* close up, in the plain cloth: the shoulder and the cuff; and each cuff over a print dress in long sleeves */
      [
        { caption: "wide, the shoulder, plain, 2.4×", node: stage(alone, "open", WIDE, 2.4, shoulder, plain) },
        { caption: "wide, the cuff, plain, 2.4×", node: stage(alone, "open", WIDE, 2.4, cuff, plain) },
        { caption: "kimono, the shoulder, plain, 2.4×", node: stage(alone, "open", KIMONO, 2.4, shoulder, plain) },
        { caption: "kimono, the cuff, plain, 2.4×", node: stage(alone, "open", KIMONO, 2.4, cuff, plain) },
        { caption: "wide over the dress, long sleeves, the cuff, 2.4×", node: stage(OUTFITS[1], "open", WIDE, 2.4, cuff) },
        { caption: "kimono over the dress, long sleeves, the cuff, 2.4×", node: stage(OUTFITS[1], "open", KIMONO, 2.4, cuff) },
        { caption: "wide, closed over a blouse and trousers", node: stage(OUTFITS[5], "closed", WIDE) },
        { caption: "kimono, closed over a blouse and trousers", node: stage(OUTFITS[5], "closed", KIMONO) },
      ],
      /* over what she wears */
      [
        { caption: "the dress as it arrives, wide, open", node: stage(OUTFITS[0], "open", WIDE) },
        { caption: "the dress as it arrives, kimono, open", node: stage(OUTFITS[0], "open", KIMONO) },
        { caption: "empire A-line maxi, wide, open", node: stage(OUTFITS[2], "open", WIDE) },
        { caption: "empire A-line maxi, kimono, open", node: stage(OUTFITS[2], "open", KIMONO) },
        { caption: "mermaid maxi, wide, closed", node: stage(OUTFITS[3], "closed", WIDE) },
        { caption: "mermaid maxi, kimono, closed", node: stage(OUTFITS[3], "closed", KIMONO) },
        { caption: "nothing under it, wide, open", node: stage(OUTFITS[7], "open", WIDE) },
        { caption: "nothing under it, kimono, open", node: stage(OUTFITS[7], "open", KIMONO) },
      ],
    ];
    const html = renderToStaticMarkup(
      <>
        {rows.map((row, r) => (
          <div key={r} className="row">
            {row.map((tile) => (
              <figure key={tile.caption}>
                {tile.node}
                <figcaption>{tile.caption}</figcaption>
              </figure>
            ))}
          </div>
        ))}
      </>
    );
    const css =
      `<style>body{margin:0;padding:14px;background:${t.page};font:12px system-ui}` +
      `.row{display:flex;flex-wrap:nowrap;width:max-content;gap:10px;margin-bottom:12px}figure{margin:0;width:220px}` +
      `svg{width:220px;height:367px;display:block;background:${t.stage};color:${t.text};border-radius:10px}` +
      `figcaption{margin-top:5px;color:${t.caption}}</style>`;
    writeFileSync(
      `.preview/wardrobe/abaya-a3-${theme}.html`,
      '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + html
    );
  });

  /*
    Round A4, the abaya's butterfly: whole, open and closed in black crepe, a
    plain cloth and a print, beside the regular and kimono sleeves; close up
    at the shoulder, the hand coming out at the wrist and the hem's side, on
    its own and over a print dress in long sleeves; and over the outfits.
  */
  it.each(["light", "dark"] as const)("writes .preview/wardrobe/abaya-a4-%s.html", (theme) => {
    const t = THEMES[theme];
    const BUTTERFLY: SleeveChoice = { type: "butterfly", length: "long" };
    const stage = (look: Look, front: FrontId, sleeve: SleeveChoice, zoom = 1, focus: [number, number] = [300, 500], abaya = ABAYA_CLOTH) => {
      let worn: WornGarment[] = [];
      const by: Record<string, Partial<Record<FabricRegionId, Fabric>>> = {};
      for (const [gid, clothId] of [...look.wear, ["female-abaya", abaya] as [string, string]]) {
        const g = garmentById(gid)!;
        const cloth = f(clothId);
        worn = wear(worn, cutFrom(g, cloth.id));
        const regions: Partial<Record<FabricRegionId, Fabric>> = { collar: cloth };
        for (const r of g.fabricRegions) regions[r] = cloth;
        by[gid] = regions;
      }
      if (look.sleeve) worn = setSleeve(worn, look.sleeve[0], look.sleeve[1]);
      if (look.skirt) {
        const [sid, choice] = look.skirt;
        worn = worn.map((w) => {
          const skirt = w.garmentId === sid ? skirtOf(w) : undefined;
          return skirt ? { ...w, skirt: { ...skirt, ...choice } } : w;
        });
      }
      worn = setSleeve(setFront(worn, "female-abaya", front), "female-abaya", sleeve);
      const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
      return <MannequinStage outfit={outfit} fabrics={by} zoom={zoom} focus={focus} />;
    };
    const d = draft("female");
    const hand: [number, number] = [(d.armOutAt(d.wristY, 0) + d.armInAt(d.wristY, 0)) / 2, d.wristY + 30];
    const shoulder: [number, number] = [215, 300];
    const hemSide: [number, number] = [170, 850];
    const alone: Look = { name: "the abaya", wear: [] };
    const plain = "fb-apricot-linen";
    const rows: { caption: string; node: React.ReactNode }[][] = [
      /* whole: open and closed in three cloths; and beside it, the regular and kimono sleeves */
      [
        ...(["open", "closed"] as const).flatMap((front) =>
          ([[ABAYA_CLOTH, "black crepe"], [plain, "plain"], ["fb-midnight-floral", "print"]] as const).map(([cloth, kind]) => ({
            caption: `butterfly, ${front}, ${kind}`,
            node: stage(alone, front, BUTTERFLY, 1, [300, 500], cloth),
          }))
        ),
        { caption: "regular, open, black crepe", node: stage(alone, "open", { type: "set-in", length: "long" }) },
        { caption: "kimono, open, black crepe", node: stage(alone, "open", { type: "kimono", length: "long" }) },
      ],
      /* close up: the shoulder, the hand at the wrist and the hem's side; over a print dress in long sleeves; closed over a blouse */
      [
        { caption: "the shoulder, plain, 2.4×", node: stage(alone, "open", BUTTERFLY, 2.4, shoulder, plain) },
        { caption: "the hand at the wrist, plain, 2.4×", node: stage(alone, "open", BUTTERFLY, 2.4, hand, plain) },
        { caption: "the hand at the wrist, black crepe, 2.4×", node: stage(alone, "open", BUTTERFLY, 2.4, hand) },
        { caption: "the hem's side, plain, 2.4×", node: stage(alone, "open", BUTTERFLY, 2.4, hemSide, plain) },
        { caption: "over the dress, long sleeves, the wrist, 2.4×", node: stage(OUTFITS[1], "open", BUTTERFLY, 2.4, hand) },
        { caption: "closed, the shoulder, black crepe, 2.4×", node: stage(alone, "closed", BUTTERFLY, 2.4, shoulder) },
        { caption: "closed over a blouse and trousers", node: stage(OUTFITS[5], "closed", BUTTERFLY) },
        { caption: "closed over a blouse, the neckline, 2.4×", node: stage(OUTFITS[5], "closed", BUTTERFLY, 2.4, [300, 250]) },
      ],
      /* over what she wears */
      [
        { caption: "the dress as it arrives, open", node: stage(OUTFITS[0], "open", BUTTERFLY) },
        { caption: "the dress, long sleeves, print, open", node: stage(OUTFITS[1], "open", BUTTERFLY) },
        { caption: "empire A-line maxi, open", node: stage(OUTFITS[2], "open", BUTTERFLY) },
        { caption: "mermaid maxi, closed", node: stage(OUTFITS[3], "closed", BUTTERFLY) },
        { caption: "blouse, A-line maxi skirt, open", node: stage(OUTFITS[4], "open", BUTTERFLY) },
        { caption: "blouse, trousers, open", node: stage(OUTFITS[5], "open", BUTTERFLY) },
        { caption: "t-shirt, skirt, open", node: stage(OUTFITS[6], "open", BUTTERFLY) },
        { caption: "nothing under it, open", node: stage(OUTFITS[7], "open", BUTTERFLY) },
      ],
    ];
    const html = renderToStaticMarkup(
      <>
        {rows.map((row, r) => (
          <div key={r} className="row">
            {row.map((tile) => (
              <figure key={tile.caption}>
                {tile.node}
                <figcaption>{tile.caption}</figcaption>
              </figure>
            ))}
          </div>
        ))}
      </>
    );
    const css =
      `<style>body{margin:0;padding:14px;background:${t.page};font:12px system-ui}` +
      `.row{display:flex;flex-wrap:nowrap;width:max-content;gap:10px;margin-bottom:12px}figure{margin:0;width:220px}` +
      `svg{width:220px;height:367px;display:block;background:${t.stage};color:${t.text};border-radius:10px}` +
      `figcaption{margin-top:5px;color:${t.caption}}</style>`;
    writeFileSync(
      `.preview/wardrobe/abaya-a4-${theme}.html`,
      '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + html
    );
  });
});

/**
 * Round 4's details, on a light page and a dark one, in a plain cloth and a
 * print: both jackets over the top each is worn over — whole, and the end of
 * a sleeve close up, where its buttons are and the cuff under it shows — and
 * her blouse, whole and its bodice close up, in the sleeve it arrives in and
 * in a dolman, which has no armhole. Typed out, so the same tiles render
 * before and after. (The dress's cuts are on the neckline sheets.)
 */
describe("round 4, light and dark", () => {
  const THEMES = {
    light: { page: "#efeae4", stage: "#ffffff", text: "#1f1915", caption: "#555" },
    dark: { page: "#1a1714", stage: "#141110", text: "#f5f1ea", caption: "#b9b2a8" },
  } as const;
  const CLOTHS = [["fb-apricot-linen", "plain"], ["fb-midnight-floral", "print"]] as const;
  type Row = { what: string; body: BodyType; ids: string[]; close: [number, number]; zoom: number; sleeve?: SleeveChoice; closeLabel?: string };
  /** The left sleeve's end: the middle of the arm a little above the wrist. */
  const sleeveEnd = (body: BodyType): [number, number] => {
    const d = draft(body);
    const y = d.wristY - 22;
    return [(d.armOutAt(y, 0) + d.armInAt(y, 0)) / 2, y];
  };
  const SHEETS: [name: string, rows: Row[]][] = [
    ["jackets", (["male", "female"] as const).map((body) => ({
      what: `${body} jacket`,
      body,
      ids: [body === "male" ? "male-shirt" : "female-blouse", `${body}-jacket`],
      close: sleeveEnd(body),
      zoom: 3.5,
    }))],
    /* both jackets' flap pockets, close up, side by side: his were set lower than hers */
    ["pockets", (["male", "female"] as const).map((body) => ({
      what: `${body} jacket`,
      body,
      ids: [body === "male" ? "male-shirt" : "female-blouse", `${body}-jacket`],
      close: (body === "male" ? [300, 470] : [300, 440]) as [number, number],
      zoom: 2.6,
      closeLabel: "the pockets",
    }))],
    ["blouse", [
      { what: "blouse", body: "female", ids: ["female-blouse"], close: [300, 300], zoom: 2.4 },
      { what: "blouse, dolman", body: "female", ids: ["female-blouse"], close: [300, 300], zoom: 2.4, sleeve: { type: "dolman", length: "long", cuff: "formal" } },
    ]],
  ];
  it.each(SHEETS.flatMap(([name, rows]) => (["light", "dark"] as const).map((theme) => [`${name}-${theme}`, rows, theme] as const)))(
    "writes .preview/wardrobe/r4-%s.html",
    (file, rows, theme) => {
      const t = THEMES[theme];
      const stage = (row: Row, clothId: string, zoom: number, at: [number, number]) => {
        let worn: WornGarment[] = [];
        const by: Record<string, Partial<Record<FabricRegionId, Fabric>>> = {};
        const last = row.ids[row.ids.length - 1];
        for (const gid of row.ids) {
          const g = garmentById(gid)!;
          /* the garment being shown in the cloth being shown, anything under it in another */
          const cloth = gid === last ? f(clothId) : f("fb-rose-silk");
          worn = wear(worn, cutFrom(g, cloth.id));
          const regions: Partial<Record<FabricRegionId, Fabric>> = { collar: cloth };
          for (const r of g.fabricRegions) regions[r] = cloth;
          by[gid] = regions;
        }
        if (row.sleeve) worn = setSleeve(worn, last, row.sleeve);
        const outfit: Outfit = { bodyType: row.body, skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
        return <MannequinStage outfit={outfit} fabrics={by} zoom={zoom} focus={at} />;
      };
      const html = renderToStaticMarkup(
        <>
          {rows.map((row) => (
            <div key={row.what} className="row">
              {CLOTHS.flatMap(([cloth, kind]) => [
                <figure key={`${cloth}-whole`}>
                  {stage(row, cloth, 1, [300, 500])}
                  <figcaption>{`${row.what}, ${kind} — whole`}</figcaption>
                </figure>,
                <figure key={`${cloth}-close`}>
                  {stage(row, cloth, row.zoom, row.close)}
                  <figcaption>{`${row.what}, ${kind} — ${row.closeLabel ?? (row.ids.length > 1 ? "the sleeve's end" : "the bodice")}, ${row.zoom}×`}</figcaption>
                </figure>,
              ])}
            </div>
          ))}
        </>
      );
      const css =
        `<style>body{margin:0;padding:14px;background:${t.page};font:12px system-ui}` +
        `.row{display:flex;flex-wrap:nowrap;width:max-content;gap:12px;margin-bottom:12px}figure{margin:0}` +
        `svg{width:360px;height:727px;display:block;background:${t.stage};color:${t.text};border-radius:10px}` +
        `figcaption{margin-top:5px;color:${t.caption}}</style>`;
      writeFileSync(
        `.preview/wardrobe/r4-${file}.html`,
        '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + html
      );
    }
  );
});

/**
 * His band collars on each garment that offers them: the regular thobe collar
 * and its short version on the thobe alone, and the mandarin on the thobe, the
 * shirt and the polo — whole, and the collar and the top of the placket close
 * up, in a plain cloth and a print, on a light page and a dark one. The
 * thobe's regular and mandarin share a sheet, as they did the round before, so
 * the two compare tile for tile; the short regular, new to the thobe, has its
 * own.
 */
describe("his band collars, light and dark", () => {
  const THEMES = {
    light: { page: "#efeae4", stage: "#ffffff", text: "#1f1915", caption: "#555" },
    dark: { page: "#1a1714", stage: "#141110", text: "#f5f1ea", caption: "#b9b2a8" },
  } as const;
  const CLOTHS = [["fb-apricot-linen", "plain"], ["fb-midnight-floral", "print"]] as const;
  const SHEETS = [
    ["thobe", "male-thobe", [["regular", "male-regular-collar"], ["mandarin", "male-mandarin-collar"]]],
    ["thobe-short", "male-thobe", [["regular, short", "male-regular-short-collar"]]],
    ["polo", "male-polo", [["mandarin", "male-mandarin-collar"]]],
    ["shirt", "male-shirt", [["mandarin", "male-mandarin-collar"]]],
  ] as const;
  it.each(SHEETS.flatMap((sheet) => (["light", "dark"] as const).map((theme) => [`${sheet[0]}-${theme}`, sheet, theme] as const)))(
    "writes .preview/wardrobe/r6-%s.html",
    (file, [, gid, rows], theme) => {
      const t = THEMES[theme];
      const g = garmentById(gid)!;
      const stage = (collarId: string, clothId: string, zoom: number, at: [number, number]) => {
        const cloth = f(clothId);
        const regions: Partial<Record<FabricRegionId, Fabric>> = { collar: cloth };
        for (const r of g.fabricRegions) regions[r] = cloth;
        const worn = setCollar(wear([], cutFrom(g, cloth.id)), g.id, collarId);
        const outfit: Outfit = { bodyType: "male", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
        return <MannequinStage outfit={outfit} fabrics={{ [g.id]: regions }} zoom={zoom} focus={at} />;
      };
      const html = renderToStaticMarkup(
        <>
          {rows.map(([name, id]) => (
            <div key={name} className="row">
              {CLOTHS.flatMap(([cloth, kind]) => [
                <figure key={`${cloth}-whole`}>
                  {stage(id, cloth, 1, [300, 500])}
                  <figcaption>{`${g.name.en}, ${name}, ${kind} — whole`}</figcaption>
                </figure>,
                <figure key={`${cloth}-close`}>
                  {stage(id, cloth, 3.4, [300, 222])}
                  <figcaption>{`${g.name.en}, ${name}, ${kind} — the collar, 3.4×`}</figcaption>
                </figure>,
              ])}
            </div>
          ))}
        </>
      );
      const css =
        `<style>body{margin:0;padding:14px;background:${t.page};font:12px system-ui}` +
        `.row{display:flex;flex-wrap:nowrap;width:max-content;gap:12px;margin-bottom:12px}figure{margin:0}` +
        `svg{width:360px;height:727px;display:block;background:${t.stage};color:${t.text};border-radius:10px}` +
        `figcaption{margin-top:5px;color:${t.caption}}</style>`;
      writeFileSync(
        `.preview/wardrobe/r6-${file}.html`,
        '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + html
      );
    }
  );
});

/**
 * The base layer — her tank and shorts, his shorts — under every outfit: both
 * bodies with nothing on, with a top alone, with a bottom alone, in the
 * dress's deepest cuts, and in a jacket with no top under it, on a light page
 * and a dark one. Typed out, so the same tiles render before it exists and
 * after.
 */
describe("the base layer, light and dark", () => {
  const THEMES = {
    light: { page: "#efeae4", stage: "#ffffff", text: "#1f1915", caption: "#555" },
    dark: { page: "#1a1714", stage: "#141110", text: "#f5f1ea", caption: "#b9b2a8" },
  } as const;
  type Tile = { label: string; body: BodyType; ids: string[]; zoom: number; at: [number, number]; neckline?: string };
  const TORSO: [number, number] = [300, 380];
  const ROWS: Tile[][] = [
    [
      { label: "her, nothing on — whole", body: "female", ids: [], zoom: 1, at: [300, 500] },
      { label: "her, nothing on — 2×", body: "female", ids: [], zoom: 2, at: TORSO },
      { label: "him, nothing on — whole", body: "male", ids: [], zoom: 1, at: [300, 500] },
      { label: "him, nothing on — 2×", body: "male", ids: [], zoom: 2, at: TORSO },
    ],
    [
      { label: "her t-shirt alone", body: "female", ids: ["female-t-shirt"], zoom: 1, at: [300, 500] },
      { label: "her blouse alone", body: "female", ids: ["female-blouse"], zoom: 1, at: [300, 500] },
      { label: "his t-shirt alone", body: "male", ids: ["male-t-shirt"], zoom: 1, at: [300, 500] },
      { label: "his polo alone", body: "male", ids: ["male-polo"], zoom: 1, at: [300, 500] },
    ],
    [
      { label: "her trousers alone", body: "female", ids: ["female-trousers"], zoom: 1, at: [300, 500] },
      { label: "her skirt alone", body: "female", ids: ["female-skirt"], zoom: 1, at: [300, 500] },
      { label: "her trousers alone — 2×", body: "female", ids: ["female-trousers"], zoom: 2, at: TORSO },
      { label: "his trousers alone", body: "male", ids: ["male-trousers"], zoom: 1, at: [300, 500] },
    ],
    (["off-shoulder", "halter", "v", "cowl"] as const).map((cut) => ({
      label: `dress, ${cut} — 1.6×`,
      body: "female" as const,
      ids: ["female-dress"],
      zoom: 1.6,
      at: [300, 330] as [number, number],
      neckline: `female-${cut}-neckline`,
    })),
    [
      { label: "her jacket, no top", body: "female", ids: ["female-jacket"], zoom: 1, at: [300, 500] },
      { label: "her jacket, no top — 2×", body: "female", ids: ["female-jacket"], zoom: 2, at: TORSO },
      { label: "her jacket over trousers", body: "female", ids: ["female-trousers", "female-jacket"], zoom: 1, at: [300, 500] },
      { label: "his jacket, no top", body: "male", ids: ["male-jacket"], zoom: 1, at: [300, 500] },
    ],
  ];
  it.each((["light", "dark"] as const).map((theme) => [theme] as const))("writes .preview/wardrobe/r7-base-%s.html", (theme) => {
    const t = THEMES[theme];
    const cloth = f("fb-apricot-linen");
    const stage = (x: Tile) => {
      let worn: WornGarment[] = [];
      const by: Record<string, Partial<Record<FabricRegionId, Fabric>>> = {};
      for (const gid of x.ids) {
        const g = garmentById(gid)!;
        worn = wear(worn, cutFrom(g, cloth.id));
        const regions: Partial<Record<FabricRegionId, Fabric>> = { collar: cloth };
        for (const r of g.fabricRegions) regions[r] = cloth;
        by[gid] = regions;
      }
      if (x.neckline) worn = setNeckline(worn, x.ids[0], x.neckline);
      const outfit: Outfit = { bodyType: x.body, skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
      return <MannequinStage outfit={outfit} fabrics={by} zoom={x.zoom} focus={x.at} />;
    };
    const html = renderToStaticMarkup(
      <>
        {ROWS.map((row, r) => (
          <div key={r} className="row">
            {row.map((x) => (
              <figure key={x.label}>
                {stage(x)}
                <figcaption>{x.label}</figcaption>
              </figure>
            ))}
          </div>
        ))}
      </>
    );
    const css =
      `<style>body{margin:0;padding:14px;background:${t.page};font:12px system-ui}` +
      `.row{display:flex;flex-wrap:nowrap;width:max-content;gap:12px;margin-bottom:12px}figure{margin:0}` +
      `svg{width:300px;height:606px;display:block;background:${t.stage};color:${t.text};border-radius:10px}` +
      `figcaption{margin-top:5px;color:${t.caption}}</style>`;
    writeFileSync(
      `.preview/wardrobe/r7-base-${theme}.html`,
      '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + html
    );
  });
});

/**
 * The dress in each of its fifteen necklines, for the neckline audit: whole and
 * close up, in a plain cloth and a busy print, on a light page and a dark one —
 * and, on a sheet of its own, every sleeve and every collar each cut offers, as
 * the pickers offer them. Nothing is changed by it; it is the before.
 */
describe("dress necklines, audit", () => {
  const g = garmentById("female-dress")!;
  const cuts = necklinesForGarment(g);
  const PLAIN = "fb-apricot-linen";
  const PRINT = "fb-midnight-floral";
  const THEMES = {
    light: { page: "#efeae4", stage: "#ffffff", text: "#1f1915", caption: "#555" },
    dark: { page: "#1a1714", stage: "#141110", text: "#f5f1ea", caption: "#b9b2a8" },
  } as const;
  const css =
    "<style>body{margin:0;padding:14px;font:12px system-ui;background:#efeae4}" +
    ".row{display:flex;flex-wrap:nowrap;width:max-content;gap:12px;padding:12px;border-radius:12px;margin-bottom:12px}" +
    "figure{margin:0}svg{width:220px;height:444px;display:block;border-radius:10px}figcaption{margin-top:5px}" +
    Object.entries(THEMES)
      .map(([k, t]) => `.${k}{background:${t.page}}.${k} svg{background:${t.stage};color:${t.text}}.${k} figcaption{color:${t.caption}}`)
      .join("") +
    "</style>";
  /** The neckline close up: the throat to the waist, both shoulders in. */
  const CLOSE: [number, number] = [300, 250];
  const CLOSE_ZOOM = 2.8;
  const short = (id: string) => id.replace(/^female-/, "").replace(/-neckline$/, "");
  const dressed = (neckline: string, extra: { sleeve?: SleeveChoice; collar?: string } = {}, cloth = PLAIN) => {
    let worn = wear([], cutFrom(g, cloth));
    worn = setNeckline(worn, g.id, neckline);
    if (extra.collar) worn = setCollar(worn, g.id, extra.collar);
    if (extra.sleeve) worn = setSleeve(worn, g.id, extra.sleeve);
    return worn;
  };
  const stage = (worn: WornGarment[], cloth: string, zoom: number, at: [number, number]) => {
    const fabric = f(cloth);
    const regions: Partial<Record<FabricRegionId, Fabric>> = { collar: fabric };
    for (const r of g.fabricRegions) regions[r] = fabric;
    const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
    return <MannequinStage outfit={outfit} fabrics={{ [g.id]: regions }} zoom={zoom} focus={at} />;
  };
  const fig = (key: string, label: string, node: React.ReactNode) => (
    <figure key={key}>
      {node}
      <figcaption>{label}</figcaption>
    </figure>
  );
  const page = (body: React.ReactNode) =>
    '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + renderToStaticMarkup(<>{body}</>);

  /* fifteen, less the one-shoulder, retired for the asymmetrical under its name */
  it("offers fourteen", () => {
    if (cuts.length !== 14) throw new Error(`the dress offers ${cuts.length} necklines`);
  });

  it.each(cuts.map((n) => [short(n.id), n.id] as const))("writes .preview/wardrobe/necklines-%s.html", (name, id) => {
    const rows = (["light", "dark"] as const).map((theme) => (
      <div key={theme} className={`row ${theme}`}>
        {[PLAIN, PRINT].flatMap((cloth) => [
          fig(`${cloth}-whole`, `${name} — ${cloth === PLAIN ? "plain" : "print"}, whole`, stage(dressed(id, {}, cloth), cloth, 1, [300, 500])),
          fig(`${cloth}-close`, `${name} — ${cloth === PLAIN ? "plain" : "print"}, the neckline ${CLOSE_ZOOM}×`, stage(dressed(id, {}, cloth), cloth, CLOSE_ZOOM, CLOSE)),
        ])}
      </div>
    ));
    writeFileSync(`.preview/wardrobe/necklines-${name}.html`, page(rows));
  });

  it.each(cuts.map((n) => [short(n.id), n] as const))("writes .preview/wardrobe/necklines-%s-options.html", (name, n) => {
    /* every sleeve the cut offers, at its first length, and sleeveless */
    const types = sleeveTypesFor(g, n);
    /* a cut whose band is the top of its own sleeve offers that sleeve at every length, and never none */
    const own = types.length > 0 && types.every((t) => SLEEVE_KINDS[t].construction === "band");
    const sleeves = own
      ? types.flatMap((type) =>
          sleeveLengthsFor(type).map((length) =>
            fig(`${type}-${length}`, `${type}, ${length}`, stage(dressed(n.id, { sleeve: { type, length } }), PLAIN, 1.2, [300, 400]))
          )
        )
      : types.length
      ? [
          ...types.map((type) => {
            const length = sleeveLengthsFor(type).find((l) => l !== "sleeveless")!;
            return fig(type, `${type}, ${length}`, stage(dressed(n.id, { sleeve: { type, length } }), PLAIN, 1.8, [300, 300]));
          }),
          fig("sleeveless", "sleeveless", stage(dressed(n.id, { sleeve: { type: "set-in", length: "sleeveless" } }), PLAIN, 1.8, [300, 300])),
        ]
      : [fig("none", "no sleeve on this cut", stage(dressed(n.id), PLAIN, 1.8, [300, 300]))];
    /* every collar the cut keeps — the ones the picker offers on it */
    const kept = collarsForGarment(g).filter((c) => {
      const w = dressed(n.id, { collar: c.id }).find((x) => x.garmentId === g.id);
      return w ? collarOf(w)?.id === c.id : false;
    });
    const collarTiles = kept.map((c) =>
      fig(c.id, short(c.id.replace(/-collar$/, "-neckline")), stage(dressed(n.id, { collar: c.id }), PLAIN, CLOSE_ZOOM, CLOSE))
    );
    writeFileSync(
      `.preview/wardrobe/necklines-${name}-options.html`,
      page(
        <>
          <div className="row light">{sleeves}</div>
          <div className="row light">
            {collarTiles.length ? collarTiles : [fig("no-collar", "no collar on this cut", stage(dressed(n.id), PLAIN, CLOSE_ZOOM, CLOSE))]}
          </div>
        </>
      )
    );
  });

  it("writes .preview/wardrobe/necklines-overview.html", () => {
    const rows = ([["light", PLAIN], ["dark", PLAIN], ["light", PRINT], ["dark", PRINT]] as const).map(([theme, cloth]) => (
      /* five to a row, so the sheet stays readable */
      [0, 5, 10].map((from) => (
        <div key={`${theme}-${cloth}-${from}`} className={`row ${theme}`}>
          {cuts.slice(from, from + 5).map((n) => fig(n.id, `${short(n.id)} — ${cloth === PLAIN ? "plain" : "print"}`, stage(dressed(n.id, {}, cloth), cloth, CLOSE_ZOOM, CLOSE)))}
        </div>
      ))
    ));
    writeFileSync(".preview/wardrobe/necklines-overview.html", page(rows));
  });
});

/**
 * The dress's empire waist and its bodice, on a light page and a dark one:
 * the empire waist at every shape and length, in short and long sleeves, in a
 * plain cloth and a print; and the bodice at every waist, and the blouse's —
 * close up, whole, and the sweetheart and the wrap close up, the two cuts
 * whose seams were drawn their own way.
 */
describe("the dress's empire waist and bodice, light and dark", () => {
  const THEMES = {
    light: { page: "#efeae4", stage: "#ffffff", text: "#1f1915", caption: "#555" },
    dark: { page: "#1a1714", stage: "#141110", text: "#f5f1ea", caption: "#b9b2a8" },
  } as const;
  type Tile = {
    caption: string;
    ids: string[];
    skirt?: Partial<{ shape: SkirtShapeId; length: SkirtLengthId; waist: WaistId }>;
    sleeve?: SleeveChoice;
    neckline?: string;
    cloth: string;
    zoom: number;
    focus: [number, number];
  };
  const PLAIN = "fb-apricot-linen";
  const PRINT = "fb-midnight-floral";
  const SHORT: SleeveChoice = { type: "set-in", length: "short" };
  const LONG: SleeveChoice = { type: "set-in", length: "long" };
  const stage = (tile: Tile) => {
    let worn: WornGarment[] = [];
    const by: Record<string, Partial<Record<FabricRegionId, Fabric>>> = {};
    const first = tile.ids[0];
    for (const gid of tile.ids) {
      const g = garmentById(gid)!;
      /* the garment being shown in the cloth being shown, anything with it in another */
      const cloth = gid === first ? f(tile.cloth) : f("fb-rose-silk");
      worn = wear(worn, cutFrom(g, cloth.id));
      const regions: Partial<Record<FabricRegionId, Fabric>> = { collar: cloth };
      for (const r of g.fabricRegions) regions[r] = cloth;
      by[gid] = regions;
    }
    if (tile.neckline) worn = setNeckline(worn, first, tile.neckline);
    if (tile.sleeve) worn = setSleeve(worn, first, tile.sleeve);
    if (tile.skirt) {
      worn = worn.map((w) => {
        const skirt = w.garmentId === first ? skirtOf(w) : undefined;
        return skirt ? { ...w, skirt: { ...skirt, ...tile.skirt } } : w;
      });
    }
    const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
    return <MannequinStage outfit={outfit} fabrics={by} zoom={tile.zoom} focus={tile.focus} />;
  };
  const write = (theme: keyof typeof THEMES, rows: Tile[][], name: string) => {
    const t = THEMES[theme];
    const html = renderToStaticMarkup(
      <>
        {rows.map((row, r) => (
          <div key={r} className="row">
            {row.map((tile) => (
              <figure key={tile.caption}>
                {stage(tile)}
                <figcaption>{tile.caption}</figcaption>
              </figure>
            ))}
          </div>
        ))}
      </>
    );
    const css =
      `<style>body{margin:0;padding:14px;background:${t.page};font:12px system-ui}` +
      `.row{display:flex;flex-wrap:nowrap;width:max-content;gap:10px;margin-bottom:12px}figure{margin:0;width:220px}` +
      `svg{width:220px;height:367px;display:block;background:${t.stage};color:${t.text};border-radius:10px}` +
      `figcaption{margin-top:5px;color:${t.caption}}</style>`;
    writeFileSync(
      `.preview/wardrobe/${name}-${theme}.html`,
      '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + html
    );
  };

  /* every shape at every length it is cut at, a row each for short and long sleeves, plain and print */
  it.each(["light", "dark"] as const)("writes .preview/wardrobe/dress-empire-%s.html", (theme) => {
    const styles = (["flared", "aline", "pencil", "mermaid"] as const).flatMap((shape) =>
      shapeLengths(shape, ["knee", "midi", "maxi"]).map((length) => ({ shape, length }))
    );
    const kinds = [
      [SHORT, PLAIN, "short sleeves, plain"],
      [SHORT, PRINT, "short sleeves, print"],
      [LONG, PLAIN, "long sleeves, plain"],
      [LONG, PRINT, "long sleeves, print"],
    ] as const;
    const rows = kinds.map(([sleeve, cloth, kind]) =>
      styles.map(
        ({ shape, length }): Tile => ({
          caption: `empire, ${shape}, ${length}, ${kind}`,
          ids: ["female-dress"],
          skirt: { shape, length, waist: "empire" },
          sleeve,
          cloth,
          zoom: 1,
          focus: [300, 500],
        })
      )
    );
    write(theme, rows, "dress-empire");
  });

  /* the bodice at every waist, plain and print, and the blouse: close up, whole, and the sweetheart and the wrap close up */
  it.each(["light", "dark"] as const)("writes .preview/wardrobe/dress-bodice-%s.html", (theme) => {
    const waists = ["empire", "natural", "dropped"] as const;
    const cloths = [
      [PLAIN, "plain"],
      [PRINT, "print"],
    ] as const;
    const row = (zoom: number, focus: [number, number], how: string): Tile[] => [
      ...waists.flatMap((waist) =>
        cloths.map(([cloth, kind]): Tile => ({ caption: `${waist} waist, ${kind}${how}`, ids: ["female-dress"], skirt: { waist }, cloth, zoom, focus }))
      ),
      ...cloths.map(([cloth, kind]): Tile => ({ caption: `blouse, ${kind}${how}`, ids: ["female-blouse"], cloth, zoom, focus })),
    ];
    const rows: Tile[][] = [
      row(2.4, [300, 300], ", the bodice 2.4×"),
      row(1, [300, 500], ""),
      [
        ...waists.flatMap((waist) =>
          cloths.map(([cloth, kind]): Tile => ({
            caption: `sweetheart, ${waist} waist, ${kind}, 2.4×`,
            ids: ["female-dress"],
            neckline: "female-sweetheart-neckline",
            skirt: { waist },
            cloth,
            zoom: 2.4,
            focus: [300, 300],
          }))
        ),
        ...cloths.map(([cloth, kind]): Tile => ({
          caption: `wrap, natural waist, ${kind}, 2.4×`,
          ids: ["female-dress"],
          neckline: "female-wrap-neckline",
          cloth,
          zoom: 2.4,
          focus: [300, 300],
        })),
      ],
    ];
    write(theme, rows, "dress-bodice");
  });
});

/**
 * Every seam the dress and the blouse are sewn with, close up, on a light
 * page and a dark one, in a plain cloth and a print: the armhole and the
 * waist seam, a raglan's, a dropped shoulder's, a cuff's, an off-shoulder's
 * band, a halter's, and the blouse's armhole and cuff.
 */
describe("the dress's and the blouse's seams, light and dark", () => {
  const THEMES = {
    light: { page: "#efeae4", stage: "#ffffff", text: "#1f1915", caption: "#555" },
    dark: { page: "#1a1714", stage: "#141110", text: "#f5f1ea", caption: "#b9b2a8" },
  } as const;
  type Tile = { caption: string; id: string; sleeve: SleeveChoice; neckline?: string; zoom: number; focus: [number, number] };
  const d = draft("female");
  const wrist: [number, number] = [(d.armOutAt(d.wristY, 0) + d.armInAt(d.wristY, 0)) / 2, d.wristY - 6];
  const TILES: Tile[] = [
    { caption: "armhole and waist seam", id: "female-dress", sleeve: { type: "set-in", length: "short" }, zoom: 2.4, focus: [300, 300] },
    { caption: "the cuff's seam", id: "female-dress", sleeve: { type: "set-in", length: "long", cuff: "plain" }, zoom: 3.4, focus: wrist },
    { caption: "raglan", id: "female-dress", sleeve: { type: "raglan", length: "short" }, zoom: 2.4, focus: [300, 280] },
    { caption: "dropped shoulder", id: "female-dress", sleeve: { type: "drop", length: "elbow" }, zoom: 2.4, focus: [300, 290] },
    { caption: "off-shoulder band", id: "female-dress", sleeve: { type: "off-shoulder", length: "elbow" }, neckline: "female-off-shoulder-neckline", zoom: 2.4, focus: [300, 290] },
    { caption: "halter", id: "female-dress", sleeve: { type: "set-in", length: "sleeveless" }, neckline: "female-halter-neckline", zoom: 2.4, focus: [300, 260] },
    { caption: "blouse, armhole", id: "female-blouse", sleeve: { type: "set-in", length: "long", cuff: "formal" }, zoom: 2.4, focus: [300, 300] },
    { caption: "blouse, the cuff's seam", id: "female-blouse", sleeve: { type: "set-in", length: "long", cuff: "formal" }, zoom: 3.4, focus: wrist },
  ];
  const stage = (tile: Tile, clothId: string) => {
    const g = garmentById(tile.id)!;
    const cloth = f(clothId);
    let worn: WornGarment[] = wear([], cutFrom(g, cloth.id));
    if (tile.neckline) worn = setNeckline(worn, tile.id, tile.neckline);
    worn = setSleeve(worn, tile.id, tile.sleeve);
    const regions: Partial<Record<FabricRegionId, Fabric>> = { collar: cloth };
    for (const r of g.fabricRegions) regions[r] = cloth;
    const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
    return <MannequinStage outfit={outfit} fabrics={{ [tile.id]: regions }} zoom={tile.zoom} focus={tile.focus} />;
  };
  it.each(["light", "dark"] as const)("writes .preview/wardrobe/dress-seams-%s.html", (theme) => {
    const t = THEMES[theme];
    const rows = (["fb-apricot-linen", "fb-midnight-floral"] as const).map((cloth) => ({ cloth, kind: cloth === "fb-apricot-linen" ? "plain" : "print" }));
    const html = renderToStaticMarkup(
      <>
        {rows.map(({ cloth, kind }) => (
          <div key={cloth} className="row">
            {TILES.map((tile) => (
              <figure key={tile.caption}>
                {stage(tile, cloth)}
                <figcaption>{`${tile.caption}, ${kind}`}</figcaption>
              </figure>
            ))}
          </div>
        ))}
      </>
    );
    const css =
      `<style>body{margin:0;padding:14px;background:${t.page};font:12px system-ui}` +
      `.row{display:flex;flex-wrap:nowrap;width:max-content;gap:10px;margin-bottom:12px}figure{margin:0;width:220px}` +
      `svg{width:220px;height:367px;display:block;background:${t.stage};color:${t.text};border-radius:10px}` +
      `figcaption{margin-top:5px;color:${t.caption}}</style>`;
    writeFileSync(
      `.preview/wardrobe/dress-seams-${theme}.html`,
      '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + html
    );
  });
});

/**
 * Every other garment's seams, close up, on a light page and a dark one, in a
 * plain cloth and a print: the tops' armholes and cuffs, a polo's armband,
 * the shirt collars' band, the jackets' armholes, the trousers' centre seam,
 * and the abaya's armholes and the centre seam it closes under.
 */
describe("every other garment's seams, light and dark", () => {
  const THEMES = {
    light: { page: "#efeae4", stage: "#ffffff", text: "#1f1915", caption: "#555" },
    dark: { page: "#1a1714", stage: "#141110", text: "#f5f1ea", caption: "#b9b2a8" },
  } as const;
  type Tile = { caption: string; id: string; sleeve?: SleeveChoice; front?: FrontId; zoom: number; focus: [number, number] };
  /* each body's left armhole, its left wrist, its throat and its centre front at the crotch */
  const at = (body: BodyType) => {
    const d = draft(body);
    const out = d.armOutAt(d.armpitY, 0);
    return {
      armhole: [out + 34, (d.shoulderPointY + d.armpitY) / 2 + 6] as [number, number],
      wrist: [(d.armOutAt(d.wristY, 0) + d.armInAt(d.wristY, 0)) / 2, d.wristY - 6] as [number, number],
      neck: [300, d.shoulderPointY - 30] as [number, number],
      fly: [300, d.crotchY - 30] as [number, number],
    };
  };
  const her = at("female");
  const him = at("male");
  const TILES: Tile[] = [
    { caption: "her t-shirt, armhole", id: "female-t-shirt", zoom: 2.4, focus: her.armhole },
    { caption: "her t-shirt, rib cuff", id: "female-t-shirt", sleeve: { type: "set-in", length: "long", cuff: "rib" }, zoom: 3.4, focus: her.wrist },
    { caption: "her shirt collar's band", id: "female-blouse", zoom: 3.4, focus: her.neck },
    { caption: "his t-shirt, armhole", id: "male-t-shirt", zoom: 2.4, focus: him.armhole },
    { caption: "his t-shirt, rib cuff", id: "male-t-shirt", sleeve: { type: "set-in", length: "long", cuff: "rib" }, zoom: 3.4, focus: him.wrist },
    { caption: "his shirt, armhole", id: "male-shirt", zoom: 2.4, focus: him.armhole },
    { caption: "his shirt, the cuff's seam", id: "male-shirt", zoom: 3.4, focus: him.wrist },
    { caption: "his shirt collar's band", id: "male-shirt", zoom: 3.4, focus: him.neck },
    { caption: "his polo, armhole and armband", id: "male-polo", zoom: 2.4, focus: him.armhole },
    { caption: "his thobe, armhole", id: "male-thobe", zoom: 2.4, focus: him.armhole },
    { caption: "his thobe, the cuff's seam", id: "male-thobe", zoom: 3.4, focus: him.wrist },
    { caption: "her jacket, armhole", id: "female-jacket", zoom: 2.4, focus: her.armhole },
    { caption: "his jacket, armhole", id: "male-jacket", zoom: 2.4, focus: him.armhole },
    { caption: "her trousers, centre seam", id: "female-trousers", zoom: 2.4, focus: her.fly },
    { caption: "his trousers, centre seam", id: "male-trousers", zoom: 2.4, focus: him.fly },
    { caption: "abaya, regular sleeve", id: "female-abaya", zoom: 2.4, focus: her.armhole },
    { caption: "abaya, wide sleeve", id: "female-abaya", sleeve: { type: "bell", length: "long" }, zoom: 2.4, focus: her.armhole },
    { caption: "abaya closed, centre seam", id: "female-abaya", front: "closed", zoom: 1.6, focus: [300, 560] },
  ];
  const stage = (tile: Tile, clothId: string) => {
    const g = garmentById(tile.id)!;
    const cloth = f(clothId);
    let worn: WornGarment[] = wear([], cutFrom(g, cloth.id));
    if (tile.sleeve) worn = setSleeve(worn, tile.id, tile.sleeve);
    if (tile.front) worn = setFront(worn, tile.id, tile.front);
    const regions: Partial<Record<FabricRegionId, Fabric>> = { collar: cloth };
    for (const r of g.fabricRegions) regions[r] = cloth;
    const body: BodyType = tile.id.startsWith("male-") ? "male" : "female";
    const outfit: Outfit = { bodyType: body, skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
    return <MannequinStage outfit={outfit} fabrics={{ [tile.id]: regions }} zoom={tile.zoom} focus={tile.focus} />;
  };
  it.each(["light", "dark"] as const)("writes .preview/wardrobe/garment-seams-%s.html", (theme) => {
    const t = THEMES[theme];
    const rows = (["fb-apricot-linen", "fb-midnight-floral"] as const).map((cloth) => ({ cloth, kind: cloth === "fb-apricot-linen" ? "plain" : "print" }));
    /* six to a row, so the sheet can be shot a row at a time */
    const html = renderToStaticMarkup(
      <>
        {rows.flatMap(({ cloth, kind }) =>
          [0, 6, 12].map((from) => (
            <div key={`${cloth}-${from}`} className="row">
              {TILES.slice(from, from + 6).map((tile) => (
                <figure key={tile.caption}>
                  {stage(tile, cloth)}
                  <figcaption>{`${tile.caption}, ${kind}`}</figcaption>
                </figure>
              ))}
            </div>
          ))
        )}
      </>
    );
    const css =
      `<style>body{margin:0;padding:14px;background:${t.page};font:12px system-ui}` +
      `.row{display:flex;flex-wrap:nowrap;width:max-content;gap:10px;margin-bottom:12px}figure{margin:0;width:220px}` +
      `svg{width:220px;height:367px;display:block;background:${t.stage};color:${t.text};border-radius:10px}` +
      `figcaption{margin-top:5px;color:${t.caption}}</style>`;
    writeFileSync(
      `.preview/wardrobe/garment-seams-${theme}.html`,
      '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + html
    );
  });
});

/**
 * Trouser legs, on a light page and a dark one: her trousers and his in every
 * leg, under a t-shirt, in a plain cloth and a print — whole, and close up at
 * the pocket, where a wide leg leaves the hip, and at the hem — then every leg
 * under each body's jacket.
 */
describe("trouser legs, light and dark", () => {
  const THEMES = {
    light: { page: "#efeae4", stage: "#ffffff", text: "#1f1915", caption: "#555" },
    dark: { page: "#1a1714", stage: "#141110", text: "#f5f1ea", caption: "#b9b2a8" },
  } as const;
  type Tile = { caption: string; body: BodyType; ids: string[]; leg: LegId; cloth: string; zoom: number; focus: [number, number] };
  const LEGS = ["straight", "slim", "wide"] as const;
  it.each(["light", "dark"] as const)("writes .preview/wardrobe/styles10-legs-%s.html", (theme) => {
    const t = THEMES[theme];
    const stage = (tile: Tile) => {
      let worn: WornGarment[] = [];
      const by: Record<string, Partial<Record<FabricRegionId, Fabric>>> = {};
      for (const gid of tile.ids) {
        const g = garmentById(gid)!;
        /* the trousers in the cloth being shown, a top in another and a jacket in a third */
        const cloth = gid.endsWith("trousers") ? f(tile.cloth) : gid.endsWith("jacket") ? f("fb-indigo-plaid") : f("fb-rose-silk");
        worn = wear(worn, cutFrom(g, cloth.id));
        const regions: Partial<Record<FabricRegionId, Fabric>> = { collar: cloth };
        for (const r of g.fabricRegions) regions[r] = cloth;
        by[gid] = regions;
      }
      worn = setLeg(worn, `${tile.body}-trousers`, tile.leg);
      const outfit: Outfit = { bodyType: tile.body, skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
      return <MannequinStage outfit={outfit} fabrics={by} zoom={tile.zoom} focus={tile.focus} />;
    };
    const rows: Tile[][] = [
      ...(["female", "male"] as const).flatMap((body) =>
        (
          [
            ["fb-apricot-linen", "plain"],
            ["fb-midnight-floral", "print"],
          ] as const
        ).map(([cloth, kind]): Tile[] => {
          const ids = [`${body}-t-shirt`, `${body}-trousers`];
          const name = body === "female" ? "her" : "his";
          return [
            ...LEGS.map((leg): Tile => ({ caption: `${name} trousers, ${leg}, ${kind}`, body, ids, leg, cloth, zoom: 1, focus: [300, 560] })),
            { caption: `${name}, wide, the pocket 2.4×`, body, ids, leg: "wide", cloth, zoom: 2.4, focus: [235, 470] },
            { caption: `${name}, slim, the hem 2.4×`, body, ids, leg: "slim", cloth, zoom: 2.4, focus: [250, 850] },
            { caption: `${name}, wide, the hem 2.4×`, body, ids, leg: "wide", cloth, zoom: 2.4, focus: [235, 850] },
          ];
        })
      ),
      (["female", "male"] as const).flatMap((body) =>
        LEGS.map((leg): Tile => ({
          caption: `${body === "female" ? "her" : "his"} jacket over ${leg}, plain`, body, ids: [`${body}-t-shirt`, `${body}-trousers`, `${body}-jacket`], leg, cloth: "fb-apricot-linen", zoom: 1, focus: [300, 560],
        }))
      ),
    ];
    const html = renderToStaticMarkup(
      <>
        {rows.map((row, r) => (
          <div key={r} className="row">
            {row.map((tile) => (
              <figure key={tile.caption}>
                {stage(tile)}
                <figcaption>{tile.caption}</figcaption>
              </figure>
            ))}
          </div>
        ))}
      </>
    );
    const css =
      `<style>body{margin:0;padding:14px;background:${t.page};font:12px system-ui}` +
      `.row{display:flex;flex-wrap:nowrap;width:max-content;gap:10px;margin-bottom:12px}figure{margin:0;width:220px}` +
      `svg{width:220px;height:367px;display:block;background:${t.stage};color:${t.text};border-radius:10px}` +
      `figcaption{margin-top:5px;color:${t.caption}}</style>`;
    writeFileSync(
      `.preview/wardrobe/styles10-legs-${theme}.html`,
      '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + html
    );
  });
});

/**
 * Her flare and palazzo, on a light page and a dark one, under a t-shirt, in a
 * plain cloth and a print — whole, and close up where each is its own: the
 * flare opening below the knee, the palazzo leaving her hip, and its legs
 * meeting at the centre seam — then each under her jacket, under a blouse,
 * and under her abaya.
 */
describe("flare and palazzo, light and dark", () => {
  const THEMES = {
    light: { page: "#efeae4", stage: "#ffffff", text: "#1f1915", caption: "#555" },
    dark: { page: "#1a1714", stage: "#141110", text: "#f5f1ea", caption: "#b9b2a8" },
  } as const;
  type Tile = { caption: string; ids: string[]; leg: LegId; cloth: string; zoom: number; focus: [number, number] };
  it.each(["light", "dark"] as const)("writes .preview/wardrobe/styles11-legs-%s.html", (theme) => {
    const t = THEMES[theme];
    const stage = (tile: Tile) => {
      let worn: WornGarment[] = [];
      const by: Record<string, Partial<Record<FabricRegionId, Fabric>>> = {};
      for (const gid of tile.ids) {
        const g = garmentById(gid)!;
        /* the trousers in the cloth being shown; a top, a jacket and an abaya each in their own */
        const cloth = gid.endsWith("trousers")
          ? f(tile.cloth)
          : gid.endsWith("jacket")
            ? f("fb-indigo-plaid")
            : gid.endsWith("abaya")
              ? f("fb-black-crepe")
              : f("fb-rose-silk");
        worn = wear(worn, cutFrom(g, cloth.id));
        const regions: Partial<Record<FabricRegionId, Fabric>> = { collar: cloth };
        for (const r of g.fabricRegions) regions[r] = cloth;
        by[gid] = regions;
      }
      worn = setLeg(worn, "female-trousers", tile.leg);
      const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
      return <MannequinStage outfit={outfit} fabrics={by} zoom={tile.zoom} focus={tile.focus} />;
    };
    const TEE = ["female-t-shirt", "female-trousers"];
    const rows: Tile[][] = [
      ...(
        [
          ["fb-apricot-linen", "plain"],
          ["fb-midnight-floral", "print"],
        ] as const
      ).map(([cloth, kind]): Tile[] => [
        { caption: `flare, ${kind}`, ids: TEE, leg: "flare", cloth, zoom: 1, focus: [300, 560] },
        { caption: `palazzo, ${kind}`, ids: TEE, leg: "palazzo", cloth, zoom: 1, focus: [300, 560] },
        { caption: `flare, below the knee 2.4×`, ids: TEE, leg: "flare", cloth, zoom: 2.4, focus: [240, 800] },
        { caption: `palazzo, the hip 2.4×`, ids: TEE, leg: "palazzo", cloth, zoom: 2.4, focus: [240, 500] },
        { caption: `palazzo, the centre seam 2.4×`, ids: TEE, leg: "palazzo", cloth, zoom: 2.4, focus: [300, 760] },
      ]),
      [
        { caption: "jacket over flare, plain", ids: [...TEE, "female-jacket"], leg: "flare", cloth: "fb-apricot-linen", zoom: 1, focus: [300, 560] },
        { caption: "jacket over palazzo, plain", ids: [...TEE, "female-jacket"], leg: "palazzo", cloth: "fb-apricot-linen", zoom: 1, focus: [300, 560] },
        { caption: "blouse over flare, print", ids: ["female-blouse", "female-trousers"], leg: "flare", cloth: "fb-midnight-floral", zoom: 1, focus: [300, 560] },
        { caption: "blouse over palazzo, print", ids: ["female-blouse", "female-trousers"], leg: "palazzo", cloth: "fb-midnight-floral", zoom: 1, focus: [300, 560] },
        { caption: "abaya over palazzo, plain", ids: [...TEE, "female-abaya"], leg: "palazzo", cloth: "fb-apricot-linen", zoom: 1, focus: [300, 560] },
      ],
    ];
    const html = renderToStaticMarkup(
      <>
        {rows.map((row, r) => (
          <div key={r} className="row">
            {row.map((tile) => (
              <figure key={tile.caption}>
                {stage(tile)}
                <figcaption>{tile.caption}</figcaption>
              </figure>
            ))}
          </div>
        ))}
      </>
    );
    const css =
      `<style>body{margin:0;padding:14px;background:${t.page};font:12px system-ui}` +
      `.row{display:flex;flex-wrap:nowrap;width:max-content;gap:10px;margin-bottom:12px}figure{margin:0;width:220px}` +
      `svg{width:220px;height:367px;display:block;background:${t.stage};color:${t.text};border-radius:10px}` +
      `figcaption{margin-top:5px;color:${t.caption}}</style>`;
    writeFileSync(
      `.preview/wardrobe/styles11-legs-${theme}.html`,
      '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + html
    );
  });
});

/**
 * Round 12, on a light page and a dark one: the bow collar on the dress and
 * on her blouse, plain and print, whole and close up.
 */
describe("bow collar, light and dark", () => {
  const THEMES = {
    light: { page: "#efeae4", stage: "#ffffff", text: "#1f1915", caption: "#555" },
    dark: { page: "#1a1714", stage: "#141110", text: "#f5f1ea", caption: "#b9b2a8" },
  } as const;
  type Tile = { caption: string; ids: string[]; cloth: string; zoom: number; focus: [number, number] };
  it.each(["light", "dark"] as const)("writes .preview/wardrobe/styles12-bow-%s.html", (theme) => {
    const t = THEMES[theme];
    const stage = (tile: Tile) => {
      let worn: WornGarment[] = [];
      const by: Record<string, Partial<Record<FabricRegionId, Fabric>>> = {};
      for (const gid of tile.ids) {
        const g = garmentById(gid)!;
        const cloth = f(tile.cloth);
        worn = wear(worn, cutFrom(g, cloth.id));
        const regions: Partial<Record<FabricRegionId, Fabric>> = { collar: cloth };
        for (const r of g.fabricRegions) regions[r] = cloth;
        by[gid] = regions;
      }
      if (tile.ids[0] === "female-dress") worn = setNeckline(worn, "female-dress", "female-high-neckline");
      worn = setCollar(worn, tile.ids[0], "female-bow-collar");
      const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
      return <MannequinStage outfit={outfit} fabrics={by} zoom={tile.zoom} focus={tile.focus} />;
    };
    const rows: Tile[][] = (
      [
        ["fb-apricot-linen", "plain"],
        ["fb-midnight-floral", "print"],
      ] as const
    ).map(([cloth, kind]): Tile[] => [
      { caption: `dress, bow, ${kind}`, ids: ["female-dress"], cloth, zoom: 1, focus: [300, 500] },
      { caption: `dress, bow, ${kind}, 2.4×`, ids: ["female-dress"], cloth, zoom: 2.4, focus: [300, 250] },
      { caption: `dress, bow, ${kind}, 4×`, ids: ["female-dress"], cloth, zoom: 4, focus: [300, 238] },
      { caption: `blouse, bow, ${kind}, 2.4×`, ids: ["female-blouse", "female-skirt"], cloth, zoom: 2.4, focus: [300, 250] },
    ]);
    const html = renderToStaticMarkup(
      <>
        {rows.map((row, r) => (
          <div key={r} className="row">
            {row.map((tile) => (
              <figure key={tile.caption}>
                {stage(tile)}
                <figcaption>{tile.caption}</figcaption>
              </figure>
            ))}
          </div>
        ))}
      </>
    );
    const css =
      `<style>body{margin:0;padding:14px;background:${t.page};font:12px system-ui}` +
      `.row{display:flex;flex-wrap:nowrap;width:max-content;gap:10px;margin-bottom:12px}figure{margin:0;width:220px}` +
      `svg{width:220px;height:367px;display:block;background:${t.stage};color:${t.text};border-radius:10px}` +
      `figcaption{margin-top:5px;color:${t.caption}}</style>`;
    writeFileSync(
      `.preview/wardrobe/styles12-bow-${theme}.html`,
      '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + html
    );
  });
});

/**
 * Round 12, on a light page and a dark one: the dress buttoned down its front
 * — to the waist and to the hem, on every cut that takes it, over every shape,
 * length and waist — and belted, in its own cloth and in brown and black
 * leather, at every waist; plain and print, whole and close up.
 */
describe("buttons and belt, light and dark", () => {
  const THEMES = {
    light: { page: "#efeae4", stage: "#ffffff", text: "#1f1915", caption: "#555" },
    dark: { page: "#1a1714", stage: "#141110", text: "#f5f1ea", caption: "#b9b2a8" },
  } as const;
  type Tile = {
    caption: string;
    cloth: string;
    cut?: string;
    sleeve?: SleeveChoice;
    skirt?: Partial<{ shape: SkirtShapeId; length: SkirtLengthId; waist: WaistId }>;
    buttons?: ButtonsId;
    belt?: BeltId;
    jacket?: boolean;
    zoom: number;
    focus: [number, number];
  };
  const PLAIN = "fb-apricot-linen";
  const PRINT = "fb-midnight-floral";
  const stage = (tile: Tile) => {
    const ids = ["female-dress", ...(tile.jacket ? ["female-jacket"] : [])];
    let worn: WornGarment[] = [];
    const by: Record<string, Partial<Record<FabricRegionId, Fabric>>> = {};
    for (const gid of ids) {
      const g = garmentById(gid)!;
      const cloth = gid === "female-dress" ? f(tile.cloth) : f("fb-indigo-plaid");
      worn = wear(worn, cutFrom(g, cloth.id));
      const regions: Partial<Record<FabricRegionId, Fabric>> = { collar: cloth };
      for (const r of g.fabricRegions) regions[r] = cloth;
      by[gid] = regions;
    }
    if (tile.cut) worn = setNeckline(worn, "female-dress", `female-${tile.cut}-neckline`);
    if (tile.sleeve) worn = setSleeve(worn, "female-dress", tile.sleeve);
    if (tile.buttons) worn = setButtons(worn, "female-dress", tile.buttons);
    if (tile.belt) worn = setBelt(worn, "female-dress", tile.belt);
    worn = worn.map((w) => {
      const skirt = w.garmentId === "female-dress" ? skirtOf(w) : undefined;
      return skirt && tile.skirt ? { ...w, skirt: { ...skirt, ...tile.skirt } } : w;
    });
    const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
    return <MannequinStage outfit={outfit} fabrics={by} zoom={tile.zoom} focus={tile.focus} />;
  };
  const write = (name: string, theme: keyof typeof THEMES, rows: Tile[][]) => {
    const t = THEMES[theme];
    const html = renderToStaticMarkup(
      <>
        {rows.map((row, r) => (
          <div key={r} className="row">
            {row.map((tile) => (
              <figure key={tile.caption}>
                {stage(tile)}
                <figcaption>{tile.caption}</figcaption>
              </figure>
            ))}
          </div>
        ))}
      </>
    );
    const css =
      `<style>body{margin:0;padding:14px;background:${t.page};font:12px system-ui}` +
      `.row{display:flex;flex-wrap:nowrap;width:max-content;gap:10px;margin-bottom:12px}figure{margin:0;width:220px}` +
      `svg{width:220px;height:367px;display:block;background:${t.stage};color:${t.text};border-radius:10px}` +
      `figcaption{margin-top:5px;color:${t.caption}}</style>`;
    writeFileSync(`.preview/wardrobe/${name}-${theme}.html`, '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + html);
  };
  const CUTS = ["round", "scoop", "boat", "v", "square", "high", "sweetheart", "collared", "off-shoulder"] as const;
  const WHOLE = { zoom: 1, focus: [300, 500] as [number, number] };

  it.each(["light", "dark"] as const)("writes .preview/wardrobe/styles12-buttons-%s.html", (theme) => {
    const rows: Tile[][] = [
      CUTS.map((cut): Tile => ({ caption: `${cut}, to the hem, plain`, cloth: PLAIN, cut, buttons: "hem", ...WHOLE })),
      CUTS.map((cut): Tile => ({ caption: `${cut}, to the hem, print`, cloth: PRINT, cut, buttons: "hem", ...WHOLE })),
      CUTS.map((cut, i): Tile => ({ caption: `${cut}, to the waist, ${i % 2 ? "print" : "plain"}`, cloth: i % 2 ? PRINT : PLAIN, cut, buttons: "waist", ...WHOLE })),
      [
        { caption: "empire, A-line maxi, long sleeves, print", cloth: PRINT, cut: "round", buttons: "hem", skirt: { waist: "empire", shape: "aline", length: "maxi" }, sleeve: { type: "set-in", length: "long" }, ...WHOLE },
        { caption: "dropped, pleated knee, plain", cloth: PLAIN, cut: "v", buttons: "hem", skirt: { waist: "dropped", shape: "pleated", length: "knee" }, ...WHOLE },
        { caption: "circle knee, print", cloth: PRINT, cut: "square", buttons: "hem", skirt: { shape: "circle", length: "knee" }, ...WHOLE },
        { caption: "tiered maxi, plain", cloth: PLAIN, cut: "high", buttons: "hem", skirt: { shape: "tiered", length: "maxi" }, ...WHOLE },
        { caption: "mermaid midi, to the waist only, print", cloth: PRINT, cut: "sweetheart", buttons: "hem", skirt: { shape: "mermaid", length: "midi" }, ...WHOLE },
        { caption: "collared, empire, pencil knee, plain", cloth: PLAIN, cut: "collared", buttons: "hem", skirt: { waist: "empire", shape: "pencil", length: "knee" }, ...WHOLE },
        { caption: "collared, dropped, to the hem, under the jacket", cloth: PLAIN, cut: "collared", buttons: "hem", skirt: { waist: "dropped" }, sleeve: { type: "set-in", length: "long" }, jacket: true, ...WHOLE },
      ],
      [
        { caption: "round, the top of the placket 2.4×", cloth: PLAIN, cut: "round", buttons: "hem", zoom: 2.4, focus: [297, 250] },
        { caption: "round, at the waist seam 2.4×", cloth: PLAIN, cut: "round", buttons: "hem", zoom: 2.4, focus: [297, 350] },
        { caption: "round, at the hem 2.4×", cloth: PLAIN, cut: "round", buttons: "hem", zoom: 2.4, focus: [297, 740] },
        { caption: "v, the point 2.4×, print", cloth: PRINT, cut: "v", buttons: "hem", zoom: 2.4, focus: [297, 270] },
        { caption: "off-shoulder, under the band 2.4×", cloth: PLAIN, cut: "off-shoulder", buttons: "hem", zoom: 2.4, focus: [297, 270] },
        { caption: "sweetheart, under its dip 2.4×, print", cloth: PRINT, cut: "sweetheart", buttons: "hem", zoom: 2.4, focus: [297, 265] },
        { caption: "collared, at the waist seam 2.4×, print", cloth: PRINT, cut: "collared", buttons: "hem", zoom: 2.4, focus: [297, 350] },
      ],
    ];
    write("styles12-buttons", theme, rows);
  });

  it.each(["light", "dark"] as const)("writes .preview/wardrobe/styles12-belt-%s.html", (theme) => {
    const belts = (cloth: string, kind: string): Tile[] => [
      { caption: `self-fabric, natural, ${kind}`, cloth, belt: "self", ...WHOLE },
      { caption: `brown leather, natural, ${kind}`, cloth, belt: "brown", ...WHOLE },
      { caption: `black leather, natural, ${kind}`, cloth, belt: "black", ...WHOLE },
      { caption: `self-fabric, empire, ${kind}`, cloth, belt: "self", skirt: { waist: "empire" }, ...WHOLE },
      { caption: `brown leather, empire, ${kind}`, cloth, belt: "brown", skirt: { waist: "empire" }, ...WHOLE },
      { caption: `black leather, dropped, ${kind}`, cloth, belt: "black", skirt: { waist: "dropped" }, ...WHOLE },
      { caption: `self-fabric, dropped, ${kind}`, cloth, belt: "self", skirt: { waist: "dropped" }, ...WHOLE },
    ];
    const rows: Tile[][] = [
      belts(PLAIN, "plain"),
      belts(PRINT, "print"),
      [
        { caption: "self-fabric, the buckle 2.4×, plain", cloth: PLAIN, belt: "self", zoom: 2.4, focus: [297, 344] },
        { caption: "self-fabric, the buckle 2.4×, print", cloth: PRINT, belt: "self", zoom: 2.4, focus: [297, 344] },
        { caption: "brown leather, the buckle 2.4×", cloth: PLAIN, belt: "brown", zoom: 2.4, focus: [297, 344] },
        { caption: "black leather, the buckle 2.4×, print", cloth: PRINT, belt: "black", zoom: 2.4, focus: [297, 344] },
        { caption: "brown leather, its end at the side 2.4×", cloth: PLAIN, belt: "brown", zoom: 2.4, focus: [250, 344] },
        { caption: "black, empire, bishop sleeves 2.4×", cloth: PLAIN, belt: "black", skirt: { waist: "empire" }, sleeve: { type: "bishop", length: "long" }, zoom: 2.4, focus: [260, 330] },
        { caption: "brown, buttoned to the hem 2.4×", cloth: PLAIN, cut: "round", buttons: "hem", belt: "brown", zoom: 2.4, focus: [297, 344] },
      ],
      [
        { caption: "brown, buttoned to the hem, plain", cloth: PLAIN, cut: "round", buttons: "hem", belt: "brown", ...WHOLE },
        { caption: "self-fabric, circle maxi, print", cloth: PRINT, belt: "self", skirt: { shape: "circle", length: "maxi" }, ...WHOLE },
        { caption: "black, under the jacket, plain", cloth: PLAIN, belt: "black", jacket: true, sleeve: { type: "set-in", length: "long" }, ...WHOLE },
        { caption: "brown, long sleeves, collared, print", cloth: PRINT, cut: "collared", belt: "brown", sleeve: { type: "set-in", length: "long" }, ...WHOLE },
        { caption: "self-fabric, tiered, print", cloth: PRINT, belt: "self", skirt: { shape: "tiered" }, ...WHOLE },
        { caption: "black, pencil knee, off-shoulder, plain", cloth: PLAIN, cut: "off-shoulder", belt: "black", skirt: { shape: "pencil", length: "knee" }, ...WHOLE },
        { caption: "brown, empire, A-line maxi, bell sleeves, print", cloth: PRINT, belt: "brown", skirt: { waist: "empire", shape: "aline", length: "maxi" }, sleeve: { type: "bell", length: "long" }, ...WHOLE },
      ],
    ];
    write("styles12-belt", theme, rows);
  });

  /*
    The four changes asked for after round 12 was first shown: buttons on the
    scoop, the boat and the sweetheart — from below its dip; a pleated skirt
    buttoned to the hem, its pleats either side of a flat panel under the
    placket; a mermaid buttoned to the waist only, asked for the hem; and the
    keyhole with its own button and loop and nothing else, asked for buttons.
  */
  it.each(["light", "dark"] as const)("writes .preview/wardrobe/styles12-fixes-%s.html", (theme) => {
    const cuts = (cloth: string, kind: string): Tile[] => [
      { caption: `scoop, to the hem, ${kind}`, cloth, cut: "scoop", buttons: "hem", ...WHOLE },
      { caption: `boat, to the hem, ${kind}`, cloth, cut: "boat", buttons: "hem", ...WHOLE },
      { caption: `sweetheart, to the hem, ${kind}`, cloth, cut: "sweetheart", buttons: "hem", ...WHOLE },
      { caption: `scoop, to the waist, ${kind}`, cloth, cut: "scoop", buttons: "waist", ...WHOLE },
      { caption: `boat, to the waist, ${kind}`, cloth, cut: "boat", buttons: "waist", ...WHOLE },
      { caption: `sweetheart, to the waist, ${kind}`, cloth, cut: "sweetheart", buttons: "waist", ...WHOLE },
      { caption: `sweetheart, under its dip 2.4×, ${kind}`, cloth, cut: "sweetheart", buttons: "hem", zoom: 2.4, focus: [297, 268] },
    ];
    const PLEATED = { shape: "pleated" } as const;
    const rows: Tile[][] = [
      cuts(PLAIN, "plain"),
      cuts(PRINT, "print"),
      [
        { caption: "pleated midi, to the hem, plain", cloth: PLAIN, buttons: "hem", skirt: { ...PLEATED, length: "midi" }, ...WHOLE },
        { caption: "pleated knee, empire, to the hem, print", cloth: PRINT, buttons: "hem", skirt: { ...PLEATED, length: "knee", waist: "empire" }, ...WHOLE },
        { caption: "pleated maxi, dropped, to the hem, plain", cloth: PLAIN, cut: "v", buttons: "hem", skirt: { ...PLEATED, length: "maxi", waist: "dropped" }, ...WHOLE },
        { caption: "pleated, the panel at the seam 2.4×, plain", cloth: PLAIN, buttons: "hem", skirt: { ...PLEATED, length: "midi" }, zoom: 2.4, focus: [297, 400] },
        { caption: "pleated, the panel at the hem 2.4×, plain", cloth: PLAIN, buttons: "hem", skirt: { ...PLEATED, length: "midi" }, zoom: 2.4, focus: [297, 730] },
        { caption: "pleated, the panel at the hem 2.4×, print", cloth: PRINT, buttons: "hem", skirt: { ...PLEATED, length: "midi" }, zoom: 2.4, focus: [297, 730] },
        { caption: "pleated midi, to the hem, belted, print", cloth: PRINT, buttons: "hem", belt: "brown", skirt: { ...PLEATED, length: "midi" }, ...WHOLE },
      ],
      [
        { caption: "mermaid midi, asked to the hem: to the waist, plain", cloth: PLAIN, buttons: "hem", skirt: { shape: "mermaid", length: "midi" }, ...WHOLE },
        { caption: "mermaid maxi, asked to the hem: to the waist, print", cloth: PRINT, cut: "scoop", buttons: "hem", skirt: { shape: "mermaid", length: "maxi" }, ...WHOLE },
        { caption: "mermaid midi, empire, to the waist, plain", cloth: PLAIN, cut: "collared", buttons: "hem", skirt: { shape: "mermaid", length: "midi", waist: "empire" }, ...WHOLE },
        { caption: "keyhole, asked to the hem: its own button only, plain", cloth: PLAIN, cut: "keyhole", buttons: "hem", ...WHOLE },
        { caption: "keyhole, asked to the hem, print", cloth: PRINT, cut: "keyhole", buttons: "hem", ...WHOLE },
        { caption: "keyhole, its closure 2.4×, plain", cloth: PLAIN, cut: "keyhole", buttons: "hem", zoom: 2.4, focus: [297, 240] },
        { caption: "keyhole, its closure 2.4×, print", cloth: PRINT, cut: "keyhole", buttons: "hem", zoom: 2.4, focus: [297, 240] },
      ],
    ];
    write("styles12-fixes", theme, rows);
  });
});

/**
 * Round 13, on a light page and a dark one: every collar on every neckline
 * that offers it — the cuts of her dress, her t-shirt and blouse, his shirt,
 * polo, thobe and jacket, and her jacket — close up, plain and print. Every
 * collar now in its cloth's own colour, with no line round it; her mandarin
 * rebuilt as his; the bow on the keyhole above the opening; the keyhole's
 * edge a soft fold. The pairs come from `collarsFitting`, so none is left out.
 */
describe("collars, light and dark", () => {
  const THEMES = {
    light: { page: "#efeae4", stage: "#ffffff", text: "#1f1915", caption: "#555" },
    dark: { page: "#1a1714", stage: "#141110", text: "#f5f1ea", caption: "#b9b2a8" },
  } as const;
  type Tile = { caption: string; body: BodyType; ids: string[]; neckline?: string; collar?: string; cloth: string; zoom?: number; focus?: [number, number] };
  type Family = { label: string; body: BodyType; ids: string[]; neckline?: string; collars: string[] };
  const PLAIN = "fb-apricot-linen";
  const PRINT = "fb-midnight-floral";
  const CLOSE = { zoom: 4, focus: [300, 226] as [number, number] };
  const short = (id: string) => id.replace(/^(fe)?male-/, "").replace(/-(collar|neckline)$/, "");
  const stage = (t: Tile) => {
    const cloth = f(t.cloth);
    let worn: WornGarment[] = [];
    const by: Record<string, Partial<Record<FabricRegionId, Fabric>>> = {};
    for (const gid of t.ids) {
      const g = garmentById(gid)!;
      worn = wear(worn, cutFrom(g, cloth.id));
      const regions: Partial<Record<FabricRegionId, Fabric>> = { collar: cloth };
      for (const r of g.fabricRegions) regions[r] = cloth;
      by[gid] = regions;
    }
    if (t.neckline) worn = setNeckline(worn, t.ids[0], t.neckline);
    if (t.collar) worn = setCollar(worn, t.ids[0], t.collar);
    const outfit: Outfit = { bodyType: t.body, skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
    return <MannequinStage outfit={outfit} fabrics={by} zoom={t.zoom ?? CLOSE.zoom} focus={t.focus ?? CLOSE.focus} />;
  };
  /** Her dress, one family per cut that takes a collar; then each other garment that takes one, in its own opening. */
  const families = (): Family[] => {
    const dress = garmentById("female-dress")!;
    const base = wear([], cutFrom(dress, PLAIN));
    const onCut = (cut: string): Family => {
      const neckline = `female-${cut}-neckline`;
      const collars = collarsFitting(dress, setNeckline(base, dress.id, neckline)[0]).map((c) => c.id);
      return { label: `dress · ${cut}`, body: "female", ids: [dress.id], neckline, collars };
    };
    const own = (label: string, body: BodyType, ids: string[]): Family => ({
      label,
      body,
      ids,
      collars: collarsForGarment(garmentById(ids[0])!).map((c) => c.id),
    });
    return [
      ...["round", "scoop", "boat", "v", "high", "keyhole", "collared"].map(onCut),
      own("her t-shirt", "female", ["female-t-shirt", "female-trousers"]),
      own("her blouse", "female", ["female-blouse", "female-skirt"]),
      own("his shirt", "male", ["male-shirt", "male-trousers"]),
      own("his polo", "male", ["male-polo", "male-trousers"]),
      own("his thobe", "male", ["male-thobe"]),
      own("his jacket", "male", ["male-jacket", "male-trousers"]),
      own("her jacket", "female", ["female-jacket", "female-trousers"]),
    ];
  };
  /** Rows of at most six: the round cuts with the V, his shirt with his polo, the jackets with the thobe. */
  const rows = (cloth: string, kind: string): Tile[][] => {
    const tiles = families().map((fam) =>
      fam.collars.map((collar): Tile => ({
        caption: `${fam.label} · ${short(collar)}, ${kind}`,
        body: fam.body,
        ids: fam.ids,
        neckline: fam.neckline,
        collar,
        cloth,
      }))
    );
    const [round, scoop, boat, v, high, keyhole, collared, tee, blouse, shirt, polo, thobe, hisJacket, herJacket] = tiles;
    return [
      [...round, ...scoop, ...boat, ...v],
      high,
      keyhole,
      collared,
      tee,
      blouse,
      [...shirt, ...polo],
      [...thobe, ...hisJacket, ...herJacket],
    ];
  };
  it.each(["light", "dark"] as const)("writes .preview/wardrobe/round13-collars-%s.html", (theme) => {
    const t = THEMES[theme];
    const plain = rows(PLAIN, "plain");
    const print = rows(PRINT, "print");
    /*
      Then the four things this round asked for, closer: her mandarin's ends
      meeting over a tiny V; the bow on a keyhole, its knot on the band and
      the opening below it between the tails; the keyhole's edge, a soft fold,
      with no collar; and the mandarin over a keyhole.
    */
    const detail = (cloth: string, kind: string): Tile[] => {
      const dress = (neckline: string, collar: string | undefined, caption: string, zoom: number, focus: [number, number]): Tile => ({
        caption: `${caption}, ${kind}, ${zoom}×`,
        body: "female",
        ids: ["female-dress"],
        neckline: `female-${neckline}-neckline`,
        collar,
        cloth,
        zoom,
        focus,
      });
      return [
        dress("high", "female-mandarin-collar", "dress · high · mandarin", 8, [297, 184]),
        dress("keyhole", "female-bow-collar", "dress · keyhole · bow", 6, [297, 214]),
        dress("keyhole", undefined, "dress · keyhole, no collar", 8, [297, 200]),
        dress("keyhole", "female-mandarin-collar", "dress · keyhole · mandarin", 8, [297, 196]),
      ];
    };
    /* each family plain, then print */
    const all = [...plain.flatMap((row, i) => [row, print[i]]), detail(PLAIN, "plain"), detail(PRINT, "print")];
    const html = renderToStaticMarkup(
      <>
        {all.map((row, r) => (
          <div key={r} className="row">
            {row.map((tile) => (
              <figure key={tile.caption}>
                {stage(tile)}
                <figcaption>{tile.caption}</figcaption>
              </figure>
            ))}
          </div>
        ))}
      </>
    );
    const css =
      `<style>body{margin:0;padding:14px;background:${t.page};font:13px system-ui}` +
      `.row{display:flex;flex-wrap:nowrap;width:max-content;gap:10px;margin-bottom:12px}figure{margin:0;width:300px}` +
      `svg{width:300px;height:420px;display:block;background:${t.stage};color:${t.text};border-radius:10px}` +
      `figcaption{margin-top:5px;color:${t.caption}}</style>`;
    writeFileSync(
      `.preview/wardrobe/round13-collars-${theme}.html`,
      '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + html
    );
  }, 60_000);
});

describe("round 13 fixes, light and dark", () => {
  /*
    The three fixes asked for before round 13's commit: no topstitch along a
    neck under its collar; every button strip lit as a collar is; and every
    other row of tonal topstitch faint — barely there at whole-figure size,
    clear only close up.
  */
  const THEMES = {
    light: { page: "#efeae4", stage: "#ffffff", text: "#1f1915", caption: "#555" },
    dark: { page: "#1a1714", stage: "#141110", text: "#f5f1ea", caption: "#b9b2a8" },
  } as const;
  type Tile = {
    caption: string;
    body: BodyType;
    ids: string[];
    neckline?: string;
    collar?: string;
    buttons?: ButtonsId;
    zoom: number;
    focus: [number, number];
  };
  const PLAIN = "fb-apricot-linen";
  const PRINT = "fb-midnight-floral";
  const stage = (t: Tile, clothId: string) => {
    const cloth = f(clothId);
    let worn: WornGarment[] = [];
    const by: Record<string, Partial<Record<FabricRegionId, Fabric>>> = {};
    for (const gid of t.ids) {
      const g = garmentById(gid)!;
      worn = wear(worn, cutFrom(g, cloth.id));
      const regions: Partial<Record<FabricRegionId, Fabric>> = { collar: cloth };
      for (const r of g.fabricRegions) regions[r] = cloth;
      by[gid] = regions;
    }
    if (t.neckline) worn = setNeckline(worn, t.ids[0], t.neckline);
    if (t.collar) worn = setCollar(worn, t.ids[0], t.collar);
    if (t.buttons) worn = setButtons(worn, t.ids[0], t.buttons);
    const outfit: Outfit = { bodyType: t.body, skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
    return <MannequinStage outfit={outfit} fabrics={by} zoom={t.zoom} focus={t.focus} />;
  };
  const her = (caption: string, ids: string[], zoom: number, focus: [number, number], more: Partial<Tile> = {}): Tile => ({
    caption,
    body: "female",
    ids,
    zoom,
    focus,
    ...more,
  });
  const his = (caption: string, ids: string[], zoom: number, focus: [number, number], more: Partial<Tile> = {}): Tile => ({
    ...her(caption, ids, zoom, focus, more),
    body: "male",
  });
  const dress = (cut: string) => `female-${cut}-neckline`;
  const ROWS: Tile[][] = [
    /* every button strip, close */
    [
      her("blouse · placket", ["female-blouse", "female-skirt"], 4, [300, 270]),
      his("shirt · placket", ["male-shirt", "male-trousers"], 4, [300, 270]),
      his("polo · placket", ["male-polo", "male-trousers"], 4, [300, 250]),
      his("thobe · placket", ["male-thobe"], 4, [300, 260]),
      her("dress · round, buttons to the waist", ["female-dress"], 4, [297, 270], { neckline: dress("round"), buttons: "waist" }),
      her("dress · shirt-dress", ["female-dress"], 4, [297, 270], { neckline: dress("collared") }),
      her("dress · round, buttons to the hem", ["female-dress"], 4, [297, 520], { neckline: dress("round"), buttons: "hem" }),
    ],
    /* tonal topstitch at whole-figure size */
    [
      her("dress · round", ["female-dress"], 1, [300, 500], { neckline: dress("round") }),
      her("dress · shirt-dress", ["female-dress"], 1, [300, 500], { neckline: dress("collared") }),
      her("t-shirt", ["female-t-shirt", "female-trousers"], 1, [300, 500]),
      her("blouse", ["female-blouse", "female-skirt"], 1, [300, 500]),
      his("shirt", ["male-shirt", "male-trousers"], 1, [300, 500]),
      his("thobe", ["male-thobe"], 1, [300, 500]),
    ],
    /* and close: bare necklines, a sleeve's hem, cuffs, hems */
    [
      her("dress · round neckline", ["female-dress"], 5, [297, 215], { neckline: dress("round") }),
      her("t-shirt · neckline", ["female-t-shirt", "female-trousers"], 5, [297, 205]),
      her("dress · short sleeve's hem", ["female-dress"], 5, [205, 296], { neckline: dress("round") }),
      her("blouse · cuff", ["female-blouse", "female-skirt"], 5, [180, 470]),
      his("shirt · cuff", ["male-shirt", "male-trousers"], 5, [170, 480]),
      her("trousers · hem", ["female-t-shirt", "female-trousers"], 4, [250, 900]),
    ],
    /* the neck under every kind of collar on the dress, close */
    [
      her("dress · high · mandarin", ["female-dress"], 6, [297, 192], { neckline: dress("high"), collar: "female-mandarin-collar" }),
      her("dress · high · turtleneck", ["female-dress"], 6, [297, 196], { neckline: dress("high"), collar: "female-turtleneck-collar" }),
      her("dress · keyhole · mandarin", ["female-dress"], 6, [297, 196], { neckline: dress("keyhole"), collar: "female-mandarin-collar" }),
      her("dress · round · Peter Pan", ["female-dress"], 5, [297, 210], { neckline: dress("round"), collar: "female-peter-pan-collar" }),
      her("dress · v · sailor", ["female-dress"], 4, [297, 240], { neckline: dress("v"), collar: "female-sailor-collar" }),
      her("dress · shirt-dress · shirt", ["female-dress"], 5, [297, 205], { neckline: dress("collared") }),
    ],
  ];
  it.each(["light", "dark"] as const)("writes .preview/wardrobe/round13-fixes-%s.html", (theme) => {
    const t = THEMES[theme];
    /* each row plain, then print */
    const all = ROWS.flatMap((row) => [
      row.map((tile) => ({ tile, cloth: PLAIN, caption: `${tile.caption}, plain, ${tile.zoom}×` })),
      row.map((tile) => ({ tile, cloth: PRINT, caption: `${tile.caption}, print, ${tile.zoom}×` })),
    ]);
    const html = renderToStaticMarkup(
      <>
        {all.map((row, r) => (
          <div key={r} className="row">
            {row.map(({ tile, cloth, caption }) => (
              <figure key={caption}>
                {stage(tile, cloth)}
                <figcaption>{caption}</figcaption>
              </figure>
            ))}
          </div>
        ))}
      </>
    );
    const css =
      `<style>body{margin:0;padding:14px;background:${t.page};font:13px system-ui}` +
      `.row{display:flex;flex-wrap:nowrap;width:max-content;gap:10px;margin-bottom:12px}figure{margin:0;width:300px}` +
      `svg{width:300px;height:420px;display:block;background:${t.stage};color:${t.text};border-radius:10px}` +
      `figcaption{margin-top:5px;color:${t.caption}}</style>`;
    writeFileSync(
      `.preview/wardrobe/round13-fixes-${theme}.html`,
      '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + html
    );
  }, 60_000);
});

describe("round 14, the Peter Pan, light and dark", () => {
  /*
    The Peter Pan on everything that offers it — her dress's round, scoop
    and boat cuts, her t-shirt and her blouse — plain and print: close at 4×,
    at 2× as it reads on the figure, and its front ends at 8×, where the two
    halves meet.
  */
  const THEMES = {
    light: { page: "#efeae4", stage: "#ffffff", text: "#1f1915", caption: "#555" },
    dark: { page: "#1a1714", stage: "#141110", text: "#f5f1ea", caption: "#b9b2a8" },
  } as const;
  const PLAIN = "fb-apricot-linen";
  const PRINT = "fb-midnight-floral";
  type On = { label: string; ids: string[]; neckline?: string; front: [number, number] };
  const ON: On[] = [
    { label: "dress · round", ids: ["female-dress"], neckline: "female-round-neckline", front: [297, 214] },
    { label: "dress · scoop", ids: ["female-dress"], neckline: "female-scoop-neckline", front: [298, 243] },
    { label: "dress · boat", ids: ["female-dress"], neckline: "female-boat-neckline", front: [299, 211] },
    { label: "t-shirt", ids: ["female-t-shirt", "female-trousers"], front: [297, 214] },
    { label: "blouse", ids: ["female-blouse", "female-skirt"], front: [297, 214] },
  ];
  const stage = (on: On, clothId: string, zoom: number, focus: [number, number]) => {
    const cloth = f(clothId);
    let worn: WornGarment[] = [];
    const by: Record<string, Partial<Record<FabricRegionId, Fabric>>> = {};
    for (const gid of on.ids) {
      const g = garmentById(gid)!;
      worn = wear(worn, cutFrom(g, cloth.id));
      const regions: Partial<Record<FabricRegionId, Fabric>> = { collar: cloth };
      for (const r of g.fabricRegions) regions[r] = cloth;
      by[gid] = regions;
    }
    if (on.neckline) worn = setNeckline(worn, on.ids[0], on.neckline);
    worn = setCollar(worn, on.ids[0], "female-peter-pan-collar");
    const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
    return <MannequinStage outfit={outfit} fabrics={by} zoom={zoom} focus={focus} />;
  };
  it.each(["light", "dark"] as const)("writes .preview/wardrobe/round14-peter-pan-%s.html", (theme) => {
    const t = THEMES[theme];
    const rows: { on: On; cloth: string; zoom: number; focus: [number, number]; caption: string }[][] = [];
    for (const [zoom, kind] of [[4, "close"], [2, "on the figure"], [8, "front ends"]] as const) {
      for (const [cloth, name] of [[PLAIN, "plain"], [PRINT, "print"]] as const) {
        rows.push(
          ON.map((on) => ({
            on,
            cloth,
            zoom,
            focus: kind === "front ends" ? on.front : kind === "close" ? ([300, 222] as [number, number]) : ([300, 300] as [number, number]),
            caption: `${on.label} · Peter Pan, ${name}, ${zoom}×`,
          }))
        );
      }
    }
    const html = renderToStaticMarkup(
      <>
        {rows.map((row, r) => (
          <div key={r} className="row">
            {row.map((tile) => (
              <figure key={tile.caption}>
                {stage(tile.on, tile.cloth, tile.zoom, tile.focus)}
                <figcaption>{tile.caption}</figcaption>
              </figure>
            ))}
          </div>
        ))}
      </>
    );
    const css =
      `<style>body{margin:0;padding:14px;background:${t.page};font:13px system-ui}` +
      `.row{display:flex;flex-wrap:nowrap;width:max-content;gap:10px;margin-bottom:12px}figure{margin:0;width:300px}` +
      `svg{width:300px;height:420px;display:block;background:${t.stage};color:${t.text};border-radius:10px}` +
      `figcaption{margin-top:5px;color:${t.caption}}</style>`;
    writeFileSync(
      `.preview/wardrobe/round14-peter-pan-${theme}.html`,
      '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + html
    );
  }, 60_000);
});

describe("round 14 fixes, light and dark", () => {
  /*
    Two fixes asked before round 14's commit: the Peter Pan's soft shadow a
    little stronger, so it reads on a busy print at whole-figure size; and
    topstitch seen only in close-ups — none at 2× on sleeve hems, a hem or a
    placket.
  */
  const THEMES = {
    light: { page: "#efeae4", stage: "#ffffff", text: "#1f1915", caption: "#555" },
    dark: { page: "#1a1714", stage: "#141110", text: "#f5f1ea", caption: "#b9b2a8" },
  } as const;
  type Tile = { caption: string; body: BodyType; ids: string[]; neckline?: string; collar?: string; zoom: number; focus: [number, number] };
  const PLAIN = "fb-apricot-linen";
  const PRINT = "fb-midnight-floral";
  const stage = (t: Tile, clothId: string) => {
    const cloth = f(clothId);
    let worn: WornGarment[] = [];
    const by: Record<string, Partial<Record<FabricRegionId, Fabric>>> = {};
    for (const gid of t.ids) {
      const g = garmentById(gid)!;
      worn = wear(worn, cutFrom(g, cloth.id));
      const regions: Partial<Record<FabricRegionId, Fabric>> = { collar: cloth };
      for (const r of g.fabricRegions) regions[r] = cloth;
      by[gid] = regions;
    }
    if (t.neckline) worn = setNeckline(worn, t.ids[0], t.neckline);
    if (t.collar) worn = setCollar(worn, t.ids[0], t.collar);
    const outfit: Outfit = { bodyType: t.body, skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
    return <MannequinStage outfit={outfit} fabrics={by} zoom={t.zoom} focus={t.focus} />;
  };
  const her = (caption: string, ids: string[], zoom: number, focus: [number, number], more: Partial<Tile> = {}): Tile => ({ caption, body: "female", ids, zoom, focus, ...more });
  const his = (caption: string, ids: string[], zoom: number, focus: [number, number]): Tile => ({ ...her(caption, ids, zoom, focus), body: "male" });
  const dress = (cut: string) => `female-${cut}-neckline`;
  const PP = "female-peter-pan-collar";
  const peterPans = (zoom: number, focus: [number, number]) => [
    her("dress · round · Peter Pan", ["female-dress"], zoom, focus, { neckline: dress("round"), collar: PP }),
    her("dress · scoop · Peter Pan", ["female-dress"], zoom, focus, { neckline: dress("scoop"), collar: PP }),
    her("dress · boat · Peter Pan", ["female-dress"], zoom, focus, { neckline: dress("boat"), collar: PP }),
    her("t-shirt · Peter Pan", ["female-t-shirt", "female-trousers"], zoom, focus, { collar: PP }),
    her("blouse · Peter Pan", ["female-blouse", "female-skirt"], zoom, focus, { collar: PP }),
  ];
  const ROWS: Tile[][] = [
    /* the Peter Pan as it reads on the figure */
    peterPans(1, [300, 500]),
    peterPans(2, [300, 300]),
    /* topstitch at 2×: sleeve hems, hems, a placket — none */
    [
      her("t-shirt", ["female-t-shirt", "female-trousers"], 2, [280, 380]),
      her("blouse", ["female-blouse", "female-skirt"], 2, [280, 380]),
      her("dress · round", ["female-dress"], 2, [280, 330], { neckline: dress("round") }),
      his("shirt", ["male-shirt", "male-trousers"], 2, [280, 380]),
      his("thobe", ["male-thobe"], 2, [280, 330]),
    ],
    /* and close: there, faint */
    [
      her("t-shirt · hem", ["female-t-shirt", "female-trousers"], 5, [300, 470]),
      her("t-shirt · sleeve hem", ["female-t-shirt", "female-trousers"], 5, [205, 296]),
      her("blouse · placket", ["female-blouse", "female-skirt"], 5, [300, 300]),
      her("blouse · cuff", ["female-blouse", "female-skirt"], 5, [180, 470]),
      her("dress · short sleeve's hem", ["female-dress"], 5, [205, 296], { neckline: dress("round") }),
    ],
  ];
  it.each(["light", "dark"] as const)("writes .preview/wardrobe/round14-fixes-%s.html", (theme) => {
    const t = THEMES[theme];
    /* each row plain, then print */
    const all = ROWS.flatMap((row) => [
      row.map((tile) => ({ tile, cloth: PLAIN, caption: `${tile.caption}, plain, ${tile.zoom}×` })),
      row.map((tile) => ({ tile, cloth: PRINT, caption: `${tile.caption}, print, ${tile.zoom}×` })),
    ]);
    const html = renderToStaticMarkup(
      <>
        {all.map((row, r) => (
          <div key={r} className="row">
            {row.map(({ tile, cloth, caption }) => (
              <figure key={caption}>
                {stage(tile, cloth)}
                <figcaption>{caption}</figcaption>
              </figure>
            ))}
          </div>
        ))}
      </>
    );
    const css =
      `<style>body{margin:0;padding:14px;background:${t.page};font:13px system-ui}` +
      `.row{display:flex;flex-wrap:nowrap;width:max-content;gap:10px;margin-bottom:12px}figure{margin:0;width:300px}` +
      `svg{width:300px;height:420px;display:block;background:${t.stage};color:${t.text};border-radius:10px}` +
      `figcaption{margin-top:5px;color:${t.caption}}</style>`;
    writeFileSync(
      `.preview/wardrobe/round14-fixes-${theme}.html`,
      '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + html
    );
  }, 60_000);
});

describe("round 15, the sailor collar, light and dark", () => {
  /*
    The sailor collar on the V-neck dress, rebuilt from real ones: two panels
    on the shoulders, narrowing to the V's point. Plain and print, without and
    with its trim — the stripes in the plain cloth that stands out most, as
    the app gives them — and once sleeveless, so the shoulder shows. The whole
    figure, 2×, close, and its shoulder corner and point at 8×.
  */
  const THEMES = {
    light: { page: "#efeae4", stage: "#ffffff", text: "#1f1915", caption: "#555" },
    dark: { page: "#1a1714", stage: "#141110", text: "#f5f1ea", caption: "#b9b2a8" },
  } as const;
  type Look = { label: string; cloth: string; trim: boolean; sleeveless?: boolean };
  const PLAIN = "fb-apricot-linen";
  const PRINT = "fb-midnight-floral";
  const LOOKS: Look[] = [
    { label: "plain", cloth: PLAIN, trim: false },
    { label: "plain, trim", cloth: PLAIN, trim: true },
    { label: "print", cloth: PRINT, trim: false },
    { label: "print, trim", cloth: PRINT, trim: true },
    { label: "sleeveless, print, trim", cloth: PRINT, trim: true, sleeveless: true },
  ];
  const stage = (look: Look, zoom: number, focus: [number, number]) => {
    const cloth = f(look.cloth);
    const stripes = contrastingPlain(cloth);
    const g = garmentById("female-dress")!;
    let worn = wear([], cutFrom(g, cloth.id));
    worn = setNeckline(worn, g.id, "female-v-neckline");
    if (look.sleeveless) worn = setSleeve(worn, g.id, { type: "set-in", length: "sleeveless" });
    worn = setCollar(worn, g.id, "female-sailor-collar");
    if (look.trim) worn = setStripes(worn, g.id, "two", stripes.id);
    const regions: Partial<Record<FabricRegionId, Fabric>> = { collar: cloth, ...(look.trim ? { trim: stripes } : {}) };
    for (const r of g.fabricRegions) regions[r] = cloth;
    const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
    return <MannequinStage outfit={outfit} fabrics={{ [g.id]: regions }} zoom={zoom} focus={focus} />;
  };
  const ROWS: [zoom: number, focus: [number, number], what: string][] = [
    [1, [300, 500], "whole figure"],
    [2, [300, 300], "on the figure"],
    [4, [300, 222], "close"],
    [8, [216, 205], "shoulder corner"],
    [8, [297, 238], "the point"],
  ];
  it.each(["light", "dark"] as const)("writes .preview/wardrobe/round15-sailor-%s.html", (theme) => {
    const t = THEMES[theme];
    const html = renderToStaticMarkup(
      <>
        {ROWS.map(([zoom, focus, what], r) => (
          <div key={r} className="row">
            {LOOKS.map((look) => {
              const caption = `dress · v · sailor, ${look.label} · ${what}, ${zoom}×`;
              return (
                <figure key={caption}>
                  {stage(look, zoom, focus)}
                  <figcaption>{caption}</figcaption>
                </figure>
              );
            })}
          </div>
        ))}
      </>
    );
    const css =
      `<style>body{margin:0;padding:14px;background:${t.page};font:13px system-ui}` +
      `.row{display:flex;flex-wrap:nowrap;width:max-content;gap:10px;margin-bottom:12px}figure{margin:0;width:300px}` +
      `svg{width:300px;height:420px;display:block;background:${t.stage};color:${t.text};border-radius:10px}` +
      `figcaption{margin-top:5px;color:${t.caption}}</style>`;
    writeFileSync(
      `.preview/wardrobe/round15-sailor-${theme}.html`,
      '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + html
    );
  }, 60_000);
});

describe("round 16, sailor styles, light and dark", () => {
  /*
    The sailor's new options, each plain and print, whole figure and close:
    its stripes — none, one, two, three; how far they go — the collar, the
    sleeves too, the skirt's hem too; its tie — none, a knot, a necktie, in
    the collar's cloth or its own; and the boat neckline's own stripes. Then
    every sleeve and every skirt the dress offers, striped, to show each one
    takes them.
  */
  const THEMES = {
    light: { page: "#efeae4", stage: "#ffffff", text: "#1f1915", caption: "#555" },
    dark: { page: "#1a1714", stage: "#141110", text: "#f5f1ea", caption: "#b9b2a8" },
  } as const;
  const PLAIN = "fb-apricot-linen";
  const PRINT = "fb-midnight-floral";
  type Look = {
    caption: string;
    cloth: string;
    neckline?: "v" | "boat";
    sailor?: boolean;
    stripes?: StripesId;
    at?: StripesAtId;
    tie?: TieId;
    tieCloth?: string;
    sleeve?: SleeveChoice;
    skirt?: SkirtChoice;
    buttons?: ButtonsId;
    zoom: number;
    focus: [number, number];
  };
  const stage = (look: Look) => {
    const cloth = f(look.cloth);
    const g = garmentById("female-dress")!;
    let worn = wear([], cutFrom(g, cloth.id));
    worn = setNeckline(worn, g.id, `female-${look.neckline ?? "v"}-neckline`);
    if (look.sleeve) worn = setSleeve(worn, g.id, look.sleeve);
    if (look.skirt) worn = setSkirt(worn, g.id, look.skirt);
    if (look.buttons) worn = setButtons(worn, g.id, look.buttons);
    if (look.sailor ?? true) worn = setCollar(worn, g.id, "female-sailor-collar");
    const stripes = contrastingPlain(cloth);
    if (look.stripes) worn = setStripes(worn, g.id, look.stripes, stripes.id);
    if (look.at) worn = setStripesAt(worn, g.id, look.at);
    if (look.tie) worn = setTie(worn, g.id, look.tie);
    const w = worn.find((x) => x.garmentId === g.id)!;
    const regions: Partial<Record<FabricRegionId, Fabric>> = {};
    for (const r of regionsOf(g, w)) regions[r] = r === "trim" ? stripes : r === "tie" ? f(look.tieCloth ?? cloth.id) : cloth;
    const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
    return <MannequinStage outfit={outfit} fabrics={{ [g.id]: regions }} zoom={look.zoom} focus={look.focus} />;
  };
  /* one row per cloth and size: the same looks, plain then print */
  const both = (looks: (cloth: string, name: string) => Look[]) => [looks(PLAIN, "plain"), looks(PRINT, "print")];
  const WHOLE: [number, [number, number]] = [1, [300, 500]];
  const SHEETS: Record<string, Look[][]> = {
    stripes: [WHOLE, [4, [300, 228]] as [number, [number, number]]].flatMap(([zoom, focus]) =>
      both((cloth, name) =>
        (["none", "one", "two", "three"] as const).map((n) => ({ caption: `stripes: ${n}, ${name}, ${zoom}×`, cloth, stripes: n, zoom, focus }))
      )
    ),
    placement: [
      ...both((cloth, name) =>
        (["neck", "sleeves", "hem"] as const).map((at) => ({ caption: `three stripes on: ${at}, ${name}, 1×`, cloth, stripes: "three" as const, at, ...{ zoom: WHOLE[0], focus: WHOLE[1] } }))
      ),
      ...both((cloth, name) => [
        { caption: `on: sleeves · short sleeve, ${name}, 4×`, cloth, stripes: "three", at: "sleeves", zoom: 4, focus: [205, 290] },
        { caption: `on: sleeves · long, plain cuff, ${name}, 4×`, cloth, stripes: "three", at: "sleeves", sleeve: { type: "set-in", length: "long", cuff: "plain" }, zoom: 4, focus: [185, 470] },
        { caption: `on: hem · skirt hem, ${name}, 3×`, cloth, stripes: "three", at: "hem", zoom: 3, focus: [300, 760] },
      ] as Look[]),
    ],
    tie: [WHOLE, [4, [297, 270]] as [number, [number, number]]].flatMap(([zoom, focus]) =>
      both((cloth, name) => [
        { caption: `tie: none, ${name}, ${zoom}×`, cloth, stripes: "two", zoom, focus },
        { caption: `tie: knot, ${name}, ${zoom}×`, cloth, stripes: "two", tie: "knot", zoom, focus },
        { caption: `tie: necktie, ${name}, ${zoom}×`, cloth, stripes: "two", tie: "necktie", zoom, focus },
        { caption: `tie: necktie, its own cloth, ${name}, ${zoom}×`, cloth, stripes: "two", tie: "necktie", tieCloth: cloth === PLAIN ? "fb-black-crepe" : "fb-rose-silk", zoom, focus },
        { caption: `tie: knot, plain collar, ${name}, ${zoom}×`, cloth, tie: "knot", zoom, focus },
      ] as Look[])
    ),
    boat: [WHOLE, [4, [300, 212]] as [number, [number, number]]].flatMap(([zoom, focus]) =>
      both((cloth, name) => [
        ...(["none", "one", "two", "three"] as const).map((n) => ({ caption: `boat · stripes: ${n}, ${name}, ${zoom}×`, cloth, neckline: "boat" as const, sailor: false, stripes: n, zoom, focus })),
        { caption: `boat · three, sleeveless, ${name}, ${zoom}×`, cloth, neckline: "boat", sailor: false, stripes: "three", sleeve: { type: "set-in", length: "sleeveless" }, zoom, focus },
      ] as Look[])
    ),
  };
  /* every sleeve the dress offers on the V, at every length, striped round its hem; every cuff on a long one */
  const SLEEVE_LOOKS: Look[] = [];
  for (const type of ["set-in", "drop", "raglan", "kimono", "dolman", "puff", "bishop", "bell", "flutter", "cap"] as const) {
    for (const length of SLEEVE_KINDS[type].lengths) {
      const y = { short: 300, elbow: 350, "three-quarter": 410, long: 470, sleeveless: 300 }[length];
      SLEEVE_LOOKS.push({ caption: `${type} ${length}`, cloth: PRINT, stripes: "three", at: "sleeves", sleeve: { type, length }, zoom: 3, focus: [200, y] });
    }
  }
  for (const cuff of ["formal", "french"] as const) {
    SLEEVE_LOOKS.push({ caption: `set-in long, ${cuff} cuff`, cloth: PRINT, stripes: "three", at: "sleeves", sleeve: { type: "set-in", length: "long", cuff }, zoom: 3, focus: [190, 470] });
  }
  /* every skirt shape at every length, and the other waists, striped round the hem; buttoned to the hem */
  const SKIRT_LOOKS: Look[] = [];
  for (const shape of SKIRT_SHAPES) {
    for (const length of shapeLengths(shape, ["knee", "midi", "maxi"])) {
      SKIRT_LOOKS.push({ caption: `${shape} ${length}`, cloth: PLAIN, stripes: "three", at: "hem", skirt: { shape, length, waist: "natural" }, zoom: 1, focus: [300, 500] });
    }
  }
  SKIRT_LOOKS.push(
    { caption: "flared midi, empire", cloth: PLAIN, stripes: "three", at: "hem", skirt: { shape: "flared", length: "midi", waist: "empire" }, zoom: 1, focus: [300, 500] },
    { caption: "flared midi, dropped", cloth: PLAIN, stripes: "three", at: "hem", skirt: { shape: "flared", length: "midi", waist: "dropped" }, zoom: 1, focus: [300, 500] },
    { caption: "flared midi, buttoned to the hem", cloth: PLAIN, stripes: "three", at: "hem", buttons: "hem", zoom: 1, focus: [300, 500] },
    { caption: "pleated midi, buttoned to the hem, 3×", cloth: PLAIN, stripes: "three", at: "hem", buttons: "hem", skirt: { shape: "pleated", length: "midi", waist: "natural" }, zoom: 3, focus: [300, 770] },
    { caption: "tiered maxi, 3×", cloth: PRINT, stripes: "three", at: "hem", skirt: { shape: "tiered", length: "maxi", waist: "natural" }, zoom: 3, focus: [300, 900] },
  );
  const rowsOf = (looks: Look[], per: number) => Array.from({ length: Math.ceil(looks.length / per) }, (_, i) => looks.slice(i * per, i * per + per));
  SHEETS.sleeves = rowsOf(SLEEVE_LOOKS, 6);
  SHEETS.skirts = rowsOf(SKIRT_LOOKS, 6);

  for (const [name, rows] of Object.entries(SHEETS)) {
    it.each(["light", "dark"] as const)(`writes .preview/wardrobe/round16-${name}-%s.html`, (theme) => {
      const t = THEMES[theme];
      const html = renderToStaticMarkup(
        <>
          {rows.map((row, r) => (
            <div key={r} className="row">
              {row.map((look) => (
                <figure key={look.caption}>
                  {stage(look)}
                  <figcaption>{look.caption}</figcaption>
                </figure>
              ))}
            </div>
          ))}
        </>
      );
      const css =
        `<style>body{margin:0;padding:14px;background:${t.page};font:13px system-ui}` +
        `.row{display:flex;flex-wrap:nowrap;width:max-content;gap:10px;margin-bottom:12px}figure{margin:0;width:300px}` +
        `svg{width:300px;height:420px;display:block;background:${t.stage};color:${t.text};border-radius:10px}` +
        `figcaption{margin-top:5px;color:${t.caption}}</style>`;
      writeFileSync(
        `.preview/wardrobe/round16-${name}-${theme}.html`,
        '<!doctype html><meta charset="utf-8"><base href="http://localhost:3000/">' + css + html
      );
    }, 120_000);
  }
});
