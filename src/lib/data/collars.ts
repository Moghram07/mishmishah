import type { BodyType, Collar, Garment, Localized, StripeEdgeId, StripesId, TieId } from "@/types";

/**
 * The collars.
 *
 * A collar used to be a path inside one garment's drawing, which made it the
 * one part of an outfit nobody could choose. It is a record here instead, on
 * the same terms a garment is: cut for one body, drawn in one file, claiming
 * only the zones it covers, and taking its own fabric.
 *
 *   • `gender`          — the one body it is cut for, exactly as a garment.
 *   • `coverage`        — added to the garment's, not replacing it. Only the
 *                         turtleneck names a zone: it is the only one that
 *                         covers the neck end to end.
 *   • `compatibleWith`  — the garment categories it fits, and a claim about
 *                         geometry rather than taste. A collar is sewn into a
 *                         neckline, so it has to cover it; `check:garments`
 *                         walks every collar against every garment it names and
 *                         rejects the pairs where it does not reach.
 *   • `fabricRegions`   — always `["collar"]`. One piece of cloth, its own
 *                         topstitch, cut on the same grain as everything else.
 *   • `footprint`       — how big it is, in centimetres. These nine are not the
 *                         same size in reality: a mandarin is a band at the
 *                         throat, a sailor falls across the whole shoulder.
 *                         Declaring it here is what stops a collar drifting
 *                         back to whatever fitted most easily round the neck.
 *
 * Ids are `<body>-<name>-collar`, so a collar id can never be mistaken for a
 * garment id in a log or a lookup.
 *
 * Both bodies, now. The male wardrobe used to draw its collars inside its
 * garments, and that is exactly why they were the worst-looking pieces in the
 * app: `check:garments` walks the records below, so a collar that is not one
 * is a collar nothing measures. His had drifted to a trapezoid hanging off the
 * collarbone with his throat bare above it, no arc behind the neck, and three
 * transparent holes where four subpaths of one `evenodd` path cancelled — and
 * every check in this project passed the whole time.
 *
 * Adding his four cost four records and four drawings against his yoke. No code
 * changed, which was the whole point of the exercise.
 */

/**
 * Every count of stripes, none first: what a collar or a neckline that takes
 * them offers. Here, not with the necklines, because `check:garments` reads
 * this file as it is.
 */
export const STRIPE_COUNTS: StripesId[] = ["none", "one", "two", "three"];


/** Everything that closes a round neckline: the eight with a neckband. */
const ROUND_NECK: Collar["compatibleWith"] = ["top", "dress"];

