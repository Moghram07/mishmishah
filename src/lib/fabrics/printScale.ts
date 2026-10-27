/*
  Plain `.ts`, no imports — shared by the drawing (`patterns.ts`,
  `FabricRegion`) and the visualizer's hint, so both read a print's size on
  screen the same way.
*/

/**
 * A print on screen, at its true size, always.
 *
 * Every repeat is drawn exactly `repeatCm` wide on the piece, at every zoom
 * and on every screen. What changes with its size on screen is only how sharp
 * it is drawn. A repeat a few pixels across holds detail finer than a pixel,
 * and drawn sharp the screen's pixel grid beats against it — moiré. So below
 * `SHARP_PX` the print is drawn softened, as the eye sees fine cloth from a
 * step back: its finest detail goes first, and by `EVEN_PX` it has become an
 * even texture of its own colour. Its size never changes, only its focus.
 *
 * It replaces a stand-in that, below 6 px, drew the motif at a fixed 8 px —
 * a 2 cm stripe on a curtain three times its size.
 */

/** At this many screen pixels a repeat, and above, the print is drawn sharp. */
export const SHARP_PX = 8;

/** At this many and below, it has softened into an even texture of its own colour. */
export const EVEN_PX = 2.5;

/** How many steps the softening is held to, so nearby zooms share a drawing. */
export const KEEP_STEPS = 16;

/**
 * How much of a print's contrast is kept at this size on screen: 1 sharp, 0
 * an even texture. A smoothstep between `EVEN_PX` and `SHARP_PX`, held to
 * `KEEP_STEPS` steps.
 */
export function printKeep(repeatPx: number): number {
  const t = Math.min(1, Math.max(0, (repeatPx - EVEN_PX) / (SHARP_PX - EVEN_PX)));
  return Math.round(t * t * (3 - 2 * t) * KEEP_STEPS) / KEEP_STEPS;
}

/** The widest softening, as a share of the repeat: by then any repeat is even. */
export const MAX_SOFTEN = 0.7;

/**
 * The blur, as a share of one repeat, that keeps `keep` of a print's base
 * frequency — a Gaussian takes a wave of period P down by exp(−2π²σ²/P²).
 * Finer detail in the motif is taken down further, which is the point.
 */
export function printSoften(keep: number): number {
  if (keep >= 1) return 0;
  if (keep <= 0) return MAX_SOFTEN;
  return Math.min(MAX_SOFTEN, Math.sqrt(-Math.log(keep) / (2 * Math.PI * Math.PI)));
}

/** Whether a repeat this size on screen is too small to read — when the visualizer says to zoom in. */
export const needsZoom = (repeatPx: number) => repeatPx < SHARP_PX;
