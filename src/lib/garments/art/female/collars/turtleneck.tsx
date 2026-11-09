import { line } from "@/lib/garments/fit";
import { standBehind, standFront, standFrontEdges } from "../yoke";
import { behindBandArt } from "../../behindBand";
import { collarTone, edgeLight, edgeLightDefs } from "../../collarLight";
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
 * fastening to topstitch and no centre-front seam to shade.
 *
 * Lit as every collar is — see `collarLight.tsx`: in the cloth's own colour,
 * no line round it, a soft shadow under its edge and a little light along
 * its top, where it is folded.
 */

const BAND_PATH = standFront(24);
const STAND_BEHIND_PATH = standBehind(24);

/** The band's top edge, where it is folded over: it catches the light. */
const TOP_EDGE = line(standFrontEdges(24).top);

export const turtleneckCollarFront: GarmentArt = {
  regions: {
    collar: {
      focus: [300, 176],
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

export const turtleneckCollarBehind = behindBandArt(STAND_BEHIND_PATH);
