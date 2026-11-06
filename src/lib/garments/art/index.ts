import type { ReactNode } from "react";
import type { FabricRegionId, FrontId, OpeningShape, SkirtChoice, SleeveChoice } from "@/types";
import type { Uid } from "@/lib/garments/shading";
import type { Encloses } from "@/lib/garments/sleeves";
import type { Tuck } from "@/lib/garments/fit";

import { tShirtFront } from "./female/tShirt";
import { blouseFront } from "./female/blouse";
import { trousersFront } from "./female/trousers";
import { skirtFront } from "./female/skirt";
import { dressFront } from "./female/dress";
import { jacketFront } from "./female/jacket";
import { abayaFront } from "./female/abaya";

import {
  shirtCollarBehind,
  shirtCollarFront,
} from "./female/collars/shirt";
import { peterPanCollarFront } from "./female/collars/peterPan";
import {
  mandarinCollarBehind,
  mandarinCollarFront,
} from "./female/collars/mandarin";
import {
  bowCollarBehind,
  bowCollarFront,
} from "./female/collars/bow";
import {
  notchedCollarBehind,
  notchedCollarFront,
} from "./female/collars/notched";
import {
  sailorCollarBehind,
  sailorCollarFront,
} from "./female/collars/sailor";
import {
  ruffledCollarBehind,
  ruffledCollarFront,
} from "./female/collars/ruffled";
import {
  turtleneckCollarBehind,
  turtleneckCollarFront,
} from "./female/collars/turtleneck";

import {
  maleShirtCollarBehind,
  maleShirtCollarFront,
} from "./male/collars/shirt";
import {
  malePoloCollarBehind,
  malePoloCollarFront,
} from "./male/collars/polo";
import {
  maleMandarinCollarBehind,
  maleMandarinCollarFront,
} from "./male/collars/mandarin";
import { maleRegularCollarBehind, maleRegularCollarFront } from "./male/collars/regular";
import { maleRegularShortCollarBehind, maleRegularShortCollarFront } from "./male/collars/regularShort";
import {
  maleNotchedCollarBehind,
  maleNotchedCollarFront,
} from "./male/collars/notched";

import { maleTShirtFront } from "./male/tShirt";
import { maleShirtFront } from "./male/shirt";
import { malePoloFront } from "./male/polo";
import { maleTrousersFront } from "./male/trousers";
import { maleJacketFront } from "./male/jacket";
import { maleThobeFront } from "./male/thobe";

/**
 * Garment drawings, one file per asset, one folder per body.
 *
 * A garment record (`lib/data/garments.ts`) names an asset per view; this is
 * where that name is resolved. Every drawing shares the 600×1000 canvas and the
 * vertical skeleton, but is cut against **one** body's anchors — which is why
 * the folder a drawing sits in, and the yoke it imports, are the same fact
 * stated twice. Adding a garment is one record plus one file here.
 *
 * Collars live one folder down, in `<body>/collars/`, and resolve the same way
 * from a collar record's asset id — on both bodies. The male wardrobe used to
 * draw its collars *inside* its garments, which meant no collar check ever saw
 * them; that is why his were the worst-looking things here and why the fix was
 * structural rather than a matter of redrawing.
 *
 * Only `front` ships. A back or side view is another drawing under another
 * key — the type already has the slot, and nothing else has to change.
 */

/** One fabric region of a garment: its outline, its light, its stitching. */
export interface RegionArt {
  /** Geometry filled with this region's fabric. `fill` is a `url(#…)` pattern. */
  shape: (fill: string) => ReactNode;
  /** Gradients the shading needs. Ids must be namespaced through `uid`. */
  defs?: (uid: Uid) => ReactNode;
  /**
   * Fixed greyscale shading painted over the fabric with `multiply`, clipped
   * to the region. It never changes when the fabric changes — that is what
   * makes the fill read as cloth rather than as a flat sticker.
   */
  shading?: (uid: Uid) => ReactNode;
  /**
   * Light the cloth catches, painted over it with `screen` and clipped to the
   * region, after the shading. Like the shading it never changes with the
   * fabric, and it can only lighten: the lit crest of a fold — see `folds.tsx`.
   */
  light?: (uid: Uid) => ReactNode;
  /**
   * The shadow this region throws onto whatever lies beneath it — the join
   * where a collar stands proud of the shirt it is sewn to. Drawn under the
   * cloth and outside the region's own mask; see `FabricRegion`.
   */
  cast?: (uid: Uid) => ReactNode;
  /**
   * How this piece is cut from the cloth, relative to the outfit's grain: a
   * turn in degrees and an offset along it. A collar band is cut across the
   * grain, and a fall from a different part of the roll, so the motif does not
   * run unbroken from the body into the collar sewn onto it.
   */
  grain?: { turn?: number; shift?: readonly [number, number] };
  /**
   * Form shading built from this piece's own outline — see `clothSurface`.
   * Replaces the bounding-box gradients, which could not describe a surface.
   * `joined` lights the pieces as one surface — see `RegionDrawing`.
   */
  surface?: { blur?: number; relief?: number; warp?: number; joined?: boolean; ridges?: string; gathers?: string };
  /**
   * Cloth of this region that lies over the garment's other regions — a wrap
   * bodice's tie, hanging over the skirt. Drawn in the same fabric, after
   * every region of the garment.
   */
  over?: RegionArt;
  /** Each piece's free edges, when the outline is not all edge — see `RegionDrawing`. */
  edge?: () => ReactNode;
  /** Dashed topstitch route along this region's seams. */
  stitch?: string;
  /**
   * The garment's cloth from an earlier region that hangs in front of this
   * one — a dress's sleeves, beside a skirt hung from above her waist. See
   * `RegionDrawing`.
   */
  under?: string[];
  /** Where a close-up should centre. */
  focus?: [x: number, y: number];
}

