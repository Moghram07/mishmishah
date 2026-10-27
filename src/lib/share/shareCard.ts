"use client";

import type { Fabric, Locale } from "@/types";
import { fabricArtwork } from "@/lib/fabrics/artwork";

/**
 * Exporting a design as a single shareable PNG.
 *
 * The live SVG is serialized and rasterized as-is, so the exported image is
 * exactly what was on screen — same parts, same shading, same true-to-life
 * pattern scale — then the Mishmishah mark, the product name and the fabrics
 * that went into it are drawn on top with the app's own fonts.
 */

const W = 1080;
const H = 1350;
const M = 72;

export interface ShareEntry {
  /** Which part of the piece — "Top", "Bottom", … */
  partLabel: string;
  fabric: Fabric;
  fabricName: string;
}

export interface ShareCardOptions {
  svg: SVGSVGElement;
  /**
   * The part of the drawing to put on the card, when it is not the part on
   * screen. The mannequin is drawn into the whole stage, room for the controls
   * and all; the card wants the figure.
   */
  viewBox?: string;
  brand: string;
  productName: string;
  tagline: string;
  entries: ShareEntry[];
  locale: Locale;
  dark: boolean;
  fileName: string;
}

const PALETTE = {
  light: {
    bg: "#FBF7F0",
    panel: "#FFFFFF",
    ink: "#1B1714",
    muted: "#6B6055",
    line: "#E8DFD2",
  },
  dark: {
    bg: "#141110",
    panel: "#1F1A17",
    ink: "#F7F1E8",
    muted: "#A79B8D",
    line: "#332B25",
  },
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src.slice(0, 64)}`));
    img.src = src;
  });
}

const inlined = new Map<string, string>();

/** Read a file into a `data:` URI, remembering it. */
async function toDataUri(url: string): Promise<string> {
  const hit = inlined.get(url);
  if (hit) return hit;
  const blob = await fetch(url).then((r) => r.blob());
  const uri = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  inlined.set(url, uri);
  return uri;
}

/**
 * Serialize a live SVG node into a standalone `data:` URI.
 *
 * An SVG loaded as a `data:` URI is sandboxed and may not fetch anything, so
 * every `<image>` still pointing at a file — the mannequin photograph — has to
 * be carried inside the document or it silently renders as nothing.
 */
async function svgToDataUri(
  svg: SVGSVGElement,
  width: number,
  height: number,
  ink: string,
  viewBox?: string
): Promise<string> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  if (viewBox) clone.setAttribute("viewBox", viewBox);
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.removeAttribute("class");
  // Seam strokes are drawn with `currentColor`, which no longer inherits once
  // the node is detached from the document.
  clone.style.color = ink;

  await Promise.all(
    [...clone.querySelectorAll("image")].map(async (node) => {
      const href = node.getAttribute("href") ?? node.getAttribute("xlink:href");
      if (!href || href.startsWith("data:")) return;
      try {
        node.setAttribute("href", await toDataUri(href));
      } catch {
        // Better a missing body than no card at all.
      }
    })
  );

  const xml = new XMLSerializer().serializeToString(clone);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Fill a rounded square with a repeating fabric tile at true scale. */
function drawFabricChip(
  ctx: CanvasRenderingContext2D,
  tile: HTMLImageElement | null,
  fabric: Fabric,
  x: number,
  y: number,
  size: number,
  viewCm: number
) {
  ctx.save();
  roundRect(ctx, x, y, size, size, 14);
  ctx.fillStyle = fabric.palette?.base ?? fabric.color;
  ctx.fill();

  if (tile) {
    ctx.clip();
    const step = (fabricArtwork(fabric).repeatCm / viewCm) * size;
    if (step >= 1) {
      for (let ty = y; ty < y + size; ty += step) {
        for (let tx = x; tx < x + size; tx += step) {
          ctx.drawImage(tile, tx, ty, step, step);
        }
      }
    }
  }
  ctx.restore();
}

const cssFont = (name: string, fallback: string) => {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v ? `${v}, ${fallback}` : fallback;
};

/** Paint the share card. Split out from the download so it can be previewed. */
export async function renderShareCard(
  opts: ShareCardOptions
): Promise<HTMLCanvasElement> {
  const { svg, viewBox, brand, productName, tagline, entries, locale, dark } =
    opts;
  const c = dark ? PALETTE.dark : PALETTE.light;
  const rtl = locale === "ar";

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable");

  // Fonts must be resolved before the first fillText or the metrics are wrong.
  await document.fonts?.ready;
  const sans = cssFont(
    rtl ? "--font-arabic" : "--font-sans",
    "system-ui, sans-serif"
  );
  const display = cssFont(
    rtl ? "--font-arabic" : "--font-display",
    "system-ui, sans-serif"
  );

  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);

  // warm apricot glow behind the piece
  const glow = ctx.createRadialGradient(W / 2, 470, 40, W / 2, 470, 520);
  glow.addColorStop(0, dark ? "rgba(255,106,44,0.22)" : "rgba(255,106,44,0.16)");
  glow.addColorStop(1, "rgba(255,106,44,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 130, W, 760);

  ctx.direction = rtl ? "rtl" : "ltr";
  ctx.textAlign = "start";

  // — masthead —
  const logoSize = 64;
  const logoW = Math.round(logoSize * (267 / 356));
  try {
    const logo = await loadImage("/logo-apricot.png");
    ctx.drawImage(logo, rtl ? W - M - logoW : M, M, logoW, logoSize);
  } catch {
    // The mark is nice to have; the card still works without it.
  }
  const brandX = rtl ? W - M - logoW - 20 : M + logoW + 20;
  ctx.fillStyle = c.ink;
  ctx.font = `700 40px ${display}`;
  ctx.textBaseline = "middle";
  ctx.fillText(brand, brandX, M + logoSize / 2);

  // — the piece —
  // A dressed mannequin is twice as tall as it is wide and a pillow is square,
  // so the stage is fitted rather than assumed.
  const box = { w: 700, h: 780, top: 120 };
  const [, , vbW, vbH] = viewBox
    ? viewBox.split(" ").map(Number)
    : [0, 0, svg.viewBox.baseVal?.width ?? 0, svg.viewBox.baseVal?.height ?? 0];
  const ratio = vbW > 0 && vbH > 0 ? vbW / vbH : 1;
  const artH = Math.min(box.h, box.w / ratio);
  const artW = artH * ratio;
  try {
    const art = await loadImage(await svgToDataUri(svg, artW, artH, c.ink, viewBox));
    ctx.drawImage(
      art,
      (W - artW) / 2,
      box.top + (box.h - artH) / 2,
      artW,
      artH
    );
  } catch {
    // fall through — the card still carries the fabric details
  }

  // — details panel —
  const rowH = 108;
  const panelH = 132 + entries.length * rowH;
  const panelY = H - M - panelH;
  ctx.fillStyle = c.panel;
  roundRect(ctx, M, panelY, W - M * 2, panelH, 36);
  ctx.fill();

  const padX = 44;
  const textStart = rtl ? W - M - padX : M + padX;

  ctx.fillStyle = c.ink;
  ctx.font = `700 46px ${display}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(productName, textStart, panelY + 76);

  ctx.fillStyle = c.muted;
  ctx.font = `400 26px ${sans}`;
  ctx.fillText(tagline, textStart, panelY + 114);

  // — one row per part —
  const chip = 68;
  const chipX = rtl ? W - M - padX - chip : M + padX;
  const labelX = rtl ? chipX - 28 : chipX + chip + 28;

  const tiles = await Promise.all(
    entries.map((e) =>
      loadImage(fabricArtwork(e.fabric).url).catch(() => null)
    )
  );

  entries.forEach((entry, i) => {
    const y = panelY + 150 + i * rowH;

    ctx.strokeStyle = c.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(M + padX, y - 22);
    ctx.lineTo(W - M - padX, y - 22);
    ctx.stroke();

    // a 16 cm window of cloth — enough to read the repeat at true scale
    drawFabricChip(ctx, tiles[i], entry.fabric, chipX, y, chip, 16);

    ctx.fillStyle = c.muted;
    ctx.font = `600 22px ${sans}`;
    ctx.fillText(entry.partLabel.toUpperCase(), labelX, y + 26);

    ctx.fillStyle = c.ink;
    ctx.font = `600 32px ${sans}`;
    ctx.fillText(entry.fabricName, labelX, y + 62);
  });

  return canvas;
}

/** Render the design to a PNG and hand it to the browser as a download. */
export async function exportShareCard(opts: ShareCardOptions): Promise<void> {
  const canvas = await renderShareCard(opts);
  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, "image/png")
  );
  if (!blob) throw new Error("Could not encode the image");

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = opts.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
