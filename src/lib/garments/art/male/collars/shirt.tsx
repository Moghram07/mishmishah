import { arc, foldBack, foldRoll, roundedBack, type Point } from "@/lib/garments/collar";
import { line, outline, reverse, run, type Pt } from "@/lib/garments/fit";
import { foldDefs, foldLights, foldShadows, type Fold } from "@/lib/garments/folds";
import { collarFold, collarTone } from "../../collarLight";
import { COLLAR_AXIS, NECK_BASE_SEAM, reflect, standBehind, standBehindEdges, standFront, standFrontEdges } from "../yoke";
import { behindBandArt } from "../../behindBand";
import { litButtons } from "../../buttons";
import { seamFolds, sleeveFoldDefs } from "../../sleeveFolds";
import { shirtTieArt } from "../../shirtTieArt";
import { butterflyAt, necktieTo, shirtTie, type TieFit } from "../../shirtTies";
import type { GarmentArt, GarmentChoice, RegionArt } from "../../index";

/**
 * Shirt collar, male: a band round the neck, and two leaves folded down over it.
 *
 * Built the way a shirt collar is made. The **band** (the stand) is sewn to the
 * neckline and wraps the neck, closing at the throat on the collar's axis. The
 * **leaves** (the fall) are sewn to the *top* of the band and fold down over
 * it, so the band's top edge is the fold — where the collar turns — and the
 * leaves hang from it, covering the band.
 *
 * **It wraps the neck** (the user's photos bowtieMen and TiePositions-Shapes).
 * Seen from the front it stands up at each side of the neck, 3.8 cm above the
 * seam there — his jaw is at y 138, the seam meets the side of his neck at
 * y 178 — and its fold runs down from the sides to centre front, where the two
 * halves meet just above the top button: a wide V, the neck showing in it —
 * see `foldCurve`. Each leaf falls from the fold down and a little out to its
 * point; between the two, below where they meet, the band shows with its
 * buttons. Its fold used to run level straight across the throat, the points
 * hanging off its ends: a strip, not a collar round a neck.
 *
 * Before that it was cut from the neckline: each leaf's inner edge was the
 * seam, so the whole neck showed and the collar lay on the shoulders like an
 * open camp collar. And before that the band was drawn across the front with
 * the leaves hung from its *bottom* edge, the band showing above them — which
 * no shirt collar does, because its leaves hang from the top.
 *
 * His numbers: it stands 20 units at the side of his neck and its V is 25
 * deep, three units clear of the neck column, the opening's own ease.
 */

/** How high the collar stands at the side of his neck, above the seam it is sewn to there: 3.8 cm. */
const BAND_RISE = 20;
/** How far its fold comes down from the sides to where its halves meet, just above the top button: the V's depth, 4.75 cm. */
const V_DEPTH = 25;

/** The band: its sides up the throat, its foot along the seam — its top is the fold. */
const BAND_EDGES = standFrontEdges(BAND_RISE);
/** Where the fold turns round the side of the neck: the band's top corner. */
const SIDE: Point = BAND_EDGES.leftSide[BAND_EDGES.leftSide.length - 1];
/** Where the halves meet, at centre front: the bottom of the V. */
const MEET: Point = [COLLAR_AXIS(SIDE[1] + V_DEPTH), SIDE[1] + V_DEPTH];
/** The fold, left to right: from the side down to where the halves meet, and up the other side — the same half, reflected. */
const ROLL: Pt[] = foldRoll(SIDE, MEET, COLLAR_AXIS);
const BAND_PATH = outline(BAND_EDGES.leftSide, ROLL, reverse(BAND_EDGES.rightSide), BAND_EDGES.foot);
/** How far down its outer side the collar's back rounds over, at each side of the neck: see `roundedBack`. */
const BACK_ROUND = 14;
/** Its back, behind the neck: turning round the neck at each side, where it rounds over — not a box standing behind the collar. */
const STAND_BEHIND_PATH = outline(roundedBack(standBehindEdges(BAND_RISE), [SIDE, BAND_EDGES.rightSide[BAND_EDGES.rightSide.length - 1]], BACK_ROUND));

/** A leaf's outer corner: down the side of the neck from the fold, a little out, where the collar meets the shoulder. */
const OUTER: Point = [SIDE[0] - 3, SIDE[1] + 21];
/** Its point: below where the halves meet, and out — the leaf falls from the fold down and slightly out. */
const TIP: Point = [MEET[0] - 18, MEET[1] + 17];

/*
  One leaf: back along the fold from where the halves meet up to the side of
  the neck, down the side to the outer corner, in to the point, and up the
  front edge to where the halves meet. Its sides bow outward a little, as
  cloth folded round a neck does; the front edge runs a shade hollow.
*/
const LEAF_LEFT_PATH = `M${MEET[0]} ${MEET[1]} ${foldBack(SIDE, MEET)} ${arc(SIDE, OUTER, 1.5)} ${arc(OUTER, TIP, 1.5)} ${arc(TIP, MEET, -1)} Z`;
const LEAF_RIGHT_PATH = reflect(LEAF_LEFT_PATH);

