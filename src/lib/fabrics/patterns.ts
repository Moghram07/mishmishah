import type {
  Fabric,
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
};

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
 * Whether the fabric's pattern has a direction worth choosing — see
 * `MotifSpec.directional`. A photographed one says so on its record; one
 * that does not is taken to have none.
 */
export function fabricHasDirection(fabric: Fabric): boolean {
  if (fabric.source === "image") return fabric.directional ?? false;
  return MOTIFS[fabric.motif].directional;
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
