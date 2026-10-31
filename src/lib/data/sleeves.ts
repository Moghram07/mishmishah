import type {
  BodyType,
  CuffId,
  Garment,
  Neckline,
  SleeveChoice,
  SleeveLengthId,
  SleeveTypeId,
} from "@/types";
import {
  BAND_CUT_TYPES,
  CUFFS,
  SHOULDER_TYPES,
  SLEEVE_KINDS,
  SLEEVE_LENGTHS,
  SLEEVE_TYPES,
  cuffsOffered,
} from "@/lib/garments/sleeves";

/**
 * The sleeves, as a catalogue: names, and what is on offer where.
 *
 * Two lists, not one. A **type** is how the sleeve is built and joined — the
 * thing that changes the shoulder and the armhole — and a **length** is where
 * it ends on the arm. A puff at the elbow and a puff above it are one puff, so
 * the catalogue does not carry both; each type names the lengths it exists at,
 * and anything outside them is simply not offered.
 *
 * The geometry lives in `lib/garments/sleeves.ts`, and the ids, the bodies each
 * type is offered on and its lengths are all read from there, so the catalogue
 * and the drafting cannot disagree about what a sleeve is.
 */

export interface SleeveType {
  id: SleeveTypeId;
  name: { en: string; ar: string };
}

export interface SleeveLength {
  id: SleeveLengthId;
  name: { en: string; ar: string };
}

export interface SleeveCuff {
  id: CuffId;
  name: { en: string; ar: string };
}

const TYPE_NAMES: Record<SleeveTypeId, { en: string; ar: string }> = {
  "set-in": { en: "Set-in", ar: "مركّب" },
  drop: { en: "Drop shoulder", ar: "كتف منسدل" },
  raglan: { en: "Raglan", ar: "راقلان" },
  kimono: { en: "Kimono", ar: "كيمونو" },
  dolman: { en: "Dolman", ar: "دولمان" },
  puff: { en: "Puff", ar: "منفوش" },
  bishop: { en: "Bishop", ar: "واسع بأسورة" },
  bell: { en: "Bell", ar: "جرسي" },
  flutter: { en: "Flutter", ar: "كشكش" },
  cap: { en: "Cap", ar: "كاب" },
  /* an off-shoulder's own sleeve: the band alone when short, a fitted sleeve below it when longer */
  "off-shoulder": { en: "Fitted", ar: "ضيّق" },
};

const LENGTH_NAMES: Record<SleeveLengthId, { en: string; ar: string }> = {
  sleeveless: { en: "Sleeveless", ar: "بلا أكمام" },
  short: { en: "Short", ar: "قصير" },
  elbow: { en: "Elbow", ar: "إلى الكوع" },
  "three-quarter": { en: "Three-quarter", ar: "ثلاثة أرباع" },
  long: { en: "Long", ar: "طويل" },
};

/** Named as the reference chart names them. */
const CUFF_NAMES: Record<CuffId, { en: string; ar: string }> = {
  none: { en: "No cuff", ar: "بدون كبك" },
  plain: { en: "Plain cuff", ar: "كبك سادة" },
  formal: { en: "Formal cuff", ar: "كبك رسمي" },
  french: { en: "French cuff", ar: "كبك فرنسي" },
  rib: { en: "Rib cuff", ar: "أسورة مضلّعة" },
};

export const sleeveTypes: SleeveType[] = SLEEVE_TYPES.map((id) => ({
  id,
  name: TYPE_NAMES[id],
}));

export const sleeveLengths: SleeveLength[] = SLEEVE_LENGTHS.map((id) => ({
  id,
  name: LENGTH_NAMES[id],
}));

export const sleeveCuffs: SleeveCuff[] = CUFFS.map((id) => ({
  id,
  name: CUFF_NAMES[id],
}));

export const sleeveCuffById = (id: CuffId): SleeveCuff | undefined =>
  sleeveCuffs.find((c) => c.id === id);

