import { standBehind, standGapped, standGappedEdges } from "../yoke";
import { behindBandArt } from "../../behindBand";
import { collarTone, edgeLight, edgeLightDefs } from "../../collarLight";
import { line } from "@/lib/garments/fit";
import type { GarmentArt } from "../../index";

/**
 * Mandarin collar: a short band standing round the neck, its two ends meeting
 * at the throat.
 *
 * Built as his is (`male/collars/mandarin.tsx`): a smooth band hugging the
 * neck, its top corners softly rounded, the ends meeting at centre front with
 * only a tiny V between them — about half a centimetre across at the top,
 * closing to nothing at the seam. It used to be open in a deep rounded U cut
 * most of the way down the band, and the band read as a ring round the neck
 * with a bite out of it.
 *
 * **Shorter than the turtleneck**: a mandarin is a few centimetres of cloth at
 * the base of the neck, a turtleneck as tall as the neck — fourteen units of
 * stand against twenty-four. And open, where the turtleneck is unbroken.
 *
 * Two pieces. `BAND_PATH` is the front; `STAND_BEHIND_PATH` is the same band
 * drawn under the photograph, and what shows of it is the arc round the back
 * of the neck. Without that second piece a band stops dead at the silhouette
 * and reads as a stripe painted on a throat.
 */

/** Fourteen units of stand, about 2.7 cm; the V a unit and a half either side of the centre at the top. */
const RISE = 14;
const V_HALF = 1.5;
const BAND_PATH = standGapped(RISE, V_HALF);
const STAND_BEHIND_PATH = standBehind(RISE);

/** The band's top edge — the fold it is turned on — and the ends' edges down the V: where it catches the light. */
const TOP_EDGE = line(standGappedEdges(RISE, V_HALF).top);

export const mandarinCollarFront: GarmentArt = {
  regions: {
    collar: {
      focus: [300, 180],
      outline: "soft",
      /**
       * Cut across the grain, which is how a band is cut — it has to bend round
       * a throat without dragging, and a crossgrain strip does that where a
       * straight-grain one fights it. It is also the cut that breaks a stripe
       * at the neckline, so the band stops reading as painted on.
       */
      grain: { turn: 90 },
      shape: (fill) => <path d={BAND_PATH} fill={fill} />,
      defs: edgeLightDefs,
      shading: collarTone,
      light: (uid) => edgeLight(uid, TOP_EDGE),
    },
  },
};

export const mandarinCollarBehind = behindBandArt(STAND_BEHIND_PATH);
