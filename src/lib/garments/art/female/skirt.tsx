import { DRAPE, vertical } from "@/lib/garments/shading";
import { line, type Tuck } from "@/lib/garments/fit";
import { foldDefs, foldLights, foldShadows, rowSpan, skirtFolds } from "@/lib/garments/folds";
import { sameSkirt, skirtKey } from "@/lib/garments/skirts";
import type { SkirtChoice } from "@/types";
import type { GarmentArt, RegionArt } from "../index";
import { DEFAULT_SKIRT, FINISH, FOLD_AT, HIP_Y, skirtFor } from "./skirtCut";

/**
 * Skirt, front. As it arrives it stops above the knee, which is why it
 * declares only the hip in its coverage: a garment may not hide a zone it does
 * not reach, or the renderer erases a thigh nothing fills back in.
 *
 * A `column` — cloth hanging from the waist with no leg split in it, which is
 * what a skirt is. It follows her hip down to the crotch and the outside of her
 * legs below that, flaring as it goes; see `garments/fit.ts`. It is cut to a
 * style from the parts it shares with the dress's skirt — see `skirts.ts` —
 * and its geometry lives in `skirtCut.ts`, where `check:garments` reads it.
 */

/**
 * The skirt's region, in a style, on its own or under a jacket.
 *
 * Darted, not gathered: nothing at the waist but two small darts each side
 * under the band, and soft folds falling to the hem, opening as they go — see
 * `skirtFolds`. They were seven grey wedges fanned from a point. On its own
 * they fall from the hip; under a jacket, from the jacket's hem, where the
 * skirt comes out — so they follow the outline it has there.
 */
const skirtRegion = (inside?: Tuck, skirt: SkirtChoice = DEFAULT_SKIRT): RegionArt => {
  const sk = skirtFor(inside, skirt);
  const from = inside ? inside.y : HIP_Y;
  const across = rowSpan(sk.path, from) ?? [200, 400];
  const folds = skirtFolds({
    hip: [
      [across[0] + (inside ? 6 : 4), from],
      [across[1] - (inside ? 6 : 4), from],
    ],
    hem: [sk.hemLeft, [600 - sk.hemLeft[0], sk.hemLeft[1]]],
    hemDip: FINISH.dip,
    bandY: sk.waistY + (FINISH.band ?? 0),
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

const styledRegions = new Map<string, RegionArt>();

export const skirtFront: GarmentArt = {
  regions: { body: skirtRegion() },
  /** Cut to a style, or worn under a jacket, where it comes out from under its hem. */
  cut: (choice) => {
    const { inside, skirt = DEFAULT_SKIRT } = choice;
    if (!inside && sameSkirt(skirt, DEFAULT_SKIRT)) return {};
    const key = `${skirtKey(skirt)}|${inside ? `${inside.y}|${inside.x}` : ""}`;
    if (!styledRegions.has(key)) styledRegions.set(key, skirtRegion(inside, skirt));
    return { body: styledRegions.get(key)! };
  },
};