export const sleeveTypeById = (id: SleeveTypeId): SleeveType | undefined =>
  sleeveTypes.find((t) => t.id === id);

export const sleeveLengthById = (id: SleeveLengthId): SleeveLength | undefined =>
  sleeveLengths.find((l) => l.id === id);

/** The set-in family: the types that keep the set-in join and change its shape. */
const SET_IN_FAMILY = SLEEVE_TYPES.filter(
  (t) => SLEEVE_KINDS[t].construction === "set-in"
);

/**
 * The types a garment can be cut with, on the body it is for, as it is cut.
 *
 * A neckline decides the rest. One that takes the sleeves off offers none; one
 * that keeps a single shoulder offers only sleeves that leave the shoulder as
 * it is — a raglan or a kimono is built from both.
 */
export function sleeveTypesFor(
  garment: Garment,
  neckline?: Neckline
): SleeveTypeId[] {
  if (!garment.sleeves) return [];
  const body: BodyType = garment.gender;
  const offered = garment.sleeves.types.filter((t) =>
    SLEEVE_KINDS[t].bodies.includes(body)
  );
  /*
    An off-shoulder's band is the top of every sleeve it offers: its own fitted
    one, and the loose ones the garment offers, each hung from the band. None
    of the types that describe a shoulder seam — the cut has none.
  */
  if (neckline?.sleeves === "band") {
    return BAND_CUT_TYPES.filter(
      (t) => SLEEVE_KINDS[t].bodies.includes(body) && (SLEEVE_KINDS[t].construction === "band" || offered.includes(t))
    );
  }
  if (!neckline || neckline.sleeves === "both") return offered.filter((t) => SLEEVE_KINDS[t].construction !== "band");
  if (neckline.sleeves === "none") return [];
  return offered.filter(
    (t) => SET_IN_FAMILY.includes(t) && !SHOULDER_TYPES.includes(t)
  );
}

/**
 * The lengths a type exists at, and none — except on an off-shoulder cut,
 * where every sleeve hangs from the band and the shortest is the band alone:
 * without a sleeve the cut would be a strapless one.
 */
export const sleeveLengthsFor = (type: SleeveTypeId, neckline?: Neckline, garment?: Garment): SleeveLengthId[] =>
  garment?.sleeves?.lengths
    ? [...garment.sleeves.lengths]
    : SLEEVE_KINDS[type].construction === "band" || neckline?.sleeves === "band"
      ? [...SLEEVE_KINDS[type].lengths]
      : ["sleeveless", ...SLEEVE_KINDS[type].lengths];

/**
 * The length a sleeve falls back to when the one worn is not offered: the
 * type's own first, where the garment cuts it — else the garment's first.
 */
export const fallbackLength = (type: SleeveTypeId, offered: SleeveLengthId[]): SleeveLengthId =>
  offered.includes(firstLength(type)) ? firstLength(type) : offered[0];

/** What a garment calls a sleeve: its own name for it, or the catalogue's. */
export const sleeveTypeName = (garment: Garment | undefined, type: SleeveTypeId): { en: string; ar: string } =>
  garment?.sleeves?.names?.[type] ?? TYPE_NAMES[type];

/** A type's own first length — its shortest sleeve, never "none". */
export function firstLength(type: SleeveTypeId): SleeveLengthId {
  return SLEEVE_KINDS[type].lengths[0];
}

/**
 * The cuffs a sleeve can be finished with on this garment: the garment's own
 * list, for a long sleeve that takes a cuff, and nothing for any other.
 */
export const sleeveCuffsFor = (garment: Garment, sleeve: SleeveChoice): CuffId[] =>
  cuffsOffered(garment.sleeves?.cuffs, sleeve);

/** The sleeve a garment arrives in. */
export const defaultSleeve = (garment: Garment): SleeveChoice | undefined =>
  garment.sleeves?.default;
