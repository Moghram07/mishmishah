import { PLACKET_BOWS, blade, shrink, type Point } from "@/lib/garments/collar";
import { collarTone, edgeLight, edgeLightDefs } from "./collarLight";
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
 * Lit as a collar is — see `collarLight.tsx`: the garment's own colour, no
 * line round it, a soft shadow on the shirt under its edges and a little light
 * along its folded ones. It used to be outlined, shadowed with a hard dark rim
 * and shaded darker toward both edges, which read as a strip of darker cloth
 * laid down the front.
 *
 * Shared by his shirt, polo and thobe and by her blouse, which differ only in
 * how far down the band runs, how wide it is, and where it starts under the
 * collar.
 */

/** A hair of barrel on the long edges, and square across the ends — see `collar.ts`. */
export { PLACKET_BOWS };

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
  outline: "soft",
  shape: (fill) => <path d={path} fill={fill} />,
  defs: edgeLightDefs,
  shading: collarTone,
  /* folded and pressed along both long edges, and turned in at its foot: a little light just inside them */
  light: (uid) => edgeLight(uid, path),
  stitch: placketStitch(corners),
});
