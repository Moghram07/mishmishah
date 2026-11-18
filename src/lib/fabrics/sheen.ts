import type { Fabric, FabricMaterial, SheenLevel } from "@/types";

/**
 * Sheen: the light a smooth cloth throws back off its folds.
 *
 * A satin's long floats lie side by side down the warp and reflect like rows
 * of tiny cylinders: where a fold's crest turns to the light it shines, a
 * narrow bright streak drawn out along the weave, and right beside it, where
 * the fold turns away, it falls into a deeper shadow than a matte cloth's —
 * the light it does not scatter is the light it threw back at the crest. It
 * shines too where the body turns it toward the light: the bust, the
 * shoulders, the tops of the sleeves. A matte cloth scatters the same light
 * every way and shows none of it.
 *
 * Never in the cloth's tile. A highlight printed into the repeat would repeat
 * with it, a stripe every few centimetres down the dress. The sheen is light
 * and shadow, drawn by the stage over the cloth from the folds and the form —
 * see `garments/sheen.tsx` — from the upper left, as all the shading is; and
 * held under `SHEEN_CEILING` both ways, so a print under it always keeps at
 * least half its contrast.
 */
export interface SheenLook {
  /** A fold crest's highlight, as fill opacity, on a fold of light 0.3: a fold that catches more light shines more. */
  crest: number;
  /** The brightest a crest's highlight is ever drawn. */
  crestMax: number;
  /**
   * The highlight where the form turns toward the light — a piece's own
   * outline, and the body's curves under it — at its brightest: the opacity
   * of the whole layer, whatever overlaps inside it.
   */
  form: number;
  /** The deeper shadow beside a crest, on the side turned away, as fill opacity of `SHADE_COLOR`, on a fold of shadow 0.5. */
  shade: number;
  /** The deepest that shadow is ever drawn. */
  shadeMax: number;
  /** How far a highlight is drawn out along the grain: blur added along it, in canvas units (a unit is 1.9 mm). */
  along: number;
}

/** A satin's sheen, clear: the measure the others are a share of. */
const SATIN: SheenLook = { crest: 0.26, crestMax: 0.3, form: 0.28, shade: 0.42, shadeMax: 0.5, along: 6 };

/** A share of the satin's sheen — every part of it alike, drawn out as far. */
const share = (k: number): SheenLook => ({
  crest: +(SATIN.crest * k).toFixed(3),
  crestMax: +(SATIN.crestMax * k).toFixed(3),
  form: +(SATIN.form * k).toFixed(3),
  shade: +(SATIN.shade * k).toFixed(3),
  shadeMax: +(SATIN.shadeMax * k).toFixed(3),
  along: SATIN.along,
});

/**
 * The three sheens: a satin's, clear; a silk's, softer, between the two
 * (the user's, 2026-11-18); a crepe satin's — the abaya's black — about a
 * third of the satin's, there to see beside a matte nida and still soft.
 */
export const SHEEN: Record<SheenLevel, SheenLook> = {
  bright: SATIN,
  medium: share(0.6),
  soft: share(1 / 3),
};

/**
 * The shadow's colour: a cool grey, a little blue — multiplied, it takes a
 * warm cloth toward a grey-beige rather than a deeper brown, as a satin's
 * shadows read beside its warm highlights.
 */
export const SHADE_COLOR = "#8a8e96";

/**
 * The most a sheen ever does, either way: the light a crest and the form add,
 * screened over each other at their brightest — screening leaves `1 − c` of
 * the cloth's own contrast under it — and the shadow beside a crest at its
 * deepest, which multiplies the contrast by what it leaves. Either way a print
 * keeps at least `1 − SHEEN_CEILING`.
 */
export const SHEEN_CEILING = 0.5;

/** The most a look adds anywhere, crest and form together. */
export const sheenPeak = (look: SheenLook) => 1 - (1 - look.crestMax) * (1 - look.form);

/** The most a look's shadow takes, on the channel `SHADE_COLOR` darkens most. */
export const shadeDepth = (look: SheenLook) => {
  const v = parseInt(SHADE_COLOR.slice(1), 16);
  const darkest = Math.min((v >> 16) & 255, (v >> 8) & 255, v & 255) / 255;
  return look.shadeMax * (1 - darkest);
};

/** The matte cloths: no sheen, whatever else changes. */
export const MATTE: readonly FabricMaterial[] = ["cotton", "linen", "crepe", "wool", "jersey", "denim", "nida"];

/** The sheen a fabric has, if it has one. */
export const sheenOf = (fabric: Fabric): SheenLook | undefined => (fabric.sheen ? SHEEN[fabric.sheen] : undefined);

/**
 * The highlight's colour: the light's, which is white, with a fifth of the
 * cloth's own lightest colour in it — a satin's shine is tinted by the dye
 * the light passes through on its way back out; on an ivory, a warm near-white.
 */
export function sheenTint(fabric: Fabric): string {
  const own = fabric.source === "procedural" ? fabric.palette.highlight ?? fabric.palette.base : fabric.color;
  const h = own.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  const v = parseInt(full, 16);
  const channel = (shift: number) => Math.round(255 * 0.8 + ((v >> shift) & 255) * 0.2).toString(16).padStart(2, "0");
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}
