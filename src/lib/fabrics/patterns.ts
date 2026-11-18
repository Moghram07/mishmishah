import type {
  Fabric,
  FabricMaterial,
  FabricMotif,
  FabricPalette,
  FabricSwatch,
} from "@/types";
import { printSoften } from "./printScale";

/**
 * Procedural fabric textures.
 *
 * **The motif owns the scale.** Each entry in `MOTIFS` carries a `repeatCm` —
 * the real-world size of one full repeat — and every fabric drawn from that
 * motif inherits it. A fabric record cannot override it (the type forbids it,
 * and `assertMotifScale` catches it at runtime in dev). Two plaids are always
 * the same size as each other; only a *photographed* fabric carries its own
 * measured `cmPerPixel`, because every photo is shot differently.
 *
 * Adding a motif means adding a record here; adding a *fabric* means adding a
 * record to `lib/data/fabrics.ts` and touching no code at all.
 */

/** Pixel size of a synthesized tile. One tile is exactly one full repeat. */
export const TILE_PX = 88;

/** `cmPerPixel` for a photographed fabric scanned at a known DPI. */
export const cmPerPixelForDpi = (dpi: number) => 2.54 / dpi;

function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

/** Parse `#rgb` / `#rrggbb` into components. */
function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h.slice(0, 6);
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Weighted average of colors — how a repeat reads once it is too small to see. */
function mix(parts: Array<[hex: string, weight: number]>): string {
  let r = 0;
  let g = 0;
  let b = 0;
  let total = 0;
  for (const [hex, w] of parts) {
    const [pr, pg, pb] = parseHex(hex);
    r += pr * w;
    g += pg * w;
    b += pb * w;
    total += w;
  }
  if (total === 0) return "#808080";
  const to = (v: number) =>
    Math.round(v / total)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Faint diagonal weave lines that sell the "textile" feel under every motif. */
function weave(T: number, color: string): string {
  const c = withAlpha(color, 0.06);
  return `<path d="M0 ${T} L${T} 0 M${-T / 2} ${T / 2} L${T / 2} ${
    -T / 2
  } M${T / 2} ${T * 1.5} L${T * 1.5} ${
    T / 2
  }" stroke="${c}" stroke-width="1"/>`;
}

export interface MotifSpec {
  /**
   * Size of one full repeat in the real world, in centimetres. This is the
   * single source of truth for how large this motif prints — nothing else in
   * the app may set it.
   */
  repeatCm: number;
  /** Draw the repeat into a `T`×`T` tile. Must tile seamlessly. */
  draw: (p: FabricPalette, T: number) => string;
  /**
   * How the repeat reads when it is too small to resolve on screen — the
   * weighted average of the colors the motif actually covers.
   */
  averageColor: (p: FabricPalette) => string;
  /**
   * Whether the way it is laid on the cloth shows: a stripe runs one way, a
   * check or a lattice turns to diamonds on the bias, a stemmed flower stands
   * up or lies down. Only these are offered a pattern direction in the
   * visualizer; a plain weave, scattered dots or a symmetric medallion look
   * the same whichever way they are cut, and the choice would change nothing.
   */
  directional: boolean;
}

const hi = (p: FabricPalette) => p.highlight ?? p.accent;

/* ------------------------------------------------- drawing the new motifs */

/** Two decimals — enough for an 88 px tile, short in a `data:` URI. */
const n = (v: number) => +v.toFixed(2);

/** A repeatable stream of numbers in [0, 1): the same tile every time it is drawn. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Something drawn at (x, y), reaching `reach` round it — and again a tile
 * over wherever it crosses an edge, so the tile joins seamlessly.
 */
function around(T: number, x: number, y: number, reach: number, draw: (x: number, y: number) => string): string {
  let out = "";
  for (const dx of [-T, 0, T]) {
    for (const dy of [-T, 0, T]) {
      const [cx, cy] = [x + dx, y + dy];
      if (cx + reach < 0 || cx - reach > T || cy + reach < 0 || cy - reach > T) continue;
      out += draw(cx, cy);
    }
  }
  return out;
}

/** A lens `len` long and `th` thick, centred on (x, y), turned `deg` — a slub in a yarn, a leaf. */
function lens(x: number, y: number, len: number, th: number, deg: number): string {
  const [c, s] = [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
  const at = (u: number, v: number) => `${n(x + u * c - v * s)} ${n(y + u * s + v * c)}`;
  return `M${at(-len / 2, 0)} Q${at(0, -th)} ${at(len / 2, 0)} Q${at(0, th)} ${at(-len / 2, 0)}Z`;
}

/** A large flower: five round petals, a pale heart, a stem with two leaves. */
function bloom(p: FabricPalette, x: number, y: number, r: number): string {
  let out = `<path d="M${n(x)} ${n(y + r * 0.9)} C${n(x + r * 0.3)} ${n(y + r * 1.6)} ${n(x - r * 0.25)} ${n(y + r * 2)} ${n(x + r * 0.1)} ${n(y + r * 2.6)}" fill="none" stroke="${hi(p)}" stroke-width="${n(r * 0.12)}" stroke-linecap="round"/>`;
  out += `<path d="${lens(x + r * 0.42, y + r * 1.75, r * 0.9, r * 0.28, -30)}" fill="${hi(p)}"/>`;
  out += `<path d="${lens(x - r * 0.4, y + r * 1.45, r * 0.75, r * 0.24, 35)}" fill="${hi(p)}" fill-opacity="0.85"/>`;
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
    out += `<circle cx="${n(x + Math.cos(a) * r * 0.55)}" cy="${n(y + Math.sin(a) * r * 0.55)}" r="${n(r * 0.5)}" fill="${p.accent}" fill-opacity="0.9"/>`;
  }
  out += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r * 0.3)}" fill="${mix([[p.accent, 45], ["#FFFFFF", 55]])}"/>`;
  out += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r * 0.13)}" fill="${p.accent}"/>`;
  return out;
}

