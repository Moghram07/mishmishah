"use client";

import { forwardRef, useId, useRef, type PointerEventHandler } from "react";
import type {
  Fabric,
  GarmentPartId,
  GrainDirection,
  ProductKind,
  StitchId,
} from "@/types";
import {
  HARDWARE,
  PRODUCT_CANVAS,
  hardwareShape,
  productByKind,
  type HardwarePiece,
} from "@/lib/products/registry";
import { FabricRegion, beneathDefs, beneathMasks, useRenderedWidth } from "./FabricRegion";

/**
 * A home product — sofa, chair, pillow, curtain — as a stack of parts, each
 * with its own fabric.
 *
 * Clothing is drawn by `MannequinStage` instead: a garment hangs on a body, in
 * layers, and a curtain does not.
 */

const [CW, CH] = PRODUCT_CANVAS;
const PIVOT = [CW / 2, CH / 2] as const;

/**
 * How far something has to run on past an edge for the edge to be lying on
 * it — the stage's rule: an edge on cloth is drawn dark, an edge against the
 * page keeps the page's rim.
 */
const EDGE_REACH = 3;

/**
 * The hardware's wood, lit three ways: a leg down its length, a rod along it,
 * a finial's ball round. Mid-brown with a lit side, so a leg reads as turned
 * wood on a light page and still shows on a dark one.
 */
const WOOD: Record<HardwarePiece["light"], [number, string][]> = {
  side: [
    [0, "#4c3829"],
    [0.3, "#7b5c46"],
    [0.65, "#4a3628"],
    [1, "#2e2119"],
  ],
  top: [
    [0, "#82634d"],
    [0.4, "#5b4334"],
    [1, "#2b1f17"],
  ],
  round: [
    [0, "#8e6e57"],
    [0.55, "#523d2f"],
    [1, "#281d16"],
  ],
};

/** Where a close-up centres before it is dragged: the part being edited. */
function focusOf(kind: ProductKind, focusPart?: GarmentPartId): [number, number] {
  return productByKind(kind).parts.find((p) => p.id === focusPart)?.focus ?? [CW / 2, CH / 2];
}

/**
 * How far a drag of `dx, dy` screen pixels moves a product's close-up, in
 * canvas units — the picture follows the pointer — held to what keeps the
 * window on the canvas, so dragging past an edge never has to be undone.
 */
export function productPanBy(
  pan: readonly [number, number],
  dx: number,
  dy: number,
  zoom: number,
  renderedPx: number,
  kind: ProductKind,
  focusPart?: GarmentPartId
): [number, number] {
  if (renderedPx <= 0) return [pan[0], pan[1]];
  const span = CW / Math.max(1, zoom);
  const per = span / renderedPx;
  const [fx, fy] = focusOf(kind, focusPart);
  const hold = (v: number, f: number, size: number) => Math.min(size - span / 2 - f, Math.max(span / 2 - f, v));
  return [hold(pan[0] - dx * per, fx, CW), hold(pan[1] - dy * per, fy, CH)];
}

interface Props {
  kind: ProductKind;
  /** The fabric cut for each part. Parts without one fall back to `main`. */
  fabrics: Partial<Record<GarmentPartId, Fabric>>;
  /** Grain angle in degrees: 0 straight, 45 bias, 90 cross grain. */
  direction?: GrainDirection;
  /** Topstitch thread per part. */
  stitch?: Partial<Record<GarmentPartId, StitchId>>;
  /** Close-up magnification. 1 = whole product. */
  zoom?: number;
  /** Which part a close-up centres on. */
  focusPart?: GarmentPartId;
  /** How far the close-up has been dragged from there, in canvas units — see `productPanBy`. */
  pan?: readonly [number, number];
  onPointerDown?: PointerEventHandler<SVGSVGElement>;
  onPointerMove?: PointerEventHandler<SVGSVGElement>;
  onPointerUp?: PointerEventHandler<SVGSVGElement>;
  onPointerCancel?: PointerEventHandler<SVGSVGElement>;
  className?: string;
}

