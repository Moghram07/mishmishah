/*
  Plain `.ts`, relative and extensioned, and no JSX — so `scripts/
  preview-garments.mjs` imports it and holds the dress's buttons and belt to
  the numbers the app draws them by. See `art/female/dressCut.ts` for why
  that matters.
*/
import type { NecklineId } from "./necklines.ts";
import type { BeltId, ButtonsId, SkirtShapeId } from "@/types";

/**
 * A dress's buttons: down the centre front on a narrow placket, from the
 * neck to the waist seam or on through the skirt to the hem — see
 * `frontButtons` in `art/female/dressCut.ts`.
 *
 * Only a cut with a straight centre front can be buttoned down it: round,
 * scoop, boat, V, square, high, sweetheart — from below its dip — off-shoulder
 * and the shirt-dress's collared. Not a wrap, whose front is two panels
 * crossing; not a cowl, whose front hangs in folds; not the one-shoulder,
 * whose top edge runs across the centre; not a halter; and not a keyhole,
 * which closes with its own button and loop — a placket under it would be a
 * second closure.
 */
export const BUTTONED_CUTS: readonly NecklineId[] = ["round", "scoop", "boat", "v", "square", "high", "sweetheart", "collared", "off-shoulder"];

/**
 * The skirts that cannot be buttoned on to the hem, only to the waist: a
 * mermaid's flare is cut in panels and could not open down the front.
 */
export const BUTTONED_TO_WAIST_ONLY: readonly SkirtShapeId[] = ["mermaid"];

/**
 * A pleated skirt buttoned to the hem has a flat panel down its centre front,
 * where the placket lies, and its pleats start either side of it: about
 * 3.8 cm across, so no pleat's fold reaches under the placket's 3 cm.
 */
export const PANEL_HALF = 10;

/**
 * A cut buttoned by its own placket — the shirt-dress — arrives buttoned to
 * the waist, as it always has, and can be buttoned on to the hem; it is never
 * without its buttons.
 */
export const OWN_PLACKET: readonly NecklineId[] = ["collared"];

/**
 * The buttons a cut can be worn with, of those a dress offers, in the order
 * offered — over a skirt of this shape, if one is given: to the waist only
 * over a mermaid.
 */
export const buttonsOn = (cut: string, offered: readonly ButtonsId[], shape?: SkirtShapeId): ButtonsId[] =>
  !(BUTTONED_CUTS as readonly string[]).includes(cut)
    ? []
    : offered.filter(
        (b) =>
          !(b === "none" && (OWN_PLACKET as readonly string[]).includes(cut)) &&
          !(b === "hem" && shape !== undefined && BUTTONED_TO_WAIST_ONLY.includes(shape))
      );

/**
 * The cuts a belt does not go on: a wrap ties at the waist with its own tie,
 * so a belt over it would be a second one.
 */
export const BELTLESS_CUTS: readonly NecklineId[] = ["wrap"];

/** The belts a cut can be worn with, of those a dress offers. */
export const beltsOn = (cut: string, offered: readonly BeltId[]): BeltId[] =>
  (BELTLESS_CUTS as readonly string[]).includes(cut) ? [] : [...offered];

/**
 * The placket and its buttons, in canvas units (a unit is 0.19 cm): the
 * shirt-dress's own, so every buttoned cut reads as the same placket — about
 * 3 cm across, its buttons about 1.1 cm.
 */
export const PLACKET_HALF = 8;
export const BUTTON_R = 2.8;
/** How far in from each side of the placket it is topstitched. */
export const PLACKET_STITCH = 4;

/**
 * How far apart the buttons are: about 7.5 cm. Each cut takes the spacing
 * nearest 7.5 cm that runs its buttons evenly from just below its opening to
 * just above its waist seam — see `buttonRun` — which is 7 to 8 cm on all but
 * the shortest bodices: an off-shoulder's at an empire waist has 6.6 cm of
 * room below its band for two, and takes it.
 */
export const BUTTON_PITCH: readonly [lo: number, want: number, hi: number] = [7 / 0.19, 7.5 / 0.19, 8 / 0.19];
/** The first button's centre, at least this far below the opening, and at most `BUTTON_SLIDE` further. */
export const BUTTON_FIRST = 7;
export const BUTTON_SLIDE = 16;
/** The last button above the waist seam, as on the shirt-dress. */
export const BUTTON_LAST = 12;
/** On through the skirt, the last button at least this share of the spacing above the hem. */
export const BUTTON_HEM_CLEAR = 0.6;

/**
 * The belt: about 3.4 cm wide, lying over the waist seam — the skirt is sewn
 * on over the bodice's hem, so the seam shows 5 to 8 units above the row it is
 * sewn at, and the belt is centred 6 above — and standing a little proud of
 * the dress at its sides, as anything worn over it does.
 */
export const BELT_WIDTH = 18;
export const BELT_ABOVE_SEAM = 6;
export const BELT_OUT = 1.2;

/** The buckle, at the centre front: about 4.2 × 4.6 cm, its frame 0.5 cm, its corners round. */
export const BUCKLE = { w: 22, h: 24, frame: 2.6, round: 4 } as const;

/** The leather belts' colours; a self-fabric belt takes the dress's own cloth. */
export const LEATHER: Record<Exclude<BeltId, "none" | "self">, string> = {
  brown: "#6b4226",
  black: "#1f1c1b",
};