/** A closed bud on a short stem. */
function bud(p: FabricPalette, x: number, y: number, r: number): string {
  return (
    `<path d="M${n(x)} ${n(y + r)} L${n(x + r * 0.2)} ${n(y + r * 2.4)}" stroke="${hi(p)}" stroke-width="${n(r * 0.22)}" stroke-linecap="round"/>` +
    `<path d="${lens(x, y, r * 2.2, r * 0.8, 90)}" fill="${p.accent}" fill-opacity="0.9"/>`
  );
}

/** A boteh: a teardrop with its tip curled over, an outline inside it, a row of dots. */
function boteh(p: FabricPalette, x: number, y: number, s: number, deg: number): string {
  const drop = "M0 16 C-12 16 -14 2 -8 -6 C-3 -13 6 -16 8 -24 C11 -16 12 -6 10 3 C8 12 5 16 0 16Z";
  const inner = "M0 11 C-7 11 -9 3 -5 -3 C-2 -7 3 -10 5 -15 C7 -9 7 -3 6 3 C5 8 3 11 0 11Z";
  let out = `<g transform="translate(${n(x)} ${n(y)}) rotate(${deg}) scale(${n(s)})">`;
  out += `<path d="${drop}" fill="${p.accent}"/>`;
  out += `<path d="${inner}" fill="none" stroke="${hi(p)}" stroke-width="1.4"/>`;
  out += `<circle cx="0" cy="4" r="2.6" fill="${hi(p)}"/>`;
  for (const [cx, cy] of [[-9, 12], [-12, 4], [-11, -4], [-6, -11], [1, -17]] as const) {
    out += `<circle cx="${cx}" cy="${cy}" r="1.1" fill="${hi(p)}" fill-opacity="0.85"/>`;
  }
  return `${out}</g>`;
}

/**
 * The motif vocabulary, at true yardage sizes: a woven twill repeats within a
 * centimetre, a tartan sett is a hand-span, a damask panel is knee to hip.
 */