/**
 * Where the band is sewn to the neckline: a seam, so a soft line of shadow
 * rather than an outline, which turns pale on a dark page — across the foot of
 * the V that was a light line under the buttons. Lifted a little into the
 * band, since shading is drawn on the collar only.
 */
const BAND_FOOT = line(standFrontEdges(BAND_RISE).foot.map(([x, y]) => [x, y - 0.8] as Pt));

/*
  The fold: a soft, rounded turn along the roll line — a thin highlight on the
  fold itself and a soft shadow just under it — drawn with the shared fold
  helper, so it is light and shadow only.
*/
const ROLL_FOLD: Fold = collarFold(ROLL.map(([x, y]) => [x, y + 2.2] as Pt), 2.2);

/** Where the band is sewn to the neckline: a soft fold, seen only in the V between the leaves. */
const BAND_SEAM = seamFolds([BAND_FOOT]);

/** Buttons on the band, one above the other in the V between the points, from just below where the halves meet. */
const BUTTON_ROWS: Record<number, number[]> = { 1: [4], 2: [2.4, 7.6] };

/*
  The collar as it always was — on any garment it does not wrap in a V, his
  thobe and his polo: the user's call. Its band rises 20 units at the side of
  his neck to a roll line level across the throat, the leaves hanging from it
  to points about 8 cm long on the upper chest; its buttons 20 below where
  they meet, or 14 and 24 for two, a thobe's. Exactly the drawing from before
  the V, numbers and all.
*/
const LEVEL_RISE = 20;
const LEVEL_BELOW_SEAM = 5;
const LEVEL_SPREAD = 12;
const LEVEL_POINT_LENGTH = 42;
const LEVEL_POINT_ANGLE = (22 * Math.PI) / 180;
const LEVEL_BAND = standFront(LEVEL_RISE);
const LEVEL_BEHIND = standBehind(LEVEL_RISE);
const LEVEL_ROLL: Pt[] = standFrontEdges(LEVEL_RISE).top;
const LEVEL_MID = (LEVEL_ROLL.length - 1) / 2;
const LEVEL_MEET: Point = [COLLAR_AXIS(LEVEL_ROLL[LEVEL_MID][1]), LEVEL_ROLL[LEVEL_MID][1]];
const LEVEL_SIDE: Point = LEVEL_ROLL[0];
const LEVEL_OUTER: Point = [LEVEL_SIDE[0] - LEVEL_SPREAD, NECK_BASE_SEAM + LEVEL_BELOW_SEAM];
const LEVEL_TIP: Point = [
  LEVEL_MEET[0] - LEVEL_POINT_LENGTH * Math.sin(LEVEL_POINT_ANGLE),
  LEVEL_MEET[1] + LEVEL_POINT_LENGTH * Math.cos(LEVEL_POINT_ANGLE),
];
const LEVEL_ROLL_LEFT: Pt[] = [[LEVEL_MEET[0], LEVEL_MEET[1]], ...LEVEL_ROLL.slice(0, LEVEL_MID).reverse()];
const LEVEL_LEAF_LEFT =
  `M${LEVEL_MEET[0]} ${LEVEL_MEET[1]} ${run(LEVEL_ROLL_LEFT.slice(1))} ` +
  `${arc(LEVEL_SIDE, LEVEL_OUTER, 2)} ${arc(LEVEL_OUTER, LEVEL_TIP, 1.5)} ${arc(LEVEL_TIP, LEVEL_MEET, -1)} Z`;
const LEVEL_LEAF_RIGHT = reflect(LEVEL_LEAF_LEFT);
const LEVEL_ROLL_FOLD: Fold = collarFold(LEVEL_ROLL.map(([x, y]) => [x, y + 2.2] as Pt), 2.2);
const LEVEL_BUTTON_ROWS: Record<number, number[]> = { 1: [20], 2: [14, 24] };

/**
 * The collar, as a region: its band, and its two leaves over it — the one
 * drawing for both of its shapes, the V and the level fold, given each one's
 * band, leaves, seam and fold.
 */
function collarRegion(band: string, leafLeft: string, leafRight: string, bandSeam: Fold[], rollFold: Fold): RegionArt {
  return {
    focus: [300, 182],
    outline: "soft",
    /**
     * Cut from further along the roll than the shirt it is sewn to, so a
     * stripe stays upright but does not line up across the seam.
     */
    grain: { shift: [0, 14] },
    shape: (fill) => (
      <>
        <path d={band} fill={fill} />
        <path d={leafLeft} fill={fill} />
        <path d={leafRight} fill={fill} />
      </>
    ),
    /* the leaves outlined all round; the band nowhere — under the leaves but for its seam */
    edge: () => (
      <>
        <path d="" />
        <path d={leafLeft} />
        <path d={leafRight} />
      </>
    ),
    defs: (uid) => (
      <>
        {foldDefs(uid)}
        {sleeveFoldDefs(uid)}
        {/* the band's seam is lit only where the band shows: its light is drawn after the leaves */}
        <mask id={uid("band-seam")} maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="1000">
          <path d={band} fill="#fff" />
          <path d={leafLeft} fill="#000" />
          <path d={leafRight} fill="#000" />
        </mask>
      </>
    ),
    shading: (uid) => (
      <>
        {/* the garment's light; the band's seam and the roll, soft folds; the leaves' soft shadow on the band is their outline's */}
        {collarTone()}
        {foldShadows(uid, bandSeam)}
        {foldShadows(uid, [rollFold])}
      </>
    ),
    light: (uid) => (
      <>
        {foldLights(uid, [rollFold])}
        <g mask={`url(#${uid("band-seam")})`}>{foldLights(uid, bandSeam)}</g>
      </>
    ),
  };
}

