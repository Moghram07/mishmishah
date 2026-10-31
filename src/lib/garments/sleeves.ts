/*
  Plain `.ts`, relative and extensioned, and no JSX — so `scripts/
  preview-garments.mjs` can import it and rasterise every sleeve the app can
  draw, the way it already does the dress's fifteen necklines.
*/
import {
  SLEEVE_CAP_RISE,
  SLEEVE_GAP,
  SLEEVE_GAP_RAMP,
  SLEEVE_SCYE_BOW,
  SLEEVE_SEAM_EASE,
  SLEEVE_UNDERARM_DROP,
  bodySide,
  draft,
  hem,
  line,
  mirrorPts as mirror,
  outline,
  reverse,
  run,
  seamCurve,
  shirttail,
  span,
  taut,
  tucked,
  type Pt,
  type TopSpec,
  type Tuck,
} from "./fit.ts";
import type {
  BodyType,
  BodyZone,
  CuffId,
  SleeveChoice,
  SleeveLengthId,
  SleeveTypeId,
} from "@/types";
import type { Fold } from "./folds.tsx";
import { BODY_CANVAS } from "../mannequin/bodies.ts";

export type { CuffId, SleeveChoice, SleeveLengthId, SleeveTypeId };

/**
 * Sleeves: a **type** — how the sleeve is built and joined to the body — and a
 * **length**, where it ends. Kept apart because they are apart: a puff sleeve
 * is a puff sleeve at the shoulder whether it stops above the elbow or at it,
 * and a length is only a row on the arm.
 *
 * What separates the types is construction first, and drafting is where that
 * lives:
 *
 *   • **set-in** — sewn into an armhole that runs from the shoulder point down
 *     to the underarm. The tailored join, and the base of puff, bishop, bell
 *     and flutter, which change the sleeve's shape and not its join.
 *   • **drop** — the shoulder runs on past the shoulder point and the sleeve is
 *     sewn a few centimetres down the upper arm, into a lowered underarm.
 *   • **raglan** — a diagonal seam from the neckline to the underarm, so the
 *     sleeve carries the shoulder with it.
 *   • **cut-on** — kimono and dolman: cut in one with the body, no armhole at
 *     all, and an underarm dropped well below the arm's own — moderately for a
 *     kimono's T, nearly to the waist for a dolman.
 *   • **cap** — no sleeve piece: the body's shoulder carried a little way down
 *     the arm and finished there.
 *
 * Every row a sleeve uses is the body's: its shoulder point, armpit, elbow and
 * wrist come from the measured photograph, so her sleeves and his are drafted
 * to their own arms and the same numbers are never shared between them.
 */

export const SLEEVE_TYPES: readonly SleeveTypeId[] = [
  "set-in",
  "drop",
  "raglan",
  "kimono",
  "dolman",
  "puff",
  "bishop",
  "bell",
  "flutter",
  "cap",
  "off-shoulder",
];

export const SLEEVE_LENGTHS: readonly SleeveLengthId[] = [
  "sleeveless",
  "short",
  "elbow",
  "three-quarter",
  "long",
];

/**
 * `band` is an off-shoulder cut's own sleeve: its band round the upper arm is
 * the top of it, and the cut drafts it — see `necklines.ts` — not `top`.
 */
type Construction = "set-in" | "drop" | "raglan" | "cut-on" | "cap" | "band";

export interface SleeveKind {
  construction: Construction;
  /** The lengths the type exists at. Sleeveless is on offer as well, but for a band's: see `sleeveLengthsFor`. */
  lengths: SleeveLengthId[];
  /** Which mannequins it is offered on. */
  bodies: BodyType[];
}

export const SLEEVE_KINDS: Record<SleeveTypeId, SleeveKind> = {
  "set-in": { construction: "set-in", lengths: ["short", "elbow", "three-quarter", "long"], bodies: ["female", "male"] },
  drop: { construction: "drop", lengths: ["short", "elbow", "long"], bodies: ["female", "male"] },
  raglan: { construction: "raglan", lengths: ["short", "elbow", "three-quarter", "long"], bodies: ["female", "male"] },
  kimono: { construction: "cut-on", lengths: ["short", "elbow"], bodies: ["female", "male"] },
  dolman: { construction: "cut-on", lengths: ["three-quarter", "long"], bodies: ["female"] },
  puff: { construction: "set-in", lengths: ["short", "elbow"], bodies: ["female"] },
  bishop: { construction: "set-in", lengths: ["three-quarter", "long"], bodies: ["female"] },
  bell: { construction: "set-in", lengths: ["elbow", "three-quarter", "long"], bodies: ["female"] },
  flutter: { construction: "set-in", lengths: ["short"], bodies: ["female"] },
  cap: { construction: "cap", lengths: ["short"], bodies: ["female"] },
  /* short is the band alone */
  "off-shoulder": { construction: "band", lengths: ["short", "elbow", "three-quarter", "long"], bodies: ["female"] },
};

/**
 * The types that rebuild the shoulder itself, and so need a garment that has
 * both of its shoulders — not a one-shoulder cut, and not a strapless one.
 */
export const SHOULDER_TYPES: SleeveTypeId[] = ["drop", "raglan", "kimono", "dolman", "cap"];

/**
 * Whether a sleeve leaves its bodice an armhole seam. One cut on with the
 * bodice — a kimono, a dolman, a cap — does not: the body runs on into it.
 */
export const hasArmhole = (type: SleeveTypeId): boolean =>
  !["cut-on", "cap"].includes(SLEEVE_KINDS[type].construction);

/**
 * How a long sleeve can be finished at the wrist, named as the chart names
 * them: a plain hem at its own width («بدون كبك»); and, on a woven garment, a
 * plain band («كبك سادة»), the same band buttoned under a short sleeve placket
 * («كبك رسمي»), or a deeper band turned back on itself and closed with a
 * cufflink («كبك فرنسي»); on a knit one, a ribbed band («أسورة مضلّعة»). Which a
 * garment offers is its own record's business.
 */
export const CUFFS: readonly CuffId[] = ["none", "plain", "formal", "french", "rib"];

/**
 * The types a cuff is sewn to: the sewn sleeves, set-in, drop shoulder and
 * raglan — see `sewn` in `top` — and the dolman, whose long sleeve narrows
 * to the wrist. A cuff is a long sleeve's, and only a long one's. The bishop
 * has its own cuff, and the other loose sleeves keep the finishes they are
 * named for.
 */
const CUFFED_TYPES: readonly SleeveTypeId[] = ["set-in", "drop", "raglan", "dolman", "off-shoulder"];

/**
 * The cuffs on offer for one sleeve, from the ones its garment offers — none
 * at all unless it is long and of a type that takes one. Here rather than in
 * the catalogue so that `check:garments` asks the same question.
 */
export const cuffsOffered = (offered: readonly CuffId[] | undefined, c: SleeveChoice): CuffId[] =>
  c.length === "long" && CUFFED_TYPES.includes(c.type) ? [...(offered ?? [])] : [];

/** Is this type × length a sleeve that exists? */
export const sleeveAllowed = (c: SleeveChoice): boolean =>
  c.length === "sleeveless" || SLEEVE_KINDS[c.type].lengths.includes(c.length);

/* ------------------------------------------------------------ the lengths */

/** How far down the upper arm a short sleeve ends: past halfway to the elbow. */
const SHORT = 0.55;
/** A cap covers the top of the shoulder and stops. */
const CAP_LENGTH = 16;
/** A long sleeve comes down over the wrist bone, not to it. */
const OVER_WRIST = 6;

/**
 * The row a sleeve ends on, from the arm's own landmarks. `null` for none.
 *
 * Every garment used to type its own cuff row — 330, 344, 358, 362, 486, 490 —
 * so a "short" sleeve on one ended where an elbow-length one did on another,
 * and his and hers ended on the same rows whatever their arms did.
 */
/**
 * The row a sleeve's underarm is at, on one body — where its inner edge leaves
 * the body, and where its width is measured from. `null` for no sleeve, or a
 * cap, which has no underarm of its own.
 */
export function underarmRow(body: BodyType, c: SleeveChoice): number | null {
  const cuff = hemRow(body, c);
  const kind = SLEEVE_KINDS[c.type].construction;
  if (cuff === null || kind === "cap") return null;
  /* an off-shoulder's sleeve leaves its band at the band's hem */
  if (kind === "band") return hemRow(body, { type: c.type, length: "short" });
  const d = draft(body);
  if (kind === "cut-on") {
    const dolman = c.type === "dolman";
    const joinY = d.armpitY + (dolman ? DOLMAN_DEPTH : KIMONO_DEPTH) * (d.waistY - d.armpitY);
    return Math.min(cuff, dolman ? d.elbowY : joinY + 14);
  }
  return d.armpitY + SLEEVE_UNDERARM_DROP + (kind === "drop" ? DROP_UNDER : 0);
}

export function hemRow(body: BodyType, c: SleeveChoice): number | null {
  const d = draft(body);
  if (c.length === "sleeveless") return null;
  if (c.type === "cap") return d.shoulderPointY + CAP_LENGTH;
  /* an off-shoulder's short sleeve is its band alone, round the middle of the upper arm */
  if (c.type === "off-shoulder" && c.length === "short") return Math.round((d.shoulderPointY + d.elbowY) / 2);
  switch (c.length) {
    case "short":
      return Math.round(d.armpitY + SHORT * (d.elbowY - d.armpitY));
    case "elbow":
      return d.elbowY;
    case "three-quarter":
      return Math.round(d.elbowY + 0.5 * (d.wristY - d.elbowY));
    case "long":
      return d.wristY + OVER_WRIST;
  }
}

/* ---------------------------------------------------------- the coverage */

/** The lowest row of each arm zone — see the limbs in `mannequin/bodies.ts`. */
export const ARM_ZONE_FLOOR: Partial<Record<BodyZone, number>> = {
  upperArm: 318,
  forearm: 496,
};

/**
 * What of the arm a sleeve hides, given the zones the garment claims otherwise.
 *
 * An arm zone stays claimed only if the sleeve spans all of it. Claimed, a zone is cut
 * out of the photograph; a sleeve ending halfway down one would leave the rest
 * of the arm erased with nothing painted over it. Unclaimed, the arm is left
 * where it is and the sleeve is drawn over it — the renderer keeps the forearm
 * that hangs in front of a skirt from being painted back over a sleeve.
 */
export function sleeveCoverage(
  body: BodyType,
  garment: BodyZone[],
  c: SleeveChoice
): BodyZone[] {
  const row = hemRow(body, c);
  /*
    Only ever releases. A zone the garment did not claim stays unclaimed — the
    neckline may already have bared the shoulder, and a long sleeve on a top
    that never claimed the forearm is simply drawn over it.
  */
  return garment.filter((zone) => {
    if (zone === "shoulderCap") return row !== null && c.type !== "cap";
    if (zone === "upperArm" || zone === "forearm")
      return row !== null && c.type !== "cap" && row >= (ARM_ZONE_FLOOR[zone] ?? Infinity);
    return true;
  });
}

/* ------------------------------------------------------------ the shapes */

/**
 * How a sleeve stands off the arm along its length: `t` runs from 0 at the top
 * of the sleeve to 1 at its hem, on the outer edge and the inner edge each.
 */
interface Profile {
  out: (t: number) => number;
  in: (t: number) => number;
  /** Below this on the inner edge, the sleeve is free to swing over the body. */
  free?: number;
  /** How far the head stands above the shoulder point, and how round it is. */
  rise?: number;
  capBow?: number;
}

/**
 * The types an off-shoulder cut offers: its own fitted sleeve — whose short
 * length is the band alone — and the loose sleeves, each hung from the band.
 * Not the types that describe how a sleeve joins the shoulder: that cut has no
 * shoulder seam.
 */
export const BAND_CUT_TYPES: readonly SleeveTypeId[] = ["off-shoulder", "puff", "bishop", "bell", "flutter"];

/** How much shorter a flutter is on the inside of the arm than the outside. */
const FLUTTER_RISE = 16;
/** A set-in sleeve's gathered band, and a bishop's cuff. */
const BAND = 7;
const CUFF = 12;
/**
 * A puff — see `balloon`: how wide it is at its widest, against her arm there;
 * how far down from its top to its band it is widest; how steeply its outline
 * leaves its top and turns in under its band, from 0°, a parabola's, to 90°,
 * level; how far it runs on under the band, and stops inside its edge; how
 * far its band stands off the arm; and how far its inner side bulges past the
 * garment's own sleeve ease.
 */
const PUFF_FULL = 1.5;
const PUFF_WIDEST = 0.5;
const PUFF_CROWN = 90;
const PUFF_LEAVE = 50;
const PUFF_TURN_IN = 80;
const PUFF_TUCK = 2;
const PUFF_INSIDE = 0.5;
const PUFF_BAND_EASE = 2;
const PUFF_IN = 4;
/**
 * A puff's crown: how far in from the shoulder point the top of its dome is,
 * and how far in along the shoulder line the dome comes down onto it, where
 * the sleeve is sewn on.
 */
const PUFF_APEX_IN = 3;
const PUFF_DOME_IN = 9;
/** The little frill below a puff's band: how deep, how far it flares past the band each side, and its ripple. */
const FRILL_DEEP = 5;
const FRILL_FLARE = 2;
const FRILL_RIPPLE = 1.1;
const FRILL_WAVES = 5;
/** The drop shoulder: how far down the arm the seam falls, and the underarm. */
const DROP = 20;
const DROP_UNDER = 14;
/** How far down the trunk a cut-on sleeve's underarm reaches, armpit to waist. */
const KIMONO_DEPTH = 0.35;
const DOLMAN_DEPTH = 0.85;

/** The most a sewn sleeve's outer edge stands off the arm where it is widest. */
const SEWN_EASE = 5;
/** How far it covers the arm's inner side by, from the underarm to the elbow. */
const SEWN_COVER = 0.5;
/** How much looser a drop shoulder's sleeve is, all round, than a set-in one. */
const DROP_LOOSE = 2;
/** How much a long sleeve narrows, underarm to wrist, when its garment does not say. */
const SEWN_TAPER = 0.15;
/** How much of the sleeve's narrowing, underarm to cuff, the outer edge takes. */
const SEWN_OUTER_SHARE = 0.42;
/** How late the narrowing comes: past 1, little by the elbow and most along the forearm. */
const SEWN_TAPER_POWER = 2.2;
/** The shoulder's curve: how far each handle reaches along its leg, at the tip and at the underarm. */
const SEWN_HEAD: readonly [number, number] = [0.45, 0.5];
/**
 * A sleeve hung from a band — see `Frame.hang`: how many rows either side its
 * outside averages the arm's over, which bridges the photograph's steps and
 * keeps its shape; over how many rows below the band it settles from the
 * band's own point onto that line; and how often its edges are walked, closer
 * than a sleeve's twelve, so they follow the arm's turn at the elbow.
 */
