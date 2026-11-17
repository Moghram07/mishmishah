/**
 * The shoulder every female top is hung from.
 *
 * The body's trapezius bulges outward between the neck and the shoulder point,
 * so a straight shoulder seam drawn between those two cuts across the bulge and
 * the body shows through above the garment. The seam has to curve *outside* the
 * body's edge the whole way — and since all four female tops meet the same
 * shoulder, they share the one curve rather than each rediscovering it.
 *
 * A top's outline is then: this yoke, the sleeve and body it happens to have,
 * and a neckline of its own between the two collar points. The neckline is also
 * the seam a collar is sewn into, so each top exports it as `NECK_SEAM`.
 *
 * `art/male/yoke.ts` is the same construction against the male anchors. The two
 * export the same names, so a drawing says which body it is for by which yoke
 * it imports.
 */

/*
  Relative and extensioned, like `fit.ts`: the yoke is imported by plain Node
  — through `art/female/dressCut.ts` and `scripts/preview-garments.mjs` — so
  that the checker drafts the same cuts the app draws rather than a second
  copy of them. Node resolves neither the `@/` alias nor a bare specifier.
*/
import { FEMALE_ANCHORS as ANCHORS } from "../../../mannequin/bodies.ts";
import {
  collarAxis,
  draft,
  lapel,
  line,
  mirrorPts,
  neckline,
  reverse,
  run,
  stand,
  standEdges,
  type Pt,
} from "../../fit.ts";
import { flip, mirror, type Point } from "../../collar.ts";

/**
 * Ease: how far outside the body a garment is cut, in canvas units — three of
 * them, a little over half a centimetre, and the *only* ease at the shoulder.
 *
 * It was twelve, and the seam stood thirteen units off her because
 * `shoulderX` was itself the body plus eight. Both files believed they held the
 * single source of clearance and neither did, so it was added twice and the
 * tops floated at the shoulder while fitting everywhere else. `shoulderX` is
 * the bare silhouette now, measured on this row, and this is the whole of the
 * clearance.
 *
 * Small on purpose. A shoulder seam sits *on* the shoulder point; the room in a
 * garment belongs at the chest, which is where the side seams already put it.
 */
const EASE = 3;
/** The shoulder seam's ease, for garments that draft their own shoulders. */
export const SHOULDER_EASE = EASE;


/** The body this yoke is cut against, measured. */
const F = draft("female");

/**
 * Where a collar is sewn, and how much wider than the throat the cut is.
 *
 * The opening is sized to the neck **column** — 48 units on her — and then sewn
 * on at y 178, where the trapezius has already flared the silhouette out to 62.
 * Size it at the row it is sewn to and a crew neck comes out a boat neck.
 */
export const NECK_BASE_SEAM = 178;
const NECK_COLUMN = 164;
const NECK_EASE = 3;

/**
 * An opening `dip` units deep, cut round the front of the throat.
 *
 * Every garment sharing this yoke takes one, and they all share the two collar
 * points — same row, same centre, same width — so the yoke meets whichever
 * neckline a garment chose. Only the depth differs, which is the whole of what
 * separates a crew from a scoop.
 */
