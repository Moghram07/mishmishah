import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MannequinStage } from "@/components/visualizer/MannequinStage";
import { BODY_CANVAS } from "@/lib/mannequin/bodies";
import { fabricArtwork } from "@/lib/fabrics/artwork";
import { fabrics } from "@/lib/data/fabrics";
import { garmentById } from "@/lib/data/garments";
import { DEFAULT_SKIN_TONE } from "@/lib/data/skinTones";
import { cutFrom } from "./outfit";
import { contour, dart, gathers, hangingFolds, rowSpan, sleeveDrape } from "./folds";
import type { Fabric, FabricRegionId, Outfit, SleeveChoice } from "@/types";
import type { ReactNode } from "react";
import { dressFront } from "./art/female/dress";
import { blouseFront } from "./art/female/blouse";
import { skirtFor as dressSkirt } from "./art/female/dressCut";
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
 * Where the dress and the blouse are sewn — armholes, a raglan's or a dropped
 * shoulder's, a band's, a cuff's, a halter's, the waist — the seam is a soft
 * fold in the cloth's own colour: never a line drawn across the fabric, and
 * the waist seam, where the skirt is sewn on over the bodice, never outlined.
 */
describe("the dress's and the blouse's seams", () => {
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