const HUNG_SMOOTH = 8;
const HUNG_SETTLE = 12;
const HUNG_PACE = 6;
/**
 * How far it stands off her forearm, from the elbow down: closer than the
 * band's ease. Seen from the front her forearm is wider than her upper arm,
 * and a sleeve that never widens is cut for it all the way up — at the band's
 * ease there too, the extra went to the inner edge and took a unit or two of
 * the daylight under the arm.
 */
const HUNG_FOREARM = 1;
/** How far the cuff is set from the sleeve's centre toward the hand's. */
const CUFF_LEAN = 0.25;
/** How far above its cuff the sleeve starts to gather into it. */
const CUFF_GATHER = 6;
/** How far the sleeve runs on under its cuff, so no hairline shows at the seam. */
const UNDER_CUFF = 3;
/** A plain cuff's depth when the garment does not give one: about 5.3 cm. */
const CUFF_HEIGHT = 28;
/** How much narrower than the sleeve's end a cuff is, when the garment does not say: what it gathers. */
const CUFF_GATHERED = 4;
/**
 * Each cuff as the plain band changed: how much deeper, and how much wider.
 * A French cuff is turned back on itself, so it stands deeper and a little
 * wider; a rib grips the wrist, so it is narrower and gathers more.
 */
const CUFF_CUT: Record<Exclude<CuffId, "none">, { deep: number; wide: number }> = {
  plain: { deep: 1, wide: 0 },
  formal: { deep: 1, wide: 0 },
  french: { deep: 1.25, wide: 2 },
  rib: { deep: 1, wide: -4 },
};
/** Where across a cuff, from its outer side, it closes: the button, the cufflink, the placket above. */
const CUFF_CLOSE = 0.18;
/** A formal cuff's sleeve placket: how wide, and how far it runs up the sleeve. */
const PLACKET_WIDTH = 6;
const PLACKET_LENGTH = 30;
/** How far apart a rib cuff's ribs are. */
const RIB_STEP = 2.4;
/** How much narrower than its sleeve a short sleeve's rib armband is: it hugs the arm a little. */
const ARMBAND_HUG = 3;

/** What a cuff closes with, on one side: buttons, or a cufflink. */
export interface CuffTrim {
  buttons: Pt[];
  links: Pt[];
}
/**
 * The daylight a sewn sleeve keeps from the body: down to the waist, and beside
 * the hip below it, where a hand hangs close. Three is what the approved thobe
 * keeps at its tightest, under the chest.
 */
const BODY_CLEAR = 3;
const HIP_CLEAR = 2;
/** The constructions drafted by `sewn`; the loose sleeves keep their own shapes. */
const SEWN_TYPES: readonly SleeveTypeId[] = ["set-in", "drop", "raglan"];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ramp = (t: number, from: number) => Math.max(0, (t - from) / (1 - from));

/* ------------------------------------------------------------- the frame */

/**
 * What the garment above the armhole is: the two neck corners, the shoulder
 * seams from each out to where the sleeve begins, and the opening between them.
 *
 * A top builds it from its own neckline; the dress takes it from whichever
 * neckline cut it is wearing. Either way the sleeve is joined to the garment's
 * real shoulder — and a raglan sleeve takes that shoulder over.
 */
export interface Frame {
  /** Where each shoulder seam ends and the sleeve begins. */
  tipLeft: Pt;
  tipRight: Pt;
  /**
   * The garment's upper edge, as a run from the right shoulder end over the
   * right shoulder, round the opening and out along the left shoulder to the
   * left shoulder end — whatever the neckline, it is one fragment.
   */
  edge: string;
  /**
   * The same edge in its parts, for a raglan sleeve, which takes the two
   * shoulder seams off the body and onto itself. Absent, raglan is not on offer.
   */
  parts?: {
    neck: Pt;
    neckRight: Pt;
    /** Neck corner out to the left shoulder end. */
    strapLeft: Pt[];
    /** Right shoulder end in to its neck corner. */
    strapRight: Pt[];
    /** The opening, right neck corner round to the left. */
    opening: string;
  };
  /**
   * A sleeve hung from a band round the upper arm — an off-shoulder's — rather
   * than set into an armhole at the shoulder point. It starts at the tip, on
   * the arm, and has no shoulder cap to clear or crown to rise in: a fitted
   * sleeve's outside carries straight on from the band's, at the band's own
   * ease, and follows the arm down, and a puff balloons from the band. Absent,
   * the sleeve starts at the shoulder.
   */
  hang?: { ease: number };
}

export interface SleeveCut {
  /** The body panel — and, for a cut-on sleeve, the sleeves with it. */
  body: string;
  /** Separate sleeve pieces, left then right. Drawn after the body. */
  sleeves: string[];
  /** Bands and cuffs, drawn over their sleeves. */
  bands: string[];
  /** Everything lying over the arm, for the renderer's arm mask. */
  armCover: string[];
  /** Topstitch — only along seams the construction actually has. */
  stitch: string;
  /** Shading that makes volume read: gathers, flare, drape. */
  folds: string[];
  /**
   * The row each sleeve's underarm is at — where its inner edge leaves the
   * body, and where a sleeve's width is measured from. Absent with no sleeve.
   */
  underarm?: number;
  /** The left half's pieces, for a garment that is only sleeved on one side. */
  left: {
    armhole: Pt[];
    side: Pt[];
    hem: Pt[];
    sleeve: string;
    /**
     * A sleeve cut in one with the body, as the panel runs it: down the outside
     * of the arm from the shoulder's end, across the hem, and back up its inner
     * edge, round the underarm and down the side — for a garment cut from the
     * panel's halves, a robe's fronts.
     */
    cutOn?: { out: Pt[]; hem: Pt[]; inner: Pt[]; lower: Pt[] };
    /** A loose sleeve's seam, from the top of its cap to the underarm: what it is sewn along. */
    sewnAlong?: Pt[];
  };
  right: { sleeve: string };
  /** The topstitch of the sleeves alone, without the body's hem: a loose or cut-on sleeve's — a sewn one's is `seamed.sleeveStitch`. */
  sleeveStitch?: string;
  /**
   * A sewn sleeve — set-in, drop or raglan — is sewn on, but the cloth runs on
   * over the seam. So its pieces are outlined only along their free edges, its
   * seams are drawn as shading rather than as the edge of a piece, and it is
   * lit as one surface. Absent — no sleeve, a cut-on one, or one of the loose
   * sleeves — every piece is outlined and lit on its own. See `sewn` in `top`.
   */
  /**
   * A long sleeve's cuff, when it has one: its style and what makes it that
   * style — the soft lines of a French cuff's split and turned-back edge and
   * of a formal cuff's placket, a rib's ribs, the roll of a French cuff's fold,
   * and the hardware each side closes with. Both sides, the left's first.
   */
  cuff?: {
    style: CuffId;
    /** The cuffs' top seams — drawn with `seamed` on a sewn sleeve, from here on one cut on. */
    seams: string[];
    /**
     * Each band's free edges — down its sides and across its foot, not its top,
     * which is a seam. In the order the bands are drawn.
     */
    edges: string[];
    marks: string[];
    ribs: string[];
    folds: Fold[];
    trim: { left: CuffTrim; right: CuffTrim };
  };
  /**
   * The left sleeve's own edges, without the seam it is set along: its outer
   * edge from where it leaves the shoulder down to its hem, the hem across,
   * and its inner edge from the underarm down to the hem — with the topstitch
   * at its hem. For a cut that sets the sleeve some other way: an off-shoulder
   * hangs it from its band, and draws its own seam to the bodice.
   */
  raw?: { outer: Pt[]; hem: Pt[]; inner: Pt[]; stitch: string };
  /** A puff's shape, left sleeve then right, for its light and its gathers — see `PuffShape`. */
  puff?: [PuffShape, PuffShape];
  seamed?: {
    /** Each piece's free edges as open lines, in the order the pieces are drawn. */
    edges: string[];
    /** The armhole or raglan seams and the cuff seams, each a soft line of shadow. */
    seams: string[];
    /** The same for the left sleeve alone, for a garment sleeved on one side. */
    seamsLeft: string[];
    /**
     * The body's free edge below the armholes — side, hem and the other side,
     * from the left underarm round to the right — for a garment that assembles
     * its own body panel and closes it with its own upper edge.
     */
    sides: string;
    /** The sleeve's hem row, and the row both cuffs are sewn at, if it has them. */
    hem: number;
    cuffTop?: number;
    /** The body's elbow and wrist, for the folds down the sleeve. */
    elbowY: number;
    wristY: number;
    /** The sleeves' own topstitch, without the body's hem. */
    sleeveStitch: string;
  };
}

/**
 * A puff sleeve's shape, for the drawing to light it round and gather it — see
 * `puffDrape` in `folds.tsx`. Plain points, so this file stays plain.
 */
export interface PuffShape {
  /**
   * Where its fullness is gathered in at the top, outside to inside: the
   * crown above the shoulder point, both ends the same point — or the band's
   * lower edge over the arm, on an off-shoulder.
   */
  top: [Pt, Pt];
  /** The arm band's top edge, outside to inside: where it is gathered in at the bottom. */
  bottom: [Pt, Pt];
  /** Row by row from its top to the band: the row, its outside, and its own inner side. */
  across: [y: number, outer: number, inner: number][];
  /** The row it is widest at. */
  widest: number;
}

/**
 * A garment's own numbers for its sewn sleeves — see `sewn` in `top`.
 * Everything else about the sleeve comes from the body.
 */
export interface SleeveFinish {
  /**
   * Across a long sleeve where it has finished narrowing: just above its cuff,
   * or at its hem. Absent, `SEWN_TAPER` narrower than it is at the underarm.
   */
  end?: number;
  /**
   * The plain band a long sleeve can be gathered into: its height and its
   * width. Absent, the garment draws no cuff, whatever the choice says.
   */
  cuff?: { height: number; width: number };
  /**
   * Hangs plumb from the shoulder, as a robe's roomy sleeve does, rather than
   * following the arm. Cloth cut close to an arm goes where the arm goes; cut
   * as full as a thobe's it falls straight down from the shoulder, and is
   * cut wide enough to clear the arm's whole sweep — that is its roominess.
   */
  plumb?: boolean;
  /**
   * Room left all round the sleeve worn under this one, over what a sleeve
   * cut to the arm would have: a jacket's.
   */
  over?: number;
  /**
   * How much shorter than a long sleeve a long one is cut, so the end of the
   * sleeve under it shows below it — a jacket's, by about a centimetre.
   */
  reveal?: number;
  /**
   * A short sleeve finished with a knitted rib band this deep, as a polo's
   * is, rather than a turned hem. It hugs the arm a little: `ARMBAND_HUG`
   * narrower than the sleeve where it is sewn on.
   */
  armband?: number;
  /**
   * Hangs in front of its own body rather than clear of it: a robe's, whose
   * body falls wider than the daylight under her arm, so there is no gap
   * between the two to keep — the arm hangs over the robe's side, as it does
   * over an A-line skirt. Absent, the sleeve keeps its daylight to the side
   * seam.
   */
  front?: boolean;
  /**
   * How much fuller a sleeve cut in one with the body is cut, on each side,
   * than its arm and ease: an abaya's kimono, wide and straight. Absent, a
   * kimono is cut as close as a dress's.
   */
  full?: number;
}

export interface TopDraftSpec extends TopSpec {
  /** The two neck points the shoulder seams start from. */
  neck: Pt;
  neckRight: Pt;
  /** How far outside the shoulder its seam is cut: the yoke's ease. */
  shoulderEase: number;
  /** Its sewn sleeves' own numbers — see `SleeveFinish`. */
  finish?: SleeveFinish;
  /**
   * The garment's own edge beside the arm below its hem, where it has one — a
   * dress's skirt, at a row. A sleeve keeps clear of it as it does of the body.
   */
  below?: (y: number) => number;
}

export interface TopDraft {
  /** Where the shoulder seam ends for this sleeve — the sleeve begins there. */
  shoulderEnd(c: SleeveChoice): Pt;
  /** A top's frame: its own shoulders walked out to the sleeve, and its opening. */
  frame(opening: string, c: SleeveChoice): Frame;
  /** The garment, cut for one sleeve, inside one frame — and under a jacket's hem, if it is worn under one. */
  cut(c: SleeveChoice, frame: Frame, inside?: Tuck): SleeveCut;
  /**
   * For a long sleeve drafted elsewhere — an off-shoulder's, which its cut
   * drafts — finished in a cuff as the ones drafted here are. `cuffRows` is
   * where its edges stop and gather, and the row the cuff is sewn at, for a
   * wrist; `cuffEnd` pushes the gather onto the edges and gives the hem under
   * the cuff, the band, and the cuff's seams, marks and hardware for both arms.
   */
  cuffRows(style: Exclude<CuffId, "none">, wrist: number): { gather: number; seam: number };
  cuffEnd(
    style: Exclude<CuffId, "none">,
    outer: Pt[],
    inner: Pt[],
    xo: (y: number) => number,
    xi: (y: number) => number,
    wrist: number
  ): { hemPts: Pt[]; band: Pt[]; stitch: string; cuff: NonNullable<SleeveCut["cuff"]> };
}

/**
 * A top with sleeves — any of them — drafted against one body.
 *
 * Everything below the shoulder seam is here: the armhole or its absence, the
 * side seam, the hem and the sleeves. The shoulder seam and the neckline above
 * it come in as a `Frame`, which is what lets one drafting serve a t-shirt's
 * crew neck and every one of the dress's fifteen cuts.
 */
