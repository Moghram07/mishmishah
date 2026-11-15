import type {
  BeltId,
  BowAtId,
  BodyType,
  ButtonRowsId,
  ButtonsId,
  BodyZone,
  Collar,
  FabricRegionId,
  FrontId,
  Garment,
  GarmentLayer,
  LegId,
  Neckline,
  OpeningShape,
  Outfit,
  SkirtChoice,
  SleeveChoice,
  StitchId,
  StripeEdgeId,
  StripesId,
  TieAtId,
  TieId,
  WornGarment,
} from "@/types";
import {
  LAYER_ORDER,
  defaultGarment,
  garmentById,
  garmentPiece,
  garmentsFor,
} from "@/lib/data/garments";
import {
  defaultNeckline,
  necklineById,
  necklinesForGarment,
  retiredNeckline,
} from "@/lib/data/necklines";
import {
  collarById,
  collarsForGarment,
  defaultCollar,
} from "@/lib/data/collars";
import { DOUBLE_CUTS, SASHED_CUTS, beltsOn, buttonsOn, isSash } from "@/lib/garments/closures";
import { NECKLINE_EDGED, NECKLINE_TIED } from "@/lib/garments/necklines";
import {
  defaultSleeve,
  sleeveCuffsFor,
  fallbackLength,
  sleeveLengthsFor,
  sleeveTypesFor,
} from "@/lib/data/sleeves";
import { hasSleeveEnd, sleeveCoverage } from "@/lib/garments/sleeves";
import type { GarmentChoice } from "@/lib/garments/art";
import { cutAs, skirtCoverage } from "@/lib/garments/skirts";

/**
 * What can be worn with what, what sits over what, what a collar adds, and what
 * has stopped being visible.
 *
 * All of it is derived from the garment records — no renderer, no React, no
 * fabrics. Dressing is a data question, so it is answered here and tested here,
 * and `MannequinStage` only has to draw the answer.
 */

export const layerIndex = (layer: GarmentLayer): number =>
  LAYER_ORDER.indexOf(layer);

/** A garment paired with the drawing state of the one being worn. */
export interface StackEntry {
  garment: Garment;
  worn: WornGarment;
}

/**
 * Whether two garments can share a body.
 *
 * Two rules, and the second is symmetric on purpose. A dress declares that it
 * cannot be worn with a skirt; putting the skirt on second has to clear the
 * dress even though the skirt says nothing about dresses.
 */
export function conflicts(a: Garment, b: Garment): boolean {
  if (a.id === b.id) return true;
  if (a.layer === b.layer) return true;
  return a.incompatibleWith.includes(b.id) || b.incompatibleWith.includes(a.id);
}

/* ---------------------------------------------------------- the collar */

/**
 * The collar actually sewn to a worn garment, if there is one.
 *
 * Validated rather than trusted: a collar cut for the other body, or one that
 * does not fit this garment's neckline, is not a collar here — it is stale
 * state. Returning `undefined` for it is the same guard `wornOn` is for
 * garments, and it is what keeps a mannequin switch from leaving a collar
 * floating over a body it was never drawn for.
 */
export function collarOf(worn: WornGarment): Collar | undefined {
  const collar = sewnOn(worn);
  return collar && fitsCut(collar, necklineOf(worn)) ? collar : undefined;
}

/**
 * The collar record a worn garment names, if this garment can take it at all —
 * before asking whether it fits the cut. `setNeckline` needs this half on its
 * own: it is the collar a recut has to take *off*.
 */
function sewnOn(worn: WornGarment): Collar | undefined {
  if (!worn.collarId) return undefined;
  const garment = garmentById(worn.garmentId);
  if (!garment) return undefined;
  const collar = collarById(worn.collarId);
  return collar && collarsForGarment(garment).includes(collar)
    ? collar
    : undefined;
}

/**
 * Whether a collar can be sewn to a cut: one of the cuts it names — see
 * `Collar.necklines` — or, naming none, a cut presenting the opening it
 * needs. A garment with no choice of neckline keeps the opening its own
 * drawing has, and takes any collar it lists.
 */
const fitsCut = (collar: Collar, neckline: Neckline | undefined): boolean =>
  !neckline ||
  (collar.necklines
    ? collar.necklines.includes(neckline.cut)
    : neckline.opening !== null && sewsInto(collar, neckline.opening));

/** Whether a collar can be sewn into the opening a neckline presents — see `Collar.cuts`. */
const sewsInto = (collar: Collar, opening: OpeningShape): boolean =>
  (collar.cuts ?? [collar.opening]).includes(opening);

/**
 * The neckline a worn garment is cut to, if it takes one at all.
 *
 * Validated the same way `collarOf` is, and for the same reason: a cut for the
 * other body, or one this garment cannot take, is stale state rather than a
 * neckline. A mannequin switch must not leave a dress cut to something that
 * was never drafted against the body it is now on.
 *
 * A garment that takes a neckline and names none — or a stale one — is cut to
 * its default, because that is what the renderer draws. Answering `undefined`
 * here used to let the picker show no neckline at all while the dress was drawn
 * round, and let a mandarin be sewn to that round opening.
 */
export function necklineOf(worn: WornGarment): Neckline | undefined {
  const garment = garmentById(worn.garmentId);
  if (!garment) return undefined;
  /* a cut no longer offered opens as the one that replaced it — see `retiredNeckline` */
  const id = worn.necklineId ? (retiredNeckline(worn.necklineId)?.id ?? worn.necklineId) : undefined;
  const neckline = id ? necklineById(id) : undefined;
  return neckline && necklinesForGarment(garment).includes(neckline)
    ? neckline
    : defaultNeckline(garment);
}

/**
 * The sleeves a worn garment is cut with, resolved against what it can take.
 *
 * `undefined` when the garment has no choice of sleeve, or its neckline takes
 * the sleeves off. A type the garment no longer offers — the neckline changed
 * to one shoulder, or the mannequin changed — falls back to the garment's own
 * default; a length the type does not come in falls back to the type's first.
 * A cuff is kept only on a sleeve that is offered one, and falls back to the
 * garment's own; any other sleeve resolves with no cuff at all.
 * Stale state is resolved here, once, rather than drawn.
 */
