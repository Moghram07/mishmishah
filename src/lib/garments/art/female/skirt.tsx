import { DRAPE, vertical } from "@/lib/garments/shading";
import { column, draft, foldPlaces, line, type Tuck } from "@/lib/garments/fit";
import { foldDefs, foldLights, foldShadows, rowSpan, skirtFolds } from "@/lib/garments/folds";
import type { GarmentArt, RegionArt } from "../index";

/**
 * A-line skirt, front. It stops above the knee, which is why it declares only
 * the hip in its coverage: a garment may not hide a zone it does not reach, or
 * the renderer erases a thigh nothing fills back in.
 *
 * A `column` — cloth hanging from the waist with no leg split in it, which is
 * what a skirt is. It follows her hip down to the crotch and the outside of her
 * legs below that, flaring as it goes; see `garments/fit.ts`.
 */

/**
 * Where its folds fall across it — seven, from the hip — and so where its hem
 * waves: a little lower wherever a fold reaches it, never higher.
 */
const FOLD_AT = foldPlaces(7, 31);

/** How the skirt is cut: the same numbers worn on its own and under a jacket. */
const SPEC = {
  /*
    Ten units below her measured waist, with a band cut from its own edge:
    18 units, about 3.4 cm, a standard skirt band. It was 34 — six and a half
    centimetres, a corset belt rather than a waistband.
  */
  rise: 10,
  band: 18,
  toY: 660,
  ease: 4,
  flare: 78,
  dip: 18,
  wave: { at: FOLD_AT, depth: 2.2 },
};

const SKIRT = column("female", SPEC);

const BODY_PATH = SKIRT.path;

/** The waistband: the same cloth, cut from the top of the skirt's own edge. */
const WAISTBAND_PATH = SKIRT.band;

/**
 * The skirt worn under a jacket: drawn in under the jacket's hem and flaring
 * from there to its own hem — see `tucked` — for the checker as for the stage.
 */
export const TUCKED = (inside: Tuck) => [column("female", { ...SPEC, inside }).path];

const HIP_Y = draft("female").hipY;

/**
 * The skirt's region, on its own or under a jacket.
 *
 * Darted, not gathered: nothing at the waist but two small darts each side
 * under the band, and soft folds falling to the hem, opening as they go — see
 * `skirtFolds`. They were seven grey wedges fanned from a point. On its own
 * they fall from the hip; under a jacket, from the jacket's hem, where the
 * skirt comes out — so they follow the outline it has there.
 */
const skirtRegion = (inside?: Tuck): RegionArt => {
  const sk = inside ? column("female", { ...SPEC, inside }) : SKIRT;
  const from = inside ? inside.y : HIP_Y;
  const across = rowSpan(sk.path, from) ?? [200, 400];
  const folds = skirtFolds({
    hip: [
      [across[0] + (inside ? 6 : 4), from],
      [across[1] - (inside ? 6 : 4), from],
    ],
    hem: [sk.hemLeft, [600 - sk.hemLeft[0], sk.hemLeft[1]]],
    hemDip: SPEC.dip,
    bandY: sk.waistY + SPEC.band,
    at: FOLD_AT,
    seed: 31,
  });
  return {
    focus: [300, 520],
    surface: { blur: 20, relief: 5, warp: 5 },
    shape: (fill) => <path d={sk.path} fill={fill} />,
    defs: (uid) => (
      <>
        {foldDefs(uid)}
        {vertical(uid("drape"), DRAPE)}
        {vertical(uid("band"), [
          [0, "#ffffff"],
          [1, "#d2d2d2"],
        ])}
      </>
    ),
    shading: (uid) => (
      <>
        <path d={sk.path} fill={`url(#${uid("drape")})`} />
        <path d={sk.band} fill={`url(#${uid("band")})`} />
        {foldShadows(uid, folds)}
      </>
    ),
    light: (uid) => foldLights(uid, folds),
    stitch: [
      sk.bandStitch,
      line([
        [sk.hemLeft[0] + 8, sk.hemLeft[1] - 10],
        [300, sk.hemLeft[1] + 12],
        [592 - sk.hemLeft[0], sk.hemLeft[1] - 10],
      ]),
    ].join(" "),
  };
};

const tuckedRegions = new Map<string, RegionArt>();

export const skirtFront: GarmentArt = {
  regions: { body: skirtRegion() },
  /** Under a jacket, the skirt comes out from under its hem. */
  cut: (choice) => {
    const inside = choice.inside;
    if (!inside) return {};
    const key = `${inside.y}|${inside.x}`;
    if (!tuckedRegions.has(key)) tuckedRegions.set(key, skirtRegion(inside));
    return { body: tuckedRegions.get(key)! };
  },
};