export function top(body: BodyType, spec: TopDraftSpec): TopDraft {
  const d = draft(body);
  const { tip, ease, hemY, dip = 9 } = spec;
  const [capE] = spec.sleeve ?? [ease, ease + 3];
  const [inTop] = spec.inner ?? [2, 4];
  const W = 600;

  const sides = new Map<number, Pt[]>();
  /* the side seam from a row down, drawn in under a jacket's hem if there is one */
  const sides2 = new Map<string, Pt[]>();
  const sideFrom = (y: number, inside?: Tuck): Pt[] => {
    const key = Math.round(y * 10);
    if (!sides.has(key)) sides.set(key, bodySide(body, spec, y));
    if (!inside) return sides.get(key)!;
    const k2 = `${key}|${inside.y}|${inside.x}`;
    if (!sides2.has(k2)) sides2.set(k2, tucked(sides.get(key)!, inside));
    return sides2.get(k2)!;
  };
  const seamAt = (side: Pt[]) => (y: number): number => {
    if (y <= side[0][1]) return side[0][0];
    for (let i = 1; i < side.length; i++) {
      if (side[i][1] < y) continue;
      const [x0, y0] = side[i - 1];
      const [x1, y1] = side[i];
      return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0);
    }
    return side[side.length - 1][0];
  };
  /** The hem between two points: a shirttail if the garment has one, else a dipped hem. */
  const hemLine = (l: Pt, r: Pt): Pt[] =>
    spec.tail ? shirttail(l, r, spec.tail) : hem(l, r, dip);
  const hemAcross = (side: Pt[]) =>
    hemLine(side[side.length - 1], mirror([side[side.length - 1]])[0]);
  const bodyHemStitch = (side: Pt[]) => {
    const [hx] = side[side.length - 1];
    return line(hemLine([hx + 5, hemY - 8], [W - hx - 5, hemY - 8]));
  };

  /** Rows every twelve units, the pace every sleeve edge in the kit walks at — or at `pace`. */
  const rows = (from: number, to: number, pace = 12): number[] => {
    const n = Math.max(1, Math.round(Math.abs(to - from) / pace));
    return Array.from({ length: n + 1 }, (_, i) => from + ((to - from) * i) / n);
  };

  /** The arm's outside at a row, averaged over the rows around it — see `HUNG_SMOOTH`. */
  const armOutside = (y: number): number => {
    let sum = 0;
    for (let k = -HUNG_SMOOTH; k <= HUNG_SMOOTH; k++) sum += d.armOutAt(y + k, 0);
    return sum / (2 * HUNG_SMOOTH + 1);
  };

  /**
   * A sleeve's two long edges, walked down the arm with `p`'s ease.
   *
   * The inner edge keeps its daylight to the side seam and never comes off the
   * arm — the same two demands `setIn` makes — until `free`, below which a full
   * sleeve is allowed to swing over the body it hangs beside. A garment's own
   * finish can ask more: room over a sleeve worn under it, outside, and a
   * sleeve hanging in front of its body all the way down — see `SleeveFinish`.
   */
  const edges = (topY: number, innerTop: number, cuff: number, p: Profile, side: Pt[], tip?: Pt, fin: SleeveFinish = {}) => {
    const keep = keepOff(side, innerTop);
    const out = rows(topY, cuff).map((y) => {
      const t = (y - topY) / (cuff - topY || 1);
      return [d.armOutAt(y, p.out(t) + (fin.over ?? 0)), y] as Pt;
    });
    if (tip) out[0] = tip;
    const inner = rows(innerTop, cuff).map((y) => {
      const t = (y - innerTop) / (cuff - innerTop || 1);
      const e = p.in(t);
      if (fin.front || (p.free !== undefined && t >= p.free)) return [d.armInAt(y, e), y] as Pt;
      return [keep(d.armInAt(y, e), y), y] as Pt;
    });
    return { out, inner };
  };

  /** A sleeve's inner edge, held off the body below the underarm: the side seam's ease, and the gap as it opens. */
  const keepOff = (side: Pt[], innerTop: number) => {
    const at = seamAt(side);
    return (x: number, y: number): number => {
      const base = Math.min(x, d.sideAt(y, SLEEVE_SEAM_EASE));
      const open = Math.min(1, Math.max(0, y - innerTop) / SLEEVE_GAP_RAMP);
      const wanted = Math.min(base, at(y) - SLEEVE_GAP * open);
      return Math.max(wanted, d.armInAt(y, 0));
    };
  };

  /** A run's x at a row, read along it — it runs down — and held at its ends. */
  const xOnRun = (run: Pt[], y: number): number => {
    if (y <= run[0][1]) return run[0][0];
    for (let i = 1; i < run.length; i++) {
      if (run[i][1] < y) continue;
      const [x0, y0] = run[i - 1];
      const [x1, y1] = run[i];
      return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0 || 1);
    }
    return run[run.length - 1][0];
  };

  /**
   * A round stand-off: from `from` at row `a` out to `most` at row `m`, and
   * back to `to` at row `b`. Each half is an arc of an ellipse, level at `m`
   * and leaving its end as steeply as its angle says — toward 0° the arc of a
   * parabola, at 90° square to the line it stands off.
   */
  const rounded = (a: number, m: number, b: number, from: number, most: number, to: number, rise: number, fall: number) =>
    (y: number): number => {
      const [len, end, deg] = y <= m ? [m - a, from, rise] : [b - m, to, fall];
      const ang = (Math.max(5, deg) * Math.PI) / 180;
      const phi = Math.asin(Math.min(1, Math.abs(y - m) / (len || 1)) * Math.sin(ang));
      return most - ((most - end) * (1 - Math.cos(phi))) / (1 - Math.cos(ang));
    };
  /** The rows a `rounded` outline is walked at: even steps round each arc, so they are close where it turns. */
  const arcRows = (a: number, m: number, b: number, rise: number, fall: number, n = 8): number[] => {
    const half = (len: number, deg: number, sign: number) => {
      const ang = (Math.max(5, deg) * Math.PI) / 180;
      return Array.from({ length: n + 1 }, (_, i) => m + (sign * len * Math.sin((ang * i) / n)) / Math.sin(ang));
    };
    return [...half(m - a, rise, -1).reverse(), ...half(b - m, fall, 1).slice(1)];
  };

  /**
   * A puff, as a real one is: one round balloon.
   *
   * On the outside its outline is one curve, from where its fullness is
   * gathered in at the top — its crown, above the shoulder point, or the band
   * an off-shoulder hangs it from — out to its widest halfway down, half again
   * as wide there as her arm, and back in under the narrow band it is gathered
   * into round the arm. Each half is an arc of an ellipse, level at the widest
   * row and turning in flat under the band. On the inside the same, as far as
   * the body's daylight lets it. Below the band, a little frill.
   *
   * It was drafted as a stand-off from the arm that rose to full at once and
   * held there, so it had straight sides, and turned a corner onto a flat
   * hem a step outside its band.
   *
   * Hung from a band, its top is where it leaves the band, and the cut that
   * hangs it eases it off the band's line — see `blendOuter` in the dress.
   */
  const balloon = (f: Frame, start: Pt, capTop: Pt, under3: Pt, seamLine: Pt[], cuff: number, side: Pt[]) => {
    const U = under3[1];
    const bTop = cuff - BAND;
    const end = bTop + PUFF_TUCK;
    const hung = f.hang !== undefined;
    /*
      Its crown: a low dome over the shoulder point, coming down onto the
      shoulder line a little way in, where it is sewn on — and from there the
      armhole down to the underarm. Run up the armhole to its top, the sleeve
      came to a point there.
    */
    const apex: Pt = [start[0] + PUFF_APEX_IN, capTop[1]];
    const strap = f.parts?.strapLeft ?? [];
    const domeX = start[0] + PUFF_DOME_IN;
    /* where the shoulder line passes that far in: it runs from the neck out to the shoulder point */
    let onShoulder: Pt = [domeX, start[1] - 2];
    for (let i = 1; i < strap.length; i++) {
      const [x0, y0] = strap[i - 1];
      const [x1, y1] = strap[i];
      if (x0 !== x1 && (x0 - domeX) * (x1 - domeX) <= 0) onShoulder = [domeX, y0 + ((y1 - y0) * (domeX - x0)) / (x1 - x0)];
    }
    const seam = hung ? seamLine : seamCurve(onShoulder, under3, SLEEVE_SCYE_BOW, 9);
    /* level at its top, landing on the shoulder line */
    const c1: Pt = [apex[0] + 0.55 * (onShoulder[0] - apex[0]), apex[1]];
    const c2: Pt = [onShoulder[0], onShoulder[1] - 0.55 * (onShoulder[1] - apex[1])];
    const dome: Pt[] = Array.from({ length: 7 }, (_, i) => {
      const t = i / 6;
      const m = 1 - t;
      return [
        m * m * m * apex[0] + 3 * m * m * t * c1[0] + 3 * m * t * t * c2[0] + t * t * t * onShoulder[0],
        m * m * m * apex[1] + 3 * m * m * t * c1[1] + 3 * m * t * t * c2[1] + t * t * t * onShoulder[1],
      ] as Pt;
    });
    const top: Pt = hung ? start : apex;

    /* the inner edge: from the underarm, round, into the band's inner corner */
    const keep = keepOff(side, U);
    const inMid = U + PUFF_WIDEST * (end - U);
    const inStand = rounded(U, inMid, end, under3[0] - d.armInAt(U, 0), inTop + PUFF_IN, PUFF_BAND_EASE - PUFF_INSIDE, PUFF_LEAVE, PUFF_TURN_IN);
    const inner = arcRows(U, inMid, end, PUFF_LEAVE, PUFF_TURN_IN).map((y) => [keep(d.armInAt(y, inStand(y)), y), y] as Pt);

    /* its own inner side above the underarm: the armhole — or, hung, the band's lower edge and the raglan seam */
    const seamTop: Pt = hung && f.parts ? f.parts.neck : apex;
    const crownRun = [...dome, ...seam.slice(1)];
    const headAt = (y: number): number =>
      !hung ? xOnRun(crownRun, y) : y <= seamTop[1] ? xOnRun([start, seamTop], y) : xOnRun([seamTop, under3], y);
    const insideAt = (y: number) => (y >= U ? xOnRun(inner, y) : headAt(y));

    /*
      The outside: off a line down the arm, leaning as the arm does, out to
      half again her arm's width — level over its crown, a dome, or leaving a
      band as steeply as the band lets it, see `blendOuter`.
    */
    const leave = hung ? PUFF_LEAVE : PUFF_CROWN;
    const widest = top[1] + PUFF_WIDEST * (bTop - top[1]);
    const lean = (armOutside(end) - armOutside(widest)) / (end - widest || 1);
    const axis = (y: number) => armOutside(widest) + lean * (y - widest);
    /* measured to its inner side where that bulges most: above the underarm its inner side is the armhole */
    const fullX = Math.max(...inner.map(([x]) => x)) - PUFF_FULL * (d.armInAt(widest, 0) - d.armOutAt(widest, 0));
    const stand = rounded(
      top[1],
      widest,
      end,
      axis(top[1]) - top[0],
      axis(widest) - fullX,
      axis(end) - (d.armOutAt(end, PUFF_BAND_EASE) + PUFF_INSIDE),
      leave,
      PUFF_TURN_IN
    );
    const out = arcRows(top[1], widest, end, leave, PUFF_TURN_IN).map((y) => [axis(y) - stand(y), y] as Pt);
    out[0] = top;

    /* the band round the arm, and the frill below it, one piece */
    const bo: Pt = [d.armOutAt(bTop, PUFF_BAND_EASE), bTop];
    const bi: Pt = [Math.max(d.armInAt(bTop, PUFF_BAND_EASE), d.armInAt(bTop, 0)), bTop];
    const co: Pt = [d.armOutAt(cuff, PUFF_BAND_EASE), cuff];
    const ci: Pt = [d.armInAt(cuff, PUFF_BAND_EASE), cuff];
    const frill: Pt[] = Array.from({ length: FRILL_WAVES * 8 + 1 }, (_, i) => {
      const t = i / (FRILL_WAVES * 8);
      return [
        lerp(co[0] - FRILL_FLARE, ci[0] + FRILL_FLARE, t),
        cuff + FRILL_DEEP - FRILL_RIPPLE * Math.cos(t * Math.PI * 2 * FRILL_WAVES),
      ] as Pt;
    });
    const band: Pt[] = [bo, co, ...frill, ci, bi, ...span(bi, bo, 4).slice(1, -1)];
    /* the stitching that holds the frill on below the band */
    const stitch = line(span([co[0] + 1.5, cuff - 1], [ci[0] - 1.5, cuff - 1], 3));

    const across: PuffShape["across"] = [];
    for (let y = top[1]; y <= bTop; y += 2) across.push([y, xOnRun(out, y), insideAt(y)]);
    const left: PuffShape = { top: [top, hung ? seamTop : top], bottom: [bo, bi], across, widest };
    const flip = (q: Pt): Pt => [W - q[0], q[1]];
    const right: PuffShape = {
      top: [flip(left.top[0]), flip(left.top[1])],
      bottom: [flip(bo), flip(bi)],
      across: across.map(([y, o, i]) => [y, W - o, W - i]),
      widest,
    };
    /* from the underarm up the armhole and over the crown, for the sleeve's outline; and the seam alone */
    const head = hung ? reverse(seamLine) : reverse(crownRun);
    return { out, inner, band, stitch, head, seam, shape: [left, right] as [PuffShape, PuffShape] };
  };

  /**
   * A sleeve hung as a tube from the shoulder.
   *
   * A sleeve is widest at the underarm and tapers to the wrist; it bridges the
   * forearm rather than following it. It used to walk the arm's own outline
   * plus ease, and on both photographs the forearm is broader seen from the
   * front than the upper arm — 50 units against 39 on him — so every long
   * sleeve swelled below the elbow: 48 units across at his upper arm, 61 under
   * the elbow and 40 at the wrist, which is a puff sleeve.
   *
   * From the edges `edges` walked — the arm plus the garment's ease:
   *
   * 1. **The inner edge** is pulled taut against the arm's inner side, so it
   *    bridges the hollows instead of tracing them, and is kept off the body
   *    by the arm gap.
   * 2. **The width** at each row is what reaches the walked outer edge from
   *    there. It is made never to grow — each row at least as wide as any row
   *    below it — and then the tightest straight runs above that: the sleeve
   *    holds its width from the underarm down to wherever the arm needs most,
   *    and tapers from there in straight lines that only steepen.
   * 3. **The outer edge** is the inner edge less that width, so whatever the
   *    forearm adds goes outward, away from the body, and the gap is untouched.
   * 4. **The head** joins its top by the tightest line outside both. Only its
   *    top: joined to the whole tube, the line bridged the slight bow the arm
   *    gap puts in the inner edge below the underarm, and widened the middle.
   *
   * Because the forearm is the widest thing on the arm, a sleeve that never
   * widens stands a little clear of the upper arm: about 11 units past his
   * deltoid at the underarm, which is the bicep room any sleeve is cut with.
   */
  const hang = (out: Pt[], inner: Pt[], gapAt: (y: number) => number) => {
    const top = inner[0][1];
    const outAt = (y: number): number => {
      if (y <= out[0][1]) return out[0][0];
      for (let i = 1; i < out.length; i++) {
        if (out[i][1] < y) continue;
        const [ax, ay] = out[i - 1];
        const [bx, by] = out[i];
        return ax + ((bx - ax) * (y - ay)) / (by - ay || 1);
      }
      return out[out.length - 1][0];
    };

    /* 1 — the inner edge, taut toward the body and held off it */
    const toward = taut(inner.map(([x, y]) => [600 - x, y] as Pt));
    const inn: Pt[] = toward.map(([x, y]) => [Math.min(600 - x, gapAt(y)), y]);

    /* 2 — the width each row needs, never growing, in straight runs */
    const need = inn.map(([x, y]) => x - outAt(y));
    const held = need.map((_, i) => Math.max(...need.slice(i)));
    const hull: Pt[] = [];
    inn.forEach(([, y], i) => {
      const q: Pt = [y, held[i]];
      while (hull.length >= 2) {
        const [p, r] = [hull[hull.length - 2], hull[hull.length - 1]];
        if ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0]) >= 0) hull.pop();
        else break;
      }
      hull.push(q);
    });
    const width = (y: number): number => {
      for (let i = 1; i < hull.length; i++) {
        if (hull[i][0] < y) continue;
        const [y0, w0] = hull[i - 1];
        const [y1, w1] = hull[i];
        return w0 + ((w1 - w0) * (y - y0)) / (y1 - y0 || 1);
      }
      return hull[hull.length - 1][1];
    };

    /* 3 — the outer edge: the extra goes outward */
    const tube: Pt[] = inn.map(([x, y]) => [x - width(y), y]);

    /* 4 — the head, joined to the tube's top by the tightest line outside both */
    const head = out.filter(([, y]) => y < top);
    return { out: [...taut([...head, tube[0]]), ...tube.slice(1)], inner: inn };
  };

  const linear = (a: number, b: number) => (t: number) => lerp(a, b, t);
  const PROFILES: Partial<Record<SleeveTypeId, Profile>> = {
    /* Full at the crown and over the upper arm, gathered back into a band. */
    puff: {
      out: (t) => capE + 9 * Math.sin(Math.PI * Math.min(t, 1)) ** 0.8,
      in: (t) => inTop + 4 * Math.sin(Math.PI * Math.min(t, 1)),
      /* the crown rises; the seam it is gathered into is the armhole itself */
      rise: 7,
    },
    /* Fullness growing down the arm, blousing over a cuff at the wrist. */
    bishop: {
      out: (t) => capE + 15 * Math.min(1, t / 0.9) ** 1.6,
      in: (t) => inTop + 8 * Math.min(1, t / 0.9) ** 1.6,
      free: 0.45,
    },
    /* Fitted to the elbow, then flaring: the bell is the hem, not the head. */
    bell: {
      out: (t) => capE + 18 * ramp(t, 0.45) ** 1.3,
      in: (t) => inTop + 11 * ramp(t, 0.45) ** 1.3,
      free: 0.45,
    },
    /* Cut on the circle: it flares a little as it falls, and ripples at the hem. */
    flutter: { out: (t) => capE + 1 + 9 * t ** 1.3, in: linear(inTop + 1, inTop + 3) },
  };

  const shoulderEnd = (c: SleeveChoice): Pt => {
    if (c.length === "sleeveless") return tip;
    if (c.type === "drop") {
      const y = d.shoulderPointY + DROP;
      return [d.armOutAt(y, spec.shoulderEase), y];
    }
    if (c.type === "cap") {
      const y = d.shoulderPointY + CAP_LENGTH;
      return [d.armOutAt(y, spec.shoulderEase + 1), y];
    }
    return tip;
  };

  const frame = (opening: string, c: SleeveChoice): Frame => {
    const end = shoulderEnd(c);
    const strapLeft = d.shoulder(spec.neck, end, spec.shoulderEase);
    const strapRight = reverse(mirror(strapLeft));
    strapRight[strapRight.length - 1] = spec.neckRight;
    return {
      tipLeft: end,
      tipRight: strapRight[0],
      edge: `${run(strapRight)} ${opening} ${run(strapLeft)}`,
      parts: { neck: spec.neck, neckRight: spec.neckRight, strapLeft, strapRight, opening },
    };
  };

  /** Body with an armhole, closed by the frame: the set-in family, drop, cap. */
  const armholeBody = (f: Frame, armhole: Pt[], side: Pt[]) =>
    `M${f.tipLeft[0]} ${f.tipLeft[1]} ` +
    `${run(armhole, side, hemAcross(side), mirror(reverse(side)), mirror(reverse(armhole)))} ` +
    `L${f.tipRight[0]} ${f.tipRight[1]} ${f.edge} Z`;

  /** A hem across a sleeve, and the topstitch eight units above it. */
  /**
   * A cuff on a long sleeve's end, any style: the sleeve curves in over its
   * last few units to the band's corners and runs on under it — pushed onto
   * `outer` and `inner` — and the band stands from `C` to the wrist, set
   * between the sleeve's centre and the hand's. Then what makes it its style:
   *
   * - **plain**: a band with a row of topstitch near its foot.
   * - **formal**: the same, closed with one button near its outer side, under
   *   a short placket running up the sleeve.
   * - **french**: deeper and turned back on itself — the edge of the turned
   *   back half just under the seam, a soft roll where it folds at the wrist —
   *   its two ends meeting edge to edge and held with a cufflink.
   * - **rib**: a narrower knitted band, ribbed down its depth, no topstitch.
   *
   * The left sleeve's; the caller reflects it.
   */
  const cuffOn = (
    style: Exclude<CuffId, "none">,
    outer: Pt[],
    inner: Pt[],
    xo: (y: number) => number,
    xi: (y: number) => number,
    C: number,
    wrist: number,
    width: number,
    clear?: number
  ) => {
    const h = wrist - C;
    /*
      Set between the sleeve's centre and the hand's — and, given `clear`, no
      further in than leaves its outer side that far outside the wrist: a sleeve
      hung close to the arm is close to it at the cuff, and set toward the hand
      the cuff's outer side fell inside the wrist.
    */
    const toward = lerp((xo(C) + xi(C)) / 2, (d.armOutAt(wrist, 0) + d.armInAt(wrist, 0)) / 2, CUFF_LEAN);
    const centre = clear === undefined ? toward : Math.min(toward, d.armOutAt(wrist, clear) + width / 2);
    const [cl, cr] = [centre - width / 2, centre + width / 2];
    /* the gather: the sleeve curves in to the band's corners and runs on under it */
    const mid = C - CUFF_GATHER / 2;
    outer.push([lerp(xo(mid), cl, 0.35), mid], [cl, C], [cl, C + UNDER_CUFF]);
    inner.push([lerp(xi(mid), cr, 0.35), mid], [cr, C], [cr, C + UNDER_CUFF]);
    const hemPts = span([cl, C + UNDER_CUFF], [cr, C + UNDER_CUFF], 3);
    const band = [
      ...span([cl, C], [cl, wrist], 3),
      ...span([cl, wrist], [cr, wrist], 4).slice(1),
      ...span([cr, wrist], [cr, C], 3).slice(1),
    ];
    const seam = line(span([cl, C], [cr, C], 3));
    const close = cl + CUFF_CLOSE * width;
    const stitch: string[] = [];
    const marks: string[] = [];
    const ribs: string[] = [];
    const folds: Fold[] = [];
    const buttons: Pt[] = [];
    const links: Pt[] = [];
    if (style !== "rib") stitch.push(line(span([cl + 3, wrist - 4], [cr - 3, wrist - 4], 3)));
    if (style === "formal") {
      buttons.push([close, C + h / 2]);
      const [p0, p1] = [close - PLACKET_WIDTH / 2, close + PLACKET_WIDTH / 2];
      const top = C - PLACKET_LENGTH;
      marks.push(line([[p0, C], [p0, top], [close, top - 4], [p1, top], [p1, C]]));
      stitch.push(line([[p0 + 1.5, C - 1], [p0 + 1.5, top + 1], [close, top - 2], [p1 - 1.5, top + 1], [p1 - 1.5, C - 1]]));
      folds.push({ ridge: [[close, C - 2], [close, top]], width: [2, 2], shadow: 0, light: 0.25, soft: 1 });
    }
    if (style === "french") {
      links.push([close, C + h / 2]);
      marks.push(line(span([close, C + 2], [close, wrist - 2], 3)));
      marks.push(line(span([cl + 1, C + 4], [cr - 1, C + 4], 3)));
      folds.push({ ridge: span([cl + 2, wrist - 4], [cr - 2, wrist - 4], 4), width: [3, 3], shadow: 0.18, light: 0.3, soft: 2 });
    }
    if (style === "rib") {
      for (let x = cl + RIB_STEP; x < cr - 1; x += RIB_STEP) ribs.push(line([[x, C + 1.5], [x, wrist - 1.5]]));
    }
    return { hemPts, band, seam, stitch: stitch.join(" "), marks, ribs, folds, trim: { buttons, links } };
  };

  /** A cuff's marks for both sides, and its hardware on each, from the left's. */
  const bothCuffs = (style: CuffId, seam: string, cf: ReturnType<typeof cuffOn>): NonNullable<SleeveCut["cuff"]> => ({
    style,
    seams: [seam, mirrorLine(seam)],
    edges: [line(cf.band), mirrorLine(line(cf.band))],
    marks: [...cf.marks, ...cf.marks.map(mirrorLine)],
    ribs: [...cf.ribs, ...cf.ribs.map(mirrorLine)],
    folds: [...cf.folds, ...cf.folds.map((f2) => ({ ...f2, ridge: mirror(f2.ridge) }))],
    trim: {
      left: cf.trim,
      right: { buttons: mirror(cf.trim.buttons), links: mirror(cf.trim.links) },
    },
  });

  const plainHem = (out: Pt[], inner: Pt[], cuff: number) => {
    const o = out[out.length - 1];
    const i = inner[inner.length - 1];
    return {
      pts: span(o, i, 3),
      stitch: line(span([o[0] + 4, cuff - 8], [i[0] - 3, cuff - 8], 3)),
    };
  };

  /**
   * A sewn sleeve: set-in, drop shoulder or raglan, on every top and on both
   * bodies. It was the thobe's, approved there, and is now everyone's.
   *
   * The tube every top used to hang reached the underarm by the tightest line
   * from the shoulder point, bent there and dropped straight to the wrist, and
   * narrowed on its inner edge alone, below the forearm. Lit and outlined as a
   * piece of its own, that read as a puffed head on a pinched wrist. This
   * sleeve is drafted from its edges instead, each a smooth curve:
   *
   * - **The outer edge** leaves the shoulder end along the shoulder seam and
   *   rounds over the deltoid, on one cubic, into a line that stands
   *   `SEWN_EASE` — or the garment's own sleeve ease, if less — off the arm
   *   where the arm is widest over the rows the sleeve covers. From the
   *   underarm it comes in, a little and late, all the way to the hem or cuff.
   * - **The inner edge** keeps to the arm's inner side from the underarm to
   *   the forearm's widest row, which is what it has to cover there, and then
   *   tapers evenly.
   * - **The width** between them never grows: the outer edge only ever comes
   *   in, and the inner edge is held and then comes in. The two share the
   *   narrowing down to the end width, the outer edge taking `SEWN_OUTER_SHARE`.
   * - **A long sleeve** ends one of two ways, as its `cuff` says. Without one
   *   it narrows to its end width at its hem and stops there, in a plain hem.
   *   With a plain cuff it narrows to it at the cuff instead, and curves in
   *   over its last few units into a band `cuff.width` across and
   *   `cuff.height` tall, set between the sleeve's centre and the hand's.
   * - **Shorter lengths** are drafted the same way and cut at their row, but
   *   clear only the arm they cover: a short sleeve is not cut wide enough
   *   for a forearm it never reaches.
   *
   * The three constructions differ only where the sleeve meets the body. A
   * set-in sleeve is sewn along the armhole from the shoulder point; a drop
   * shoulder's seam is further down the arm and its underarm lower, and it is
   * cut `DROP_LOOSE` fuller; a raglan carries the shoulder from the neck and
   * is sewn along a diagonal to the underarm. The body runs on under all
   * three, so no seam is ever two edges meeting.
   */
  const sewn = (c: SleeveChoice, f: Frame, cuff: number, inside?: Tuck): SleeveCut => {
    const kind = SLEEVE_KINDS[c.type].construction;
    const drop = kind === "drop";
    const raglan = kind === "raglan";
    if (raglan && !f.parts) throw new Error("a raglan sleeve needs the frame's shoulder seams");
    const start = f.tipLeft;
    const under = drop ? d.underarm(ease, SLEEVE_UNDERARM_DROP + DROP_UNDER) : d.underarm(ease);
    const U = under[1];
    const side = sideFrom(U, inside);
    const fin = spec.finish ?? {};
    const wrist = hemRow(body, { type: "set-in", length: "long" })! - (fin.reveal ?? 0);
    const style = c.length === "long" && c.cuff && c.cuff !== "none" ? c.cuff : null;
    const cuffed = style !== null;
    /* a short sleeve's rib armband, if the garment finishes it with one: from here to the hem */
    const armTop = c.length === "short" && fin.armband ? cuff - fin.armband : null;
    const cuffH = style ? Math.round((fin.cuff?.height ?? CUFF_HEIGHT) * CUFF_CUT[style].deep) : 0;
    /* where the sleeve has narrowed to its end width: the cuff's seam, or the hem */
    const C = cuffed ? wrist - cuffH : wrist;
    /* the last row of the sleeve's own cloth: its hem, or the cuff's seam */
    const reach = Math.min(cuff, C);
    const loose = drop ? DROP_LOOSE : 0;

    /* the forearm's widest row: the sleeve holds its width down to here */
    let H = d.elbowY;
    for (let y = d.elbowY; y <= C; y += 2) {
      if (d.armInAt(y, 0) - d.armOutAt(y, 0) > d.armInAt(H, 0) - d.armOutAt(H, 0)) H = y;
    }

    /* the inner edge, held over the arm's inner side, then tapering */
    let held = under[0];
    for (let y = U; y <= Math.min(H, reach); y += 2) held = Math.max(held, d.armInAt(y, SEWN_COVER + loose));
    const g = (y: number) => Math.max(0, Math.min(1, (y - U) / (C - U))) ** SEWN_TAPER_POWER;
    const h = (y: number) => Math.max(0, Math.min(1, (y - H) / (C - H))) ** 1.25;

    /*
      The lean: how far the sleeve's line moves out a row, both edges
      together, so its width is untouched by it.

      A sleeve cut close follows the arm, and both arms lean out from the
      shoulder to the wrist — hers far more, past a waist and a hip that come
      in under the sleeve. Held upright, a close sleeve has to be cut wide
      enough for the arm's whole sweep: on her that was 57 units round a
      39-unit arm, and it ran into her waist. A robe's hangs plumb, `plumb`,
      and is wide on purpose. Whichever it does, the arm wins: the sleeve
      leans no further out than still covers the arm's inner side. Then the
      body: it leans as far as it must to keep clear of the body — `BODY_CLEAR`
      of daylight down to the waist and `HIP_CLEAR` beside the hip, where a
      hand hangs close — and of the garment's own skirt, if it has one.
    */
    const seam = seamAt(side);
    const edgeAt = (y: number) => (spec.below && y > hemY ? Math.min(seam(y), spec.below(y)) : seam(y));
    /* a sleeve that hangs in front of its body has no daylight to keep from it — see `front` */
    const clear = (y: number) => (fin.front ? Infinity : edgeAt(y) - (y <= d.waistY ? BODY_CLEAR : HIP_CLEAR));
    /* the arm's own lean: its centre's slope, fitted over the rows the sleeve covers */
    let follow = 0;
    if (!fin.plumb) {
      let n = 0, sy = 0, sx = 0, syy = 0, sxy = 0;
      for (let y = U; y <= reach; y += 2) {
        const x = (d.armOutAt(y, 0) + d.armInAt(y, 0)) / 2;
        n++; sy += y; sx += x; syy += y * y; sxy += x * y;
      }
      const den = n * syy - sy * sy;
      follow = den > 0 ? Math.min(0, (n * sxy - sx * sy) / den) : 0;
    }
    /*
      Room over a sleeve worn under it goes on the outside. The inside keeps to
      the arm as any sleeve does: a jacket's sleeve over a shirt's still has
      to leave daylight under the arm, and the shirt's inner edge, inside it,
      is hidden by the jacket — see `Encloses`.
    */
    const outEase = Math.min(capE, SEWN_EASE) + loose + (fin.over ?? 0);
    let lean = 0;
    let outU = Infinity;
    let inBy = 0;
    let outBy = 0;
    let endWidth = 0;
    /* the lean and the widths depend on each other; three passes settle them */
    for (let pass = 0; pass < 3; pass++) {
      outU = Infinity;
      for (let y = U; y <= reach; y += 2) outU = Math.min(outU, d.armOutAt(y, outEase) - lean * (y - U));
      const end = fin.end ?? (held - outU) * (1 - SEWN_TAPER);
      endWidth = end;
      const narrowing = Math.max(0, held - outU - end);
      inBy = (1 - SEWN_OUTER_SHARE) * narrowing;
      outBy = SEWN_OUTER_SHARE * narrowing;
      let clearLean = 0;
      let coverLean = -Infinity;
      for (let y = U + 2; y <= reach; y += 2) {
        /* below the gap's ramp only: above it the sleeve and the body meet at the seam,
           and a lean read off a few rows would swing the whole sleeve for a fraction of a unit */
        if (y >= U + SLEEVE_GAP_RAMP) clearLean = Math.min(clearLean, (clear(y) + inBy * h(y) - held) / (y - U));
        const cover = d.armInAt(y, y <= H ? SEWN_COVER + loose : 0);
        coverLean = Math.max(coverLean, (cover + inBy * h(y) - held) / (y - U));
      }
      lean = Math.max(coverLean, Math.min(clearLean, follow));
    }
    const leaning = (y: number) => outU + lean * (y - U) + outBy * g(y);
    const innerLine = (y: number) => held + lean * (y - U) - inBy * h(y);
    /*
      Where no lean both covers the arm and clears the body — her arm bends in
      at the elbow and swings out toward a hip that comes out to meet it, and
      a jacket is cut fuller than a blouse — the inner edge steps in beside the
      hip by what it lacks, and stays in below, so the sleeve only narrows.
      Wherever the lean already clears, this is nothing.
    */
    const stepRows: [number, number][] = [];
    let stepIn = 0;
    for (let y = U + SLEEVE_GAP_RAMP; y <= reach + 2; y += 2) {
      stepIn = Math.max(stepIn, innerLine(y) - clear(y));
      stepRows.push([y, stepIn]);
    }
    const stepAt = (y: number): number => {
      if (stepRows.length === 0 || y <= stepRows[0][0]) return 0;
      const i = Math.min(stepRows.length - 1, Math.floor((y - stepRows[0][0]) / 2));
      return stepRows[i][1];
    };
    /* the arm wins where the two conflict: a sleeve may never come off the arm it covers */
    const leaningIn = (y: number) => Math.max(innerLine(y) - stepAt(y), d.armInAt(y, 0));

    /*
      Hung from a band round the upper arm — see `Frame.hang` — the sleeve has
      no shoulder cap to clear, so its outside does not stand off to the line
      above: it carries straight on from the band's end at the band's own ease
      and follows the arm down, its turn at the elbow and all. Drafted to the
      line, it slanted out below the band to the width a sleeve from the
      shoulder needs, and left a triangle of cloth beside the arm.

      The inner edge is the width from there, which is what never grows: each
      row is as wide as the widest the arm needs at or below it — her forearm,
      seen from the front, is the widest of it — and below the forearm it
      narrows as every sleeve does. The body's daylight holds it in, as above.
    */
    let hung: { xo: (y: number) => number; xi: (y: number) => number; end: number } | null = null;
    if (f.hang) {
      const band = f.hang.ease;
      /* the band's ease down the upper arm, closing to the forearm's from the elbow to its widest */
      const off = (y: number) => {
        const u = Math.max(0, Math.min(1, (y - d.elbowY) / Math.max(1, H - d.elbowY)));
        return band + (HUNG_FOREARM - band) * u * u * (3 - 2 * u);
      };
      const settle = start[0] - (armOutside(start[1]) - band);
      const hungOut = (y: number) => {
        const u = Math.max(0, Math.min(1, (y - start[1]) / HUNG_SETTLE));
        return armOutside(y) - off(y) + settle * (1 - u * u * (3 - 2 * u));
      };
      const grid: number[] = [];
      for (let y = U; y <= reach; y++) grid.push(y);
      const need = grid.map((y) => d.armInAt(y, y <= H ? SEWN_COVER + loose : 0) - hungOut(y));
      /* the most any row at or below needs */
      const below = [...need];
      for (let i = below.length - 2; i >= 0; i--) below[i] = Math.max(below[i], below[i + 1]);
      const widest = below[0];
      const end = fin.end ?? widest * (1 - SEWN_TAPER);
      let most = Infinity;
      const innerAt = grid.map((y, i) => {
        let x = hungOut(y) + Math.max(widest - (widest - end) * h(y), below[i]);
        if (y >= U + SLEEVE_GAP_RAMP) x = Math.min(x, clear(y));
        /* held in by the body, it stays in below: narrower, never wider again */
        most = Math.min(most, x - hungOut(y));
        return Math.max(hungOut(y) + most, d.armInAt(y, 0));
      });
      const hungIn = (y: number) => {
        const k = Math.max(0, Math.min(grid.length - 1, y - U));
        const i = Math.min(grid.length - 2, Math.floor(k));
        return i < 0 ? innerAt[0] : innerAt[i] + (innerAt[i + 1] - innerAt[i]) * (k - i);
      };
      hung = { xo: hungOut, xi: hungIn, end };
    }
    const xo = hung ? hung.xo : leaning;
    const xi = hung ? hung.xi : leaningIn;

    /* the shoulder: one cubic from the shoulder end, along the shoulder seam, to the line */
    const strap = f.parts?.strapLeft ?? [start];
    const before = strap[Math.max(0, strap.length - 3)];
    const len = Math.hypot(start[0] - before[0], start[1] - before[1]) || 1;
    const t0: Pt = [(start[0] - before[0]) / len, (start[1] - before[1]) / len];
    const line0: Pt = [outU, U];
    const a = SEWN_HEAD[0] * (start[0] - line0[0]);
    const b = SEWN_HEAD[1] * (line0[1] - start[1]);
    const p1: Pt = [start[0] + a * t0[0], start[1] + a * t0[1]];
    /* arriving along the line, leaning as it leans */
    const p2: Pt = [line0[0] - b * lean, line0[1] - b];
    /* hung from a band, there is no shoulder: the outside runs on down the arm from the band's end */
    const head = hung
      ? [start, ...rows(start[1], U, HUNG_PACE).slice(1).map((y) => [xo(y), y] as Pt)]
      : Array.from({ length: 13 }, (_, i) => {
          const t = i / 12;
          const m = 1 - t;
          return [
            m ** 3 * start[0] + 3 * m * m * t * p1[0] + 3 * m * t * t * p2[0] + t ** 3 * line0[0],
            m ** 3 * start[1] + 3 * m * m * t * p1[1] + 3 * m * t * t * p2[1] + t ** 3 * line0[1],
          ] as Pt;
        });

    /* down the arm, to the hem — or to the cuff, gathering in over the last few units */
    const bandTop = cuffed ? C : armTop;
    const bottom = bandTop ?? cuff;
    const pace = hung ? HUNG_PACE : 12;
    const outer = rows(U, bottom - (bandTop !== null ? CUFF_GATHER : 0), pace).slice(1).map((y) => [xo(y), y] as Pt);
    const inner = rows(U, bottom - (bandTop !== null ? CUFF_GATHER : 0), pace).map((y) => [xi(y), y] as Pt);
    inner[0] = hung ? [xi(U), U] : [held, U];

    let hemPts: Pt[];
    let cuffBand: Pt[] = [];
    let cuffStitch = "";
    let cuffSeam = "";
    let cuffParts: ReturnType<typeof cuffOn> | null = null;
    if (style) {
      /*
        Narrower than the sleeve where it is sewn on, by what it gathers — the
        sleeve as it actually is there, which beside her hip is narrower than
        the width it was tapering to. Cut to that width, her cuffs stood out
        past the sleeve above them.
      */
      const at = Math.min(hung ? hung.end : endWidth, xi(C) - xo(C));
      const width = (fin.cuff?.width ?? at - CUFF_GATHERED) + CUFF_CUT[style].wide;
      cuffParts = cuffOn(style, outer, inner, xo, xi, C, wrist, width, hung ? HUNG_FOREARM : undefined);
      hemPts = cuffParts.hemPts;
      cuffBand = cuffParts.band;
      cuffStitch = cuffParts.stitch;
      cuffSeam = cuffParts.seam;
    } else if (armTop !== null) {
      /* the armband: a rib band round the arm, sewn on where the sleeve ends */
      cuffParts = cuffOn("rib", outer, inner, xo, xi, armTop, cuff, xi(armTop) - xo(armTop) - ARMBAND_HUG);
      hemPts = cuffParts.hemPts;
      cuffBand = cuffParts.band;
      cuffSeam = cuffParts.seam;
    } else {
      const o: Pt = [xo(cuff), cuff];
      const i: Pt = [xi(cuff), cuff];
      outer.push(o);
      inner.push(i);
      hemPts = span(o, i, 3);
      cuffStitch = line(span([o[0] + 4, cuff - 8], [i[0] - 3, cuff - 8], 3));
    }

    /*
      The seam the sleeve is set along — the armhole from the shoulder end, or
      a raglan's diagonal from the neck — and the run of shoulder a raglan
      carries above it, from the neck out to the shoulder end.
    */
    const fp = f.parts;
    const seamLine = raglan ? seamCurve(fp!.neck, under, 2, 9) : seamCurve(start, under, SLEEVE_SCYE_BOW, 9);
    const shoulder = raglan ? fp!.strapLeft.slice(0, -1) : [];
    const outRun = [...shoulder, ...head, ...outer];
    const sleeve = [...outRun, ...hemPts.slice(1, -1), ...reverse(inner), ...reverse(seamLine).slice(0, -1)];
    /* the right sleeve: the left reflected, but joined to the right neck point */
    const sleeveRight = mirror(sleeve);
    const seamRight = mirror(seamLine);
    if (raglan) {
      sleeveRight[0] = fp!.neckRight;
      seamRight[0] = fp!.neckRight;
    }
    const left = outline(sleeve);
    const right = outline(sleeveRight);
    const banded = cuffBand.length > 0;
    const bands = banded ? [outline(cuffBand), outline(mirror(cuffBand))] : [];

    /*
      The body runs on under the sleeve, out to its outer edge. Cut to the
      seam, the body and the sleeve both ended on it, and each piece's weave
      is displaced a little at its edge — so the seam showed as a hairline of
      the page between them, a pale ring round the shoulder. A raglan's body
      keeps its shoulders under the sleeve for the same reason.
    */
    const underSleeve = [...head, ...span(head[head.length - 1], under, 6).slice(1)];
    const panel = armholeBody(f, underSleeve, side);
    /* the free edges: everything but the seams */
    const sides = `M${under[0]} ${U} ${run(side, hemAcross(side), mirror(reverse(side)))}`;
    const bodyEdge = raglan
      ? `${sides} M${fp!.neckRight[0]} ${fp!.neckRight[1]} ${fp!.opening}`
      : `${sides} M${f.tipRight[0]} ${f.tipRight[1]} ${f.edge}`;
    const sleeveEdge = line(outRun, hemPts, reverse(inner));
    const sleeveEdgeRight = raglan
      ? line([fp!.neckRight, ...mirror(outRun.slice(1))], mirror(hemPts), mirror(reverse(inner)))
      : mirrorLine(sleeveEdge);
    const cuffEdge = banded ? line(cuffBand) : "";
    const seamsLeft = [line(seamLine), ...(cuffSeam ? [cuffSeam] : [])];
    const seams = [line(seamLine), line(seamRight), ...(cuffSeam ? [cuffSeam, mirrorLine(cuffSeam)] : [])];

    return {
      body: panel,
      sleeves: [left, right],
      bands,
      armCover: [left, right, ...bands],
      stitch: [cuffStitch, mirrorLine(cuffStitch), bodyHemStitch(side)].join(" "),
      folds: [],
      underarm: U,
      left: { armhole: underSleeve, side, hem: hemAcross(side), sleeve: left },
      right: { sleeve: right },
      ...(cuffParts ? { cuff: bothCuffs(style ?? "rib", cuffSeam, cuffParts) } : {}),
      raw: { outer: [...head, ...outer], hem: hemPts, inner, stitch: cuffStitch },
      seamed: {
        edges: [bodyEdge, sleeveEdge, sleeveEdgeRight, ...(banded ? [cuffEdge, mirrorLine(cuffEdge)] : [])],
        seams,
        seamsLeft,
        sides,
        hem: cuff,
        ...(cuffed ? { cuffTop: C } : {}),
        elbowY: d.elbowY,
        wristY: d.wristY,
        sleeveStitch: [cuffStitch, mirrorLine(cuffStitch)].join(" "),
      },
    };
  };

  const cut = (c: SleeveChoice, f: Frame, inside?: Tuck): SleeveCut => {
    const row = hemRow(body, c);
    /* a jacket's long sleeve stops short of the one under it */
    const cuff = row !== null && c.length === "long" ? row - (spec.finish?.reveal ?? 0) : row;
    const kind = SLEEVE_KINDS[c.type].construction;
    if (kind === "band") {
      throw new Error(`an ${c.type} sleeve is drafted by the cut whose band it hangs from — see necklines.ts`);
    }
    if (cuff !== null && SEWN_TYPES.includes(c.type)) return sewn(c, f, cuff, inside);
    const under = d.underarm(ease);

    /* ---------------------------------------------------- no sleeve at all */
    if (cuff === null || kind === "cap") {
      const end = f.tipLeft;
      const side = sideFrom(under[1], inside);
      // a cap's free edge wraps the top of the arm; a sleeveless armhole is the scye
      const armhole = seamCurve(end, under, kind === "cap" && cuff !== null ? 3 : SLEEVE_SCYE_BOW);
      return {
        body: armholeBody(f, armhole, side),
        sleeves: [],
        bands: [],
        armCover: [],
        stitch: bodyHemStitch(side),
        folds: [],
        left: { armhole, side, hem: hemAcross(side), sleeve: "" },
        right: { sleeve: "" },
      };
    }

    /* ---------------------------------------- cut in one with the body */
    if (kind === "cut-on") {
      const dolman = c.type === "dolman";
      /* never below the hem: under a seam above the waist, an empire's, a dolman's underarm comes up to meet it */
      const joinY = Math.min(d.armpitY + (dolman ? DOLMAN_DEPTH : KIMONO_DEPTH) * (d.waistY - d.armpitY), hemY);
      const loose = dolman ? capE + 14 : capE + 5;
      const end = f.tipLeft;
      const fin = spec.finish ?? {};
      const walked = rows(end[1], cuff).map((y) => {
        const t = (y - end[1]) / (cuff - end[1] || 1);
        // widest at the top for a dolman, tapering to the wrist; a kimono hangs straight
        const e = dolman
          ? lerp(spec.shoulderEase, loose, Math.min(1, t / 0.15)) - 11 * t
          : lerp(spec.shoulderEase, loose, Math.min(1, t / 0.2));
        /* with room over a sleeve worn under it, if the garment leaves any, and cut fuller — see `SleeveFinish` */
        return [d.armOutAt(y, e + (fin.over ?? 0) + (fin.full ?? 0)), y] as Pt;
      });
      walked[0] = end;
      const armTop = Math.min(cuff, dolman ? d.elbowY : joinY + 14);
      const walkedIn = rows(armTop, cuff).map((y) => [d.armInAt(y, inTop + 3 + (fin.full ?? 0)), y] as Pt);
      const side = sideFrom(joinY, inside);
      /*
        A kimono hangs as a tube below its underarm, as a sewn sleeve does; a
        dolman is cut widest at the top and tapering already, and keeps it.
      */
      const gap = seamAt(side);
      /* one hanging in front of its body has no daylight to keep from it — see `front` */
      const hung = dolman
        ? { out: walked, inner: walkedIn }
        : hang(walked, walkedIn, fin.front ? () => Infinity : (y) => gap(y) - SLEEVE_GAP);
      /*
        A dolman's long sleeve narrows to the wrist, so it can be gathered into
        a cuff as a sewn sleeve is: the sleeve stops short of the band and
        curves in to it — see `cuffOn`.
      */
      const style = dolman && c.length === "long" && c.cuff && c.cuff !== "none" ? c.cuff : null;
      /* a kimono's short sleeve can take a rib armband, as a sewn one can */
      const ribTop = !dolman && c.length === "short" && fin.armband ? cuff - fin.armband : null;
      const xAt = (run2: Pt[]) => (y: number): number => {
        if (y <= run2[0][1]) return run2[0][0];
        for (let i = 1; i < run2.length; i++) {
          if (run2[i][1] < y) continue;
          const [x0, y0] = run2[i - 1];
          const [x1, y1] = run2[i];
          return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0 || 1);
        }
        return run2[run2.length - 1][0];
      };
      let cuffParts: ReturnType<typeof cuffOn> | null = null;
      let out = hung.out;
      let inner = hung.inner;
      if (style) {
        const C = cuff - Math.round((fin.cuff?.height ?? CUFF_HEIGHT) * CUFF_CUT[style].deep);
        const [xo, xi] = [xAt(hung.out), xAt(hung.inner)];
        out = hung.out.filter(([, y]) => y <= C - CUFF_GATHER);
        inner = hung.inner.filter(([, y]) => y <= C - CUFF_GATHER);
        const width = (fin.cuff?.width ?? xi(C) - xo(C) - CUFF_GATHERED) + CUFF_CUT[style].wide;
        cuffParts = cuffOn(style, out, inner, xo, xi, C, cuff, width);
      } else if (ribTop !== null) {
        const [xo, xi] = [xAt(hung.out), xAt(hung.inner)];
        out = hung.out.filter(([, y]) => y <= ribTop - CUFF_GATHER);
        inner = hung.inner.filter(([, y]) => y <= ribTop - CUFF_GATHER);
        cuffParts = cuffOn("rib", out, inner, xo, xi, ribTop, cuff, xi(ribTop) - xo(ribTop) - ARMBAND_HUG);
      }
      const A = inner[0];
      const B = side[0];
      /*
        The underarm: from the inside of the arm up and into the side seam, a
        rounded corner rather than a sag. Hung below both of its ends, the
        curve dipped and climbed back, which drew a hook at the armpit.
      */
      const control: Pt = [lerp(A[0], B[0], 0.25), Math.min(A[1], B[1])];
      const under2 = Array.from({ length: 9 }, (_, i) => {
        const t = i / 8;
        const m = 1 - t;
        return [
          m * m * A[0] + 2 * m * t * control[0] + t * t * B[0],
          m * m * A[1] + 2 * m * t * control[1] + t * t * B[1],
        ] as Pt;
      });
      const { pts: hemPts, stitch: cuffStitch } = cuffParts
        ? { pts: cuffParts.hemPts, stitch: cuffParts.stitch }
        : plainHem(out, inner, cuff);
      const lower = [...reverse(inner), ...under2.slice(1), ...side.slice(1)];
      const backUp = mirror(reverse(out));
      backUp[backUp.length - 1] = f.tipRight;
      const panel =
        `M${end[0]} ${end[1]} ${run(out)} ${run(hemPts)} ` +
        `${run(lower)} ${run(hemAcross(side))} ${run(mirror(reverse(lower)))} ` +
        `${run(mirror(reverse(hemPts)))} ${run(backUp)} ${f.edge} Z`;
      const cover = outline(out, hemPts, reverse(inner), [[A[0], end[1] + 20]]);
      /*
        The drape under the arm. Cut-on cloth has nowhere to go when the arm
        hangs, so it folds — diagonally, from the underarm toward the elbow —
        and those folds are most of what tells a kimono from a wide set-in.
      */
      const pit: Pt = [under[0] - 4, d.armpitY + 4];
      const folds = (dolman ? [0.15, 0.4, 0.65, 0.9] : [0.3, 0.7]).map((k) => {
        const to = under2[Math.round(k * 8)];
        const from: Pt = [lerp(pit[0], A[0], k * 0.5), lerp(pit[1], to[1], 0.12)];
        return line(seamCurve(from, [to[0], to[1] - 3], dolman ? 4 : 2, 6));
      });
      const cuffBands = cuffParts ? [outline(cuffParts.band), outline(mirror(cuffParts.band))] : [];
      return {
        body: panel,
        sleeves: [],
        bands: cuffBands,
        armCover: [cover, outline(mirror(reverse([...out, ...hemPts, ...reverse(inner)]))), ...cuffBands],
        ...(cuffParts ? { cuff: bothCuffs(style ?? "rib", cuffParts.seam, cuffParts) } : {}),
        stitch: [cuffStitch, mirrorLine(cuffStitch), bodyHemStitch(side)].join(" "),
        folds: [...folds, ...folds.map(mirrorLine)],
        underarm: armTop,
        left: { armhole: [], side, hem: hemAcross(side), sleeve: "", cutOn: { out, hem: hemPts, inner, lower } },
        right: { sleeve: "" },
        sleeveStitch: [cuffStitch, mirrorLine(cuffStitch)].join(" "),
      };
    }

    /*
      --------------------------- a loose sleeve: puff, bishop, bell, flutter

      Set into the armhole as a set-in sleeve is, but cut to its own shape on
      purpose, so it keeps the profile it is named for rather than hanging.
    */
    const p = PROFILES[c.type]!;
    const start = f.tipLeft;
    const under3 = under;
    const side = sideFrom(under3[1], inside);

    const banded = c.type === "puff" || c.type === "bishop";
    const band = c.type === "bishop" ? CUFF : BAND;
    const bodyEnd = banded ? cuff - band + 3 : cuff;
    const walked = edges(start[1], under3[1], bodyEnd, p, side, start, spec.finish);
    walked.out[0] = start;

    const capTop: Pt = [start[0], start[1] - (p.rise ?? SLEEVE_CAP_RISE)];
    /* The seam the sleeve is set along: the armhole. */
    const seamLine = seamCurve(capTop, under3, p.capBow ?? SLEEVE_SCYE_BOW, 9);
    const head = reverse(seamLine); // underarm → top
    /* a puff is a balloon, drafted round — see `balloon` */
    const puff = c.type === "puff" ? balloon(f, start, capTop, under3, seamLine, cuff, side) : null;
    const { out, inner } = puff ?? walked;

    let hemPts: Pt[];
    let hemStitch = "";
    if (c.type === "bell") {
      const o = out[out.length - 1];
      const i = inner[inner.length - 1];
      hemPts = hem(o, i, 5, 6);
      hemStitch = line(hem([o[0] + 5, cuff - 7], [i[0] - 4, cuff - 7], 5, 6));
    } else if (banded || c.type === "flutter") {
      hemPts = span(out[out.length - 1], inner[inner.length - 1], 3);
    } else {
      const h = plainHem(out, inner, cuff);
      hemPts = h.pts;
      hemStitch = h.stitch;
    }

    let sleeve: Pt[];
    /* its own edges, for a cut that sets it some other way — see `SleeveCut.raw` */
    let rawHem = hemPts;
    let rawInner = inner;
    if (c.type === "flutter") {
      /*
        A flutter is a short sleeve cut on the circle: sewn into the armhole,
        flaring a little as it falls over the arm, its hem rippling and rising
        toward the inside, where it is shortest. It used to be sewn along the
        top of the armhole only, and it stood out sideways from the shoulder
        like a wing.
      */
      const innerTo = cuff - FLUTTER_RISE;
      const short = inner.filter(([, y]) => y <= innerTo);
      const iEnd: Pt = short.length ? short[short.length - 1] : inner[0];
      const o = out[out.length - 1];
      const wave = Array.from({ length: 16 }, (_, i) => {
        const t = i / 15;
        return [
          lerp(o[0], iEnd[0], t),
          lerp(o[1], iEnd[1], t) + Math.sin(t * Math.PI * 6) * 2.5,
        ] as Pt;
      });
      sleeve = [...out, ...wave.slice(1), ...reverse(short.length ? short : [inner[0]]).slice(1), ...head];
      rawHem = wave;
      rawInner = short.length ? short : [inner[0]];
    } else if (puff) {
      /* up the armhole and over its crown, a dome */
      sleeve = [...out, ...hemPts, ...reverse(inner), ...puff.head];
    } else {
      sleeve = [...out, ...hemPts, ...reverse(inner), ...head];
    }

    /* The right sleeve: the left reflected. */
    const sleeveRight = mirror(sleeve);
    const seamRight = mirror(seamLine);

    const bands: string[] = [];
    const folds: string[] = [];
    if (banded) {
      const bTop = cuff - band;
      const bo: Pt = [d.armOutAt(bTop, 2), bTop];
      const bi: Pt = [Math.max(d.armInAt(bTop, 2), d.armInAt(bTop, 0)), bTop];
      const co: Pt = [d.armOutAt(cuff, 2), cuff];
      const ci: Pt = [d.armInAt(cuff, 2), cuff];
      /* a puff's band has its frill below it */
      const cuffBand = puff ? puff.band : [bo, co, ci, bi];
      bands.push(outline(cuffBand), outline(mirror(cuffBand)));
      /*
        Gathers: the fullness drawn into the band, as short folds meeting it —
        not lines down the whole sleeve, which read as a stripe in the cloth.
        A bishop's run longer, because it blouses over its cuff from further up.
      */
      /* a puff's gathers are drawn from its shape, with its light — see `PuffShape` */
      const reach = 0.3 * (bTop - capTop[1]);
      for (const k of puff ? [] : [0.18, 0.38, 0.62, 0.82]) {
        const to: Pt = [lerp(bo[0], bi[0], k), bTop];
        const spread = (k - 0.5) * 10;
        const from: Pt = [to[0] + spread, bTop - reach];
        folds.push(line([from, [lerp(from[0], to[0], 0.6), lerp(from[1], to[1], 0.6)], to]));
      }
    }
    if (c.type === "bell") {
      /* flare: folds opening from where the bell begins to its hem */
      const startRow = Math.round(out.length * 0.45);
      for (const k of [0.3, 0.6]) {
        const from: Pt = [lerp(out[startRow][0], inner[Math.min(inner.length - 1, Math.round(inner.length * 0.45))][0], k), out[startRow][1]];
        const to: Pt = [lerp(hemPts[0][0], hemPts[hemPts.length - 1][0], k), cuff - 2];
        folds.push(line([from, to]));
      }
    }

    /* a puff is sewn on along the shoulder line's end and down the armhole */
    const sewnAlong = puff ? puff.seam : seamLine;
    const seams = c.type === "flutter" ? [] : [line(sewnAlong), line(mirror(sewnAlong))];
    const hemStitches = [
      ...(hemStitch ? [hemStitch, mirrorLine(hemStitch)] : []),
      ...(puff ? [puff.stitch, mirrorLine(puff.stitch)] : []),
    ];
    const panel = armholeBody(f, seamCurve(start, under3, SLEEVE_SCYE_BOW), side);

    const left = outline(sleeve);
    const right = outline(sleeveRight);
    return {
      body: panel,
      sleeves: [left, right],
      bands,
      armCover: [left, right, ...bands],
      stitch: [...seams, ...hemStitches, bodyHemStitch(side)].join(" "),
      folds: [...folds, ...folds.map((f2) => mirrorLine(f2))],
      underarm: under3[1],
      raw: { outer: out, hem: rawHem, inner: rawInner, stitch: [hemStitch, puff?.stitch ?? ""].filter(Boolean).join(" ") },
      sleeveStitch: [...seams, ...hemStitches].join(" "),
      ...(puff ? { puff: puff.shape } : {}),
      left: {
        armhole: seamCurve(start, under3, SLEEVE_SCYE_BOW),
        side,
        hem: hemAcross(side),
        sleeve: left,
        sewnAlong,
      },
      right: { sleeve: right },
    };
  };

  const cuffRows = (style: Exclude<CuffId, "none">, wrist: number) => {
    const seam = wrist - Math.round(((spec.finish ?? {}).cuff?.height ?? CUFF_HEIGHT) * CUFF_CUT[style].deep);
    return { gather: seam - CUFF_GATHER, seam };
  };
  const cuffEnd = (
    style: Exclude<CuffId, "none">,
    outer: Pt[],
    inner: Pt[],
    xo: (y: number) => number,
    xi: (y: number) => number,
    wrist: number
  ) => {
    const C = cuffRows(style, wrist).seam;
    const width = ((spec.finish ?? {}).cuff?.width ?? xi(C) - xo(C) - CUFF_GATHERED) + CUFF_CUT[style].wide;
    const parts = cuffOn(style, outer, inner, xo, xi, C, wrist, width);
    return { hemPts: parts.hemPts, band: parts.band, stitch: parts.stitch, cuff: bothCuffs(style, parts.seam, parts) };
  };

  return { shoulderEnd, frame, cut, cuffRows, cuffEnd };
}


