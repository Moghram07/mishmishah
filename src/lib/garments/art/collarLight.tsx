import { useContext, type ReactNode } from "react";
import { FLAT_LIT, type Uid } from "@/lib/garments/shading";
import { SheenContext, alongGrain } from "@/lib/garments/sheen";
import type { Fold } from "@/lib/garments/folds";
import type { Pt } from "@/lib/garments/fit";

/**
 * How every collar is lit, on either body.
 *
 * In its own cloth's colour throughout: no line round it and nothing darker
 * than the garment it is sewn to. A collar is nearly always cut from the same
 * cloth, and each one used to draw an outline, a darker cut edge and an
 * inflated form of its own — a darker ring laid on the dress, its edges drawn
 * in ink. What tells a collar from the garment is what tells a seam: a soft
 * shadow on the cloth under its edge — `outline: "soft"`, see `FabricRegion` —
 * and a little light along its top edge or its fold, from here.
 */

/**
 * The collar's cloth in the garment's light: the same grey a garment's form
 * multiplies its cloth by where it lies level — see `FLAT_LIT`. Without it a
 * collar, having no form of its own, came out a shade lighter than the dress.
 * The first thing in a collar's `shading`; masked to the collar there.
 */
export const collarTone = (): ReactNode => <rect x="0" y="0" width="600" height="1000" fill={FLAT_LIT} />;

/**
 * The light an edge catches where the cloth is folded over: a soft band just
 * inside it, as bright as the light on a seam's fold — any brighter and on a
 * dark print it reads as a pale outline. `width` is how far in it reaches, in
 * canvas units.
 */
const EDGE_LIGHT = { width: 2.4, opacity: 0.085, soft: 1.4 } as const;

/**
 * The shadow under a flat collar's free edge — a Peter Pan's, a sailor's:
 * stronger and a little wider than a soft outline's (0.3, 3.2 wide, blurred
 * 2), still no line. Two layers of cloth lying flat on the dress have no
 * other edge, and at the soft outline's strength a same-cloth collar all but
 * disappeared into a busy print at whole-figure size. Thrown from the free
 * edges only: a seam throws none.
 */
export const FLAT_COLLAR_SHADOW = { opacity: 0.55, width: 5.2, soft: 2.8 } as const;

/** The blur the edge light is drawn through. Put once in the collar's `defs`. */
export const edgeLightDefs = (uid: Uid): ReactNode => (
  <filter id={uid("edge-light")} filterUnits="userSpaceOnUse" x="0" y="0" width="600" height="1000" colorInterpolationFilters="sRGB">
    <feGaussianBlur stdDeviation={EDGE_LIGHT.soft} />
  </filter>
);

/**
 * Light along a collar's top edge or fold, for its `light`: the line stroked
 * twice the band's width and masked to the collar, so the half outside it is
 * cut away and what is left is a lit band just inside the edge, whichever way
 * the edge runs. Only ever along edges that are folded — a band's top, a
 * flat collar's rolled outer edge — never along a seam.
 */
export const edgeLight = (uid: Uid, ...edges: string[]): ReactNode => (
  <>
    <g
      filter={`url(#${uid("edge-light")})`}
      fill="none"
      stroke="#ffffff"
      strokeOpacity={EDGE_LIGHT.opacity}
      strokeWidth={EDGE_LIGHT.width * 2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {edges.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </g>
    <EdgeSheen uid={uid} edges={edges} />
  </>
);

/**
 * On a cloth with a sheen, a folded edge shines as a fold's crest does: a
 * narrow highlight just inside it, drawn out along the grain — see
 * `garments/sheen.tsx`. Nothing on a matte cloth.
 */
function EdgeSheen({ uid, edges }: { uid: Uid; edges: string[] }) {
  const sheen = useContext(SheenContext);
  if (!sheen) return null;
  return alongGrain(
    sheen,
    `url(#${uid("sheen-crest-1")})`,
    <g
      fill="none"
      stroke={sheen.tint}
      strokeOpacity={sheen.look.crestMax}
      strokeWidth={EDGE_LIGHT.width * 1.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {edges.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </g>
  );
}

/**
 * A fold in a collar — where a shirt collar's leaves turn over its band, a
 * lapel rolls back: drawn as a seam is, a soft shadow on one side and a little
 * light on the other, never a line.
 */
export const COLLAR_FOLD = { shadow: 0.18, light: 0.22, soft: 1.6 } as const;

/** A fold along `ridge`, at the collar fold's strength. */
export const collarFold = (ridge: Pt[], width = 2.2): Fold => ({
  ridge,
  width: [width, width],
  ...COLLAR_FOLD,
});
