import type { ReactNode } from "react";

/**
 * The shading vocabulary shared by everything the visualizer draws.
 *
 * Fixed greyscale ramps, painted over the fabric with `multiply`. White reads
 * as lit, grey as shadow, and none of it changes when the fabric changes —
 * which is what makes a fill read as cloth rather than as a sticker.
 *
 * Ids are namespaced through `uid` because a page can hold many previews at
 * once and SVG gradient ids are global.
 */

export type Uid = (name: string) => string;

export type Stop = [offset: number, grey: string];

/** Greyscale ramp down the piece — the workhorse of cloth shading. */
export const vertical = (id: string, stops: Stop[]): ReactNode => (
  <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
    {stops.map(([o, c]) => (
      <stop key={o} offset={o} stopColor={c} />
    ))}
  </linearGradient>
);

/** Greyscale ramp across the piece — implies a rounded body underneath. */
export const horizontal = (id: string, stops: Stop[]): ReactNode => (
  <linearGradient key={id} id={id} x1="0" y1="0" x2="1" y2="0">
    {stops.map(([o, c]) => (
      <stop key={o} offset={o} stopColor={c} />
    ))}
  </linearGradient>
);

/** Roundness across a torso: dark at both seams, lit down the middle. */
export const ROUND: Stop[] = [
  [0, "#a9a9a9"],
  [0.18, "#e6e6e6"],
  [0.4, "#ffffff"],
  [0.62, "#ffffff"],
  [0.84, "#e2e2e2"],
  [1, "#a3a3a3"],
];

/** Roundness across a limb — tighter, because a sleeve is a smaller cylinder. */
export const TUBE: Stop[] = [
  [0, "#9d9d9d"],
  [0.22, "#ededed"],
  [0.46, "#ffffff"],
  [0.72, "#e4e4e4"],
  [1, "#9a9a9a"],
];

/** The light falling down a hanging piece: bright at the top, deep at the hem. */
export const DRAPE: Stop[] = [
  [0, "#cfcfcf"],
  [0.14, "#ffffff"],
  [0.62, "#f4f4f4"],
  [1, "#bcbcbc"],
];

/**
 * Roundness across a collar band — the tightest cylinder in the wardrobe.
 *
 * A band round a throat is a quarter the radius of a torso, so its light turns
 * over far faster: the lit face is narrow and the two sides fall away hard.
 * Lighting one with `ROUND`, or worse with a `vertical` ramp, is what made
 * every collar here read flat — a top-to-bottom gradient says "this is a panel
 * hanging down", which is the one thing a collar is not.
 */
export const CYLINDER: Stop[] = [
  [0, "#8f8f8f"],
  [0.14, "#d8d8d8"],
  [0.38, "#fdfdfd"],
  [0.58, "#f7f7f7"],
  [0.85, "#cfcfcf"],
  [1, "#8a8a8a"],
];

/**
 * The reverse of a collar, seen along the fold.
 *
 * Where a fall turns over its stand you are looking at the *under* side of the
 * cloth, which faces down and away from the light and is never as bright as the
 * face beside it. Flat, because a sliver of undercollar has no room to model.
 */
export const UNDERCOLLAR: Stop[] = [
  [0, "#b2b2b2"],
  [0.5, "#d4d4d4"],
  [1, "#acacac"],
];

/**
 * The light down a fall: lit where it folds, deep at the point.
 *
 * The shared version of the ramp nine collars each wrote out slightly
 * differently, none of the differences meaning anything.
 */
export const FALL: Stop[] = [
  [0, "#ffffff"],
  [0.45, "#f4f4f4"],
  [1, "#bdbdbd"],
];

/**
 * The cut edge of a piece of cloth lying on other cloth.
 *
 * A collar takes its own fabric, but the common case is the *same* fabric as
 * the garment — and then the outline between them carries no colour difference
 * at all. On a plain linen a Peter Pan or a sailor very nearly disappears into
 * the blouse it is sewn to, however carefully it is shaded, because nothing
 * marks where one piece of cloth stops and the next begins.
 *
 * What marks it in life is the edge itself: cloth has a thickness, and its cut
 * edge turns away from the light. So this is stroked along a collar's **free**
 * edge — the outer run it is finished on, never the fold or the seam — and it
 * is the one thing that makes a same-fabric collar read as a separate piece.
 *
 * Stroked rather than filled, because an edge is a line: `width` is the cloth's
 * thickness in canvas units, about two millimetres of shirting.
 */
export const cutEdge = (d: string, width = 3, opacity = 0.42): ReactNode => (
  <path
    d={d}
    fill="none"
    stroke="#8a8a8a"
    strokeWidth={width}
    strokeLinecap="round"
    strokeLinejoin="round"
    opacity={opacity}
  />
);