/* -------------------------------------------------------------- the jacket */

/**
 * What a garment holds inside it, for the garments worn under it.
 *
 * A garment under a jacket is inside the jacket. From the jacket's shoulders
 * to its hem it shows only within the jacket — which in practice means through
 * its front opening — and is hidden everywhere outside it: beside the
 * shoulders, along both sleeves and in the daylight under the arms. Above the
 * shoulders and below the hem it shows as usual, and so does a long sleeve's
 * end below the jacket's cuff, which is all a real jacket lets show of one.
 *
 * Paths only, so the renderer and `check:garments` build the same mask.
 */
export interface Encloses {
  /**
   * The rows the rule holds over: the jacket's shoulders to its hem — a unit
   * and a half short of the hem, so the mask's edge and the hem never fall on
   * one row and draw a hairline across whatever hangs below.
   */
  band: readonly [top: number, bottom: number];
  /** The row the sleeves end at, where an inner sleeve starts to show. */
  cuff: number;
  /** Its hem's row and its left corner there: what a garment under it comes out from — see `tucked`. */
  hem: Tuck;
  /** The jacket's outline with its front closed — inside, an inner layer may show. */
  envelope: string[];
  /** Just below each sleeve's cuff, as wide as it: where an inner sleeve's end shows. */
  windows: string[];
}

