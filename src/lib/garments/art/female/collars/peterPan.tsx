import { collarTone, edgeLight, edgeLightDefs } from "../../collarLight";
import { line, outline, type Pt } from "@/lib/garments/fit";
import { peterPan } from "../collarCuts";
import type { NecklineId } from "@/lib/garments/necklines";
import type { GarmentArt, RegionArt } from "../../index";

/**
 * Peter Pan collar: two small flat halves, rounded at the front, their ends
 * just meeting at the neck.
 *
 * Flat is the whole of it — no stand, nothing standing up at the throat, the
 * collar lying on the garment right round its neckline. So **it is cut from
 * the neckline** rather than drawn near it: `flatCollar` takes the same
 * opening the garment cuts and returns the cloth lying outside it, which makes
 * the collar's inner edge the seam itself by construction.
 *
 * Small and even: about 5.7 cm of cloth across from the seam, the whole way
 * round — see `PETER_PAN`. Each half's front end turns round a quarter circle
 * from the centre-front point, so the two touch at the neck and part below it
 * over a small V of the garment, with no line down the middle; and at its back
 * each turns over the shoulder, its end lying along the shoulder line. It used
 * to be a single band 6.5 cm deep at centre front, its halves butted square
 * down the middle and narrowing toward the shoulders: a bib, with a line
 * through it.
 *
 * The two halves are separate paths — overlapping subpaths of one path cancel
 * where they cross, and a mirrored one winds the other way.
 */

/**
 * The shadow under a Peter Pan's free edge: stronger and a little wider than
 * a soft outline's (0.3, 3.2 wide, blurred 2), still no line. Two layers of
 * cloth lying flat on the dress have no other edge, and at the soft outline's
 * strength the collar all but disappeared into a busy print at whole-figure
 * size.
 */
const PETER_PAN_SHADOW = { opacity: 0.55, width: 5.2, soft: 2.8 };

/**
 * The collar on one opening, from its two halves — see `peterPan` in
 * `collarCuts.ts`, which cuts them from the neckline it is sewn to and the
 * shoulders it turns over: a top's crew neck, or the dress's own cut, so that
 * on a scoop it lies along the scoop and on a boat along the boat's wide,
 * shallow line.
 */
function collarOn(halves: { left: Pt[]; right: Pt[]; free: [Pt[], Pt[]] }): RegionArt {
  const HALF_LEFT_PATH = outline(halves.left);
  const HALF_RIGHT_PATH = outline(halves.right);
  /* the free edges: each half's outer run only — never the neckline, nor the shoulder it lies along */
  const FREE_EDGE = line(halves.free[0]);
  const FREE_EDGE_RIGHT = line(halves.free[1]);
  return {
    focus: [300, 214],
    outline: "soft",
    /**
     * Cut across the grain, which is how a flat collar is cut so that it
     * turns the corner round a neckline without dragging. It is also what
     * breaks a stripe at the seam, so the collar stops looking printed on.
     */
    grain: { turn: 90 },
    shape: (fill) => (
      <>
        <path d={HALF_LEFT_PATH} fill={fill} />
        <path d={HALF_RIGHT_PATH} fill={fill} />
      </>
    ),
    defs: edgeLightDefs,
    /*
      In the garment's light, with no line round it — see `collarLight.tsx`.
      What separates a same-cloth Peter Pan from the dress is its thickness:
      a soft shadow under its edge, and a little light along its free edge,
      where it rolls.
    */
    shading: collarTone,
    light: (uid) => edgeLight(uid, FREE_EDGE, FREE_EDGE_RIGHT),
    /*
      The shadow under its free edges only: the neckline is a seam, and a
      seam throws none — round the throat it is the dress's own edge that
      lies on the skin.
    */
    edge: () => (
      <>
        <path d={FREE_EDGE} />
        <path d={FREE_EDGE_RIGHT} />
      </>
    ),
    shadow: PETER_PAN_SHADOW,
  };
}

/** The collar on each cut it has been sewn to, drawn once. */
const onCut = new Map<string, RegionArt>();
const collarFor = (cut?: string): RegionArt => {
  const key = cut ?? "";
  let r = onCut.get(key);
  if (!r) {
    r = collarOn(peterPan(cut as NecklineId | undefined));
    onCut.set(key, r);
  }
  return r;
};

export const peterPanCollarFront: GarmentArt = {
  regions: { collar: collarFor() },
  /* on the dress, along the cut's own opening */
  cut: (choice) => ({ collar: collarFor(choice.neckline) }),
};
