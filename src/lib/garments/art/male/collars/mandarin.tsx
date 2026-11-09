import { standBehind, standGapped, standGappedEdges } from "../yoke";
import { behindBandArt } from "../../behindBand";
import { bandFront } from "./band";

/**
 * Mandarin collar, male, «رقبة صيني» on the chart: a band standing round the
 * neck, its two ends stopping short of the centre front, with no button on
 * it. They leave a small V there, their top corners softly rounded, and the
 * V's point is on the band's seam over the placket's middle — so band and
 * placket make a T, and the placket's first button sits just under the band.
 *
 * Built as hers is, a plain band with no fall and a gap at the front, and
 * sized for his neck: hers stands fourteen units on a throat about 37 across,
 * his is 43, so his stands sixteen, about 3 cm. Its gap is eight units across
 * at the top, about 1.5 cm, closing to the seam.
 *
 * The collar that used to be filed under this name was the regular thobe
 * collar — see `regular.tsx`.
 */
const BAND_PATH = standGapped(16, 4);
const STAND_BEHIND_PATH = standBehind(16);


export const maleMandarinCollarFront = bandFront({ band: BAND_PATH, rise: 16, closes: "gap", buttons: 0, top: standGappedEdges(16, 4).top });

export const maleMandarinCollarBehind = behindBandArt(STAND_BEHIND_PATH);
