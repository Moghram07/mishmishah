"use client";

import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import type { Fabric, FabricRegionId, GrainDirection, StitchId } from "@/types";
import { fabricRepeatCm, useFabricArtwork } from "@/lib/fabrics/artwork";
import { fabricSurface, surfaceArtwork } from "@/lib/fabrics/patterns";
import { printKeep } from "@/lib/fabrics/printScale";
import { sheenOf, sheenTint } from "@/lib/fabrics/sheen";
import { stitchById } from "@/lib/data/stitches";
import { FLAT_LIT, clothSurface, clothWarp, type Uid } from "@/lib/garments/shading";
import { SheenContext, formSheen, sheenDefs, type Sheen } from "@/lib/garments/sheen";

/**
 * One area of cloth, at its true print size.
 *
 * Bottom to top: the fabric fill (an SVG `<pattern>` whose tile size comes from
 * the motif's real repeat, never chosen by hand) and over it, in `soft-light`,
 * the cloth's surface (its own tile, at its own true size — see `SURFACES`),
 * then a fixed greyscale shading layer composited with `multiply`, then the
 * light, screened — and on a cloth with a sheen its highlights, screened too
 * (see `garments/sheen.tsx`) — then the topstitch. The shading and the light
 * belong to the piece, not to the fabric, so swapping cloth never disturbs how
 * the piece is lit; only how much of the light a smooth cloth throws back.
 *
 * Both engines draw through this: a garment region on the mannequin and a
 * cushion on a sofa are the same problem.
 */

/** Anything drawable in a fabric: an outline, its light, and its stitching. */
export interface RegionDrawing {
  /** Geometry filled with this region's fabric. `fill` is a `url(#…)` pattern. */
  shape: (fill: string) => ReactNode;
  /** Gradients the shading needs. Ids must be namespaced through `uid`. */
  defs?: (uid: Uid) => ReactNode;
  /**
   * Fixed greyscale shading, painted over the fabric with `multiply`.
   *
   * Optional, because `surface` took over describing form. What is left here is
   * only what an outline cannot know it has: a hem's weight, the shadow a
   * collar's fall throws on its own stand, a cut edge. Several pieces now have
   * none of that and draw no shading at all.
   */
  shading?: (uid: Uid) => ReactNode;
  /**
   * Light the cloth catches, painted over it with `screen` and clipped to the
   * region, after the shading. Like the shading it never changes with the
   * fabric, and it can only lighten: the lit crest of a fold — see `folds.tsx`.
   */
  light?: (uid: Uid) => ReactNode;
  /**
   * The shadow this piece throws onto whatever lies beneath it.
   *
   * Drawn *before* the cloth and deliberately outside the region mask, because
   * a contact shadow belongs to the garment underneath rather than to the piece
   * casting it. Everything else here is clipped to the region; this is the one
   * layer that must not be.
   */
  cast?: (uid: Uid) => ReactNode;
  /**
   * How this piece is cut relative to the outfit's grain: a turn in degrees,
   * and an offset along it in canvas units.
   *
   * Without it every region shares one pattern lattice, and a stripe runs
   * unbroken from a shirt body straight through the collar sewn onto it — which
   * is the strongest possible signal that the collar is printed on rather than
   * sewn on. Real pieces are cut from different parts of the cloth, and a band
   * is cut across the grain on purpose.
   */
  grain?: { turn?: number; shift?: readonly [number, number] };
  /**
   * Form shading built from this piece's own outline — see `clothSurface`.
   * Replaces the bounding-box gradients, which could not describe a surface.
   *
   * `joined` lights every piece of the region as one surface instead of each
   * on its own. That is what a robe needs: its sleeves are sewn on, but the
   * cloth runs on over the seam, and lit piece by piece every armhole reads as
   * the edge of a cushion. Below the underarm a sleeve hangs clear of the body,
   * so it still turns as its own tube there.
   *
   * `ridges` are folds the weave is bent along — see `clothWarp` — and
   * `gathers` fine folds close together, which it bends along each.
   */
  surface?: { blur?: number; relief?: number; warp?: number; joined?: boolean; ridges?: string; gathers?: string };
  /**
   * The outline drawn round each piece, when it is not the whole outline: one
   * element per piece, in the order `shape` draws them, each an open line along
   * the edges that are free. A seam is not an edge — see `SleeveCut.seamed`.
   */
  edge?: () => ReactNode;
  /** Dashed topstitch route along this region's seams. */
  stitch?: string;
  /**
   * Cloth drawn before this region that hangs in front of it — a dress's
   * sleeves, beside a skirt hung from above her waist. The region is drawn
   * everywhere but under it, and takes the soft shadow its edges throw, as
   * cloth does wherever an edge lies on it.
   */
  under?: string[];
  /**
   * A piece that never takes the fabric — a leather belt — filled with this
   * colour instead. Lit, shaded and edged as any piece is.
   */
  solid?: string;
  /**
   * `"soft"`: no line round the piece anywhere — neither the rim against the
   * page nor the dark edge on what it lies on — only the soft shadow its edge
   * throws on whatever is under it, about as strong as a seam's fold. A
   * collar's: cut from the same cloth as what it is sewn to, its edge is cloth
   * lying on cloth, and an outline drawn round it read as a dark ring.
   */
  outline?: "soft";
  /**
   * Pieces drawn as a `"soft"` outline draws a whole region, by their index in
   * `shape` — a placket lying on its own bodice. No line round them, the
   * lighter shadow under their edge, and no form of their own: lit flat in the
   * garment's light, as a collar is — see `FLAT_LIT` — so a strip of the same
   * cloth reads as the same colour as what it lies on.
   */
  softPieces?: readonly number[];
  /**
   * The soft shadow under this region's edges, where it should differ from
   * what its outline gives — `CONTACT`, or `SOFT_CONTACT` for a soft one. A
   * Peter Pan's is stronger: two layers of cloth lying flat on a busy print,
   * whose only edge is that shadow, and at the soft outline's own strength the
   * collar all but disappeared into the print at whole-figure size.
   */
  shadow?: Partial<ContactShadow>;
  /**
   * Stripes of a second cloth sewn flat on this one — braid along a collar's
   * edge, round a sleeve's or a skirt's hem — each with the index of the
   * piece it lies on. Drawn in `inlayFabric` just after that piece's cloth
   * and before its form, the region's shading and its light, so the folds and
   * the form of the cloth under them fall across them too: a braid sewn on a
   * pleated skirt pleats with it.
   */
  inlay?: readonly { piece: number; d: string; cloth?: "trim" | "cuff"; whole?: true }[];
  /**
   * The region whose cloth this drawing is cut from, where it is not the one
   * it is drawn for — a belt drawn with the skirt it lies over is cut from
   * the belt's. The stage reads it; see `MannequinStage`.
   */
  cloth?: FabricRegionId;
}