export const collars: Collar[] = [
  {
    id: "female-shirt-collar",
    name: { en: "Shirt collar", ar: "ياقة قميص" },
    gender: "female",
    coverage: [],
    fabricRegions: ["collar"],
    compatibleWith: ROUND_NECK,
    /**
     * A band round her neck and two leaves folded down from its top, as his
     * is — see `art/female/collars/shirt.tsx`. The band rises 13 units above
     * the seam at the side of her neck, about as tall as her mandarin; the
     * leaves hang from it and open in a narrow V, where the band shows with
     * one button, to points about 6.5 cm long. Measured, the front is
     * 14.3 × 6.5 cm.
     *
     * It was 10–15 cm deep when the leaves were cut from the neckline, with
     * her neck bare between them above the placket.
     */
    footprint: { width: [13, 16.5], drop: [5.5, 8] },
    build: { stand: 13, fall: "points" },
    opening: "high",
    asset: { front: "female-shirt-collar-front", behindBody: "female-shirt-collar-behind" },
  },
  {
    id: "female-peter-pan-collar",
    name: { en: "Peter Pan collar", ar: "ياقة بيتر بان" },
    gender: "female",
    coverage: [],
    fabricRegions: ["collar"],
    compatibleWith: ROUND_NECK,
    /**
     * Small and flat, right round the neckline: about 5.7 cm of cloth from
     * the seam, its rounded front ends meeting at the neck and its back ends
     * lying along the shoulders — so wide across, about 21 cm on a crew
     * neck, and shallow, about 10 cm from the collar points to the foot of
     * its curves. It was 16.5 × 12.7 cm, 6.5 deep at centre front: a bib.
     */
    footprint: { width: [19, 23], drop: [8, 12] },
    build: { stand: 0, fall: "flat" },
    opening: "round",
    asset: { front: "female-peter-pan-collar-front" },
  },
  {
    id: "female-mandarin-collar",
    name: { en: "Mandarin collar", ar: "ياقة صينية" },
    gender: "female",
    coverage: [],
    fabricRegions: ["collar"],
    compatibleWith: ROUND_NECK,
    /**
     * A short band at the throat, its ends meeting at the front over a tiny V
     * — the smallest of the set, built as his mandarin is. Shorter than the
     * turtleneck on purpose as well as in fact: two bands of the same width
     * and height are one collar drawn twice, and `check:garments` rejects a
     * pair whose boxes agree on both axes.
     */
    footprint: { width: [9, 13], drop: [4, 8] },
    /* open at the front: the V runs down to the seam, as his does */
    build: { stand: 14, fall: "none", front: "open" },
    opening: "high",
    asset: { front: "female-mandarin-collar-front", behindBody: "female-mandarin-collar-behind" },
  },
  {
    id: "female-bow-collar",
    name: { en: "Bow collar", ar: "ياقة بفيونكة" },
    gender: "female",
    coverage: [],
    fabricRegions: ["collar"],
    compatibleWith: ROUND_NECK,
    /** Narrow, but the tails hang to the bust: deeper than it is wide. */
    footprint: { width: [11, 16], drop: [18, 24] },
    build: { stand: 8, fall: "soft" },
    opening: "high",
    asset: { front: "female-bow-collar-front", behindBody: "female-bow-collar-behind" },
  },
  {
    /**
     * The jacket's lapel. Sewn to a break at y 262 rather than to the band the
     * others close, so it fits outerwear and nothing else — put it on a round
     * neck and the opening would show behind it.
     */
    id: "female-notched-collar",
    name: { en: "Notched collar", ar: "ياقة بدلة" },
    gender: "female",
    coverage: [],
    fabricRegions: ["collar"],
    compatibleWith: ["outerwear"],
    /**
     * A lapel, and the deepest thing here: the band at the neck down to the
     * jacket's break at y 262, and the lapel below it to y 303. The band is
     * why this is 3 cm deeper than it was — a top collar wraps the throat like
     * any other, and the first draft simply had not drawn that part.
     */
    /**
     * A lapel that breaks at the waist button, as a single-breasted jacket's
     * does — so it is as long as the V it lines, neck to button. It was sized
     * to a break at y 262 on a jacket fastened with three buttons below it.
     */
    footprint: { width: [18, 24], drop: [32, 40] },
    build: { stand: 14, fall: "points" },
    opening: "v",
    asset: {
      front: "female-notched-collar-front",
      behindBody: "female-notched-collar-behind",
    },
  },
  {
    id: "female-sailor-collar",
    name: { en: "Sailor collar", ar: "ياقة بحرية" },
    gender: "female",
    coverage: [],
    fabricRegions: ["collar"],
    /* a dress only: neither top has a V to sew it down */
    compatibleWith: ["dress"],
    /**
     * Across both shoulders — the widest footprint here, by a distance: each
     * panel lies on its shoulder out to within 1.6 cm of the shoulder point,
     * and narrows to the V's point at mid-chest, 14 cm below the collar
     * points. Drawn, 34.2 × 13.9 cm. It was 27.9 × 21.1: two panels hanging
     * below the shoulder line from the collar points, down the chest.
     */
    footprint: { width: [32, 37], drop: [12.5, 16] },
    /**
     * Flat, and open at the front: two panels that lie on the shoulders and
     * part in a V. No stand, so nothing behind the neck either — the back of
     * a sailor collar lies flat on the back, and the band that used to stand
     * behind the neck showed beside it as two stubs above the shoulder line.
     */
    build: { stand: 0, fall: "flat", front: "open" },
    /**
     * Sewn down a V, where it began: its panels down the V's edges, meeting
     * at its point. Neither top has a V, or any of the cuts below.
     */
    opening: "v",
    /**
     * And it follows five more of the dress's necklines, cut to each — see
     * `sailorOn` in `collarCuts.ts`: round a boat one wide flat collar
     * 7.6 cm across (photo 1), and round a round neck, a square and a scoop
     * 5.3 cm, its ends on the shoulders as the V's panels' are; and down a
     * wrap, a band along each edge of its V, the top one crossing over the
     * other's end and running on down its edge to the tie (photos 2–3).
     */
    necklines: ["v", "boat", "wrap", "round", "square", "scoop"],
    /**
     * Its size on each, as wide across the shoulders as on the V: round a
     * boat 10.6 cm deep, a round neck 11.8, a square 14.4, a scoop 16.3;
     * down a wrap 31, to the waist seam.
     */
    footprintOn: {
      boat: { width: [32, 37], drop: [9.5, 12] },
      round: { width: [32, 37], drop: [10.5, 13.5] },
      square: { width: [32, 37], drop: [13, 16] },
      scoop: { width: [32, 37], drop: [15, 17.5] },
      wrap: { width: [32, 37], drop: [29, 33.5] },
    },
    asset: { front: "female-sailor-collar-front" },
    /** Stripes along its outer edge, as the dress's other edges take them — see `Garment.stripes`. */
    takesStripes: true,
    /**
     * And at the point of its V, nothing, a small tied bow, or a necktie —
     * on the V alone for now, the one cut it has a point on: ties at every
     * neckline's point and on the belt come next.
     */
    ties: { offered: ["none", "knot", "necktie"], default: "none", on: ["v"] },
  },
  {
    id: "female-ruffled-collar",
    name: { en: "Ruffled collar", ar: "ياقة مكشكشة" },
    gender: "female",
    coverage: [],
    fabricRegions: ["collar"],
    compatibleWith: ROUND_NECK,
    /**
     * A closed ring of scallops round the throat: wide, and shallower than it
     * is wide. The band was written when this was a horseshoe falling to the
     * collarbone; centred on the neck instead, it does not reach that far
     * down, and 12 to 18 cm is what a ring of this width actually measures.
     */
    footprint: { width: [16, 22], drop: [12, 18] },
    /**
     * Twenty-four, not thirty-seven. The frill used to rise to y 140 — seven
     * units above the jaw — and nothing in the stage is ever drawn in front of
     * a collar, so that was cloth across a chin rather than a ruff under one.
     * Held below the jawline it stands this much, and the number follows the
     * cloth rather than the other way round.
     */
    build: { stand: 24, fall: "gathered" },
    opening: "high",
    asset: { front: "female-ruffled-collar-front", behindBody: "female-ruffled-collar-behind" },
  },
  {
    /**
     * The plain unbroken band. It used to be a ribbed tube reaching y 223 and
     * claiming the `neck` zone; it is the shape that was filed as the mandarin
     * collar, which is what an unbroken band rising up a throat actually is.
     *
     * It claims no zone. A band stopping at y 194 does not cover the neck end
     * to end, and the coverage check measures a claim against the collar's own
     * cloth — claiming it would erase a throat nothing paints back. Nothing is
     * lost: the band is wider than the neck everywhere it covers, so no pale
     * rim survives.
     */
    id: "female-turtleneck-collar",
    name: { en: "Turtleneck", ar: "ياقة عالية" },
    gender: "female",
    coverage: [],
    fabricRegions: ["collar"],
    compatibleWith: ROUND_NECK,
    /** A band up the throat — taller than the mandarin, and unbroken. */
    footprint: { width: [9, 13], drop: [5, 10] },
    build: { stand: 24, fall: "none" },
    opening: "high",
    asset: { front: "female-turtleneck-collar-front", behindBody: "female-turtleneck-collar-behind" },
  },

  /* ----------------------------------------------------------------- male */
  {
    id: "male-shirt-collar",
    name: { en: "Shirt collar", ar: "ياقة قميص" },
    gender: "male",
    coverage: [],
    fabricRegions: ["collar"],
    /** A shirt, a polo, and a thobe — which is as often worn with one as with a band. */
    compatibleWith: ["top", "dress"],
    /**
     * A band round his neck and two leaves folded down from its top — see
     * `art/male/collars/shirt.tsx`. The band rises 20 units above the seam at
     * the side of his neck, to a roll line halfway to his jaw; the leaves hang
     * from it to a centimetre below the seam and open in a narrow V to points
     * about 8 cm long on the upper chest. Measured, the front is 16.1 × 8.0 cm.
     *
     * It was 11–16 cm deep when the leaves were cut from the neckline and ran
     * down to points on the chest, with the neck bare above them.
     */
    footprint: { width: [14.5, 18], drop: [7, 9.5] },
    build: { stand: 20, fall: "points" },
    opening: "high",
    asset: {
      front: "male-shirt-collar-front",
      behindBody: "male-shirt-collar-behind",
    },
  },
  {
    id: "male-polo-collar",
    name: { en: "Polo collar", ar: "ياقة بولو" },
    gender: "male",
    coverage: [],
    fabricRegions: ["collar"],
    compatibleWith: ["top"],
    /**
     * Knit rib, folded six units above the seam round the neck, with no band
     * across the front: the fold comes down to the top of the placket, where
     * the leaves meet, and the neck shows above it — see
     * `art/male/collars/polo.tsx`. Round, blunt points, and a fall that lies
     * wider over the collarbones than a shirt's. Measured, the front is
     * 16.9 × 9.7 cm.
     */
    footprint: { width: [15, 20], drop: [8, 13] },
    build: { stand: 6, fall: "flat" },
    opening: "high",
    asset: {
      front: "male-polo-collar-front",
      behindBody: "male-polo-collar-behind",
    },
  },
  {
    id: "male-regular-collar",
    name: { en: "Regular collar", ar: "رقبة عادي" },
    gender: "male",
    coverage: [],
    fabricRegions: ["collar"],
    /** The thobe's alone, which is a `dress` by category. */
    compatibleWith: ["dress"],
    /**
     * The regular thobe collar, «رقبة عادي» on the chart: a band 3.8 cm tall
     * round his neck, one end running on past the centre into a tab buttoned
     * over the other with two buttons — see `art/male/collars/regular.tsx`.
     * It was filed as a mandarin.
     */
    footprint: { width: [8, 12], drop: [5, 9] },
    build: { stand: 20, fall: "none", front: "tab" },
    opening: "high",
    /* her dress has no regular collar: it takes her mandarin */
    across: "female-mandarin-collar",
    asset: {
      front: "male-regular-collar-front",
      behindBody: "male-regular-collar-behind",
    },
  },
  {
    id: "male-regular-short-collar",
    name: { en: "Short regular collar", ar: "رقبة عادي قصير" },
    gender: "male",
    coverage: [],
    fabricRegions: ["collar"],
    /** The thobe's alone, as the regular collar is. */
    compatibleWith: ["dress"],
    /** The same band cut to 2.5 cm, its tab buttoned once — the smallest of his. */
    footprint: { width: [8, 12], drop: [3.5, 7] },
    build: { stand: 13, fall: "none", front: "tab" },
    opening: "high",
    across: "female-mandarin-collar",
    asset: {
      front: "male-regular-short-collar-front",
      behindBody: "male-regular-short-collar-behind",
    },
  },
  {
    id: "male-mandarin-collar",
    name: { en: "Mandarin collar", ar: "رقبة صيني" },
    gender: "male",
    coverage: [],
    fabricRegions: ["collar"],
    compatibleWith: ["top", "dress"],
    /**
     * A band about 3 cm tall whose ends stop short of the centre front in a
     * small V, with no button: the garment's placket starts under it — see
     * `art/male/collars/mandarin.tsx`.
     */
    footprint: { width: [8, 12], drop: [4, 8] },
    build: { stand: 16, fall: "none", front: "open" },
    opening: "high",
    asset: {
      front: "male-mandarin-collar-front",
      behindBody: "male-mandarin-collar-behind",
    },
  },
  {
    /**
     * The jacket's lapel. Sewn to a break at y 266 rather than to the band the
     * others close, so it fits outerwear and nothing else — put it on a round
     * neck and the opening would show behind it.
     */
    id: "male-notched-collar",
    name: { en: "Notched collar", ar: "ياقة بدلة" },
    gender: "male",
    coverage: [],
    fabricRegions: ["collar"],
    compatibleWith: ["outerwear"],
    /**
     * The band at the neck down to the break, and the lapel below it — which
     * on his jacket runs to the waist button, not to the break. The longest
     * thing in either wardrobe.
     */
    /**
     * A lapel that breaks at his waist button, so it is as long as the V it
     * lines, neck to button — his waist sits lower than hers, so it is longer.
     */
    footprint: { width: [22, 29], drop: [38, 46] },
    build: { stand: 14, fall: "points" },
    opening: "v",
    asset: {
      front: "male-notched-collar-front",
      behindBody: "male-notched-collar-behind",
    },
  },
];