export interface TailoredSpec extends TopSpec {
  /** The neck points the V leaves from, left and right. */
  neck: Pt;
  neckRight: Pt;
  /** The shoulder seam's ease, kept for the frame's sake. */
  shoulderEase: number;
  /** The shoulders it is worn over, neck to shoulder end, left side: what it has to clear. */
  over: Pt[];
  /** The row of the one button the fronts close on: where the lapels break. */
  buttonY: number;
  /** How far each front laps past the centre line at the button. */
  lap: number;
  /** How far from the centre line each front has fallen away at the hem. */
  cutaway: number;
  /** The radius of the rounded corner where a front turns into the hem. */
  corner: number;
  /**
   * The buttons in a row at the end of each sleeve, on its outer side: how
   * many, and how wide each is, in centimetres. They touch — see
   * `SLEEVE_BUTTON_LIFT`.
   */
  sleeveButtons: { count: number; cm: number };
}

export interface Tailored {
  /** The two fronts. The left one laps over the right, so it is drawn second. */
  left: string;
  right: string;
  sleeveLeft: string;
  sleeveRight: string;
  /** Each piece's free edges, in the order front right, front left, sleeves. */
  edges: { right: string; left: string; sleeveLeft: string; sleeveRight: string };
  /** The armholes, as soft lines of shadow. */
  seams: string[];
  stitch: string;
  /** The sleeve cut, for the drape it hangs in — see `sewnDrape`. */
  cut: SleeveCut;
  /** The closed panel the fronts are cut from, for the light's rows. */
  panel: string;
  /** Each front's break point: where its V meets its front edge at the button. */
  breakLeft: Pt;
  breakRight: Pt;
  /** The V each front is cut to, neck to break — what a lapel is sewn along. */
  seam: string;
  /** What it holds inside it — see `Encloses`. */
  encloses: Encloses;
  /** The buttons at each sleeve's end, left sleeve's from the bottom up then the right's, and their radius. */
  sleeveButtons: { at: Pt[]; r: number };
}