/** The soft shadow a cloth edge throws on what it lies on: a warm line, blurred. */
interface ContactShadow {
  color: string;
  width: number;
  opacity: number;
  /** Its blur, as a standard deviation in canvas units. */
  soft: number;
}

interface Props {
  /** Namespace for this region's SVG ids — they are global to the document. */
  uidBase: string;
  drawing: RegionDrawing;
  fabric: Fabric;
  /** Real-world centimetres represented by one SVG unit in this canvas. */
  cmPerUnit: number;
  /** Screen pixels per SVG unit — how sharp the print is drawn, never how big. */
  pxPerUnit: number;
  /** Grain angle in degrees: 0 straight, 45 bias, 90 cross grain. */
  direction: GrainDirection;
  /**
   * The point the pattern lattice pivots around when the grain angle changes.
   *
   * A rotation is applied about a point, and everything at a distance from that
   * point also *translates*. Pivoting at the user-space origin swings the
   * lattice out from under a piece drawn elsewhere: a 12° change slid the motif
   * most of a tile sideways. Pivoting at the centre of the canvas keeps the
   * pattern turning in place beneath the piece, which is what a tailor rotating
   * a pattern piece on cloth actually sees.
   */
  pivot: readonly [x: number, y: number];
  /** The canvas box the mask covers. */
  canvas: readonly [width: number, height: number];
  stitch: StitchId;
  /** The cloth of the drawing's `inlay` — its stripes. Without it, none are drawn. */
  inlayFabric?: Fabric;
  /**
   * The cloth of the parts laid whole over pieces of it — `Inlaid.whole`: a
   * cuff's. Laid only where it is not the region's own cloth, so a part in
   * the same cloth draws exactly as the region did before it had one.
   */
  partFabrics?: Partial<Record<"cuff", Fabric>>;
  /**
   * How far the view is zoomed in: 1 is the whole figure, or the whole
   * product. The tonal thread shows only in a close-up — see `TONAL_THREAD`.
   */
  zoom?: number;
  /**
   * What lies under the cloth's edges, as mask ids — see `MannequinStage`.
   * With it, an edge lying on anything — skin, or another piece of cloth — is
   * drawn dark in either theme and throws a soft shadow onto what it lies on;
   * an edge with nothing under it but the page keeps its rim in the page's
   * text colour. Without it, every edge takes the rim.
   */
  beneath?: BeneathMasks;
}

