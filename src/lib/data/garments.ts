import type { BodyType, CuffId, Garment, GarmentLayer, SleeveTypeId } from "@/types";

/**
 * The sleeves a top can be cut with. Hers: every type. His: the ones menswear
 * is actually made in — a set-in or raglan sleeve, a dropped shoulder, a
 * kimono tee. Puff, bishop, bell, flutter and cap are women's cuts, and a
 * picker that offered them on him would be offering something no one sells.
 *
 * Which of these a body can wear at all is decided in `garments/sleeves.ts`;
 * this only says which each garment offers.
 */
const FEMALE_SLEEVES: SleeveTypeId[] = [
  "set-in", "drop", "raglan", "kimono", "dolman", "puff", "bishop", "bell", "flutter", "cap",
];
const MALE_SLEEVES: SleeveTypeId[] = ["set-in", "drop", "raglan", "kimono"];

/**
 * The cuffs a long sleeve is offered with. A woven garment takes a plain,
 * formal or French cuff; a knit one only a rib — a buttoned shirt cuff on a
 * t-shirt looks wrong.
 */
const WOVEN_CUFFS: CuffId[] = ["none", "plain", "formal", "french"];
/** The dress's: the woven cuffs on a long sleeve, and a wide band at any length — see `cuffsOffered`. */
const DRESS_CUFFS: CuffId[] = [...WOVEN_CUFFS, "band"];
const KNIT_CUFFS: CuffId[] = ["none", "rib"];

/**
 * The wardrobes.
 *
 * Seven garments for her, with her abaya, and six for him, front view —
 * deliberately few. They exist to prove the four rules the renderer runs on,
 * and every one of those is expressed here as data rather than as code:
 *
 *   • `gender`     — the one body a garment is cut for. There is no `unisex`:
 *                    a drawing is built against one figure's anchors and its
 *                    coverage erases that figure's zones, so a garment offered
 *                    on the other body erases what it cannot reach.
 *   • `layer`      — draw order, and the fact that two tops cannot both be worn.
 *   • `coverage`   — the body zones a garment hides, which also decides when a
 *                    garment underneath has become invisible and can be skipped.
 *   • `incompatibleWith` — pairs that clear each other, in either direction.
 *   • `acceptsCollar` — whether the neckline is one a collar can be sewn to.
 *                    A garment either finishes its own neck or leaves the
 *                    `collar` region to a record in `data/collars.ts`, never
 *                    both. The male wardrobe still draws its own, which is why
 *                    three male records keep a `collar` region and accept none.
 *
 * Ids are `<body>-<piece>`, and the prefix is load-bearing rather than
 * decorative: `garmentPiece` strips it to pair a garment with its counterpart
 * on the other body when the mannequin is switched.
 *
 * Adding a garment is a record here plus a drawing in
 * `lib/garments/art/<body>/`. Nothing else moves.
 */

/** Draw order, innermost first. */
export const LAYER_ORDER: GarmentLayer[] = [
  "skin",
  "base",
  "bottom",
  "top",
  "mid",
  "outer",
  "accessory",
];

