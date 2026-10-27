"use client";

import { useEffect, useMemo, useReducer } from "react";
import type { Fabric } from "@/types";
import {
  fabricArtwork,
  hasMeasuredImage,
  noteMeasuredImage,
  type FabricArtwork,
} from "./patterns";

/**
 * Browser-side fabric artwork.
 *
 * The resolution itself lives in `patterns.ts` and is pure. All this adds is
 * the one thing that needs a browser: measuring a photographed tile's true
 * pixel width, so an `image` fabric needs nothing in its record beyond a URL
 * and its measured `cmPerPixel`.
 */

export type { FabricArtwork };
export {
  fabricArtwork,
  fabricRepeatCm,
  fabricAverageColor,
} from "./patterns";

/**
 * Artwork for a fabric, measuring photographed tiles once and re-rendering when
 * their true size is known — with `keep` of its contrast, for a print that
 * comes out only a few pixels a repeat on screen (see `printScale.ts`).
 */
export function useFabricArtwork(fabric: Fabric, keep = 1): FabricArtwork {
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  const src = fabric.source === "image" ? fabric.imageUrl : undefined;

  useEffect(() => {
    if (!src || hasMeasuredImage(src)) return;
    let live = true;
    const img = new Image();
    img.onload = () => {
      if (!live) return;
      noteMeasuredImage(src, img.naturalWidth);
      bump();
    };
    img.src = src;
    return () => {
      live = false;
    };
  }, [src]);

  // `version` re-runs this once a photographed tile has been measured.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => fabricArtwork(fabric, keep), [fabric, version, keep]);
}

export interface FabricBackgroundOptions {
  /** How wide a window of cloth the element shows, in centimetres. */
  viewCm?: number;
  /** The element's rendered width in CSS pixels — decides flat vs. tiled. */
  elementPx?: number;
  /**
   * Widen the window when needed so at least one whole repeat fits.
   *
   * True scale is the rule everywhere it can inform a decision — the product
   * preview, the card. But a 44 px picker chip showing a quarter of a 20 cm
   * damask is just a beige square: it identifies nothing. A swatch book shows
   * one full repeat for the same reason. Chips opt into this; the exact size is
   * still stated in centimetres next to them.
   */
  fitRepeat?: boolean;
}

/**
 * CSS background showing a window of the fabric at its true print size.
 *
 * Below ~6 px on screen a repeat stops resolving and turns to grey mush, so the
 * swatch falls back to the fabric's average color plus a fine weave.
 */
export function fabricBackground(
  fabric: Fabric,
  { viewCm = 14, elementPx = 56, fitRepeat = false }: FabricBackgroundOptions = {}
): React.CSSProperties {
  const { url, repeatCm, averageColor } = fabricArtwork(fabric);
  const window = fitRepeat ? Math.max(viewCm, repeatCm * 1.15) : viewCm;
  const tilePx = (repeatCm / window) * elementPx;

  if (tilePx < 6) {
    return {
      backgroundColor: averageColor,
      backgroundImage:
        "repeating-linear-gradient(45deg, rgba(0,0,0,0.05) 0 1px, transparent 1px 4px)",
    };
  }

  return {
    backgroundColor:
      fabric.source === "procedural" ? fabric.palette.base : fabric.color,
    backgroundImage: `url("${url}")`,
    backgroundSize: `${(repeatCm / window) * 100}% auto`,
    backgroundRepeat: "repeat",
  };
}
