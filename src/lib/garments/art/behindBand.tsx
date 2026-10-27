import { vertical } from "@/lib/garments/shading";
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
 * It is shaded darker than the front of the band, because the back of a collar
 * is turned away from the light and lies in the shadow of the head — but only
 * a little darker. At 55% it stopped reading as cloth at all: the sliver that
 * shows is a few units wide, so the fabric's pattern barely registers across
 * it, and a heavy multiply turned the whole thing into a grey rim round the
 * throat that looked like a rendering seam. Shadow has to stay light enough
 * that you can still see what cloth is in it.
 */

const UNDER: [number, string][] = [
  [0, "#bdbdbd"],
  [0.45, "#dcdcdc"],
  [1, "#b6b6b6"],
];

/** One shared drawing, given the band's own outline. */
export const behindBandArt = (path: string): GarmentArt => ({
  regions: {
    collar: {
      focus: [300, 170],
      shape: (fill) => <path d={path} fill={fill} />,
      defs: (uid) => vertical(uid("under"), UNDER),
      shading: (uid) => <path d={path} fill={`url(#${uid("under")})`} />,
    },
  },
});