export const ProductTemplate = forwardRef<SVGSVGElement, Props>(
  function ProductTemplate(
    {
      kind,
      fabrics,
      direction = 0,
      stitch,
      zoom = 1,
      focusPart,
      pan = [0, 0],
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      className,
    },
    ref
  ) {
    const raw = useId().replace(/:/g, "");
    const uid = (name: string) => `${raw}-${name}`;
    const product = productByKind(kind);
    const hardware = HARDWARE[kind] ?? [];

    const localRef = useRef<SVGSVGElement | null>(null);
    const renderPx = useRenderedWidth(localRef);

    // A close-up frames a window of the canvas around the focused part, moved
    // by however far it has been dragged, and kept on the canvas.
    const span = CW / Math.max(1, zoom);
    const [fx, fy] = focusOf(kind, focusPart);
    const clamp = (v: number, size: number) => Math.min(size - span / 2, Math.max(span / 2, v));
    const viewBox = `${clamp(fx + pan[0], CW) - span / 2} ${clamp(fy + pan[1], CH) - span / 2} ${span} ${span}`;

    const drawn = product.parts.filter((part) => fabrics[part.id] ?? fabrics.main);
    /* everything an edge can lie on: the product's own pieces, and its hardware */
    const under = (
      <>
        {hardwareShape(kind, "#fff")}
        {drawn.map((part) => (
          <g key={part.id}>{part.shape("#fff")}</g>
        ))}
      </>
    );
    const beneath = beneathMasks(uid);

    return (
      <svg
        ref={(node) => {
          localRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        viewBox={viewBox}
        className={className}
        role="img"
        aria-label={`${kind} preview`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        // keeps the shading layers' `multiply` blending inside the drawing
        style={{ isolation: "isolate" }}
      >
        <defs>
          {beneathDefs(uid, PRODUCT_CANVAS, under, { reach: EDGE_REACH })}
          {(Object.keys(WOOD) as HardwarePiece["light"][]).map((light) =>
            light === "round" ? (
              <radialGradient key={light} id={uid(`wood-${light}`)} cx="0.36" cy="0.32" r="0.75">
                {WOOD[light].map(([o, c]) => (
                  <stop key={o} offset={o} stopColor={c} />
                ))}
              </radialGradient>
            ) : (
              <linearGradient
                key={light}
                id={uid(`wood-${light}`)}
                x1="0"
                y1="0"
                x2={light === "side" ? "1" : "0"}
                y2={light === "side" ? "0" : "1"}
              >
                {WOOD[light].map(([o, c]) => (
                  <stop key={o} offset={o} stopColor={c} />
                ))}
              </linearGradient>
            )
          )}
        </defs>

        {/* the hardware, behind the cloth: wood, with an outline in the page's text colour so it shows on any page */}
        {hardware.map((piece, i) => (
          <g key={i}>
            <path d={piece.d} fill={`url(#${uid(`wood-${piece.light}`)})`} />
            <path
              d={piece.d}
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.35"
              strokeWidth="0.9"
              strokeLinejoin="round"
            />
          </g>
        ))}

        {drawn.map((part) => {
          const fabric = (fabrics[part.id] ?? fabrics.main)!;
          return (
            <FabricRegion
              key={part.id}
              uidBase={`${raw}-${part.id}`}
              drawing={part}
              fabric={fabric}
              cmPerUnit={product.cmPerUnit}
              pxPerUnit={renderPx / span}
              direction={direction}
              pivot={PIVOT}
              canvas={PRODUCT_CANVAS}
              beneath={beneath}
              // Real pieces are topstitched; `hidden` is the deliberate choice.
              stitch={stitch?.[part.id] ?? "tonal"}
              zoom={zoom}
            />
          );
        })}
      </svg>
    );
  }
);
