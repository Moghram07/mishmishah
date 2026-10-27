import type { BodyAnchors, BodyAsset, BodyType, BodyZone } from "@/types";
import { FEMALE_PROFILE, MALE_PROFILE, edgeAt, type BodyProfile } from "./profile.ts";

/**
 * The shoulder at its **shoulder point**, read from the measured outline: the
 * row where the outline turns from the top of the shoulder down into the arm,
 * which is where every yoke ends its shoulder seam and sets its sleeve.
 *
 * It was read at a fixed y 220, which on both bodies is partway down the
 * deltoid — so the seam ran on over the top of the arm and the armhole cut
 * diagonally across it.
 *
 * It was typed — 197/403 on her — and went stale the moment the photograph was
 * re-registered on its trunk: her left shoulder turned out to sit 2.6 units
 * further out than the number said, and the yoke cut into it. The outline is
 * folded to the side that reaches further, so both tips clear both shoulders.
 */
function shoulderOf(profile: BodyProfile): { left: number; right: number } {
  const x = Math.round((edgeAt(profile.armOuter, profile.shoulderPointY) ?? 0) * 10) / 10;
  return { left: x, right: Math.round((600 - x) * 10) / 10 };
}

/**
 * The mannequin: a cut-out photograph plus the geometry needed to dress it.
 *
 * The body is an **image**, not a drawing. Anything drawn with paths ends up
 * looking like a drawing, and no amount of editing those paths fixes it — so
 * `public/mannequin/*.png` holds a photographed shop mannequin on a
 * transparent background, and the app composites garments over it. (These
 * particular files are rendered by `scripts/render-mannequin.mjs`; a
 * photograph of a real form drops into the same slot.)
 *
 * Everything below is data. Swapping the body — another form, another
 * photograph, another gender — is editing a record here and replacing a file.
 * The renderer never learns which body it is drawing.
 */

/**
 * The one coordinate space garments and bodies share.
 *
 * The canvas and the *vertical* skeleton are shared by every body, which is
 * what makes two figures comparable and lets one fabric scale serve both. The
 * horizontal anchors and the zone geometry are per body, because a garment is
 * cut for one figure. `cmPerUnit` is what keeps a check on a shirt the size of
 * a check on a shirt — it turns a fabric's real repeat into SVG units.
 */
export const BODY_CANVAS = {
  width: 600,
  height: 1000,
  /** 910 units from crown to floor ≈ a 172 cm frame. */
  cmPerUnit: 0.19,
  /** The framing the stage shows — the figure, with room for a full skirt. */
  viewBox: "56 6 488 986",
} as const;

/**
 * The female skeleton.
 *
 * Every number here is load-bearing in a way that is easy to miss: the female
 * yoke derives its shoulder tips from `shoulderX ∓ EASE`, so moving one of
 * these re-cuts all four female tops. `bodies.test.ts` snapshots the resulting
 * path strings for exactly that reason.
 *
 * `shoulderX` is **the silhouette itself**, at the shoulder point — the row
 * the sleeve is set in at, measured from the shipped PNG. Not the
 * silhouette plus clearance, which is what it used to be and which quietly
 * doubled the ease: the yoke computes `TIP = shoulderX ∓ EASE` believing this
 * number is the bare body, so an offset baked in here was added to `EASE` and
 * the shoulder seam ended up 13 units off her, 2.5 cm, floating.
 *
 * Measured at the row the tip is placed on, and nowhere else: the body widens
 * fast just below it, and an ease measured on one row and applied on another
 * is not an ease — it is that difference plus whatever was meant.
 */
export const FEMALE_ANCHORS: BodyAnchors = {
  centerX: 300,
  crownY: 40,
  chinY: 154,
  shoulderY: FEMALE_PROFILE.shoulderPointY,
  shoulderX: shoulderOf(FEMALE_PROFILE),
  bustY: 270,
  waistY: FEMALE_PROFILE.waistY,
  hipY: FEMALE_PROFILE.hipY,
  crotchY: FEMALE_PROFILE.crotchY,
  kneeY: 686,
  ankleY: 906,
  floorY: 950,
};

/**
 * The male skeleton.
 *
 * The normaliser pins crown and floor to the same rows on every figure, and
 * nothing else. So the waist, the hip and the crotch are **his**, measured from
 * his photograph: his waist is 33 units below hers and his legs part 26 lower.
 * They used to be spread from hers, which is how both pairs of trousers came to
 * be cut to one waist. His shoulder, likewise, is read off his own outline.
 */
