import { nudge } from "@/lib/garments/collar";
import { standBehind, standFront } from "../yoke";
import { behindBandArt } from "../../behindBand";
import { bandFront } from "./band";

/**
 * The short regular collar, «رقبة عادي قصير»: the regular collar's band cut
 * lower, its tab buttoned with one button — see `regular.tsx`. Offered on his
 * shirt and his polo.
 */

/** Thirteen units of stand, about 2.5 cm, against the regular collar's twenty. */
const BAND_PATH = standFront(13);
const STAND_BEHIND_PATH = standBehind(13);

/** The band's lower edge, dropped onto the garment it is sewn to. */
const BAND_CAST_PATH = nudge(BAND_PATH, 0, 3);

export const maleRegularShortCollarFront = bandFront({ band: BAND_PATH, cast: BAND_CAST_PATH, rise: 13, closes: "tab", buttons: 1 });

export const maleRegularShortCollarBehind = behindBandArt(STAND_BEHIND_PATH);