export const MOTIFS: Record<FabricMotif, MotifSpec> = {
  solid: {
    directional: false,
    repeatCm: 1, // plain weave — a texture, not a pattern
    draw: (p, T) => `
      <path d="M0 0 H${T} V${T} H0 Z" fill="${withAlpha(hi(p), 0.04)}"/>
      ${weave(T, "#000000")}
    `,
    averageColor: (p) => mix([[p.base, 96], [hi(p), 4]]),
  },

  herringbone: {
    directional: true,
    repeatCm: 1, // a genuinely small weave — fine texture, never a bold pattern
    draw: (p, T) => {
      // Tiling chevron rows.
      const rows = 2;
      const rh = T / rows;
      let path = "";
      for (let i = 0; i <= rows; i++) {
        const y = i * rh;
        path += `M0 ${y} L${T / 2} ${y - rh / 2} L${T} ${y} `;
      }
      return `
        <path d="${path}" fill="none" stroke="${
        p.accent
      }" stroke-width="${T * 0.14}" stroke-linejoin="round" stroke-linecap="square"/>
        <path d="${path}" fill="none" stroke="${withAlpha(
        hi(p),
        0.5
      )}" stroke-width="1.5"/>
      `;
    },
    averageColor: (p) => mix([[p.base, 45], [p.accent, 50], [hi(p), 5]]),
  },

  stripe: {
    directional: true,
    repeatCm: 2,
    draw: (p, T) => {
      const w = T * 0.34;
      return `
        <rect x="0" y="0" width="${w}" height="${T}" fill="${p.accent}"/>
        <rect x="${T * 0.52}" y="0" width="${T * 0.06}" height="${T}" fill="${withAlpha(
        hi(p),
        0.7
      )}"/>
        ${weave(T, "#000000")}
      `;
    },
    averageColor: (p) => mix([[p.base, 60], [p.accent, 34], [hi(p), 6]]),
  },

  dots: {
    directional: false,
    repeatCm: 3,
    draw: (p, T) => {
      const r = T * 0.1;
      const c = T / 2;
      const dot = (cx: number, cy: number, rad: number, fill: string) =>
        `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="${fill}"/>`;
      return `
        ${dot(c, c, r, p.accent)}
        ${dot(0, 0, r, p.accent)}${dot(T, 0, r, p.accent)}
        ${dot(0, T, r, p.accent)}${dot(T, T, r, p.accent)}
        ${dot(c, c, r * 0.4, withAlpha(hi(p), 0.8))}
      `;
    },
    averageColor: (p) => mix([[p.base, 93], [p.accent, 6], [hi(p), 1]]),
  },

  floral: {
    directional: true,
    repeatCm: 4, // a small ditsy print
    /**
     * A stemmed ditsy flower. The stem and its single leaf are what make this
     * motif *directional* — turn the cloth and you can see that you turned it.
     * A bare rosette of petals would be symmetric under both 60° and 180°, so
     * rotating it would look like nothing had happened. `patterns.test.ts`
     * asserts the asymmetry so it cannot be flattened back out by accident.
     */
    draw: (p, T) => {
      const cx = T / 2;
      const cy = T * 0.4; // sits high, leaving room for the stem below
      const pr = T * 0.105;
      const stemTop = cy + pr * 2.1;
      const stemEnd = T * 0.95;

      let out = "";
      for (let k = 0; k < 6; k++) {
        const ang = (Math.PI / 3) * k;
        const px = cx + Math.cos(ang) * pr * 1.5;
        const py = cy + Math.sin(ang) * pr * 1.5;
        out += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(
          1
        )}" r="${pr.toFixed(1)}" fill="${withAlpha(p.accent, 0.85)}"/>`;
      }
      out += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(
        pr * 0.9
      ).toFixed(1)}" fill="${hi(p)}"/>`;

      // stem
      out += `<path d="M${cx.toFixed(1)} ${stemTop.toFixed(1)} C${(
        cx + T * 0.035
      ).toFixed(1)} ${(stemTop + (stemEnd - stemTop) * 0.45).toFixed(1)} ${(
        cx - T * 0.02
      ).toFixed(1)} ${(stemTop + (stemEnd - stemTop) * 0.75).toFixed(
        1
      )} ${cx.toFixed(1)} ${stemEnd.toFixed(1)}" fill="none" stroke="${withAlpha(
      hi(p),
      0.8
    )}" stroke-width="${(T * 0.022).toFixed(2)}" stroke-linecap="round"/>`;

      // one leaf, on one side only — this is what breaks the symmetry
      const ly = stemTop + (stemEnd - stemTop) * 0.5;
      out += `<path d="M${cx.toFixed(1)} ${ly.toFixed(1)} C${(
        cx + T * 0.09
      ).toFixed(1)} ${(ly - T * 0.07).toFixed(1)} ${(cx + T * 0.13).toFixed(
        1
      )} ${(ly + T * 0.02).toFixed(1)} ${(cx + T * 0.04).toFixed(1)} ${(
        ly + T * 0.06
      ).toFixed(1)} Z" fill="${withAlpha(hi(p), 0.7)}"/>`;

      const corner = (x: number, y: number) =>
        `<circle cx="${x}" cy="${y}" r="${(pr * 0.62).toFixed(
          1
        )}" fill="${withAlpha(p.accent, 0.6)}"/>`;
      out += `${corner(0, 0)}${corner(T, 0)}${corner(0, T)}${corner(T, T)}`;
      return out;
    },
    averageColor: (p) => mix([[p.base, 70], [p.accent, 25], [hi(p), 5]]),
  },

  plaid: {
    directional: true,
    repeatCm: 8, // a tartan sett
    draw: (p, T) => {
      const band = T * 0.34;
      const a = withAlpha(p.accent, 0.55);
      return `
        <rect x="0" y="0" width="${band}" height="${T}" fill="${a}"/>
        <rect x="0" y="0" width="${T}" height="${band}" fill="${a}"/>
        <rect x="0" y="0" width="${band}" height="${band}" fill="${withAlpha(
        p.accent,
        0.85
      )}"/>
        <path d="M${band + 4} 0 V${T} M0 ${band + 4} H${T}" stroke="${withAlpha(
        hi(p),
        0.6
      )}" stroke-width="2"/>
      `;
    },
    averageColor: (p) => mix([[p.base, 62], [p.accent, 33], [hi(p), 5]]),
  },

  geometric: {
    directional: true,
    repeatCm: 12,
    draw: (p, T) => {
      const c = T / 2;
      const d = T * 0.4;
      return `
        <path d="M${c} ${c - d} L${c + d} ${c} L${c} ${c + d} L${c - d} ${c} Z" fill="none" stroke="${
        p.accent
      }" stroke-width="${T * 0.08}"/>
        <path d="M${c} ${c - d * 0.5} L${c + d * 0.5} ${c} L${c} ${
        c + d * 0.5
      } L${c - d * 0.5} ${c} Z" fill="${withAlpha(hi(p), 0.7)}"/>
        <path d="M0 ${c} L${c} 0 M${c} ${T} L${T} ${c} M0 ${c} L${c} ${T} M${c} 0 L${T} ${c}" stroke="${withAlpha(
        p.accent,
        0.35
      )}" stroke-width="1.5"/>
      `;
    },
    averageColor: (p) => mix([[p.base, 68], [p.accent, 22], [hi(p), 10]]),
  },

  damask: {
    directional: false,
    repeatCm: 20, // a full damask panel — the largest repeat we carry
    draw: (p, T) => {
      const c = T / 2;
      const a = withAlpha(p.accent, 0.9);
      const h = withAlpha(hi(p), 0.75);
      // A four-fold ogee: one central medallion plus quarter-motifs in each
      // corner, so the panel joins seamlessly on all four edges.
      const medallion = (cx: number, cy: number, s: number) => `
        <path d="M${cx} ${cy - 30 * s}
                 C${cx + 16 * s} ${cy - 20 * s} ${cx + 22 * s} ${cy - 6 * s} ${cx} ${cy + 8 * s}
                 C${cx - 22 * s} ${cy - 6 * s} ${cx - 16 * s} ${cy - 20 * s} ${cx} ${cy - 30 * s} Z"
              fill="${a}"/>
        <path d="M${cx} ${cy + 30 * s}
                 C${cx - 16 * s} ${cy + 20 * s} ${cx - 22 * s} ${cy + 6 * s} ${cx} ${cy - 8 * s}
                 C${cx + 22 * s} ${cy + 6 * s} ${cx + 16 * s} ${cy + 20 * s} ${cx} ${cy + 30 * s} Z"
              fill="${a}"/>
        <ellipse cx="${cx}" cy="${cy}" rx="${7 * s}" ry="${10 * s}" fill="${h}"/>
        <path d="M${cx - 30 * s} ${cy} C${cx - 18 * s} ${cy - 12 * s} ${cx - 8 * s} ${cy - 6 * s} ${cx} ${cy}
                 C${cx - 8 * s} ${cy + 6 * s} ${cx - 18 * s} ${cy + 12 * s} ${cx - 30 * s} ${cy} Z"
              fill="${withAlpha(p.accent, 0.55)}"/>
        <path d="M${cx + 30 * s} ${cy} C${cx + 18 * s} ${cy + 12 * s} ${cx + 8 * s} ${cy + 6 * s} ${cx} ${cy}
                 C${cx + 8 * s} ${cy - 6 * s} ${cx + 18 * s} ${cy - 12 * s} ${cx + 30 * s} ${cy} Z"
              fill="${withAlpha(p.accent, 0.55)}"/>
      `;
      const s = T / 88;
      return `
        ${medallion(c, c, s)}
        ${medallion(0, 0, s * 0.6)}${medallion(T, 0, s * 0.6)}
        ${medallion(0, T, s * 0.6)}${medallion(T, T, s * 0.6)}
        <path d="M0 ${c} H${T} M${c} 0 V${T}" stroke="${withAlpha(
        p.accent,
        0.14
      )}" stroke-width="1"/>
      `;
    },
    averageColor: (p) => mix([[p.base, 64], [p.accent, 30], [hi(p), 6]]),
  },

  /* ———— a linen's slubs ———— */

  slub: {
    /* the slubs run across the cloth, along the weft: turned, they stand up */
    directional: true,
    repeatCm: 5, // a hand of linen: its slubs half a centimetre to a little over one long
    draw: (p, T) => {
      const rand = seeded(11);
      let out = "";
      // yarns a shade darker or lighter, the whole width — the linen's uneven, heathered weft
      for (let i = 0; i < 26; i++) {
        const y = n(rand() * T);
        const light = rand() < 0.5;
        const a = n(0.1 + rand() * 0.12);
        const w = n(0.6 + rand() * 0.6);
        out += `<path d="M-2 ${y} H${T + 2}" stroke="${light ? hi(p) : p.accent}" stroke-opacity="${a}" stroke-width="${w}"/>`;
      }
      // the slubs: short thick places in the yarn, tapered at both ends
      for (let i = 0; i < 18; i++) {
        const len = 6 + rand() * 16;
        const th = 1.2 + rand() * 1;
        const light = rand() < 0.55;
        const fill = `fill="${light ? hi(p) : p.accent}" fill-opacity="${n(0.25 + rand() * 0.2)}"`;
        const [x, y] = [rand() * T, rand() * T];
        out += around(T, x, y, len, (cx, cy) => `<path d="${lens(cx, cy, len, th, 0)}" ${fill}/>`);
      }
      // a few along the warp, thinner
      for (let i = 0; i < 5; i++) {
        const len = 5 + rand() * 9;
        const [x, y] = [rand() * T, rand() * T];
        out += around(T, x, y, len, (cx, cy) => `<path d="${lens(cx, cy, len, 0.9, 90)}" fill="${p.accent}" fill-opacity="0.18"/>`);
      }
      return out;
    },
    averageColor: (p) => mix([[p.base, 86], [p.accent, 7], [hi(p), 7]]),
  },

  /* ———— patterns ———— */

  pinstripe: {
    directional: true,
    repeatCm: 1.2, // a suit's pinstripe: a fine line every centimetre and a bit
    draw: (p, T) => `
      <rect x="${n(T * 0.47)}" y="0" width="${n(T * 0.06)}" height="${T}" fill="${p.accent}"/>
      ${weave(T, "#000000")}
    `,
    averageColor: (p) => mix([[p.base, 94], [p.accent, 6]]),
  },

  wideStripe: {
    directional: true,
    repeatCm: 6, // bands three centimetres wide
    draw: (p, T) => `
      <rect x="0" y="0" width="${n(T / 2)}" height="${T}" fill="${p.accent}"/>
      ${weave(T, "#000000")}
    `,
    averageColor: (p) => mix([[p.base, 50], [p.accent, 50]]),
  },

  gingham: {
    /* a check turns to diamonds on the bias */
    directional: true,
    repeatCm: 2.4, // a 1.2 cm check: the half-inch gingham of a shirt or a summer dress
    draw: (p, T) => {
      const h = n(T / 2);
      // the coloured yarns one way, then the other: half-tones where only one runs, solid where they cross
      return `
        <rect x="0" y="0" width="${h}" height="${T}" fill="${p.accent}" fill-opacity="0.5"/>
        <rect x="0" y="0" width="${T}" height="${h}" fill="${p.accent}" fill-opacity="0.5"/>
        <rect x="0" y="0" width="${h}" height="${h}" fill="${p.accent}"/>
        ${weave(T, "#000000")}
      `;
    },
    averageColor: (p) => mix([[p.base, 50], [p.accent, 50]]),
  },

  tartan: {
    directional: true,
    repeatCm: 16, // a full sett, as on a kilt or a winter scarf
    draw: (p, T) => {
      // the sett — the same bands across and down, crossing darker where they meet
      const s = T / 88;
      const sett: Array<[string, number] | number> = [[p.accent, 20], 14, [hi(p), 3], 14, [p.accent, 8], 14, [hi(p), 3], 12];
      let x = 0;
      let out = "";
      for (const band of sett) {
        const [colour, w] = typeof band === "number" ? [undefined, band] : band;
        if (colour) {
          const a = colour === p.accent ? 0.55 : 0.75;
          out += `<rect x="${n(x * s)}" y="0" width="${n(w * s)}" height="${T}" fill="${colour}" fill-opacity="${a}"/>`;
          out += `<rect x="0" y="${n(x * s)}" width="${T}" height="${n(w * s)}" fill="${colour}" fill-opacity="${a}"/>`;
        }
        x += w;
      }
      // its twill, faint, at 45°
      for (let k = -22; k <= 22; k++) {
        out += `<path d="M0 ${n(k * 4 * s)} L${T} ${n(k * 4 * s + T)}" stroke="#000000" stroke-opacity="0.05" stroke-width="${n(1.2 * s)}"/>`;
      }
      return out;
    },
    averageColor: (p) => mix([[p.base, 48], [p.accent, 45], [hi(p), 7]]),
  },

  houndstooth: {
    /* its teeth point one way */
    directional: true,
    repeatCm: 2, // a jacket's houndstooth: teeth about a centimetre across
    draw: (p, T) => {
      // the weave itself: a 2/2 twill, four dark yarns and four light each way.
      // A cell shows the warp where the warp is up, else the weft.
      const c = T / 8;
      let out = "";
      for (let y = 0; y < 8; y++) {
        let run = -1;
        for (let x = 0; x <= 8; x++) {
          const up = (x + y) % 4 < 2;
          const dark = x < 8 && (up ? x % 8 < 4 : y % 8 < 4);
          if (dark && run < 0) run = x;
          if (!dark && run >= 0) {
            out += `<rect x="${n(run * c)}" y="${n(y * c)}" width="${n((x - run) * c)}" height="${n(c)}" fill="${p.accent}"/>`;
            run = -1;
          }
        }
      }
      return out;
    },
    averageColor: (p) => mix([[p.base, 50], [p.accent, 50]]),
  },

  dotsLarge: {
    directional: false,
    repeatCm: 7, // a polka dot: two centimetres across
    draw: (p, T) => {
      const r = n(T * 0.16);
      const dot = (cx: number, cy: number) => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${r}" fill="${p.accent}"/>`;
      return `${dot(T / 2, T / 2)}${dot(0, 0)}${dot(T, 0)}${dot(0, T)}${dot(T, T)}${weave(T, "#000000")}`;
    },
    averageColor: (p) => mix([[p.base, 84], [p.accent, 16]]),
  },

  floralLarge: {
    /* its stems stand up */
    directional: true,
    repeatCm: 24, // a big bloom, eight centimetres across, as on a summer dress
    draw: (p, T) => {
      const s = T / 88;
      let out = "";
      out += around(T, 28 * s, 30 * s, 34 * s, (x, y) => bloom(p, x, y, 15 * s));
      out += around(T, 70 * s, 72 * s, 30 * s, (x, y) => bloom(p, x, y, 11 * s));
      out += around(T, 72 * s, 20 * s, 10 * s, (x, y) => bud(p, x, y, 5 * s));
      out += around(T, 20 * s, 74 * s, 10 * s, (x, y) => bud(p, x, y, 4.5 * s));
      return out;
    },
    averageColor: (p) => mix([[p.base, 72], [p.accent, 20], [hi(p), 8]]),
  },

  paisley: {
    /* its teardrops lean one way */
    directional: true,
    repeatCm: 10, // botehs five or six centimetres long
    draw: (p, T) => {
      const s = T / 88;
      let out = "";
      // little flowers between them
      for (const [x, y] of [[66, 18], [14, 66], [44, 52], [84, 46]] as const) {
        out += around(T, x * s, y * s, 3 * s, (cx, cy) => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(1.6 * s)}" fill="${hi(p)}" fill-opacity="0.8"/>`);
      }
      out += around(T, 26 * s, 30 * s, 30 * s, (x, y) => boteh(p, x, y, s, -25));
      out += around(T, 70 * s, 76 * s, 30 * s, (x, y) => boteh(p, x, y, s * 0.9, -25));
      return out;
    },
    averageColor: (p) => mix([[p.base, 70], [p.accent, 22], [hi(p), 8]]),
  },
};