/**
 * Form, derived from a piece's own silhouette.
 *
 * This is the thing the wardrobe did not have. A garment's whole
 * three-dimensionality used to be four or five linear gradients keyed to a
 * bounding box — a ramp down the piece, a ramp across it — which can say
 * "lighter here, darker there" and nothing else. Cloth on a body is a
 * *surface*, and a surface needs a normal at every point, not a direction and
 * two endpoints.
 *
 * The trick is that a piece already carries the information: blur its own alpha
 * and you get a height field that is tall in the middle of the shape and falls
 * away at every edge, whatever shape that is. Light that field and the piece
 * reads as inflated cloth — round across a sleeve, flat down a panel, turning
 * at every border, and all of it following the outline rather than a rectangle.
 *
 *   • `blur` is how far the form rolls off at an edge. Small for a collar leaf,
 *     large for a body panel: it wants to be about a third of the piece's
 *     narrow dimension, or the whole thing domes like a cushion.
 *   • `relief` is how much the light believes in it. Past about 10 a blouse
 *     starts to look like sheet metal.
 *
 * It does not know the body underneath — the silhouette is standing in for it,
 * which holds at the shoulder and chest where the cloth is against the body and
 * weakens where it hangs free. That is the next thing to fix, and it needs the
 * body's depth rather than the garment's outline.
 */
export const clothSurface = (
  id: string,
  { blur = 10, relief = 6, azimuth = 225, elevation = 55, ambient = 0.58 } = {}
): ReactNode => (
  <filter
    key={id}
    id={id}
    x="-12%"
    y="-12%"
    width="124%"
    height="124%"
    colorInterpolationFilters="sRGB"
  >
    <feGaussianBlur in="SourceAlpha" stdDeviation={blur} result="puff" />
    <feDiffuseLighting
      in="puff"
      surfaceScale={relief}
      diffuseConstant="1"
      lightingColor="#ffffff"
      result="lit"
    >
      <feDistantLight azimuth={azimuth} elevation={elevation} />
    </feDiffuseLighting>
    {/*
      An ambient floor. A single distant light falls to black wherever the
      surface turns away from it, and multiplying that over cloth makes
      everything not facing the lamp read as soot. A room has bounce: the
      darkest a lit surface gets here is `ambient`, and the range above it is
      what does the modelling.
    */}
    <feComponentTransfer result="soft">
      <feFuncR type="linear" slope={1 - ambient} intercept={ambient} />
      <feFuncG type="linear" slope={1 - ambient} intercept={ambient} />
      <feFuncB type="linear" slope={1 - ambient} intercept={ambient} />
    </feComponentTransfer>
    {/* the light belongs to the cloth, not to the rectangle around it */}
    <feComposite in="soft" in2="SourceAlpha" operator="in" />
  </filter>
);

/**
 * The weave, bent over the form.
 *
 * A fabric fill is a flat lattice pinned to the canvas: on a rounded chest a
 * check stays perfectly square, which is the single loudest signal that the
 * cloth is printed on rather than worn. Real cloth foreshortens — the repeat
 * compresses as the surface turns away and the lines bow with it.
 *
 * `feDisplacementMap` can do that, but it wants a map whose red and green
 * channels carry the *slope* of the surface, and the height field from
 * `clothSurface` carries the height. So the slope is differentiated out of it:
 *
 *   1. blur the alpha into the same height field,
 *   2. move that height from the alpha channel into RGB, where a convolution
 *      can reach it,
 *   3. difference it against itself shifted, across and down, biased to 0.5 so
 *      the negative half of the slope survives being clamped,
 *   4. pack the across-slope into red and the down-slope into green,
 *   5. displace the fabric by it.
 *
 * Nine primitives for one effect is a lot, and it is worth knowing why none of
 * them can be dropped: the displacement needs a derivative, SVG filters have no
 * derivative primitive, and every step above is the cost of building one.
 *
 * `gain` amplifies the difference before it is packed. Slopes on a field this
 * smooth are small numbers, and without it the map never leaves mid-grey.
 *
 * `scale` is how far the weave may travel, in user units. It wants to be small
 * — four or five. Past about eight the fabric starts to swim.
 *
 * `ridges` adds folds to the height field: shapes, filled, in canvas units —
 * a cowl's, say. Raised, blurred and laid on the piece's own height, they bow
 * the weave a little along each fold, as cloth foreshortens over a crest and
 * into a trough. The repeat is moved, never resized.
 *
 * `gathers` are fine folds close together — a tiered skirt's, under each
 * seam: shapes too, a narrow band round each. Blurred by `RIDGE_SOFT` they
 * would melt into one band, and read across the piece's own long step they
 * would cancel out, so they are a height field of their own — hardly blurred,
 * its slope read across a step shorter than the space between them — added
 * to the piece's slope, so the print bends a little along each gather.
 */
