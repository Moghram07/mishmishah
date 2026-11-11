"use client";

import { forwardRef, useId, useRef, type ReactNode } from "react";
import type React from "react";
import type { BodyZone, Fabric, FabricRegionId, Outfit } from "@/types";
import { BODY_CANVAS, bodyById } from "@/lib/mannequin/bodies";
import { frameFor, type Viewport } from "@/lib/mannequin/frame";
import { skinToneById } from "@/lib/data/skinTones";
import { profileFor } from "@/lib/mannequin/profile";
import { skinTint } from "@/lib/mannequin/skinTint";
import { collarArt, garmentArt, type GarmentArt, type GarmentChoice } from "@/lib/garments/art";
import {
  collarOf,
  coveredZones,
  frontOf,
  necklineOf,
  skirtOf,
  legOf,
  buttonsOf,
  beltOf,
  sleeveOf,
  stack,
  visibleStack,
  wornOn,
} from "@/lib/garments/outfit";
import { FabricRegion, beneathDefs, beneathMasks, useRenderedWidth, type BeneathMasks } from "./FabricRegion";
import { BaseLayer } from "./BaseLayer";
import { baseLayer } from "@/lib/garments/baseLayer";

/**
 * The dressed mannequin.
 *
 * Bottom to top: the cut-out photograph of the body, tinted to a skin tone;
 * then the worn garments in layer order, each region filled with its own fabric
 * at true print size. The body is an image and the garments are vector, which
 * is the whole point — a photograph is the only thing that looks like a body,
 * and only vector cloth can take a pattern at a real-world scale.
 *
 * It knows nothing about *which* body it is drawing. Everything about the
 * mannequin arrives as data from `lib/mannequin/bodies.ts`.
 */

interface Props {
  outfit: Outfit;
  /** The fabric each worn garment's regions are cut from, by garment id. */
  fabrics: Record<string, Partial<Record<FabricRegionId, Fabric>>>;
  /** Close-up magnification. 1 = the whole figure. */
  zoom?: number;
  /** What a close-up centres on. */
  focus?: readonly [x: number, y: number];
  /**
   * How far the viewer has dragged the close-up from that point, in canvas
   * units. Clamped in `frameFor`, so it can never take the figure off screen.
   */
  pan?: readonly [x: number, y: number];
  /**
   * The stage this is drawn into, when it fills one — see `mannequin/frame.ts`.
   * Without it the picture is the figure's own shape, as everywhere else.
   */
  viewport?: Viewport | null;
  className?: string;
  /** Pointer handlers, so the close-up can be dragged. */
  onPointerDown?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerMove?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerUp?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerCancel?: (e: React.PointerEvent<SVGSVGElement>) => void;
}

const CANVAS = [BODY_CANVAS.width, BODY_CANVAS.height] as const;
const PIVOT = [BODY_CANVAS.width / 2, BODY_CANVAS.height / 2] as const;


/**
 * How far something must run on past a cloth's edge for the edge to count as
 * lying on it. An edge is stroked two units wide, centred on the cloth's edge,
 * so half of it lies on the cloth; what lies under the other half has to reach
 * past it, or the edge is against the page.
 */
const EDGE_REACH = 3;