export function sleeveOf(worn: WornGarment): SleeveChoice | undefined {
  const garment = garmentById(worn.garmentId);
  if (!garment?.sleeves) return undefined;
  const types = sleeveTypesFor(garment, necklineOf(worn));
  if (types.length === 0) return undefined;
  /* a look cut to a retired neckline that had no sleeve opens without one */
  const sleeveless = worn.necklineId ? retiredNeckline(worn.necklineId)?.sleeveless : false;
  const asWorn = worn.sleeve ?? garment.sleeves.default;
  const wanted: SleeveChoice = sleeveless ? { type: asWorn.type, length: "sleeveless" } : asWorn;
  const type = types.includes(wanted.type)
    ? wanted.type
    : types.includes(garment.sleeves.default.type)
      ? garment.sleeves.default.type
      : types[0];
  const lengths = sleeveLengthsFor(type, necklineOf(worn), garment);
  const length = lengths.includes(wanted.length) ? wanted.length : fallbackLength(type, lengths);
  const cuffs = sleeveCuffsFor(garment, { type, length });
  if (cuffs.length === 0) return { type, length };
  const own = garment.sleeves.default.cuff;
  const cuff =
    wanted.cuff && cuffs.includes(wanted.cuff)
      ? wanted.cuff
      : own && cuffs.includes(own)
        ? own
        : cuffs[0];
  return { type, length, cuff };
}

/**
 * The skirt a worn garment is cut with — its shape, length and, for a dress,
 * waist — resolved against what it offers. `undefined` when it has no skirt
 * to choose. Anything it does not offer falls back to its own default, and a
 * length its shape is not cut at to the nearest one it is — see `cutAs` — so
 * stale state is resolved here, once, rather than drawn.
 */
export function skirtOf(worn: WornGarment): SkirtChoice | undefined {
  const garment = garmentById(worn.garmentId);
  if (!garment?.skirt) return undefined;
  const { shapes, lengths, waists, default: own } = garment.skirt;
  const wanted = worn.skirt ?? own;
  const waist = waists ? (wanted.waist && waists.includes(wanted.waist) ? wanted.waist : own.waist) : undefined;
  return cutAs(
    {
      shape: shapes.includes(wanted.shape) ? wanted.shape : own.shape,
      length: lengths.includes(wanted.length) ? wanted.length : own.length,
      ...(waist ? { waist } : {}),
    },
    lengths
  );
}

/**
 * How a worn garment is worn at the front — a robe's, open or closed —
 * resolved against what it offers. `undefined` when it has no choice of
 * front; anything it does not offer falls back to how it arrives.
 */
export function frontOf(worn: WornGarment): FrontId | undefined {
  const garment = garmentById(worn.garmentId);
  if (!garment?.fronts) return undefined;
  const wanted = worn.front ?? garment.fronts.default;
  return garment.fronts.offered.includes(wanted) ? wanted : garment.fronts.default;
}

/**
 * How a worn pair of trousers' legs are cut, resolved against what it offers.
 * `undefined` when it has no choice of leg; anything it does not offer falls
 * back to how it arrives.
 */
export function legOf(worn: WornGarment): LegId | undefined {
  const garment = garmentById(worn.garmentId);
  if (!garment?.legs) return undefined;
  const wanted = worn.leg ?? garment.legs.default;
  return garment.legs.offered.includes(wanted) ? wanted : garment.legs.default;
}

/**
 * How far a worn dress is buttoned down its front, resolved against what it
 * offers and the cut it is worn in — see `buttonsOn`. `undefined` when it has
 * no such choice, or its cut cannot be buttoned; a choice its cut does not
 * take falls back to how it arrives, or, for a cut with its own placket, to
 * the first it does take.
 */
export function buttonsOf(worn: WornGarment): ButtonsId | undefined {
  const garment = garmentById(worn.garmentId);
  if (!garment?.buttons) return undefined;
  const cut = necklineOf(worn)?.cut;
  const offered = cut ? buttonsOn(cut, garment.buttons.offered, skirtOf(worn)?.shape) : [];
  if (offered.length === 0) return undefined;
  const wanted = worn.buttons ?? garment.buttons.default;
  if (offered.includes(wanted)) return wanted;
  /* to the hem over a skirt that cannot open so far — a mermaid's — it is buttoned to the waist */
  if (wanted === "hem" && offered.includes("waist")) return "waist";
  return offered.includes(garment.buttons.default) ? garment.buttons.default : offered[0];
}

/** Button a worn dress down its front so far. The choice is resolved when it is read, so it waits out a cut that cannot take it. */
export function setButtons(worn: WornGarment[], garmentId: string, buttons: ButtonsId): WornGarment[] {
  return worn.map((w) => (w.garmentId === garmentId ? { ...w, buttons } : w));
}

/**
 * The rows of buttons a worn dress can be buttoned in, as cut and buttoned:
 * one or two — see `DOUBLE_CUTS` — when it is buttoned to the waist; none to
 * choose otherwise.
 */
export function buttonRowsOffered(worn: WornGarment): ButtonRowsId[] {
  const rows = garmentById(worn.garmentId)?.buttons?.rows ?? [];
  const cut = necklineOf(worn)?.cut;
  if (rows.length < 2 || buttonsOf(worn) !== "waist" || !cut || !(DOUBLE_CUTS as readonly string[]).includes(cut)) return [];
  return rows;
}

/** A worn dress's rows of buttons, resolved: two only where they are offered and chosen, else one. `undefined` unbuttoned. */
export function buttonRowsOf(worn: WornGarment): ButtonRowsId | undefined {
  const buttons = buttonsOf(worn);
  if (!buttons || buttons === "none") return undefined;
  return worn.buttonRows === "two" && buttonRowsOffered(worn).includes("two") ? "two" : "one";
}

