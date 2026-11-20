import type { BodyType, SkinToneId } from "@/types";
import { DEFAULT_SKIN_TONE } from "@/lib/data/skinTones";
import manifest from "./tinted.json";

/**
 * The mannequin photograph in a skin tone, tinted once and kept — made by
 * `scripts/mannequin/tinted.mjs` with the very curve of `skinTint.ts`, which
 * the stage used to apply as an SVG filter on every redraw. Solid inside
 * the body's edge: the stage clips it to `OUTLINE`, a clean edge at any zoom.
 *
 * Each URL carries the file's own hash, so a phone keeps it for good (see
 * `next.config.mjs`) and fetches it again only when it is remade.
 */
export const TINTED = manifest as Record<string, string>;

export function tintedPhoto(body: BodyType, tone: SkinToneId): string {
  const key = TINTED[`${body}-${tone}`] ? `${body}-${tone}` : `${body}-${DEFAULT_SKIN_TONE}`;
  return `/mannequin/tinted/${key}.webp?v=${TINTED[key]}`;
}
