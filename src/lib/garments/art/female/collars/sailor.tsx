import { collarTone, edgeLight, edgeLightDefs } from "../../collarLight";
import { blade, mirror, type Point } from "@/lib/garments/collar";
import { reflect, standBehind } from "../yoke";
import { SAILOR_BOWS, SAILOR_PANEL, sailor } from "../collarCuts";
import type { NecklineId } from "@/lib/garments/necklines";
import { behindBandArt } from "../../behindBand";
import type { GarmentArt, RegionArt } from "../../index";

/**
 * Sailor collar: two panels across the whole shoulder, tapering to a V at the
 * chest, with the square back it is known for hidden behind the figure.
 *
 * The largest of the nine by a distance, and that is the defining fact about it
 * rather than a detail — a sailor collar that stops short of the shoulder is a
 * bib. The panels run out to the shoulder seam and down below the bust.
 *
 * It claims no zone even so, and the open V is why: `upperChest` runs the full
 * width of the chest and this collar deliberately leaves the middle of it bare,
 * so it does not cover the zone end to end and may not name it. Spreading over
 * a zone is not covering it.
 *
 * What was wrong with it was not the size but the edges: five straight lines
 * per panel, which on a piece this large is unmissable — it read as a paper
 * pentagon with a wedge cut out. A panel of cloth this broad hangs, and every
 * edge of it curves.
 */

/**
 * The back of the collar, behind the neck, drawn under the photograph.
 *
 * Nothing in front. A sailor collar lies flat and has no stand to show: the
 * `standFront(6)` that used to run across the throat was the back of the
 * collar drawn in front of the neck, a band filling the base of it.
 */
const STAND_BEHIND_PATH = standBehind(6);

/*
  The panels — see `SAILOR_PANEL` in `collarCuts.ts`, which holds them so
  that `check:garments` measures the same ones on every cut they are sewn to.
  Over a high neckline each panel runs from the collar point out across the
  shoulder, down the outer edge, in to its point at mid-chest and straight
  back up the V; the V is the opening between them, and what shows in it is
  the garment — the dickey a sailor top is worn with. On a V-neck they are
  sewn down the V's own edges and meet at its point.

  The edges round the outside carry the weight of the cloth and bow outward,
  and every edge but the seam is a folded edge, finished.
*/

/** The collar dropped onto the garment, as cut for a high neckline: it lies on it, not in it. */

export const sailorCollarBehind = behindBandArt(STAND_BEHIND_PATH);

/** The collar from its panels: over a high neckline, or down a V. */
function collarOn(cut?: string): RegionArt {
  const panels = sailor(cut as NecklineId | undefined);
  /* down a V, the right panel is the left reflected about the V's own axis */
  const v = panels.axis !== undefined;
  const PANEL_LEFT_PATH = panels.left;
  const PANEL_RIGHT_PATH = panels.right;
  const FREE_EDGE = panels.free;
  const FREE_EDGE_RIGHT = panels.axis !== undefined ? mirror(FREE_EDGE, panels.axis) : reflect(FREE_EDGE);
  return {
    focus: [300, 236],
    outline: "soft",
    /** Cut from further down the roll than the garment it lies on. */
    grain: { shift: [10, 18] },
    shape: (fill) => (
      <>
        <path d={PANEL_LEFT_PATH} fill={fill} />
        <path d={PANEL_RIGHT_PATH} fill={fill} />
      </>
    ),
    defs: edgeLightDefs,
    /* in the garment's light, no line round it; a soft shadow under its edges and a little light along the folded outer edge */
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
    r = collarOn(cut);
    onCut.set(key, r);
  }
  return r;
};

export const sailorCollarFront: GarmentArt = {
  regions: { collar: collarFor() },
  /* on a V-neck, sewn down the V */
  cut: (choice) => ({ collar: collarFor(choice.neckline) }),
};
