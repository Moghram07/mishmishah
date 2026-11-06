import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MannequinStage } from "@/components/visualizer/MannequinStage";
import { BODY_CANVAS } from "@/lib/mannequin/bodies";
import { fabricArtwork } from "@/lib/fabrics/artwork";
import { fabrics } from "@/lib/data/fabrics";
import { garmentById, garments } from "@/lib/data/garments";
import { collars } from "@/lib/data/collars";
import { sleeveLengthsFor, sleeveTypesFor } from "@/lib/data/sleeves";
import { collarArt, garmentArt, type RegionArt } from "./art";
import { DEFAULT_SKIN_TONE } from "@/lib/data/skinTones";
import { cutFrom } from "./outfit";
import { contour, dart, gathers, hangingFolds, rowSpan, sleeveDrape, tierFolds, tierGathers, tierRidges, tierSeams, type Fold } from "./folds";
import { clothWarp } from "./shading";
import type { Fabric, FabricRegionId, Outfit, SleeveChoice } from "@/types";
import type { ReactNode } from "react";
import { dressFront } from "./art/female/dress";
import { blouseFront } from "./art/female/blouse";
import { seamAt, skirtFor as dressSkirt } from "./art/female/dressCut";
import { fallOf } from "./skirts";
import { pathPoints } from "./art/sleeveFolds";
import type { Pt } from "./fit";

/**
 * Folds are light and shadow, laid over the cloth — never the cloth itself.
 *
 * The rule that matters most: a fold may not change the print's real size. A
 * drawn crease that bent or scaled the pattern under it would make the one
 * promise this visualizer makes — the print you see is the print you get — a
 * lie exactly where the eye is drawn to.
 */

const SEAM: readonly [Pt, Pt] = [
  [228, 350],
  [372, 350],
];
const HEM: readonly [Pt, Pt] = [
  [150, 760],
  [450, 760],
];

describe("a fold layout", () => {
  it("is the same every time, and different for a different seed", () => {
    const spec = { seam: SEAM, hem: HEM, hemDip: 20, count: 8, width: [2, 20] as const, seed: 7 };
    expect(hangingFolds(spec)).toEqual(hangingFolds(spec));
    expect(hangingFolds({ ...spec, seed: 8 })).not.toEqual(hangingFolds(spec));
    const g = { seam: SEAM, count: 12, length: [12, 30] as const, width: 2.4, seed: 3 };
    expect(gathers(g)).toEqual(gathers(g));
  });

  it("hangs from the seam and reaches past the hem", () => {
    for (const f of hangingFolds({ seam: SEAM, hem: HEM, count: 8, width: [2, 20], seed: 7 })) {
      expect(f.ridge[0][1]).toBeGreaterThanOrEqual(350);
      expect(f.ridge[f.ridge.length - 1][1]).toBeGreaterThan(760);
      expect(f.width[1]).toBeGreaterThan(f.width[0]);
    }
  });

  it("runs a dart to its point, and a contour under its form", () => {
    const d = dart([265, 350], [265, 280]);
    expect(d.ridge[0]).toEqual([265, 350]);
    expect(d.ridge[d.ridge.length - 1]).toEqual([265, 280]);
    expect(d.width[1]).toBeLessThan(d.width[0]);
    const c = contour({ centre: [265, 290], half: 24, sag: 8, width: 6 });
    const lowest = Math.max(...c.ridge.map(([, y]) => y));
    expect(lowest).toBeCloseTo(290, 6);
  });
});

