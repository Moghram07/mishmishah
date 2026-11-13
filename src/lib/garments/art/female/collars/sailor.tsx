import { FLAT_COLLAR_SHADOW, collarTone, edgeLight, edgeLightDefs } from "../../collarLight";
import { SAILOR_CUTS, sailor, sailorEdges, sailorOn, type SailorCut, type SailorPiece } from "../collarCuts";
import type { SleeveChoice } from "@/lib/garments/sleeves";
import { STRIPES, stripesAlong } from "@/lib/garments/stripes";
import type { StripesId, WaistId } from "@/types";
import type { GarmentArt, GarmentChoice, RegionArt } from "../../index";

/** The cuts it is drawn to other than the V. */
const SAILOR_ON = SAILOR_CUTS.filter((c) => c !== "v");

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

/**
 * The collar on the other cuts it follows — round a boat, a round neck or a
 * square, or down a wrap's two edges: the same light, shadow and grain as
 * the V's panels, its pieces cut to that neckline — see `sailorOn` — each
 * with its stripes, as chosen, along its outer edge. Cached per cut, waist
 * (which a wrap's edge runs to) and count.
 */
const FOCUS: Record<Exclude<SailorCut, "v">, [number, number]> = { boat: [300, 212], round: [300, 215], square: [300, 232], scoop: [300, 228], wrap: [300, 262] };
const onCut = new WeakMap<SailorPiece[], Map<StripesId, RegionArt>>();
function collarOn(cut: Exclude<SailorCut, "v">, waist: WaistId, sleeve: SleeveChoice | undefined, count: StripesId): RegionArt {
  /* one per collar as cut — the same pieces wherever the bodice is the same — and count */
  const pieces = sailorOn(cut, waist, sleeve);
  let byCount = onCut.get(pieces);
  if (!byCount) onCut.set(pieces, (byCount = new Map()));
  let r = byCount.get(count);
  if (!r) {
    r = {
      ...PANELS,
      focus: FOCUS[cut],
      shape: (fill) => (
        <>
          {pieces.map((p, i) => (
            <path key={i} d={p.path} fill={fill} />
          ))}
        </>
      ),
      light: (uid) => edgeLight(uid, ...pieces.map((p) => p.free)),
      edge: () => (
        <>
          {pieces.map((p, i) => (
            <path key={i} d={p.free} />
          ))}
        </>
      ),
      ...(count !== "none" ? { inlay: sailorEdges(cut, waist, sleeve).flatMap((edge) => stripesAlong(edge, STRIPES[count])) } : {}),
    };
    byCount.set(count, r);
  }
  return r;
}

export const sailorCollarFront: GarmentArt = {
  regions: { collar: PANELS },
  /* its stripes along the outer edges, as chosen; a tie over it is the dress's — see `tieArt` */
  cut: (choice: GarmentChoice) => {
    const striped = choice.stripes?.on.includes("collar") ? choice.stripes.count : "none";
    const cut = choice.neckline;
    /* on the V, its panels as approved; on the other cuts it follows, cut to each */
    if (cut && cut !== "v" && (SAILOR_ON as readonly string[]).includes(cut))
      return { collar: collarOn(cut as Exclude<SailorCut, "v">, choice.skirt?.waist ?? "natural", choice.sleeve, striped) };
    return { collar: striped !== "none" ? panelsWith(striped) : PANELS };
  },
};
