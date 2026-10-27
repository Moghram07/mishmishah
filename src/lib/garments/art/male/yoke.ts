/**
 * The shoulder every male top is hung from.
 *
 * The same construction as `art/female/yoke.ts` and the same export names, but
 * built against the male anchors: his shoulder point is 6 units wider each side
 * and his trapezius carries more mass, so the seam has to bow further out to
 * stay outside his edge the whole way. Evaluated against the male silhouette at
 * quarter, half and three-quarter along, this curve clears him by 24, 32 and 23
 * units — the female curve clears her by 17, 25 and 17.
 *
 * A drawing declares which body it is cut for by which of the two it imports.
 */

/*
  Relative and extensioned, like `fit.ts`: the yoke is imported by plain Node
  — through `art/female/dressCut.ts` and `scripts/preview-garments.mjs` — so
  that the checker drafts the same cuts the app draws rather than a second
  copy of them. Node resolves neither the `@/` alias nor a bare specifier.
*/
import { MALE_ANCHORS as ANCHORS } from "../../../mannequin/bodies.ts";
import {
  collarAxis,
  draft,
  lapel,
  mirrorPts,
  neckline,
  reverse,
  run,
  stand,
  standEdges,
} from "../../fit.ts";
import { flip, mirror, type Point } from "../../collar.ts";

/** Ease is cloth, not body: the same 3 units on both. See the female yoke. */
const EASE = 3;
/** The shoulder seam's ease, for garments that draft their own shoulders. */
export const SHOULDER_EASE = EASE;


/** The body this yoke is cut against, measured. */
const F = draft("male");

/**
 * Where a collar is sewn, and how much wider than the throat the cut is.
 *
 * His neck column is 55 units where hers is 48, and — the part no typed pair of
 * numbers was ever going to catch — it sits about **three units right of the
 * canvas centre**, because the photograph is very slightly turned. Every
 * opening in this wardrobe was cut symmetrically about 300, so on him the cloth
 * crowded the right of his throat and gaped on the left. Measured and centred
 * on the throat itself, it does neither.
 */
export const NECK_BASE_SEAM = 178;
const NECK_COLUMN = 164;
const NECK_EASE = 3;

/** An opening `dip` units deep, cut round the front of his throat. */
export const opening = (dip: number) =>
  neckline("male", {
    seamY: NECK_BASE_SEAM,
    at: NECK_COLUMN,
    ease: NECK_EASE,
    dip,
  });

/** Where the neckline meets the shoulder seam — measured, not typed. */
const SEAM = opening(0);
export const NECK_LEFT: readonly [number, number] = SEAM.left;
export const NECK_RIGHT: readonly [number, number] = SEAM.right;

/**
 * His shoulder point: where his outline turns from shoulder to arm, plus ease.
 * The shoulder seam ends here and the sleeve is set in here — see the female
 * yoke for what hanging it on the outside of the deltoid did to the armhole.
 */
export const TIP_LEFT = [
  ANCHORS.shoulderX.left - EASE,
  F.shoulderPointY,
] as const;
export const TIP_RIGHT = [
  ANCHORS.shoulderX.right + EASE,
  F.shoulderPointY,
] as const;

/**
 * The shoulder, walked along the body rather than solved as a curve.
 *
 * See `art/female/yoke.ts` for the full account. His seam stood 10.6 units off
 * his trapezius at its worst against her 11.7, which is why his shoulders read
 * a little better than hers did and still not right. Walking the measured edge
 * holds both at three.
 */
/** The shoulder as points, neck to tip — what a jacket worn over it has to clear. */
export const SHOULDER_PTS = F.shoulder(
  [NECK_LEFT[0], NECK_LEFT[1]],
  [TIP_LEFT[0], TIP_LEFT[1]],
  EASE
);

const SHOULDER_RIGHT_PTS = reverse(mirrorPts(SHOULDER_PTS));
SHOULDER_RIGHT_PTS[SHOULDER_RIGHT_PTS.length - 1] = [
  NECK_RIGHT[0],
  NECK_RIGHT[1],
];

