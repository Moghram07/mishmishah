import type { Fabric } from "@/types";
import { hasPrint } from "./filters";
import { fabricRepeatCm, fabricSurface } from "./patterns";
import { printKeep } from "./printScale";

/**
 * When the visualizer says «كبّر لرؤية النقشة» — zoom in to see the print.
 *
 * Only where zooming in would show something that does not show now: a
 * print too small to read where it is, or a surface's detail — a denim's
 * streaks, a knit's columns, a wool's flecks — that the closest view draws.
 * Never over a plain cloth with nothing more to show (a cotton, a crepe, a
 * satin: its sheen is light, there at any zoom); and never where even the
 * closest view would not bring it out, as on a phone a knit's columns, a
 * millimetre and a half apart, stay finer than its screen at 8×.
 */

/** How much of a drawing must show at the closest zoom for zooming to be worth suggesting — see `printKeep`. */
export const SHOWS_AT = 0.5;

/** The details a fabric has for a close-up to show, each by the period a screen must resolve: its print's repeat, its surface's detail. */
export function detailsOf(fabric: Fabric): number[] {
  const surface = fabricSurface(fabric);
  return [...(hasPrint(fabric) ? [fabricRepeatCm(fabric)] : []), ...(surface ? [surface.detailCm] : [])];
}

/**
 * Whether zooming in would show more of this fabric: some detail of it not
 * sharp at `pxPerCmNow` screen pixels a centimetre, at least `SHOWS_AT` shown
 * at `pxPerCmMost`, the closest view — and shown better there than here. At
 * the closest view already there is nothing closer to ask for.
 */
export function zoomWouldShow(fabric: Fabric, pxPerCmNow: number, pxPerCmMost: number): boolean {
  return detailsOf(fabric).some((cm) => {
    const [now, most] = [printKeep(cm * pxPerCmNow), printKeep(cm * pxPerCmMost)];
    return now < 1 && most >= SHOWS_AT && most > now;
  });
}
