/**
 * CIELAB, and the two measures of skin colour built on it.
 *
 * Skin colour is published in CIELAB because that is what a spectrophotometer
 * reports: L* lightness, a* red–green, b* yellow–blue. This file converts it to
 * the sRGB a screen shows, and back, and answers the two questions the skin
 * tones are chosen by:
 *
 * - **ITA**, the Individual Typology Angle (Chardon, Cretois & Hourseau 1991):
 *   how light or dark a skin is, from L* and b*.
 * - **CIEDE2000** (CIE 142-2001; implementation per Sharma, Wu & Dalal 2005):
 *   how different two colours look. About 1 is the smallest difference most
 *   people see side by side; the tones are kept at least 4 apart.
 *
 * sRGB here is IEC 61966-2-1 with a D65 white, the white skin colour is
 * measured under.
 */

export type Lab = readonly [L: number, a: number, b: number];
export type Rgb = readonly [r: number, g: number, b: number];

const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;
/** D65 reference white, 2° observer. */
const WHITE = [0.95047, 1, 1.08883] as const;
const EPS = 6 / 29;

const decode = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const encode = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** sRGB, each channel 0–1, as CIELAB. */
export function rgbToLab([r, g, b]: Rgb): Lab {
  const [R, G, B] = [r, g, b].map(decode);
  const X = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / WHITE[0];
  const Y = (0.2126729 * R + 0.7151522 * G + 0.072175 * B) / WHITE[1];
  const Z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / WHITE[2];
  const f = (t: number) => (t > EPS ** 3 ? Math.cbrt(t) : t / (3 * EPS * EPS) + 4 / 29);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}

/** CIELAB as sRGB, each channel 0–1 — clipped to the screen's gamut. */
export function labToRgb([L, a, b]: Lab): Rgb {
  const fy = (L + 16) / 116;
  const inv = (t: number) => (t > EPS ? t ** 3 : 3 * EPS * EPS * (t - 4 / 29));
  const X = WHITE[0] * inv(fy + a / 500);
  const Y = WHITE[1] * inv(fy);
  const Z = WHITE[2] * inv(fy - b / 200);
  return [
    clamp01(encode(3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z)),
    clamp01(encode(-0.969266 * X + 1.8760108 * Y + 0.041556 * Z)),
    clamp01(encode(0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z)),
  ];
}

/** `#rrggbb` → sRGB, 0–1. */
export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** sRGB, 0–1 → `#rrggbb`. */
export const rgbToHex = (rgb: Rgb): string =>
  "#" + rgb.map((c) => Math.round(clamp01(c) * 255).toString(16).padStart(2, "0")).join("");

export const labToHex = (lab: Lab): string => rgbToHex(labToRgb(lab));
export const hexToLab = (hex: string): Lab => rgbToLab(hexToRgb(hex));

/** Chroma C*: how far from grey. */
export const chroma = ([, a, b]: Lab): number => Math.hypot(a, b);

/** Hue angle h, degrees: 0 is red, 90 yellow. Skin sits between. */
export const hue = ([, a, b]: Lab): number => ((Math.atan2(b, a) * DEG) + 360) % 360;

/** WCAG relative luminance of an sRGB colour, 0–1. */
export function luminance([r, g, b]: Rgb): number {
  return 0.2126 * decode(r) + 0.7152 * decode(g) + 0.0722 * decode(b);
}

/**
 * The Individual Typology Angle, degrees: atan((L* − 50) / b*). Higher is
 * lighter skin; the classes are in `ITA_CLASSES`.
 */
export const ita = ([L, , b]: Lab): number => Math.atan((L - 50) / b) * DEG;

/**
 * The six skin colour classes by ITA: Chardon, Cretois & Hourseau 1991 for the
 * first five, Del Bino et al. 2006 for the split of brown from dark — as
 * restated in Del Bino, Duval & Bernerd 2018. Each class is (above, at most].
 */
export const ITA_CLASSES = [
  { name: "very light", above: 55, atMost: Infinity },
  { name: "light", above: 41, atMost: 55 },
  { name: "intermediate", above: 28, atMost: 41 },
  { name: "tan", above: 10, atMost: 28 },
  { name: "brown", above: -30, atMost: 10 },
  { name: "dark", above: -Infinity, atMost: -30 },
] as const;

export type ItaClass = (typeof ITA_CLASSES)[number]["name"];

export const itaClass = (lab: Lab): ItaClass => {
  const angle = ita(lab);
  return ITA_CLASSES.find((c) => angle > c.above && angle <= c.atMost)!.name;
};

/**
 * CIEDE2000 colour difference, kL = kC = kH = 1.
 *
 * Checked against Sharma, Wu & Dalal's published test pairs in
 * `cielab.test.ts` — the formula has several easy-to-miss branches in its hue
 * terms, and a wrong one is off by a little, which is the worst way to be off.
 */
export function ciede2000(lab1: Lab, lab2: Lab): number {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const h = (b: number, a: number) => (b === 0 && a === 0 ? 0 : ((Math.atan2(b, a) * DEG) + 360) % 360);
  const h1p = h(b1, a1p);
  const h2p = h(b2, a2p);

  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * RAD);

  const Lbp = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;
  let hbp: number;
  if (C1p * C2p === 0) hbp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hbp = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) hbp = (h1p + h2p + 360) / 2;
  else hbp = (h1p + h2p - 360) / 2;

  const T =
    1 -
    0.17 * Math.cos((hbp - 30) * RAD) +
    0.24 * Math.cos(2 * hbp * RAD) +
    0.32 * Math.cos((3 * hbp + 6) * RAD) -
    0.2 * Math.cos((4 * hbp - 63) * RAD);
  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const RC = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const SL = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const SC = 1 + 0.045 * Cbp;
  const SH = 1 + 0.015 * Cbp * T;
  const RT = -Math.sin(2 * dTheta * RAD) * RC;

  return Math.sqrt(
    (dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH)
  );
}
