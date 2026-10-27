import { nudge } from "@/lib/garments/collar";
import { standBehind, standFront } from "../yoke";
import { behindBandArt } from "../../behindBand";
import { bandFront } from "./band";

/**
 * The regular thobe collar, «رقبة عادي» on the chart: a band standing round
 * the neck, one end running on past the centre into a tab that buttons over
 * the other end with two buttons, one above the other. Most Saudi thobes have
 * it, and the thobe arrives in it.
 *
 * It was filed as a mandarin, and drawn with its two ends meeting edge to edge
 * and one button on the band. A mandarin is a different collar — see
 * `mandarin.tsx` — and a thobe's band is not closed that way.
 *
 * Two pieces. `BAND_PATH` is the front of the band, following his throat's own
 * silhouette in; `STAND_BEHIND_PATH` is the same band drawn under the
 * photograph, and what shows of it is the arc round the back of the neck.
 */

/** Twenty units of stand, about 3.8 cm — the band's height, as a tailor measures it. */
const BAND_PATH = standFront(20);
const STAND_BEHIND_PATH = standBehind(20);

/** The band's lower edge, dropped onto the garment it is sewn to. */
const BAND_CAST_PATH = nudge(BAND_PATH, 0, 3);

export const maleRegularCollarFront = bandFront({ band: BAND_PATH, cast: BAND_CAST_PATH, rise: 20, closes: "tab", buttons: 2 });

export const maleRegularCollarBehind = behindBandArt(STAND_BEHIND_PATH);
