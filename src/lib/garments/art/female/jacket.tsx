import { mirrorPts, outline, type Pt } from "@/lib/garments/fit";
import { tailored } from "@/lib/garments/sleeves";
import {
  JACKET,
  OUTER_NECK_LEFT,
  OUTER_NECK_RIGHT,
  OUTER_TIP_LEFT,
  SHOULDER_PTS,
} from "./yoke";
import type { GarmentArt } from "../index";
import { jacketArt } from "../jacketArt";

/**
 * Tailored jacket, front: single-breasted, one button at the waist.
 *
 * Two fronts closing on one button. Above it each front is cut in a straight V
 * from the neck to the button, and the lapel is that V folded back — which is
 * why the lapel lives with the collar (`female-notched-collar`, which this
 * arrives wearing) but is cut from the same landmarks in the yoke. Below the
 * button the fronts fall away from each other into rounded corners, and the
 * jacket opens over whatever is worn beneath it.
 *
 * It used to be one slab: a short V to y 262, three buttons below it, a dark
 * stripe down the centre and a flat hem — a shirt dress more than a jacket —
 * on a shoulder built out nine units past hers. The shoulder is six now, the
 * waist is fitted and the hem sits just past where her legs part.
 *
 * It claims no torso. Its cloth covers her trunk everywhere except its own
 * opening, and there the body — or the top underneath — is what shows, so
 * erasing the trunk would only have cut a hole the shape of the V. Nor her
 * forearm: its sleeve stops a centimetre short of a blouse's, so the blouse
 * cuff shows below it, and the wrist below that is her own.
 *
 * Its shoulder is structured and its sleeve is the shared sewn sleeve, cut
 * over a blouse's — see `tailored`. It holds what is worn under it: from the
 * shoulders to the hem, a blouse or a dress shows only through the front.
 */

/** Just past her shoulder point, and lifted a little: a padded shoulder. */
const TIP: Pt = [OUTER_TIP_LEFT[0], OUTER_TIP_LEFT[1] - 2];

const J = tailored("female", {
  tip: TIP,
  neck: [OUTER_NECK_LEFT[0], OUTER_NECK_LEFT[1]],
  neckRight: [OUTER_NECK_RIGHT[0], OUTER_NECK_RIGHT[1]],
  shoulderEase: 6,
  over: SHOULDER_PTS,
  ease: 6,
  hemY: JACKET.hemY,
  dip: 0,
  /* Tailored, so the side seam is shaped to the waist rather than bridging
     it — which is both what a jacket is and what leaves the sleeve somewhere
     to hang. */
  fitted: true,
  /* Shaped, but not to the millimetre: three units of bridge over the waist
     is the difference between a tailored jacket and an hourglass. */
  bridge: 3,
  sleeve: [5, 6],
  inner: [2, 4],
  buttonY: JACKET.buttonY,
  lap: JACKET.lap,
  cutaway: JACKET.cutaway,
  corner: JACKET.corner,
  /* three at each sleeve's end, a little smaller than his */
  sleeveButtons: { count: 3, cm: 1.4 },
});

/** The front that laps over is the one drawn second. */
const FRONT_RIGHT_PATH = J.right;
const FRONT_LEFT_PATH = J.left;
const SLEEVE_LEFT_PATH = J.sleeveLeft;
const SLEEVE_RIGHT_PATH = J.sleeveRight;

/** The seam the lapels are sewn along: each front's V, neck to break. */
export const NECK_SEAM = J.seam;

/**
 * A flap pocket at the hip, on each front: a flap of the same cloth over a
 * welt, level, square at the top and eased round at the bottom corners.
 */
const FLAP: Pt[] = [
  [226, JACKET.buttonY + 76],
  [274, JACKET.buttonY + 76],
  [274, JACKET.buttonY + 90],
  [270, JACKET.buttonY + 94],
  [230, JACKET.buttonY + 94],
  [226, JACKET.buttonY + 90],
];
const FLAP_LEFT_PATH = outline(FLAP);
const FLAP_RIGHT_PATH = outline(mirrorPts(FLAP));

/** The shadow each flap throws on the front below it. */
const FLAP_CAST_PATH = outline(FLAP.map(([x, y]) => [x, y + 3] as Pt));
const FLAP_RIGHT_CAST_PATH = outline(mirrorPts(FLAP).map(([x, y]) => [x, y + 3] as Pt));

/**
 * The breast welt, on her left — the viewer's right — rising a little toward
 * the arm, the way it is set on every tailored jacket. A mark on the cloth,
 * not a piece of it, so it is not named as a path.
 */
const WELT = outline([
  [318, 284],
  [346, 279],
  [346, 284],
  [318, 289],
]);

/**
 * The front darts that take the waist in: from under the bust to the pocket,
 * shading rather than cloth, and curving in at her waist and out over her hip
 * as she does — see `jacketFolds`. They ran ruler-straight.
 */
const DART = { x: 258, from: JACKET.buttonY - 62, to: JACKET.buttonY + 74 };

export const jacketFront: GarmentArt = jacketArt(J, {
  focus: [300, 380],
  flaps: [FLAP_LEFT_PATH, FLAP_RIGHT_PATH],
  flapCasts: [FLAP_CAST_PATH, FLAP_RIGHT_CAST_PATH],
  welt: WELT,
  dart: DART,
  buttonY: JACKET.buttonY,
  buttonR: 5.5,
});