/** Button a worn dress in one row or two. Resolved when it is read — see `buttonRowsOf`. */
export function setButtonRows(worn: WornGarment[], garmentId: string, rows: ButtonRowsId): WornGarment[] {
  return worn.map((w) => (w.garmentId === garmentId ? { ...w, buttonRows: rows } : w));
}

/**
 * The belt a worn dress is worn with, resolved against what it offers and
 * the cut it is worn in — see `beltsOn`: the one chosen while the cut takes
 * it, else the one it arrives with, else the first the cut takes — a wrap's
 * sash. `undefined` when it takes none.
 */
export function beltOf(worn: WornGarment): BeltId | undefined {
  const garment = garmentById(worn.garmentId);
  if (!garment?.belts) return undefined;
  const cut = necklineOf(worn)?.cut;
  const offered = cut ? beltsOn(cut, garment.belts.offered) : [];
  if (offered.length === 0) return undefined;
  const wanted = worn.belt ?? garment.belts.default;
  return offered.includes(wanted) ? wanted : offered.includes(garment.belts.default) ? garment.belts.default : offered[0];
}

/** Belt a worn dress. The choice is resolved when it is read; a tie that has nowhere left to go comes off — see `tidy`. */
export function setBelt(worn: WornGarment[], garmentId: string, belt: BeltId): WornGarment[] {
  return worn.map((w) => (w.garmentId === garmentId ? tidy({ ...w, belt }) : w));
}

/** Where a sash's bow can be tied, in the order one arrives at: the front first. */
export const BOW_PLACES: readonly BowAtId[] = ["front", "side"];

/**
 * The places a worn dress's sash can be tied at: none without a sash; at her
 * left side alone on a wrap, where its panels cross — see `SASHED_CUTS`; at
 * the front or at her side on any other cut.
 */
export function bowPlacesOf(worn: WornGarment): BowAtId[] {
  if (!isSash(beltOf(worn))) return [];
  const cut = necklineOf(worn)?.cut;
  return cut && (SASHED_CUTS as readonly string[]).includes(cut) ? ["side"] : [...BOW_PLACES];
}

/** Where a worn dress's sash is tied: where it was put, while that place is there; else the first place it has. `undefined` with no sash. */
export function bowAtOf(worn: WornGarment): BowAtId | undefined {
  const places = bowPlacesOf(worn);
  if (!places.length) return undefined;
  return worn.bowAt && places.includes(worn.bowAt) ? worn.bowAt : places[0];
}

/** Tie a worn dress's sash somewhere else. Resolved when it is read — see `bowAtOf`. */
export function setBowAt(worn: WornGarment[], garmentId: string, at: BowAtId): WornGarment[] {
  return worn.map((w) => (w.garmentId === garmentId ? { ...w, bowAt: at } : w));
}

/** Recut a worn pair of trousers' legs. The choice is resolved when it is read. */
export function setLeg(worn: WornGarment[], garmentId: string, leg: LegId): WornGarment[] {
  return worn.map((w) => (w.garmentId === garmentId ? { ...w, leg } : w));
}

/** Wear a garment open or closed at the front. The choice is resolved when it is read. */
export function setFront(worn: WornGarment[], garmentId: string, front: FrontId): WornGarment[] {
  return worn.map((w) => (w.garmentId === garmentId ? { ...w, front } : w));
}

/** Recut a worn garment's skirt. The choice is resolved when it is read. */
export function setSkirt(
  worn: WornGarment[],
  garmentId: string,
  skirt: SkirtChoice
): WornGarment[] {
  return worn.map((w) => (w.garmentId === garmentId ? { ...w, skirt } : w));
}

/** Recut a worn garment's sleeves. The choice is resolved when it is read. */
export function setSleeve(
  worn: WornGarment[],
  garmentId: string,
  sleeve: SleeveChoice
): WornGarment[] {
  return worn.map((w) => (w.garmentId === garmentId ? { ...w, sleeve } : w));
}

/**
 * Everything a worn garment hides: its own zones, plus its collar's, less
 * whatever its neckline bares — and, for a garment with a choice of sleeve,
 * exactly the arm its sleeve covers.
 *
 * A collar only ever **adds** — a turtleneck puts the neck under cloth. A
 * neckline can **subtract**, and is the only thing here that can: a strapless
 * bodice takes the shoulders and the arms off a dress that otherwise covers
 * them. Subtracting is the safe direction, because coverage decides what of the
 * photograph is *erased* — a bared zone is simply drawn, and the cloth paints
 * over whatever part of it the cut actually covers. Claiming a zone the cloth
 * does not reach is what leaves a hole; releasing one never can.
 *
 * Every rule downstream reads coverage through here, so the erasure, the
 * hiding and the checker all agree on one answer.
 */
export function effectiveCoverage(
  garment: Garment,
  worn: WornGarment
): BodyZone[] {
  /* a skirt's length hides what is below the hip — see `skirtCoverage` */
  const skirt = skirtOf(worn);
  const own = skirt ? [...new Set([...garment.coverage, ...skirtCoverage(skirt)])] : garment.coverage;
  const collar = collarOf(worn);
  const withCollar =
    !collar || collar.coverage.length === 0
      ? own
      : [...new Set([...own, ...collar.coverage])];

  const bares = necklineOf(worn)?.bares;
  const cut =
    !bares || bares.length === 0
      ? withCollar
      : withCollar.filter((zone) => !bares.includes(zone));

  /*
    Arm zones cover both arms at once, so a cut sleeved on one side only keeps
    the coverage its neckline gave it: claiming the arm would erase the bare one.
  */
  const sleeve = sleeveOf(worn);
  const oneSided = necklineOf(worn)?.sleeves === "left" || necklineOf(worn)?.sleeves === "right";
  return sleeve && !oneSided ? sleeveCoverage(garment.gender, cut, sleeve) : cut;
}

