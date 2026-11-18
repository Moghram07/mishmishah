import type { Fabric, FabricMaterial, SheenLevel } from "@/types";

/**
 * Sheen: the light a smooth cloth throws back off its folds.
 *
 * A satin's long floats lie side by side down the warp and reflect like rows
 * of tiny cylinders: where a fold's crest turns to the light it shines, a
 * narrow bright streak drawn out along the weave, and a piece shines where the
 * body turns it toward the light. A matte cloth scatters the same light every
 * way and shows none of it.
 *
 * Never in the cloth's tile. A highlight printed into the repeat would repeat
 * with it, a stripe every few centimetres down the dress. The sheen is light,
 * drawn by the stage over the cloth from the folds and the form — see
 * `garments/sheen.tsx` — from the upper left, as all the shading is; screened,
 * so it can only brighten; and held under `SHEEN_CEILING`, so a print under
 * it always keeps at least half its contrast.
 */
export interface SheenLook {
  /** A fold crest's highlight, as fill opacity, on a fold of light 0.3: a fold that catches more light shines more. */
  crest: number;
  /** The brightest a crest's highlight is ever drawn. */
  crestMax: number;
  /** The highlight where the body turns a piece toward the light, at its brightest. */
  form: number;
  /** How far a highlight is drawn out along the grain: blur added along it, in canvas units (a unit is 1.9 mm). */
  along: number;
}

/** The two sheens: a satin's, clear; an abaya black's, soft. */
export const SHEEN: Record<SheenLevel, SheenLook> = {
  bright: { crest: 0.3, crestMax: 0.36, form: 0.21, along: 6 },
  soft: { crest: 0.11, crestMax: 0.14, form: 0.08, along: 4 },
};

/**
 * The most light a sheen ever adds: a crest's highlight and the form's,
 * screened over each other at their brightest. Screening lays `1 − c` of the
 * cloth's own contrast under it, so a print keeps at least `1 − SHEEN_CEILING`.
 */
export const SHEEN_CEILING = 0.5;

/** The most a look adds anywhere, crest and form together. */
export const sheenPeak = (look: SheenLook) => 1 - (1 - look.crestMax) * (1 - look.form);

/** The matte cloths: no sheen, whatever else changes. */
export const MATTE: readonly FabricMaterial[] = ["cotton", "linen", "crepe", "wool", "jersey", "denim", "nida"];

/** The sheen a fabric has, if it has one. */
export const sheenOf = (fabric: Fabric): SheenLook | undefined => (fabric.sheen ? SHEEN[fabric.sheen] : undefined);

/**
 * The highlight's colour: the light's, which is white, with a fifth of the
 * cloth's own lightest colour in it — a satin's shine is tinted by the dye
 * the light passes through on its way back out.
 */
export function sheenTint(fabric: Fabric): string {
  const own = fabric.source === "procedural" ? fabric.palette.highlight ?? fabric.palette.base : fabric.color;
  const h = own.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  const v = parseInt(full, 16);
  const channel = (shift: number) => Math.round(255 * 0.8 + ((v >> shift) & 255) * 0.2).toString(16).padStart(2, "0");
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}
