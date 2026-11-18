import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MannequinStage } from "@/components/visualizer/MannequinStage";
import { fabricById, fabrics } from "@/lib/data/fabrics";
import { garmentById } from "@/lib/data/garments";
import { DEFAULT_SKIN_TONE } from "@/lib/data/skinTones";
import { cutFrom, regionsOf } from "@/lib/garments/outfit";
import { CREST, crest, type Fold } from "@/lib/garments/folds";
import { crestBlur, formSheenSpec } from "@/lib/garments/sheen";
import { MATTE, SHEEN, SHEEN_CEILING, sheenPeak, sheenTint } from "./sheen";
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
  it("is only on satin — clear on the six satins, soft on the abaya black — and never on a matte cloth", () => {
    expect(SATINS.map((f) => `${f.id}:${f.sheen}`)).toEqual([
      "fb-ivory-satin:bright",
      "fb-champagne-satin:bright",
      "fb-emerald-satin:bright",
      "fb-burgundy-satin:bright",
      "fb-navy-satin:bright",
      "fb-black-satin:bright",
      "fb-soft-sheen-black:soft",
    ]);
    for (const f of fabrics) {
      if (MATTE.includes(f.material)) expect(f.sheen, `${f.id} is ${f.material}, matte`).toBeUndefined();
      if (f.sheen) expect(f.material, f.id).toBe("satin");
    }
    // the soft one is softer: under half the satin's light along a crest and over the form
    expect(SHEEN.soft.crestMax).toBeLessThan(SHEEN.bright.crestMax / 2);
    expect(SHEEN.soft.form).toBeLessThan(SHEEN.bright.form / 2);
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
      // the form's highlight at its brightest is the look's
      expect(html.includes(`amplitude="${look.form}"`), f.id).toBe(true);
      // both screened, so they can only lighten: the last blend before every highlight is a screen
      const blendBefore = (at: number) => [...html.slice(0, at).matchAll(/mix-blend-mode:([a-z-]+)/g)].pop()?.[1];
      for (const m of html.matchAll(new RegExp(`fill="${sheenTint(f)}"`, "g"))) expect(blendBefore(m.index!), `${f.id}: a crest`).toBe("screen");
      for (const m of html.matchAll(/-sheen-form\)"/g)) expect(blendBefore(m.index!), `${f.id}: the form`).toBe("screen");
    }
  }, 120_000);

  it("comes from the shading's light, upper left: a crest shines on its lit side, and the form where it turns toward the light", () => {
    const fold = (ridge: Pt[]): Fold => ({ ridge, width: [10, 10], shadow: 0.4, light: 0.3, soft: 4 });
    // a fold running down the cloth shines on its left, one running across on its upper side
    const down = centroid(pointsOf(crest(fold([[300, 400], [300, 600]]))));
    expect(down[0]).toBeLessThan(300);
    expect(down[0]).toBeGreaterThan(300 - 10 * CREST[1]);
    const across = centroid(pointsOf(crest(fold([[200, 500], [400, 500]]))));
    expect(across[1]).toBeLessThan(500);
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