/** How far a jacket's shoulder stands above the one under it: cloth, and a pad. */
const SHOULDER_CLEAR = 3;
/** How much room a jacket's sleeve leaves round the sleeve under it. */
const JACKET_OVER = 3;
/** How much shorter than a long sleeve a jacket's is cut: 1.25 cm of the one under it shows. */
const JACKET_REVEAL = 6.5;
/**
 * How far above a jacket sleeve's end its lowest button sits, to the
 * button's edge: just above the end, as a tailor sews them. The rest go up
 * the sleeve from it, each touching the one below.
 */
const SLEEVE_BUTTON_LIFT = 1.8 / BODY_CANVAS.cmPerUnit;
/** How far in from the sleeve's outer edge the row sits, to the buttons' edge. */
const SLEEVE_BUTTON_IN = 2;
/**
 * How far below the jacket's cuff its window runs: past the end of a long
 * sleeve under it, and no further, so it shows a sleeve's end and never a
 * thobe or a skirt hanging beside the hand.
 */
const WINDOW_DEPTH = JACKET_REVEAL + 4;
/** The figure's centre line, where the fronts meet. */
const CENTER_X = 300;

/**
 * A tailored jacket, open at the front: two fronts closing on one button, a
 * structured shoulder, and the sewn sleeve every top has, cut over the sleeve
 * worn under it.
 *
 * - **The shoulder** is pressed and padded, not draped: a straight line from
 *   the neck to just past the shoulder point, lifted over the shoulder of the
 *   garment under it wherever that would come through — the upper hull of
 *   that shoulder, `SHOULDER_CLEAR` above it. So it does not slope with the
 *   body, and it always sits outside whatever is worn beneath.
 * - **The sleeve** is the shared one — see `sewn` in `top` — leaning with the
 *   arm like every fitted sleeve, with `JACKET_OVER` more room all round than
 *   a shirt's, and cut `JACKET_REVEAL` short so the end of a long sleeve under
 *   it shows, as tailoring does.
 * - **The fronts** are the panel's two halves, cut at the centre in a straight
 *   V from the neck to the button and falling away below it into rounded
 *   corners. Each runs on under its sleeve head, as every sewn body does.
 */
