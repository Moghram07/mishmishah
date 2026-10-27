import { hexToRgb } from "@/lib/color/cielab";

/**
 * A skin tone, as a tint over the photograph.
 *
 * The mannequin photographs are neutral grey, and a tone is laid over that
 * grey by one SVG filter — never a second image — so the body's light, shadow
 * and soft edges are the photograph's own in every tone. The filter is one
 * lookup table per channel (`feFuncR type="table"`), which lets the curve be
 * whatever skin needs:
 *
 *     lit (grey ≥ median):   out = swatch × scale × (grey / median)
 *     shadow (grey < median): out = swatch × scale × (grey / median) ^ e
 *                             e = 1 − w for red, 1 for green and blue
 *
 * - **The median renders as the swatch.** Dividing by the photograph's own
 *   median grey, measured into `profile.ts`, puts the measured skin colour on
 *   the body. A plain multiply by the grey left every tone a tenth darker.
 * - **Shadows go warmer, not greyer.** Light that reaches a shadow on skin has
 *   travelled through it and comes back redder; a plain darkening slides a
 *   tone toward grey-brown instead. Below the median red falls a little slower
 *   than green and blue. Only red: blue falling faster as well looked like the
 *   same idea and is not — less blue is more *yellow* in CIELAB, and it turned
 *   the lightest tone's shadows yellower rather than redder.
 * - **Lit skin keeps its hue.** Above the median every channel scales alike.
 *   A single gamma curve per channel could not do both halves: warming the
 *   shadows that way cooled the highlights by the same amount, and with half
 *   the body above the median, the tones read grey.
 * - **`scale` keeps the highlight short of white**, so the form survives on the
 *   lightest tone.
 */

/** How the photograph is lit — measured into `profile.ts` as `light`. */
export interface PhotoLight {
  /** The median grey of the opaque body, 0–1. */
  median: number;
  /** The grey only the brightest 1% of the body exceeds, 0–1. */
  highlight: number;
}

/** One channel's lookup table, evenly sampled from grey 0 to grey 1. */
export type ChannelTable = number[];

/** How much redder a shadow turns: the spread of the channels' exponents. */
export const WARM_SHADOW = 0.15;

/** Samples per table, both ends included. A smooth curve; 64 steps is plenty. */
const TABLE_SIZE = 65;

/**
 * Table values are rounded to five decimals — far finer than one level of an
 * 8-bit channel. Unrounded, the server and the browser can disagree in the
 * last digit of a power, and React reports the attribute as a hydration
 * mismatch.
 */
const round = (v: number) => Math.round(v * 1e5) / 1e5;

/** The three channel tables that turn the grey photograph into this tone. */
export function skinTint(
  hex: string,
  light: PhotoLight
): [ChannelTable, ChannelTable, ChannelTable] {
  const swatch = hexToRgb(hex);
  const scale = Math.min(1, 1 / (Math.max(...swatch) * (light.highlight / light.median)));
  const shade = [1 - WARM_SHADOW, 1, 1];
  const table = (c: number, channel: number): ChannelTable =>
    Array.from({ length: TABLE_SIZE }, (_, i) => {
      const grey = i / (TABLE_SIZE - 1);
      const ratio = grey / light.median;
      const exponent = grey < light.median ? shade[channel] : 1;
      return round(Math.min(1, scale * c * ratio ** exponent));
    });
  return [table(swatch[0], 0), table(swatch[1], 1), table(swatch[2], 2)];
}

/**
 * One channel of the photograph after the tint — exactly what the filter
 * computes: the table, linearly interpolated, as SVG specifies for
 * `type="table"`.
 */
export function tinted(table: ChannelTable, grey: number): number {
  const n = table.length - 1;
  const x = Math.min(1, Math.max(0, grey)) * n;
  const k = Math.min(n - 1, Math.floor(x));
  return table[k] + (table[k + 1] - table[k]) * (x - k);
}
