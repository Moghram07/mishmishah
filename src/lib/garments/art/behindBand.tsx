import { collarTone } from "./collarLight";
import type { GarmentArt } from "./index";

/**
 * The arc of a collar band that passes behind the neck.
 *
 * Drawn under the mannequin photograph, so all that shows is the sliver either
 * side of the throat and the curve above it. Every standing collar on either
 * body uses this same drawing — they all wrap *a* neck, and what differs
 * between them is what happens in *front*, which is where their character
 * lives. The band's own outline is passed in, and that is where the difference
 * between one neck and another already lives: each body's `yoke.ts` measures
 * its own throat and builds `standBehind` from it.
 *
 * In the cloth's own colour, with no line round it. It used to be shaded
 * darker than the front — the back of a collar turned from the light — and,
 * drawn under the photograph with nothing beneath its edges, it took the
 * page's rim all round: the sliver either side of the throat read as a dark
 * line beside the neck. A collar is lit as a seam is now (see
 * `collarLight.tsx`), and this is the same band as its front.
 */

/** One shared drawing, given the band's own outline. */
export const behindBandArt = (path: string): GarmentArt => ({
  regions: {
    collar: {
      focus: [300, 170],
      outline: "soft",
      shape: (fill) => <path d={path} fill={fill} />,
      shading: collarTone,
    },
  },
});