/**
 * Every area of a worn garment that takes its own fabric, collar included —
 * and its stripes and its tie, when it has them on: each takes a cloth of its
 * own.
 */
export function regionsOf(
  garment: Garment,
  worn: WornGarment
): FabricRegionId[] {
  const collar = collarOf(worn);
  const parts: FabricRegionId[] = partsOf(worn);
  const striped: FabricRegionId[] = stripesOnOf(worn).length > 0 ? ["trim"] : [];
  const tied: FabricRegionId[] = (tieOf(worn) ?? "none") !== "none" ? ["tie"] : [];
  if (!collar && !parts.length && !striped.length && !tied.length) return garment.fabricRegions;
  return [...garment.fabricRegions, ...(collar ? collar.fabricRegions : []), ...parts, ...striped, ...tied];
}

/** The edges stripes can be sewn along, in the panel's order. */
export const STRIPE_EDGES: readonly StripeEdgeId[] = ["collar", "neckline", "sleeves", "hem", "belt"];

/**
 * The edges of a worn garment stripes can go along, as it is cut: its
 * collar's free edge, where its collar takes them; its neckline, with no
 * collar sewn over it; each sleeve's hem, where it has sleeves on both sides;
 * and its skirt's hem. The drawing's own edges, named — see `dressEdges`; a
 * test holds the two to each other. None on a garment that takes no stripes.
 */
export function stripeEdgesOf(worn: WornGarment): StripeEdgeId[] {
  const garment = garmentById(worn.garmentId);
  if (!garment?.stripes) return [];
  const collar = collarOf(worn);
  const neckline = necklineOf(worn);
  const sleeve = sleeveOf(worn);
  const out: StripeEdgeId[] = [];
  if (collar?.takesStripes) out.push("collar");
  if (!collar && neckline && (NECKLINE_EDGED as readonly string[]).includes(neckline.cut)) out.push("neckline");
  if (sleeve && sleeve.length !== "sleeveless" && (!neckline || neckline.sleeves === "both")) out.push("sleeves");
  if (garment.skirt) out.push("hem");
  /* a fabric belt's, a garment's whose belt takes a cloth of its own */
  if (garment.partCloths?.includes("belt") && beltOf(worn) === "self") out.push("belt");
  return out;
}

/**
 * The parts of a worn garment cut from a cloth of their own, as it is worn:
 * its sleeves' ends, where its sleeves end in a piece — see `hasSleeveEnd`
 * — on a cut that keeps them; and a fabric belt or a sash.
 */
export function partsOf(worn: WornGarment): ("cuff" | "belt")[] {
  const garment = garmentById(worn.garmentId);
  const parts = garment?.partCloths ?? [];
  const out: ("cuff" | "belt")[] = [];
  const neckline = necklineOf(worn);
  if (parts.includes("cuff") && (!neckline || neckline.sleeves !== "none") && hasSleeveEnd(sleeveOf(worn))) out.push("cuff");
  const belt = beltOf(worn);
  if (parts.includes("belt") && (belt === "self" || isSash(belt))) out.push("belt");
  return out;
}

/**
 * The cloth a region of a worn garment is cut from: its own, once one is
 * chosen; until then, a part's arrives in the cloth of the part it is sewn
 * to — cuffs in the bodice's, a belt in the skirt's — so it reads as the
 * same cloth until it is changed.
 */
export function clothOf(worn: WornGarment, region: FabricRegionId): string | undefined {
  const own = worn.fabrics[region];
  if (own) return own;
  if (region === "cuff") return worn.fabrics.top ?? worn.fabrics.body;
  if (region === "belt") return worn.fabrics.bottom ?? worn.fabrics.top;
  return undefined;
}

/** The edge along the neck, where a worn garment has one: its collar's, or its neckline's. */
const neckEdge = (edges: StripeEdgeId[]): StripeEdgeId | undefined =>
  edges.includes("collar") ? "collar" : edges.includes("neckline") ? "neckline" : undefined;

/** The stripe count on a worn garment, resolved against what it offers. `undefined` when it takes none. */
export function stripesOf(worn: WornGarment): StripesId | undefined {
  const offer = garmentById(worn.garmentId)?.stripes;
  if (!offer) return undefined;
  const wanted = worn.stripes ?? offer.default;
  return offer.offered.includes(wanted) ? wanted : offer.default;
}

/**
 * The edges a worn garment's stripes are sewn along, of those it has — none
 * without a count. Chosen ones it still has; before any is chosen, along the
 * neck — or its first edge, with nothing at the neck to take them.
 *
 * Braid at the neck stays at the neck: chosen along the neckline, it moves to
 * the free edge of a collar sewn over it that takes braid, and back to the
 * neckline when that collar comes off — a sailor dress recut to a boat keeps
 * its braid at the neck. And where a recut or a collar takes every chosen
 * edge away, along the neck again, if it can.
 */
export function stripesOnOf(worn: WornGarment): StripeEdgeId[] {
  if ((stripesOf(worn) ?? "none") === "none") return [];
  const can = stripeEdgesOf(worn);
  const neck = neckEdge(can);
  const chosen = worn.stripesOn;
  if (!chosen) {
    const first = neck ?? can[0];
    return first ? [first] : [];
  }
  /* the neck as chosen, wherever the neck now is */
  const asked = chosen.some((e) => e === "collar" || e === "neckline") && neck ? [...chosen, neck] : chosen;
  const kept = can.filter((e) => asked.includes(e));
  if (chosen.length > 0 && kept.length === 0) return neck ? [neck] : [];
  return kept;
}

/** Every place a tie is knotted, in the order one arrives at: the neck first. */
export const TIE_PLACES: readonly TieAtId[] = ["neck", "belt-front", "belt-side"];

