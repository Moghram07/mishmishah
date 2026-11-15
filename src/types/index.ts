/** Core domain types for the Mishmishah platform. */

export type Locale = "en" | "ar";
export type Theme = "light" | "dark";

/** A localized string — English + Arabic. */
export interface Localized {
  en: string;
  ar: string;
}

export type FabricMotif =
  | "solid"
  | "stripe"
  | "plaid"
  | "herringbone"
  | "dots"
  | "floral"
  | "geometric"
  | "damask";

export type FabricMaterial =
  | "cotton"
  | "linen"
  | "silk"
  | "wool"
  | "velvet"
  | "denim"
  | "chiffon"
  | "crepe"
  | "leather";

export type FabricTexture = "smooth" | "woven" | "pile" | "sheer" | "ribbed";

export type CategoryKey =
  | "fashion"
  | "furniture"
  | "curtains"
  | "rugs"
  | "accessories"
  | "outdoor"
  | "luxury"
  | "wedding"
  | "home-decor";

/** Colors used to synthesize a procedural motif. */
export interface FabricPalette {
  base: string;
  accent: string;
  highlight?: string;
}

/** A palette bound to a motif — enough to draw a decorative tile. */
export interface FabricSwatch extends FabricPalette {
  motif: FabricMotif;
}

/**
 * Where a fabric's artwork comes from. `procedural` synthesizes a tile from a
 * motif + palette; `image` uses a real photographed, tileable fabric scan.
 */
export type FabricSource = "procedural" | "image";

/**
 * Everything a fabric carries regardless of where its artwork comes from.
 *
 * The fabrics today are Mishmishah's own samples, sold by no store, so they
 * carry no price, stock, store or rating. Those arrive with the fabrics
 * stores upload, as real figures.
 */
interface FabricCommon {
  id: string;
  name: Localized;
  /** Primary hex, used for the color filter and as an artwork fallback. */
  color: string;
  material: FabricMaterial;

  // — catalogue metadata —
  colorName: Localized;
  texture: FabricTexture;
  categories: CategoryKey[];
}

/**
 * A fabric drawn from a motif. Its print size is **not** stored here: the motif
 * owns `repeatCm` (see `lib/fabrics/patterns.ts`) and every fabric using that
 * motif inherits it. Two plaids are the same size as each other, always. The
 * `never` fields make an override a compile error, not a judgement call.
 */
export interface ProceduralFabric extends FabricCommon {
  source: "procedural";
  motif: FabricMotif;
  palette: FabricPalette;
  /** Scale belongs to the motif — a procedural fabric may not set it. */
  cmPerPixel?: never;
  imageUrl?: never;
}

/**
 * A photographed fabric. Every photo is shot at its own resolution, so this one
 * *does* carry a measured `cmPerPixel` — there is no motif to inherit from.
 */
export interface ImageFabric extends FabricCommon {
  source: "image";
  /** URL of the photographed, seamlessly tileable artwork. */
  imageUrl: string;
  /** Measured: real-world centimetres covered by one pixel of the photo. */
  cmPerPixel: number;
  /**
   * Whether its pattern has a direction worth choosing — a stripe, a check, a
   * one-way print. Only then is it offered a pattern direction; absent, it has
   * none, as a procedural fabric's motif says for it.
   */
  directional?: boolean;
  motif?: never;
  palette?: never;
}

/** A fabric is a plain data record — no code changes are needed to add one. */
export type Fabric = ProceduralFabric | ImageFabric;

export interface Category {
  key: CategoryKey;
  label: Localized;
  color: string;
}

/**
 * A visualizable home product the fabric can be applied to.
 *
 * Clothing is *not* here: a garment is worn on a body, in layers, and carries
 * coverage and compatibility that a curtain has no use for. It has its own
 * model below.
 */
export type ProductKind = "sofa" | "pillow" | "curtain" | "chair";

export interface ProductTemplate {
  kind: ProductKind;
  label: Localized;
}

/**
 * The pieces a home product is cut from. Each part carries its own fabric, its
 * own shading and its own topstitch, so a piece can be split as finely as the
 * pattern really is — add `seat` or `back` here and to the product's `parts`
 * array, and nothing else has to change.
 */
