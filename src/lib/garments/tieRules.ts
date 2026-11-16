/*
  Plain `.ts`, relative and extensioned — so `scripts/preview-garments.mjs`
  can import it and hold the wardrobe to the same rule the app offers by.

  Where a tie can be knotted, from what a garment is: the ties it offers, the
  cut of its neck, the collar sewn over it, and its belt.
*/
import { NECKLINE_TIED } from "./necklines.ts";
import type { TieAtId, TieId } from "@/types";

/** Every place a tie is knotted, in the order one arrives at: the neck first. */
export const TIE_PLACES: readonly TieAtId[] = ["neck", "belt-front", "belt-side"];

/**
 * The ties knotted at a neckline with no collar over it: a knot, a scarf. A
 * necktie or a bow tie needs a shirt collar to sit under — see `Collar.ties`.
 */
export const OPEN_NECK_TIES: readonly TieId[] = ["knot", "scarf"];

/**
 * The ties knotted on a fabric belt: the knot — the belt bow, there — and the
 * scarf. Not a necktie or a bow tie, which hang from a neck; and not on a
 * leather belt, which is buckled, or a sash, which is tied in its own bow.
 */
export const BELT_TIE_STYLES: readonly TieId[] = ["knot", "scarf"];

/**
 * The places a garment can be tied at, as it is cut — for one style, or for
 * any it offers:
 *
 * - **At the neck**, where its neck has a centre front to knot one at —
 *   `NECKLINE_TIED`, or a garment with no choice of cut — and then by its
 *   collar: the ties a collar takes, and nothing else — a shirt collar its
 *   necktie and bow tie, a sailor's its knot, necktie and scarf, a Peter
 *   Pan's its knot and scarf, any other none; with no collar, a knot or a
 *   scarf on a cut that has a neckline: `OPEN_NECK_TIES`.
 * - **On the belt**, at its front or its side, with a fabric belt on: a knot
 *   or a scarf, `BELT_TIE_STYLES`.
 */
export function tiePlaces(
  offered: readonly TieId[],
  cut: string | undefined,
  collar: { ties?: { offered: readonly TieId[] } } | undefined,
  fabricBelt: boolean,
  style?: TieId
): TieAtId[] {
  const styles = (style ? [style] : offered).filter((s) => s !== "none" && offered.includes(s));
  const centred = cut === undefined || (NECKLINE_TIED as readonly string[]).includes(cut);
  const atNeck = (s: TieId) => centred && (collar ? Boolean(collar.ties?.offered.includes(s)) : cut !== undefined && OPEN_NECK_TIES.includes(s));
  const neck = styles.some(atNeck);
  const belt = fabricBelt && styles.some((s) => BELT_TIE_STYLES.includes(s));
  return TIE_PLACES.filter((p) => (p === "neck" ? neck : belt));
}