/** The collar wrapping the neck in a V — on the garments it is worn that way on: see `Collar.wrapsOn`. */
const COLLAR: RegionArt = collarRegion(BAND_PATH, LEAF_LEFT_PATH, LEAF_RIGHT_PATH, BAND_SEAM, ROLL_FOLD);

/** The collar as it always was, its fold level across the throat — on any other garment: see `LEVEL_RISE`. */
const LEVEL_COLLAR: RegionArt = collarRegion(LEVEL_BAND, LEVEL_LEAF_LEFT, LEVEL_LEAF_RIGHT, BAND_SEAM, LEVEL_ROLL_FOLD);

/**
 * Its leaves alone, drawn as `COLLAR` draws them: laid again over a
 * necktie's knot, which is knotted round the band under them, so the
 * collar's points lie over the sides of the knot — the stage draws them
 * after the tie, and only over it: see `GARMENT_LAYERS`' `fall`.
 */
const LEAVES: RegionArt = {
  ...COLLAR,
  shape: (fill) => (
    <>
      <path d={LEAF_LEFT_PATH} fill={fill} />
      <path d={LEAF_RIGHT_PATH} fill={fill} />
    </>
  ),
  edge: () => (
    <>
      <path d={LEAF_LEFT_PATH} />
      <path d={LEAF_RIGHT_PATH} />
    </>
  ),
};

/** The collar with a necktie knotted round its band: drawn as ever, its leaves laid again over the knot — see `LEAVES`. */
const UNDER_TIE: RegionArt = { ...COLLAR, over: LEAVES };

/** How a tie fits it, worn as `choice` says: knotted at the bottom of its V, where its halves meet; a necktie reaching the waistband — see `TieFit`. */
const fitFor = (choice: GarmentChoice): TieFit => ({
  meet: [MEET[0], MEET[1]],
  to: necktieTo("male", choice),
  bow: butterflyAt([MEET[0], MEET[1]]),
});

export const maleShirtCollarFront: GarmentArt = {
  regions: { collar: COLLAR },
  /*
    Worn with a necktie or a bow tie, knotted round its band at the bottom of
    its V, it draws the tie — and lays its leaves again over a necktie's knot,
    whose sides they cover. His bow tie lies on the leaves, in front, as the
    photos' do: their outer edges come down to its wings' top outer corners.
    Its halves still meet: the collar is closed.
  */
  cut: (choice) => {
    /* on a garment it does not wrap — his thobe, his polo — as it always was, and never with a tie: none is offered there */
    if (!choice.wraps) return { collar: LEVEL_COLLAR };
    const style = choice.tieUnder ? choice.tie : undefined;
    if (style !== "necktie" && style !== "bowtie") return {};
    const fit = fitFor(choice);
    const tie = shirtTieArt(style, "male", fit);
    /* a necktie's knot lies under the leaves, a bow tie on them — as its pieces say: see `ShirtTie.under` */
    return shirtTie(style, "male", fit).under ? { collar: UNDER_TIE, tie } : { tie };
  },
  /* under the V; or, where it does not wrap — a thobe's two — under the level fold, as they always were */
  bandButtons: (count, choice) =>
    choice && !choice.wraps
      ? litButtons((LEVEL_BUTTON_ROWS[count] ?? LEVEL_BUTTON_ROWS[1]).map((dy) => [COLLAR_AXIS(LEVEL_MEET[1] + dy), LEVEL_MEET[1] + dy] as const), 2.2)
      : litButtons((BUTTON_ROWS[count] ?? BUTTON_ROWS[1]).map((dy) => [COLLAR_AXIS(MEET[1] + dy), MEET[1] + dy] as const), 2.2),
};

/** Its back as it always was — the plain band behind the neck — on a garment it does not wrap: see `LEVEL_COLLAR`. */
const LEVEL_BACK = behindBandArt(LEVEL_BEHIND).regions.collar!;

export const maleShirtCollarBehind: GarmentArt = {
  ...behindBandArt(STAND_BEHIND_PATH),
  cut: (choice) => (choice.wraps ? {} : { collar: LEVEL_BACK }),
};

/** For the record and the checker: the collar's own measurements. */
export const MALE_SHIRT_COLLAR = { stand: BAND_RISE, depth: V_DEPTH, meet: MEET, side: SIDE, outer: OUTER, tip: TIP, roll: ROLL };