export const opening = (dip: number) =>
  neckline("female", {
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
 * The shoulder point: where the shoulder seam ends and the sleeve is set in —
 * the body's, measured where her outline turns from shoulder to arm, plus ease.
 *
 * It hung fourteen units lower, on the outside of the deltoid, and everything
 * set in from it was wrong the same way: the shoulder seam ran on over the top
 * of the arm, and the armhole seam cut diagonally across the arm to the
 * armpit instead of dropping from the shoulder to it.
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
 * Two mistakes lived here, one after the other. It began as two independently
 * typed cubics — `SHOULDER_RIGHT` carried a comment calling it "the same curve
 * run the other way" and it was not, by 5.2 units at y 194, which is the
 * crooked shoulder. Mirroring fixed that and left the second: a single cubic
 * solved to clear her silhouette everywhere had to stand **11.7 units off her
 * trapezius at y 192** to do it, because her shoulder breaks too sharply for
 * one curve to follow. Two and a quarter centimetres of cloth standing proud of
 * the body is a shoulder pad, and that is what it looked like.
 *
 * So the seam is not solved at all now. It walks the measured silhouette at a
 * constant three units of ease, sampled every four, and the cloth falls off the
 * shoulder the way cloth does.
 */
/** The shoulder as points, neck to tip — what a jacket worn over it has to clear. */
export const SHOULDER_PTS = F.shoulder(
  [NECK_LEFT[0], NECK_LEFT[1]],
  [TIP_LEFT[0], TIP_LEFT[1]],
  EASE
);

/*
  The right seam is the left one reflected — but it lands on the *right* collar
  point rather than on the mirror of the left one. Those differ by a unit or so,
  because the opening is centred on the throat and the body is centred on the
  canvas, and the two are not quite the same line.
*/
const SHOULDER_RIGHT_PTS = reverse(mirrorPts(SHOULDER_PTS));
SHOULDER_RIGHT_PTS[SHOULDER_RIGHT_PTS.length - 1] = [
  NECK_RIGHT[0],
  NECK_RIGHT[1],
];

export const SHOULDER_LEFT = run(SHOULDER_PTS);
/** `TIP_RIGHT` → `NECK_RIGHT`: the left seam, reflected. Not retyped. */
export const SHOULDER_RIGHT = run(SHOULDER_RIGHT_PTS);

/**
 * The band every collar closes the neck opening with.
 *
 * A collar is sewn into the neckline, so it has to cover it — and the three
 * garments that share this yoke cut three different openings (the t-shirt's
 * crew reaches y 210, the blouse's round 215, the dress's scoop 221). This
 * crescent runs from the collar points down to y 225 at the centre front and
 * back up to 206, so every one of those seams falls inside it whichever collar
 * is chosen. Each collar draws it and then adds its own shape around it.
 *
 * It is why a neckline may not be cut deeper than the band without a collar
 * built for it: the jacket's V reaches 262 and takes the notched lapel alone.
 */
export const NECKBAND =
  "M272 178 C275 238 325 238 328 178 C325 212 275 212 272 178 Z";

/* --------------------------------------------------- the neck, and openings */

/**
 * Where her neck actually is, read from the shipped PNG's alpha.
 *
 * The narrow column runs **y 152–170 and is 37 units wide** — 3.4 × 7.0 cm —
 * and the silhouette has flared to 64 units by y 180 and 121 by y 190. That is
 * the whole reason the first nine collars read as decals: `NECKBAND` tops out
 * at y 180, which is *ten units below the base of the neck*, so every collar
 * built on it was a shape lying on the shoulders. A band that wraps has to be
 * up here.
 *
 * The declared `neck` *zone* is y 140–216, which is not this: its top half is
 * inside the `head` ellipse and its bottom half is the top of the chest. Zones
 * are for erasing the photograph and these numbers are for drawing on it; they
 * are different questions and it is worth not confusing them.
 */
export const NECK_TOP = 140;
export const NECK_BASE = 178;

/**
 * A high opening, cut at the base of the neck where a standing band can be
 * sewn: barely any dip, so the neck rises through it rather than the cloth
 * crossing the throat.
 */
/** How far the high opening dips at centre front — what every band is sewn to. */
export const HIGH_DIP = 10;

/**
 * Her bust points, as the photograph shows them: the darkest band of its own
 * shading under the bust runs along y 290, centred at x 268 and x 336 — the
 * underside of the bust. Its lower curve, where that shading ends and the
 * ribs below are lit again, is y 300: the light climbs back fastest at 297
 * under both, and is all back by 303–308. Clothes are cut symmetrically, so
 * the points are taken 35 either side of the centre line, and the apex sits
 * above the crease, about 22 units up — where darts point to and where a
 * fitted bodice turns under.
 */
export const BUST = {
  /** The apex, left and right. */
  points: [
    [265, 268],
    [335, 268],
  ] as const,
  /** The crease under the bust, where cloth turns in toward the ribs. */
  creaseY: 290,
  /** The lower curve of the bust, where its shading ends: a seam under the bust is sewn below it. */
  underY: 300,
};
export const HIGH_NECKLINE = opening(HIGH_DIP).front;

/**
 * The line her collars are symmetric about: her neck's centre at the neck,
 * the trunk's by the waist. Every collar reflects its left side with these
 * rather than about the canvas centre, which her neck is three units left of.
 */
export const COLLAR_AXIS = collarAxis("female", { seamY: NECK_BASE, at: NECK_COLUMN });
export const reflect = (d: string) => mirror(d, COLLAR_AXIS);
export const reflectPts = (corners: Point[]) => flip(corners, COLLAR_AXIS);
/** The crew opening — what a collar without a stand is sewn to. */
export const ROUND_NECKLINE = opening(34).front;

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
export const standFront = (rise: number) => stand("female", { ...STAND, rise });

/**
 * The same band with a rounded gap at centre front, where the two ends of a
 * mandarin meet. It stops above the seam, so the neckline stays covered.
 */
export const standNotched = (rise: number, half: number, depth: number) =>
  stand("female", { ...STAND, rise, notch: { half, depth } });

/**
 * The same band with its two ends meeting at centre front: top corners
 * softly rounded, a V between them `half` either side of the centre at the
 * top, closing to a point on the band's lower edge — his mandarin's, and now
 * hers.
 */
export const standGapped = (rise: number, half: number) =>
  stand("female", { ...STAND, rise, notch: { half, depth: 0, v: true } });

/** That band's edges: its top, round the ends and down the V — where it is folded, and catches the light. */
export const standGappedEdges = (rise: number, half: number) =>
  standEdges("female", { ...STAND, rise, notch: { half, depth: 0, v: true } });

/** The half behind the neck: a little wider, and level along the top. */
export const standBehind = (rise: number) =>
  stand("female", { ...STAND, rise, off: BEHIND, flatTop: true });

/** That half's edges — for a shirt collar, whose back rounds over at each side of the neck: see `roundedBack`. */
export const standBehindEdges = (rise: number) =>
  standEdges("female", { ...STAND, rise, off: BEHIND, flatTop: true });

/** The front band's edges, for a collar whose leaves hang from its fold — as his do. */
export const standFrontEdges = (rise: number) => standEdges("female", { ...STAND, rise });

/**
 * How much of a collar's *flat pattern* width shows head-on.
 *
 * A collar is cut flat and then wrapped round a neck: the sides curve away and
 * foreshorten, so across the front it covers roughly three fifths of the width
 * it measures on the table. Every one of these was drawn at full pattern width
 * — copied off a flat technical drawing — which is why they came out as large
 * flat shapes lying on the chest rather than cloth going round a throat.
 *
 * The other half of the same mistake was sizing them against the shoulders. A
 * collar is sized against the **neck**: a shirt collar is the neck plus a
 * little, a Peter Pan is two small crescents on the neckline, and only the
 * sailor genuinely reaches the shoulder point.
 */
export const FORESHORTEN = 0.6;

/** Start every top here. */
export const YOKE_START = `M${NECK_LEFT[0]} ${NECK_LEFT[1]} ${SHOULDER_LEFT}`;
/** Close every top with this, after its own neckline. */
export const YOKE_END = `L${TIP_RIGHT[0]} ${TIP_RIGHT[1]} ${SHOULDER_RIGHT}`;

/**
 * Outerwear sits over another garment, so its shoulder is cut a little wider:
 * three more units of ease at the same shoulder point, and a neck point moved out and up
 * by four. Derived from the base yoke rather than written out again, so the
 * jacket follows her shoulder when the tops do.
 *
 * Three, not six. Six more stood the jacket's shoulder nine units off hers —
 * a shelf built out past the body, which is the boxy, floating shoulder a
 * tailored jacket does not have. Three is the top underneath and the cloth.
 */
const OUTER_EASE = EASE + 3;
const OUTER_RISE = 4;

export const OUTER_NECK_LEFT = [
  NECK_LEFT[0] - OUTER_RISE,
  NECK_LEFT[1] - OUTER_RISE,
] as const;
export const OUTER_NECK_RIGHT = [
  NECK_RIGHT[0] + OUTER_RISE,
  NECK_RIGHT[1] - OUTER_RISE,
] as const;

export const OUTER_TIP_LEFT = [
  ANCHORS.shoulderX.left - OUTER_EASE,
  F.shoulderPointY,
] as const;
export const OUTER_TIP_RIGHT = [
  ANCHORS.shoulderX.right + OUTER_EASE,
  F.shoulderPointY,
] as const;

/** Walked along the body, like the base yoke, and for the same reason. */
const OUTER_PTS = F.shoulder(
  [OUTER_NECK_LEFT[0], OUTER_NECK_LEFT[1]],
  [OUTER_TIP_LEFT[0], OUTER_TIP_LEFT[1]],
  OUTER_EASE
);
const OUTER_RIGHT_PTS = reverse(mirrorPts(OUTER_PTS));
OUTER_RIGHT_PTS[OUTER_RIGHT_PTS.length - 1] = [
  OUTER_NECK_RIGHT[0],
  OUTER_NECK_RIGHT[1],
];

export const OUTER_YOKE_START =
  `M${OUTER_NECK_LEFT[0].toFixed(1)} ${OUTER_NECK_LEFT[1]} ` + run(OUTER_PTS);
export const OUTER_YOKE_END =
  `L${OUTER_TIP_RIGHT[0]} ${OUTER_TIP_RIGHT[1]} ` + run(OUTER_RIGHT_PTS);

/**
 * The jacket, measured from her: one button at her natural waist, where the
 * lapels break, and a hem just past where her legs part.
 *
 * Shared by the jacket and its collar, because a lapel is the top of the front
 * folded back — its inner edge is the jacket's V, and it ends at the jacket's
 * button. Typed separately in two files, the two drift apart: the old lapel
 * broke at y 262 onto a jacket fastened with three buttons below it.
 */
export const JACKET = {
  buttonY: F.waistY + 4,
  hemY: F.crotchY + 18,
  lap: 4,
  cutaway: 24,
  corner: 14,
};

/** The lapel and the collar above it, left side, cut along the jacket's V. */
export const LAPEL = lapel({
  neck: [OUTER_NECK_LEFT[0], OUTER_NECK_LEFT[1]],
  break: [300 + JACKET.lap, JACKET.buttonY],
  gorge: 34,
  width: 36,
  notch: 9,
  rise: 10,
});