export const SHOULDER_LEFT = run(SHOULDER_PTS);
export const SHOULDER_RIGHT = run(SHOULDER_RIGHT_PTS);

/** Start every male top here. */
export const YOKE_START = `M${NECK_LEFT[0]} ${NECK_LEFT[1]} ${SHOULDER_LEFT}`;
/** Close every male top with this, after its own neckline. */
export const YOKE_END = `L${TIP_RIGHT[0]} ${TIP_RIGHT[1]} ${SHOULDER_RIGHT}`;

/**
 * Outerwear sits over another garment, so its shoulder is cut a little wider:
 * the base yoke moved out and up, exactly as on the female side.
 */
const OUTER_OPENING = opening(0);
export const OUTER_NECK_L: [number, number] = [OUTER_OPENING.left[0] - 4, 174];
export const OUTER_NECK_R: [number, number] = [OUTER_OPENING.right[0] + 4, 174];
/**
 * Over another garment the shoulder is cut three units wider, at the same
 * shoulder point: the top underneath and the cloth. It was six wider and eight
 * lower, a typed 222 — out on the deltoid, which is the boxy shoulder.
 */
export const OUTER_TIP_L: [number, number] = [ANCHORS.shoulderX.left - EASE - 3, F.shoulderPointY];
export const OUTER_TIP_R: [number, number] = [ANCHORS.shoulderX.right + EASE + 3, F.shoulderPointY];

const OUTER_PTS = F.shoulder(OUTER_NECK_L, OUTER_TIP_L, EASE + 3);
const OUTER_RIGHT_PTS = reverse(mirrorPts(OUTER_PTS));
OUTER_RIGHT_PTS[OUTER_RIGHT_PTS.length - 1] = OUTER_NECK_R;

export const OUTER_YOKE_START =
  `M${OUTER_NECK_L[0].toFixed(1)} ${OUTER_NECK_L[1]} ` + run(OUTER_PTS);
export const OUTER_YOKE_END =
  `L${OUTER_TIP_R[0]} ${OUTER_TIP_R[1]} ` + run(OUTER_RIGHT_PTS);

/**
 * His jacket, measured from him: one button at his natural waist, where the
 * lapels break, and a hem just past where his legs part — both his own rows,
 * thirty-three and twenty-six units below hers. Shared by the jacket and its
 * collar for the same reason as hers: the lapel is the jacket's V folded back.
 */
export const JACKET = {
  buttonY: F.waistY + 4,
  hemY: F.crotchY + 18,
  lap: 4,
  cutaway: 24,
  corner: 14,
};

/** His lapel and the collar above it, left side, cut along his jacket's V. */
export const LAPEL = lapel({
  neck: OUTER_NECK_L,
  break: [300 + JACKET.lap, JACKET.buttonY],
  gorge: 36,
  width: 40,
  notch: 9,
  rise: 12,
});

/* --------------------------------------------------- the neck, and openings */

/**
 * Where his neck actually is, read from the shipped PNG's alpha.
 *
 * The narrow column runs **y 150–164 and is 43 units wide** (x 278–321), and
 * the silhouette has flared to 70 units by y 176 and 82 by y 180. Hers is 36 to
 * 38 and flares from y 170; his is wider and flares four units higher, which is
 * why none of this is scaled from `art/female/yoke.ts` — it is the same
 * construction solved again against his own numbers.
 *
 * This is the machinery his collars never had. Every male collar was a
 * trapezoid drawn from y 176 *downward* into the chest, with no cloth on the
 * throat above it and no arc behind it, which is a bib hanging off a collarbone
 * — the exact failure the female side diagnosed and fixed. It went unnoticed
 * for so long because his collars were drawn inside his garments and
 * `check:garments` only ever walked the collar *records*, all of which were
 * female.
 */
export const NECK_TOP = 150;
/** The seam a collar is sewn to — his neck points, four units above hers. */
export const NECK_BASE = 178;