export type GarmentPartId = "main" | "seat" | "back" | "trim";

/** The ten skin tones, lightest to deepest — see `data/skinTones.ts`. */
export type SkinToneId =
  | "tone-01"
  | "tone-02"
  | "tone-03"
  | "tone-04"
  | "tone-05"
  | "tone-06"
  | "tone-07"
  | "tone-08"
  | "tone-09"
  | "tone-10";

export interface SkinTone {
  id: SkinToneId;
  label: Localized;
  /** The measured skin colour: CIELAB L*, a*, b* (D65). */
  lab: readonly [L: number, a: number, b: number];
  /**
   * The same colour in sRGB, for the swatch and the tint. It is laid over the
   * mannequin photograph as a tint (`mannequin/skinTint.ts`), so the
   * photograph keeps its own light and shadow and one image serves every tone.
   */
  color: string;
}

/** Topstitch thread colors. `hidden` draws no stitch at all. */
export type StitchId =
  | "hidden"
  | "tonal"
  | "cream"
  | "apricot"
  | "charcoal"
  | "gold";

export interface StitchColor {
  id: StitchId;
  label: Localized;
  /**
   * Fixed thread color, or `null` when there is nothing to draw (`hidden`) or
   * the thread takes the color of the fabric it sits on (`tonal`).
   */
  color: string | null;
}

/** Which fabric each part of the product is cut from, keyed by fabric id. */
export type PartFabrics = Partial<Record<GarmentPartId, string>>;

/**
 * The angle a part is cut on, in degrees (0–360). Straight grain is 0,
 * cross grain 90, and true bias 45 — all real choices a tailor makes.
 */
export type GrainDirection = number;

/** Bodies a garment can be shown on. One photographic asset each. */
export type BodyType = "female" | "male";

/**
 * The full state of a home-product design. `productId` + `parts` is the piece
 * itself; the rest is how it is presented and finished.
 */
export interface Design {
  productId: ProductKind;
  parts: PartFabrics;
  stitch: Partial<Record<GarmentPartId, StitchId>>;
  direction: GrainDirection;
}

/* ------------------------------------------------------------- the body */

/**
 * Regions of the body a garment can hide.
 *
 * These are the vocabulary `coverage` is written in, and the renderer cuts the
 * covered ones out of the mannequin photograph. Splitting the arm and the leg
 * into three is what lets a short sleeve differ from a long one without either
 * garment knowing the other exists.
 *
 * `shoulderCap` and `upperChest` were added for the collars, and the reason is
 * worth keeping: between `neck` (which stopped at y=216) and `torso` (which
 * starts at y=268) lay fifty units of chest and the whole shoulder slope that
 * belonged to no zone at all. Every collar that spreads — sailor, Peter Pan,
 * bow — covers that band, and had to claim nothing, because there was
 * nothing there to claim. The list was describing the wardrobe rather than the
 * body, which is the wrong way round: art is what a vocabulary exists to
 * describe.
 */
export type BodyZone =
  | "head"
  | "neck"
  | "shoulderCap"
  | "upperChest"
  | "torso"
  | "hip"
  | "upperArm"
  | "forearm"
  | "hand"
  | "thigh"
  | "knee"
  | "calf"
  | "foot";

/**
 * The openings a collar can be sewn into.
 *
 * `high` sits at the base of the neck, which is the only place a standing band
 * can be sewn; `round` is the wide crew opening; `v` is the jacket's break at
 * y 262. A collar names the one it needs and whatever cuts the garment — a
 * `variants` entry, or a `Neckline` — presents one, so a mandarin does not end
 * up sewn 30 units down the chest with nothing under it to stand on.
 *
 * **Not the same thing as a `Neckline`.** This was called `NecklineShape` and
 * the field on a collar was called `neckline`, which is a different idea in the
 * same word: a neckline is a *cut* the wearer chooses — V, scoop, halter — and
 * an opening is the much smaller question of what a collar can be attached to.
 * A neckline presents one of these; several present the same one.
 */
export type OpeningShape = "high" | "round" | "v";