/** How high a fold stands in the warp's height field, against the piece's own full height of 1. */
const RIDGE_HEIGHT = 0.15;
/**
 * How soft a fold's sides are in it. Soft enough that the weave only ever
 * bows: on narrower, steeper folds it was pushed opposite ways a few units
 * apart, and a print tore into fragments along each crest.
 */
const RIDGE_SOFT = 8;

/** How soft a gather's sides are in its own height field, and across how short a step its slope is read. */
const GATHER_SOFT = 1.2;
const GATHER_STEP = 2;
/**
 * How much of the gathers' slope is added to the piece's: at a warp of 5,
 * the weave moves half a unit to 0.7 — about a millimetre — each way across a
 * gather, and nowhere 0.7 units further than a unit beside it (a test follows
 * it across a row of gathers). Gathers 1 to 1.5 cm apart allow no more: at 1.5
 * units each way the print turned back on itself between two of them, and its
 * motifs tore into strips along every gather.
 */
const GATHER_GAIN = 0.25;

/**
 * Fold shapes as an image a filter can read: white on nothing, at canvas size.
 * Inlined as a data URL, because a filter cannot reach an element of the page
 * itself in every browser, and an image it can.
 */
const ridgeImage = (d: string, [w, h]: readonly [number, number]): string =>
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="${d}" fill="#fff"/></svg>`
  );

export const clothWarp = (
  id: string,
  {
    blur = 10,
    scale = 5,
    gain = 3,
    ridges,
    gathers,
    canvas = [600, 1000],
  }: { blur?: number; scale?: number; gain?: number; ridges?: string; gathers?: string; canvas?: readonly [number, number] } = {}
): ReactNode => {
  // How far apart the height field is sampled to measure its slope. It has to
  // be of the same order as the blur: a 3×3 kernel across a field blurred by
  // sixteen units reads a slope of almost nothing, which is what the first
  // attempt at this did — the map came out a flat 0.5 and the displacement was
  // a uniform shift, invisible on a repeating weave.
  const step = Math.max(2, Math.round(blur * 0.6));
  return (
    <filter
      key={id}
      id={id}
      x="-12%"
      y="-12%"
      width="124%"
      height="124%"
      colorInterpolationFilters="sRGB"
    >
      {ridges ? (
        <>
          <feGaussianBlur in="SourceAlpha" stdDeviation={blur} result="own" />
          <feImage
            href={ridgeImage(ridges, canvas)}
            x="0"
            y="0"
            width={canvas[0]}
            height={canvas[1]}
            preserveAspectRatio="none"
            result="folds"
          />
          <feGaussianBlur in="folds" stdDeviation={RIDGE_SOFT} result="soft-folds" />
          {/*
            Both heights in one field: the piece's own scaled down to make room,
            since a blurred panel is already at full height in its middle and a
            fold laid on top would be clipped flat there.
          */}
          <feComposite
            in="own" in2="soft-folds" operator="arithmetic"
            k1="0" k2={1 - RIDGE_HEIGHT} k3={RIDGE_HEIGHT} k4="0" result="h"
          />
        </>
      ) : (
        <feGaussianBlur in="SourceAlpha" stdDeviation={blur} result="h" />
      )}
      {/* the height rides in alpha; move it to RGB where it can be differenced */}
      <feColorMatrix
        in="h"
        type="matrix"
        values="0 0 0 1 0  0 0 0 1 0  0 0 0 1 0  0 0 0 0 1"
        result="hrgb"
      />
      <feOffset in="hrgb" dx={-step} dy="0" result="hx" />
      <feOffset in="hrgb" dx="0" dy={-step} result="hy" />
      {/* (h − h shifted) is the slope, biased to 0.5 so the negative half lives */}
      <feComposite
        in="hrgb" in2="hx" operator="arithmetic"
        k1="0" k2={ridges ? gain / (1 - RIDGE_HEIGHT) : gain} k3={ridges ? -gain / (1 - RIDGE_HEIGHT) : -gain} k4="0.5" result={gathers ? "own-gx" : "gx"}
      />
      <feComposite
        in="hrgb" in2="hy" operator="arithmetic"
        k1="0" k2={ridges ? gain / (1 - RIDGE_HEIGHT) : gain} k3={ridges ? -gain / (1 - RIDGE_HEIGHT) : -gain} k4="0.5" result={gathers ? "own-gy" : "gy"}
      />
      {gathers && (
        <>
          {/* the gathers' own height and slope, the same way, finer — then the two slopes added, about the one 0.5 bias */}
          <feImage
            href={ridgeImage(gathers, canvas)}
            x="0"
            y="0"
            width={canvas[0]}
            height={canvas[1]}
            preserveAspectRatio="none"
            result="gathers"
          />
          <feGaussianBlur in="gathers" stdDeviation={GATHER_SOFT} result="soft-gathers" />
          <feColorMatrix
            in="soft-gathers"
            type="matrix"
            values="0 0 0 1 0  0 0 0 1 0  0 0 0 1 0  0 0 0 0 1"
            result="grgb"
          />
          <feOffset in="grgb" dx={-GATHER_STEP} dy="0" result="gax" />
          <feOffset in="grgb" dx="0" dy={-GATHER_STEP} result="gay" />
          <feComposite in="grgb" in2="gax" operator="arithmetic" k1="0" k2={GATHER_GAIN} k3={-GATHER_GAIN} k4="0.5" result="gather-gx" />
          <feComposite in="grgb" in2="gay" operator="arithmetic" k1="0" k2={GATHER_GAIN} k3={-GATHER_GAIN} k4="0.5" result="gather-gy" />
          <feComposite in="own-gx" in2="gather-gx" operator="arithmetic" k1="0" k2="1" k3="1" k4="-0.5" result="gx" />
          <feComposite in="own-gy" in2="gather-gy" operator="arithmetic" k1="0" k2="1" k3="1" k4="-0.5" result="gy" />
        </>
      )}
      {/* across-slope into red, down-slope into green */}
      <feColorMatrix
        in="gx" type="matrix"
        values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0 1"
        result="gxr"
      />
      <feColorMatrix
        in="gy" type="matrix"
        values="0 0 0 0 0  1 0 0 0 0  0 0 0 0 0  0 0 0 0 1"
        result="gyg"
      />
      <feComposite
        in="gxr" in2="gyg" operator="arithmetic"
        k1="0" k2="1" k3="1" k4="0" result="slope"
      />
      <feDisplacementMap
        in="SourceGraphic"
        in2="slope"
        scale={scale}
        xChannelSelector="R"
        yChannelSelector="G"
        result="warped"
      />
      {/*
        Displacing a shape moves its edge as well as its weave: near the outline
        the map points inward, the filter samples the transparent pixels outside
        the piece, and the garment comes back with a bright rim eaten out of it.
        So lay the undisplaced cloth underneath to fill that rim, and clip the
        pair back to the original alpha so the silhouette is exactly the one the
        piece was drawn with. The weave moves; the outline does not.
      */}
      <feMerge result="filled">
        <feMergeNode in="SourceGraphic" />
        <feMergeNode in="warped" />
      </feMerge>
      <feComposite in="filled" in2="SourceAlpha" operator="in" />
    </filter>
  );
};

/**
 * A blur, for the shadow a collar throws on what it lies over.
 *
 * The softness is the point rather than a refinement. A hard-edged grey shape
 * under a collar reads as a second piece of dark cloth; the same shape blurred
 * reads as a gap between two layers, which is what it is. Three units is about
 * a centimetre at this canvas scale — a collar standing proud of a shirt.
 *
 * `sRGB` is required: in the default linear space the blur eats the shadow and
 * leaves a pale smudge, the same trap the mannequin's skin tint falls into.
 */
export const softShadow = (id: string, blur: number): ReactNode => (
  <filter
    key={id}
    id={id}
    x="-40%"
    y="-40%"
    width="180%"
    height="180%"
    colorInterpolationFilters="sRGB"
  >
    <feGaussianBlur stdDeviation={blur} />
  </filter>
);

/**
 * Fold wedges fanning from a waist to a hem, drawn past both edges so the
 * creases reach the very seam once the region clips them.
 *
 * `count` wedges over a waist that spans `waist` and a hem that spans `hem`.
 */
export function fanFolds(
  count: number,
  waist: [x0: number, x1: number],
  hem: [x0: number, x1: number],
  top: number,
  bottom: number
): string[] {
  const at = ([x0, x1]: [number, number], t: number) => x0 + (x1 - x0) * t;
  return Array.from({ length: count }, (_, i) => {
    const t0 = i / count;
    const t1 = (i + 1) / count;
    return [
      `M${at(waist, t0).toFixed(1)} ${top}`,
      `L${at(waist, t1).toFixed(1)} ${top}`,
      `L${at(hem, t1).toFixed(1)} ${bottom}`,
      `L${at(hem, t0).toFixed(1)} ${bottom}`,
      "Z",
    ].join(" ");
  });
}

/** Uneven weights, so a fan of folds does not read as a printed sunburst. */
export const FOLD_OPACITY = [0.85, 0.5, 1, 0.62, 0.92, 0.55, 0.8, 0.66, 0.95];