/**
 * The places a worn garment can be tied at, as it is cut — for one style,
 * or for any:
 *
 * - **At the neck**, on a cut with a centre front to knot it at — see
 *   `NECKLINE_TIED` — with no collar over it, or one a tie is knotted over:
 *   a sailor's, a Peter Pan's. A bow collar is its own tie; a standing
 *   collar covers the neck.
 * - **On the belt**, at its front or its side — a fabric belt's: a leather
 *   one is buckled. Not a necktie, which hangs from a neck.
 */
export function tiePlacesOf(worn: WornGarment, style?: TieId): TieAtId[] {
  const garment = garmentById(worn.garmentId);
  if (!garment?.ties) return [];
  const cut = necklineOf(worn)?.cut;
  const collar = collarOf(worn);
  const neck = Boolean(cut && (NECKLINE_TIED as readonly string[]).includes(cut) && (!collar || collar.takesTie));
  const belt = beltOf(worn) === "self" && style !== "necktie";
  return TIE_PLACES.filter((p) => (p === "neck" ? neck : belt));
}

/**
 * The ties a worn garment can be worn with as it is cut, none first: each
 * the garment offers that has somewhere to be knotted. Empty when it has
 * nowhere — no tie row at all.
 */
export function tiesOffered(worn: WornGarment): TieId[] {
  const offered = garmentById(worn.garmentId)?.ties?.offered ?? [];
  if (tiePlacesOf(worn).length === 0) return [];
  return offered.filter((t) => t === "none" || tiePlacesOf(worn, t).length > 0);
}

/**
 * A worn garment's tie, resolved against what it offers where it can be
 * knotted: `undefined` when it has nowhere to knot one, and none where the
 * style chosen has no place left — a necktie with only a belt to hang from.
 */
export function tieOf(worn: WornGarment): TieId | undefined {
  const ties = garmentById(worn.garmentId)?.ties;
  const offered = tiesOffered(worn);
  if (!ties || offered.length === 0) return undefined;
  const wanted = worn.tie ?? ties.default;
  return offered.includes(wanted) ? wanted : "none";
}

/**
 * Where a worn garment's tie is knotted: where it was put, while that place
 * is still there; otherwise the first place it has — the neck, then the
 * belt's front. `undefined` with no tie on.
 */
export function tieAtOf(worn: WornGarment): TieAtId | undefined {
  const tie = tieOf(worn);
  if (!tie || tie === "none") return undefined;
  const places = tiePlacesOf(worn, tie);
  return worn.tieAt && places.includes(worn.tieAt) ? worn.tieAt : places[0];
}

/** Knot a worn garment's tie somewhere else. Resolved when it is read — see `tieAtOf`. */
export function setTieAt(worn: WornGarment[], garmentId: string, at: TieAtId): WornGarment[] {
  return worn.map((w) => (w.garmentId === garmentId ? { ...w, tieAt: at } : w));
}

/**
 * Everything a worn garment is cut to on its own — its neckline, collar
 * opening, sleeves, skirt, front, legs, buttons, belt and its bow, stripes
 * and tie — as
 * its drawing takes it. What it is worn under is the stage's to add: a
 * jacket's hem it comes out from under, a top's it is tucked under.
 */
export function choiceOf(w: WornGarment): GarmentChoice {
  const skirt = skirtOf(w);
  const front = frontOf(w);
  const leg = legOf(w);
  const buttons = buttonsOf(w);
  const belt = beltOf(w);
  /* its stripes, along the edges they are sewn to, and its tie — see `GarmentChoice` */
  const count = stripesOf(w);
  const on = stripesOnOf(w);
  const stripes = count && count !== "none" && on.length ? { count, on } : undefined;
  const tie = tieOf(w);
  const tieAt = tieAtOf(w);
  const rows = buttonRowsOf(w);
  /* a sash, and where it is tied */
  const bowAt = bowAtOf(w);
  return {
    neckline: necklineOf(w)?.cut,
    opening: collarOf(w)?.opening,
    sleeve: sleeveOf(w),
    ...(skirt ? { skirt } : {}),
    ...(front ? { front } : {}),
    ...(leg ? { leg } : {}),
    ...(buttons ? { buttons } : {}),
    ...(rows === "two" ? { buttonRows: "two" as const } : {}),
    ...(belt ? { belt } : {}),
    ...(bowAt ? { bowAt } : {}),
    ...(stripes ? { stripes } : {}),
    ...(tie && tie !== "none" && tieAt ? { tie, tieAt } : {}),
  };
}

/**
 * Stripe a worn garment, or take its stripes off.
 *
 * They arrive in `fabricId` — a second cloth, or they would not show at all
 * on cloth cut from the same one — unless they already have a cloth of their
 * own, which a new count keeps. Taken off, their cloth and thread go with
 * them, and the edges chosen for them.
 */
export function setStripes(worn: WornGarment[], garmentId: string, stripes: StripesId, fabricId?: string): WornGarment[] {
  return worn.map((w) => {
    if (w.garmentId !== garmentId) return w;
    if (stripes === "none") return { ...unStriped(w), stripes };
    const cloth = w.fabrics.trim ?? fabricId ?? w.fabrics.collar ?? Object.values(w.fabrics)[0];
    /* the edge they first go along is kept as chosen, so a later recut moves them only back to the neck, never on to an edge nobody chose */
    const on = w.stripesOn ?? stripesOnOf({ ...w, stripes });
    return { ...w, stripes, stripesOn: on, fabrics: { ...w.fabrics, ...(cloth ? { trim: cloth } : {}) } };
  });
}

/**
 * Sew a worn garment's stripes along an edge, or take them off it — the
 * others stay as they are. Resolved when read: see `stripesOnOf`.
 */
export function toggleStripeEdge(worn: WornGarment[], garmentId: string, edge: StripeEdgeId): WornGarment[] {
  return worn.map((w) => {
    if (w.garmentId !== garmentId) return w;
    const now = stripesOnOf(w);
    const next = now.includes(edge) ? now.filter((e) => e !== edge) : STRIPE_EDGES.filter((e) => e === edge || now.includes(e));
    return { ...w, stripesOn: next };
  });
}

