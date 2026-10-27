import { mirrorPts, outline, type Pt } from "@/lib/garments/fit";
import { tailored } from "@/lib/garments/sleeves";
import { JACKET, OUTER_NECK_L, OUTER_NECK_R, OUTER_TIP_L, SHOULDER_PTS } from "./yoke";
import type { GarmentArt } from "../index";
import { jacketArt } from "../jacketArt";

/**
 * Tailored jacket, male front: single-breasted, one button at his waist.
 *
 * The same construction as hers — two fronts closing on one button, cut in a
 * straight V above it that the lapel folds back along, falling away below it
 * into rounded corners — drafted against **his** body: his shoulder point, his
 * neck, his natural waist for the button and his own crotch for the hem. None
 * of it is her numbers scaled.
 *
 * It used to be a slab: a typed shoulder tip at (176, 222) out on the deltoid,
 * a typed V to y 266, three buttons, a dark stripe down the centre and a flat
 * hem. The shoulder point is where his outline turns from shoulder to arm now,
 * so the armhole seam drops from it to the armpit instead of cutting across
 * the top of the arm.
 *
 * It claims no torso, for the same reason as hers: its cloth covers his trunk
 * everywhere but its own opening, and there it is the shirt, or him, that shows.
 * Nor his forearm: its sleeve stops a centimetre short of his shirt's, so a
 * shirt cuff shows below it, and the wrist below that is his own.
 *
 * Its shoulder is structured and its sleeve is the shared sewn sleeve, cut
 * over a shirt's — see `tailored`. It holds what is worn under it: from the
 * shoulders to the hem, a shirt or a thobe shows only through the front.
 */

/** Just past his shoulder point, and lifted a little: a padded shoulder. */
const TIP: Pt = [OUTER_TIP_L[0], OUTER_TIP_L[1] - 2];

const J = tailored("male", {
  tip: TIP,
  neck: [OUTER_NECK_L[0], OUTER_NECK_L[1]],
  neckRight: [OUTER_NECK_R[0], OUTER_NECK_R[1]],
  shoulderEase: 6,
  over: SHOULDER_PTS,
  ease: 6,
  hemY: JACKET.hemY,
  dip: 0,
  /* Tailored: shaped to his waist, with a little bridge so it does not cling. */
  fitted: true,
  bridge: 3,
  sleeve: [5, 6],
  inner: [2, 4],
  buttonY: JACKET.buttonY,
  lap: JACKET.lap,
  cutaway: JACKET.cutaway,
  corner: JACKET.corner,
  /* four at each sleeve's end, a centimetre and a half across — a suit's */
  sleeveButtons: { count: 4, cm: 1.5 },
});

/** The front that laps over is the one drawn second. */
const FRONT_RIGHT_PATH = J.right;
const FRONT_LEFT_PATH = J.left;
const SLEEVE_LEFT_PATH = J.sleeveLeft;
const SLEEVE_RIGHT_PATH = J.sleeveRight;

/** The seam the lapels are sewn along: each front's V, neck to break. */
export const NECK_SEAM = J.seam;

/**
 * Where the flap pockets sit: 76 units, 14.4 cm, below the button, as hers do
 * — about halfway from the button to the hem.
 *
 * They were a little above his hip, as hers also are. But his trunk is
 * widest almost at his crotch, y 511 against 521, so "a little above his hip"
 * put them 19 cm below the button with their foot 6.5 cm from the hem, where
 * hers are 14.4 cm below it with 12.3 cm to spare. A tailor places them from
 * the button.
 */
const POCKET_Y = JACKET.buttonY + 76;

/** A flap pocket on each front, level, square at the top, eased at the bottom. */
const FLAP: Pt[] = [
  [224, POCKET_Y],
  [276, POCKET_Y],
  [276, POCKET_Y + 14],
  [272, POCKET_Y + 18],
  [228, POCKET_Y + 18],
  [224, POCKET_Y + 14],
];
const FLAP_LEFT_PATH = outline(FLAP);
const FLAP_RIGHT_PATH = outline(mirrorPts(FLAP));
const FLAP_CAST_PATH = outline(FLAP.map(([x, y]) => [x, y + 3] as Pt));
const FLAP_RIGHT_CAST_PATH = outline(mirrorPts(FLAP).map(([x, y]) => [x, y + 3] as Pt));

/** The breast welt, on his left, rising a little toward the arm. A mark, not a piece. */
const WELT = outline([
  [320, JACKET.buttonY - 84],
  [350, JACKET.buttonY - 89],
  [350, JACKET.buttonY - 84],
  [320, JACKET.buttonY - 79],
]);

/** The front darts, from the chest to the pocket, curving with him — see `jacketFolds`. */
const DART = { x: 257, from: JACKET.buttonY - 64, to: POCKET_Y - 2 };

export const maleJacketFront: GarmentArt = jacketArt(J, {
  focus: [300, 384],
  flaps: [FLAP_LEFT_PATH, FLAP_RIGHT_PATH],
  flapCasts: [FLAP_CAST_PATH, FLAP_RIGHT_CAST_PATH],
  welt: WELT,
  dart: DART,
  buttonY: JACKET.buttonY,
  buttonR: 6,
});
