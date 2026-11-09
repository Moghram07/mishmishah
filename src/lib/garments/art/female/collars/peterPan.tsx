import { collarTone, edgeLight, edgeLightDefs } from "../../collarLight";
import { mirror } from "@/lib/garments/collar";
import { line, outline, type Pt } from "@/lib/garments/fit";
import { peterPan } from "../collarCuts";
import type { NecklineId } from "@/lib/garments/necklines";
import type { GarmentArt, RegionArt } from "../../index";

/**
 * Peter Pan collar: two flat rounded halves meeting at centre front.
 *
 * Flat is the whole of it — no stand, nothing standing up at the throat, the
 * collar lying straight out on the neckline. So **it is cut from the neckline**
 * rather than drawn near it: `flatCollar` takes the same opening the garment
 * cuts and returns the band of cloth lying outside it, which makes the collar's
 * inner edge the seam itself by construction.
 *
 * That is not a tidier way of writing the old shape; it is the fix. The old one
 * was five hand-typed corners, and the two that mattered were wrong in the same
 * direction: its ends rose to y 179, level with the throat, while its inner
 * edge dipped only to 196 — against an opening that dips to 212. A collar whose
 * inner edge sits *above* the neckline does not lie outside the opening, it
 * covers the top of it, and what the neck then comes up through is a small
 * round hole in the collar. Head-on that is a ring around the neck, which is
 * exactly how it was reported. `check:garments` now measures the drawing
 * against the seam of every garment it is sewn to, so it cannot come back.
 *
 * The ends taper to points. A flat collar carried round at full width would
 * stand out sideways at neck height on both sides; in a front view the end of
 * one is where the cloth turns to go behind the shoulder, and it should thin
 * away there rather than stop square.
 *
 * The two halves meet at centre front and do not overlap, so each is its own
 * path — overlapping subpaths of one path cancel where they cross, and a
 * mirrored one winds the other way.
 */

/**
 * The collar on one opening, from its two halves — see `peterPan` in
 * `collarCuts.ts`, which cuts them from the neckline it is sewn to: a top's
 * crew neck, or the dress's own cut, so that on a scoop it lies along the
 * scoop and on a boat along the boat's wide, shallow line.
 *
 * On a top, as it always was, each piece on the right is the left's
 * reflected about the canvas centre. On the dress's cuts the right half's
 * edge and shadow are its own: a cut is symmetric about her neck, three units
 * left of the centre, and the reflected ones landed beside the cloth.
 */
function collarOn(halves: { left: Pt[]; right: Pt[]; free: [Pt[], Pt[]] }, ownRight: boolean): RegionArt {
  const HALF_LEFT_PATH = outline(halves.left);
  const HALF_RIGHT_PATH = outline(halves.right);
  /* the free edge: the outer run only — see `peterPan` — never the neckline or the centre-front join */
  const FREE_EDGE = line(halves.free[0]);
  const FREE_EDGE_RIGHT = ownRight ? line(halves.free[1]) : mirror(FREE_EDGE);
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
      a soft shadow under its edge, which its outline throws (the right half's
      on the left, at the centre front, where one lies a little over the
      other), and a little light along the free edge, where it rolls.
    */
    shading: collarTone,
    light: (uid) => edgeLight(uid, FREE_EDGE, FREE_EDGE_RIGHT),
  };
}

/** The collar on each cut it has been sewn to, drawn once. */
const onCut = new Map<string, RegionArt>();
const collarFor = (cut?: string): RegionArt => {
  const key = cut ?? "";
  let r = onCut.get(key);
  if (!r) {
    r = collarOn(peterPan(cut as NecklineId | undefined), cut !== undefined);
    onCut.set(key, r);
  }
  return r;
};

export const peterPanCollarFront: GarmentArt = {
  regions: { collar: collarFor() },
  /* on the dress, along the cut's own opening */
  cut: (choice) => ({ collar: collarFor(choice.neckline) }),
};