/* ------------------------------------------------------------- surfaces */

/**
 * A cloth's surface: what its weave or knit looks like close up, laid over
 * whatever its motif is — a denim's streaks of unevenly dyed indigo, a knit's
 * columns of loops, a wool's flecks — and drawn only as far as a screen can
 * show it.
 *
 * It belongs to the material, not to the motif, so every denim streaks and
 * every wool flecks, a plain winter wool and a tartan alike. And it is its
 * own tile, at its own true size: a denim's streaks a few millimetres wide and
 * centimetres long, whatever the print on it repeats at.
 *
 * Colourless: a mid-grey tile with lighter and darker marks, laid over the
 * cloth with `soft-light` — which leaves the cloth as it is wherever the tile
 * is mid-grey. So the surface is the cloth's own colour, lighter and darker,
 * and never a colour of its own; and softened past what a screen can show it
 * fades into mid-grey and leaves the cloth exactly as it was — see
 * `surfaceGround`, which balances each tile to average mid-grey.
 *
 * A crepe's pebbles and a nida's grain are a few tenths of a millimetre:
 * under two pixels each even at 8× on a desktop. They are not drawn — a
 * surface no screen can show is no surface at all.
 */
export interface SurfaceSpec {
  /** One repeat of the surface's own tile, in centimetres: its true size, as a motif's. */
  repeatCm: number;
  /**
   * The period of its finest detail, in centimetres — what a screen must
   * resolve to show it. It decides how sharp the surface is drawn, as a
   * repeat decides a print's (see `printScale.ts`): sharp from `SHARP_PX` a
   * period, gone into the cloth's own colour by `EVEN_PX`.
   */
  detailCm: number;
  /** Runs with the grain — a denim's streaks and a knit's columns down the warp. */
  directional: boolean;
  /** The marks, in a `T`×`T` tile: lighter or darker than the cloth, at low opacity. Must tile seamlessly. */
  marks: (T: number) => SurfaceMark[];
}