/**
 * How a sleeve is built and joined to the body — see `lib/garments/sleeves.ts`
 * for what each one is. Kept apart from its length, because the two are apart:
 * a puff sleeve is a puff sleeve whether it stops above the elbow or at it.
 */
export type SleeveTypeId =
  | "set-in"
  | "drop"
  | "raglan"
  | "kimono"
  | "dolman"
  | "puff"
  | "bishop"
  | "bell"
  | "flutter"
  | "cap"
  /* the top of the sleeve is an off-shoulder cut's band — drafted by that cut */
  | "off-shoulder"
  /* a robe's alone: its wings cut in one with the body from the shoulder to the hem */
  | "butterfly";

/** Where a sleeve ends, measured on the arm it is worn on. */
export type SleeveLengthId = "sleeveless" | "short" | "elbow" | "three-quarter" | "long";

/**
 * How a long sleeve is finished at the wrist — see `CUFFS` in
 * `lib/garments/sleeves.ts`. `none` is a plain hem at the sleeve's own width;
 * a woven garment's sleeve can take a plain, formal or French cuff, a knit's
 * only a rib.
 */
export type CuffId = "none" | "plain" | "formal" | "french" | "rib" | "band";

/** A sleeve as worn. */
export interface SleeveChoice {
  type: SleeveTypeId;
  length: SleeveLengthId;
  /**
   * Its cuff, on a long sleeve of a garment that offers a choice of them.
   * Absent, a plain hem — which is every sleeve that is not offered one.
   */
  cuff?: CuffId;
}

/**
 * The shape a skirt is cut to — see `lib/garments/skirts.ts`. One set of
 * shapes for the skirt and for a dress's skirt alike: the two cut theirs from
 * the same parts.
 */
export type SkirtShapeId = "aline" | "flared" | "circle" | "pencil" | "pleated" | "tiered" | "mermaid";

/** Where a skirt's hem falls, measured on the leg. */
export type SkirtLengthId = "knee" | "midi" | "maxi";

/** Where a dress's bodice ends and its skirt is sewn on. */
export type WaistId = "empire" | "natural" | "dropped";

/** A skirt as worn: a shape, a length, and on a dress the waist it hangs from. */
export interface SkirtChoice {
  shape: SkirtShapeId;
  length: SkirtLengthId;
  /** A dress's only: a skirt garment sits on its own waistband. */
  waist?: WaistId;
}

/** How a trouser leg is cut below the hip — see `lib/garments/legs.ts`. */
export type LegId = "straight" | "slim" | "wide" | "palazzo" | "flare";

/** How a robe is worn at the front — her abaya: hanging open, or closed down the centre. */
export type FrontId = "open" | "closed";

/**
 * How far a dress is buttoned down its centre front, on a placket — see
 * `lib/garments/closures.ts`: not at all, from the neck to the waist seam, or
 * from the neck to the hem.
 */
export type ButtonsId = "none" | "waist" | "hem";

/** How many rows of buttons down a dress's front: one, on a placket down the centre, or two, either side of it — double-breasted, as photo 1's. */
export type ButtonRowsId = "one" | "two";

/**
 * The belt a dress is worn with on its waist seam: none, one of its own
 * cloth, leather in brown or black, or a sash «حزام فيونكة» — a soft band
 * of cloth tied in a belt bow — or a narrower ribbon «شريطة». See `SASHES`.
 */
export type BeltId = "none" | "self" | "brown" | "black" | "sash" | "ribbon";

/** Where a sash's bow is tied: at the front, or at her left side. */
export type BowAtId = "front" | "side";

/**
 * Stripes of braid in a second cloth: none, or one, two or three thin ones
 * along an edge — a sailor collar's outer edge, a boat neckline's. They take
 * a fabric of their own, as the `trim` region, every stripe the same.
 */
export type StripesId = "none" | "one" | "two" | "three";

/**
 * The edges stripes are sewn along, each chosen on its own: a collar's free
 * edge, the neckline's (with no collar over it), each sleeve's hem, the
 * skirt's hem, a fabric belt. One count and one cloth for all of them.
 */
