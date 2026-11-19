import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MannequinStage } from "@/components/visualizer/MannequinStage";
import { fabricById, fabrics } from "@/lib/data/fabrics";
import { garmentById } from "@/lib/data/garments";
import { DEFAULT_SKIN_TONE } from "@/lib/data/skinTones";
import { cutFrom, regionsOf } from "@/lib/garments/outfit";
import { CONTOUR_SHINE, CREST, SHADE, contour, crest, crestOpacity, shade, shadeOpacity, type Fold } from "@/lib/garments/folds";
import { chestBlur, crestBlur, formSheenSpec } from "@/lib/garments/sheen";
import { bodyHighlights } from "@/lib/garments/bodyLight";
import { BUST } from "@/lib/garments/art/female/yoke";
import { profileFor } from "@/lib/mannequin/profile";
import { MATTE, SHADE_COLOR, SHEEN, SHEEN_CEILING, shadeDepth, sheenPeak, sheenTint } from "./sheen";
import type { Fabric, FabricRegionId, Outfit } from "@/types";

/**
 * Satin's sheen (2026-11-18), checked where it is drawn: on the stage, over
 * the cloth, from the folds and the form — never in the cloth's tile, never
 * a stripe that repeats, never on a matte cloth, never washing a print out;
 * lit from the shading's own side and drawn out along the grain.
 *
 * Run with the true-scale checks: `npm run check:scale`.
 */

const draw = (garmentId: string, fabric: Fabric, { zoom = 1, direction = 0 } = {}) => {
  const g = garmentById(garmentId)!;
  const worn = [cutFrom(g, fabric.id)];
  const regions: Partial<Record<FabricRegionId, Fabric>> = {};
  for (const r of regionsOf(g, worn[0])) regions[r] = fabric;
  const outfit: Outfit = { bodyType: g.gender, skinTone: DEFAULT_SKIN_TONE, direction, worn };
  return renderToStaticMarkup(<MannequinStage outfit={outfit} fabrics={{ [g.id]: regions }} zoom={zoom} focus={[300, 500]} />);
};

/** The same cloth with no sheen — its matte twin. */
const matte = (f: Fabric): Fabric => ({ ...f, sheen: undefined });

/** Every tile a markup lays, in order. */
const tiles = (html: string) => [...html.matchAll(/<pattern [\s\S]*?<\/pattern>/g)].map(([t]) => t);

type Pt = [number, number];
const pointsOf = (d: string): Pt[] => {
  const n = (d.match(/-?[\d.]+/g) ?? []).map(Number);
  const out: Pt[] = [];
  for (let i = 0; i + 1 < n.length; i += 2) out.push([n[i], n[i + 1]]);
  return out;
};
/** The crest highlights a markup draws for a cloth: its tint, filled. */
const crestsOf = (html: string, f: Fabric) =>
  [...html.matchAll(new RegExp(`<path d="([^"]+)" fill="${sheenTint(f)}" fill-opacity="([\\d.]+)"`, "g"))].map(([, d, o]) => ({ d, opacity: Number(o) }));
/** The deeper shadows beside the crests a markup draws: `SHADE_COLOR`, filled. */
const shadesOf = (html: string) =>
  [...html.matchAll(new RegExp(`<path d="([^"]+)" fill="${SHADE_COLOR}" fill-opacity="([\\d.]+)"`, "g"))].map(([, d, o]) => ({ d, opacity: Number(o) }));
/** The folds' shadowed flanks a markup draws: the shadow grey, filled. */
const shadowFlanksOf = (html: string) => [...html.matchAll(/<path d="([^"]+)" fill="#4d4d4d" fill-opacity="[\d.]+"/g)].map(([, d]) => pointsOf(d));
/** The folds' lit flanks a markup draws: white, filled. */
const flanksOf = (html: string) => [...html.matchAll(/<path d="([^"]+)" fill="#ffffff" fill-opacity="[\d.]+"/g)].map(([, d]) => pointsOf(d));
const inside = ([x, y]: Pt, poly: Pt[]) => {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};
const centroid = (pts: Pt[]): Pt => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
/**
 * A point inside a crest's band: halfway across it, halfway along — its inner
 * edge runs out along the ridge and its outer edge back, point for point. (Not
 * its centroid: on a fold that curves, round an armhole, the band is a C and
 * its centroid lies in the hollow of it.)
 */