/** One mark of a surface: its outline, lighter or darker, how strongly, and its area in tile pixels. */
export interface SurfaceMark {
  d: string;
  light: boolean;
  alpha: number;
  area: number;
}

/**
 * A lens-shaped mark `len` long and `th` thick, along `deg`, at (x, y) — and
 * its copies a tile over wherever it crosses an edge, so the tile joins. Its
 * area is counted once: the copies only finish what crosses an edge.
 */
function lensMarks(T: number, x: number, y: number, len: number, th: number, deg: number, light: boolean, alpha: number): SurfaceMark[] {
  const marks: SurfaceMark[] = [];
  let first = true;
  around(T, x, y, len, (cx, cy) => {
    marks.push({ d: lens(cx, cy, len, th, deg), light, alpha: n(alpha), area: first ? (2 * len * th) / 3 : 0 });
    first = false;
    return "";
  });
  return marks;
}

export const SURFACES: Partial<Record<FabricMaterial, SurfaceSpec>> = {
  /*
    Denim: rope-dyed indigo takes unevenly, so every warp yarn is a shade of
    its own — streaks down the cloth, millimetres wide and centimetres long,
    and here and there a slub, a short thick place that took less dye.
  */
  denim: {
    repeatCm: 6,
    detailCm: 0.5,
    directional: true,
    marks: (T) => {
      const cm = T / 6;
      const rand = seeded(101);
      const out: SurfaceMark[] = [];
      // yarn by yarn: thin streaks, lighter and darker, a centimetre to five long
      for (let i = 0; i < 70; i++) {
        const len = (1 + rand() * 4) * cm;
        const th = (0.04 + rand() * 0.08) * cm;
        const light = rand() < 0.5;
        const alpha = 0.08 + rand() * 0.1;
        out.push(...lensMarks(T, rand() * T, rand() * T, len, th, 90, light, alpha));
      }
      // wider bands of yarns dyed alike, two to four millimetres
      for (let i = 0; i < 14; i++) {
        const len = (1.5 + rand() * 2.5) * cm;
        const th = (0.2 + rand() * 0.2) * cm;
        const light = rand() < 0.6;
        const alpha = 0.06 + rand() * 0.07;
        out.push(...lensMarks(T, rand() * T, rand() * T, len, th, 90, light, alpha));
      }
      // slubs: short bright places in a yarn
      for (let i = 0; i < 12; i++) {
        const len = (0.4 + rand() * 0.8) * cm;
        const th = (0.1 + rand() * 0.06) * cm;
        out.push(...lensMarks(T, rand() * T, rand() * T, len, th, 90, true, 0.18 + rand() * 0.12));
      }
      return out;
    },
  },

  /*
    A knit: columns of loops down the cloth, six to the centimetre on a
    jersey — each column's loops catching the light, the gap between two in
    shadow — and the yarn a little uneven along them.
  */
  jersey: {
    repeatCm: 2,
    detailCm: 1 / 6,
    directional: true,
    marks: (T) => {
      const cols = 12;
      const rows = 18;
      const w = T / cols;
      const h = T / rows;
      const out: SurfaceMark[] = [];
      for (let c = 0; c < cols; c++) {
        const cx = (c + 0.5) * w;
        // the gap between this column and the next
        out.push({ d: `M${n(c * w - w * 0.09)} 0 H${n(c * w + w * 0.09)} V${T} H${n(c * w - w * 0.09)} Z`, light: false, alpha: 0.2, area: w * 0.18 * T });
        // each loop a V: two legs meeting below, catching the light
        for (let r = 0; r < rows; r++) {
          const top = r * h;
          const leg = (x0: number) =>
            `M${n(x0 - w * 0.11)} ${n(top)} L${n(cx - w * 0.06)} ${n(top + h)} L${n(cx + w * 0.06)} ${n(top + h)} L${n(x0 + w * 0.11)} ${n(top)} Z`;
          out.push({ d: leg(cx - w * 0.3), light: true, alpha: 0.14, area: w * 0.22 * h });
          out.push({ d: leg(cx + w * 0.3), light: true, alpha: 0.14, area: w * 0.22 * h });
        }
      }
      // the yarn's own unevenness along the columns
      const rand = seeded(203);
      for (let i = 0; i < 26; i++) {
        const len = (0.3 + rand() * 0.6) * (T / 2);
        const th = (0.06 + rand() * 0.06) * (T / 2);
        out.push(...lensMarks(T, rand() * T, rand() * T, len, th, 90, rand() < 0.5, 0.05 + rand() * 0.04));
      }
      return out;
    },
  },

  /*
    Wool: flecks of fibre lighter and darker than the yarn they are spun into
    — a mélange — a millimetre or a few long, lying mostly down the warp. A
    large tile, scattered evenly: on a smaller one, or with soft blotches
    among the flecks, the repeat showed as a lattice at 4×.
  */
  wool: {
    repeatCm: 8,
    detailCm: 0.4,
    directional: true,
    marks: (T) => {
      const cm = T / 8;
      const rand = seeded(307);
      const out: SurfaceMark[] = [];
      for (let i = 0; i < 330; i++) {
        const len = (0.15 + rand() * 0.25) * cm;
        const th = (0.04 + rand() * 0.04) * cm;
        const deg = 90 + (rand() - 0.5) * 60;
        const light = rand() < 0.6;
        const alpha = light ? 0.2 + rand() * 0.16 : 0.16 + rand() * 0.1;
        out.push(...lensMarks(T, rand() * T, rand() * T, len, th, deg, light, alpha));
      }
      return out;
    },
  },
};