export type StripeEdgeId = "collar" | "neckline" | "sleeves" | "hem" | "belt";

/** A tie: none, a small tied bow, a necktie hanging down the centre, or a scarf «وشاح» with two broad tails. */
export type TieId = "none" | "knot" | "necktie" | "scarf";

/** Where a tie is knotted: at the centre front of the neck, or on a fabric belt — at its front, or at its side. */
export type TieAtId = "neck" | "belt-front" | "belt-side";

/**
 * The drawing a body or a garment is rendered from.
 *
 * Front-on, and only front-on. This carried optional `back` and `side` slots
 * for a while and nothing ever filled them: the visualizer shows one view, that
 * view is the product, and a type offering three while one exists is a type
 * that lies to everyone who reads it. A second view, if it were ever wanted,
 * would be a drawing per garment and per collar — the cost is the art, never
 * the slot, so leaving the slot open bought nothing and invited work.
 */
export type ViewAssets = { front: string };

/**
 * The skeleton one body meets, and that its garments are cut against.
 *
 * The *y* values are shared by every figure — shoulder, waist, hip and floor
 * land on the same line whatever the body — which is what makes two bodies
 * comparable at all. The *x* values are the body's own, because a shoulder
 * seam has to sit outside the shoulder it is drawn over.
 *
 * Deliberately nothing here about size: no measurements, no body-shape
 * options. Scaling a body would scale the fabric with it and destroy the
 * real-world print size the whole product rests on.
 */
export interface BodyAnchors {
  centerX: number;
  crownY: number;
  chinY: number;
  /** Base of the neck — where a shoulder seam sits. */
  shoulderY: number;
  shoulderX: { left: number; right: number };
  bustY: number;
  waistY: number;
  hipY: number;
  crotchY: number;
  kneeY: number;
  ankleY: number;
  floorY: number;
}

/**
 * A photographic body: a cut-out PNG plus the geometry the renderer needs to
 * dress it.
 *
 * Everything here is data. Replacing the mannequin — a different form, a
 * different photograph, a male body instead of a female one — is editing this
 * record and dropping a file in `public/mannequin/`. No renderer changes.
 */
export interface BodyAsset {
  id: BodyType;
  label: Localized;
  /** Cut-out photograph per view, sized to the shared body canvas. */
  view: ViewAssets;
  /** This body's own skeleton. Its garments are drawn against these numbers. */
  anchors: BodyAnchors;
  /**
   * The area each zone occupies on the canvas, as an SVG path. A garment that
   * declares it covers a zone must be at least this big, or hiding the zone
   * punches a hole in the silhouette.
   */
  zones: Record<BodyZone, string>;
  /**
   * Zones that hang in *front* of the body in this view, and so are drawn again
   * over the garments whenever nothing covers them.
   *
   * A front-facing figure has its forearms and hands over its own skirt. Without
   * this the arms disappear behind every wide garment, which is the one thing a
   * paper-doll renderer always gets wrong.
   */
  overlay: BodyZone[];
}

/* --------------------------------------------------------- the wardrobe */

/**
 * Draw order, innermost first. A garment names one layer and the renderer does
 * the rest: two garments on the same layer cannot be worn together, and a
 * garment is invisible when the layers above it cover everything it covers.
 */
export type GarmentLayer =
  | "skin"
  | "base"
  | "bottom"
  | "top"
  | "mid"
  | "outer"
  | "accessory";

/** What kind of thing it is, for grouping in the picker. */
export type GarmentCategory = "top" | "bottom" | "dress" | "outerwear";

/**
 * The named areas of a garment that each take their own fabric. A dress is cut
 * from `top` and `bottom`; a shirt from `body` and `placket`. The garment's
 * drawing defines which of these it actually has.
 *
 * `placket` is separate from `collar` on purpose. A shirt's button band was
 * drawn inside the collar's path, so it took the collar's cloth — which is a
 * contrast placket by accident, and which meant the collar could not be lifted
 * out of the garment and made swappable without taking the placket with it.
 * They are two pieces on a real shirt and they are two regions here.
 */
