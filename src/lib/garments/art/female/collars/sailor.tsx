import { FLAT_COLLAR_SHADOW, collarTone, edgeLight, edgeLightDefs } from "../../collarLight";
import { sailor } from "../collarCuts";
import type { GarmentArt, RegionArt } from "../../index";

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
 * The trim: two thin stripes along each panel's outer edge, in a cloth of
 * their own — see `SAILOR_STRIPES`. A braid sewn flat to the collar, lit as
 * the collar is; it is all but level with the cloth under it, so it throws
 * only the faintest shadow, which at a soft outline's strength made each
 * stripe a blurred band twice its width.
 */
const TRIM: RegionArt = {
  focus: [300, 222],
  outline: "soft",
  shape: (fill) => (
    <>
      {[...left.stripes, ...right.stripes].map((d, i) => (
        <path key={i} d={d} fill={fill} />
      ))}
    </>
  ),
  shading: collarTone,
  shadow: { opacity: 0.12, width: 1.6, soft: 0.8 },
};

export const sailorCollarFront: GarmentArt = {
  regions: { collar: PANELS, trim: TRIM },
};
