import { BASE_GREY, type BasePiece } from "@/lib/garments/baseLayer";
import { clothSurface, vertical, type Stop } from "@/lib/garments/shading";
import { contour, foldDefs, foldLights, foldShadows } from "@/lib/garments/folds";
import { BUST } from "@/lib/garments/art/female/yoke";
import type { BeneathMasks } from "./FabricRegion";

/**
 * The base layer as drawn — see `lib/garments/baseLayer.ts`: plain grey cloth,
 * each piece lit and edged the way a garment's is, with none of a garment's
 * fabric. Each piece throws its soft contact shadow on the skin, takes its
 * outline — dark where it lies on the body, the page's own rim where it meets
 * the page — and is lit as a gently rounded surface with a soft fall of light
 * down it. Matte: no sheen, no print, no stitch.
 */

/** An edge lying on the body: the colour, width and strength every garment's is drawn in. */
const EDGE_DARK = "#241e19";
/** The shadow an edge throws on the skin under it — the stage's contact shadow. */
const CONTACT = { color: "#5c4a3e", width: 3.2, opacity: 0.5, soft: 1.6 } as const;
/** A soft fall of light down each piece, lighter at the top. */
const FALL: Stop[] = [
  [0, "#f4f4f4"],
  [0.3, "#ffffff"],
  [1, "#d6d6d6"],
];

/**
 * The tank's one fold: the turn of the cloth under each bust, lit above and
 * in shadow below — her dress's bodice has the same. A fitted piece takes the
 * shape of what is under it, and flat it read as a cut-out; taken from the
 * photograph's own shading it showed the body through it, which a base layer
 * is there to stop.
 */
const BUST_TURN = BUST.points.map(([x]) =>
  contour({ centre: [x, BUST.creaseY], half: 26, sag: 9, width: 7, shadow: 0.2, light: 0.14, soft: 6 })
);

export function BaseLayer({
  pieces,
  uid,
  beneath,
  canvas,
}: {
  pieces: BasePiece[];
  uid: (name: string) => string;
  beneath: BeneathMasks;
  canvas: readonly [number, number];
}) {
  if (pieces.length === 0) return null;
  const shapes = pieces.flatMap((p) => p.shapes);
  const edges = pieces.flatMap((p) => p.edges);
  const lines = pieces.flatMap((p) => p.lines);
  const tank = pieces.find((p) => p.kind === "tank");
  const full = { x: 0, y: 0, width: canvas[0], height: canvas[1] };
  return (
    <>
      <defs>
        {clothSurface(uid("base-surface"), { blur: 12, relief: 4 })}
        {vertical(uid("base-fall"), FALL)}
        <filter id={uid("base-contact")} filterUnits="userSpaceOnUse" {...full}>
          <feGaussianBlur stdDeviation={CONTACT.soft} />
        </filter>
        <filter id={uid("base-line")} filterUnits="userSpaceOnUse" {...full} colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation={0.8} />
        </filter>
        {tank && foldDefs(uid)}
        {tank && (
          <mask id={uid("base-tank")} maskUnits="userSpaceOnUse" {...full}>
            {tank.shapes.map((d, i) => (
              <path key={i} d={d} fill="#fff" />
            ))}
          </mask>
        )}
        <mask id={uid("base-mask")} maskUnits="userSpaceOnUse" {...full}>
          {shapes.map((d, i) => (
            <path key={i} d={d} fill="#fff" />
          ))}
        </mask>
      </defs>
      {shapes.map((d, i) => (
        <g key={i}>
          {/* its edge's soft shadow on the skin — under the piece, which covers the half on its own side */}
          <g mask={`url(#${beneath.shade})`} style={{ mixBlendMode: "multiply" }}>
            <path
              d={edges[i]}
              fill="none"
              stroke={CONTACT.color}
              strokeOpacity={CONTACT.opacity}
              strokeWidth={CONTACT.width}
              strokeLinejoin="round"
              filter={`url(#${uid("base-contact")})`}
            />
          </g>
          <path d={d} fill={BASE_GREY} />
          <g mask={`url(#${beneath.rim})`} fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2" strokeLinejoin="round">
            <path d={edges[i]} />
          </g>
          <g mask={`url(#${beneath.dark})`} fill="none" stroke={EDGE_DARK} strokeOpacity="0.18" strokeWidth="2" strokeLinejoin="round">
            <path d={edges[i]} />
          </g>
          {/* rounded, as cloth over a body is, and matte */}
          <g style={{ mixBlendMode: "multiply" }}>
            <g filter={`url(#${uid("base-surface")})`}>
              <path d={d} fill="#fff" />
            </g>
          </g>
        </g>
      ))}
      {/* the turn under the bust, on the tank alone */}
      {tank && (
        <>
          <g mask={`url(#${uid("base-tank")})`} style={{ mixBlendMode: "multiply" }}>{foldShadows(uid, BUST_TURN)}</g>
          <g mask={`url(#${uid("base-tank")})`} style={{ mixBlendMode: "screen" }}>{foldLights(uid, BUST_TURN)}</g>
        </>
      )}
      <g mask={`url(#${uid("base-mask")})`} style={{ mixBlendMode: "multiply" }}>
        {shapes.map((d, i) => (
          <path key={i} d={d} fill={`url(#${uid("base-fall")})`} />
        ))}
        {/* the waistband's lower edge: a soft line, and nothing else */}
        <g filter={`url(#${uid("base-line")})`}>
          {lines.map((d, i) => (
            <path key={i} d={d} fill="none" stroke="#7a7a7a" strokeWidth="1.4" opacity="0.5" />
          ))}
        </g>
      </g>
    </>
  );
}