export type FabricRegionId =
  | "body"
  | "top"
  | "bottom"
  | "collar"
  | "placket"
  | "lapel"
  | "sleeve"
  | "cuff"
  | "waistband"
  | "trim"
  | "tie"
  | "belt";

/**
 * A garment, as a plain data record.
 *
 * Adding one to the wardrobe is this record plus one drawing in
 * `lib/garments/art/` — the same "add one case" the home products have always
 * had, with layering and coverage falling out of the data rather than out of
 * code.
 */
export interface Garment {
  id: string;
  name: Localized;
  category: GarmentCategory;
  /**
   * The one body this garment is cut for. There is no `unisex`: a drawing is
   * built against a particular figure's anchors and its coverage erases that
   * figure's zones, so a garment that fits both is not a saving — it is a
   * garment that fits neither, and one that will erase a zone it cannot reach
   * the moment it is offered on the wrong body.
   */
  gender: BodyType;
  layer: GarmentLayer;
  /** Body zones this garment completely hides. */
  coverage: BodyZone[];
  /** Areas that each take their own fabric, in picker order. */
  fabricRegions: FabricRegionId[];
  /** Garment ids that cannot be worn with this one, in either direction. */
  incompatibleWith: string[];
  /**
   * Whether a collar can be sewn to this garment's neckline.
   *
   * A garment either finishes its own neck — the male wardrobe still draws its
   * collars into the garment, and a bottom has no neck at all — or it accepts a
   * swappable one and leaves the `collar` region to it. Never both, or two
   * drawings would claim the same fabric region.
   */
  acceptsCollar: boolean;
  /**
   * The collar it arrives wearing, if any. A garment that accepts a collar must
   * still look finished with none — this is a starting point, not a part of the
   * garment.
   */
  defaultCollar?: string;
  /**
   * Whether this garment's top can be recut to a different neckline.
   *
   * A garment that says no keeps whatever opening its own drawing cuts, which
   * is every garment in the wardrobe until it opts in — adding the system
   * changed none of them.
   */
  acceptsNeckline?: boolean;
  /** The neckline it arrives cut to. Same terms as `defaultCollar`. */
  defaultNeckline?: string;
  /**
   * The sleeves this garment can be cut with, and the one it arrives in.
   *
   * Absent, its sleeves are part of its drawing and do not change — the
   * tailored jackets, whose sleeve is what makes them a jacket.
   */
  sleeves?: {
    types: SleeveTypeId[];
    default: SleeveChoice;
    /**
     * The cuffs a long sleeve is offered with. Absent, it has none to choose:
     * it ends in a plain hem, as every shorter sleeve does.
     */
    cuffs?: CuffId[];
    /**
     * The lengths it is cut at, every type it offers — her abaya's, long only,
     * a kimono's too, which nothing else is cut long. Absent, each type comes
     * in its own lengths, and sleeveless.
     */
    lengths?: SleeveLengthId[];
    /**
     * What it calls its sleeves, where that is not what a dress calls them: an
     * abaya's regular sleeve «عادي», its wide one «واسع» and its butterfly
     * «فراشة».
     */
    names?: Partial<Record<SleeveTypeId, { en: string; ar: string }>>;
  };
  /**
   * The skirts this garment can be cut with — shapes, lengths and, for a
   * dress, waists — and the one it arrives in. Absent, it has no skirt to
   * choose.
   */
  skirt?: {
    shapes: SkirtShapeId[];
    lengths: SkirtLengthId[];
    waists?: WaistId[];
    default: SkirtChoice;
  };
  /**
   * How it can be worn at the front — a robe's, open or closed — and how it
   * arrives. Absent, its front is part of its drawing.
   */
  fronts?: { offered: FrontId[]; default: FrontId };
  /** The legs a pair of trousers can be cut with, and the one it arrives in. Absent, it has no choice of leg. */
  legs?: { offered: LegId[]; default: LegId };
  /**
   * How far it can be buttoned down its centre front, and how it arrives — a
   * dress's, on the cuts with a straight centre front only: see `buttonsOn`.
   * Absent, it has no such choice.
   */
  buttons?: { offered: ButtonsId[]; default: ButtonsId; rows?: ButtonRowsId[] };
  /** The belts it can be worn with on its waist seam, and the one it arrives with. Absent, it takes none. */
  belts?: { offered: BeltId[]; default: BeltId };
  /**
   * The stripes it can be trimmed with, in a cloth of their own, along any of
   * its edges — see `StripeEdgeId` — and the count it arrives with. Absent,
   * it takes none.
   */
  stripes?: { offered: StripesId[]; default: StripesId };
  /**
   * The parts sewn to it that can be cut from a cloth of their own: its
   * sleeves' ends — cuffs, wide bands, a puff's or a bishop's band — and a
   * fabric belt. Each arrives in the cloth of the part it is sewn to — see
   * `clothOf`. Absent, none.
   */
  partCloths?: ("cuff" | "belt")[];
  /**
   * The ties it can be worn with, and the one it arrives with — each knotted
   * wherever it has a place for one: see `tiePlacesOf`. Absent, it takes none.
   */
  ties?: { offered: TieId[]; default: TieId };
  /** Which drawing to use, per view. Ids resolved by `lib/garments/art`. */
  asset: ViewAssets;
}

