import manifest from "./optionPictures.json";

/**
 * The pictures on the phone panel's cards: a small still of each option,
 * made from the real drawing (`pictureRecipes.ts`, photographed by
 * `scripts/option-pictures.mjs`), served from `public/options` — so a card
 * costs a few kilobytes and no drawing on the phone.
 *
 * Each URL carries the picture's own hash, so a phone keeps it for good
 * (see `next.config.mjs`) and fetches it again only when it is redrawn.
 * `optionPictures.test.tsx` fails when an option has no picture, or when
 * the drawing a picture was made from has changed since.
 */

/** An option of a garment's — or a ready-made look, kept under its body's name: `female/look-evening`. */
export type PictureKind = "garment" | "neckline" | "sleeve" | "collar" | "tie" | "belt" | "cuff" | "look";

/** A picture's size in pixels: the card's 96 × 80 well, at 2.5×. */
export const PICTURE_PX = [240, 200] as const;

export interface PictureEntry {
  /** The image's hash: its URL's version. */
  v: string;
  /** The hash of the drawing it was made from. */
  drawn: string;
}

export const PICTURES = manifest as Record<string, PictureEntry>;

/** An option's picture, by garment: `female-dress/neckline-female-boat-neckline`; a garment's own, `female-dress/garment`. */
export const pictureKey = (garmentId: string, kind: PictureKind, optionId?: string) =>
  kind === "garment" ? `${garmentId}/garment` : `${garmentId}/${kind}-${optionId}`;

/** Its URL, or undefined while it has none — the card then shows its name alone. */
export function pictureSrc(garmentId: string, kind: PictureKind, optionId?: string): string | undefined {
  const key = pictureKey(garmentId, kind, optionId);
  const entry = PICTURES[key];
  return entry ? `/options/${key}.webp?v=${entry.v}` : undefined;
}