export function tailored(body: BodyType, spec: TailoredSpec): Tailored {
  const d = draft(body);
  const { tip, neck, neckRight, hemY, buttonY: by, lap, cutaway, corner } = spec;

  /* the shoulder: the upper hull, from the neck to the tip, of the shoulder under it lifted clear */
  const lifted: Pt[] = spec.over
    .filter(([x]) => x < neck[0] && x > tip[0])
    .map(([x, y]) => [x, y - SHOULDER_CLEAR] as Pt);
  const pts: Pt[] = [tip, ...lifted.sort((a, b) => a[0] - b[0]), neck];
  const hull: Pt[] = [];
  for (const q of pts) {
    // above is smaller y: keep the chain turning so that every point lies under it
    while (hull.length >= 2) {
      const [o, a] = [hull[hull.length - 2], hull[hull.length - 1]];
      const cross = (a[0] - o[0]) * (q[1] - o[1]) - (a[1] - o[1]) * (q[0] - o[0]);
      if (cross <= 0) hull.pop();
      else break;
    }
    hull.push(q);
  }
  /* neck to tip, sampled every four units so a straight run stays straight */
  const corners = reverse(hull);
  const strapLeft: Pt[] = [corners[0]];
  for (let i = 1; i < corners.length; i++) {
    const [a, b] = [corners[i - 1], corners[i]];
    const steps = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4));
    strapLeft.push(...span(a, b, steps).slice(1));
  }
  const strapRight = reverse(mirror(strapLeft));
  strapRight[strapRight.length - 1] = neckRight;
  /* closed across the neck: the panel is the jacket as if buttoned to the throat */
  const opening = `L${neck[0]} ${neck[1]}`;
  const frame: Frame = {
    tipLeft: tip,
    tipRight: strapRight[0],
    edge: `${run(strapRight)} ${opening} ${run(strapLeft)}`,
    parts: { neck, neckRight, strapLeft, strapRight, opening },
  };
  const T = top(body, {
    ...spec,
    neck,
    neckRight,
    finish: { over: JACKET_OVER, reveal: JACKET_REVEAL },
  });
  const k = T.cut({ type: "set-in", length: "long" }, frame);
  const s = k.seamed!;
  const { armhole, side } = k.left;

  /* the fronts, cut from the panel's halves */
  const breakLeft: Pt = [CENTER_X + lap, by];
  const cornerX = CENTER_X - cutaway;
  const fall = hemY - corner - by;
  const front: Pt[] = Array.from({ length: 9 }, (_, i) => {
    const t = i / 8;
    return [CENTER_X + lap - (lap + cutaway) * t ** 1.6, by + fall * t] as Pt;
  });
  const round: Pt[] = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 5) * (Math.PI / 2);
    return [cornerX - corner + corner * Math.cos(a), hemY - corner + corner * Math.sin(a)] as Pt;
  });
  const hemLeft = side[side.length - 1];
  const hemRun = span(hemLeft, round[round.length - 1], 4);
  const up = [...reverse(round), ...reverse(front)];
  const vLeft = span(breakLeft, neck, 6);
  const left =
    `M${neck[0]} ${neck[1]} ${run(strapLeft.slice(1), armhole.slice(1))} ` +
    `${run(side)} ${run(hemRun, up)} ${run(vLeft)} Z`;
  const breakRight: Pt = [CENTER_X - lap, by];
  const vRight = span(breakRight, neckRight, 6);
  const strapR = reverse(strapRight);
  const right =
    `M${neckRight[0]} ${neckRight[1]} ${run(strapR.slice(1), mirror(armhole).slice(1))} ` +
    `${run(mirror(side))} ${run(mirror(hemRun), mirror(up))} ${run(vRight)} Z`;

  /* the free edges: the shoulder, and from the underarm round the side, hem and front */
  const under = side[0];
  const edgeLeft =
    `M${neck[0]} ${neck[1]} ${run(strapLeft)} ` +
    `M${under[0]} ${under[1]} ${run(side)} ${run(hemRun, up)} ${run(vLeft)}`;
  const edgeRight =
    `M${neckRight[0]} ${neckRight[1]} ${run(strapR)} ` +
    `M${600 - under[0]} ${under[1]} ${run(mirror(side))} ${run(mirror(hemRun), mirror(up))} ${run(vRight)}`;

  /* below each cuff, exactly as wide as it, just past the end of a sleeve under it */
  const cuffRow = s.hem;
  const window = (sleeve: string): string => cuffWindow(sleeve, cuffRow);

  /*
    The sleeve buttons: a row up the outer side of each sleeve from just
    above its end, each touching the next — following the edge, which leans
    with the arm.
  */
  const raw = k.raw!;
  const r = spec.sleeveButtons.cm / 2 / BODY_CANVAS.cmPerUnit;
  const outerAt = (y: number): number => {
    for (let i = 1; i < raw.outer.length; i++) {
      const [[x0, y0], [x1, y1]] = [raw.outer[i - 1], raw.outer[i]];
      if (y1 >= y && y0 <= y) return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0 || 1);
    }
    return raw.outer[raw.outer.length - 1][0];
  };
  const buttonRow: Pt[] = Array.from({ length: spec.sleeveButtons.count }, (_, i) => {
    const y = s.hem - SLEEVE_BUTTON_LIFT - r - 2 * r * i;
    return [outerAt(y) + SLEEVE_BUTTON_IN + r, y] as Pt;
  });

  return {
    left,
    right,
    sleeveLeft: k.sleeves[0],
    sleeveRight: k.sleeves[1],
    edges: { right: edgeRight, left: edgeLeft, sleeveLeft: s.edges[1], sleeveRight: s.edges[2] },
    seams: s.seams,
    stitch: s.sleeveStitch,
    cut: k,
    panel: k.body,
    breakLeft,
    breakRight,
    seam: `${line(reverse(span(breakRight, neckRight, 12)))} ${line(span(breakLeft, neck, 12))}`,
    encloses: {
      band: [Math.min(neck[1], neckRight[1]), hemY - 1.5],
      cuff: cuffRow,
      hem: { y: hemY, x: side[side.length - 1][0] },
      envelope: [k.body, ...k.sleeves],
      windows: [window(k.sleeves[0]), window(k.sleeves[1])],
    },
    sleeveButtons: { at: [...buttonRow, ...mirror(buttonRow)], r },
  };
}