/**
 * A collar, as a plain data record.
 *
 * The part of a garment people actually choose, so it is a record of its own
 * rather than a path buried in one drawing: a blouse can be cut in linen with a
 * silk Peter Pan collar, and a tenth collar is one record plus one file.
 *
 * It is cut for one body and sewn to one neckline, which is why it names both.
 * `compatibleWith` is a claim about geometry rather than taste — a collar has to
 * cover the neckline it is sewn into, and `check:garments` rejects a pair where
 * it does not reach.
 */
export interface Collar {
  /** `<body>-<name>-collar`, so it can never be read as a garment id. */
  id: string;
  name: Localized;
  /** The one body it is cut for, exactly as a garment names one. */
  gender: BodyType;
  /**
   * Body zones the collar hides *in addition to* the garment's — a union, not
   * a replacement. Only zones it covers end to end may be named: a collar that
   * claims the neck without reaching the chin erases a throat nothing paints
   * back.
   */
  coverage: BodyZone[];
  /** One piece of cloth: `["collar"]`. Its own fabric, its own topstitch. */
  fabricRegions: FabricRegionId[];
  /** The garment categories it can be sewn to. */
  compatibleWith: GarmentCategory[];
  /**
   * How much of the body the collar takes up, in **centimetres**, as a band
   * the drawing has to land inside.
   *
   * A mandarin is a band at the throat and a sailor falls across the whole
   * shoulder; drawn to the same footprint they are the same collar in nine
   * costumes, which is what the first nine were. Seams and coverage cannot
   * catch that — a collar half the size it should be is sewn on just as
   * neatly — so the size is declared here and `check:garments` measures the
   * drawing against it. Centimetres rather than canvas units because that is
   * the dimension a tailor would give, and the canvas already knows the scale.
   */
  footprint: { width: [number, number]; drop: [number, number] };
  /**
   * How the collar is built, which is the thing that decides everything else.
   *
   * `stand` is how far the band rises **above the neckline seam**, in canvas
   * units, and a collar with a stand wraps the neck: it needs `behindBody`, and
   * it needs the garment to cut a high opening at the base of the neck rather
   * than the wide one a crew neck cuts 30 units lower. `fall` is the part that
   * folds back down over the stand.
   *
   * The two together are why the first nine read flat. Every one of them was a
   * shape hung *below* the neckline and drawn downward into the chest; a real
   * collar is built upward from that seam.
   *
   * `front: "open"` is a collar that does not close across the front of the
   * neck — a sailor's two panels part in a V, and what shows between them is
   * the garment's own neckline, the dickey it is worn with; a mandarin's ends
   * stop short of the centre in a small V of their own. Such a collar is sewn
   * along the seam only where its pieces lie; the stretch of seam in the
   * opening between them is the garment's to finish, not the collar's.
   *
   * `"tab"` is a band whose one end runs on past the centre and buttons over
   * the other — a regular thobe collar's. Two bands of nearly one size are
   * told apart by how their fronts close, which a box round them cannot see.
   */
  build: {
    stand: number;
    fall: "none" | "points" | "flat" | "soft" | "gathered";
    front?: "open" | "tab";
  };
  /**
   * The collar on the other body this one becomes when an outfit first moves
   * there, where none shares its name: a regular thobe collar arrives on her
   * dress as her mandarin. Absent, the same name, or that garment's own.
   */
  across?: string;
  /**
   * The opening this collar has to be sewn into, which the garment then cuts.
   *
   * A stand collar needs the opening at the base of the neck or the band has
   * nothing to stand on; a notched lapel needs the jacket's break. The garment
   * owns the cut and this names which of its cuts to use — so a `Neckline` that
   * presents `high` can take any of the standing collars, and one that presents
   * nothing takes none.
   */
  opening: OpeningShape;
  /**
   * On a garment with a choice of neckline, the openings it is sewn into,
   * instead of its own: a sailor collar goes only on a dress's V, which is
   * where it belongs, and on no top, since neither has a V. Absent,
   * `opening` alone.
   */
  cuts?: OpeningShape[];
  /**
   * On a garment with a choice of neckline, the cuts it is sewn to, each by
   * name — `Neckline.cut` — and drawn to each its own way: a sailor collar's
   * panels down the V, a wide flat collar round the boat, the round and the
   * square, two bands down a wrap's edges. Where given, it decides alone;
   * absent, the openings do — see `cuts`.
   */
  necklines?: string[];
  /** Its size on each of `necklines` other than the one `footprint` is measured on, by cut — see `footprint`. */
  footprintOn?: Record<string, { width: [number, number]; drop: [number, number] }>;
  /**
   * The drawings. `front` is drawn over the garment, as everything else here
   * is. `behindBody` is drawn *under the mannequin photograph* — the arc of the
   * band that passes behind the neck and comes round to the front.
   *
   * It is not a view. `front`/`back`/`side` on a garment are camera angles and
   * only `front` ships; this is a second layer *within* the front view, and the
   * names have to keep those two ideas apart. Without it a collar can only ever
   * be painted on the chest, which is what the first nine were: a band that
   * never passes behind anything reads as a decal, however well it is shaded.
   */
  asset: { front: string; behindBody?: string };
  /**
   * The stripes it can be finished with along its outer edge, in a cloth of
   * their own — a sailor collar's — and the count it arrives with; and how
   * far they can go, `at`: on the collar alone, or round the sleeves' and
   * the skirt's hems as well, in the same cloth and count. Absent, it takes
   * none.
   */
  /** Whether stripes can be sewn along its free edge — a sailor collar's. The count is the garment's: see `Garment.stripes`. */
  takesStripes?: true;
  /**
   * Whether a tie can be knotted at its front, over it — a sailor collar's,
   * a Peter Pan's. Absent, a garment wearing it is tied anywhere but the neck:
   * a bow collar is its own tie, and a standing collar covers the neck.
   */
  takesTie?: true;
}

