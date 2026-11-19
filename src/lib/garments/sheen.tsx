import { Fragment, createContext, type ReactNode } from "react";
import type { BodyType } from "@/types";
import type { SheenLook } from "@/lib/fabrics/sheen";
import { bodyHighlights } from "./bodyLight";
import type { Uid } from "./shading";

/**
 * How a sheen is drawn — the light a smooth cloth throws back (see
 * `lib/fabrics/sheen.ts` for what it is and how strong).
 *
 * Two highlights, both light and never cloth: drawn by the stage over the
 * fabric, screened so they can only brighten, masked to the region, and none
 * of it in the fabric's tile — so a print under it stays at its true size,
 * unmoved, and the highlight never repeats with the print.
 *
 * - Along every fold's crest, on the side facing the light (`FoldSheen` in
 *   `folds.tsx`, and a collar's folded edge in `collarLight.tsx`) — and right
 *   beside it, on the side turned away, a deeper shadow (`FoldShade`), cool
 *   and sharp-edged: the contrast a satin is known by. The folds are the
 *   garment's own, so both follow them and move wherever the body and the cut
 *   move them.
 * - Over the form (`formSheen` here): where a piece's own surface turns
 *   toward the light, from its height field — the same one its shading is lit
 *   from — and where the body under it does: the tops of the shoulders, the
 *   tops of the sleeves, her bust (`bodyLight.ts`).
 *
 * The light comes from the upper left, as for all the shading (`LIGHT` in
 * `folds.tsx`, azimuth 225° in `clothSurface`). Every highlight is drawn out
 * along the grain, as a satin's floats draw its shine out down the weave: the
 * drawing is turned into the grain's frame, blurred there wider along than
 * across, and turned back — `alongGrain`.
 */

/** What a region's sheen needs while its folds are drawn. */
export interface Sheen {
  look: SheenLook;
  /** The body the cloth is on, whose curves shine through it — none on a product. */
  body?: BodyType;
  /** Whether the cloth follows the body's front, as a fitted bodice does — a robe hangs clear of her bust. */
  fitted?: boolean;
  /** The grain, in degrees: the outfit's direction and the piece's own turn. A highlight is drawn out along it. */
  turn: number;
  /** The point the grain turns about — the pattern's own pivot. */
  pivot: readonly [number, number];
  /** The highlight's colour — see `sheenTint`. */
  tint: string;
}

/** The region's sheen, while its light is drawn; none on a matte cloth, and then nothing of it is drawn. */
export const SheenContext = createContext<Sheen | null>(null);

/** The softness levels fold crests are drawn at: the folds' own. */
export const CREST_SOFTNESS = [1, 2, 4, 6, 9] as const;

const r1 = (v: number) => Math.round(v * 10) / 10;

/**
 * A crest highlight's blur at a fold softness level, and its shadow's: across
 * the grain — narrow, so the edge between the two is sharp, as a satin's is —
 * and along it, the look's `along` more.
 */
export function crestBlur(soft: number, look: SheenLook): readonly [across: number, along: number] {
  const across = Math.max(0.4, r1(soft * 0.12));
  return [across, r1(across + look.along)];
}

/**
 * The blur the shadow beside a crest is drawn through: a little softer
 * across than the highlight's — its edge at the ridge still clear, its far
 * side easing into the fold's own shadow — and drawn out along the grain.
 */
export function shadeBlur(soft: number, look: SheenLook): readonly [across: number, along: number] {
  const across = Math.max(0.6, r1(soft * 0.22));
  return [across, r1(across + look.along)];
}

/** The blur the body's highlights are drawn through: soft across, drawn out along the grain — half as far as a crest, or a small curve's light thins to nothing. */
export const bodyBlur = (look: SheenLook): readonly [number, number] => [2.5, r1(2.5 + look.along / 2)];

/**
 * The blur her chest's broad sheen is drawn through: wide enough that the band
 * has no edge anywhere — a glow across the upper chest, never a shape on it —
 * and drawn out along the grain as the other curves are.
 */
export const chestBlur = (look: SheenLook): readonly [number, number] => [9, r1(9 + look.along / 2)];

/** Toward the light, upper left, on the screen — the shading's light. */
const LIGHT = [-Math.SQRT1_2, -Math.SQRT1_2] as const;

/** A screen direction in the grain's frame: turned back by the grain. */
export function inGrainFrame([x, y]: readonly [number, number], turn: number): [number, number] {
  const a = (-turn * Math.PI) / 180;
  return [r1(x * Math.cos(a) - y * Math.sin(a)) || 0, r1(x * Math.sin(a) + y * Math.cos(a)) || 0];
}

/**
 * The form highlight's parts, for a piece blurred into a height field by
 * `blur` (its `surface.blur`, as its shading is): the blur across the grain
 * and along it, and how far, and which way, the field is compared toward the
 * light — in the grain's frame, and across the grain only.
 *
 * Across only, because a satin's shine is drawn out along its floats: where
 * the cloth turns across the grain — down the side of a bodice, round a
 * sleeve — the shine gathers into a streak; where it turns along the grain —
 * under a waist seam — the same light is spread down it and does not show.
 * Compared both ways, the top of every piece lit up: a pale band under the
 * waist seam.
 */