/** The surface laid over this fabric, if its material has one a screen can show. A photograph carries its own. */
export function fabricSurface(fabric: Fabric): SurfaceSpec | undefined {
  return fabric.source === "procedural" ? SURFACES[fabric.material] : undefined;
}

/**
 * The grey a surface tile is laid on, so the whole tile averages mid-grey:
 * each mark moves the tile's average by its opacity times its area, toward
 * white or toward black, and the ground is set to take that back. Softened
 * into an even blur, or faded out, the tile is then mid-grey everywhere, which
 * `soft-light` leaves as it finds it — the cloth's own colour, exactly.
 */
export function surfaceGround(marks: SurfaceMark[], T: number): number {
  const area = T * T;
  const lighter = marks.filter((m) => m.light).reduce((sum, m) => sum + m.alpha * m.area, 0) / area;
  const darker = marks.filter((m) => !m.light).reduce((sum, m) => sum + m.alpha * m.area, 0) / area;
  return (0.5 - lighter) / (1 - lighter - darker);
}

/** How finely a mark's opacity is kept, so marks alike share one shape — see `surfaceTileSvg`. */
const ALPHA_STEP = 0.02;

/**
 * One repeat of a surface: its marks over its balancing grey. Marks of the
 * same tone and opacity are drawn as one shape, so a tile of hundreds of
 * marks is a dozen paths — it is drawn again at every zoom, and on a phone
 * every element of it costs.
 */
