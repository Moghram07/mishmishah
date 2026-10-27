import { vertical, type Stop, type Uid } from "@/lib/garments/shading";
import type { TrouserDetails } from "@/lib/garments/fit";
import type { RegionArt } from "./index";

/**
 * The details sewn into a pair of trousers — the fly, the slanted pockets and
 * the belt loops — drawn the same way on both bodies. The geometry is drafted
 * in `fit.ts` (`trouserDetails`); this is how it is lit.
 *
 * Every line here lies on cloth, so it follows the rule every edge on cloth
 * does: a fine dark line and a soft shadow, the same in either theme. Nothing
 * is stroked in the page's text colour, which is cream on a dark page.
 */

/** An edge lying on cloth: the colour, width and strength of every other one. */
const EDGE = { color: "#241e19", width: 1.8, opacity: 0.22 } as const;

/** The shadow an edge standing a little off the cloth throws on it — the stage's contact shadow. */
const LIFT = { color: "#5c4a3e", opacity: 0.5, soft: 1.4 } as const;

/** The waistband's light: the loops lie on it and take the same. */
const BAND_LIGHT: Stop[] = [
  [0, "#ffffff"],
  [1, "#d2d2d2"],
];

/**
 * Where a loop is cut from the roll, against the band it is sewn to: a strip
 * from further along it, so a print breaks where each loop crosses the band.
 */
const LOOP_GRAIN = [3.1, 8.6] as const;

/**
 * How round a loop is lit across, and how much more light its face catches
 * than the band under it. Small: a loop is a strip of cloth a centimetre wide,
 * and lit as a tube it read as a dark tick at the scale of the whole figure.
 */
const LOOP_RELIEF = 1.2;
const LOOP_LIGHT = 0.12;

/** The masks and the blur the details' shading needs. */
export function detailDefs(uid: Uid, d: TrouserDetails) {
  return (
    <>
      {/* over the whole canvas: a lens a unit or two wide has no box for a filter to be a share of */}
      <filter id={uid("detail-soft")} filterUnits="userSpaceOnUse" x="0" y="0" width="600" height="1000" colorInterpolationFilters="sRGB">
        <feGaussianBlur stdDeviation={LIFT.soft} />
      </filter>
      <mask id={uid("facings")} maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="1000">
        {d.pockets.map((p, i) => (
          <path key={i} d={p.facing} fill="#fff" />
        ))}
      </mask>
    </>
  );
}

/**
 * The pockets' and the fly's edges and the shadows they throw, for the
 * region's `shading` (multiplied, and kept to the cloth).
 *
 * Each pocket's opening lifts a little off the facing behind it, most in the
 * middle: its shadow falls on the facing, on that side of the edge only. The
 * fly's front edge laps over the other side of the centre front and shades it
 * the same way, thinly, down to the J's foot where it is sewn shut.
 */
export function detailShading(uid: Uid, d: TrouserDetails) {
  return (
    <>
      <g mask={`url(#${uid("facings")})`}>
        <g filter={`url(#${uid("detail-soft")})`} fill={LIFT.color} opacity={LIFT.opacity}>
          {d.pockets.map((p, i) => (
            <path key={i} d={p.lift} />
          ))}
        </g>
      </g>
      {d.fly && (
        <path d={d.fly.lap} fill={LIFT.color} opacity={LIFT.opacity} filter={`url(#${uid("detail-soft")})`} />
      )}
      {/* cut square at the band's seam, which each runs up to: a round cap pokes into the band */}
      <g fill="none" stroke={EDGE.color} strokeOpacity={EDGE.opacity} strokeWidth={EDGE.width} strokeLinecap="butt">
        {d.pockets.map((p, i) => (
          <path key={i} d={p.edge} />
        ))}
        {d.fly && <path d={d.fly.edge} strokeWidth={EDGE.width * 0.8} />}
      </g>
    </>
  );
}

/** The details' topstitch: the fly's J and each pocket's edge. */
export const detailStitch = (d: TrouserDetails): string =>
  [d.fly?.stitch ?? "", ...d.pockets.map((p) => p.stitch)].filter(Boolean).join(" ");

/**
 * The belt loops, as cloth lying over the trousers they are sewn to — a
 * region's `over`, so the stage draws each with its own edges and the shadow
 * those throw on the band. Lit with the band, rounded a little across, and
 * tacked down at the top and the foot.
 */
export const beltLoops = (loops: TrouserDetails["loops"]): RegionArt => ({
  grain: { shift: LOOP_GRAIN },
  surface: { blur: 1.4, relief: LOOP_RELIEF },
  shape: (fill) => (
    <>
      {loops.pieces.map((d, i) => (
        <path key={i} d={d} fill={fill} />
      ))}
    </>
  ),
  /* the sides and the foot: the top is folded over the band's own top edge */
  edge: () => (
    <>
      {loops.edges.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </>
  ),
  defs: (uid) => vertical(uid("band"), BAND_LIGHT),
  shading: (uid) => <path d={loops.pieces.join(" ")} fill={`url(#${uid("band")})`} />,
  /* standing a little proud of the band, each faces the light a touch more than the band does */
  light: () => <path d={loops.pieces.join(" ")} fill="#ffffff" opacity={LOOP_LIGHT} />,
  stitch: loops.tacks,
});