export const garments: Garment[] = [
  /* ------------------------------------------------------------- female */
  {
    id: "female-t-shirt",
    name: { en: "T-shirt", ar: "تي شيرت" },
    category: "top",
    gender: "female",
    layer: "top",
    coverage: ["shoulderCap", "upperChest", "torso", "upperArm"],
    fabricRegions: ["body"],
    incompatibleWith: [],
    acceptsCollar: true,
    sleeves: { types: FEMALE_SLEEVES, default: { type: "set-in", length: "short" }, cuffs: KNIT_CUFFS },
    asset: { front: "female-t-shirt-front" },
  },
  {
    id: "female-blouse",
    name: { en: "Blouse", ar: "بلوزة" },
    category: "top",
    gender: "female",
    layer: "top",
    coverage: ["shoulderCap", "upperChest", "torso", "upperArm", "forearm"],
    /**
     * No `collar` of its own any more: the shirt collar it used to draw is a
     * record in `data/collars.ts`, and this arrives wearing it. Its neckline is
     * cut round rather than to a deep V, so any of the nine can be sewn to it —
     * the V comes back with the collar that has one.
     */
    fabricRegions: ["body", "placket"],
    incompatibleWith: [],
    acceptsCollar: true,
    defaultCollar: "female-shirt-collar",
    sleeves: { types: FEMALE_SLEEVES, default: { type: "set-in", length: "long", cuff: "formal" }, cuffs: WOVEN_CUFFS },
    asset: { front: "female-blouse-front" },
  },
  {
    id: "female-trousers",
    name: { en: "Trousers", ar: "بنطلون" },
    category: "bottom",
    gender: "female",
    layer: "bottom",
    coverage: ["hip", "thigh", "knee", "calf"],
    fabricRegions: ["body"],
    incompatibleWith: [],
    acceptsCollar: false,
    legs: { offered: ["straight", "slim", "wide", "palazzo", "flare"], default: "straight" },
    asset: { front: "female-trousers-front" },
  },
  {
    id: "female-skirt",
    name: { en: "Skirt", ar: "تنورة" },
    category: "bottom",
    gender: "female",
    layer: "bottom",
    // The hip; its length adds what it hides below — see `skirtCoverage`.
    coverage: ["hip"],
    fabricRegions: ["body"],
    incompatibleWith: ["female-trousers"],
    acceptsCollar: false,
    skirt: { shapes: ["aline", "flared", "circle", "pencil", "pleated", "tiered", "mermaid"], lengths: ["knee", "midi", "maxi"], default: { shape: "flared", length: "midi" } },
    asset: { front: "female-skirt-front" },
  },
  {
    id: "female-dress",
    name: { en: "Dress", ar: "فستان" },
    category: "dress",
    gender: "female",
    layer: "top",
    // Its skirt's length adds what it hides below the hip — see `skirtCoverage`.
    coverage: ["shoulderCap", "torso", "upperArm", "hip"],
    fabricRegions: ["top", "bottom"],
    incompatibleWith: ["female-trousers", "female-skirt"],
    acceptsCollar: true,
    /**
     * The one garment cut to a neckline so far. Every other piece keeps the
     * opening its own drawing cuts, exactly as before — opting in is this line
     * and a `cut` on the drawing.
     */
    acceptsNeckline: true,
    defaultNeckline: "female-round-neckline",
    sleeves: { types: FEMALE_SLEEVES, default: { type: "set-in", length: "short" }, cuffs: DRESS_CUFFS },
    skirt: {
      shapes: ["aline", "flared", "circle", "pencil", "pleated", "tiered", "mermaid"],
      lengths: ["knee", "midi", "maxi"],
      waists: ["empire", "natural", "dropped"],
      default: { shape: "flared", length: "midi", waist: "natural" },
    },
    /* buttoned down a straight centre front only — see `buttonsOn` — and belted on any cut but the wrap */
    buttons: { offered: ["none", "waist", "hem"], default: "none", rows: ["one", "two"] },
    belts: { offered: ["none", "self", "brown", "black", "sash", "ribbon"], default: "none" },
    /* stripes along any of its edges — collar, neckline, sleeves, hem — the counts `STRIPE_COUNTS` lists; a test keeps the two the same */
    stripes: { offered: ["none", "one", "two", "three"], default: "none" },
    /* its cuffs and bands, and a fabric belt, each in a cloth of its own if wanted */
    partCloths: ["cuff", "belt"],
    /* a tie at the centre front of its neck, or on a fabric belt — see `tiePlacesOf` */
    ties: { offered: ["none", "knot", "necktie", "scarf"], default: "none" },
    asset: { front: "female-dress-front" },
  },
  {
    id: "female-jacket",
    name: { en: "Jacket", ar: "جاكيت" },
    category: "outerwear",
    gender: "female",
    layer: "outer",
    /**
     * No `torso`. The jacket is open to a button at the waist and falls away
     * below it, so its cloth covers her trunk everywhere except its own
     * opening — and erasing the trunk would cut a hole there the shape of the
     * V. What shows through it is the body, or the top worn under it.
     */
    /**
     * Nor the forearm: the sleeve stops a centimetre short of a blouse's, so
     * it no longer spans the zone, and the wrist below it is her own.
     */
    coverage: ["shoulderCap", "upperArm"],
    /** Its lapel is the notched collar now — the only one cut to this V. */
    fabricRegions: ["body"],
    incompatibleWith: [],
    acceptsCollar: true,
    defaultCollar: "female-notched-collar",
    asset: { front: "female-jacket-front" },
  },
  {
    id: "female-abaya",
    name: { en: "Abaya", ar: "عباية" },
    category: "outerwear",
    gender: "female",
    /* worn over everything, as the jacket is: putting one on takes the other off */
    layer: "outer",
    /**
     * Its shoulders and upper arms, and nothing its open front shows: between
     * the fronts are her trunk, hips and legs, or what is worn over them, so
     * erasing them would cut a hole the shape of the opening. Nor the
     * forearm: its sleeve ends where any long sleeve does, short of the
     * zone's last rows, and the wrist below it is her own.
     */
    coverage: ["shoulderCap", "upperArm"],
    fabricRegions: ["body"],
    incompatibleWith: [],
    acceptsCollar: false,
    /**
     * Open, its fronts hang apart and what she wears shows between them;
     * closed on hidden snaps, only in its neckline. Either way it holds what
     * is worn under it the same, and claims no more of her: what it covers
     * closed, its cloth simply paints over.
     */
    fronts: { offered: ["open", "closed"], default: "open" },
    /**
     * Its own sleeves, every one long, and named as an abaya's are: the regular
     * one «عادي»; the wide one «واسع», a bell; the kimono, cut in one with the
     * body — long on the abaya alone; and the butterfly «فراشة», whose wings
     * are the body, from the shoulder to the hem.
     */
    sleeves: {
      types: ["set-in", "bell", "kimono", "butterfly"],
      default: { type: "set-in", length: "long" },
      lengths: ["long"],
      names: {
        "set-in": { en: "Regular", ar: "عادي" },
        bell: { en: "Wide", ar: "واسع" },
        kimono: { en: "Kimono", ar: "كيمونو" },
        butterfly: { en: "Butterfly", ar: "فراشة" },
      },
    },
    asset: { front: "female-abaya-front" },
  },

  /* --------------------------------------------------------------- male */
  {
    id: "male-t-shirt",
    name: { en: "T-shirt", ar: "تي شيرت" },
    category: "top",
    gender: "male",
    layer: "top",
    coverage: ["shoulderCap", "upperChest", "torso", "upperArm"],
    fabricRegions: ["body"],
    incompatibleWith: [],
    acceptsCollar: false,
    sleeves: { types: MALE_SLEEVES, default: { type: "set-in", length: "short" }, cuffs: KNIT_CUFFS },
    asset: { front: "male-t-shirt-front" },
  },
  {
    id: "male-shirt",
    name: { en: "Shirt", ar: "قميص" },
    category: "top",
    gender: "male",
    layer: "top",
    coverage: ["shoulderCap", "upperChest", "torso", "upperArm", "forearm"],
    fabricRegions: ["body", "placket"],
    incompatibleWith: [],
    acceptsCollar: true,
    defaultCollar: "male-shirt-collar",
    sleeves: { types: MALE_SLEEVES, default: { type: "set-in", length: "long", cuff: "formal" }, cuffs: WOVEN_CUFFS },
    asset: { front: "male-shirt-front" },
  },
  {
    id: "male-polo",
    name: { en: "Polo", ar: "بولو" },
    category: "top",
    gender: "male",
    layer: "top",
    coverage: ["shoulderCap", "upperChest", "torso", "upperArm"],
    fabricRegions: ["body", "placket"],
    incompatibleWith: [],
    acceptsCollar: true,
    defaultCollar: "male-polo-collar",
    /* short as it arrives; made long, it takes its rib cuff */
    sleeves: { types: MALE_SLEEVES, default: { type: "set-in", length: "short", cuff: "rib" }, cuffs: KNIT_CUFFS },
    asset: { front: "male-polo-front" },
  },
  {
    id: "male-trousers",
    name: { en: "Trousers", ar: "بنطلون" },
    category: "bottom",
    gender: "male",
    layer: "bottom",
    coverage: ["hip", "thigh", "knee", "calf"],
    fabricRegions: ["body"],
    incompatibleWith: [],
    acceptsCollar: false,
    legs: { offered: ["straight", "slim", "wide"], default: "straight" },
    asset: { front: "male-trousers-front" },
  },
  {
    id: "male-jacket",
    name: { en: "Jacket", ar: "جاكيت" },
    category: "outerwear",
    gender: "male",
    layer: "outer",
    /**
     * No `torso`, as hers: the jacket is open to a button at his waist and falls
     * away below it, so erasing his trunk would cut a hole the shape of the V.
     */
    /** No forearm: the sleeve stops short of a shirt's, so it does not span the zone. */
    coverage: ["shoulderCap", "upperArm"],
    fabricRegions: ["body"],
    incompatibleWith: [],
    acceptsCollar: true,
    defaultCollar: "male-notched-collar",
    asset: { front: "male-jacket-front" },
  },
  {
    id: "male-thobe",
    name: { en: "Thobe", ar: "ثوب" },
    category: "dress",
    gender: "male",
    layer: "top",
    /**
     * Shoulder to ankle. Because this covers everything the trousers cover,
     * the two need no incompatibility: `visibleStack` simply stops drawing the
     * trousers while it is on, and they are back when it comes off — which is
     * also how a thobe is worn.
     */
    coverage: [
      "shoulderCap",
      "upperChest",
      "torso",
      "upperArm",
      "forearm",
      "hip",
      "thigh",
      "knee",
      "calf",
    ],
    fabricRegions: ["body", "placket"],
    incompatibleWith: [],
    acceptsCollar: true,
    /* the regular thobe collar, with its two buttons, as most Saudi thobes have */
    defaultCollar: "male-regular-collar",
    /**
     * A long sleeve ends in a plain hem or gathers into a plain cuff, «كبك
     * سادة» — the thobe arrives in the cuff.
     */
    sleeves: {
      types: MALE_SLEEVES,
      default: { type: "set-in", length: "long", cuff: "plain" },
      cuffs: WOVEN_CUFFS,
    },
    asset: { front: "male-thobe-front" },
  },
];

export const garmentById = (id: string): Garment | undefined =>
  garments.find((g) => g.id === id);

/**
 * The wardrobe for one body — and the only garments that may ever be offered on
 * it, drawn on it, or left worn after a body switch.
 *
 * A garment is cut against one figure's anchors and its coverage erases that
 * figure's zones, so putting it on the other body does not merely look wrong:
 * it erases a zone the drawing never reaches, and the mannequin comes through
 * the hole.
 */
export const garmentsFor = (body: BodyType): Garment[] =>
  garments.filter((g) => g.gender === body);

/**
 * The piece a garment is, with the body stripped off — `"t-shirt"`, `"jacket"`.
 * This is how a garment finds its opposite number when the body changes.
 */
export const garmentPiece = (garment: Garment): string =>
  garment.id.slice(garment.gender.length + 1);

/** What each mannequin arrives wearing: the one piece with two fabric regions. */
const DEFAULT_ID: Record<BodyType, string> = {
  female: "female-dress",
  male: "male-thobe",
};

export const defaultGarment = (body: BodyType): Garment =>
  garmentById(DEFAULT_ID[body]) ?? garmentsFor(body)[0];