/**
 * Below a sleeve's cuff, exactly as wide as it, just past the end of a sleeve
 * worn under it: where that sleeve's end shows — see `Encloses`.
 */
function cuffWindow(sleeve: string, cuffRow: number): string {
  const xs: number[] = [];
  const nums = (sleeve.match(/-?[0-9]*[.]?[0-9]+/g) ?? []).map(Number);
  for (let i = 0; i + 1 < nums.length; i += 2) if (Math.abs(nums[i + 1] - cuffRow) < 1.5) xs.push(nums[i]);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [top0, foot] = [cuffRow - 2, cuffRow + WINDOW_DEPTH];
  return `M${x0} ${top0} L${x1} ${top0} L${x1} ${foot} L${x0} ${foot} Z`;
}

/* ---------------------------------------------------------------- the robe */

export interface RobeSpec extends TopDraftSpec {
  /** How far its neckline dips at the centre front, below the neck points. */
  neckDip: number;
  /**
   * How far apart the fronts hang: just under the neck, and at the hem. They
   * almost meet below the throat and fall a little apart as they hang.
   */
  gap: readonly [atNeck: number, atHem: number];
}

export interface Robe {
  /** Its fronts as they hang open — see `OpenFront`. */
  open: OpenFront;
  /** The same fronts closed down the centre — see `ClosedFront`. */
  closed: ClosedFront;
  /** Its sleeves as pieces of their own, left then right — none, cut in one with its body. */
  sleeves: string[];
  /**
   * Each sleeve's free edges, left then right: a sewn one's, all but its seam;
   * a loose one's, all of it. Cut in one with the body, its fronts' edges are
   * its own.
   */
  sleeveEdges: string[];
  /** The arm each sleeve lies over, left then right, sewn or cut on: what its light and folds are kept to. */
  sleeveAreas: string[];
  /** The sleeves' own folds, as lines: a bell's flare, a kimono's under the arm. A sewn sleeve's hang in `sewnDrape`. */
  sleeveFolds: string[];
  /** The armholes of a sewn sleeve, as soft lines of shadow. */
  seams: string[];
  /** The sleeves' topstitch. */
  stitch: string;
  /** The sleeve cut, for the drape it hangs in — see `sewnDrape`. */
  cut: SleeveCut;
  /** The closed panel the fronts are cut from, closed across the neck too, for the light's rows. */
  panel: string;
  /** The row its body leaves the underarm at. */
  underarm: number;
  /** What it holds inside it — see `Encloses`. Open or closed, the same robe holds the same. */
  encloses: Encloses;
}

/** A robe's two fronts hanging open; neither laps the other. */
export interface OpenFront {
  left: string;
  right: string;
  /** Each front's free edges: its shoulder, and from the underarm round the side, hem, front edge and neckline. */
  edges: { left: string; right: string };
  /** Each front's edge from under the neck to the hem, left then right: where it hangs free. */
  frontEdges: readonly [Pt[], Pt[]];
}

/**
 * A robe's two fronts closed down the centre — her abaya on hidden snaps.
 * They meet edge to edge under a plain seam, so it is one panel from the
 * shoulders to the hem, with the robe's own neckline.
 */
export interface ClosedFront {
  body: string;
  /** Its free edges: the shoulders, the sides and hem, and the neckline. */
  edge: string;
  /** The seam down the centre front, from the neckline to the hem. */
  seam: Pt[];
}

/**
 * A robe worn over whatever is under it — an abaya: open down the front, or
 * closed.
 *
 * - **The shoulders** are soft, walked along the body over the clothes under
 *   it as a top's are, not padded as a jacket's.
 * - **The body** is the shared top's, hung past the crotch to the hem as a
 *   thobe's is, and straight from where it leaves her below the underarm —
 *   see `straight`.
 * - **The sleeve** is the shared long sleeve, with room over a sleeve worn
 *   under it, in front of the robe's own side — see `front`.
 * - **The fronts** are the panel's two halves, cut along an opening that is
 *   narrow under the neck and wider at the hem — `gap` — each hanging free
 *   down its edge. Closed, they meet down the centre line under a seam, from
 *   the neckline to the hem.
 */
export function robe(body: BodyType, spec: RobeSpec, sleeve: SleeveChoice = { type: "set-in", length: "long" }): Robe {
  const { neck, neckRight, hemY, neckDip } = spec;
  const [gapNeck, gapHem] = spec.gap;

  /* the neckline, right neck point round to the left, dipping at the centre front */
  const half = (neckRight[0] - neck[0]) / 2;
  const mid = (neckRight[0] + neck[0]) / 2;
  const arc: Pt[] = Array.from({ length: 25 }, (_, i) => {
    const t = i / 24;
    const a = t * Math.PI;
    return [mid + half * Math.cos(a), neckRight[1] + (neck[1] - neckRight[1]) * t + neckDip * Math.sin(a)] as Pt;
  });
  const T = top(body, spec);
  /* closed across the neck, as a jacket's panel is: what is worn under it shows in its neckline too */
  const frame = T.frame(`L${neck[0]} ${neck[1]}`, sleeve);
  const k = T.cut(sleeve, frame);
  const s = k.seamed;
  const { side, cutOn } = k.left;
  const strapLeft = frame.parts!.strapLeft;
  const strapRight = frame.parts!.strapRight;
  /*
    Its body runs on under each sleeve, so the two never merely meet — on a
    dark robe against the page, a seam the two only met along showed the
    page through it. A sewn sleeve's does so already. A loose one's, a bell's,
    runs to just inside the seam it is set along. A sleeve cut in one with
    the body — a kimono — is drawn as a sewn one is, laid over the body, only
    with no seam where it leaves the shoulder: the body runs on under it to
    an armhole hidden there, from the shoulder's end down to where its side
    begins, below the deep underarm.
  */
  const sewnAlong = k.left.sewnAlong;
  const OVERLAP = 2;
  const armhole = cutOn
    ? seamCurve(frame.tipLeft, side[0], SLEEVE_SCYE_BOW)
    : sewnAlong
      ? [frame.tipLeft, ...sewnAlong.filter(([, y]) => y > frame.tipLeft[1]).map(([x, y]) => [x - OVERLAP, y] as Pt)]
      : k.left.armhole;
  const panelOf = (f: Frame, cut: SleeveCut): string =>
    cutOn || sewnAlong
      ? `M${f.tipLeft[0]} ${f.tipLeft[1]} ` +
        `${run(armhole, side, k.left.hem, mirror(reverse(side)), mirror(reverse(armhole)))} ` +
        `L${f.tipRight[0]} ${f.tipRight[1]} ${f.edge} Z`
      : cut.body;

  /* the hem as the body draws it, and the point on it each front edge comes down to */
  const hemLeft = side[side.length - 1];
  const hemFull = hem(hemLeft, mirror([hemLeft])[0], spec.dip ?? 9, 24);
  const footX = CENTER_X - gapHem / 2;
  const hemRun = hemFull.filter(([x]) => x < footX);
  const foot: Pt = [footX, hemAt(hemFull, footX)];
  /* where each front's edge leaves the neckline: half the gap either side of the centre line */
  const edgeTop: Pt = [CENTER_X - gapNeck / 2, arcAt(arc, CENTER_X - gapNeck / 2)];
  const edgeTopRight: Pt = [CENTER_X + gapNeck / 2, arcAt(arc, CENTER_X + gapNeck / 2)];
  const frontEdge = span(edgeTop, foot, 12);
  const frontEdgeRight = span(edgeTopRight, mirror([foot])[0], 12);
  /*
    The neckline from each edge out to its neck point, along the arc. The arc
    is cut to her throat, a little left of the centre line, so the right one
    is its own: the left one's mirror would stand off her neck.
  */
  const neckRun = [edgeTop, ...arc.filter(([x]) => x < edgeTop[0] - 0.5)];
  const neckRunRight = [edgeTopRight, ...reverse(arc.filter(([x]) => x > edgeTopRight[0] + 0.5))];
  const downLeft = [...hemRun, foot, ...reverse(frontEdge), ...neckRun.slice(1)];
  const downRight = [...mirror(hemRun), ...mirror([foot]), ...reverse(frontEdgeRight), ...neckRunRight.slice(1)];

  const left =
    `M${neck[0]} ${neck[1]} ${run(strapLeft.slice(1), armhole.slice(1))} ` +
    `${run(side)} ${run(downLeft)} Z`;
  const right =
    `M${neckRight[0]} ${neckRight[1]} ${run(reverse(strapRight).slice(1), mirror(armhole).slice(1))} ` +
    `${run(mirror(side))} ${run(downRight)} Z`;

  /* the free edges: the shoulder, and from the underarm round the side, hem, front edge and neckline */
  const under = side[0];
  const edgeLeft = `M${neck[0]} ${neck[1]} ${run(strapLeft)} M${under[0]} ${under[1]} ${run(side)} ${run(downLeft)}`;
  const edgeRight =
    `M${neckRight[0]} ${neckRight[1]} ${run(reverse(strapRight))} ` +
    `M${600 - under[0]} ${under[1]} ${run(mirror(side))} ${run(downRight)}`;

  /*
    Closed: the two fronts met, one panel — the top's own, cut to the robe's
    neckline rather than closed across the neck, so its sides and hem are to
    the pixel the outline it holds what is under it in — and the seam they
    are fastened under, straight down the centre line from the neckline to
    the hem.
  */
  const arcFrame = T.frame(run(arc), sleeve);
  const kc = T.cut(sleeve, arcFrame);
  const seam = span([CENTER_X, arcAt(arc, CENTER_X)], [CENTER_X, hemAt(kc.left.hem, CENTER_X)], 24);
  /*
    Its free edges: a sewn sleeve's body leaves its armholes out, as the top's
    own; a loose sleeve's body is the same shoulders, sides, hem and neckline,
    and its sleeves are outlined on their own; cut on, it is all edge.
  */
  const closedEdge = kc.seamed
    ? kc.seamed.edges[0]
    : `M${side[0][0]} ${side[0][1]} ${run(side, kc.left.hem, mirror(reverse(side)))} ` +
      `M${arcFrame.tipRight[0]} ${arcFrame.tipRight[1]} ${arcFrame.edge}`;

  /*
    Its sleeves as pieces, and their free edges, every sleeve drawn as a sewn
    one is: outlined down the outside, across its hem and up the inside, its
    seam a soft line rather than an edge. A kimono's piece is its arm's cover,
    from the shoulder's end down to the hem and back up to the underarm, the
    right the left's mirror.
  */
  const shoulder: Pt[] = cutOn ? [[cutOn.inner[0][0], cutOn.out[0][1] + 20]] : [];
  const sleeves = cutOn
    ? [
        outline(cutOn.out, cutOn.hem, reverse(cutOn.inner), shoulder),
        outline(mirror(cutOn.out), mirror(cutOn.hem), mirror(reverse(cutOn.inner)), mirror(shoulder)),
      ]
    : k.sleeves;
  const raw = k.raw;
  const sleeveEdges = s
    ? [s.edges[1], s.edges[2]]
    : cutOn
      ? [line(cutOn.out, cutOn.hem, reverse(cutOn.inner)), line(mirror(cutOn.out), mirror(cutOn.hem), mirror(reverse(cutOn.inner)))]
      : raw
        ? [line(raw.outer, raw.hem, reverse(raw.inner)), line(mirror(raw.outer), mirror(raw.hem), mirror(reverse(raw.inner)))]
        : k.sleeves;
  /* the cuff's row, and what shows below each sleeve */
  const cuffRow = s ? s.hem : hemRow(body, sleeve)!;
  return {
    open: { left, right, edges: { left: edgeLeft, right: edgeRight }, frontEdges: [frontEdge, frontEdgeRight] },
    closed: { body: panelOf(arcFrame, kc), edge: closedEdge, seam },
    sleeves,
    sleeveEdges,
    sleeveAreas: k.armCover.slice(0, 2),
    sleeveFolds: s ? [] : k.folds,
    seams: s ? s.seams : sewnAlong ? [line(sewnAlong), line(mirror(sewnAlong))] : [],
    stitch: s ? s.sleeveStitch : (k.sleeveStitch ?? ""),
    cut: k,
    panel: panelOf(frame, k),
    underarm: under[1],
    encloses: {
      band: [Math.min(neck[1], neckRight[1]), hemY - 1.5],
      cuff: cuffRow,
      hem: { y: hemY, x: hemLeft[0] },
      envelope: [panelOf(frame, k), ...sleeves],
      windows: [cuffWindow(sleeves[0], cuffRow), cuffWindow(sleeves[1], cuffRow)],
    },
  };
}

/** A run's y at an x, read along it; it runs left to right. */
function hemAt(run: Pt[], x: number): number {
  for (let i = 1; i < run.length; i++) {
    const [x0, y0] = run[i - 1];
    const [x1, y1] = run[i];
    if (x1 >= x) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1);
  }
  return run[run.length - 1][1];
}

/** A neckline's y at an x, read along the arc, which runs from the right neck point round to the left. */
function arcAt(arc: Pt[], x: number): number {
  for (let i = 1; i < arc.length; i++) {
    const [x0, y0] = arc[i - 1];
    const [x1, y1] = arc[i];
    if (x1 <= x && x0 >= x) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1);
  }
  return arc[arc.length - 1][1];
}

/* -------------------------------------------------------------- helpers */

/** The points of a path written by `line`: its move and every curve's end. */
function parsePts(d: string): Pt[] {
  const nums = (d.match(/-?[0-9]*[.]?[0-9]+/g) ?? []).map(Number);
  const pts: Pt[] = [[nums[0], nums[1]]];
  for (let i = 2; i + 5 < nums.length; i += 6) pts.push([nums[i + 4], nums[i + 5]]);
  return pts.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
}

/** A line reflected about the figure's centre. */
function mirrorLine(d: string): string {
  return line(mirror(parsePts(d)));
}

/**
 * Every piece of cloth a top is, cut for one sleeve inside its own opening —
 * body, sleeves, bands — in the order they are drawn.
 *
 * What both the renderer and `check:garments` ask for, so the two are given
 * the same answer.
 */
export function clothOf(draft: TopDraft, opening: string, c: SleeveChoice, inside?: Tuck): string[] {
  const k = draft.cut(c, draft.frame(opening, c), inside);
  return [k.body, ...k.sleeves, ...k.bands];
}