export const collarById = (id: string): Collar | undefined =>
  collars.find((c) => c.id === id);

/** Every collar cut for one body — and the only ones it may ever be offered. */
export const collarsFor = (body: BodyType): Collar[] =>
  collars.filter((c) => c.gender === body);

/**
 * The collars that can be sewn to this garment: cut for the same body, fitting
 * its category, and only if it has a neckline to sew them to at all.
 *
 * This is the list the picker offers and the only list the renderer honours, so
 * a stale choice from another body cannot survive a mannequin switch.
 */
export const collarsForGarment = (garment: Garment): Collar[] =>
  garment.acceptsCollar
    ? collarsFor(garment.gender).filter((c) =>
        c.compatibleWith.includes(garment.category)
      )
    : [];

/** The collar a garment arrives wearing, if it names one that still fits. */
export const defaultCollar = (garment: Garment): Collar | undefined => {
  if (!garment.defaultCollar) return undefined;
  const collar = collarById(garment.defaultCollar);
  return collar && collarsForGarment(garment).includes(collar)
    ? collar
    : undefined;
};

/** Stripe counts, by name. */
const STRIPE_NAMES: Record<StripesId, Localized> = {
  none: { en: "None", ar: "بدون" },
  one: { en: "One", ar: "شريط" },
  two: { en: "Two", ar: "شريطان" },
  three: { en: "Three", ar: "ثلاثة شرائط" },
};