/**
 * Mask ids: where anything lies under the cloth, for its shadow; where an edge
 * lies on something, to draw it dark; and the rest, the page, for the rim.
 */
export interface BeneathMasks {
  shade: string;
  dark: string;
  rim: string;
}

/** The ids `beneathDefs` gives its masks, in a drawing namespaced by `uid`. */
export const beneathMasks = (uid: (name: string) => string): BeneathMasks => ({
  shade: uid("under"),
  dark: uid("under-dark"),
  rim: uid("under-rim"),
});

/**
 * The masks a `beneath` names, built from everything that lies under the
 * edges — the figure and the cloth on it, or a product's own pieces:
 * `under` itself, where a shadow may fall; `under-dark` the same shrunk by
 * `reach`, which an edge lies inside only where something runs on past it;
 * and `under-rim`, the rest, where an edge is against the page. `contact`
 * adds the drawing's own soft-shadow blur among them.
 */
export function beneathDefs(
  uid: (name: string) => string,
  canvas: readonly [number, number],
  under: ReactNode,
  { reach, contact }: { reach: number; contact?: number }
) {
  return (
    <>
      <filter id={uid("shrunk")} filterUnits="userSpaceOnUse" x="0" y="0" width={canvas[0]} height={canvas[1]}>
        <feMorphology operator="erode" radius={reach} />
      </filter>
      <filter id={uid("shrunk-dark")} filterUnits="userSpaceOnUse" x="0" y="0" width={canvas[0]} height={canvas[1]}>
        <feMorphology operator="erode" radius={reach} />
        <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" />
      </filter>
      {contact !== undefined && (
        <filter id={uid("contact")} filterUnits="userSpaceOnUse" x="0" y="0" width={canvas[0]} height={canvas[1]}>
          <feGaussianBlur stdDeviation={contact} />
        </filter>
      )}
      <mask id={uid("under")} maskUnits="userSpaceOnUse" x="0" y="0" width={canvas[0]} height={canvas[1]}>
        {under}
      </mask>
      <mask id={uid("under-dark")} maskUnits="userSpaceOnUse" x="0" y="0" width={canvas[0]} height={canvas[1]}>
        <g filter={`url(#${uid("shrunk")})`}>{under}</g>
      </mask>
      <mask id={uid("under-rim")} maskUnits="userSpaceOnUse" x="0" y="0" width={canvas[0]} height={canvas[1]}>
        <rect x="0" y="0" width={canvas[0]} height={canvas[1]} fill="#fff" />
        <g filter={`url(#${uid("shrunk-dark")})`}>{under}</g>
      </mask>
    </>
  );
}

/**
 * The colour of an edge lying on something: the light theme's text colour,
 * kept in the dark theme too. Stroked in the page's own text colour, which is
 * cream on a dark page, every neckline, sleeve hem and strapless top was a
 * pale ring between the cloth and the skin, and a shirt's hem on its trousers
 * a white stripe.
 */
const EDGE_DARK = "#241e19";

/**
 * The shadow a cloth edge throws on what it lies on: cloth has a thickness and
 * stands a little off whatever is under it at its edge. A thin warm line,
 * blurred — as close to nothing as still reads as the cloth lying there.
 */
const CONTACT: ContactShadow = { color: "#5c4a3e", width: 3.2, opacity: 0.5, soft: 1.6 };

/**
 * The same shadow under a piece drawn with a `"soft"` outline: lighter and a
 * little wider, a soft step in the cloth's own colour rather than a line.
 */
const SOFT_CONTACT: ContactShadow = { color: "#5c4a3e", width: 3.2, opacity: 0.3, soft: 2 };

