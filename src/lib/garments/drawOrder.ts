/**
 * The order the stage draws each worn garment's own parts in, back to front
 * — see `MannequinStage`. A part later in the list lies over an earlier one
 * wherever the two meet. One list, two readers: the stage draws by it, and
 * `check:garments` judges by it what shows where two parts meet.
 *
 *   • `cloth` — its regions, each in its fabric: a dress's bodice, with its
 *     placket and its wrap's edge, and its skirt, with its placket.
 *   • `buttons` — its hardware as cut: a placket's buttons, a keyhole's.
 *   • `collar` — sewn on top of the neckline it closes, its stripes on it.
 *   • `belt` — cloth worn over all of those: a belt, or a sash and its bow
 *     (`RegionArt.over`; a trouser's belt loops too). A belt goes on over the
 *     dress, so it covers whatever of the dress reaches the waist: the end of
 *     a collar run down a wrap's edge, its stripes, the placket and the last
 *     button. Her sleeves still hang in front of it at her sides — the belt
 *     is cut away under them: see `RegionArt.under`.
 *   • `buckle` — a belt's buckle, on the belt.
 *   • `tie` — over the collar it is knotted at, or the belt it is tied on: a
 *     tie on the belt is its knot or bow; one at the neck hangs over all.
 *   • `trim`, `cuffs`, `collarTrim`, `bandButtons` — hardware on its opening,
 *     its cuffs and its collar's band, last, as they always were.
 *
 * Whatever is worn over the garment — a jacket — is another garment, drawn
 * after this one and holding it inside: it covers the belt as it covers the
 * rest.
 */
export const GARMENT_LAYERS = ["cloth", "buttons", "collar", "belt", "buckle", "tie", "trim", "cuffs", "collarTrim", "bandButtons"] as const;

export type GarmentLayer = (typeof GARMENT_LAYERS)[number];