/** Sew a worn garment's stripes along exactly these edges — a look's, say. Resolved when read. */
export function setStripeEdges(worn: WornGarment[], garmentId: string, edges: StripeEdgeId[]): WornGarment[] {
  return worn.map((w) => (w.garmentId === garmentId ? { ...w, stripesOn: STRIPE_EDGES.filter((e) => edges.includes(e)) } : w));
}

/**
 * Tie a worn garment's collar, or untie it. A tie arrives in its stripes'
 * cloth when it wears stripes — the collar's own lost the knot on a busy
 * print — and in the collar's when it wears none, unless it already has one
 * of its own; untied, its cloth and thread go with it.
 */
export function setTie(worn: WornGarment[], garmentId: string, tie: TieId): WornGarment[] {
  return worn.map((w) => {
    if (w.garmentId !== garmentId) return w;
    if (tie === "none") return { ...untied(w), tie };
    const stripes = stripesOnOf(w).length > 0 ? w.fabrics.trim : undefined;
    /* where it will be knotted: on a belt, in the belt's cloth; at the neck, the collar's, or the bodice's */
    const at = tieAtOf({ ...w, tie });
    const under = at && at !== "neck" ? clothOf(w, "belt") : w.fabrics.collar;
    const cloth = w.fabrics.tie ?? stripes ?? under ?? Object.values(w.fabrics)[0];
    return { ...w, tie, fabrics: { ...w.fabrics, ...(cloth ? { tie: cloth } : {}) } };
  });
}

/** A worn garment with no stripes, and no cloth, thread or edges kept for them. */
function unStriped(w: WornGarment): WornGarment {
  const { trim: _cloth, ...fabrics } = w.fabrics;
  const { trim: _thread, ...stitch } = w.stitch;
  const { stripes: _off, stripesOn: _on, ...rest } = w;
  return { ...rest, fabrics, stitch };
}

/** A worn garment with no tie, and no cloth, thread or place kept for one. */
function untied(w: WornGarment): WornGarment {
  const { tie: _cloth, ...fabrics } = w.fabrics;
  const { tie: _thread, ...stitch } = w.stitch;
  const { tie: _off, tieAt: _at, ...rest } = w;
  return { ...rest, fabrics, stitch };
}

/**
 * A worn garment with nothing kept for what it no longer offers: a tie where
 * its collar takes none — after a new collar, a collar taken off, or a recut.
 * Its stripes stay: they go along whatever edges it still has — see
 * `stripesOnOf`.
 */
function tidy(w: WornGarment): WornGarment {
  const striped = garmentById(w.garmentId)?.stripes ? w : unStriped(w);
  /* a tie with nowhere left to knot it comes off; with a place left, it moves there — see `tieAtOf` */
  const tie = tieOf(striped);
  return tie && (tie !== "none" || !striped.tie || striped.tie === "none") ? striped : untied(striped);
}

/**
 * Sew a collar on, or take it off.
 *
 * A new collar arrives in the cloth the garment is already cut from, because a
 * collar that appeared unfilled would read as a hole rather than as a part.
 * Choosing a different fabric for it afterwards is the point of the feature.
 */
export function setCollar(
  worn: WornGarment[],
  garmentId: string,
  collarId: string | undefined
): WornGarment[] {
  return worn.map((w) => {
    if (w.garmentId !== garmentId) return w;
    if (!collarId) {
      const bare = w;
      const { collar: _dropped, ...fabrics } = bare.fabrics;
      const { collar: _thread, ...stitch } = bare.stitch;
      /*
        Spread rather than rebuilt. Written out longhand this dropped every
        other field on the way past — which was invisible while `collarId` was
        the only one, and would have silently un-cut the neckline the moment a
        second arrived.
      */
      const { collarId: _off, ...rest } = bare;
      /* its stripes and its tie come off with it — but a neckline's own stripes stay */
      return tidy({ ...rest, fabrics, stitch });
    }
    const [fallback] = Object.values(w.fabrics);
    /* a collar that takes no stripes or tie drops the ones the last collar had */
    return tidy({
      ...w,
      collarId,
      fabrics: { ...w.fabrics, collar: w.fabrics.collar ?? fallback },
    });
  });
}

/**
 * Cut the garment to a neckline, and drop a collar that no longer fits it.
 *
 * The second half is the point. A collar with a stand needs cloth at the base
 * of the throat to stand on, and a strapless or halter cut leaves none — so
 * choosing one of those has to take the collar off rather than leave a mandarin
 * floating over a bare chest. The alternative was what the dress used to do:
 * silently recut *itself* to a high opening whenever a stand collar was picked,
 * which is invisible, and would make an explicit neckline picker a liar.
 *
 * Both directions are visible in the UI: this drops a collar, and choosing a
 * collar moves the neckline to one that can take it.
 */
export function setNeckline(
  worn: WornGarment[],
  garmentId: string,
  necklineId: string | undefined
): WornGarment[] {
  return worn.map((w) => {
    if (w.garmentId !== garmentId) return w;
    const next: WornGarment = necklineId
      ? { ...w, necklineId }
      : (() => {
          const { necklineId: _off, ...rest } = w;
          return rest;
        })();

    const neckline = necklineOf(next);
    // The collar as stored, not as validated: a collar the new cut cannot
    // carry is exactly the one to take off, or it would linger unseen.
    const collar = sewnOn(next);

    // A cut that is not itself without a collar arrives wearing one.
    if (!collar && neckline?.wants) {
      return setCollar([next], garmentId, neckline.wants)[0];
    }
    /* recut, it keeps only the stripes the new cut — or its collar — still takes */
    if (!collar || fitsCut(collar, neckline)) return tidy(next);
    return setCollar([next], garmentId, undefined)[0];
  });
}

/**
 * The collars this garment can take **as it is currently cut**.
 *
 * A collar names the opening it needs; a neckline presents one. Anything else
 * would be a band sewn to nothing.
 */