/**
 * A neckline, as a plain data record.
 *
 * **A neckline is a cut; a collar is a piece.** A collar is separate cloth sewn
 * on — own drawing, own fabric region, own coverage. A neckline reshapes the
 * garment's own outline and takes no fabric of its own, and six of the fifteen
 * also take the shoulders and the sleeves off, which no collar can do.
 *
 * The two compose rather than compete: Dress + Neckline + Collar is three
 * independent choices, not one hardcoded garment per combination.
 */
export interface Neckline {
  /** `<body>-<name>-neckline`, never confusable with a garment or collar id. */
  id: string;
  /** The drafter that cuts it — see `lib/garments/necklines.ts`. */
  cut: string;
  name: Localized;
  /** The one body it is cut for, exactly as a garment names one. */
  gender: BodyType;
  /** The garment categories it can be cut into. */
  compatibleWith: GarmentCategory[];
  /**
   * Body zones the cut **bares** — subtracted from the garment's coverage.
   *
   * The opposite direction to a collar, which only ever adds. Subtracting is
   * safe in a way adding is not: coverage decides what of the photograph is
   * erased, so a bared zone is simply drawn, with cloth over whatever part of
   * it the cut actually covers.
   */
  bares: BodyZone[];
  /**
   * Which sleeves survive the cut — a strapless one keeps none. `band` is an
   * off-shoulder's: its band is the top of two sleeves of its own, offered at
   * every length and drafted by the cut.
   */
  sleeves: "both" | "none" | "left" | "right" | "band";
  /**
   * The opening it presents to a collar, or `null` if it takes none.
   *
   * A standing band needs cloth at the base of the throat to stand on, so only
   * the cuts that leave some can be given one. This is what filters the collar
   * list rather than letting a mandarin be sewn onto a strapless bodice.
   */
  opening: OpeningShape | null;
  /**
   * A collar this cut arrives wearing, if it is only itself with one on.
   *
   * The Collared cut is the case: a placket and a high opening is not a
   * "collared neck" until there is a collar over it. It stays swappable — this
   * is a starting point, the way `Garment.defaultCollar` is, and not a second
   * way of owning a collar. Duplicating the collar machinery inside a neckline
   * would give two places to fix the same thing.
   */
  wants?: string;
}