export function surfaceTileSvg(spec: SurfaceSpec, tile = TILE_PX): string {
  const T = tile;
  const marks = spec.marks(T).map((m) => ({ ...m, alpha: +(Math.round(m.alpha / ALPHA_STEP) * ALPHA_STEP).toFixed(2) }));
  const g = Math.round(255 * surfaceGround(marks, T)).toString(16).padStart(2, "0");
  const groups = new Map<string, string[]>();
  for (const m of marks) {
    const key = `${m.light ? "#ffffff" : "#000000"}|${m.alpha}`;
    groups.set(key, [...(groups.get(key) ?? []), m.d]);
  }
  const drawn = [...groups.entries()]
    .map(([key, ds]) => {
      const [fill, alpha] = key.split("|");
      return `<path d="${ds.join("")}" fill="${fill}" fill-opacity="${alpha}"/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${T}" height="${T}" viewBox="0 0 ${T} ${T}"><rect width="${T}" height="${T}" fill="#${g}${g}${g}"/>${drawn}</svg>`;
}

/**
 * A surface drawn at its true size, as much of it as the screen can show:
 * `keep` of it, see `printScale.ts` — read off its detail, not its tile, for
 * the tile is a few centimetres but what has to be resolved is the streak,
 * the column, the fleck. It fades in as its detail comes into view rather than
 * being blurred into it: a print is softened inside its tile, but a tile of
 * hundreds of marks, blurred as a block of nine, was drawn over again at every
 * zoom on the phone's main thread — nearly half a second a zoom. Faded, it is
 * the one drawing at every zoom; gone into the cloth's own colour while it
 * cannot show at all (`keep` 0), as its balanced grey would be anyway.
 */
export function surfaceArtwork(spec: SurfaceSpec, keep: number): { url: string; repeatCm: number; opacity: number } | undefined {
  if (keep <= 0) return undefined;
  const kind = (Object.keys(SURFACES) as FabricMaterial[]).find((m) => SURFACES[m] === spec) ?? "surface";
  const key = `surface|${kind}|${TILE_PX}`;
  let url = uriCache.get(key);
  if (!url) {
    url = `data:image/svg+xml,${encodeURIComponent(surfaceTileSvg(spec, TILE_PX)).replace(/'/g, "%27").replace(/"/g, "%22")}`;
    uriCache.set(key, url);
  }
  return { url, repeatCm: spec.repeatCm, opacity: Math.min(1, keep) };
}

/* ------------------------------------------------------------ resolution */

/**
 * Width assumed for a photographed tile until the browser reports its real
 * pixel size. `useFabricArtwork` corrects it as soon as the image decodes, so a
 * fabric record only ever needs `imageUrl` + `cmPerPixel`.
 */
const ASSUMED_IMAGE_PX = 512;

/** Measured natural widths of photographed tiles, keyed by URL. */
const measuredPx = new Map<string, number>();

/** Record a photographed tile's true pixel width (called by the hook). */
export function noteMeasuredImage(url: string, px: number) {
  measuredPx.set(url, px);
}

export const hasMeasuredImage = (url: string) => measuredPx.has(url);

/** The motif + palette a procedural fabric is drawn from. */
export function fabricSwatch(fabric: Fabric): FabricSwatch {
  if (fabric.source === "image") {
    return { base: fabric.color, accent: fabric.color, motif: "solid" };
  }
  return { ...fabric.palette, motif: fabric.motif };
}

/**
 * Real-world width of one repeat of this fabric, in centimetres.
 *
 * Procedural fabrics read it off their motif — which is why two plaids can
 * never drift apart. Photographed fabrics multiply their measured `cmPerPixel`
 * by the photo's pixel width.
 */
export function fabricRepeatCm(fabric: Fabric): number {
  if (fabric.source === "image") {
    const px = measuredPx.get(fabric.imageUrl) ?? ASSUMED_IMAGE_PX;
    return px * fabric.cmPerPixel;
  }
  return MOTIFS[fabric.motif].repeatCm;
}

/**
 * Whether the fabric has a direction worth choosing — see
 * `MotifSpec.directional`: its pattern's, or its surface's (a denim's
 * streaks run down the warp), or its sheen's, which is drawn out along the
 * grain. A photographed one says so on its record; one that does not is
 * taken to have none.
 */
export function fabricHasDirection(fabric: Fabric): boolean {
  if (fabric.sheen) return true;
  if (fabric.source === "image") return fabric.directional ?? false;
  return MOTIFS[fabric.motif].directional || Boolean(fabricSurface(fabric)?.directional);
}

/** How this fabric reads once its repeat is too small to resolve on screen. */
export function fabricAverageColor(fabric: Fabric): string {
  if (fabric.source === "image") return fabric.color;
  return MOTIFS[fabric.motif].averageColor(fabric.palette);
}

/* --------------------------------------------------------------- drawing */

/**
 * Build the full tile SVG markup for a motif + palette.
 *
 * `soften` blurs the tile by that share of a repeat — see `printScale.ts`:
 * how a repeat only a few pixels across is drawn, at its true size, without
 * moiré. The blur has to wrap round the tile as the print does round the
 * cloth, or every tile would fade at its own edges into a grid. So the motif
 * is laid out as a block of its own repeats, each clipped to its square as the
 * tiling clips it, the whole block is blurred, and only the middle repeat is
 * kept. Blurring keeps the print's own average colour, so a softened print
 * reads as the cloth it is, never as a guess at it.
 */
export function fabricTileSvg(swatch: FabricSwatch, tile = TILE_PX, soften = 0): string {
  const T = tile;
  if (soften <= 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${T}" height="${T}" viewBox="0 0 ${T} ${T}">
    <rect width="${T}" height="${T}" fill="${swatch.base}"/>
    ${MOTIFS[swatch.motif].draw(swatch, T)}
  </svg>`;
  }
  /* a blur reaches about three of its widths: enough repeats round the middle one for it to wrap */
  const R = soften > 1 / 3 ? 2 : 1;
  let block = "";
  for (let i = -R; i <= R; i++) {
    for (let j = -R; j <= R; j++) block += `<use href="#m" x="${i * T}" y="${j * T}"/>`;
  }
  const [x, w] = [-R * T, (2 * R + 1) * T];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${T}" height="${T}" viewBox="0 0 ${T} ${T}">
    <defs>
      <clipPath id="c"><rect width="${T}" height="${T}"/></clipPath>
      <g id="m" clip-path="url(#c)">
        <rect width="${T}" height="${T}" fill="${swatch.base}"/>
        ${MOTIFS[swatch.motif].draw(swatch, T)}
      </g>
      <filter id="s" filterUnits="userSpaceOnUse" x="${x}" y="${x}" width="${w}" height="${w}">
        <feGaussianBlur stdDeviation="${+(soften * T).toFixed(3)}"/>
      </filter>
    </defs>
    <g filter="url(#s)">${block}</g>
  </svg>`;
}

const uriCache = new Map<string, string>();

/** Encode the tile as a `data:` URI usable in CSS `background` or SVG <image>. */
export function fabricDataUri(swatch: FabricSwatch, tile = TILE_PX, soften = 0): string {
  const key = `${swatch.motif}|${swatch.base}|${swatch.accent}|${
    swatch.highlight ?? ""
  }|${tile}${soften > 0 ? `|${soften}` : ""}`;
  const hit = uriCache.get(key);
  if (hit) return hit;

  const encoded = encodeURIComponent(fabricTileSvg(swatch, tile, soften))
    .replace(/'/g, "%27")
    .replace(/"/g, "%22");
  const uri = `data:image/svg+xml,${encoded}`;
  uriCache.set(key, uri);
  return uri;
}

export interface FabricArtwork {
  /** Repeating image: a `data:` URI for procedural, the URL for a photo. */
  url: string;
  /** Real-world width of one repeat, in centimetres. */
  repeatCm: number;
  /** Flat reading of the repeat, for when it is too small to resolve. */
  averageColor: string;
  /**
   * How far a photograph is veiled toward its own colour, 0 to 1. A photo
   * cannot be softened inside its tile as a drawn motif is, so a small one is
   * faded toward `averageColor` instead, as far as `keep` asks. Always 0 for
   * a procedural fabric.
   */
  veil: number;
}

/**
 * Everything needed to paint a fabric, at true scale — with `keep` of its
 * contrast, see `printScale.ts`: 1, the default, draws it sharp.
 */
export function fabricArtwork(fabric: Fabric, keep = 1): FabricArtwork {
  return {
    url:
      fabric.source === "image"
        ? fabric.imageUrl
        : fabricDataUri(fabricSwatch(fabric), TILE_PX, printSoften(keep)),
    repeatCm: fabricRepeatCm(fabric),
    averageColor: fabricAverageColor(fabric),
    veil: fabric.source === "image" ? 1 - Math.min(1, Math.max(0, keep)) : 0,
  };
}

/* ------------------------------------------------------------- assertion */

/**
 * Guards the invariant this module exists to protect: **fabrics sharing a motif
 * must render at exactly the same size.** Scale drifted once, when fabric
 * records each set their own `cmPerPixel` by hand — Highland Forest Plaid came
 * out bigger than Kyoto Indigo Plaid. The type system now forbids the override;
 * this catches data that arrives at runtime (a CMS, an API, a JSON seed) where
 * types cannot reach.
 *
 * Throws in development so the mistake is impossible to ignore; silent in
 * production so a bad record degrades rather than takes the site down.
 */
export function assertMotifScale(fabrics: Fabric[]): void {
  if (process.env.NODE_ENV === "production") return;

  const problems: string[] = [];
  const byMotif = new Map<FabricMotif, Fabric[]>();

  for (const f of fabrics) {
    if (f.source !== "procedural") continue;

    // A procedural fabric must not carry its own scale.
    if ((f as { cmPerPixel?: unknown }).cmPerPixel !== undefined) {
      problems.push(
        `"${f.id}" is procedural but sets cmPerPixel — scale belongs to the "${f.motif}" motif.`
      );
    }
    const list = byMotif.get(f.motif);
    if (list) list.push(f);
    else byMotif.set(f.motif, [f]);
  }

  // Same motif ⇒ identical resolved repeat.
  for (const [motif, group] of byMotif) {
    const expected = MOTIFS[motif].repeatCm;
    for (const f of group) {
      const actual = fabricRepeatCm(f);
      if (actual !== expected) {
        problems.push(
          `"${f.id}" (${motif}) resolves to ${actual} cm but the motif is ${expected} cm.`
        );
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Fabric scale is not motif-owned:\n  - ${problems.join("\n  - ")}`
    );
  }
}
