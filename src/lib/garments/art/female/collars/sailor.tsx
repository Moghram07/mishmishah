import { FLAT_COLLAR_SHADOW, collarTone, edgeLight, edgeLightDefs } from "../../collarLight";
import { TIE_AT, sailor, sailorEdges, sailorTie } from "../collarCuts";
import { foldDefs, foldLights, foldShadows, type Fold } from "@/lib/garments/folds";
import { STRIPES, stripesAlong } from "@/lib/garments/stripes";
import type { Pt } from "@/lib/garments/fit";
import type { StripesId } from "@/types";
import type { GarmentArt, GarmentChoice, RegionArt } from "../../index";

/**
 * Sailor collar: two flat panels lying on the shoulders, sewn down the edges
 * of a V and meeting at its point — see `sailorPanel` in `collarCuts.ts`,
 * which cuts them so that `check:garments` measures the same ones.
 *
 * Seen from the front, each panel is broadest where it lies over the
 * shoulder, out to within 1.6 cm of the shoulder point, and narrows smoothly
 * down to the V's point at mid-chest. Its top edge is the shoulder line,
 * where the collar turns over to the square back nobody sees from here; its
 * inner edge is the V's edge all the way up, so nothing of it shows beside
 * the neck; its outer edge is free, and bows as the weight of a broad panel
 * makes it.
 *
 * It used to be two flat triangles hanging on the chest below the shoulder
 * line — a bib — with the band of a stand behind the neck showing as a stub
 * at either side of it. A sailor collar has no stand: it lies flat.
 *
 * It claims no zone, and the open V is why: `upperChest` runs the full width
 * of the chest and this collar leaves the middle of it bare, so it does not
 * cover the zone end to end and may not name it.
 */

const { left, right } = sailor();

/**
 * The panels: in the garment's light, with no line round them — see
 * `collarLight.tsx`. What separates a same-cloth collar from the dress is its
 * thickness: a soft shadow under its free edge, and a little light along it,
 * where it rolls. Its edge on the shoulder is a fold over to the back and its
 * edge down the V a seam, and neither throws a shadow.
 */
const PANELS: RegionArt = {
  focus: [300, 222],
  outline: "soft",
  /** Cut from further down the roll than the garment it lies on. */
  grain: { shift: [10, 18] },
  shape: (fill) => (
    <>
      <path d={left.path} fill={fill} />
      <path d={right.path} fill={fill} />
    </>
  ),
  defs: edgeLightDefs,
  shading: collarTone,
  light: (uid) => edgeLight(uid, left.free, right.free),
  edge: () => (
    <>
      <path d={left.free} />
      <path d={right.free} />
    </>
  ),
  /* the Peter Pan's stronger shadow, so a plain collar reads on a busy print — see `FLAT_COLLAR_SHADOW` */
  shadow: FLAT_COLLAR_SHADOW,
};

/**
 * The panels with stripes along their outer edges — braid in a cloth of its
 * own, sewn flat to the collar: drawn on each panel before its light, so it
 * takes the collar's light and the soft edge light runs over it as over the
 * cloth. One, two or three, see `STRIPES`.
 */
const striped = new Map<string, RegionArt>();
const panelsWith = (count: Exclude<StripesId, "none">): RegionArt => {
  let r = striped.get(count);
  if (!r) {
    const bands = STRIPES[count];
    /* along each panel's free edge, on that panel — see `sailorEdges` */
    const inlay = sailorEdges().flatMap((edge) => stripesAlong(edge, bands));
    r = { ...PANELS, inlay };
    striped.set(count, r);
  }
  return r;
};

/** A fold placed relative to the V's point, as the tie is. */
const at = (ridge: Pt[]): Pt[] => ridge.map(([x, y]) => [TIE_AT[0] + x, TIE_AT[1] + y] as Pt);
const fold = (ridge: Pt[], width: [number, number], shadow: number, light: number, soft: number): Fold => ({ ridge: at(ridge), width, shadow, light, soft });
const mirrored = (f: Fold): Fold => ({ ...f, ridge: f.ridge.map(([x, y]) => [2 * TIE_AT[0] - x, y] as Pt) });

/** The knot's folds: the pinch of each loop running out from the knot, and the knot's own wrap. */
const KNOT_LOOP_FOLDS: Fold[] = [
  fold([[-4, -1.2], [-9, -2.2], [-13.4, -3.2]], [0.5, 1.4], 0.26, 0.3, 0.7),
  fold([[-4, 2.2], [-9, 3], [-13.4, 3.8]], [0.5, 1.4], 0.24, 0.28, 0.7),
].flatMap((f) => [f, mirrored(f)]);
const KNOT_FOLDS: Fold[] = [fold([[-1.8, -2.6], [-2.1, 1], [-1.6, 4.6]], [0.5, 0.5], 0.18, 0.22, 0.6), fold([[1.9, -2.6], [2.2, 1], [1.7, 4.6]], [0.5, 0.5], 0.16, 0.2, 0.6)];
const KNOT_TAIL_FOLDS: Fold[] = [fold([[-2, 6], [-4.6, 16], [-7.4, 26]], [0.8, 1.6], 0.14, 0.16, 1)].flatMap((f) => [f, mirrored(f)]);