export const MALE_ANCHORS: BodyAnchors = {
  ...FEMALE_ANCHORS,
  crownY: 38,
  shoulderY: MALE_PROFILE.shoulderPointY,
  shoulderX: shoulderOf(MALE_PROFILE),
  waistY: MALE_PROFILE.waistY,
  hipY: MALE_PROFILE.hipY,
  crotchY: MALE_PROFILE.crotchY,
};

/** An axis-aligned zone, written the way it is actually thought about. */
const box = (x0: number, y0: number, x1: number, y1: number) =>
  `M${x0} ${y0} H${x1} V${y1} H${x0} Z`;

/** A zone that tapers, for limbs that narrow as they fall. */
const taper = (
  yTop: number,
  topX: [number, number],
  yBottom: number,
  bottomX: [number, number]
) =>
  `M${topX[0]} ${yTop} H${topX[1]} L${bottomX[1]} ${yBottom} H${bottomX[0]} Z`;

/**
 * The area each zone occupies.
 *
 * Zones overlap, because bodies do — an arm hangs over a hip, a sleeve crosses
 * a chest. The renderer resolves that by erasing only what is unambiguously
 * covered: a pixel claimed by a covered zone *and* by an uncovered one stays.
 * So trousers never swallow the hand resting against the thigh.
 *
 * What a zone must not do is reach past the garment that covers it. `torso`
 * therefore starts below the deepest neckline in the wardrobe and stops inside
 * the narrowest side seam — otherwise a V-neck would erase the chest it leaves
 * bare, and nothing would paint it back.
 */
/** Both sides of a limb at once, mirrored about the centre line. */
const limb = (
  yTop: number,
  top: [number, number],
  yBottom: number,
  bottom: [number, number]
) =>
  [
    taper(yTop, top, yBottom, bottom),
    taper(
      yTop,
      [600 - top[1], 600 - top[0]],
      yBottom,
      [600 - bottom[1], 600 - bottom[0]]
    ),
  ].join(" ");

/**
 * A shape given once for the left of the body and mirrored to the right.
 *
 * The two shoulders are the same shoulder, so writing one and reflecting it is
 * the only way they cannot drift apart — the mistake that a hand-written pair
 * invites and that nothing else here would catch.
 */
const mirrored = (points: [number, number][]) => {
  const trace = (pts: [number, number][]) =>
    `M${pts.map(([x, y]) => `${x} ${y}`).join(" L")} Z`;
  return [
    trace(points),
    trace(points.map(([x, y]) => [600 - x, y] as [number, number])),
  ].join(" ");
};

const FEMALE_ZONES: Record<BodyZone, string> = {
  head: "M300 26 C348 26 356 74 356 100 C356 140 332 176 300 176 C268 176 244 140 244 100 C244 74 252 26 300 26 Z",
  neck: box(266, 140, 334, 200),
  // The slope from the side of the neck out over the deltoid. It runs between
  // the neck's edge and the top of the arm without overlapping either, which
  // is what lets a collar claim a shoulder without disturbing a sleeve: the
  // outer boundary is drawn a few units clear of the silhouette, because a
  // zone reaching past the body erases nothing extra, and one falling short
  // leaves a rim.
  shoulderCap: mirrored([
    [272, 178],
    [256, 186],
    [236, 194],
    [214, 202],
    [200, 214],
    [194, 230],
    [266, 230],
  ]),
  // Between the neck and the bust. It steps out at y=230 rather than running
  // straight down, so above that line it is exactly as wide as the neck it
  // continues, and leaves the shoulder cap alone.
  //
  // `neck` now stops at y=200 — it used to run to 216, which is 46 units below
  // the base of her actual neck at y=170, so "covers the neck" also meant
  // "covers the top of the chest", and the one collar that claimed it had to
  // grow a bib to say so. This still starts at 216 rather than meeting it,
  // and the sixteen units between belong to no zone on purpose: that is where
  // every neckline is cut, so the band is cloth on one garment and bare skin
  // on the next. A zone that claimed it would be wrong half the time.
  upperChest:
    "M266 216 L334 216 L334 230 L356 230 L356 268 L244 268 L244 230 L266 230 Z",
  torso: box(220, 268, 380, 396),
  hip: box(202, 400, 398, 516),
  // Stops at the shortest sleeve in the wardrobe, not at the elbow. The outer
  // edge is the arm's own, read from the alpha: hers runs x 192–223 at y 250
  // and 186–220 at y 350, and a zone that falls short of it leaves a stripe of
  // arm outside the erasure, which the photograph then draws over the sleeve.
  upperArm: limb(230, [184, 244], 318, [184, 226]),
  // The inner edge follows where the arm actually stops being visible — the
  // torso takes over in front of it — because these two are also drawn back
  // over the garments, and must bring only arm with them.
  forearm: limb(332, [182, 224], 486, [174, 208]),
  hand: limb(494, [168, 206], 578, [176, 202]),
  thigh: box(196, 508, 404, 692),
  knee: box(216, 668, 384, 726),
  calf: box(206, 718, 394, 890),
  foot: [box(240, 892, 302, 964), box(298, 892, 360, 964)].join(" "),
};

