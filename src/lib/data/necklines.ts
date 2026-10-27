import type { BodyType, Garment, Neckline } from "@/types";
import {
  NECKLINE_BARES,
  NECKLINE_IDS,
  NECKLINE_OPENING,
  NECKLINE_SLEEVES,
  NECKLINE_WANTS,
  RETIRED_NECKLINES,
  type NecklineId,
} from "@/lib/garments/necklines";

/**
 * The necklines.
 *
 * A **neckline is a cut, a collar is a piece.** That is the whole distinction,
 * and it is why this file exists beside `collars.ts` rather than inside it: a
 * collar is separate cloth sewn on, with its own drawing, its own fabric region
 * and its own coverage; a neckline reshapes the garment's own outline and takes
 * no fabric of its own. Six of the fifteen also remove the shoulders and the
 * sleeves, which a collar can never do.
 *
 * The two compose, which is the point. Dress + Neckline + Collar is three
 * independent choices rather than one hardcoded garment per combination, and a
 * sleeve system slots in beside them later on the same terms.
 *
 * Each record is a *catalogue* entry — a name, what it fits, what it bares.
 * The geometry lives in `lib/garments/necklines.ts` and the two are kept in
 * step by construction: the ids, the openings, the sleeves and the bared zones
 * are all read from there rather than retyped here, so a cut and its record
 * cannot disagree about what it does.
 *
 * Ids are `<body>-<name>-neckline`, so a neckline id can never be mistaken for
 * a garment or a collar id in a log or a lookup.
 */

const NAMES: Record<NecklineId, { en: string; ar: string }> = {
  round: { en: "Round", ar: "دائرية" },
  scoop: { en: "Scoop", ar: "دائرية واسعة" },
  boat: { en: "Boat", ar: "قاربية" },
  v: { en: "V-neck", ar: "سبعة" },
  square: { en: "Square", ar: "مربعة" },
  high: { en: "High", ar: "عالية" },
  keyhole: { en: "Keyhole", ar: "ثقب المفتاح" },
  cowl: { en: "Cowl", ar: "منسدلة" },
  wrap: { en: "Wrap", ar: "ملفوفة" },
  collared: { en: "Collared", ar: "بياقة" },
  "off-shoulder": { en: "Off-shoulder", ar: "مكشوفة الكتفين" },
  sweetheart: { en: "Sweetheart", ar: "قلبية" },
  halter: { en: "Halter", ar: "هالتر (حول الرقبة)" },
  /*
    Named for what shoppers search for. It is the asymmetrical cut — one
    shoulder covered, a diagonal to the far underarm — and it replaced the
    one-shoulder cut, which was this one without its sleeve; see
    `RETIRED_NECKLINES`. Its id stays, so a look already cut to it keeps it.
  */
  asymmetrical: { en: "One-shoulder", ar: "كتف واحد" },
};

/**
 * Every cut is offered on a dress. Tops keep the opening their collar asks for
 * until they opt in — see `Garment.acceptsNeckline`.
 */
export const necklines: Neckline[] = NECKLINE_IDS.map((id) => ({
  id: `female-${id}-neckline`,
  cut: id,
  name: NAMES[id],
  gender: "female" as BodyType,
  compatibleWith: ["dress"] as Neckline["compatibleWith"],
  bares: [...NECKLINE_BARES[id]],
  sleeves: NECKLINE_SLEEVES[id],
  opening: NECKLINE_OPENING[id],
  ...(NECKLINE_WANTS[id] ? { wants: NECKLINE_WANTS[id] } : {}),
}));

export const necklineById = (id: string): Neckline | undefined =>
  necklines.find((n) => n.id === id);

/**
 * What a look cut to a neckline no longer offered opens as: the record that
 * replaced it, and whether it opens sleeveless — see `RETIRED_NECKLINES`.
 * `undefined` for any neckline still offered.
 */
export const retiredNeckline = (id: string): { id: string; sleeveless: boolean } | undefined => {
  const cut = /^female-(.+)-neckline$/.exec(id)?.[1];
  const to = cut ? RETIRED_NECKLINES[cut] : undefined;
  return to ? { id: `female-${to.as}-neckline`, sleeveless: to.sleeveless } : undefined;
};

/** Every neckline cut for one body — the only ones it may ever be offered. */
export const necklinesFor = (body: BodyType): Neckline[] =>
  necklines.filter((n) => n.gender === body);

/**
 * The necklines this garment can be cut to: same body, right category, and
 * only if the garment is built to be recut at all.
 *
 * A garment that does not accept one keeps whatever opening its own drawing
 * cuts, exactly as before — nothing in the wardrobe changes by adding this.
 */
export const necklinesForGarment = (garment: Garment): Neckline[] =>
  garment.acceptsNeckline
    ? necklinesFor(garment.gender).filter((n) =>
        n.compatibleWith.includes(garment.category)
      )
    : [];

/** The neckline a garment arrives cut to, if it names one that still fits. */
export const defaultNeckline = (garment: Garment): Neckline | undefined => {
  if (!garment.defaultNeckline) return undefined;
  const neckline = necklineById(garment.defaultNeckline);
  return neckline && necklinesForGarment(garment).includes(neckline)
    ? neckline
    : undefined;
};