export const MannequinStage = forwardRef<SVGSVGElement, Props>(
  function MannequinStage(
    {
      outfit,
      fabrics,
      zoom = 1,
      focus,
      pan,
      viewport,
      className,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
    ref
  ) {
    const raw = useId().replace(/:/g, "");
    const uid = (name: string) => `${raw}-${name}`;

    const body = bodyById(outfit.bodyType);
    const [tr, tg, tb] = skinTint(
      skinToneById(outfit.skinTone).color,
      profileFor(outfit.bodyType).light
    );

    /*
      Nothing cut for another body gets past here, however stale the state.
      The filter has to come before *both* derivations, not just before the
      drawing: a garment's coverage erases zones of the figure it was cut for,
      so a dress that reached the male mannequin would erase his torso and
      thigh whether or not it was drawn — turning a wrong garment into a hole.
    */
    const worn = wornOn(outfit.worn, outfit.bodyType);
    const visible = visibleStack(worn);
    /*
      What the mannequin wears under everything, as far as what is worn leaves
      it showing — see `baseLayer`. Asked of everything worn, not only what is
      drawn: a top hidden under a layer over it is still on.
    */
    const base = baseLayer(outfit.bodyType, stack(worn).map(({ garment }) => garment.category));
    const covered = coveredZones(worn);
    const bare = (Object.keys(body.zones) as BodyZone[]).filter(
      (zone) => !covered.has(zone)
    );
    /** Bare zones that hang in front of the clothes rather than behind them. */
    const inFront = body.overlay.filter((zone) => !covered.has(zone));

    /*
      What each garment is worn inside: every garment after it in the stack
      that holds what is under it — a jacket. See `Encloses`: from the
      jacket's shoulders to its hem the garment shows only within the jacket,
      and is hidden outside it, except a sleeve's end below the jacket's cuff.
    */
    const holders = visible.flatMap(({ garment, worn: w }) => {
      const held = garmentArt(garment.asset.front)?.encloses;
      /* an abaya holds what is under it by its sleeve and its front: asked of them, as it is worn */
      const encloses = typeof held === "function" ? held({ sleeve: sleeveOf(w), front: frontOf(w) }) : held;
      return encloses ? [{ id: garment.id, encloses }] : [];
    });
    const insideOf = (index: number) =>
      holders.filter((h) => visible.findIndex((v) => v.garment.id === h.id) > index);

    /** Everything a worn garment is cut to — its neckline, collar opening, sleeves and skirt. */
    const choiceOf = (w: (typeof worn)[number]): GarmentChoice => {
      /* under a jacket, it comes out from under the jacket's hem no wider */
      const index = visible.findIndex((v) => v.worn === w);
      const inside = index >= 0 ? insideOf(index)[0]?.encloses.hem : undefined;
      /* a bottom under a top, and no jacket: it comes out from under the top's hem no wider — see `coverOf` */
      const over =
        !inside && index >= 0 && visible[index].garment.category === "bottom"
          ? visible.slice(index + 1).find((v) => garmentArt(v.garment.asset.front)?.cover)
          : undefined;
      const underTop = over ? garmentArt(over.garment.asset.front)!.cover!(choiceOf(over.worn)) : undefined;
      const skirt = skirtOf(w);
      const front = frontOf(w);
      const leg = legOf(w);
      const buttons = buttonsOf(w);
      const belt = beltOf(w);
      return {
        neckline: necklineOf(w)?.cut,
        opening: collarOf(w)?.opening,
        sleeve: sleeveOf(w),
        ...(skirt ? { skirt } : {}),
        ...(front ? { front } : {}),
        ...(leg ? { leg } : {}),
        ...(buttons ? { buttons } : {}),
        ...(belt ? { belt } : {}),
        ...(inside ? { inside } : {}),
        ...(underTop ? { underTop } : {}),
      };
    };

    /*
      The cloth lying over the arms. A forearm hangs in front of whatever is
      worn below it, so it is painted back over the clothes — but never over a
      sleeve, which lies over the arm. A sleeve ends wherever its length puts
      it, in the middle of an arm zone as often as not, and without this the
      bottom of every sleeve that reached the forearm was painted over.
    */
    const armCovers = visible.flatMap(({ garment, worn: w }) => {
      const art = garmentArt(garment.asset.front);
      return art?.armCover?.(choiceOf(w)) ?? [];
    });

    /** Each jacket a garment is worn inside, outermost last, as masks round what it draws. */
    const insideFor = (index: number) => (node: ReactNode) =>
      insideOf(index).reduce<ReactNode>(
        (inner, h) => <g mask={`url(#${uid(`inside-${h.id}`)})`}>{inner}</g>,
        node
      );

    /*
      Each worn garment's drawings, as they will be drawn — its regions cut to
      what it is worn with, and its collar's two halves. Asked once, for the
      drawing pass and for the masks that say what lies under every edge. Which
      drawing a region takes is explained at the drawing pass below.
    */
    const layers = visible.map(({ garment, worn: w }, index) => {
      const art = garmentArt(garment.asset.front);
      const collar = collarOf(w);
      const cutFor = (region: FabricRegionId) =>
        art?.cut?.(choiceOf(w))?.[region] ??
        (collar && art?.variants?.[collar.opening]?.[region]) ??
        art?.regions[region];
      /* a collar drawn to the cut it is sewn to, where its drawing follows the cut */
      const collarCut = (drawing: GarmentArt | undefined) => drawing?.cut?.(choiceOf(w))?.collar ?? drawing?.regions.collar;
      const front = collar ? collarCut(collarArt(collar.asset.front)) : undefined;
      const behind = collar?.asset.behindBody ? collarCut(collarArt(collar.asset.behindBody)) : undefined;
      /* its trim, when it has one on — a sailor collar's stripes, in their own cloth */
      const trim = collar ? collarArt(collar.asset.front)?.regions.trim : undefined;
      return { garment, index, cutFor, front, behind, trim };
    });

    /*
      Everything an edge can lie on: the figure, and every piece of cloth worn,
      each as it is drawn — inside a jacket, only where it shows. An edge with
      any of it under it is drawn dark and shades it; an edge with nothing
      under it but the page keeps its rim. See `FabricRegion`'s `beneath`.
    */
    /** Whether a garment wears cloth in a region: a region with no fabric is not drawn. */
    const clothed = (id: string, region: FabricRegionId) => Boolean(fabrics[id]?.[region]);
    const underAll = (
      <>
        <image href={body.view.front} x="0" y="0" width={CANVAS[0]} height={CANVAS[1]} filter={`url(#${uid("opaque")})`} />
        {layers.map(({ garment, index, cutFor, front, behind }) => (
          <g key={garment.id}>
            {behind && clothed(garment.id, "collar") && behind.shape("#fff")}
            {insideFor(index)(
              <>
                {garment.fabricRegions.map((region) => {
                  const drawing = cutFor(region);
                  return drawing && clothed(garment.id, region) ? (
                    <g key={region}>
                      {drawing.shape("#fff")}
                      {drawing.over?.shape("#fff")}
                    </g>
                  ) : null;
                })}
                {front && clothed(garment.id, "collar") && front.shape("#fff")}
              </>
            )}
          </g>
        ))}
      </>
    );
    const beneath: BeneathMasks = beneathMasks(uid);

    const localRef = useRef<SVGSVGElement | null>(null);
    const renderPx = useRenderedWidth(localRef);

    // A close-up frames a window of the canvas around whatever is being edited,
    // plus however far the viewer has dragged it. See `mannequin/frame.ts`.
    const frame = frameFor(zoom, focus, pan, viewport);

    /**
     * One region of one piece, filled with its cloth. Shared by the pass that
     * draws behind the photograph and the pass that draws in front of it, so
     * both halves of a collar band take the same fabric, grain and topstitch —
     * which is the only way the join can be invisible.
     */
    const cutRegion = (
      garmentId: string,
      worn: (typeof visible)[number]["worn"],
      region: FabricRegionId,
      drawing: Parameters<typeof FabricRegion>[0]["drawing"] | undefined,
      key: string,
      under: BeneathMasks | undefined = beneath
    ) => {
      const fabric = fabrics[garmentId]?.[region];
      if (!drawing || !fabric) return null;
      return (
        <FabricRegion
          beneath={under}
          key={key}
          uidBase={`${raw}-${key}`}
          drawing={drawing}
          fabric={fabric}
          cmPerUnit={BODY_CANVAS.cmPerUnit}
          pxPerUnit={renderPx / frame.w}
          direction={outfit.direction}
          pivot={PIVOT}
          canvas={CANVAS}
          // Real garments are topstitched; `hidden` is the choice.
          stitch={worn.stitch[region] ?? "tonal"}
          zoom={zoom}
        />
      );
    };

    return (
      <svg
        ref={(node) => {
          localRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        viewBox={frame.viewBox}
        className={className}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        role="img"
        aria-label={outfit.bodyType}
        // keeps the shading layers' `multiply` blending inside the drawing
        style={{ isolation: "isolate" }}
      >
        <defs>
          {/*
            Skin tone as a tint, not as ten photographs: one lookup table per
            channel over the photograph's own grey, so every shadow, highlight
            and soft edge is the photograph's in all ten tones — see
            `mannequin/skinTint.ts` for the curve and why it is not a multiply.
            `sRGB` interpolation is required: the curve is worked out on the
            photograph's stored values, and in the default linear space the
            same numbers wash the tone out.
          */}
          <filter id={uid("tint")} colorInterpolationFilters="sRGB">
            <feComponentTransfer>
              <feFuncR type="table" tableValues={tr.join(" ")} />
              <feFuncG type="table" tableValues={tg.join(" ")} />
              <feFuncB type="table" tableValues={tb.join(" ")} />
            </feComponentTransfer>
          </filter>

          {/*
            What of the body is still showing. Covered zones are cut away so no
            pale edge of mannequin survives around a garment — but a zone the
            garments left bare wins the argument, because zones overlap the way
            bodies do. An arm hanging over a hip stays an arm when the hip is in
            trousers.
          */}
          <mask
            id={uid("body")}
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width={CANVAS[0]}
            height={CANVAS[1]}
          >
            <rect
              x="0"
              y="0"
              width={CANVAS[0]}
              height={CANVAS[1]}
              fill="#fff"
            />
            {[...covered].map((zone) => (
              <path key={zone} d={body.zones[zone]} fill="#000" />
            ))}
            {bare.map((zone) => (
              <path key={zone} d={body.zones[zone]} fill="#fff" />
            ))}
          </mask>

          {/*
            What lies under the edges — see `underAll`: `under` itself, where a
            shadow may fall; `under-dark` the same shrunk by `EDGE_REACH`, which
            an edge lies inside only where something runs on past it; and
            `under-rim`, the rest, where an edge is against the page.
          */}
          <filter id={uid("opaque")} filterUnits="userSpaceOnUse" x="0" y="0" width={CANVAS[0]} height={CANVAS[1]}>
            <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0" />
          </filter>
          {beneathDefs(uid, CANVAS, underAll, { reach: EDGE_REACH, contact: 1.6 })}

          {inFront.length > 0 && (
            <mask
              id={uid("front")}
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width={CANVAS[0]}
              height={CANVAS[1]}
            >
              {inFront.map((zone) => (
                <path key={zone} d={body.zones[zone]} fill="#fff" />
              ))}
              {armCovers.map((d, i) => (
                <path key={`cover-${i}`} d={d} fill="#000" />
              ))}
            </mask>
          )}
          {/*
            The arm itself, from the photograph: the zones it hangs in front
            through hold all of it, and so reach a little past it, where a
            sleeve's shadow on it has nothing to fall on.
          */}
          {inFront.length > 0 && armCovers.length > 0 && (
            <mask
              id={uid("arm")}
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width={CANVAS[0]}
              height={CANVAS[1]}
            >
              <image href={body.view.front} x="0" y="0" width={CANVAS[0]} height={CANVAS[1]} filter={`url(#${uid("opaque")})`} />
            </mask>
          )}

          {/* inside a jacket: hidden from its shoulders to its hem, but within it */}
          {holders.map(({ id, encloses }) => (
            <mask
              key={id}
              id={uid(`inside-${id}`)}
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width={CANVAS[0]}
              height={CANVAS[1]}
            >
              <rect x="0" y="0" width={CANVAS[0]} height={CANVAS[1]} fill="#fff" />
              <rect
                x="0"
                y={encloses.band[0]}
                width={CANVAS[0]}
                height={encloses.band[1] - encloses.band[0]}
                fill="#000"
              />
              {[...encloses.envelope, ...encloses.windows].map((d, i) => (
                <path key={i} d={d} fill="#fff" />
              ))}
            </mask>
          ))}
        </defs>

        {/*
          The arc of a collar's band that passes *behind* the neck, drawn under
          the photograph so the body hides all but the sliver either side. A
          band that only ever appears in front of the throat reads as paint on
          skin; this is the half that makes it read as wrapped. Nothing else in
          the stage draws below the body, and nothing else should.
        */}
        {visible.map(({ garment, worn }) => {
          const collar = collarOf(worn);
          const behind = collar?.asset.behindBody
            ? collarArt(collar.asset.behindBody)
            : undefined;
          if (!behind) return null;
          return (
            <g key={`${garment.id}-behind`}>
              {cutRegion(
                garment.id,
                worn,
                "collar",
                behind.regions.collar,
                `${garment.id}-${collar!.id}-behind`,
                undefined
              )}
            </g>
          );
        })}

        <g mask={`url(#${uid("body")})`}>
          <image
            href={body.view.front}
            x="0"
            y="0"
            width={CANVAS[0]}
            height={CANVAS[1]}
            filter={`url(#${uid("tint")})`}
          />
        </g>

        {/*
          The base layer, under every garment: her tank and shorts, his
          shorts, as far as what is worn leaves them showing. Inside a jacket
          as any inner layer is, so with no top under it the tank shows only
          in the jacket's opening.
        */}
        {base.length > 0 && insideFor(-1)(<BaseLayer pieces={base} uid={uid} beneath={beneath} canvas={CANVAS} />)}

        {visible.map(({ garment, worn }, index) => {
          const art = garmentArt(garment.asset.front);
          if (!art) return null;
          /* each jacket it is worn inside, outermost last */
          const inside = insideFor(index);
          // Only ever a collar this garment can actually be sewn one of.
          const collar = collarOf(worn);
          const collarDrawing = collar
            ? collarArt(collar.asset.front)
            : undefined;
          const cut = (
            region: FabricRegionId,
            drawing: (typeof art)["regions"][FabricRegionId],
            key: string
          ) => cutRegion(garment.id, worn, region, drawing, key);
          /*
            The collar names the opening it needs and the garment cuts it. A
            standing band is sewn at the base of the neck; hang one from a crew
            neck thirty units lower and it stands on the chest, which is what
            every collar here used to do. Falling back to the default cut means
            a garment that offers no such variant simply keeps its own.
          */
          /*
            Two different questions, in the order they have to be asked.

            A **neckline** is the wearer's choice of cut and owns the whole
            top of the garment, so it wins. A **variant** is the older, smaller
            mechanism underneath it: a garment keeping a second copy of a region
            for whichever opening a collar happens to need. Garments that take
            necklines do not use variants at all — the cut already decides what
            opening there is, which is what stops the picker from lying about
            what you are looking at.
          */
          const { cutFor, front: collarFront, trim: collarTrim } = layers[index];
          return (
            <g key={garment.id}>
              {inside(
              <>
              {garment.fabricRegions.map((region) =>
                cut(region, cutFor(region), `${garment.id}-${region}`)
              )}
              {/* cloth of a region that lies over the garment's later ones — a wrap's tie over its skirt */}
              {garment.fabricRegions.map((region) => {
                const over = cutFor(region)?.over;
                return over ? cut(region, over, `${garment.id}-${region}-over`) : null;
              })}
              {/* the garment's own hardware as cut — a placket's buttons — under the collar */}
              {art.cutTrim?.(choiceOf(worn))}
              {/* the collar is sewn on top of the neckline it closes */}
              {collarDrawing &&
                cut(
                  "collar",
                  collarFront,
                  `${garment.id}-${collar!.id}`
                )}
              {/* its trim, sewn on it — drawn only with a cloth of its own, which it has only when it is on */}
              {collarTrim && cut("trim", collarTrim, `${garment.id}-${collar!.id}-trim`)}
              {/* a band collar's placket buttons from just under the band; otherwise the opening's, or the garment's own */}
              {(collar?.build.fall === "none" ? art.bandTrim : undefined) ??
                (collar && art.openingTrim?.[collar.opening]) ??
                art.trim}
              {art.cuffTrim?.(choiceOf(worn))}
              {collarDrawing?.trim}
              {collarDrawing?.bandButtons?.(art.collarButtons ?? 1)}
              </>
              )}
            </g>
          );
        })}

        {/*
          A bare arm hangs in front of the skirt it is standing next to, so the
          photograph is drawn a second time through the zones nothing covered.
          Skip it entirely when every such zone is under a sleeve.
        */}
        {inFront.length > 0 && (
          <g mask={`url(#${uid("front")})`}>
            <image
              href={body.view.front}
              x="0"
              y="0"
              width={CANVAS[0]}
              height={CANVAS[1]}
              filter={`url(#${uid("tint")})`}
            />
          </g>
        )}
        {/*
          ...and the shadow each sleeve's end throws on it. The arm painted back
          over the clothes covers the one the sleeve drew on the skin beneath,
          so it is drawn again here, on that arm only.
        */}
        {inFront.length > 0 && armCovers.length > 0 && (
          <g mask={`url(#${uid("front")})`} style={{ mixBlendMode: "multiply" }}>
            <g mask={`url(#${uid("arm")})`}>
              <g
                filter={`url(#${uid("contact")})`}
                fill="none"
                stroke="#5c4a3e"
                strokeOpacity={0.5}
                strokeWidth={3.2}
                strokeLinejoin="round"
              >
                {armCovers.map((d, i) => (
                  <path key={i} d={d} />
                ))}
              </g>
            </g>
          </g>
        )}
      </svg>
    );
  }
);
