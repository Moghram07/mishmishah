import type { SkinTone, SkinToneId } from "@/types";
import { labToHex } from "@/lib/color/cielab";
import { measuredTones } from "./skinMeasurements";

/**
 * Ten skin tones, lightest to deepest, built from measured human skin.
 *
 * Each is a real skin colour in CIELAB, derived in `skinMeasurements.ts` from
 * spectrophotometer data (Lu, Xiao, Li & Pointer 2026, Skin Research and
 * Technology, doi:10.1111/srt.70343): evenly spaced in lightness across the
 * measured range, with the redness and yellowness skin actually has at that
 * lightness. Together they cover all six Individual Typology Angle classes —
 * very light, light, intermediate, tan, brown and dark (Chardon et al. 1991;
 * Del Bino et al. 2006) — and no two neighbours are closer than 4 in CIEDE2000.
 * `skinTones.test.ts` holds them to all of that.
 *
 * They replace the ten Monk Skin Tone swatches, which are category labels for
 * sorting photographs, not colours a body is: three of them were near paper
 * white and two near black.
 *
 * Each is a tint over the mannequin photograph, never a separate image — see
 * `mannequin/skinTint.ts`. Choosing one is a view setting: no account, no
 * measurements, no body-shape options.
 */
const IDS: SkinToneId[] = [
  "tone-01",
  "tone-02",
  "tone-03",
  "tone-04",
  "tone-05",
  "tone-06",
  "tone-07",
  "tone-08",
  "tone-09",
  "tone-10",
];

export const skinTones: SkinTone[] = measuredTones(IDS.length).map((lab, i) => ({
  id: IDS[i],
  label: { en: `Tone ${i + 1}`, ar: `درجة ${i + 1}` },
  lab,
  color: labToHex(lab),
}));

/**
 * The tone the mannequin first appears in: the one nearest, in lightness, to
 * how the default looked before the measured tones replaced it.
 */
export const DEFAULT_SKIN_TONE: SkinToneId = "tone-03";

/** A tone by id. An id from an earlier palette falls back to the default. */
export const skinToneById = (id: string): SkinTone =>
  skinTones.find((s) => s.id === id) ??
  skinTones.find((s) => s.id === DEFAULT_SKIN_TONE)!;