export function formSheenSpec(blur: number, look: SheenLook, turn: number) {
  const across = r1(blur * 0.6);
  const along = r1(across + look.along * 2);
  const reach = r1(blur * 0.6);
  /* the field is shifted away from the light, so each point is compared with the point toward it */
  const [sx] = inGrainFrame([-LIGHT[0] * reach, -LIGHT[1] * reach], turn);
  return { across, along, shift: [sx, 0] as const };
}

/** How steeply the field's fall toward the light is read, and how sharply the highlight peaks. */
const FORM_GAIN = 6;
const FORM_PEAK = 1.6;

/**
 * The filters a sheen draws through, in a region's `defs`: a crest blur for
 * each fold softness level, and the form's highlight.
 */
export function sheenDefs(uid: Uid, sheen: Sheen, blur: number): ReactNode {
  const { across, along, shift } = formSheenSpec(blur, sheen.look, sheen.turn);
  return (
    <>
      {CREST_SOFTNESS.map((s) => {
        const [a, b] = crestBlur(s, sheen.look);
        const [c, d] = shadeBlur(s, sheen.look);
        return (
          <Fragment key={s}>
            <filter id={uid(`sheen-crest-${s}`)} x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
              <feGaussianBlur stdDeviation={`${a} ${b}`} />
            </filter>
            <filter id={uid(`sheen-shade-${s}`)} x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
              <feGaussianBlur stdDeviation={`${c} ${d}`} />
            </filter>
          </Fragment>
        );
      })}
      {/*
        The form's highlight: the piece's alpha blurred into a height field —
        wider along the grain than across it — and each point compared with
        the point a little toward the light. Where the field falls toward the
        light the surface faces it, and shines; the steeper, the brighter,
        peaked so it reads as a highlight rather than a glow. Nothing where the
        piece lies flat or turns away.
      */}
      <filter id={uid("sheen-form")} x="-12%" y="-12%" width="124%" height="124%" colorInterpolationFilters="sRGB">
        <feGaussianBlur in="SourceAlpha" stdDeviation={`${across} ${along}`} result="height" />
        <feOffset in="height" dx={shift[0]} dy={shift[1]} result="toward" />
        <feComposite in="height" in2="toward" operator="arithmetic" k1="0" k2={FORM_GAIN} k3={-FORM_GAIN} k4="0" result="facing" />
        {/* at full strength here: the layer it is drawn in is held to the look's `form` */}
        <feComponentTransfer in="facing" result="shine">
          <feFuncA type="gamma" amplitude="1" exponent={FORM_PEAK} offset="0" />
        </feComponentTransfer>
        <feFlood floodColor={sheen.tint} result="tint" />
        <feComposite in="tint" in2="shine" operator="in" result="lit" />
        <feComposite in="lit" in2="SourceAlpha" operator="in" />
      </filter>
      <filter id={uid("sheen-body")} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
        <feGaussianBlur stdDeviation={bodyBlur(sheen.look).join(" ")} />
      </filter>
      {/* room on every side for the wide blur, whichever way the grain turns the band */}
      <filter id={uid("sheen-chest")} x="-100%" y="-100%" width="300%" height="300%" colorInterpolationFilters="sRGB">
        <feGaussianBlur stdDeviation={chestBlur(sheen.look).join(" ")} />
      </filter>
    </>
  );
}

/**
 * Draw `children` through `filter` in the grain's frame: turned so the grain
 * runs down, filtered — a blur there is drawn out along the grain — and turned
 * back into place. Straight grain needs no turn.
 */
export function alongGrain(sheen: Sheen, filter: string, children: ReactNode): ReactNode {
  if (sheen.turn % 360 === 0) return <g filter={filter}>{children}</g>;
  const [px, py] = sheen.pivot;
  return (
    <g transform={`rotate(${sheen.turn} ${px} ${py})`}>
      <g filter={filter}>
        <g transform={`rotate(${-sheen.turn} ${px} ${py})`}>{children}</g>
      </g>
    </g>
  );
}

/**
 * The form's highlight over each piece of a region — its `forms`, white
 * shapes — through `sheen-form`, and the body's curves under it. All at full
 * strength: the layer they are drawn in is held to the look's `form`, so
 * where they overlap they never add up past it.
 */
export function formSheen(uid: Uid, sheen: Sheen, pieces: ReactNode[]): ReactNode {
  const curves = sheen.body ? bodyHighlights(sheen.body, { bust: sheen.fitted !== false }) : [];
  /* `opacity`, not `fill-opacity`: a curve's light, told apart from a crest's in the markup */
  const lights = (list: typeof curves) => list.map((c, i) => <path key={i} d={c.d} fill={sheen.tint} opacity={c.strength} />);
  const narrow = curves.filter((c) => !c.broad);
  const broad = curves.filter((c) => c.broad);
  return (
    <>
      {pieces.map((piece, i) => (
        <g key={i}>{alongGrain(sheen, `url(#${uid("sheen-form")})`, piece)}</g>
      ))}
      {narrow.length > 0 && alongGrain(sheen, `url(#${uid("sheen-body")})`, lights(narrow))}
      {/* the chest's halves blurred together, so they meet as one sheen */}
      {broad.length > 0 && alongGrain(sheen, `url(#${uid("sheen-chest")})`, lights(broad))}
    </>
  );
}