/**
 * Everything a garment is cut to, as worn — asked for at once, because a
 * neckline, a collar's opening and the sleeves all land on the same cloth.
 */
export interface GarmentChoice {
  /** The neckline cut, for a garment that takes one. */
  neckline?: string;
  /** The opening a collar needs, for a garment that cuts one for it. */
  opening?: OpeningShape;
  sleeve?: SleeveChoice;
  /** The skirt's style, for a garment that takes one — see `lib/garments/skirts.ts`. */
  skirt?: SkirtChoice;
  /** How it is worn at the front, for a robe that can be worn open or closed — see `robe` in `lib/garments/sleeves.ts`. */
  front?: FrontId;
  /**
   * The hem of a jacket it is worn under, if it is: it comes out from under it
   * no wider than the jacket — see `tucked` in `garments/fit.ts`.
   */
  inside?: Tuck;
  /**
   * The top worn over it, if it is a bottom worn under one: a skirt comes out
   * from under the top's hem no wider than the top there, and stays inside it
   * above — see `coverOf`. A jacket over it as well decides instead.
   */
  underTop?: Tuck;
}

export interface GarmentArt {
  /** Drawn in this order, so a collar sits over the body it is sewn to. */
  regions: Partial<Record<FabricRegionId, RegionArt>>;
  /**
   * The same garment cut with a different neck opening, for the collars that
   * need one. A standing band has to be sewn at the base of the neck, thirty
   * units above where a crew neck sits, so the garment cuts that opening when
   * such a collar is chosen — the collar names the shape, the garment owns the
   * cut. Absent means this garment cuts one opening and that is that.
   */
  variants?: Partial<Record<OpeningShape, Partial<Record<FabricRegionId, RegionArt>>>>;
  /**
   * The same garment recut to a **neckline** — a generated cut, not an
   * enumerated one.
   *
   * `variants` above is the older, smaller idea: a garment keeps a second
   * hand-written copy of a region for each *opening* a collar might need. That
   * works at two and collapses at fifteen — the dress's `variants.high` block
   * repeated `focus`, `surface`, `shape` and `stitch` to change one curve, and
   * fifteen necklines written the same way would be fifteen copies of the whole
   * top, with every future fix owed fifteen times.
   *
   * So a garment that takes necklines supplies a function instead, and the cut
   * is drafted on demand from `lib/garments/necklines.ts`. Returning nothing
   * for a region leaves that region exactly as `regions` has it, which is what
   * a dress's skirt wants: a neckline changes the bodice and nothing else.
   *
   * A collar can supply one too, for its `collar` region: drawn to the cut of
   * the garment it is sewn to — a Peter Pan lying along a scoop's own line
   * rather than a crew neck's — and as `regions` has it on a garment with no
   * choice of cut.
   */
  cut?: (choice: GarmentChoice) => Partial<Record<FabricRegionId, RegionArt>>;
  /**
   * The cloth lying over the arms, for the choice being worn.
   *
   * The forearm hangs in front of whatever is worn below it, so the renderer
   * paints it back over the clothes — and it must not paint it over a sleeve.
   * A sleeve of any length ends somewhere in the middle of an arm zone, and
   * without this the forearm was drawn over the bottom of every sleeve that
   * reached it: a hem cut off square at the zone's edge.
   */
  armCover?: (choice: GarmentChoice) => string[];
  /**
   * The garment's cloth as cut for a choice, for a picker's icon: the same
   * outline the stage fills, so the icon for a shape is exactly what picking
   * it gives.
   */
  silhouette?: (choice: GarmentChoice) => string[];
  /** Hardware over the cloth — buttons, a zip. Never takes a fabric. */
  trim?: ReactNode;
  /** The cuffs' hardware, for the sleeve as worn: a cuff's button or cufflink. */
  cuffTrim?: (choice: GarmentChoice) => ReactNode;
  /**
   * Hardware for the garment as cut: a shirt-dress's placket buttons, on the
   * one cut with a placket. Drawn before the collar, so a collar lying over
   * the top of the placket covers whatever is under it.
   */
  cutTrim?: (choice: GarmentChoice) => ReactNode;
  /**
   * The same hardware for a garment cut with a different opening, as `variants`
   * is for its cloth: a placket that starts higher under a standing band has its
   * buttons start higher too.
   */
  openingTrim?: Partial<Record<OpeningShape, ReactNode>>;
  /**
   * The same hardware under a band collar — one with no fall, a band and
   * nothing else: the placket's buttons start just under the band and run
   * evenly to the last, where a shirt collar's leaves would have hidden the
   * first. Absent, the opening's.
   */
  bandTrim?: ReactNode;
  /**
   * What a garment worn under this one is allowed to show of itself: a
   * jacket's, which holds whatever is under it — see `Encloses`. An abaya's
   * depends on its sleeve, so it is asked of the choice it is worn in.
   */
  encloses?: Encloses | ((choice: GarmentChoice) => Encloses);
  /**
   * For a top: what it lets a bottom worn under it show, as it is worn — see
   * `coverOf` and `GarmentChoice.underTop`.
   */
  cover?: (choice: GarmentChoice) => Tuck;
  /**
   * How many buttons close a collar's band on this garment, where the band
   * shows: two on a thobe, one on a shirt. The collar is shared between
   * garments and the count is not, so the garment says how many and the
   * collar says where — see `bandButtons`.
   */
  collarButtons?: number;
  /**
   * For a collar: draws `count` buttons on its band, where the band shows
   * between the leaves.
   */
  bandButtons?: (count: number) => ReactNode;
}

