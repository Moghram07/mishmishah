import {
  softShadow,
} from "@/lib/garments/shading";
import { nudge } from "@/lib/garments/collar";
import { standBehind, standNotched } from "../yoke";
import { behindBandArt } from "../../behindBand";
import type { GarmentArt } from "../../index";

/**
 * Mandarin collar: a short band standing round the neck, open at the front.
 *
 * The opening is the whole point, and it is what this collar did not have. The
 * shape filed here before was an unbroken band with the closure drawn as a
 * *shadow* down the middle — and an unbroken band rising up a throat is a
 * turtleneck, which is where that shape now lives. A mandarin's two ends meet
 * at the throat with a real gap between them and the facing edges rounded off.
 *
 * It is also **shorter**. A mandarin band is a few centimetres of cloth at the
 * base of the neck; a turtleneck is as tall as the neck. Drawn to the same
 * height the two are the same collar twice, which `check:garments` says out
 * loud — it rejects two collars whose boxes agree on both axes.
 *
 * Two pieces. `BAND_PATH` is the front, notched; `STAND_BEHIND_PATH` is the
 * same band drawn under the photograph, and what shows of it is the arc round
 * the back of the neck. Without that second piece a band stops dead at the
 * silhouette and reads as a stripe painted on a throat.
 */

/**
 * Fourteen units of stand, with the opening cut almost the whole way down it.
 *
 * The gap has to be deep to read as a gap. Cut a third of the way in it looks
 * like a dent in the top edge; taken to within ten units of the lower edge the
 * band visibly *parts* at the throat, which is the one thing that tells a
 * mandarin from a turtleneck at a glance. The ten units it stops short of are
 * not slack either — the garment's high neckline seam sits at y 189, and cloth
 * has to cover it.
 */
const BAND_PATH = standNotched(14, 6, 17);
const STAND_BEHIND_PATH = standBehind(14);

/** The band's lower edge, dropped onto the garment it is sewn to. */
const BAND_CAST_PATH = nudge(BAND_PATH, 0, 3);


export const mandarinCollarFront: GarmentArt = {
  regions: {
    collar: {
      focus: [300, 180],
      surface: { blur: 4, relief: 4, warp: 2 },
      /**
       * Cut across the grain, which is how a band is cut — it has to bend round
       * a throat without dragging, and a crossgrain strip does that where a
       * straight-grain one fights it. It is also the cut that breaks a stripe
       * at the neckline, so the band stops reading as painted on.
       */
      grain: { turn: 90 },
      shape: (fill) => <path d={BAND_PATH} fill={fill} />,
      defs: (uid) => (
        <>
          {softShadow(uid("soft"), 3)}
        </>
      ),
      cast: (uid) => (
        <path
          d={BAND_CAST_PATH}
          fill="#7a7a7a"
          opacity="0.4"
          filter={`url(#${uid("soft")})`}
        />
      ),
      shading: (uid) => (
        <>
        </>
      ),
    },
  },
};

export const mandarinCollarBehind = behindBandArt(STAND_BEHIND_PATH);