/**
 * The male figure is +9 at the chest, +14 at the waist and −7 at the hip. Two
 * of those move a zone; the third famously does not.
 */
const MALE_ZONES: Record<BodyZone, string> = {
  head: FEMALE_ZONES.head,
  neck: box(262, 138, 338, 200),
  // His shoulder is wider and squarer, so the slope reaches further out and
  // drops less on the way. Read from his alpha, not scaled from hers.
  //
  // The inner edge stops at 258, two units short of the neck point his yoke is
  // sewn from at x=260 — the same clearance hers keeps from 268. Take it to the
  // neck point itself and the zone reaches into the neckline *opening*, where
  // there is throat and no cloth, and every male top is left owing a few pixels
  // it was never cut to cover.
  shoulderCap: mirrored([
    [270, 178],
    [254, 186],
    [232, 194],
    [210, 202],
    [194, 214],
    [186, 230],
    [262, 230],
  ]),
  upperChest:
    "M262 216 L338 216 L338 230 L358 230 L358 268 L242 268 L242 230 L262 230 Z",
  // A taper, not a box. His chest edge is 211 against her 220 — but a box out
  // to 210 would still be out there at y=396, where it reaches into the arm,
  // and every male top would then need its side seam outside x=210 at the
  // waist. Following the torso costs nothing and frees the seam.
  torso:
    "M210 268 L212 300 L218 356 L216 396 L384 396 L382 356 L388 300 L390 268 Z",
  // Deliberately hers, to the unit. His hip is 7 narrower, but his thigh is 2
  // wider and has become the outer surface by y≈420 — so the silhouette here
  // is 209 against her 208. Narrowing this to match the hip alone would leave
  // a rim of him showing outside trousers that do in fact cover it.
  //
  // Except at its top corners, where his arms hang beside his hips. His right
  // arm hangs a unit or so nearer his body than his left, and the box reached
  // over the inside of it from y 400 to 450, past where the forearm zone gives
  // it back — so trousers, which take the hip, erased a sliver of arm nothing
  // covers: sixteen pixels. The corners are cut back along the daylight
  // between arm and hip, down to y 458 — over a unit clear of the faintest
  // edge of the arm, and fourteen clear of his body.
  hip: "M216 400 L384 400 L398 458 L398 516 L202 516 L202 458 Z",
  // The inner edge stops short of the deepest lapel notch in this wardrobe.
  // Reach past it and the jacket's V erases a shoulder it leaves bare.
  upperArm: limb(230, [166, 244], 318, [170, 222]),
  // Narrower than hers, even though his arm is thicker. The inner edge tracks
  // where the *torso* takes over in front of the arm, not where the arm ends,
  // and his torso is wider. Widen these and the overlay repaints a stripe of
  // bare chest over the shirt.
  forearm: limb(332, [166, 220], 486, [162, 196]),
  hand: limb(494, [158, 194], 578, [174, 196]),
  thigh: box(194, 508, 406, 692),
  knee: box(212, 668, 388, 726),
  calf: box(202, 718, 398, 890),
  foot: [box(238, 892, 302, 964), box(298, 892, 362, 964)].join(" "),
};

/** Front view: the forearms and hands hang over whatever is being worn. */
const OVERLAY: BodyZone[] = ["forearm", "hand"];

/**
 * The bodies on offer.
 *
 * Each carries its own anchors and its own zone geometry — not a shared
 * reference — because each has its own wardrobe cut against them.
 */
export const bodies: Record<BodyType, BodyAsset> = {
  female: {
    id: "female",
    label: { en: "Female", ar: "نسائي" },
    view: { front: "/mannequin/female-front.png" },
    anchors: FEMALE_ANCHORS,
    zones: FEMALE_ZONES,
    overlay: [...OVERLAY],
  },
  male: {
    id: "male",
    label: { en: "Male", ar: "رجالي" },
    view: { front: "/mannequin/male-front.png" },
    anchors: MALE_ANCHORS,
    zones: MALE_ZONES,
    overlay: [...OVERLAY],
  },
};

export const bodyById = (id: BodyType): BodyAsset => bodies[id] ?? bodies.female;

/** Bodies in display order, for the picker. */
export const bodyTypes: BodyAsset[] = [bodies.female, bodies.male];
