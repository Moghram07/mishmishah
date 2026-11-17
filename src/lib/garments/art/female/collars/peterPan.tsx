import { FLAT_COLLAR_SHADOW, collarTone, edgeLight, edgeLightDefs } from "../../collarLight";
import { line, outline, type Pt } from "@/lib/garments/fit";
import { ringsOf } from "@/lib/garments/stripes";
import { peterPan } from "../collarCuts";
import type { NecklineId } from "@/lib/garments/necklines";
import { shirtTieArt } from "../../shirtTieArt";
import { necktieTo, ribbonUnder } from "../../shirtTies";
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
    /* stronger than a soft outline's, so it reads on a busy print — see `FLAT_COLLAR_SHADOW` */
    shadow: FLAT_COLLAR_SHADOW,
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

/**
 * Her ribbon bow under it, on each cut: the collar again, its halves laid
 * over the bow — the stage draws them over the tie, and only there: see
 * `GARMENT_LAYERS`' `fall` — where its two rounded ends meet, at the
 * neckline's centre front, and where the bow's knot sits, just below them:
 * see `ribbonUnder`.
 */
const underCut = new Map<string, { collar: RegionArt; meet: Pt; bow: Pt }>();
const underFor = (cut?: string) => {
  const key = cut ?? "";
  let u = underCut.get(key);
  if (!u) {
    const own = collarFor(cut);
    const halves = peterPan(cut as NecklineId | undefined);
    const meet: Pt = [halves.left[0][0], halves.left[0][1]];
    u = { collar: { ...own, over: { ...own } }, meet, bow: ribbonUnder([ringsOf(outline(halves.left)), ringsOf(outline(halves.right))], meet) };
    underCut.set(key, u);
  }
  return u;
};

export const peterPanCollarFront: GarmentArt = {
  regions: { collar: collarFor() },
  /*
    On the dress, along the cut's own opening. Worn with her ribbon bow, tied
    under it, it draws the bow, just below where its rounded ends meet, and
    lays its halves again over the bow's loops: see `Collar.ties`.
  */
  cut: (choice) => {
    if (!(choice.tieUnder && choice.tie === "bowtie")) return { collar: collarFor(choice.neckline) };
    const { collar, meet, bow } = underFor(choice.neckline);
    return { collar, tie: shirtTieArt("bowtie", "female", { meet, to: necktieTo("female", choice), bow }) };
  },
};
