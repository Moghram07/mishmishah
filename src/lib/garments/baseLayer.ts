/*
  Plain `.ts`, relative and extensioned, and no JSX — so `scripts/
  preview-garments.mjs` can import it and measure the same base layer the
  stage draws.
*/
import { draft, line, mirrorPts, outline, reverse, span, trousers, type Pt } from "./fit.ts";
import { NECK_LEFT, SHOULDER_EASE, TIP_LEFT } from "./art/female/yoke.ts";
import type { BodyType, GarmentCategory } from "@/types";

/**
 * The base layer: what each mannequin wears under everything, so the body is
 * never shown bare — her a plain fitted tank top and mid-thigh shorts, him
 * mid-thigh shorts.
 *
 * It is not a garment. It has no fabric, no price and no place in the picker;
 * it is one soft grey, matte, with a soft line at the shorts' waistband and
 * nothing else. It is under everything, and hidden outright under anything
 * that covers where it is: the tank under any top or dress, the shorts under
 * any bottom or full-length garment. A jacket is neither — worn with no top,
 * the tank shows in its opening.
 */

/**
 * The colour: a soft grey, a little cool, so it reads as cloth on every skin
 * tone — lighter than the darkest by a distance, and on the lightest, which
 * is nearly as light, unlike any skin by being grey.
 */
export const BASE_GREY = "#c9cbce";

/** Which of the base layer's pieces an outfit of these categories leaves showing. */
export function baseLayerShows(
  body: BodyType,
  categories: readonly GarmentCategory[]
): { tank: boolean; shorts: boolean } {
  const top = categories.some((c) => c === "top" || c === "dress");
  const bottom = categories.some((c) => c === "bottom" || c === "dress");
  return { tank: body === "female" && !top, shorts: !bottom };
}

/** One piece of the base layer: its cloth, its free edges, and the soft lines on it. */
export interface BasePiece {
  kind: "tank" | "shorts";
  /** Closed outlines, filled. */
  shapes: string[];
  /** Its free edges, outlined as every garment's are. */
  edges: string[];
  /** Soft lines of shadow across it: the shorts' waistband. */
  lines: string[];
}

/* ------------------------------------------------------------------ the tank */

/**
 * Its ease: half a unit off her, everywhere — fitted, and inside every
 * waistband, which is cut at one, so a bottom worn over it holds it in rather
 * than letting a sliver of it out at the side.
 */
const TANK_EASE = 0.5;
/** Its straps, as shares of her shoulder from the neck: a strap about 4.5 cm wide. */
const STRAP: [number, number] = [0.4, 0.76];
/** How far down the front its scoop is cut, at the centre. */
const SCOOP_Y = 238;
/** Its hem: just past her hip bone, so any bottom's band covers it. */
const TANK_HEM_Y = 375;
/** How far below her armpit its armhole bottoms out. */
const ARMHOLE_DROP = 6;

/** A cubic from four points, sampled. */
const cubic = (a: Pt, b: Pt, c: Pt, e: Pt, steps: number): Pt[] =>
  Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const m = 1 - t;
    return [
      m * m * m * a[0] + 3 * m * m * t * b[0] + 3 * m * t * t * c[0] + t * t * t * e[0],
      m * m * m * a[1] + 3 * m * m * t * b[1] + 3 * m * t * t * c[1] + t * t * t * e[1],
    ] as Pt;
  });

/** The point a share of the way along a run, by its length. */
function along(pts: Pt[], t: number): Pt {
  const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  let left = t * lens.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lens.length; i++) {
    if (left <= lens[i]) {
      const u = left / (lens[i] || 1);
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u];
    }
    left -= lens[i];
  }
  return pts[pts.length - 1];
}

/**
 * Her tank: straps on her shoulders, a modest scoop at the front, armholes cut
 * in from the shoulder point, and a body fitted to her down past the waist.
 */
function tank(): BasePiece {
  const d = draft("female");
  const shoulder = d.shoulder([NECK_LEFT[0], NECK_LEFT[1]], [TIP_LEFT[0], TIP_LEFT[1]], SHOULDER_EASE);
  const strap = Array.from({ length: 6 }, (_, i) => along(shoulder, STRAP[0] + ((STRAP[1] - STRAP[0]) * i) / 5));
  const [inner, outer] = [strap[0], strap[strap.length - 1]];
  /* the scoop: down from the strap's inner corner, round to the centre */
  const scoop = cubic(inner, [inner[0] + 2, inner[1] + 0.6 * (SCOOP_Y - inner[1])], [300 - 24, SCOOP_Y], [300, SCOOP_Y], 10);
  /* the armhole: from the strap's outer corner down to just under her armpit, bowed out toward the arm */
  const underY = d.armpitY + ARMHOLE_DROP;
  const under: Pt = [d.sideAt(underY, TANK_EASE), underY];
  const armhole = cubic(outer, [outer[0] - 4, outer[1] + 0.5 * (underY - outer[1])], [under[0] - 2, under[1] - 10], under, 8);
  const side = d.side({ from: underY, to: TANK_HEM_Y, ease: TANK_EASE });
  const foot = side[side.length - 1];
  const hem = span(foot, [300, TANK_HEM_Y + 1], 4);
  /* the left half, from the centre of the scoop round to the centre of the hem */
  const half: Pt[] = [...reverse(scoop), ...strap.slice(1), ...armhole.slice(1), ...side.slice(1), ...hem.slice(1)];
  const shape = outline(half, reverse(mirrorPts(half)).slice(1));
  return { kind: "tank", shapes: [shape], edges: [shape], lines: [] };
}

/* ---------------------------------------------------------------- the shorts */

/**
 * The shorts' numbers: worn at the waist, a narrow elastic band, and close to
 * the body down to mid-thigh — a unit off it at the waist and hips, as every
 * waistband is, and a little more down the leg. Never under a bottom, so they
 * need not sit inside one; and half a unit was not enough at his right hip,
 * which the photograph has a little wider than the left it is drafted from.
 */
const SHORTS = {
  female: { rise: 2, hemY: 590 },
  male: { rise: 4, hemY: 603 },
};
const SHORTS_BAND = 12;
const SHORTS_EASE = 1;

function shorts(body: BodyType): BasePiece {
  const { rise, hemY } = SHORTS[body];
  const T = trousers(body, {
    rise,
    band: SHORTS_BAND,
    hemY,
    waistEase: SHORTS_EASE,
    ease: SHORTS_EASE,
    legEase: 1.5,
    cuffEase: 2,
    innerEase: 1.5,
  });
  /* the waistband's lower edge, a soft line across the front */
  const d = draft(body);
  const x = d.sideAt(T.bandY, SHORTS_EASE) + 2;
  const band = line(span([x, T.bandY], [600 - x, T.bandY], 6));
  return { kind: "shorts", shapes: [T.left, T.right], edges: [...T.edges], lines: [band] };
}

/** The base layer's pieces a body shows under an outfit of these categories, innermost first. */
export function baseLayer(body: BodyType, categories: readonly GarmentCategory[]): BasePiece[] {
  const shows = baseLayerShows(body, categories);
  return [...(shows.shorts ? [shorts(body)] : []), ...(shows.tank ? [tank()] : [])];
}

/** Every piece a body has, shown or not — for the checker. */
export const BASE_PIECES: Record<BodyType, { tank?: BasePiece; shorts: BasePiece }> = {
  female: { tank: tank(), shorts: shorts("female") },
  male: { shorts: shorts("male") },
};