export function collarsFitting(
  garment: Garment,
  worn: WornGarment
): Collar[] {
  const all = collarsForGarment(garment);
  const neckline = necklineOf(worn);
  if (!neckline) return all;
  return all.filter((c) => fitsCut(c, neckline));
}

/** A garment cut from one fabric throughout — how it arrives on the body. */
export function cutFrom(
  garment: Garment,
  fabricId: string,
  stitch: Partial<Record<string, StitchId>> = {}
): WornGarment {
  const collar = defaultCollar(garment);
  const neckline = defaultNeckline(garment);
  const sleeve = defaultSleeve(garment);
  const regions = collar
    ? [...garment.fabricRegions, ...collar.fabricRegions]
    : garment.fabricRegions;
  return {
    garmentId: garment.id,
    ...(collar ? { collarId: collar.id } : {}),
    ...(neckline ? { necklineId: neckline.id } : {}),
    ...(sleeve ? { sleeve } : {}),
    fabrics: Object.fromEntries(regions.map((region) => [region, fabricId])),
    stitch: { ...stitch },
  };
}

/** Put a garment on, taking off whatever it cannot be worn with. */
export function wear(worn: WornGarment[], next: WornGarment): WornGarment[] {
  const garment = garmentById(next.garmentId);
  if (!garment) return worn;
  const kept = worn.filter((w) => {
    const other = garmentById(w.garmentId);
    return other ? !conflicts(garment, other) : false;
  });
  return [...kept, next];
}

export const takeOff = (worn: WornGarment[], garmentId: string): WornGarment[] =>
  worn.filter((w) => w.garmentId !== garmentId);

export const isWearing = (worn: WornGarment[], garmentId: string): boolean =>
  worn.some((w) => w.garmentId === garmentId);

/** Everything worn, in draw order — innermost layer first. */
export function stack(worn: WornGarment[]): StackEntry[] {
  return worn
    .flatMap((w) => {
      const garment = garmentById(w.garmentId);
      return garment ? [{ garment, worn: w }] : [];
    })
    .sort((a, b) => layerIndex(a.garment.layer) - layerIndex(b.garment.layer));
}

/**
 * The stack with everything invisible dropped.
 *
 * A garment whose every covered zone is already covered by a layer above it
 * cannot be seen, so it is not drawn: a t-shirt under a fastened jacket costs
 * nothing until the jacket comes off, at which point it reappears exactly as it
 * was. A garment that covers nothing is never hidden — an accessory sits on top
 * of the world.
 */
export function visibleStack(worn: WornGarment[]): StackEntry[] {
  const ordered = stack(worn);
  const above = new Set<BodyZone>();
  const visible: StackEntry[] = [];

  for (let i = ordered.length - 1; i >= 0; i--) {
    const { garment, worn: w } = ordered[i];
    const coverage = effectiveCoverage(garment, w);
    const hidden =
      coverage.length > 0 && coverage.every((zone) => above.has(zone));
    if (!hidden) visible.unshift(ordered[i]);
    for (const zone of coverage) above.add(zone);
  }

  return visible;
}

/** Every body zone something worn is hiding, collars included. */
export function coveredZones(worn: WornGarment[]): Set<BodyZone> {
  const covered = new Set<BodyZone>();
  for (const entry of stack(worn)) {
    for (const zone of effectiveCoverage(entry.garment, entry.worn)) {
      covered.add(zone);
    }
  }
  return covered;
}

/* ------------------------------------------------------ changing bodies */

/**
 * Only the garments cut for this body.
 *
 * The last line of defence, and it belongs in front of *both* `visibleStack`
 * and `coveredZones`. A garment on the wrong body is not merely drawn in the
 * wrong shape: its coverage erases zones of a figure the drawing never reaches,
 * so filtering only what gets drawn would turn a wrong dress into a hole.
 */
export const wornOn = (
  worn: WornGarment[],
  body: BodyType
): WornGarment[] =>
  worn.filter((w) => garmentById(w.garmentId)?.gender === body);

/**
 * The garment on `to` that does the same job: the same piece if that body has
 * one, and failing that anything in the same category.
 *
 * Total, because every category exists on both bodies — which is the property
 * that keeps the mannequin dressed through a switch, and is asserted in
 * `data/garments.test.ts`.
 */
export function counterpart(
  garment: Garment,
  to: BodyType
): Garment | undefined {
  if (garment.gender === to) return garment;
  const wardrobe = garmentsFor(to);
  const piece = garmentPiece(garment);
  return (
    wardrobe.find((g) => garmentPiece(g) === piece) ??
    wardrobe.find((g) => g.category === garment.category)
  );
}

/**
 * Re-cut a worn garment as its counterpart, carrying across everything the new
 * pattern has a place for.
 *
 * The two patterns rarely name their regions the same way — a dress is cut from
 * `top` and `bottom`, a thobe from `body` and `collar` — so regions that exist
 * on both keep their own fabric and the rest fall back to whatever the old
 * garment was mostly made of. Switching body changes the pattern, never the
 * cloth.
 *
 * The design comes too, as far as the counterpart offers it: the same collar,
 * the same cut of neck, the same sleeve type and length. What it does not offer
 * falls back to its own default — a thobe has no puff sleeve — and a collar
 * keeps a neckline that can carry it, so a thobe's mandarin arrives on a dress
 * cut high rather than floating over a round neck.
 *
 * This is only ever how a body is dressed the *first* time — see
 * `switchBody`. It cannot be a round trip, because a thobe has no neckline or
 * skirt to remember a dress's by.
 */