/** The edges stripes go along, by name. */
const STRIPE_EDGE_NAMES: Record<StripeEdgeId, Localized> = {
  collar: { en: "Collar", ar: "الياقة" },
  neckline: { en: "Neckline", ar: "الرقبة" },
  sleeves: { en: "Sleeves", ar: "الأكمام" },
  hem: { en: "Hem", ar: "الذيل" },
  belt: { en: "Belt", ar: "الحزام" },
};

/** Ties, by name. */
const TIE_NAMES: Record<TieId, Localized> = {
  none: { en: "None", ar: "بدون" },
  knot: { en: "Knot", ar: "عقدة" },
  necktie: { en: "Necktie", ar: "ربطة عنق" },
};

/** The stripe counts on offer, by name, from a collar's or a neckline's offer — none for one that takes none. */
export const stripesFor = (offer: { offered: StripesId[] } | undefined): { id: StripesId; name: Localized }[] =>
  offer ? offer.offered.map((id) => ({ id, name: STRIPE_NAMES[id] })) : [];

/** The edges stripes can go along, by name — see `stripeEdgesOf`. */
export const stripeEdgesFor = (edges: readonly StripeEdgeId[]): { id: StripeEdgeId; name: Localized }[] =>
  edges.map((id) => ({ id, name: STRIPE_EDGE_NAMES[id] }));

/** The ties a collar can be worn with on a cut, by name — none for a collar that takes none, or none there. */
export const tiesFor = (collar: Collar | undefined, cut?: string): { id: TieId; name: Localized }[] =>
  collar?.ties && !(collar.ties.on && cut && !collar.ties.on.includes(cut))
    ? collar.ties.offered.map((id) => ({ id, name: TIE_NAMES[id] }))
    : [];