/** The necktie's folds: a soft crease down the blade, and the knot's wrap. */
const NECKTIE_FOLDS: Fold[] = [fold([[0.6, 9], [0, 32], [0.8, 58]], [0.8, 2.4], 0.14, 0.18, 1.2)];
const NECKTIE_KNOT_FOLDS: Fold[] = [
  fold([[-2.6, -3], [-2.4, 1.5], [-1.8, 6.4]], [0.6, 0.6], 0.18, 0.22, 0.6),
  fold([[2.8, -3], [2.6, 1.5], [2, 6.4]], [0.6, 0.6], 0.16, 0.2, 0.6),
];

/**
 * The tie at the V's point, in the collar's cloth or one of its own — see
 * `sailorTie` for its pieces. Lit as the collar is, cut on the bias; each
 * piece throws the flat collar's soft shadow on what it lies on — the knot on
 * the loops and the blade, the loops on the tails — and its folds stay on it.
 */
function tieArt(kind: "knot" | "necktie"): RegionArt {
  const { pieces, parts } = sailorTie(kind);
  const knotted = kind === "knot";
  return {
    focus: [297, 262],
    outline: "soft",
    /** Cut on the bias, which is why a tie ties and drapes at all. */
    grain: { turn: 45 },
    shape: (fill) => (
      <>
        {pieces.map((d, i) => (
          <path key={i} d={d} fill={fill} />
        ))}
      </>
    ),
    defs: (uid) => (
      <>
        {foldDefs(uid)}
        {edgeLightDefs(uid)}
        {/* each piece's folds on that piece alone, never on what lies over it */}
        <mask id={uid("under-knot")} maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="1000">
          {pieces.slice(0, -1).map((d, i) => (
            <path key={i} d={d} fill="#fff" />
          ))}
          <path d={parts.knot} fill="#000" />
        </mask>
        {knotted && parts.tails && parts.loops && (
          <mask id={uid("tails")} maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="1000">
            {parts.tails.map((d, i) => (
              <path key={i} d={d} fill="#fff" />
            ))}
            {[...parts.loops, parts.knot].map((d, i) => (
              <path key={`o${i}`} d={d} fill="#000" />
            ))}
          </mask>
        )}
      </>
    ),
    shading: (uid) => (
      <>
        {collarTone()}
        {knotted ? (
          <>
            <g mask={`url(#${uid("tails")})`}>{foldShadows(uid, KNOT_TAIL_FOLDS)}</g>
            <g mask={`url(#${uid("under-knot")})`}>{foldShadows(uid, KNOT_LOOP_FOLDS)}</g>
            {foldShadows(uid, KNOT_FOLDS)}
          </>
        ) : (
          <>
            <g mask={`url(#${uid("under-knot")})`}>{foldShadows(uid, NECKTIE_FOLDS)}</g>
            {foldShadows(uid, NECKTIE_KNOT_FOLDS)}
          </>
        )}
      </>
    ),
    light: (uid) => (
      <>
        {edgeLight(uid, ...pieces)}
        {knotted ? (
          <>
            <g mask={`url(#${uid("tails")})`}>{foldLights(uid, KNOT_TAIL_FOLDS)}</g>
            <g mask={`url(#${uid("under-knot")})`}>{foldLights(uid, KNOT_LOOP_FOLDS)}</g>
            {foldLights(uid, KNOT_FOLDS)}
          </>
        ) : (
          <>
            <g mask={`url(#${uid("under-knot")})`}>{foldLights(uid, NECKTIE_FOLDS)}</g>
            {foldLights(uid, NECKTIE_KNOT_FOLDS)}
          </>
        )}
      </>
    ),
    shadow: FLAT_COLLAR_SHADOW,
  };
}
const TIES = { knot: tieArt("knot"), necktie: tieArt("necktie") };

export const sailorCollarFront: GarmentArt = {
  regions: { collar: PANELS },
  /* its stripes along the outer edges, and its tie at the V, as chosen */
  cut: (choice: GarmentChoice) => ({
    collar: choice.stripes?.on.includes("collar") ? panelsWith(choice.stripes.count) : PANELS,
    ...(choice.tie ? { tie: TIES[choice.tie] } : {}),
  }),
};