/**
 * Topstitch in thread the colour of the cloth — "tonal", every garment's
 * default. Not a colour laid on the cloth but the cloth itself a little
 * darker where the thread sinks into it, so on a print it is the print's own
 * colours, motif by motif: there in a close-up, gone at whole-figure size.
 *
 * It used to be the fabric's accent colour at over half strength, and on a
 * print that is the motif's colour — orange dashes round every neckline and
 * down every placket of a navy floral, plain to see from across the room.
 *
 * And seen only close up: `seen` is the zoom over which it fades in, from
 * none to `darken`. A thread is far too fine to see from where the whole
 * figure is in view, and drawn at any strength there it read as a dotted line
 * round every sleeve hem, hem and placket even at 2×. Up to 2.5× it is not
 * drawn at all, and from 4× it is at full strength.
 *
 * The zoom rather than the pixels a unit gets on screen, though the eye goes
 * by the second: a phone's stage is 0.24 px a unit at 1× against a desktop's
 * 0.6, so a thread faded by its pixels never showed on a phone even at 8×. A
 * close-up is a close-up on either.
 */
const TONAL_THREAD = { width: 0.7, darken: 0.22, dash: "2.6 2.2", seen: [2.5, 4] } as const;

/** How much of the tonal thread shows at this zoom: 0 to 1 — see `TONAL_THREAD.seen`. */
export const threadSeen = (zoom: number) => {
  const [from, to] = TONAL_THREAD.seen;
  const t = Math.min(1, Math.max(0, (zoom - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

/**
 * Apply a filter to each piece of a region separately, rather than once to the
 * group.
 *
 * This is the difference between a blouse and a cape. `clothSurface` lights a
 * shape by blurring its own alpha into a height field, and a filter on a group
 * sees the *union* of what is inside it: body and both sleeves merged into one
 * silhouette, lit as one smooth slab, with no arm in it anywhere. Filtering
 * piece by piece gives the body a body's form and each sleeve its own tube, and
 * the seam between them appears because two surfaces meet there.
 *
 * A region that draws one path is unaffected — one child in, one group out.
 */
/**
 * The separate pieces a region draws, with any fragments opened.
 *
 * `Children.toArray` does not look inside a fragment, and nearly every
 * `shape` returns one — so a region of five pieces arrived here as one, and
 * everything this file does "per piece" was being done to the union.
 */
function piecesOf(node: ReactNode): ReactNode[] {
  return Children.toArray(node).flatMap((child) =>
    isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment
      ? piecesOf(child.props.children)
      : [child]
  );
}

export function FabricRegion({
  uidBase,
  drawing,
  fabric,
  cmPerUnit,
  pxPerUnit,
  direction,
  pivot,
  canvas,
  stitch,
  beneath,
  zoom = 1,
  inlayFabric,
  partFabrics,
}: Props) {
  const uid = (name: string) => `${uidBase}-${name}`;

  // The line that makes scale honest: a repeat that is `repeatCm` wide in the
  // real world occupies exactly that many centimetres of the piece — at every
  // zoom, on every screen. Only its sharpness follows its size on screen: a
  // repeat a few pixels across is drawn softened rather than sharp and beating
  // against the pixel grid. See `printScale.ts`.
  const tile = fabricRepeatCm(fabric) / cmPerUnit;
  const artwork = useFabricArtwork(fabric, printKeep(tile * pxPerUnit));
  /* the stripes' own cloth, at its own true size — asked for always, as a hook must be */
  const inlayTile = fabricRepeatCm(inlayFabric ?? fabric) / cmPerUnit;
  const inlayArt = useFabricArtwork(inlayFabric ?? fabric, printKeep(inlayTile * pxPerUnit));
  const inlay = inlayFabric ? (drawing.inlay ?? []).filter((s) => (s.cloth ?? "trim") === "trim") : [];
  const inlayOn = (i: number) => inlay.filter((s) => s.piece === i);
  /* a part in a cloth of its own, laid whole over its piece — only where that cloth is not the region's — at its own true size */
  const cuffFabric = partFabrics?.cuff && partFabrics.cuff.id !== fabric.id ? partFabrics.cuff : undefined;
  const cuffTile = fabricRepeatCm(cuffFabric ?? fabric) / cmPerUnit;
  const cuffArt = useFabricArtwork(cuffFabric ?? fabric, printKeep(cuffTile * pxPerUnit));
  const whole = cuffFabric ? (drawing.inlay ?? []).filter((s) => s.cloth === "cuff" && s.whole) : [];
  const wholeOn = (i: number) => whole.filter((s) => s.piece === i);

  /* a thread picked to show keeps its own colour; the tonal one is the cloth's — see `TONAL_THREAD` */
  const thread = stitchById(stitch);
  const tonal = stitch === "tonal";
  /* the tonal thread fades in with the close-up — see `TONAL_THREAD` */
  const seen = tonal ? threadSeen(zoom) : 1;
  const threadColor = stitch === "hidden" || seen === 0 ? null : tonal ? "#000000" : thread.color;

  /*
    The cloth's surface — a denim's streaks, a knit's columns, a wool's
    flecks — at its own true size, faded in as far as the screen can show its
    detail, and not at all once it cannot (see `surfaceArtwork`). Never on a
    piece not cut from the fabric.
  */
  const surface = drawing.solid ? undefined : fabricSurface(fabric);
  const surfaceArt = surface ? surfaceArtwork(surface, printKeep((surface.detailCm / cmPerUnit) * pxPerUnit)) : undefined;
  const surfaceTile = surfaceArt ? surfaceArt.repeatCm / cmPerUnit : 0;

  /* a smooth cloth's sheen — see `garments/sheen.tsx`; none on a matte one, nor on a piece not cut from the fabric */
  const look = drawing.solid ? undefined : sheenOf(fabric);
  const sheen: Sheen | null = look
    ? { look, turn: direction + (drawing.grain?.turn ?? 0), pivot, tint: sheenTint(fabric) }
    : null;

  const fill = drawing.solid ?? `url(#${uid("pattern")})`;
  /*
    The outfit's grain, plus however this particular piece is cut from it. The
    turn is applied about the canvas pivot as before; the shift comes after, so
    it slides the lattice *along the turned grain* — a piece cut further down
    the roll, which is what breaks the pattern at a seam.
  */
  const [slideX, slideY] = drawing.grain?.shift ?? [0, 0];
  const spin =
    `rotate(${direction + (drawing.grain?.turn ?? 0)} ${pivot[0]} ${pivot[1]}) ` +
    `translate(${slideX} ${slideY})`;

  /* One list per pass, index for index: the same pieces, filled, edged and lit. */
  const cloth = piecesOf(drawing.shape(fill));
  /* each piece again in its surface, laid over it in `soft-light` */
  const surfaced = surfaceArt ? piecesOf(drawing.shape(`url(#${uid("surface-pattern")})`)) : [];
  const edges = piecesOf(drawing.edge?.() ?? drawing.shape("none"));
  const joined = Boolean(drawing.surface?.joined);
  const forms = drawing.surface && !joined ? piecesOf(drawing.shape("#fff")) : [];

  /*
    The cloth hanging in front of this region, if any: everything drawn here
    stays out from under it. Masked inside each layer, never round the whole
    region — a mask round a group isolates it, and the form and shadows it
    multiplies would then paint as colour, a pale halo along every edge,
    rather than darken what lies under them.
  */
  const over = drawing.under?.length ? drawing.under : null;
  /* a soft outline: no line round the piece, and a lighter shadow under its edge */
  const soft = drawing.outline === "soft";
  const contact = drawing.shadow ? { ...(soft ? SOFT_CONTACT : CONTACT), ...drawing.shadow } : soft ? SOFT_CONTACT : CONTACT;
  /* a piece of a region drawn soft on its own — see `softPieces` */
  const softPieces = soft ? [] : drawing.softPieces ?? [];
  const softAt = (i: number) => soft || softPieces.includes(i);
  const flat = softPieces.length && forms.length ? piecesOf(drawing.shape(FLAT_LIT)) : [];
  const behind = (node: ReactNode) => (over ? <g mask={`url(#${uid("behind")})`}>{node}</g> : node);

  return (
    <>
      <defs>
        {/* one repeat a tile, at its true size: softened in its own drawing when small, never enlarged */}
        <pattern
          id={uid("pattern")}
          patternUnits="userSpaceOnUse"
          width={tile}
          height={tile}
          patternTransform={spin}
        >
          <image
            href={artwork.url}
            x="0"
            y="0"
            width={tile}
            height={tile}
            preserveAspectRatio="xMidYMid slice"
          />
          {artwork.veil > 0 && (
            <rect width={tile} height={tile} fill={artwork.averageColor} opacity={artwork.veil} />
          )}
        </pattern>
        {/* the surface: its own tile at its own true size, turned and slid with the grain as the print is */}
        {surfaceArt && (
          <pattern
            id={uid("surface-pattern")}
            patternUnits="userSpaceOnUse"
            width={surfaceTile}
            height={surfaceTile}
            patternTransform={spin}
          >
            <image
              href={surfaceArt.url}
              x="0"
              y="0"
              width={surfaceTile}
              height={surfaceTile}
              preserveAspectRatio="xMidYMid slice"
            />
          </pattern>
        )}
        {sheen && sheenDefs(uid, sheen, drawing.surface?.blur ?? 10)}
        {whole.length > 0 && (
          <pattern
            id={uid("cuff-pattern")}
            patternUnits="userSpaceOnUse"
            width={cuffTile}
            height={cuffTile}
            patternTransform={spin}
          >
            <image
              href={cuffArt.url}
              x="0"
              y="0"
              width={cuffTile}
              height={cuffTile}
              preserveAspectRatio="xMidYMid slice"
            />
            {cuffArt.veil > 0 && (
              <rect width={cuffTile} height={cuffTile} fill={cuffArt.averageColor} opacity={cuffArt.veil} />
            )}
          </pattern>
        )}
        {inlay.length > 0 && (
          <pattern
            id={uid("inlay-pattern")}
            patternUnits="userSpaceOnUse"
            width={inlayTile}
            height={inlayTile}
            patternTransform={spin}
          >
            <image
              href={inlayArt.url}
              x="0"
              y="0"
              width={inlayTile}
              height={inlayTile}
              preserveAspectRatio="xMidYMid slice"
            />
            {inlayArt.veil > 0 && (
              <rect width={inlayTile} height={inlayTile} fill={inlayArt.averageColor} opacity={inlayArt.veil} />
            )}
          </pattern>
        )}
        {/*
          A <mask>, not a <clipPath>: regions are free to be groups of shapes
          (a sofa is six rects, a collar is two leaves), and only masks accept
          a <g>.
        */}
        <mask
          id={uid("mask")}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width={canvas[0]}
          height={canvas[1]}
        >
          {drawing.shape("#fff")}
        </mask>
        {drawing.defs?.(uid)}
        {drawing.surface && clothSurface(uid("surface"), drawing.surface)}
        {drawing.surface?.warp !== undefined &&
          clothWarp(uid("warp"), {
            blur: drawing.surface.blur,
            scale: drawing.surface.warp,
            ridges: drawing.surface.ridges,
            gathers: drawing.surface.gathers,
            canvas,
          })}
        {(beneath || over) && (
          /* over the whole canvas: a thin level line has no height for a filter box to be a share of */
          <filter
            id={uid("contact")}
            filterUnits="userSpaceOnUse"
            x="0"
            y="0"
            width={canvas[0]}
            height={canvas[1]}
          >
            <feGaussianBlur stdDeviation={contact.soft} />
          </filter>
        )}
        {beneath && softPieces.length > 0 && (
          <filter
            id={uid("contact-soft")}
            filterUnits="userSpaceOnUse"
            x="0"
            y="0"
            width={canvas[0]}
            height={canvas[1]}
          >
            <feGaussianBlur stdDeviation={SOFT_CONTACT.soft} />
          </filter>
        )}
        {over && (
          <mask id={uid("behind")} maskUnits="userSpaceOnUse" x="0" y="0" width={canvas[0]} height={canvas[1]}>
            <rect x="0" y="0" width={canvas[0]} height={canvas[1]} fill="#fff" />
            {over.map((d, i) => (
              <path key={i} d={d} fill="#000" />
            ))}
          </mask>
        )}
      </defs>

      {/*
        What this piece throws onto the cloth below it. Unmasked, and first:
        it is a shadow *on the garment*, not a shadow on the collar.
      */}
      {drawing.cast && (
        <g style={{ mixBlendMode: "multiply" }}>{behind(drawing.cast(uid))}</g>
      )}


      {/*
        The cloth. Warped, when the piece asks for it, by the slope of its own
        surface — so the weave foreshortens where the form turns away instead of
        lying flat across it. The outline is stroked outside the filter, or the
        displacement drags the edge off the shape.
      */}
      {/*
        Each piece whole — cloth, outline, form — before the next piece starts.

        They used to be three passes over every piece: all the cloth, then all
        the outlines, then all the form. So nothing a region drew later could
        hide an earlier piece's edge. A shirt collar's stand runs under its
        leaves, and its outline and its shading were painted over the leaves
        anyway: the whole oval of the band showed through the collar, a ring
        drawn in front of the neck. Piece by piece, a piece drawn later covers
        what it lies on, edges included.

        Within a piece the order is unchanged. The cloth is warped by the slope
        of its own surface; the outline is stroked outside that filter, or the
        displacement drags the edge off the shape; and the form — the piece's
        silhouette blurred into a height field and lit — is multiplied over the
        cloth, never changing when the fabric does. Lit per piece, a body and
        its sleeves each get their own form, and the seam between them shows
        because two surfaces meet there.
      */}
      {cloth.map((piece, i) => {
        /* one piece of a region drawn soft: its own shadow, no line, lit flat — see `softPieces` */
        const alone = !soft && softPieces.includes(i);
        const shadow = alone ? SOFT_CONTACT : contact;
        return (
        <g key={i}>
          {/*
            The soft shadow the piece's edge throws on whatever it lies on — skin,
            another garment, or a piece of this region drawn before it, as a
            placket lies on its bodice. Drawn just before the piece, which covers
            the half of it on its own side; masked to what lies beneath, so it
            never falls on the page.
          */}
          {beneath && (
            <g mask={`url(#${beneath.shade})`} style={{ mixBlendMode: "multiply" }}>
              {behind(
                <g
                  filter={`url(#${uid(alone ? "contact-soft" : "contact")})`}
                  fill="none"
                  stroke={shadow.color}
                  strokeOpacity={shadow.opacity}
                  strokeWidth={shadow.width}
                  strokeLinejoin="round"
                >
                  {edges[i]}
                </g>
              )}
            </g>
          )}
          {behind(
            <g
              filter={
                drawing.surface?.warp !== undefined ? `url(#${uid("warp")})` : undefined
              }
              /* isolated, so the surface blends with this piece's cloth and nothing under it */
              style={surfaced[i] ? { isolation: "isolate" } : undefined}
            >
              {piece}
              {/* the cloth's surface over it, warped with it — mid-grey leaves the cloth as it is */}
              {surfaced[i] && (
                <g style={{ mixBlendMode: "soft-light" }} opacity={surfaceArt!.opacity < 1 ? surfaceArt!.opacity : undefined}>
                  {surfaced[i]}
                </g>
              )}
            </g>
          )}
          {/* the piece in a part's own cloth, laid over it exactly — warped as it is, so its edge is the piece's */}
          {wholeOn(i).length > 0 &&
            behind(
              <g
                filter={drawing.surface?.warp !== undefined ? `url(#${uid("warp")})` : undefined}
                fill={`url(#${uid("cuff-pattern")})`}
              >
                {wholeOn(i).map((st, k) => (
                  <path key={k} d={st.d} />
                ))}
              </g>
            )}
          {/* the stripes sewn on this piece, before its form: they take its light — see `inlay` */}
          {inlayOn(i).length > 0 &&
            behind(
              <g fill={`url(#${uid("inlay-pattern")})`}>
                {inlayOn(i).map((st, k) => (
                  <path key={k} d={st.d} />
                ))}
              </g>
            )}
          {/* against the page, the rim in the page's text colour; on anything else, dark in either theme */}
          {!softAt(i) && behind(
            <g
              mask={beneath ? `url(#${beneath.rim})` : undefined}
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.18"
              strokeWidth="2"
              strokeLinejoin="round"
            >
              {edges[i]}
            </g>
          )}
          {beneath && !softAt(i) &&
            behind(
              <g
                mask={`url(#${beneath.dark})`}
                fill="none"
                stroke={EDGE_DARK}
                strokeOpacity="0.18"
                strokeWidth="2"
                strokeLinejoin="round"
              >
                {edges[i]}
              </g>
            )}
          {forms[i] && !alone && (
            <g style={{ mixBlendMode: "multiply" }}>
              {behind(
                <g filter={`url(#${uid("surface")})`}>
                  {forms[i]}
                </g>
              )}
            </g>
          )}
          {flat[i] && alone && <g style={{ mixBlendMode: "multiply" }}>{behind(flat[i])}</g>}
        </g>
        );
      })}
      {joined && (
        <g style={{ mixBlendMode: "multiply" }}>
          {behind(<g filter={`url(#${uid("surface")})`}>{drawing.shape("#fff")}</g>)}
        </g>
      )}

      {/* fixed shading — never changes with the fabric */}
      {drawing.shading && (
        <g mask={`url(#${uid("mask")})`} style={{ mixBlendMode: "multiply" }}>
          {behind(drawing.shading(uid))}
        </g>
      )}

      {/* the soft shadow the edges of the cloth hanging in front throw on this */}
      {over && (
        <g mask={`url(#${uid("mask")})`} style={{ mixBlendMode: "multiply" }}>
          {behind(
            <g
              filter={`url(#${uid("contact")})`}
              fill="none"
              stroke={CONTACT.color}
              strokeOpacity={CONTACT.opacity}
              strokeWidth={CONTACT.width}
              strokeLinejoin="round"
            >
              {over.map((d, i) => (
                <path key={i} d={d} />
              ))}
            </g>
          )}
        </g>
      )}

      {/*
        Fixed light, the shading's counterpart — a fold's lit crest. Screened,
        so it can only lighten, as multiply can only darken: between the two the
        cloth's light changes and its print does not.
      */}
      {drawing.light && (
        <g mask={`url(#${uid("mask")})`} style={{ mixBlendMode: "screen" }}>
          {/* on a cloth with a sheen, its folds' crests shine too — see `FoldSheen` */}
          {behind(<SheenContext.Provider value={sheen}>{drawing.light(uid)}</SheenContext.Provider>)}
        </g>
      )}

      {/*
        A smooth cloth's sheen over its form: where the body turns a piece
        toward the light — see `formSheen`. Screened, like the light: it only
        brightens, and the print under it stays where it is.
      */}
      {sheen && (forms.length > 0 || joined) && (
        <g mask={`url(#${uid("mask")})`} style={{ mixBlendMode: "screen" }}>
          {behind(
            <>{formSheen(uid, sheen, joined ? [drawing.shape("#fff")] : forms.map((f, i) => (!soft && softPieces.includes(i) ? null : f)))}</>
          )}
        </g>
      )}

      {/*
        Topstitch, at the size topstitch actually is.

        It was 2 units thick with 6-unit dashes at 0.9 opacity — and a unit is
        1.9 mm, so that is a 3.8 mm thread laying 11 mm stitches, roughly four
        times life size and about as subtle. Real topstitch is a 2–3 mm stitch
        in thread too fine to measure at this scale; what the eye reads is a
        faint dotted line, not a row of dashes. Hence 0.9 thick, 2.6-unit
        dashes, and enough transparency to sit in the cloth rather than on it.

        Masked to the region, which it was not. A stitch is sewn *on* cloth, so
        any part of one that falls outside the piece should simply not be there
        — and the neckline stitches all did, crossing the opening and painting
        on the throat.

        Tonal thread is the cloth's own colour, a little darker — see
        `TONAL_THREAD` — multiplied over it rather than laid on it.
      */}
      {threadColor && drawing.stitch && (
        <g mask={`url(#${uid("mask")})`} style={tonal ? { mixBlendMode: "multiply" } : undefined}>
          {behind(
            <path
              d={drawing.stitch}
              fill="none"
              stroke={threadColor}
              strokeWidth={tonal ? TONAL_THREAD.width : "0.9"}
              strokeLinecap="round"
              strokeDasharray={tonal ? TONAL_THREAD.dash : "2.6 2.2"}
              strokeOpacity={tonal ? +(TONAL_THREAD.darken * seen).toFixed(3) : "0.55"}
            />
          )}
        </g>
      )}
    </>
  );
}

/** Assumed render width before the element is measured — keeps SSR stable. */
const ASSUMED_RENDER_PX = 440;

/** The element's rendered CSS width, so we can reason in screen pixels. */
export function useRenderedWidth(ref: RefObject<SVGSVGElement | null>) {
  const [px, setPx] = useState(ASSUMED_RENDER_PX);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0) setPx(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return px;
}
