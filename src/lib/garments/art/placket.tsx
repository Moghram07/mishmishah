import { horizontal } from "@/lib/garments/shading";
import { PLACKET_BOWS, blade, shrink, type Point } from "@/lib/garments/collar";
import type { RegionArt } from "./index";

/**
 * The placket: the band of doubled cloth a shirt's buttons go through.
 *
 * Its own region, and pointedly not part of the collar. On all three male tops
 * it was drawn *inside* the collar's path, which made it take the collar's
 * cloth — a contrast placket by accident — and, more to the point, meant the
 * collar could not be lifted out of the garment and made swappable without
 * dragging the placket with it. They are two pieces on a real shirt and they
 * are two regions here, so the accident is now a choice anybody can make.
 *
 * Long straight edges with the faintest barrel. A placket genuinely *is*
 * straight — it is a folded, pressed, topstitched band — which makes it the one
 * piece in this wardrobe that should not read as curved. Everything else here
 * was fixed by bending it; this one is right because it is not bent.
 *
 * Shared by his shirt, polo and thobe and by her blouse, which differ only in
 * how far down the band runs, how wide it is, and where it starts under the
 * collar.
 */

/** A hair of barrel on the long edges, and square across the ends — see `collar.ts`. */
export { PLACKET_BOWS };

/** The band widened, for the thin rim of shadow it drops either side. */
const placketCast = (corners: Point[]) =>
  blade(
    corners.map(([x, y]) => [x < 300 ? x - 2 : x + 2, y] as Point),
    PLACKET_BOWS
  );

/** The fold and the two rows of topstitch, derived from the band itself. */
const placketStitch = (corners: Point[]) =>
  `${blade(shrink(corners, 4), PLACKET_BOWS)} ` +
  `${blade(shrink(corners, 8), PLACKET_BOWS)}`;

/**
 * One placket, given the path the drawing declares and the corners it was
 * built from. The path is passed in rather than rebuilt so that the shape the
 * browser draws and the shape `check:garments` measures are the same string.
 */
export const placketArt = (path: string, corners: Point[]): RegionArt => ({
  focus: [300, 280],
  /** Cut down the length of the roll, as a placket is. */
  grain: { shift: [0, 9] },
  shape: (fill) => <path d={path} fill={fill} />,
  defs: (uid) => (
    <>
      {/*
        Across the band: a placket is two or three thicknesses of cloth and
        stands proud of the shirt, so it catches the light along its middle and
        falls away at both folded edges.
      */}
      {horizontal(uid("band"), [
        [0, "#b4b4b4"],
        [0.3, "#ffffff"],
        [0.7, "#f2f2f2"],
        [1, "#adadad"],
      ])}
    </>
  ),
  cast: () => (
    // Hard-edged on purpose. A pressed edge lying flat on cloth throws a rim,
    // not a pool — the soft blur the collars use would read as a bulge here.
    <path d={placketCast(corners)} fill="#8f8f8f" opacity="0.18" />
  ),
  shading: (uid) => <path d={path} fill={`url(#${uid("band")})`} />,
  stitch: placketStitch(corners),
});