describe("a hanging sleeve", () => {
  const long = "M180 250 L220 250 L222 480 L178 480 Z";
  const short = "M180 250 L220 250 L222 330 L178 330 Z";

  it("reads a sleeve's width at a row", () => {
    const [x0, x1] = rowSpan(long, 357)!;
    expect(x0).toBeGreaterThan(178);
    expect(x1).toBeLessThan(222);
    expect(rowSpan(short, 357)).toBeNull();
  });

  it("hangs a long sleeve: folds down it, a shadow on its inner edge, folds above the wrist", () => {
    const folds = sleeveDrape({ sleeve: long, underarm: 252, cuff: 480, elbowY: 357, wristY: 474, seed: 1 });
    const running = (f: { ridge: [number, number][] }) => {
      const [x0, y0] = f.ridge[0];
      const [x1, y1] = f.ridge[f.ridge.length - 1];
      return Math.abs(y1 - y0) > Math.abs(x1 - x0) ? "down" : "across";
    };
    // the long folds run down the sleeve, not across it
    const down = folds.filter((f) => running(f) === "down");
    expect(down.length).toBeGreaterThanOrEqual(3);
    for (const f of down) expect(f.ridge[f.ridge.length - 1][1] - f.ridge[0][1]).toBeGreaterThan(150);
    // the body's shadow falls toward the body, whatever the light does
    expect(folds.some((f) => f.shadowToward?.[0] === 1 && f.light === 0)).toBe(true);
    // nothing across the elbow but a crease or two at the inside, short and faint
    const atElbow = folds.filter((f) => running(f) === "across" && Math.abs(f.ridge[0][1] - 357) < 15);
    expect(atElbow.length).toBeLessThanOrEqual(2);
    for (const f of atElbow) expect(Math.abs(f.ridge[1][0] - f.ridge[0][0])).toBeLessThan(15);
    // a few small folds just above the wrist
    expect(folds.filter((f) => running(f) === "across" && f.ridge[0][1] > 440).length).toBe(3);
  });

  it("gives a short sleeve no elbow crease and no wrist folds", () => {
    const folds = sleeveDrape({ sleeve: short, underarm: 252, cuff: 330, elbowY: 357, wristY: 474, seed: 1 });
    expect(folds.every((f) => f.ridge.every(([, y]) => y < 340))).toBe(true);
  });
});