const midBand = (d: string): Pt => {
  const pts = pointsOf(d);
  const n = pts.length / 2;
  const inner = (i: number) => pts[i];
  const outer = (i: number) => pts[pts.length - 1 - i];
  const t = (n - 1) / 2;
  const [i0, i1, f] = [Math.floor(t), Math.ceil(t), t - Math.floor(t)];
  const at = (edge: (i: number) => Pt): Pt => [edge(i0)[0] + (edge(i1)[0] - edge(i0)[0]) * f, edge(i0)[1] + (edge(i1)[1] - edge(i0)[1]) * f];
  const [a, b] = [at(inner), at(outer)];
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
};

const SATINS = fabrics.filter((f) => f.sheen);
const SHINY = ["female-dress", "female-skirt", "female-abaya", "male-thobe"];

describe("a sheen", () => {
  it("is only on satin and silk — clear on the six satins, softer on the silks, soft on the crepe satin — and never on a matte cloth", () => {
    expect(SATINS.map((f) => `${f.id}:${f.sheen}`)).toEqual([
      "fb-rose-silk:medium",
      "fb-midnight-floral:medium",
      "fb-ivory-damask:medium",
      "fb-ivory-satin:bright",
      "fb-champagne-satin:bright",
      "fb-emerald-satin:bright",
      "fb-burgundy-satin:bright",
      "fb-navy-satin:bright",
      "fb-black-satin:bright",
      "fb-black-crepe-satin:soft",
    ]);
    for (const f of fabrics) {
      if (MATTE.includes(f.material)) expect(f.sheen, `${f.id} is ${f.material}, matte`).toBeUndefined();
      if (f.sheen) expect(["satin", "silk"], f.id).toContain(f.material);
    }
    // the crepe satin about a third of the satin's, every part of it; the silk between the two
    for (const part of ["crest", "crestMax", "form", "shade", "shadeMax"] as const) {
      expect(SHEEN.soft[part] / SHEEN.bright[part], part).toBeCloseTo(1 / 3, 2);
      expect(SHEEN.medium[part], part).toBeGreaterThan(SHEEN.soft[part]);
      expect(SHEEN.medium[part], part).toBeLessThan(SHEEN.bright[part]);
    }
  });

  it("draws nothing on a matte cloth — no highlight, no filter for one — on the dress, the skirt, the abaya and the thobe", () => {
    for (const f of fabrics.filter((x) => !x.sheen)) {
      for (const g of ["female-dress", "female-abaya", "male-thobe"]) expect(draw(g, f).includes("sheen-"), `${f.id} on ${g}`).toBe(false);
    }
  }, 120_000);

  it("is drawn on a satin: along the folds' crests and over the form, and a matte twin of it is drawn exactly as before", () => {
    for (const f of SATINS) {
      for (const g of SHINY) {
        const html = draw(g, f);
        expect(crestsOf(html, f).length, `${f.id} on ${g}: crests`).toBeGreaterThan(4);
        expect(html.includes("-sheen-form)"), `${f.id} on ${g}: the form's highlight`).toBe(true);
        expect(draw(g, matte(f)).includes("sheen-"), `${f.id}'s matte twin on ${g}`).toBe(false);
      }
    }
  }, 120_000);

  it("is never printed into the cloth: the tiles are the same with it as without, so true scale is untouched", () => {
    for (const f of SATINS) {
      for (const g of SHINY) {
        for (const zoom of [1, 2.5, 8]) {
          expect(tiles(draw(g, f, { zoom })), `${f.id} on ${g} at ${zoom}×`).toEqual(tiles(draw(g, matte(f), { zoom })));
        }
      }
    }
    // and none of it is laid in a tile
    const html = draw("female-dress", fabricById("fb-emerald-satin")!);
    for (const t of tiles(html)) expect(t.includes("sheen"), "a sheen in a tile").toBe(false);
  }, 120_000);

  it("never makes stripes that repeat: every highlight lies on a fold of the garment's own, unevenly spaced, and is the same whatever the print repeats at", () => {
    const satin = fabricById("fb-emerald-satin")!;
    if (satin.source !== "procedural") throw new Error("a drawn satin");
    for (const g of SHINY) {
      const html = draw(g, satin);
      const flanks = flanksOf(html);
      const crests = crestsOf(html, satin);
      // each highlight sits on the lit side of one of the garment's folds — none laid across the cloth on its own
      for (const c of crests) {
        const at = midBand(c.d);
        expect(flanks.some((poly) => inside(at, poly)), `${g}: a highlight at ${at.map(Math.round)} on no fold`).toBe(true);
      }
      // the same highlights over a cloth that repeats every 2 cm and one that repeats every 24: tied to the folds, not the print
      for (const motif of ["stripe", "floralLarge"] as const) {
        const printed: Fabric = { ...satin, motif };
        expect(crestsOf(draw(g, printed), printed), `${g}: under a ${motif}`).toEqual(crests);
      }
    }
    // across a skirt the highlights fall where its folds do, never at one interval as a printed stripe would
    for (const [g, y] of [["female-dress", 700], ["female-skirt", 690], ["female-abaya", 700], ["male-thobe", 700]] as const) {
      const xs: number[] = [];
      for (const c of crestsOf(draw(g, satin), satin)) {
        const pts = pointsOf(c.d);
        const hits: number[] = [];
        for (let i = 0; i < pts.length; i++) {
          const [a, b] = [pts[i], pts[(i + 1) % pts.length]];
          if ((a[1] - y) * (b[1] - y) < 0) hits.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
        }
        if (hits.length >= 2) xs.push((Math.min(...hits) + Math.max(...hits)) / 2);
      }
      xs.sort((a, b) => a - b);
      const gaps = xs.slice(1).map((x, i) => x - xs[i]).filter((d) => d > 1);
      expect(gaps.length, `${g}: highlights across row ${y}`).toBeGreaterThanOrEqual(4);
      const mean = gaps.reduce((s, d) => s + d, 0) / gaps.length;
      const spread = Math.sqrt(gaps.reduce((s, d) => s + (d - mean) ** 2, 0) / gaps.length) / mean;
      expect(spread, `${g}: gaps ${gaps.map((d) => d.toFixed(1)).join(" ")}`).toBeGreaterThan(0.05);
    }
  }, 120_000);

  it("never washes a print out: it only brightens, and keeps at least half of a print's contrast", () => {
    for (const [level, look] of Object.entries(SHEEN)) {
      expect(sheenPeak(look), level).toBeLessThanOrEqual(SHEEN_CEILING);
      expect(look.crestMax, level).toBeLessThanOrEqual(SHEEN_CEILING);
    }
    expect(SHEEN_CEILING).toBeLessThanOrEqual(0.5);
    for (const f of SATINS) {
      const html = draw("female-dress", f);
      const look = SHEEN[f.sheen!];
      for (const c of crestsOf(html, f)) expect(c.opacity, f.id).toBeLessThanOrEqual(look.crestMax);
      // the form's highlights — its outline's and the body's — held as one layer to the look's
      expect(html.includes(`style="mix-blend-mode:screen" opacity="${look.form}"`), f.id).toBe(true);
      // and the shadow beside a crest never darker than the look's deepest, which leaves over half
      for (const c of shadesOf(html)) expect(c.opacity, `${f.id}: a shade`).toBeLessThanOrEqual(look.shadeMax);
      expect(shadeDepth(look), f.sheen).toBeLessThanOrEqual(SHEEN_CEILING);
      // the shadows multiplied, so they can only darken: the last blend before every one is a multiply
      const blendAt = (at: number) => [...html.slice(0, at).matchAll(/mix-blend-mode:([a-z-]+)/g)].pop()?.[1];
      for (const m of html.matchAll(new RegExp(`fill="${SHADE_COLOR}"`, "g"))) expect(blendAt(m.index!), `${f.id}: a shade`).toBe("multiply");
      // the highlights screened, so they can only lighten: the last blend before every one is a screen
      const blendBefore = (at: number) => [...html.slice(0, at).matchAll(/mix-blend-mode:([a-z-]+)/g)].pop()?.[1];
      for (const m of html.matchAll(new RegExp(`fill="${sheenTint(f)}"`, "g"))) expect(blendBefore(m.index!), `${f.id}: a crest`).toBe("screen");
      for (const m of html.matchAll(/-sheen-form\)"/g)) expect(blendBefore(m.index!), `${f.id}: the form`).toBe("screen");
    }
  }, 120_000);

  it("deepens the shadow right beside each crest, on the side turned away — on a satin or a silk, never on a matte cloth", () => {
    for (const f of SATINS) {
      for (const g of SHINY) {
        const html = draw(g, f);
        const flanks = shadowFlanksOf(html);
        const shades = shadesOf(html);
        expect(shades.length, `${f.id} on ${g}: shadows beside the crests`).toBeGreaterThan(4);
        // each on the shadowed side of one of the garment's folds
        for (const c of shades) {
          const at = midBand(c.d);
          expect(flanks.some((poly) => inside(at, poly)), `${f.id} on ${g}: a shadow at ${at.map(Math.round)} on no fold's shadowed side`).toBe(true);
        }
      }
    }
    // the crepe satin's a third of the satin's, the silk's between
    const deepest = (id: string) => Math.max(...shadesOf(draw("female-dress", fabricById(id)!)).map((c) => c.opacity));
    expect(deepest("fb-black-crepe-satin")).toBeLessThan(deepest("fb-rose-silk"));
    expect(deepest("fb-rose-silk")).toBeLessThan(deepest("fb-black-satin"));
    // a matte cloth: none — the same shadows as before
    for (const f of fabrics.filter((x) => !x.sheen)) expect(shadesOf(draw("female-dress", f)).length, f.id).toBe(0);
  }, 120_000);

  it("shines where the body turns the cloth toward the light: her upper chest, the shoulders, the tops of the sleeves", () => {
    const satin = fabricById("fb-emerald-satin")!;
    const curves = (html: string) => (html.match(new RegExp(`<path d="[^"]+" fill="${sheenTint(satin)}" opacity="`, "g")) ?? []).length;
    // her fitted dress: both shoulders, both sleeve tops, her bust
    const dress = draw("female-dress", satin);
    const all = bodyHighlights("female");
    expect(all.length).toBe(6);
    for (const b of all) expect(dress.includes(`d="${b.d}"`), `her ${b.d.slice(0, 24)}…`).toBe(true);
    // lit from the upper left: each on her left brighter than on her right — shoulders, sleeves, chest
    for (const [l, r] of [[0, 1], [2, 3], [4, 5]]) expect(all[l].strength, `pair ${l}`).toBeGreaterThan(all[r].strength);
    // the left ones on her left, x under the centre line
    for (const l of [0, 2, 4]) expect(centroid(pointsOf(all[l].d))[0]).toBeLessThan(300);
    // an abaya hangs clear of her bust: shoulders and sleeves only
    expect(bodyHighlights("female", { bust: false }).length).toBe(4);
    const abaya = draw("female-abaya", satin);
    for (const b of all.slice(4)) expect(abaya.includes(`d="${b.d}"`), "a bust on a robe").toBe(false);
    for (const b of all.slice(0, 4)) expect(abaya.includes(`d="${b.d}"`), "her shoulders under the abaya's sheen").toBe(true);
    // his thobe: his own shoulders and arms
    const thobe = draw("male-thobe", satin);
    for (const b of bodyHighlights("male", { bust: false })) expect(thobe.includes(`d="${b.d}"`), "his shoulders").toBe(true);
    // a matte cloth: none of it
    expect(curves(draw("female-dress", fabricById("fb-cream")!))).toBe(0);
    // drawn in every region of it the form shines in, masked to each — the skirt's, a piece hung clear of her bust, without it
    expect(curves(dress)).toBeGreaterThanOrEqual(6);
  }, 60_000);

  it("lights her upper chest as one broad band, never a spot on each breast", () => {
    const all = bodyHighlights("female");
    const broad = all.filter((b) => b.broad);
    // two halves of one band, the left lit more, and nothing else drawn wide
    expect(broad.length).toBe(2);
    expect(broad[0].strength).toBeGreaterThan(broad[1].strength);
    const [left, right] = broad.map((b) => pointsOf(b.d));
    // they meet edge to edge on the centre line: the left half's inner edge is the right half's
    const onLine = (pts: Pt[]) => pts.filter(([x]) => Math.abs(x - 300) < 0.05).map(([, y]) => y).sort((a, b) => a - b);
    expect(onLine(left).length).toBe(2);
    expect(onLine(right)).toEqual(onLine(left));
    // broad: from inside one shoulder to inside the other, well over half the shoulders' span
    const xs = [...left, ...right].map(([x]) => x);
    const ys = [...left, ...right].map(([, y]) => y);
    const p = profileFor("female");
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(150);
    // across the upper chest: below the shoulder point, its lowest still above the bust's apex
    expect(Math.min(...ys)).toBeGreaterThan(p.shoulderPointY);
    expect(Math.max(...ys)).toBeLessThan(BUST.points[0][1] - 8);
    // and higher at the shoulders than on the centre line, as the body is
    const topAt = (pts: Pt[], x: number) => Math.min(...pts.filter(([px]) => Math.abs(px - x) < 0.05).map(([, y]) => y));
    expect(topAt(left, Math.min(...xs))).toBeLessThan(topAt(left, 300));
    // soft: through its own blur, several times the narrow curves', so the band has no edge to read as a shape
    const satin = fabricById("fb-emerald-satin")!;
    expect(chestBlur(SHEEN.bright)[0]).toBeGreaterThanOrEqual(8);
    const dress = draw("female-dress", satin);
    expect(dress).toMatch(/<filter id="[^"]*sheen-chest[^"]*"[^>]*><feGaussianBlur stdDeviation="9 /);
    for (const b of broad) expect(dress.includes(`d="${b.d}"`)).toBe(true);
    // a robe hangs clear of her figure: no band on it; his body has none
    expect(bodyHighlights("female", { bust: false }).some((b) => b.broad)).toBe(false);
    expect(bodyHighlights("male").some((b) => b.broad)).toBe(false);
  });

  it("keeps her bodice clean under the bust: the contour there takes a fraction of a crest's light and shade", () => {
    // the turn of the cloth under the bust, as the dress and her tops draw it
    const under = contour({ centre: [265, 290], half: 26, sag: 9, width: 7, shadow: 0.24, light: 0.16, soft: 6 });
    const open: Fold = { ...under, shine: undefined };
    expect(under.shine).toBe(CONTOUR_SHINE);
    expect(CONTOUR_SHINE).toBeLessThanOrEqual(0.35);
    for (const look of [SHEEN.bright, SHEEN.medium, SHEEN.soft]) {
      // a third of what a fold in the open takes, or less: no line of light, no dark line under it
      expect(crestOpacity(under, look)).toBeLessThanOrEqual(Math.ceil(crestOpacity(open, look) * CONTOUR_SHINE * 100) / 100);
      expect(shadeOpacity(under, look)).toBeLessThanOrEqual(Math.ceil(shadeOpacity(open, look) * CONTOUR_SHINE * 100) / 100);
    }
    // on the satin dress, every crest under her bust is that faint
    const dress = draw("female-dress", fabricById("fb-emerald-satin")!);
    const faint = crestOpacity(under, SHEEN.bright);
    expect(faint).toBeLessThan(0.06);
    expect(dress.includes(`fill-opacity="${faint}"`)).toBe(true);
    // a matte cloth has no crest light or shade to soften: its folds are as they were
    expect(shadesOf(draw("female-dress", fabricById("fb-cream")!)).length).toBe(0);
  });

  it("comes from the shading's light, upper left: a crest shines on its lit side, and the form where it turns toward the light", () => {
    const fold = (ridge: Pt[]): Fold => ({ ridge, width: [10, 10], shadow: 0.4, light: 0.3, soft: 4 });
    // a fold running down the cloth shines on its left, one running across on its upper side
    const down = centroid(pointsOf(crest(fold([[300, 400], [300, 600]]))));
    expect(down[0]).toBeLessThan(300);
    expect(down[0]).toBeGreaterThan(300 - 10 * CREST[1]);
    const across = centroid(pointsOf(crest(fold([[200, 500], [400, 500]]))));
    expect(across[1]).toBeLessThan(500);
    // and its shadow deepens on the other side, right against the ridge: on the right of one running down, below one running across
    const downShade = centroid(pointsOf(shade(fold([[300, 400], [300, 600]]))));
    expect(downShade[0]).toBeGreaterThan(300);
    expect(downShade[0]).toBeLessThan(300 + 10 * SHADE[1]);
    expect(centroid(pointsOf(shade(fold([[200, 500], [400, 500]]))))[1]).toBeGreaterThan(500);
    // the highlight and the shadow meet at the ridge: neither reaches far past it
    expect(CREST[0] + SHADE[0]).toBeLessThan(0.2);
    // the form's field is compared with the point toward the light — whatever way the grain is turned, back on the screen it points away from the light
    for (const turn of [0, 45, 90]) {
      const [sx, sy] = formSheenSpec(12, SHEEN.bright, turn).shift;
      const a = (turn * Math.PI) / 180;
      const screen = [sx * Math.cos(a) - sy * Math.sin(a), sx * Math.sin(a) + sy * Math.cos(a)];
      expect(screen[0] * -Math.SQRT1_2 + screen[1] * -Math.SQRT1_2, `grain at ${turn}°`).toBeLessThan(0);
    }
  });

  it("is drawn out along the grain: blurred longer along it than across, and turned with it", () => {
    for (const look of Object.values(SHEEN)) {
      for (const s of [1, 2, 4, 6, 9]) {
        const [a, b] = crestBlur(s, look);
        expect(b, `softness ${s}`).toBeGreaterThan(a);
      }
      const form = formSheenSpec(12, look, 0);
      expect(form.along).toBeGreaterThan(form.across);
    }
    const satin = fabricById("fb-emerald-satin")!;
    // straight grain: no turn; cross grain: turned a quarter, blurred, and turned back
    const straight = draw("female-dress", satin);
    expect(/rotate\([^)]*\)"><g filter="url\(#[^"]*-sheen-/.test(straight)).toBe(false);
    const cross = draw("female-dress", satin, { direction: 90 });
    const turned = [...cross.matchAll(/<g transform="rotate\((-?[\d.]+) 300 500\)"><g filter="url\(#[^"]*-sheen-/g)].map(([, t]) => Number(t));
    expect(turned.length).toBeGreaterThan(0);
    for (const t of turned) expect(t).toBe(90);
    expect(cross.includes('transform="rotate(-90 300 500)"')).toBe(true);
    // and the same highlights, only drawn out the other way
    expect(crestsOf(cross, satin)).toEqual(crestsOf(straight, satin));
  }, 60_000);
});