/** How far the high opening dips at centre front — what every band is sewn to. */
export const HIGH_DIP = 10;

/**
 * The stand: the band that wraps the neck, in two pieces — the half in front
 * of the throat, and the half behind it, drawn *under* the photograph so that
 * all that shows of it is the edge passing each side of the neck.
 *
 * Both halves are cut by `stand` in `garments/fit.ts`, which both bodies
 * share: a strip of constant height sewn along the high opening, so its top
 * and bottom edges follow that seam and dip with it at centre front. These
 * used to be a separate copy in each yoke, drawing the front half as a ring
 * seen from above — a top edge lifting at centre front over a lower edge
 * sagging eighteen units onto the chest — which is a hoop placed round the
 * neck rather than a collar sewn to the garment.
 */
/** The row the band is sewn at, and the row the neck column is read at. */
const STAND = {
  seamY: NECK_BASE,
  at: NECK_COLUMN,
  ease: NECK_EASE,
  dip: HIGH_DIP,
};

/**
 * How far past the throat the behind-the-neck half reaches: enough to show at
 * the edges of the neck, no more, or `check:garments` calls it a cape.
 */
const BEHIND = 4;

/** The half in front of the neck, rising `rise` above the seam. */
export const standFront = (rise: number) => stand("male", { ...STAND, rise });

/**
 * The same band with a rounded gap at centre front, where the two ends of a
 * mandarin meet. It stops above the seam, so the neckline stays covered.
 */
export const standNotched = (rise: number, half: number, depth: number) =>
  stand("male", { ...STAND, rise, notch: { half, depth } });

/**
 * The same band with a V at centre front: its two ends stop short of the
 * centre, their top corners softly rounded, and the V's point is on the
 * band's lower edge — a mandarin's, as a thobe has it, over its placket.
 */
export const standGapped = (rise: number, half: number) =>
  stand("male", { ...STAND, rise, notch: { half, depth: 0, v: true } });

/** The half behind the neck: a little wider, and level along the top. */
export const standBehind = (rise: number) =>
  stand("male", { ...STAND, rise, off: BEHIND, flatTop: true });

/** The front band's edges, for a collar whose leaves hang from its fold. */
export const standFrontEdges = (rise: number) => standEdges("male", { ...STAND, rise });

/**
 * A high opening, cut at the base of his neck where a standing band can be
 * sewn. It dips to y 188 at centre front, and every band's lower edge follows
 * it three units lower, so the seam is covered whichever collar is chosen.
 */
export const HIGH_NECKLINE = opening(HIGH_DIP).front;

/**
 * Where every band's lower edge is at centre front, whatever its height: the
 * row a placket's first button sits just under, with a band collar on.
 */
export const BAND_FOOT = Math.max(...standFrontEdges(20).foot.map(([, y]) => y));

/**
 * The thobe's placket, its two edges: a regular collar's tab ends exactly
 * over the first, so the band and the placket read as one strip, buttoned
 * down its middle.
 */
export const THOBE_PLACKET: [number, number] = [288, 312];

/**
 * The line his collars are symmetric about: his neck's centre at the neck, his
 * trunk's by the waist. His neck is within a unit of his trunk, where hers is
 * three away — but it is measured, not assumed.
 */
export const COLLAR_AXIS = collarAxis("male", { seamY: NECK_BASE, at: NECK_COLUMN });
export const reflect = (d: string) => mirror(d, COLLAR_AXIS);
export const reflectPts = (corners: Point[]) => flip(corners, COLLAR_AXIS);
/** The crew opening — what a collar without a stand is sewn to. */
export const ROUND_NECKLINE = opening(34).front;

/**
 * How much of a collar's *flat pattern* width shows head-on.
 *
 * A collar is cut flat and then wrapped round a neck: the sides curve away and
 * foreshorten, so across the front it covers roughly three fifths of the width
 * it measures on the table. See the female yoke, where the same number is
 * arrived at for the same reason.
 */
export const FORESHORTEN = 0.6;
