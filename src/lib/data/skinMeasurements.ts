import { chroma, type Lab } from "@/lib/color/cielab";

/**
 * Real skin, as measured — the data the ten skin tones are built from.
 *
 * Source: Lu Y, Xiao K, Li C, Pointer M. "Skin Colour Does Not Define
 * Ethnicity: Quantifying Variation and Overlap Across Diverse Populations."
 * Skin Research and Technology, 2026. doi:10.1111/srt.70343. Table 2: the mean
 * (and standard deviation) of CIELAB L*, a*, b* and chroma C* for eight
 * groups — over 14 000 spectrophotometer measurements of 2 106 people, taken
 * across twelve body sites for the International Skin Spectra Archive (ISSA),
 * collected under CIE guidelines. The groups span the lightest and darkest
 * skins in the archive, which is why they are used together.
 *
 * The values below are Table 2, unmodified. Everything else here is derived
 * from them, and the tests hold every tone inside what they describe.
 */

export interface MeasuredGroup {
  /** Table 2's label for the group. */
  group: string;
  subjects: number;
  /** [mean, standard deviation] */
  L: readonly [number, number];
  a: readonly [number, number];
  b: readonly [number, number];
  C: readonly [number, number];
}

export const MEASURED_SKIN: readonly MeasuredGroup[] = [
  { group: "Caucasian", subjects: 352, L: [61.2, 5.4], a: [11.0, 3.9], b: [14.7, 2.7], C: [18.7, 3.2] },
  { group: "Chinese", subjects: 370, L: [59.8, 4.3], a: [10.1, 2.9], b: [16.7, 2.4], C: [19.7, 2.6] },
  { group: "Japanese", subjects: 118, L: [63.5, 4.2], a: [9.8, 2.7], b: [17.0, 2.6], C: [19.8, 2.5] },
  { group: "South Asian", subjects: 157, L: [52.7, 6.4], a: [10.4, 2.5], b: [17.9, 2.3], C: [20.8, 2.4] },
  { group: "African", subjects: 145, L: [39.6, 6.7], a: [10.2, 2.0], b: [14.4, 4.3], C: [17.7, 4.4] },
  { group: "Middle Eastern (Iraqi)", subjects: 149, L: [57.3, 5.5], a: [10.2, 3.2], b: [15.8, 2.4], C: [19.0, 2.7] },
  { group: "Southeast Asian (Thai)", subjects: 708, L: [56.4, 5.6], a: [10.0, 2.4], b: [19.0, 2.6], C: [21.6, 2.7] },
  { group: "Middle Eastern (Arabian)", subjects: 107, L: [60.2, 6.5], a: [10.9, 3.0], b: [17.9, 2.5], C: [21.1, 2.7] },
];

const DEG = 180 / Math.PI;
const byName = (name: string) => MEASURED_SKIN.find((g) => g.group === name)!;

/** Subject-weighted mean of one attribute over some groups. */
function pooled(groups: readonly MeasuredGroup[], pick: (g: MeasuredGroup) => number): number {
  const n = groups.reduce((s, g) => s + g.subjects, 0);
  return groups.reduce((s, g) => s + pick(g) * g.subjects, 0) / n;
}

/**
 * The range of real skin the data covers — what a tone may not leave.
 *
 * - L*, a*, b*, C*: from the lowest group mean minus two standard deviations
 *   to the highest plus two, across all eight groups. Two standard deviations
 *   hold about 95% of each group.
 * - Hue: a* and b* are reported separately, so the hue range is taken from each
 *   group's mean ± one standard deviation box — the reddest corner (least
 *   yellow, most red) to the yellowest. It is the narrower, safer reading.
 */
export const MEASURED_RANGE = (() => {
  const lo = (k: "L" | "a" | "b" | "C") => Math.min(...MEASURED_SKIN.map((g) => g[k][0] - 2 * g[k][1]));
  const hi = (k: "L" | "a" | "b" | "C") => Math.max(...MEASURED_SKIN.map((g) => g[k][0] + 2 * g[k][1]));
  const hues = MEASURED_SKIN.flatMap(({ a, b }) => [
    Math.atan2(b[0] - b[1], a[0] + a[1]) * DEG,
    Math.atan2(b[0] + b[1], a[0] - a[1]) * DEG,
  ]);
  return {
    L: [lo("L"), hi("L")] as const,
    a: [lo("a"), hi("a")] as const,
    b: [lo("b"), hi("b")] as const,
    C: [lo("C"), hi("C")] as const,
    hue: [Math.min(...hues), Math.max(...hues)] as const,
  };
})();

/**
 * How yellow skin is at each lightness, from the data: three pooled points,
 * darkest to lightest — the African group; the South Asian, Thai and Iraqi
 * groups; and the Caucasian, Chinese, Japanese and Arabian groups — joined by
 * straight lines and continued along the nearest line past either end.
 *
 * Yellowness rises from the darkest skins to the middle of the range and falls
 * again toward the lightest, as melanin's yellow-brown gives way to the pinker
 * cast of very light skin. A curve fitted through all eight means fits that
 * shape too, but bends away to nothing past the data at either end; straight
 * lines do not.
 */
const B_POINTS: readonly (readonly [L: number, b: number])[] = [
  [byName("African")],
  ["South Asian", "Southeast Asian (Thai)", "Middle Eastern (Iraqi)"].map(byName),
  ["Caucasian", "Chinese", "Japanese", "Middle Eastern (Arabian)"].map(byName),
].map((gs) => [pooled(gs, (g) => g.L[0]), pooled(gs, (g) => g.b[0])] as const);

function yellownessAt(L: number): number {
  const [p0, p1, p2] = B_POINTS;
  const [[x0, y0], [x1, y1]] = L <= p1[0] ? [p0, p1] : [p1, p2];
  return y0 + ((L - x0) * (y1 - y0)) / (x1 - x0);
}

/** Redness hardly varies between groups (means 9.8–11.0), so it is held at the pooled mean. */
const REDNESS = pooled(MEASURED_SKIN, (g) => g.a[0]);

/**
 * How much more colourful than the average a tone is drawn: one pooled
 * standard deviation of chroma. A mean measured colour laid flat over the
 * mannequin's median reads dusty on a screen — the tones were drawn at the
 * mean first and looked grey-brown in the middle of the scale — and one
 * standard deviation keeps every tone well inside the measured range while
 * reading as skin. Hue is unchanged by it.
 */
const CHROMA_LIFT = pooled(MEASURED_SKIN, (g) => g.C[1]);

/**
 * The lightest and deepest tones' L*: just inside the measured range at either
 * end, so the ten tones cover it — from light skin with a peach cast to deep
 * brown, never paper-white or black.
 */
export const LIGHTEST_L = 72.9;
export const DEEPEST_L = 26.5;

/**
 * The ten tones, lightest first: evenly spaced in L*, with the measured
 * yellowness and redness at that lightness, lifted by `CHROMA_LIFT`.
 */
export function measuredTones(count = 10): Lab[] {
  return Array.from({ length: count }, (_, i) => {
    const L = LIGHTEST_L - (i * (LIGHTEST_L - DEEPEST_L)) / (count - 1);
    const a = REDNESS;
    const b = yellownessAt(L);
    const lift = (chroma([L, a, b]) + CHROMA_LIFT) / chroma([L, a, b]);
    return [L, a * lift, b * lift] as const;
  });
}