/** A garment as worn: which fabric and thread each of its regions is finished in. */
export interface WornGarment {
  garmentId: string;
  /**
   * The neckline it is cut to, if it accepts one and one was chosen.
   *
   * Beside `collarId` rather than replacing it: a dress has both, and they are
   * different questions. The cut belongs to the garment for the same reason the
   * collar does — a jacket over a dress has its own.
   */
  necklineId?: string;
  /** Its sleeves, if it takes a choice of them and one was made. */
  sleeve?: SleeveChoice;
  /** Its skirt, if it takes a choice of one and one was made. */
  skirt?: SkirtChoice;
  /** How it is worn at the front, if it can be worn open or closed and one was chosen. */
  front?: FrontId;
  /** Its legs, if it is a pair of trousers that takes a choice of them and one was made. */
  leg?: LegId;
  /** How far it is buttoned down the front, if it takes a choice of it and one was made. */
  buttons?: ButtonsId;
  /** Its belt, if it takes one and one was chosen. */
  belt?: BeltId;
  /** Where its sash is tied, as chosen — see `bowAtOf`, which resolves it against the places it has. */
  bowAt?: BowAtId;
  /**
   * The collar sewn to it, if it accepts one and one was chosen. It belongs to
   * the garment rather than to the outfit, because that is where a collar is:
   * a jacket over a dress has its own, and it draws over hers.
   *
   * Its cloth and thread live in the maps below under `collar`, so a collar
   * takes a fabric through exactly the machinery every other region does.
   */
  collarId?: string;
  /**
   * Its stripes, if its collar or its neckline takes them and a count was
   * chosen — see `StripesId` — and how far they go. Their cloth lives
   * in the maps below under `trim`.
   */
  stripes?: StripesId;
  /** The edges they are sewn along, as chosen — see `stripesOnOf`, which resolves them against the edges it has. */
  stripesOn?: StripeEdgeId[];
  /** Its tie, if one was chosen. Its cloth lives below under `tie`. */
  tie?: TieId;
  /** Where it is knotted, as chosen — see `tieAtOf`, which resolves it against the places it has. */
  tieAt?: TieAtId;
  /** Its rows of buttons, as chosen — see `buttonRowsOf`, which resolves it against what its cut and buttons take. */
  buttonRows?: ButtonRowsId;
  /** Fabric id per region. */
  fabrics: Partial<Record<FabricRegionId, string>>;
  stitch: Partial<Record<FabricRegionId, StitchId>>;
}

/** Everything on the mannequin, plus the mannequin itself. */
export interface Outfit {
  bodyType: BodyType;
  skinTone: SkinToneId;
  /** Unordered — `layer` decides what sits over what. */
  worn: WornGarment[];
  /**
   * What each other mannequin was wearing when it last left the stage, exactly
   * as it was left — see `switchBody`. A body with no entry has never been on
   * the stage; one with an empty list was undressed, and stays so.
   */
  away?: Partial<Record<BodyType, WornGarment[]>>;
  direction: GrainDirection;
}