function recut(worn: WornGarment, garment: Garment): WornGarment {
  const [fallback] = Object.values(worn.fabrics);
  const fabrics: Partial<Record<FabricRegionId, string>> = {};
  const stitch: Partial<Record<FabricRegionId, StitchId>> = {};

  const wanted = counterpartCollar(collarOf(worn), garment);
  const neckline = counterpartNeckline(necklineOf(worn), wanted, garment);
  const collar = wanted && fitsCut(wanted, neckline) ? wanted : undefined;
  const regions = collar
    ? [...garment.fabricRegions, ...collar.fabricRegions]
    : garment.fabricRegions;

  for (const region of regions) {
    const fabric = worn.fabrics[region] ?? fallback;
    if (fabric) fabrics[region] = fabric;
    const thread = worn.stitch[region];
    if (thread) stitch[region] = thread;
  }

  const cut: WornGarment = {
    garmentId: garment.id,
    ...(collar ? { collarId: collar.id } : {}),
    ...(neckline ? { necklineId: neckline.id } : {}),
    fabrics,
    stitch,
  };
  // Resolved against the new garment, so what is stored is what is drawn.
  const sleeve =
    garment.sleeves &&
    sleeveOf({ ...cut, sleeve: sleeveOf(worn) ?? garment.sleeves.default });
  /* the same leg, where the counterpart offers it — a pair of trousers' */
  const leg = garment.legs && legOf({ ...cut, leg: legOf(worn) ?? garment.legs.default });
  return { ...cut, ...(sleeve ? { sleeve } : {}), ...(leg ? { leg } : {}) };
}

/**
 * The cut of neck a counterpart is given: the same cut if it offers one, else a
 * cut that can carry the collar coming across, else its own default.
 */
function counterpartNeckline(
  neckline: Neckline | undefined,
  collar: Collar | undefined,
  garment: Garment
): Neckline | undefined {
  const offered = necklinesForGarment(garment);
  if (offered.length === 0) return undefined;
  const same = neckline && offered.find((n) => n.cut === neckline.cut);
  if (same) return same;
  const home = defaultNeckline(garment);
  if (!collar || (home && fitsCut(collar, home))) return home;
  return (
    offered.find(
      (n) => fitsCut(collar, n) && (!n.wants || n.wants === collar.id)
    ) ?? home
  );
}

/**
 * Put the other mannequin on the stage.
 *
 * Each body keeps its own wardrobe. The one leaving the stage is put away
 * exactly as it is, and the one arriving comes back exactly as it was left:
 * nothing about either is re-derived from the other, so a switch and back
 * changes nothing at all.
 *
 * It used to. The outfit was one list, and switching *replaced* it with the
 * other body's counterparts — so going back rebuilt the dress from a thobe,
 * which has no neckline, no puff sleeve and no skirt to remember the dress's
 * by. The dress came home cut round, short-sleeved and in one cloth, still
 * wearing a mandarin that no longer fitted its neck.
 *
 * Only a body that has never been on the stage is dressed from the other, by
 * `changeBody`; and a mannequin that was dressed stays dressed, in the default
 * garment if nothing it wore has a counterpart.
 */
export function switchBody(
  outfit: Outfit,
  to: BodyType,
  fabricId: string
): Outfit {
  if (outfit.bodyType === to) return outfit;
  const here = wornOn(outfit.worn, outfit.bodyType);
  const { [to]: kept, ...away } = outfit.away ?? {};
  const there = kept ?? firstDressing(here, to, fabricId);
  return {
    ...outfit,
    bodyType: to,
    worn: wornOn(there, to),
    away: { ...away, [outfit.bodyType]: here },
  };
}

function firstDressing(
  here: WornGarment[],
  to: BodyType,
  fabricId: string
): WornGarment[] {
  const swapped = changeBody(here, to);
  return here.length > 0 && swapped.length === 0
    ? [cutFrom(defaultGarment(to), fabricId)]
    : swapped;
}

/**
 * The same change made to every body's wardrobe — the one on the stage and
 * the ones put away — as when a new fabric dresses everything.
 */
export function everyWardrobe(
  outfit: Outfit,
  change: (worn: WornGarment[]) => WornGarment[]
): Outfit {
  const worn = change(outfit.worn);
  if (!outfit.away) return { ...outfit, worn };
  const away: Outfit["away"] = Object.fromEntries(
    Object.entries(outfit.away).map(([body, list]) => [body, change(list ?? [])])
  );
  return { ...outfit, worn, away };
}

/** A collar's name with the body stripped off — `"shirt-collar"`, `"bow-collar"`. */
const collarPiece = (collar: Collar): string =>
  collar.id.slice(collar.gender.length + 1);

/**
 * The same collar on the body the garment belongs to.
 *
 * Matched by name, the way garments are, and it falls back to whatever the new
 * garment arrives wearing. Until the male wardrobe has collars of its own this
 * returns `undefined` for every switch to male — a female collar cannot be sewn
 * to a male neckline any more than a female blouse can be worn on him.
 */
function counterpartCollar(
  collar: Collar | undefined,
  garment: Garment
): Collar | undefined {
  if (!garment.acceptsCollar) return undefined;
  if (!collar) return defaultCollar(garment);
  const piece = collarPiece(collar);
  const offered = collarsForGarment(garment);
  return (
    offered.find((c) => collarPiece(c) === piece) ??
    /* one with no namesake there names the collar it becomes — see `Collar.across` */
    (collar.across ? offered.find((c) => c.id === collar.across) : undefined) ??
    defaultCollar(garment)
  );
}

/**
 * Move an outfit onto another body.
 *
 * Nothing is added that was not already worn, and nothing survives that the new
 * body cannot wear. Two garments can map onto the same counterpart — a blouse
 * and a t-shirt are both simply tops over there — so anything that would
 * conflict with what has already been kept is dropped rather than fought over.
 */
export function changeBody(
  worn: WornGarment[],
  to: BodyType
): WornGarment[] {
  const out: WornGarment[] = [];

  for (const entry of stack(worn)) {
    const swap = counterpart(entry.garment, to);
    if (!swap) continue;
    const clash = out.some((kept) => {
      const other = garmentById(kept.garmentId);
      return other ? conflicts(swap, other) : false;
    });
    if (clash) continue;
    out.push(swap === entry.garment ? entry.worn : recut(entry.worn, swap));
  }

  return out;
}