const ART: Record<string, GarmentArt> = {
  "female-t-shirt-front": tShirtFront,
  "female-blouse-front": blouseFront,
  "female-trousers-front": trousersFront,
  "female-skirt-front": skirtFront,
  "female-dress-front": dressFront,
  "female-jacket-front": jacketFront,
  "female-abaya-front": abayaFront,

  "male-t-shirt-front": maleTShirtFront,
  "male-shirt-front": maleShirtFront,
  "male-polo-front": malePoloFront,
  "male-trousers-front": maleTrousersFront,
  "male-jacket-front": maleJacketFront,
  "male-thobe-front": maleThobeFront,
};

export const garmentArt = (assetId: string): GarmentArt | undefined =>
  ART[assetId];

/**
 * Collar drawings, in `<body>/collars/`.
 *
 * Kept in their own map rather than folded into `ART`, because a collar is
 * looked up from a different record and a collision between a garment id and a
 * collar id should be impossible rather than merely unlikely. They are the same
 * `GarmentArt` shape, so a collar draws through exactly the path a garment
 * region does — same fabric, same true scale, same shading under `multiply`.
 */
const COLLAR_ART: Record<string, GarmentArt> = {
  "female-shirt-collar-front": shirtCollarFront,
  "female-shirt-collar-behind": shirtCollarBehind,
  "female-peter-pan-collar-front": peterPanCollarFront,
  "female-mandarin-collar-front": mandarinCollarFront,
  "female-mandarin-collar-behind": mandarinCollarBehind,
  "female-bow-collar-front": bowCollarFront,
  "female-bow-collar-behind": bowCollarBehind,
  "female-notched-collar-front": notchedCollarFront,
  "female-notched-collar-behind": notchedCollarBehind,
  "female-sailor-collar-front": sailorCollarFront,
  "female-sailor-collar-behind": sailorCollarBehind,
  "female-ruffled-collar-front": ruffledCollarFront,
  "female-ruffled-collar-behind": ruffledCollarBehind,
  "female-turtleneck-collar-front": turtleneckCollarFront,
  "female-turtleneck-collar-behind": turtleneckCollarBehind,

  "male-shirt-collar-front": maleShirtCollarFront,
  "male-shirt-collar-behind": maleShirtCollarBehind,
  "male-polo-collar-front": malePoloCollarFront,
  "male-polo-collar-behind": malePoloCollarBehind,
  "male-regular-collar-front": maleRegularCollarFront,
  "male-regular-collar-behind": maleRegularCollarBehind,
  "male-regular-short-collar-front": maleRegularShortCollarFront,
  "male-regular-short-collar-behind": maleRegularShortCollarBehind,
  "male-mandarin-collar-front": maleMandarinCollarFront,
  "male-mandarin-collar-behind": maleMandarinCollarBehind,
  "male-notched-collar-front": maleNotchedCollarFront,
  "male-notched-collar-behind": maleNotchedCollarBehind,
};

export const collarArt = (assetId: string): GarmentArt | undefined =>
  COLLAR_ART[assetId];
