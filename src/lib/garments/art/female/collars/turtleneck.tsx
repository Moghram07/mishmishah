import { softShadow } from "@/lib/garments/shading";
import { nudge } from "@/lib/garments/collar";
import { standBehind, standFront } from "../yoke";
import { behindBandArt } from "../../behindBand";
import type { GarmentArt } from "../../index";

/**
 * Turtleneck: one clean band standing round the throat.
 *
 * This is the shape that used to be filed as the Mandarin collar, and the two
 * have swapped places because that is what each of them actually looks like: a
 * plain unbroken tube of cloth rising up the neck is a turtleneck, and a
 * mandarin is the shorter band that *opens* at the front. Only the drawings
 * moved — both records keep their id, their name and their asset id.
 *
 * What it replaced was a taller ribbed tube with a fold line near the top,
 * reaching y 223 and claiming the `neck` zone. Nothing of that survives.
 *
 * Two pieces, and the second is the one that matters. `BAND_PATH` is the front
 * of the band, sewn to the garment's `high` opening at the base of the neck and
 * following the throat's own silhouette in; `STAND_BEHIND_PATH` is the same
 * band drawn *under* the photograph, and what shows of it is the arc round the
 * back of the neck. Without that second piece a band stops dead at the
 * silhouette and reads as a stripe painted on a throat.
 *
 * **No stitching and no closure.** A turtleneck is unbroken knit: it has no
 * fastening to topstitch and no centre-front seam to shade. Both were on this
 * shape when it was the Mandarin, and both belong to the Mandarin.
 */

const BAND_PATH = standFront(24);
const STAND_BEHIND_PATH = standBehind(24);

/**
 * The band's lower edge, dropped onto the garment it is sewn to.
 *
 * The simplest collar in the wardrobe and therefore the one with least to hide:
 * with nothing at the join it is a stripe lying flat on a chest, however
 * carefully the band itself is shaded.
 */
const BAND_CAST_PATH = nudge(BAND_PATH, 0, 3);

export const turtleneckCollarFront: GarmentArt = {
  regions: {
    collar: {
      focus: [300, 176],
      surface: { blur: 4, relief: 4, warp: 2 },
      /**
       * Cut across the grain, which is how a band is cut — it has to bend round
       * a throat without dragging, and a crossgrain strip does that where a
       * straight-grain one fights it. It is also the cut that breaks a stripe
       * at the neckline, so the band stops reading as painted on.
       */
      grain: { turn: 90 },
      shape: (fill) => <path d={BAND_PATH} fill={fill} />,
      /*
        The band's form used to be a left-to-right ramp across it, because a
        band round a throat is the tightest cylinder in the wardrobe and a
        top-to-bottom ramp on one says "flat panel". `surface` reads that turn
        off the band's own outline instead, so the only thing left to declare
        here is the blur the contact shadow needs.
      */
      defs: (uid) => softShadow(uid("soft"), 3),
      cast: (uid) => (
        <path
          d={BAND_CAST_PATH}
          fill="#7a7a7a"
          opacity="0.4"
          filter={`url(#${uid("soft")})`}
        />
      ),
    },
  },
};

export const turtleneckCollarBehind = behindBandArt(STAND_BEHIND_PATH);