describe("folds change the light, never the print", () => {
  const plaid = fabrics.find((f) => f.id === "fb-indigo-plaid")!;
  const dress = garmentById("female-dress")!;
  const regions: Partial<Record<FabricRegionId, Fabric>> = { top: plaid, bottom: plaid };
  const outfit: Outfit = {
    bodyType: "female",
    skinTone: DEFAULT_SKIN_TONE,
    direction: 0,
    worn: [cutFrom(dress, plaid.id)],
  };
  // Close enough in that the print is tiled at its real repeat, not held open.
  const markup = renderToStaticMarkup(
    <MannequinStage outfit={outfit} fabrics={{ [dress.id]: regions }} zoom={4} focus={[300, 420]} />
  );

  it("keeps every tile of the print at its true size", () => {
    const tile = fabricArtwork(plaid).repeatCm / BODY_CANVAS.cmPerUnit;
    const patterns = [...markup.matchAll(/<pattern[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"/g)];
    expect(patterns.length).toBeGreaterThan(0);
    for (const [, w, h] of patterns) {
      expect(Number(w)).toBeCloseTo(tile, 6);
      expect(Number(h)).toBeCloseTo(tile, 6);
    }
  });

  it("draws folds only as flat grey and white, in the shading and light layers", () => {
    const groups = [...markup.matchAll(/<g filter="url\(#[^"]*fold-soft-[\d.]+\)">([\s\S]*?)<\/g>/g)];
    expect(groups.length).toBeGreaterThan(0);
    for (const [, inner] of groups) {
      const fills = [...inner.matchAll(/fill="([^"]+)"/g)].map((m) => m[1]);
      for (const fill of fills) expect(["#4d4d4d", "#ffffff"]).toContain(fill);
      // no pattern, no image, no displacement inside a fold
      expect(inner).not.toMatch(/url\(#|<image|feDisplacementMap/);
    }
    expect(markup).toMatch(/mix-blend-mode:\s*screen/);
  });
});

/**
 * Wherever a garment is sewn — armholes, a raglan's or a dropped shoulder's, a
 * band's, a cuff's, a halter's, a collar's band, the trousers' centre front, a
 * closed abaya's, the dress's waist — the seam is a soft fold in the cloth's
 * own colour: never a line drawn across the fabric, and the waist seam, where
 * the skirt is sewn on over the bodice, never outlined.
 */
describe("seams", () => {
  const uid = (name: string) => name;
  const html = (node: ReactNode) => renderToStaticMarkup(<>{node}</>);
  /* a seam drawn as a line: `seamShadows`' grey stroke */
  const LINE = 'stroke="#6e6e6e"';
  const DRESS_SKIRT = { shape: "flared", length: "midi" } as const;

  it("draws every seam on them as a fold, never as a line", () => {
    const sleeves: SleeveChoice[] = [
      { type: "set-in", length: "short" },
      { type: "raglan", length: "long", cuff: "plain" },
      { type: "drop", length: "elbow" },
      { type: "dolman", length: "long", cuff: "plain" },
    ];
    for (const waist of ["empire", "natural", "dropped"] as const) {
      for (const sleeve of sleeves) {
        const top = dressFront.cut!({ sleeve, skirt: { ...DRESS_SKIRT, waist } }).top!;
        const drawn = html(top.shading?.(uid)) + html(top.light?.(uid));
        expect(drawn, `${waist}, ${sleeve.type}`).not.toContain(LINE);
        /* and each seam is there, as a fold: a lit flank and a shadowed one */
        expect(drawn, `${waist}, ${sleeve.type}`).toContain("fold-soft-2");
      }
    }
    const banded = dressFront.cut!({ neckline: "off-shoulder", sleeve: { type: "off-shoulder", length: "elbow" }, skirt: { ...DRESS_SKIRT, waist: "natural" } }).top!;
    const halter = dressFront.cut!({ neckline: "halter", sleeve: { type: "set-in", length: "sleeveless" }, skirt: { ...DRESS_SKIRT, waist: "natural" } }).top!;
    for (const [name, top] of [["off-shoulder", banded], ["halter", halter]] as const) expect(html(top.shading?.(uid)), name).not.toContain(LINE);
    const blouse = blouseFront.cut!({ sleeve: { type: "set-in", length: "long", cuff: "plain" } }).body!;
    expect(html(blouse.shading?.(uid)) + html(blouse.light?.(uid))).not.toContain(LINE);
  });

  /* a tiered skirt's tiers, sewn one under another: each seam a fold right across it, sagging at the centre front as its hem does */
  it("draws a tiered skirt's seams as folds from side to side, never as lines", () => {
    for (const length of ["knee", "midi", "maxi"] as const) {
      for (const waist of ["empire", "natural", "dropped"] as const) {
        const bottom = dressFront.cut!({ skirt: { shape: "tiered", length, waist } }).bottom!;
        expect(html(bottom.shading?.(uid)) + html(bottom.light?.(uid)), `dress, ${waist}, ${length}`).not.toContain(LINE);
      }
      const skirt = garmentArt("female-skirt-front")!.cut!({ skirt: { shape: "tiered", length } }).body!;
      expect(html(skirt.shading?.(uid)) + html(skirt.light?.(uid)), `skirt, ${length}`).not.toContain(LINE);
    }
    const sk = dressSkirt(undefined, { shape: "tiered", length: "midi", waist: "natural" });
    const spec = { path: sk.path, top: sk.waistY, gathered: true, seams: sk.tiers!.at, hem: [sk.hemLeft, [600 - sk.hemLeft[0], sk.hemLeft[1]]] as [Pt, Pt], hemDip: 22, at: fallOf("tiered").waves!, seed: 7 };
    const seams = tierSeams(spec);
    expect(seams).toHaveLength(2);
    const sags = seams.map((pts, i) => {
      const y = sk.tiers!.at[i];
      const [l, r] = rowSpan(sk.path, y + 0.5)!;
      /* from one side to the other, on its own row there */
      expect(pts[0][0], `seam ${i}`).toBeCloseTo(l + 1, 0);
      expect(pts[pts.length - 1][0], `seam ${i}`).toBeCloseTo(r - 1, 0);
      expect(pts[0][1], `seam ${i}`).toBeCloseTo(y, 0);
      return Math.max(...pts.map(([, py]) => py)) - y;
    });
    /* sagging at the centre, the lower more */
    expect(sags[0]).toBeGreaterThan(2);
    expect(sags[1]).toBeGreaterThan(sags[0]);
    /* and each a thin lit line, with a narrow soft shadow just under it — a few millimetres — where the tier below hangs from it */
    const folds = tierFolds(spec);
    for (const seam of seams) {
      const on = folds.filter((f) => f.ridge.length === seam.length && f.ridge.every(([x, y], i) => x === seam[i][0] && y === seam[i][1]));
      const line = on.find((f) => f.light > 0 && f.shadow === 0);
      const shade = on.find((f) => f.shadow > 0 && f.light === 0);
      expect(Math.max(...line!.width)).toBeLessThanOrEqual(1.2);
      expect(line!.light).toBeGreaterThanOrEqual(0.3);
      expect(Math.max(...shade!.width) * BODY_CANVAS.cmPerUnit).toBeLessThanOrEqual(0.6);
      expect(shade!.shadow).toBeGreaterThanOrEqual(0.4);
    }
  });

  /* a tiered skirt's tiers, at a waist and a length, as the dress hands them to `tierFolds` */
  const tieredSpec = (waist: "empire" | "natural" | "dropped", length: "knee" | "midi" | "maxi") => {
    const sk = dressSkirt(undefined, { shape: "tiered", length, waist });
    const hem: [Pt, Pt] = [sk.hemLeft, [600 - sk.hemLeft[0], sk.hemLeft[1]]];
    return { sk, spec: { path: sk.path, top: seamAt(waist), gathered: true, seams: sk.tiers!.at, hem, hemDip: 22, at: fallOf("tiered").waves!, seed: 7 } };
  };

  /*
    Many small gathers right under every seam, 1 to 1.5 cm apart — closer, and
    so more of them, on each fuller tier below — standing out for their first
    5 to 8 cm: on the dress at every waist and length. And none under a
    jacket's hem that the first tier comes out from under, where it is not
    gathered.
  */
  it("gathers each tier into its seam: small gathers 1 to 1.5 cm apart and 5 to 8 cm long, more on each tier below", () => {
    const cm = BODY_CANVAS.cmPerUnit;
    for (const waist of ["empire", "natural", "dropped"] as const) {
      for (const length of ["knee", "midi", "maxi"] as const) {
        const { sk, spec } = tieredSpec(waist, length);
        const tiers = tierGathers(spec);
        expect(tiers).toHaveLength(3);
        [spec.top, ...sk.tiers!.at].forEach((y, k) => {
          const name = `${waist}, ${length}, tier ${k + 1}`;
          const gathers = tiers[k];
          const [l, r] = rowSpan(sk.path, y + 0.5)!;
          const apart = ((r - l) / gathers.length) * cm;
          expect(apart, name).toBeGreaterThanOrEqual(0.9);
          expect(apart, name).toBeLessThanOrEqual(1.6);
          for (const g of gathers) {
            const run = (g.ridge[g.ridge.length - 1][1] - g.ridge[0][1]) * cm;
            expect(run, name).toBeGreaterThanOrEqual(5);
            expect(run, name).toBeLessThanOrEqual(8);
            /* standing out from the cloth: as wide a flank at the seam as a cowl's crest at its widest */
            expect(g.width[0], name).toBeGreaterThanOrEqual(1.5);
          }
          if (k > 0) expect(gathers.length, name).toBeGreaterThan(tiers[k - 1].length);
        });
      }
    }
    expect(tierGathers({ ...tieredSpec("natural", "midi").spec, gathered: false })[0]).toHaveLength(0);
  });

  /* and on a print the weave bends a little along them — moved, never resized — on a tiered skirt and on no other */
  it("bends a tiered skirt's print along its gathers, and no other skirt's", () => {
    for (const waist of ["empire", "natural", "dropped"] as const) {
      const bottom = dressFront.cut!({ skirt: { shape: "tiered", length: "midi", waist } }).bottom!;
      expect(bottom.surface?.gathers, waist).toBe(tierRidges(tieredSpec(waist, "midi").spec));
      expect(bottom.surface?.warp, waist).toBe(5);
    }
    const skirt = garmentArt("female-skirt-front")!.cut!({ skirt: { shape: "tiered", length: "midi" } }).body!;
    expect(skirt.surface?.gathers?.match(/Z/g)?.length ?? 0).toBeGreaterThan(60);
    for (const shape of ["aline", "flared", "circle", "pencil", "pleated", "mermaid"] as const) {
      const other = dressFront.cut!({ skirt: { shape, length: "midi", waist: "natural" } }).bottom ?? dressFront.regions.bottom!;
      expect(other.surface?.gathers, shape).toBeUndefined();
    }
    /* the warp reads them only when they are there: its markup is unchanged for everything else */
    const html = (node: ReactNode) => renderToStaticMarkup(<svg>{node}</svg>);
    expect(html(clothWarp("w", { blur: 16, scale: 5 }))).not.toContain("gather");
    expect(html(clothWarp("w", { blur: 16, scale: 5, gathers: "M0 0 L1 0 L1 1 Z" }))).toContain('result="gather-gx"');
  });

  /*
    Bent, never torn: across a row of gathers the print moves one way and then
    the other, and where the move changes by more than 0.7 units from one unit
    to the next a motif split across a gather comes apart in strips. Read the
    warp's own numbers out of its markup and follow them across a row of
    gathers, 1 to 1.5 cm apart and as wide as `tierRidges` draws them: as a
    gather's band is blurred, its slope read across the step, and the print
    moved by it.
  */
  it("bends a print along gathers without tearing it", () => {
    const markup = renderToStaticMarkup(<svg>{clothWarp("w", { blur: 16, scale: 5, gathers: "M0 0 L1 0 L1 1 Z" })}</svg>);
    const attr = (tag: RegExp, name: string) => Number(markup.match(tag)![0].match(new RegExp(`${name}="(-?[0-9.]+)"`))![1]);
    const soft = attr(/<feGaussianBlur in="gathers"[^>]*>/, "stdDeviation");
    const step = Math.abs(attr(/<feOffset in="grgb"[^>]*result="gax"[^>]*>/, "dx"));
    const gain = attr(/<feComposite[^>]*result="gather-gx"[^>]*>/, "k2");
    const scale = 5;
    const dx = 0.05;
    for (const cm of [1, 1.25, 1.5]) {
      const pitch = cm / BODY_CANVAS.cmPerUnit;
      for (const half of [1.05, 1.4, 1.75]) {
        const n = Math.round((pitch * 6) / dx);
        const band = Array.from({ length: n }, (_, i) => (Math.abs(((i * dx) % pitch) - pitch / 2) <= half ? 1 : 0));
        const k = Math.ceil((3 * soft) / dx);
        const kernel = Array.from({ length: 2 * k + 1 }, (_, j) => Math.exp(-(((j - k) * dx) ** 2) / (2 * soft * soft)));
        const total = kernel.reduce((a, w) => a + w, 0);
        const h = band.map((_, i) => kernel.reduce((a, w, j) => a + w * band[(i + j - k + n) % n], 0) / total);
        const shift = Math.round(step / dx);
        const move = h.map((v, i) => scale * gain * (v - h[(i - shift + n) % n]));
        const steepest = Math.max(...move.map((m, i) => Math.abs(move[(i + 1) % n] - m) / dx));
        expect(steepest, `${cm} cm apart, ${half} units each side`).toBeLessThanOrEqual(0.7);
        /* and it does bend: half a unit at least, where they are furthest apart */
        if (cm === 1.5 && half === 1.4) expect(Math.max(...move.map(Math.abs))).toBeGreaterThanOrEqual(0.5);
      }
    }
  });

  /*
    How much shadow a skirt's folds lay across a row, for each unit of it: each
    flank crossing the row, as wide as it is there, times how dark it is.
  */
  const shadeAt = (folds: Fold[], y: number, width: number): number =>
    folds.reduce((sum, f) => {
      for (let i = 1; i < f.ridge.length; i++) {
        const [y0, y1] = [f.ridge[i - 1][1], f.ridge[i][1]];
        if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
          const u = (i - 1 + (y - y0) / (y1 - y0)) / (f.ridge.length - 1);
          return sum + f.shadow * (f.width[0] + (f.width[1] - f.width[0]) * u);
        }
      }
      return sum;
    }, 0) / width;

  /*
    One light over the whole of a tiered skirt: no tier darker at its foot than
    through its middle, to start light again under the seam below, and no dark
    band under any seam — nor, the other way, a light one, its folds gone
    short of each seam — on the dress at every waist and length.
  */
  it("lights a tiered skirt as one piece: no tier darkening or lightening toward its foot, no band under a seam", () => {
    for (const waist of ["empire", "natural", "dropped"] as const) {
      for (const length of ["knee", "midi", "maxi"] as const) {
        const sk = dressSkirt(undefined, { shape: "tiered", length, waist });
        const hem: [Pt, Pt] = [sk.hemLeft, [600 - sk.hemLeft[0], sk.hemLeft[1]]];
        const top = seamAt(waist);
        const folds = tierFolds({ path: sk.path, top, gathered: true, seams: sk.tiers!.at, hem, hemDip: 22, at: fallOf("tiered").waves!, seed: 7 });
        const mean = (from: number, to: number) => {
          let sum = 0;
          for (let y = from; y < to; y++) {
            const [l, r] = rowSpan(sk.path, y + 0.5)!;
            sum += shadeAt(folds, y, r - l);
          }
          return sum / (to - from);
        };
        const tops = [top, ...sk.tiers!.at];
        for (let k = 0; k < sk.tiers!.at.length; k++) {
          const [a, b] = [tops[k], tops[k + 1]];
          const name = `${waist}, ${length}, tier ${k + 1}`;
          const middle = mean(a + (b - a) / 3, a + (2 * (b - a)) / 3);
          /* its last stretch above the seam no darker than its middle, and not much lighter */
          const foot = mean(b - 14, b - 2) / middle;
          expect(foot, name).toBeLessThanOrEqual(1.05);
          expect(foot, name).toBeGreaterThanOrEqual(0.6);
          /*
            and its gathers, from just below the seam's own narrow shadow — a
            horizontal fold this measure does not see; see above — for 5 cm:
            neither a dark band nor a bare one
          */
          const gathers = mean(b + 4, b + 30) / middle;
          expect(gathers, name).toBeLessThanOrEqual(1.25);
          expect(gathers, name).toBeGreaterThanOrEqual(0.55);
        }
      }
    }
  });

  /* the hem waves softly where the lowest tier's folds reach it */
  it("brings a tiered skirt's lowest folds to its hem where it waves", () => {
    const { waves } = fallOf("tiered");
    const sk = dressSkirt(undefined, { shape: "tiered", length: "midi", waist: "natural" });
    const hem: [Pt, Pt] = [sk.hemLeft, [600 - sk.hemLeft[0], sk.hemLeft[1]]];
    const folds = tierFolds({ path: sk.path, top: sk.waistY, gathered: true, seams: sk.tiers!.at, hem, hemDip: 22, at: waves!, seed: 7 });
    for (const t of waves!) {
      const x = hem[0][0] + (hem[1][0] - hem[0][0]) * t;
      const reaching = folds.filter((f) => {
        const [fx, fy] = f.ridge[f.ridge.length - 1];
        return Math.abs(fx - x) < 0.5 && fy > hem[0][1];
      });
      expect(reaching.length, `t ${t.toFixed(2)}`).toBeGreaterThan(0);
    }
  });

  /*
    And every other garment: each sleeve it offers, at each length, with each
    cuff that is sewn on plain — a formal or French cuff's marks are where the
    cloth ends or turns, not seams — open and closed, and each collar.
  */
  it("draws every other garment's seams as folds, never as lines", () => {
    const drawn = (regions: Partial<Record<string, RegionArt>>) =>
      Object.values(regions).map((r) => html(r?.shading?.(uid)) + html(r?.light?.(uid))).join("");
    let seamed = 0;
    for (const g of garments) {
      const art = garmentArt(g.asset.front)!;
      const sleeves: (SleeveChoice | undefined)[] = g.sleeves
        ? sleeveTypesFor(g).flatMap((type) =>
            sleeveLengthsFor(type, undefined, g).flatMap((length) =>
              [undefined, ...(length === "long" ? (g.sleeves!.cuffs ?? []).filter((c) => c === "plain" || c === "rib") : [])].map(
                (cuff): SleeveChoice => (cuff ? { type, length, cuff } : { type, length })
              )
            )
          )
        : [undefined];
      for (const sleeve of sleeves) {
        for (const front of g.fronts?.offered ?? [undefined]) {
          const name = `${g.id}, ${sleeve ? `${sleeve.type} ${sleeve.length} ${sleeve.cuff ?? ""}` : "as cut"}${front ? `, ${front}` : ""}`;
          const all = drawn({ ...art.regions, ...art.cut?.({ sleeve, front }) });
          expect(all, name).not.toContain(LINE);
          if (all.includes("fold-soft-2")) seamed++;
        }
      }
    }
    for (const c of collars) {
      const art = collarArt(c.asset.front);
      if (art) expect(drawn(art.regions), c.id).not.toContain(LINE);
    }
    /* and the seams are there, as folds */
    expect(seamed).toBeGreaterThan(100);
  });

  it("does not outline the waist seam: the skirt's top, sewn on over the bodice, is a fold", () => {
    for (const waist of ["empire", "natural", "dropped"] as const) {
      const skirt = { ...DRESS_SKIRT, waist };
      const regions = dressFront.cut!({ skirt });
      const bottom = regions.bottom ?? dressFront.regions.bottom!;
      const top = dressSkirt(undefined, skirt).waistY;
      const edge = html(bottom.edge?.());
      const pts = [...edge.matchAll(/ d="([^"]+)"/g)].flatMap(([, d]) => pathPoints(d));
      const along = pts.filter((p, i) => i > 0 && Math.abs(p[1] - top) < 0.5 && Math.abs(pts[i - 1][1] - top) < 0.5);
      expect(pts.length, waist).toBeGreaterThan(10);
      expect(along, waist).toEqual([]);
    }
  });
});
