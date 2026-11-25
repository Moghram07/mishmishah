/*
  Plain `.ts`, relative and extensioned, and no JSX — so `scripts/
  preview-garments.mjs` can import it and rasterise the *same* fifteen bodices
  the app draws.

  This is the whole reason the geometry is not in `dress.tsx` with the drawing.
  The checker reads a `.tsx` art file by evaluating its `const` declarations out
  of the source text, which cannot call a `function` and stops at the first
  semicolon inside an arrow body — so fifteen generated cuts are exactly the
  shape of thing it cannot see. An art file it cannot read is an art file none
  of its rules apply to, and that is how the male collars once drifted into a
  trapezoid on a collarbone with every check passing.
*/
import { draft, line, mirrorPts, outline, reverse, run, setIn, span, type Pt, type Tuck } from "../../fit.ts";
import { BAND_CUT_TYPES, SHOULDER_TYPES, SLEEVE_KINDS, cuffsOffered, hemRow, top, type Frame, type PuffShape, type SleeveChoice, type SleeveCut } from "../../sleeves.ts";
import { WAIST_DROP, fallOf, sameSkirt, shapeLengths, skirtCut, skirtKey, type CutSkirt, type SkirtFinish } from "../../skirts.ts";
import {
  BELT_ABOVE_SEAM,
  BELT_OUT,
  BELT_WIDTH,
  BUCKLE,
  BUTTONED_CUTS,
  BUTTONED_TO_WAIST_ONLY,
  BUTTON_FIRST,
  BUTTON_HEM_CLEAR,
  BUTTON_LAST,
  BUTTON_PITCH,
  BUTTON_R,
  BUTTON_SLIDE,
  DOUBLE,
  DOUBLE_CUTS,
  OWN_PLACKET,
  PANEL_HALF,
  PLACKET_HALF,
  PLACKET_STITCH,
  NARROW_SKIRTS,
  SASHED_CUTS,
  SASHES,
  isSash,
  type SashId,
} from "../../closures.ts";
import type { BeltId, BowAtId, ButtonsId, CuffId, SkirtChoice, StripeEdgeId, WaistId } from "@/types";
import type { GarmentChoice } from "../index.ts";
import { mirror as mirrorPath } from "../../collar.ts";
import { BAND_STRIPE_ROOM, STRIPES, cornersOf, densify, insideRings, ringsOf, stripesAlong, type Inlay } from "../../stripes.ts";
import type { Edge, EdgeKind, EdgeOffer, EdgePoint, EdgeSpec } from "../../edges.ts";
import {
  ONE_SIDED,
  NECKLINE_EDGED,
  NECKLINE_IDS,
  NECKLINE_OPENING,
  NECKLINE_SLEEVES,
  NECKLINE_TIED,
  necklineCut,
  type NecklineCut,
  type NecklineId,
  type OffShoulderBand,
} from "../../necklines.ts";
import { NECK_BASE_SEAM, NECK_LEFT, NECK_RIGHT, SHOULDER_EASE, TIP_LEFT } from "./yoke.ts";
import { bowAt, tieAt, type BowPieces, type FoldSpec } from "./ties.ts";
import { bodies } from "../../../mannequin/bodies.ts";

/**
 * Where the bodice ends and the skirt is sewn on: **her** waist, as measured.
 *
 * It was a typed 366 — sixteen units below the narrowest part of her, so the
 * seam crossed her where she is already widening toward the hip, and the skirt
 * started out from there.
 */
export const WAIST_Y = draft("female").waistY;

/** Where a waist's seam is sewn: her waist, or lower for a dropped one — see `WAIST_DROP`. */
export const seamAt = (waist: WaistId = "natural"): number => WAIST_Y + WAIST_DROP[waist];

/**
 * The bodice's ease, and the skirt's at the seam — the same number, because a
 * skirt sewn to a bodice has the bodice's waist. Four is the blouse's fitted
 * ease; this was six on the bodice and ten on the skirt, which is the step
 * outward at the waist the figure showed.
 */
const EASE = 4;
const TIP: Pt = [TIP_LEFT[0], TIP_LEFT[1]];

/** How the dress finishes its skirt — see `skirts.ts`: the same worn on its own and under a jacket. */
const FINISH: SkirtFinish = {
  /* Starts under the bodice, so the seam is cloth over cloth. */
  rise: -8,
  ease: EASE,
  dip: 22,
};

/** The skirt the dress arrives with. Kept in step with its record by a test. */
export const DEFAULT_SKIRT: SkirtChoice = { shape: "flared", length: "midi", waist: "natural" };

/** Where the skirt starts at a waist: under the bodice, above the seam — what a band down a wrap's edge goes into. */
export const skirtTopAt = (waist: WaistId = "natural"): number => seamAt(waist) + FINISH.rise;

export const SKIRT = skirtCut(FINISH, DEFAULT_SKIRT);

/**
 * The skirt in a style, on its own or under a jacket: drawn in under the
 * jacket's hem and flaring from there to its own hem — see `tucked`. Each
 * style and jacket cut once, kept.
 */
const skirts = new Map<string, CutSkirt>();
export function skirtFor(inside?: Tuck, skirt: SkirtChoice = DEFAULT_SKIRT, toHem = false): CutSkirt {
  /* buttoned to the hem, a pleated skirt has a flat panel down its centre front for the placket, its pleats either side */
  const panel = toHem && fallOf(skirt.shape).pleats !== undefined;
  if (!inside && !panel && sameSkirt(skirt, DEFAULT_SKIRT)) return SKIRT;
  const key = `${skirtKey(skirt)}|${inside ? `${inside.y}|${inside.x}` : ""}${panel ? "|panel" : ""}`;
  if (!skirts.has(key)) skirts.set(key, skirtCut(FINISH, skirt, inside, panel ? PANEL : undefined));
  return skirts.get(key)!;
}

/**
 * Whether a choice is buttoned on to the hem: a cut that can be buttoned,
 * over a skirt that can open so far — see `BUTTONED_TO_WAIST_ONLY`. Asked to,
 * over a mermaid it is buttoned to the waist.
 */
/**
 * What a choice's bodice is buttoned with, as its placket sees it: its
 * buttons, or none in two rows — a double-breasted front is buttoned on the
 * bodice itself, either side of the centre, with no placket down it.
 */
export const placketButtons = (choice: GarmentChoice): ButtonsId => (choice.buttonRows === "two" ? "none" : (choice.buttons ?? "none"));

export const buttonedToHem = (choice: GarmentChoice): boolean =>
  choice.buttons === "hem" &&
  BUTTONED_CUTS.includes(cutOf(choice.neckline)) &&
  !BUTTONED_TO_WAIST_ONLY.includes((choice.skirt ?? DEFAULT_SKIRT).shape);

export interface Bodice {
  cut: NecklineCut;
  /** Every closed piece of cloth: the panel, the cut's extras, the sleeves. */
  pieces: string[];
  stitch: string;
  /** Drape that is shading rather than silhouette: the cut's, and the sleeves'. */
  folds: string[];
  /** The cloth lying over the arms. */
  armCover: string[];
  /**
   * For sewn sleeves — see `SleeveCut.seamed` — the bodice's free edges, one
   * per piece in `pieces`, its seams, and the sleeve cut they came from, which
   * the drawing hangs the sleeves' drape from. Absent with no sleeve, or a
   * cut-on or loose one.
   */
  seamed?: { edges: string[]; seams: string[]; sleeves: string[]; cut: SleeveCut };
  /**
   * The pieces its sleeves end in — cuffs, wide bands, a puff's or a
   * bishop's band — however it is sleeved: both sides, one, or hung from an
   * off-shoulder's band. What a cloth of their own is laid over.
   */
  ends?: string[];
  /** Its cuffs, if its sleeves have them: the bands, and the cut they came from. */
  cuff?: { bands: string[]; cut: NonNullable<SleeveCut["cuff"]>; oneSided: boolean };
  /**
   * Each piece's outline, one per piece in `pieces`, where some edge of a
   * piece is not free: a cuff band's top on a sleeve cut on — a dolman's — is
   * a seam, and an off-shoulder band's lower edge across the chest lies on the
   * bodice, a fold.
   */
  edges?: string[];
  /**
   * An off-shoulder's sleeves, when they hang from its band: the two sleeves,
   * each whole arm, the seams they are sewn along, the band, and the rows they
   * hang between — for the drape and for `check:garments`.
   */
  bandSleeves?: {
    paths: [string, string];
    /** Each whole arm, band and sleeve together, for the drape. */
    shapes: [string, string];
    /** Where each sleeve is sewn to the band: a seam. */
    seams: string[];
    /** The band, its hem square, as the top of the sleeves. */
    band: string;
    /** The underarm row, the row the sleeve leaves the band at, the sleeve's hem row, and its cuff's seam. */
    under: number;
    top: number;
    hem: number;
    cuffTop?: number;
    /** The fitted sleeve, which hangs in the shared drape; the loose ones carry their own folds. */
    fitted: boolean;
  };
  /**
   * Its puffs, if its sleeves are puffs: each sleeve with its shape, for the
   * light and the gathers — see `PuffShape` — and the pieces lying over them
   * that those stay off: the arm bands, and an off-shoulder's band.
   */
  puff?: { sleeves: string[]; shapes: PuffShape[]; over: string[] };
  /** Its placket, when it is buttoned down the front and its cut has none of its own — see `withPlacket`. */
  placket?: Placket;
  /** The sleeves as drafted, on a cut sleeved on both sides: their hems, their pieces, their bands. */
  sleeveCut?: SleeveCut;
}

/** The sleeve the dress arrives in. Kept in step with its record by a test. */
export const DEFAULT_SLEEVE: SleeveChoice = { type: "set-in", length: "short" };

/**
 * The dress's sleeves, drafted against her — every type, every length.
 *
 * The bodice's own numbers: fitted at the ease the waist seam wants, and a
 * sleeve cut a little fuller at its hem than at its head, which is what keeps a
 * dress sleeve from reading as a t-shirt's.
 */
/** A skirt's left edge at a row: what a long sleeve hangs beside below the waist. */
const edgeOf = (path: string) => (y: number): number => {
  const n = (path.match(/-?[0-9]*[.]?[0-9]+/g) ?? []).map(Number);
  let left = Infinity;
  for (let i = 0; i + 3 < n.length; i += 2) {
    const [ax, ay, bx, by] = [n[i], n[i + 1], n[i + 2], n[i + 3]];
    if ((ay <= y && by > y) || (by <= y && ay > y)) left = Math.min(left, ax + ((y - ay) * (bx - ax)) / (by - ay));
  }
  return left;
};

const SLEEVES = top("female", {
  tip: TIP,
  neck: [NECK_LEFT[0], NECK_LEFT[1]],
  neckRight: [NECK_RIGHT[0], NECK_RIGHT[1]],
  shoulderEase: SHOULDER_EASE,
  ease: EASE,
  hemY: WAIST_Y,
  /** A join, not a hem: the skirt is sewn straight across it. */
  dip: 0,
  fitted: true,
  sleeve: [5, 8],
  inner: [3, 4],
  below: edgeOf(SKIRT.path),
});

/**
 * The bodice and its sleeves drafted to a waist: a dropped waist's bodice runs
 * on down to its seam, and a long sleeve hangs beside that waist's skirt. The
 * natural waist's is the one above; each other waist is drafted once, kept.
 */
const builders = new Map<WaistId, typeof SLEEVES>([["natural", SLEEVES]]);
const sleevesFor = (waist: WaistId): typeof SLEEVES => {
  let b = builders.get(waist);
  if (!b) {
    b = top("female", {
      tip: TIP,
      neck: [NECK_LEFT[0], NECK_LEFT[1]],
      neckRight: [NECK_RIGHT[0], NECK_RIGHT[1]],
      shoulderEase: SHOULDER_EASE,
      ease: EASE,
      hemY: seamAt(waist),
      dip: 0,
      fitted: true,
      sleeve: [5, 8],
      inner: [3, 4],
      below: edgeOf(skirtFor(undefined, { ...DEFAULT_SKIRT, waist }).path),
    });
    builders.set(waist, b);
  }
  return b;
};

/** How far up under the band a sleeve hung from it runs, so no hairline shows where it is sewn on. */
const UNDER_BAND = 6;
/**
 * Over how much of its length below the band a sleeve's outside turns from
 * the band's line onto its own: a few centimetres, less for a puff, whose
 * fullness springs out from its gathers.
 */
const JOIN_BLEND = 26;
const JOIN_BLEND_PUFF = 10;

/**
 * A sleeve's outside, turning smoothly from the band's line onto its own.
 *
 * Every sleeve is drafted to its own line from where it leaves the band, and
 * a sleeve cut full enough to clear her forearm — a long fitted one, or a
 * puff — stood out from the band at once: the outside of the arm turned a
 * corner there. Over its first stretch it now leaves along the band's own
 * line and curves onto its own, never inside the arm.
 */
function blendOuter(outer: Pt[], along: Pt, span: number): Pt[] {
  const d = draft("female");
  const [sx, sy] = outer[0];
  const k = outer.findIndex(([, y]) => y >= sy + span);
  if (k <= 0 || k >= outer.length - 1) return outer;
  const q = outer[k];
  const [ax, ay] = outer[k - 1];
  const [bx, by] = outer[k + 1];
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const dir: Pt = [(bx - ax) / len, (by - ay) / len];
  const reach = (q[1] - sy) / 3;
  const c1: Pt = [sx + along[0] * reach, sy + along[1] * reach];
  const c2: Pt = [q[0] - dir[0] * reach, q[1] - dir[1] * reach];
  const curve = Array.from({ length: 9 }, (_, i) => {
    const t = i / 9;
    const m = 1 - t;
    const x = m * m * m * sx + 3 * m * m * t * c1[0] + 3 * m * t * t * c2[0] + t * t * t * q[0];
    const y = m * m * m * sy + 3 * m * m * t * c1[1] + 3 * m * t * t * c2[1] + t * t * t * q[1];
    return [Math.min(x, d.armOutAt(y, 1)), y] as Pt;
  });
  return [...curve, ...outer.slice(k)];
}

/**
 * An off-shoulder's sleeves, built as a real one is: each a sleeve cut off at
 * the off-shoulder edge, sewn to the band along the band's lower edge and to
 * the bodice along a raglan seam from there down to the underarm — see the
 * band's `raglan` in `necklines.ts`.
 *
 * Below the band each type is its own shape, as on every other cut: the fitted
 * one is the shared fitted sleeve — the same width, lean and taper, the same
 * daylight below the underarm, the same cuffs — and puff, bishop, bell and
 * flutter keep their profiles, their bands and their folds. The same kit
 * drafts them as everywhere else, hung from where the band's outer edge ends
 * rather than set into an armhole; the armhole they would have had is left
 * out, and the raglan seam and the band take its place.
 *
 * They used to be a tube under the band, as wide as it, its inner edge run
 * down beside the bodice to the waist — three tubes side by side, and no
 * daylight between the arm and the body.
 */
function raglanSleeves(raglan: OffShoulderBand["raglan"], sleeve: SleeveChoice, S: typeof SLEEVES) {
  const fitted = sleeve.type === "off-shoulder";
  /* the fitted one is the shared fitted sleeve; the others are themselves */
  const drafted: SleeveChoice = fitted ? { ...sleeve, type: "set-in" } : sleeve;
  const { start, side, seam, corner: round } = raglan;
  const above = side[Math.max(0, side.length - 3)];
  const frame: Frame = {
    tipLeft: start,
    tipRight: [600 - start[0], start[1]],
    edge: "",
    /* arriving down the band's side, so that a fitted sleeve's head carries straight on from it */
    parts: {
      neck: seam[0],
      neckRight: [600 - seam[0][0], seam[0][1]],
      strapLeft: [above, start],
      strapRight: [
        [600 - start[0], start[1]],
        [600 - above[0], above[1]],
      ],
      opening: "",
    },
    /* hung from the band: the fitted one carries straight on from it, a puff balloons from it — see `Frame.hang` */
    hang: { ease: raglan.ease },
  };
  const k = S.cut(drafted, frame);
  /* the others leave the band along its line — see `blendOuter` */
  const [px, py] = side[side.length - 2];
  const along: Pt = [(start[0] - px) / (Math.hypot(start[0] - px, start[1] - py) || 1), (start[1] - py) / (Math.hypot(start[0] - px, start[1] - py) || 1)];
  const raw = fitted ? k.raw! : { ...k.raw!, outer: blendOuter(k.raw!.outer, along, sleeve.type === "puff" ? JOIN_BLEND_PUFF : JOIN_BLEND) };
  const under = seam[seam.length - 1];
  const seamTop = seam[0];
  /*
    The whole outside of the arm, from the band's corner: the sleeve runs on up
    under the band to it, so that the outside of the arm is one edge drawn
    once, through one set of points. Drawn half by the band and half by the
    sleeve, it showed a notch and a doubled line where the two met.
  */
  const left: Pt[] = [
    ...round.slice(0, -1),
    ...side.slice(0, -1),
    ...raw.outer,
    ...raw.hem.slice(1, -1),
    ...reverse(raw.inner),
    under,
    ...reverse(seam).slice(1),
    [seamTop[0], seamTop[1] - UNDER_BAND],
  ];
  /* its free edges: round the band's corner, down the whole outside of the arm, round its hem, and up its inside */
  const edge: Pt[] = [...round.slice(0, -1), ...side.slice(0, -1), ...raw.outer, ...raw.hem.slice(1, -1), ...reverse(raw.inner)];
  /* the whole arm, band and sleeve, for the drape a fitted one hangs in */
  const shape: Pt[] = [
    ...side,
    ...raw.outer.slice(1),
    ...raw.hem.slice(1, -1),
    ...reverse(raw.inner),
    under,
    ...reverse(seam).slice(1),
    [seamTop[0], side[0][1]],
  ];
  const style = drafted.length === "long" && drafted.cuff && drafted.cuff !== "none" ? drafted.cuff : null;
  const hem = hemRow("female", drafted) ?? draft("female").wristY;
  return {
    k,
    sleeves: [outline(left), outline(mirrorPts(left))] as [string, string],
    edges: [line(edge), line(mirrorPts(edge))] as [string, string],
    shapes: [outline(shape), outline(mirrorPts(shape))] as [string, string],
    seams: [line(seam), line(mirrorPts(seam)), line(raglan.lower)],
    stitch: raw.stitch ? `${raw.stitch} ${mirrorPath(raw.stitch)}` : "",
    under,
    fitted,
    hem,
    ...(fitted && style ? { cuffTop: S.cuffRows(style, hem).seam } : {}),
  };
}

/**
 * The bodice, cut to one neckline and one sleeve.
 *
 * The order matters: the sleeve is asked where its shoulder seam ends, then the
 * cut is asked for **first** with that shoulder — a drop shoulder runs the seam
 * on down the arm, and every cut's straps must reach it — and then the sleeve
 * is drafted into whatever the cut left. The cut decides where the bodice's top
 * corner is; the sleeve decides everything below it.
 */
function bodice(id: NecklineId, sleeve: SleeveChoice, waist: WaistId, bare = false): Bodice {
  const sleeves = NECKLINE_SLEEVES[id];
  const S = sleevesFor(waist);
  const cut = necklineCut("female", id, {
    shoulderTip: sleeves === "both" ? S.shoulderEnd(sleeve) : TIP,
    ease: EASE,
    seamY: NECK_BASE_SEAM,
    waistY: seamAt(waist),
    bare,
  });

  if (sleeves === "none" || sleeves === "band") {
    /* No sleeves: the bodice is the panel below whatever the cut left. */
    const T = setIn("female", { tip: cut.tip, ease: EASE, hemY: seamAt(waist), dip: 0, fitted: true });
    /*
      A one-sided cut has an armhole on its covered side only. Closed through
      `sides`, which mirrors the left armhole too, the panel climbed the bare
      arm to the far shoulder point before the cut's edge set off across the
      chest from the underarm — a sliver of cloth up the inside of the arm.
    */
    const { scye, side, hem } = T.parts;
    const sides = ONE_SIDED.includes(id) ? run(scye, side, hem, mirrorPts(reverse(side))) : T.sides;
    const panel = `M${cut.tip[0]} ${cut.tip[1]} ${sides} ${cut.edge} Z`;
    /*
      A sleeve hung from an off-shoulder's band: any but the fitted one at its
      shortest, which is the band alone. The band is then the strip across the
      bust and both arms the sleeves and the bodice are sewn to; the bodice
      runs on under the band and under each sleeve, past its raglan seam.
    */
    const hung =
      sleeves === "band" && cut.band && sleeve.length !== "sleeveless" && !(sleeve.type === "off-shoulder" && sleeve.length === "short")
        ? raglanSleeves(cut.band.raglan, sleeve, S)
        : null;
    if (hung && cut.band) {
      const { raglan } = cut.band;
      const hidden = raglan.hidden;
      const [ux, uy] = hung.under;
      const body =
        `M${hidden[0][0]} ${hidden[0][1]} L${ux} ${uy} ${T.sides} ` +
        `L${hidden[hidden.length - 1][0]} ${hidden[hidden.length - 1][1]} ${run(reverse(hidden))} Z`;
      const bands = hung.k.bands;
      return {
        cut,
        pieces: [body, ...hung.sleeves, ...bands, raglan.outline],
        ends: bands,
        stitch: [T.stitch, hung.stitch].join(" "),
        folds: [...cut.folds, ...hung.k.folds],
        armCover: [...hung.sleeves, ...bands, raglan.outline],
        edges: [
          `M${ux} ${uy} ${T.sides}`,
          ...hung.edges,
          ...(hung.k.cuff ? hung.k.cuff.edges : bands),
          raglan.edges,
        ],
        ...(hung.k.cuff ? { cuff: { bands, cut: hung.k.cuff, oneSided: false } } : {}),
        ...(hung.k.puff ? { puff: { sleeves: [...hung.sleeves], shapes: [...hung.k.puff], over: [...bands, raglan.outline] } } : {}),
        bandSleeves: {
          paths: hung.sleeves,
          shapes: hung.shapes,
          seams: hung.seams,
          band: raglan.outline,
          under: uy,
          top: raglan.start[1],
          hem: hung.hem,
          fitted: hung.fitted,
          ...(hung.cuffTop !== undefined ? { cuffTop: hung.cuffTop } : {}),
        },
      };
    }
    return {
      cut,
      pieces: [panel, ...cut.extras],
      stitch: [cut.stitch, T.stitch].join(" "),
      folds: cut.folds,
      /* an off-shoulder band lies round the upper arms: it is the top of two short sleeves */
      armCover: cut.band ? cut.extras : [],
      ...(cut.extraEdges ? { edges: [panel, ...cut.extraEdges] } : {}),
    };
  }

  const frame: Frame = {
    tipLeft: cut.tip,
    tipRight: [600 - cut.tip[0], cut.tip[1]],
    edge: cut.edge,
    parts: cut.parts,
  };
  const k = S.cut(sleeve, frame);

  /* a cut's own extra pieces are outlined whole: none of their edges is a seam */
  if (sleeves === "both") {
    const s = k.seamed;
    return {
      cut,
      sleeveCut: k,
      pieces: [k.body, ...cut.extras, ...k.sleeves, ...k.bands],
      ends: k.bands,
      stitch: [cut.stitch, k.stitch].join(" "),
      folds: [...cut.folds, ...k.folds],
      armCover: k.armCover,
      ...(k.cuff ? { cuff: { bands: k.bands, cut: k.cuff, oneSided: false } } : {}),
      ...(k.puff ? { puff: { sleeves: [...k.sleeves], shapes: [...k.puff], over: k.bands } } : {}),
      ...(k.cuff && !s ? { edges: [k.body, ...cut.extras, ...k.sleeves, ...k.cuff.edges] } : {}),
      ...(s
        ? {
            seamed: {
              edges: [s.edges[0], ...cut.extras, ...s.edges.slice(1)],
              seams: s.seams,
              sleeves: k.sleeves,
              cut: k,
            },
          }
        : {}),
    };
  }

  /*
    One sleeve. An asymmetric cut needs the armhole on one side and not the
    other, so the panel is reassembled from the left half's parts — the
    armhole, the side and the hem — with only the far side seam reflected.
  */
  const pieces = [
    `M${cut.tip[0]} ${cut.tip[1]} ` +
      `${run(k.left.armhole, k.left.side, k.left.hem, mirrorPts(reverse(k.left.side)))} ${cut.edge} Z`,
    ...cut.extras,
    sleeves === "left" ? k.left.sleeve : k.right.sleeve,
    ...(k.bands.length ? [k.bands[sleeves === "left" ? 0 : 1]] : []),
  ];
  const half = k.folds.slice(0, k.folds.length / 2);
  /*
    Sewn, the body runs on under its one sleeve — `k.left.armhole` is then
    the sleeve's outer edge rather than the seam — and its free edge is the
    sides and hem, closed by the cut's own upper edge.
  */
  const s = k.seamed;
  const one = sleeves === "left" ? 0 : 1;
  return {
    cut,
    pieces,
    ends: k.bands.length ? [k.bands[one]] : [],
    stitch: cut.stitch,
    folds: [...cut.folds, ...(sleeves === "left" ? half : k.folds.slice(half.length))],
    armCover: [sleeves === "left" ? k.left.sleeve : k.right.sleeve],
    ...(k.cuff && k.bands.length ? { cuff: { bands: [k.bands[one]], cut: k.cuff, oneSided: true } } : {}),
    ...(k.puff ? { puff: { sleeves: [k.sleeves[one]], shapes: [k.puff[one]], over: k.bands.length ? [k.bands[one]] : [] } } : {}),
    ...(s
      ? {
          seamed: {
            edges: [
              `${s.sides} ${cut.edge}`,
              ...cut.extras,
              s.edges[1 + one],
              ...(k.bands.length ? [s.edges[3 + one]] : []),
            ],
            seams: s.seamsLeft,
            sleeves: [k.sleeves[one]],
            cut: k,
          },
        }
      : {}),
  };
}

const cache = new Map<string, Bodice>();

/**
 * One bodice, drafted on first asking and kept.
 *
 * Fifteen cuts times every sleeve is too many to draft at load for a picker
 * that will show a handful, and `MannequinStage` re-renders on every fabric,
 * skin-tone and zoom change — so each combination is drafted once, when it is
 * first worn, and never again.
 */
/**
 * The left arm's cloth on a cut whose band is the top of its sleeve — the
 * band, the sleeve below it, and its cuff, if it has one — for
 * `check:garments` to measure as the one piece they are meant to be.
 * `null` for any other cut, or for the band alone.
 */
export function bandArm(
  id: NecklineId,
  sleeve: SleeveChoice,
  waist: WaistId = "natural"
): { pieces: string[]; underarm: number; hem: number; join: number; fitted: boolean; cuffTop?: number } | null {
  const b = bodiceFor(id, sleeve, waist);
  if (!b.bandSleeves || !b.cut.band) return null;
  const pieces = [b.bandSleeves.band, b.bandSleeves.paths[0], ...(b.cuff ? [b.cuff.bands[0]] : [])];
  return {
    pieces,
    underarm: b.bandSleeves.under,
    hem: b.bandSleeves.hem,
    join: b.bandSleeves.top,
    fitted: b.bandSleeves.fitted,
    ...(b.bandSleeves.cuffTop !== undefined ? { cuffTop: b.bandSleeves.cuffTop } : {}),
  };
}

export function bodiceFor(
  id: NecklineId,
  sleeve: SleeveChoice = DEFAULT_SLEEVE,
  waist: WaistId = "natural",
  buttons: ButtonsId = "none",
  collared = false,
  braided = false,
  /* drawn with no collar sewn on: the crew and the V from the neck's own points — see `CutSpec.bare` */
  bare = false
): Bodice {
  /* buttoned to the waist or to the hem, the bodice is the same: its placket runs to the waist seam either way */
  const placketed = placketOn(id, buttons);
  const drawnBare = bare && !collared;
  const key = `${id}|${sleeve.type}|${sleeve.length}|${sleeve.cuff ?? "none"}|${waist}${placketed ? "|placket" : ""}${drawnBare ? "|bare" : ""}`;
  /* braid sewn along the neck edge covers its topstitch, as a collar does — but leaves a keyhole's own closure, which it goes round */
  if (braided && !collared) {
    const open = bodiceFor(id, sleeve, waist, buttons, false, false, bare);
    let c = cache.get(`${key}|braided`);
    if (!c) {
      c = unstitched(open);
      cache.set(`${key}|braided`, c);
    }
    return c;
  }
  /*
    with a collar sewn on, the neck edge's topstitch goes, and a keyhole's own
    closure — see `underCollar`; and the crew and the V are cut as every
    collar was drafted against — see `CutSpec.collared`
  */
  if (collared) {
    const open = bodiceFor(id, sleeve, waist, buttons);
    let c = cache.get(`${key}|collared`);
    if (!c) {
      c = underCollar(open);
      cache.set(`${key}|collared`, c);
    }
    return c;
  }
  let b = cache.get(key);
  if (!b) {
    b = placketed ? withPlacket(bodiceFor(id, sleeve, waist, "none", false, false, drawnBare), waist) : bodice(id, sleeve, waist, drawnBare);
    cache.set(key, b);
  }
  return b;
}

/**
 * A bodice with a collar sewn on it.
 *
 * The collar covers the neck edge it is sewn to, so the topstitch along that
 * edge goes — under a band it showed as a row of dashes just below the band's
 * foot. Every bodice's stitch starts with its cut's, which starts with the
 * neck edge's; a shirt-dress keeps the rows down its placket.
 *
 * And a keyhole's own closure — its small button and the fabric loop round
 * it — gives way to the collar, which closes the neck itself. Under a band
 * they were hidden all but for slivers: the loop's rim showed through a
 * mandarin's V and just below the band's foot.
 */
function underCollar(b: Bodice): Bodice {
  const stitched = unstitched(b);
  if (!b.cut.loopRim) return stitched;
  const loop = b.cut.extras[0];
  const drop = (list: string[]) => list.filter((d) => d !== loop);
  const { loopRim: _rim, buttons: _own, ...cut } = stitched.cut;
  return {
    ...stitched,
    cut: { ...cut, extras: drop(b.cut.extras) },
    pieces: drop(b.pieces),
    ...(b.edges ? { edges: drop(b.edges) } : {}),
    ...(b.seamed ? { seamed: { ...b.seamed, edges: drop(b.seamed.edges) } } : {}),
  };
}

/** A bodice with its neck edge's topstitch taken off — under a collar, or under braid sewn along that edge. */
function unstitched(b: Bodice): Bodice {
  const neck = b.cut.neckStitch ?? b.cut.stitch;
  const off = (stitch: string) => (neck && stitch.startsWith(neck) ? stitch.slice(neck.length).trimStart() : stitch);
  const { neckStitch: _neck, ...sewn } = b.cut;
  return { ...b, stitch: off(b.stitch), cut: { ...sewn, stitch: off(b.cut.stitch) } };
}

/* ------------------------------------------------------------- buttons */

/** Whether a cut buttoned so wants a placket of its own: one it can be buttoned on, and has none already — see `OWN_PLACKET`. */
const placketOn = (id: NecklineId, buttons: ButtonsId): boolean =>
  buttons !== "none" && BUTTONED_CUTS.includes(id) && !OWN_PLACKET.includes(id);

/**
 * Her centre front: the centre of her neck, where every cut's opening is
 * centred — see `anatomy` in `necklines.ts`, which measures it at the same row.
 */
export const FRONT_X = draft("female").neck(164).center;

/** A pleated skirt's flat centre panel, buttoned to the hem: centred on the placket — see `PANEL_HALF`. */
export const PANEL: readonly [number, number] = [FRONT_X - PANEL_HALF, FRONT_X + PANEL_HALF];

/** A path's subpaths as points, its curves walked in short steps: absolute `M L H V C Z`, all the drafting writes. */
function flatten(d: string): Pt[][] {
  const tokens = d.match(/[A-Za-z]|-?[0-9]*[.]?[0-9]+(?:e-?[0-9]+)?/g) ?? [];
  const out: Pt[][] = [];
  let cur: Pt[] = [];
  let at: Pt = [0, 0];
  let cmd = "M";
  let i = 0;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) {
      cmd = tokens[i++];
      if (cmd === "Z") {
        if (cur.length) out.push(cur);
        cur = [];
        continue;
      }
    }
    if (cmd === "M") {
      if (cur.length) out.push(cur);
      at = [num(), num()];
      cur = [at];
      cmd = "L";
    } else if (cmd === "L") {
      at = [num(), num()];
      cur.push(at);
    } else if (cmd === "H") {
      at = [num(), at[1]];
      cur.push(at);
    } else if (cmd === "V") {
      at = [at[0], num()];
      cur.push(at);
    } else if (cmd === "C") {
      const [a, b, c]: Pt[] = [[num(), num()], [num(), num()], [num(), num()]];
      const p0 = at;
      for (let k = 1; k <= 12; k++) {
        const t = k / 12;
        const m = 1 - t;
        cur.push([
          m * m * m * p0[0] + 3 * m * m * t * a[0] + 3 * m * t * t * b[0] + t * t * t * c[0],
          m * m * m * p0[1] + 3 * m * m * t * a[1] + 3 * m * t * t * b[1] + t * t * t * c[1],
        ]);
      }
      at = c;
    } else {
      throw new Error(`flatten: no "${cmd}" in the drafting's vocabulary`);
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Whether a point is inside a path's cloth: even-odd across its subpaths, as one piece is filled. */
function inside(polys: Pt[][], x: number, y: number): boolean {
  let c = false;
  for (const p of polys) {
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const [xi, yi] = p[i];
      const [xj, yj] = p[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
  }
  return c;
}

/** Whether a point lies on a piece of cloth, for the tests and `check:garments` to hold what lies on it to. */
export const covers = (path: string, x: number, y: number): boolean => inside(flattened(path), x, y);

/** Each path flattened once: the tests and the checker ask of the same few thousands of times. */
const flat = new Map<string, Pt[][]>();
const flattened = (path: string): Pt[][] => {
  let polys = flat.get(path);
  if (!polys) {
    polys = flatten(path);
    flat.set(path, polys);
  }
  return polys;
};

/** A piece's left and right edges across a row — or `undefined` where it does not reach. */
export const across = (path: string, y: number): [number, number] | undefined => spanAt(flattened(path), y);

/** The first row, down a column, that is inside a piece — or `undefined`. */
function firstRow(polys: Pt[][], x: number, from: number, to: number): number | undefined {
  for (let y = from; y <= to; y += 0.25) if (inside(polys, x, y)) return y;
  return undefined;
}

/** A piece's left and right edges across a row, from its flattened outline — or `undefined` where it does not reach. */
function spanAt(polys: Pt[][], y: number): [number, number] | undefined {
  const xs: number[] = [];
  for (const p of polys) {
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const [xi, yi] = p[i];
      const [xj, yj] = p[j];
      if (yi > y !== yj > y) xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
    }
  }
  return xs.length >= 2 ? [Math.min(...xs), Math.max(...xs)] : undefined;
}

/**
 * A placket down a bodice's centre front, from its opening to its waist seam,
 * and where its first button may go.
 *
 * The placket starts where the cloth does at the centre front — the bottom of
 * a round opening, a V's point, a square's lower edge, a keyhole's drop — so
 * it never pokes into the opening; its top is level, at the lowest of the
 * opening across its width. Anything of the bodice's own drawn over it — an
 * off-shoulder's band — hides its top, and its first button goes below that.
 * Its foot runs under the skirt, which is sewn on over the bodice's hem.
 */
export interface Placket {
  /** The piece, and its two long edges: its top lies on the opening and its foot under the skirt, so neither is an edge. */
  path: string;
  sides: string;
  stitch: string;
  /** Where it starts and ends, and the highest row a button's centre may sit at. */
  top: number;
  foot: number;
  first: number;
}

function bodicePlacket(b: Bodice, waist: WaistId): Placket {
  const c = FRONT_X;
  const h = PLACKET_HALF;
  const body = flatten(b.pieces[0]);
  let top = 0;
  for (let x = c - h; x <= c + h + 1e-9; x += 2) top = Math.max(top, firstRow(body, x, 140, 420) ?? 0);
  top = Math.ceil((top + 0.5) * 4) / 4;
  /* what the bodice draws over its top: the button is to be seen */
  let clear = top;
  for (const piece of b.pieces.slice(1)) {
    const polys = flatten(piece);
    let y = top;
    let covered = false;
    while (y < top + 80 && inside(polys, c, y)) {
      covered = true;
      y += 0.25;
    }
    if (covered) clear = Math.max(clear, y);
  }
  const foot = seamAt(waist);
  const [l, r] = [c - h, c + h];
  const s = PLACKET_STITCH;
  return {
    path: outline(span([l, top], [l, foot], 5), span([l, foot], [r, foot], 2), span([r, foot], [r, top], 5)),
    sides: `M${l} ${top} L${l} ${foot} M${r} ${foot} L${r} ${top}`,
    stitch: [
      line(span([l + s, top + s], [l + s, foot - 5], 5)),
      line(span([r - s, top + s], [r - s, foot - 5], 5)),
    ].join(" "),
    top,
    foot,
    first: clear + BUTTON_FIRST,
  };
}

/** A bodice with a placket sewn on down its centre front, over its body and under everything else of it. */
function withPlacket(b: Bodice, waist: WaistId): Bodice {
  const p = bodicePlacket(b, waist);
  const insert = (list: string[], item: string): string[] => [list[0], item, ...list.slice(1)];
  return {
    ...b,
    pieces: insert(b.pieces, p.path),
    stitch: [b.stitch, p.stitch].join(" "),
    /* each piece's free edges, index for index: the placket's are its two long sides */
    ...(b.edges ? { edges: insert(b.edges, p.sides) } : b.seamed ? {} : { edges: insert(b.pieces, p.sides) }),
    ...(b.seamed ? { seamed: { ...b.seamed, edges: insert(b.seamed.edges, p.sides) } } : {}),
    placket: p,
  };
}

/**
 * Buttons evenly down a run, from no higher than `first` to `last` exactly:
 * as many as bring their spacing nearest `BUTTON_PITCH`'s 7.5 cm, the first
 * free to sit up to `BUTTON_SLIDE` lower than it might, to take up the
 * difference.
 */
export function buttonRun(first: number, last: number, want: number = BUTTON_PITCH[1]): { at: number[]; pitch: number } {
  const run = last - first;
  if (run < want / 2) return { at: [last], pitch: want };
  let best = { k: 1, pitch: run, off: Infinity };
  for (let k = 1; k <= 24; k++) {
    const pitch = Math.min(Math.max(want, (run - BUTTON_SLIDE) / k), run / k);
    if (Math.abs(pitch - want) < best.off) best = { k, pitch, off: Math.abs(pitch - want) };
  }
  return { at: Array.from({ length: best.k + 1 }, (_, i) => last - (best.k - i) * best.pitch), pitch: best.pitch };
}

/** A hem's row at a column, from the points its outline runs through. */
const hemAt = (hem: Pt[], x: number): number => {
  for (let i = 0; i + 1 < hem.length; i++) {
    const [ax, ay] = hem[i];
    const [bx, by] = hem[i + 1];
    if ((ax <= x && x <= bx) || (bx <= x && x <= ax)) return ax === bx ? Math.max(ay, by) : ay + ((x - ax) * (by - ay)) / (bx - ax);
  }
  return hem[hem.length - 1][1];
};

/**
 * The placket on through the skirt, from the skirt's top — which lies over
 * the bodice's — down to its hem, ending on the hem as it runs: dipping,
 * waving or stepping, as the skirt's does.
 */
function skirtPlacket(sk: CutSkirt) {
  const c = FRONT_X;
  const h = PLACKET_HALF;
  const [l, r] = [c - h, c + h];
  const top = sk.waistY;
  /* just inside the hem, so the placket's cloth never runs past the skirt's */
  const along: Pt[] = [];
  for (let x = r; x >= l - 1e-9; x -= 2) along.push([x, hemAt(sk.hem, x) - 0.5]);
  const s = PLACKET_STITCH;
  return {
    path: `M${l} ${top} L${r} ${top} ${along.map(([x, y]) => `L${x} ${y}`).join(" ")} Z`,
    sides: `M${l} ${top} L${l} ${along[along.length - 1][1]} M${r} ${along[0][1]} L${r} ${top}`,
    stitch: [
      `M${l + s} ${top} L${l + s} ${hemAt(sk.hem, l + s) - 4}`,
      `M${r - s} ${top} L${r - s} ${hemAt(sk.hem, r - s) - 4}`,
    ].join(" "),
    top,
    hem: hemAt(sk.hem, c),
  };
}

/** The skirt's placket, when the dress buttons on to the hem; each style and jacket cut once, kept. */
const skirtPlackets = new Map<string, ReturnType<typeof skirtPlacket>>();
export function skirtPlacketFor(inside?: Tuck, skirt: SkirtChoice = DEFAULT_SKIRT) {
  const key = `${skirtKey(skirt)}|${inside ? `${inside.y}|${inside.x}` : ""}`;
  if (!skirtPlackets.has(key)) skirtPlackets.set(key, skirtPlacket(skirtFor(inside, skirt, true)));
  return skirtPlackets.get(key)!;
}

/**
 * Every button down a dress's front, as worn — a cut's own, and those of
 * its placket — in groups of one size: a keyhole's small one at its closure,
 * then the placket's. The shirt-dress keeps its own four to the waist; on to
 * the hem, it and every other cut carry on at the same spacing below the
 * seam, the last at least `BUTTON_HEM_CLEAR` of a spacing above the hem.
 */
export function frontButtons(choice: GarmentChoice = {}): { groups: { at: Pt[]; r: number }[]; pitch?: number } {
  /* kept by all it reads: the cut, how it is buttoned, the waist, a collar's opening, the sleeve its bodice is drafted with — and, buttoned to the hem, the skirt its placket runs down */
  const s = choice.sleeve;
  const hem = choice.buttons === "hem" ? `${choice.skirt?.shape ?? ""}|${choice.skirt?.length ?? ""}` : "";
  const key = [cutOf(choice.neckline), choice.buttons ?? "none", choice.buttonRows ?? "one", choice.skirt?.waist ?? "natural", choice.opening ? 1 : 0, s ? `${s.type}|${s.length}|${s.cuff ?? ""}` : "", hem].join("/");
  let hit = frontsKept.get(key);
  if (!hit) {
    hit = frontButtonsOf(choice);
    frontsKept.set(key, hit);
  }
  return hit;
}
const frontsKept = new Map<string, { groups: { at: Pt[]; r: number }[]; pitch?: number }>();

function frontButtonsOf(choice: GarmentChoice): { groups: { at: Pt[]; r: number }[]; pitch?: number } {
  const id = cutOf(choice.neckline);
  const asked = choice.buttons ?? "none";
  /* over a mermaid, to the hem is to the waist */
  const buttons = asked === "hem" && !buttonedToHem(choice) ? "waist" : asked;
  const waist = choice.skirt?.waist ?? "natural";
  /* a cut's own closure stays only with no collar over it — see `underCollar` */
  const b = bodiceFor(id, choice.sleeve, waist, choice.buttonRows === "two" ? "none" : buttons, Boolean(choice.opening));
  const own = b.cut.buttons;
  if (buttons === "none" || !BUTTONED_CUTS.includes(id)) return { groups: own ? [own] : [] };
  /* two rows, to the waist, on a cut that takes them — see `doubleRows` */
  if (choice.buttonRows === "two" && buttons === "waist" && DOUBLE_CUTS.includes(id)) return doubleRows(b, waist);
  const last = seamAt(waist) - BUTTON_LAST;
  /* the shirt-dress's first button clears its collar's points, as it always has; any other cut's, its opening */
  const shirt = OWN_PLACKET.includes(id) && own ? own : undefined;
  let run = buttonRun(shirt ? shirt.at[0][1] : b.placket!.first, last);
  /* where that spaces the shirt-dress's buttons as they always were — at her waist — its own numbers draw them */
  if (shirt && run.at.length === shirt.at.length && run.at.every((y, i) => Math.abs(y - shirt.at[i][1]) < 1e-6)) {
    run = { at: shirt.at.map(([, y]) => y), pitch: run.pitch };
  }
  const ys = [...run.at];
  if (buttons === "hem") {
    const hem = skirtPlacketFor(undefined, { ...DEFAULT_SKIRT, ...choice.skirt }).hem;
    for (let y = ys[ys.length - 1] + run.pitch; y <= hem - BUTTON_HEM_CLEAR * run.pitch; y += run.pitch) ys.push(y);
  }
  const r = shirt ? shirt.r : BUTTON_R;
  const placket = { at: ys.map((y) => [FRONT_X, y] as Pt), r };
  /* a cut's own buttons that are not its placket's — a keyhole's at its closure — stay */
  const extra = own && !shirt ? [own] : [];
  return { groups: [...extra, placket], pitch: run.pitch };
}

/**
 * Two rows of buttons on a bodice, double-breasted, as photo 1's: one each
 * side of the centre front, `DOUBLE.apart` from it, level with each other;
 * spaced down it nearest `DOUBLE.pitch` — see `buttonRun` — from below the
 * opening where it runs over either row, and anything of the bodice's own
 * drawn over it there (an off-shoulder's band), to `DOUBLE.last` above the
 * waist seam. On the bodice itself: no placket.
 */
function doubleRows(b: Bodice, waist: WaistId): { groups: { at: Pt[]; r: number }[]; pitch: number } {
  const body = flatten(b.pieces[0]);
  const xs = [FRONT_X - DOUBLE.apart, FRONT_X + DOUBLE.apart];
  let first = 0;
  for (const c of xs) {
    /* the opening's lowest across the button, then below what covers it */
    let top = 0;
    for (let x = c - BUTTON_R; x <= c + BUTTON_R + 1e-9; x += 1) top = Math.max(top, firstRow(body, x, 140, 420) ?? 0);
    let clear = top;
    for (const piece of b.pieces.slice(1)) {
      const polys = flatten(piece);
      let y = top;
      while (y < top + 80 && inside(polys, c, y)) y += 0.25;
      clear = Math.max(clear, y);
    }
    first = Math.max(first, clear + BUTTON_FIRST + BUTTON_R);
  }
  const run = buttonRun(first, seamAt(waist) - DOUBLE.last, DOUBLE.pitch);
  return { groups: [{ at: xs.flatMap((x) => run.at.map((y) => [x, y] as Pt)), r: BUTTON_R }], pitch: run.pitch };
}

/**
 * How much of a button may lie under the belt with the button still drawn:
 * half. Covered by more, it would show only as a sliver at the belt's edge —
 * a ribbon's last button peeked a pixel above it — so it is not drawn at all;
 * and no button moves for it. The user's rule, round 25.
 */
export const BUTTON_HIDDEN_OVER = 0.5;

/**
 * What a choice's belt lays over the dress's front, piece by piece — its
 * band; a sash's bow; on a fabric belt a tie knotted on it, or else its
 * buckle — each flattened on its own, since pieces overlap. None with no
 * belt on. Kept by belt, skirt and tie.
 */
export function beltCover(choice: GarmentChoice): CoverPiece[] {
  const belt = beltWorn(choice);
  if (!belt) return [];
  const skirt = { ...DEFAULT_SKIRT, ...choice.skirt };
  const sash = sashOf(choice);
  const place = bowPlaceOf(choice);
  const tied = !sash && choice.tieAt && choice.tieAt !== "neck" && (choice.tie === "knot" || choice.tie === "scarf") ? choice.tie : undefined;
  const key = `${skirtKey(skirt)}|${belt}|${sash ?? ""}|${place}|${tied ?? ""}|${tied ? choice.tieAt : ""}`;
  let cover = beltCovers.get(key);
  if (cover) return cover;
  const pieces: string[] = [];
  if (sash) {
    const s = sashOn(skirt, sash, place);
    pieces.push(s.path, ...s.bow.pieces);
  } else {
    const b = beltFor(skirt);
    pieces.push(b.path);
    const at = tied ? tiePoint(choice) : null;
    if (tied && at) pieces.push(...tieAt(tied, at, choice.tieAt, narrowSkirt(skirt)).pieces);
    else {
      const { x, y, w, h } = b.buckle;
      pieces.push(`M${x - w / 2} ${y - h / 2} L${x + w / 2} ${y - h / 2} L${x + w / 2} ${y + h / 2} L${x - w / 2} ${y + h / 2} Z`);
    }
  }
  cover = pieces.map((d) => {
    const polys = flattened(d);
    return { polys, box: boundsOf(polys) };
  });
  beltCovers.set(key, cover);
  return cover;
}
const beltCovers = new Map<string, CoverPiece[]>();

/** A piece of what a belt lays over the dress: flattened, and its bounds — see `beltCover`. */
export interface CoverPiece {
  polys: Pt[][];
  box: [x0: number, y0: number, x1: number, y1: number];
}

/** The bounds of a flattened piece: its least and greatest x and y. */
const boundsOf = (polys: Pt[][]): [number, number, number, number] => {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of polys)
    for (const [x, y] of p) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  return [x0, y0, x1, y1];
};

/**
 * The share of a button — a disc `r` across, at `at` — lying under any piece
 * of a belt's: sampled on a 12 × 12 grid across the button, the samples that
 * fall on the disc counted.
 */
export function coveredShare(cover: CoverPiece[], [cx, cy]: Pt, r: number): number {
  /* kept by belt and button: the same belt over the same button, cut after cut */
  let kept = sharesKept.get(cover);
  if (!kept) sharesKept.set(cover, (kept = new Map()));
  const key = `${cx},${cy},${r}`;
  const hit = kept.get(key);
  if (hit !== undefined) return hit;
  const share = shareUnder(cover, cx, cy, r);
  kept.set(key, share);
  return share;
}
const sharesKept = new WeakMap<CoverPiece[], Map<string, number>>();

function shareUnder(cover: CoverPiece[], cx: number, cy: number, r: number): number {
  const near = cover.filter(({ box: [x0, y0, x1, y1] }) => x0 <= cx + r && x1 >= cx - r && y0 <= cy + r && y1 >= cy - r);
  if (near.length === 0) return 0;
  const step = r / 6;
  let n = 0;
  let hit = 0;
  for (let i = 0; i < 12; i++) {
    const y = cy - r + (i + 0.5) * step;
    /* each piece's edges crossing this row, once for the row's samples: a sample is inside where an odd number lie to its right — `inside`'s own test */
    const rows = near.map((p) => crossingsAt(p.polys, y));
    for (let j = 0; j < 12; j++) {
      const x = cx - r + (j + 0.5) * step;
      if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
      n++;
      if (rows.some((xs) => xs.filter((v) => x < v).length % 2 === 1)) hit++;
    }
  }
  return n ? hit / n : 0;
}

/** Where a piece's edges cross a row, as `inside` finds them. */
function crossingsAt(polys: Pt[][], y: number): number[] {
  const xs: number[] = [];
  for (const p of polys)
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const [xi, yi] = p[i];
      const [xj, yj] = p[j];
      if (yi > y !== yj > y) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
    }
  return xs;
}

/**
 * The buttons down a dress's front that are drawn, as worn: every one of
 * `frontButtons`, where it is — none moves — less any the belt covers by more
 * than `BUTTON_HIDDEN_OVER`: see `beltCover`.
 */
export function shownButtons(choice: GarmentChoice = {}): { groups: { at: Pt[]; r: number }[]; pitch?: number } {
  const all = frontButtons(choice);
  const cover = beltCover(choice);
  if (cover.length === 0) return all;
  const groups = all.groups.map((g) => ({ ...g, at: g.at.filter((p) => coveredShare(cover, p, g.r) <= BUTTON_HIDDEN_OVER) })).filter((g) => g.at.length > 0);
  return { ...all, groups };
}

/** The cut a choice names, or the one the dress arrives in. */
const cutOf = (neckline?: string): NecklineId =>
  (NECKLINE_IDS as readonly string[]).includes(neckline ?? "") ? (neckline as NecklineId) : DEFAULT_CUT;

/* ---------------------------------------------------------------- belt */

/**
 * A belt over the waist seam, at any waist: `BELT_WIDTH` deep, centred
 * `BELT_ABOVE_SEAM` above the row the skirt is sewn at, which is where the
 * seam shows. Across each row it reaches `BELT_OUT` past the dress — past the
 * bodice above the seam, as drawn, and the skirt below it, whichever comes
 * further out —
 * so it lies over the dress rather than in it, and the skirt comes out from
 * under it. Its buckle is at her centre front.
 */
export function beltFor(skirt: SkirtChoice = DEFAULT_SKIRT) {
  const seam = seamAt(skirt.waist);
  const mid = seam - BELT_ABOVE_SEAM;
  const [top, bottom] = [mid - BELT_WIDTH / 2, mid + BELT_WIDTH / 2];
  const leftAt = dressSideAt(skirt);
  const rows: number[] = [];
  for (let y = top; y < bottom; y += 2) rows.push(y);
  rows.push(bottom);
  const left: Pt[] = rows.map((y) => [leftAt(y), y]);
  const path = `M${left.map(([x, y]) => `${x.toFixed(2)} ${y}`).join(" L")} ` +
    `L${[...left].reverse().map(([x, y]) => `${(600 - x).toFixed(2)} ${y}`).join(" L")} Z`;
  return {
    path,
    top,
    bottom,
    mid,
    seam,
    left,
    buckle: { x: FRONT_X, y: mid, ...BUCKLE },
  };
}

/**
 * Where a band round her waist ends at her left, row by row: `BELT_OUT`
 * past the dress — past the bodice above the seam, as drawn, and the skirt
 * below it, whichever comes further out — so it lies over the dress rather
 * than in it, and the skirt comes out from under it.
 */
function dressSideAt(skirt: SkirtChoice): (y: number) => number {
  const sk = skirtFor(undefined, skirt);
  const seam = seamAt(skirt.waist);
  const d = draft("female");
  const polys = flatten(sk.path);
  /* the bodice as drawn, its body piece: it stands a little further out than her side plus its ease under the bust */
  const body = flatten(bodiceFor("round", DEFAULT_SLEEVE, skirt.waist).pieces[0]);
  return (y: number) => {
    const x = [y <= seam ? Math.min(d.sideAt(y, EASE), spanAt(body, y)?.[0] ?? Infinity) : Infinity, spanAt(polys, y)?.[0] ?? Infinity];
    return Math.min(...x) - BELT_OUT;
  };
}

/* ---------------------------------------------------------------- sash */

/**
 * The sash a choice wears, if it wears one: a wrap's own, always — see
 * `SASHED_CUTS` — else the sash or the ribbon chosen for its belt.
 */
export const sashOf = (choice: GarmentChoice): SashId | undefined =>
  SASHED_CUTS.includes(cutOf(choice.neckline)) ? "sash" : isSash(choice.belt) ? choice.belt : undefined;

/** Where a choice's sash is tied: a wrap's at her left side, where its panels cross; else as chosen, at the front to begin with. */
export const bowPlaceOf = (choice: GarmentChoice): BowAtId => (SASHED_CUTS.includes(cutOf(choice.neckline)) ? "side" : (choice.bowAt ?? "front"));

/** The belt a choice wears, if it wears one its cut takes: a wrap its sash, whatever is asked; any other cut what was chosen. */
export const beltWorn = (choice: GarmentChoice): Exclude<BeltId, "none"> | undefined =>
  sashOf(choice) ?? (choice.belt && choice.belt !== "none" ? choice.belt : undefined);

/** A sash round the waist, tied in a belt bow — see `sashOn`. */
export interface Sash {
  kind: SashId;
  /** The cloth's width, and so the band's where nothing pulls it. */
  width: number;
  /** The band, round her over the waist seam, pinched toward the knot. */
  path: string;
  top: number;
  bottom: number;
  mid: number;
  /** Its left edge, row by row, top to bottom — mirrored for its right. */
  left: Pt[];
  /** The knot, on the band's middle row: at the centre front, or at her left side. */
  knot: Pt;
  place: BowAtId;
  bow: BowPieces;
  /** The folds the bow pulls into the band, either side of the knot — see `sashOn`. */
  gathers: FoldSpec[];
}

/** How far past its loops' ends the bow pulls the band, as a share of its width: where its gathers start. */
const SASH_PULL = 0.7;
/** How far either side of the knot the band's edges draw in, at most, as a share of its width. */
const SASH_PINCH = 2;

/**
 * A sash «حزام فيونكة» or a ribbon «شريطة» round the waist, as photo 2's and photo 4's:
 * a soft band of cloth `SASHES[kind].width` deep, centred where a belt is,
 * reaching `BELT_OUT` past the dress at its sides as a belt does, and tied
 * in the belt bow — see `bowAt` — at the centre front or at her left side,
 * where every tie on the belt is knotted — see `beltSideAt`. Where the bow
 * pulls it the band is gathered: three soft folds a side run along it,
 * drawing in toward the knot, from `SASH_PULL` widths past the loops' ends
 * — so they show beyond the loops — to under the knot; and its edges draw in
 * to the knot's height over the same stretch, but no further out than
 * `SASH_PINCH` widths, so a narrow ribbon is drawn in only under its loops.
 * The wrap's sash is the same sash at her side, in the width of a sash.
 */
export function sashOn(skirt: SkirtChoice, kind: SashId, place: BowAtId): Sash {
  const key = `${skirtKey(skirt)}|${kind}|${place}`;
  let cached = sashes.get(key);
  if (cached) return cached;
  const w = SASHES[kind].width;
  const b = beltFor(skirt);
  const { mid } = b;
  const [top, bottom] = [mid - w / 2, mid + w / 2];
  const kx = place === "front" ? FRONT_X : beltSideAt(skirt, b, beltEndAt(b));
  const knot: Pt = [kx, mid];
  const bow = bowAt(knot, place, w, narrowSkirt(skirt));
  /* the band's edges drawn in to the knot's height, smoothly, from where the bow's pull starts — at most SASH_PINCH widths out */
  const kh = 0.78 * w;
  const pull = bow.reach + SASH_PULL * w;
  const zone = Math.min(pull, SASH_PINCH * w);
  const pinch = (x: number) => {
    const t = Math.abs(x - kx) / zone;
    return t >= 1 ? 0 : ((w - kh) / 2) * Math.cos((Math.PI * t) / 2) ** 2;
  };
  const sideAt = dressSideAt(skirt);
  const rows: number[] = [];
  for (let y = top; y < bottom; y += 2) rows.push(y);
  rows.push(bottom);
  const left: Pt[] = rows.map((y) => [sideAt(y), y]);
  const right: Pt[] = left.map(([x, y]) => [600 - x, y] as Pt);
  /*
    Its gathers: either side of the knot, three folds along the band, from
    where the pull starts — inside the band's end — in to under the knot,
    drawing in toward its middle row as the band does; deepest at the knot.
  */
  const [lo, hi] = [sideAt(mid), 600 - sideAt(mid)];
  const s = w / SASHES.sash.width;
  const gathers: FoldSpec[] = ([-1, 1] as const).flatMap((side) => {
    const far = side < 0 ? Math.max(lo + 3, kx - pull) : Math.min(hi - 3, kx + pull);
    const near = kx + side * 0.3 * w;
    if (Math.abs(far - near) < 6) return [];
    return [-1, 0, 1].flatMap((j): FoldSpec[] => {
      const ridge: Pt[] = [
        [far, mid + j * 0.27 * w],
        [(far + near) / 2, mid + j * 0.27 * ((w + kh) / 2)],
        [near, mid + j * 0.27 * 0.8 * kh],
      ];
      /* a crisp crest over a broad soft turn, as every fold of the bow's — see `bowAt` */
      return [
        [ridge, [0.45, 0.7], 0.28, 0.16, 0.8],
        [ridge, [0.5 * s, 0.12 * w], 0.12, 0.08, 2],
      ];
    });
  });
  /* along the top and the bottom, a point every four units, each on the pinched edge */
  const along = (x0: number, x1: number, y: number, sign: 1 | -1): Pt[] => {
    const n = Math.max(1, Math.ceil(Math.abs(x1 - x0) / 4));
    return Array.from({ length: n + 1 }, (_, i) => {
      const x = x0 + ((x1 - x0) * i) / n;
      return [x, y + sign * pinch(x)] as Pt;
    });
  };
  /* round it: down her right end, along the bottom, up her left end, back along the top */
  const bottomEdge = along(left[left.length - 1][0], right[right.length - 1][0], bottom, -1).slice(1, -1);
  const topEdge = along(right[0][0], left[0][0], top, 1).slice(1, -1);
  const ring: Pt[] = [...left, ...bottomEdge, ...[...right].reverse(), ...topEdge];
  const path = `M${ring.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(" L")} Z`;
  cached = { kind, width: w, path, top, bottom, mid, left, knot, place, bow, gathers };
  sashes.set(key, cached);
  return cached;
}
const sashes = new Map<string, Sash>();

/** Whether a skirt is a narrow one — a pencil, a mermaid — which a bow's tails at the front spread less over: see `NARROW_SKIRTS`. */
export const narrowSkirt = (skirt: SkirtChoice): boolean => NARROW_SKIRTS.includes(skirt.shape);

/** The sash a choice wears, as it is tied — see `sashOf`, `bowPlaceOf` — or none. */
export const sashFor = (choice: GarmentChoice): Sash | null => {
  const kind = sashOf(choice);
  return kind ? sashOn({ ...DEFAULT_SKIRT, ...choice.skirt }, kind, bowPlaceOf(choice)) : null;
};

/** Every cut in the sleeve the dress arrives in — what the checker walks first. */
export const BODICES: Record<NecklineId, Bodice> = Object.fromEntries(
  NECKLINE_IDS.map((id) => [id, bodiceFor(id)])
) as Record<NecklineId, Bodice>;

/** Every bodice's cloth, by cut — what `check:garments` rasterises. */
export const NECKLINE_PATHS: Record<string, string[]> = Object.fromEntries(
  NECKLINE_IDS.map((id) => [id, BODICES[id].pieces])
);

/** The seam each cut offers a collar. Empty where it offers none. */
export const NECKLINE_SEAMS: Record<string, string> = Object.fromEntries(
  NECKLINE_IDS.map((id) => [id, BODICES[id].cut.seam])
);

/** The cut the dress arrives in when nothing has chosen one. */
export const DEFAULT_CUT: NecklineId = "round";

/**
 * Every piece of cloth the dress is made of, for one choice — bodice and
 * skirt: its cut, its sleeve, its skirt, and the jacket it is worn under.
 *
 * What `check:garments` rasterises. It is a function rather than a table so
 * that the checker and the renderer ask the same question and cannot be given
 * two different answers.
 */
export const cloth = (choice: GarmentChoice = {}): string[] => {
  const { neckline, sleeve, inside, skirt, opening } = choice;
  const toHem = buttonedToHem(choice);
  return [
    /* with a collar on it, a keyhole without its own loop — see `underCollar`; in two rows, no placket */
    /* as drawn: with no collar sewn on, bare — see `CutSpec.bare` — so what is checked is what is drawn */
    ...bodiceFor(cutOf(neckline), sleeve, skirt?.waist, placketButtons(choice), Boolean(opening), false, !opening).pieces,
    /* buttoned to the hem: its placket on through the skirt, and a pleated skirt's flat panel under it */
    skirtFor(inside, skirt, toHem).path,
    ...(toHem ? [skirtPlacketFor(inside, skirt).path] : []),
  ];
};

/**
 * A bodice's details for one cut at one waist — its buttons and its tie —
 * beside the cloth they must lie on and the seam they must end above, for
 * `check:garments` to hold them to it: moved with the waist, every one of
 * them has to move with it.
 */
export function details(id: NecklineId, waist: WaistId = "natural") {
  const b = bodiceFor(id, DEFAULT_SLEEVE, waist);
  /* as it arrives: a shirt-dress buttoned to the waist, spaced as `frontButtons` spaces it; a keyhole's closure */
  const { groups } = frontButtons({ neckline: id, skirt: { ...DEFAULT_SKIRT, waist }, buttons: OWN_PLACKET.includes(id) ? "waist" : "none" });
  return {
    pieces: b.pieces,
    seamY: seamAt(waist),
    buttons: groups[0] ?? null,
    tie: b.cut.wrap?.tie ?? null,
  };
}

/* ------------------------------------------------------------ stripes */

/**
 * The bodice as the dress draws it for a choice: its cut, sleeve and waist,
 * the placket it is buttoned with, and taken under a collar — see `topFor`
 * in `dress.tsx`, which draws this same one.
 */
export function drawnBodice(choice: GarmentChoice): Bodice {
  const id = cutOf(choice.neckline);
  const sleeve = choice.sleeve ?? DEFAULT_SLEEVE;
  const waist = choice.skirt?.waist ?? "natural";
  const buttons = placketButtons(choice);
  const placket = bodiceFor(id, sleeve, waist, buttons).placket !== undefined;
  /* as drawn: with no collar sewn on, bare — see `CutSpec.bare` */
  return bodiceFor(id, sleeve, waist, placket ? buttons : "none", Boolean(choice.opening), false, !choice.opening);
}

/**
 * How far above the skirt's hem its stripes start, past the hem's own turn:
 * 8 units, 1.5 cm, on top of each stripe's distance in — see `STRIPES`.
 */
export const HEM_STRIPE_INSET = 8;

/**
 * The stripes a choice wears on the dress itself, each with the piece of its
 * region it lies on — the sailor collar's own are drawn on the collar: round
 * each sleeve's hem and the skirt's, when its collar's stripes go so far; or
 * along a boat neckline, with no collar on. The same count everywhere.
 */
export function dressStripes(choice: GarmentChoice): { top: Inlay[]; bottom: Inlay[]; belt: Inlay[] } {
  const st = choice.stripes;
  if (!st) return NO_STRIPES;
  /* cut once per everything they are laid on, and kept: the stage asks on every render */
  const sleeve = choice.sleeve ?? DEFAULT_SLEEVE;
  const skirt = choice.skirt ?? DEFAULT_SKIRT;
  const key = [
    cutOf(choice.neckline),
    sleeve.type,
    sleeve.length,
    sleeve.cuff ?? "",
    skirtKey(skirt),
    placketButtons(choice),
    choice.opening ?? "",
    choice.inside ? `${choice.inside.y}|${choice.inside.x}` : "",
    choice.belt ?? "",
    st.count,
    st.on.join(","),
  ].join("|");
  let laid = stripesCut.get(key);
  if (!laid) stripesCut.set(key, (laid = layStripes(choice, st)));
  return laid;
}

const NO_STRIPES = { top: [], bottom: [], belt: [] };
const stripesCut = new Map<string, { top: Inlay[]; bottom: Inlay[]; belt: Inlay[] }>();

function layStripes(choice: GarmentChoice, st: NonNullable<GarmentChoice["stripes"]>): { top: Inlay[]; bottom: Inlay[]; belt: Inlay[] } {
  const bands = STRIPES[st.count];
  const edges = dressEdges(choice);
  const along = (kind: EdgeKind) => edges.filter((e) => e.kind === kind).flatMap((e) => stripesAlong(e, bands));
  /* along each edge chosen: the neckline and the sleeves' hems on the bodice, the skirt's on the skirt — a collar's are its own */
  const top = [...(st.on.includes("neckline") ? along("neckline") : []), ...(st.on.includes("sleeves") ? along("sleeve") : [])];
  const bottom = st.on.includes("hem") ? along("hem") : [];
  /* along a fabric belt, on the belt */
  const belt = st.on.includes("belt") ? along("belt") : [];
  return { top, bottom, belt };
}

/** The direction from a hem onto its cloth: square to the hem, toward the piece. */
function intoCloth(hem: Pt[], piece: string): Pt {
  const rings = ringsOf(piece);
  const [a, b] = [hem[0], hem[hem.length - 1]];
  const n: Pt = [-(b[1] - a[1]), b[0] - a[0]];
  const l = Math.hypot(n[0], n[1]) || 1;
  const unitN: Pt = [n[0] / l, n[1] / l];
  const mid = hem[Math.floor(hem.length / 2)];
  for (const d of [3, 6, 10]) {
    if (insideRings(rings, [mid[0] + unitN[0] * d, mid[1] + unitN[1] * d])) return unitN;
    if (insideRings(rings, [mid[0] - unitN[0] * d, mid[1] - unitN[1] * d])) return [-unitN[0], -unitN[1]];
  }
  return [0, -1];
}

/* -------------------------------------------------------------- edges */

/**
 * Every edge of the dress a part can be laid along, as a choice cuts it —
 * see `edges.ts`: its neckline's, where its cut has one drafted and no collar
 * covers it; each sleeve's hem; and its skirt's hem.
 */
export function dressEdges(choice: GarmentChoice): Edge[] {
  const b = drawnBodice(choice);
  return finished([...necklineEdges(b, choice), ...sleeveEdges(b, choice.sleeve ?? DEFAULT_SLEEVE), hemEdge(choice), ...beltEdges(choice)], choice.stripes?.on ?? []);
}

/** Whether a choice wears a fabric belt: a belt in cloth, on a cut that takes one — see `beltWorn`. */
export const fabricBelt = (choice: GarmentChoice): boolean => beltWorn(choice) === "self";

/**
 * Along a fabric belt, at its foot: its whole width to lay in, braid centred
 * across it — see `Edge.centred` — on the belt's one piece. The belt is
 * drawn with the skirt, over it: see `beltArt`.
 */
function beltEdges(choice: GarmentChoice): Edge[] {
  if (!fabricBelt(choice)) return [];
  const b = beltFor(choice.skirt ?? DEFAULT_SKIRT);
  const foot = b.left[b.left.length - 1][0];
  const line = densifyRow(foot, 600 - foot, b.bottom);
  return [{ kind: "belt", line, pieces: [{ index: 0, d: b.path }], lay: { by: "level", into: [0, -1], inset: 0 }, room: b.bottom - b.top, centred: true }];
}

/** A row from x0 to x1 at y, a point every unit. */
const densifyRow = (x0: number, x1: number, y: number): Pt[] => {
  const n = Math.max(1, Math.ceil(x1 - x0));
  return Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, y] as Pt);
};

/**
 * The pieces of the bodice a choice's sleeves end in — cuffs, wide bands, a
 * puff's or a bishop's band — by index in its `pieces`: what a cloth of the
 * sleeves' ends is laid over. See `hasSleeveEnd`, which says the same of a
 * choice without drawing it; a test holds the two together.
 */
export function sleeveEndPieces(choice: GarmentChoice): number[] {
  const b = drawnBodice(choice);
  const ends = b.ends ?? [];
  return ends.map((d) => b.pieces.indexOf(d)).filter((i) => i >= 0);
}

/** How near two edges' ends must be to meet at a corner, in units. */
const MEET = 1.5;

/** The stripe toggle each kind of edge answers to. */
const TOGGLE: Record<Edge["kind"], StripeEdgeId> = { neckline: "neckline", sleeve: "sleeves", hem: "hem", collar: "collar", belt: "belt" };

/**
 * The bodice's turning edges told where they meet and what they run beside —
 * see `Edge.meets`, `Edge.against` and `Edge.room`: a cap sleeve's edge
 * meets the neckline's at the tip of each shoulder, and runs close beside a
 * square neckline, so braid along either ends in a mitre at the other, and is
 * drawn finer where the cloth between them narrows — sharing it, where both
 * are striped. Hems run on round the body at their sides, and are left as
 * they are.
 */
function finished(edges: Edge[], striped: readonly StripeEdgeId[]): Edge[] {
  const turning = edges.filter((e) => e.lay.by === "follow");
  if (turning.length < 2) return edges;
  const ends = (e: Edge): [Pt, Pt] => [e.line[0], e.line[e.line.length - 1]];
  /* the direction from a corner a few units along an edge, back into it */
  const inward = (e: Edge, head: boolean): Pt => {
    const pts = head ? e.line : [...e.line].reverse();
    const q = pts[Math.min(pts.length - 1, 4)];
    const v: Pt = [q[0] - pts[0][0], q[1] - pts[0][1]];
    const l = Math.hypot(v[0], v[1]) || 1;
    return [v[0] / l, v[1] / l];
  };
  const want = STRIPES.three[STRIPES.three.length - 1][1] + BAND_STRIPE_ROOM;
  return edges.map((e) => {
    if (e.lay.by !== "follow") return e;
    const others = turning.filter((o) => o !== e);
    const meets: NonNullable<Edge["meets"]> = {};
    /* how far along it from each corner the mitre reaches past the deepest row: no narrowing counts there */
    const zones: { at: Pt; reach: number }[] = [];
    ends(e).forEach((at, k) => {
      for (const o of others) {
        ends(o).forEach((oat, ok) => {
          if (Math.hypot(at[0] - oat[0], at[1] - oat[1]) > MEET) return;
          const a = inward(e, k === 0);
          const c = inward(o, ok === 0);
          const m: Pt = [a[0] + c[0], a[1] + c[1]];
          const l = Math.hypot(m[0], m[1]);
          if (l < 1e-6) return;
          meets[k === 0 ? "head" : "tail"] = { at, dir: [m[0] / l, m[1] / l] };
          const half = Math.acos(Math.max(-1, Math.min(1, a[0] * c[0] + a[1] * c[1]))) / 2;
          zones.push({ at, reach: want / Math.max(0.2, Math.tan(half)) + 2 });
        });
      }
    });
    /*
      Where the cloth between it and another edge narrows mid-way to less than
      three rows need — a square's corner close to a cap sleeve's edge — the
      rows are drawn finer to pass, as on a narrow band: none cut off there.
      Where the other edge is striped too, each has half of what lies between.
    */
    const room = roomBeside(e, others.map((o) => ({ line: o.line, shared: striped.includes(TOGGLE[o.kind]) && striped.includes(TOGGLE[e.kind]) })), zones);
    return {
      ...e,
      ...(meets.head || meets.tail ? { meets } : {}),
      ...(others.length ? { against: others.map((o) => o.line) } : {}),
      ...(room < want ? { room } : {}),
    };
  });
}

/**
 * The least cloth between an edge and the other edges it runs beside,
 * measured square off it onto its cloth: how deep rows laid along it can go —
 * half of it, beside an edge whose own rows share it. At each of its own
 * corners, measured along the corner's mitre too, which reaches further than
 * the rows' depth. Not near a corner it meets another edge at, within each
 * zone's reach: the rows end in a mitre there before they come close.
 */
function roomBeside(e: Edge, others: { line: Pt[]; shared: boolean }[], zones: { at: Pt; reach: number }[]): number {
  if (e.lay.by !== "follow" || others.length === 0) return Infinity;
  const lay = e.lay;
  const segments = others.flatMap((o) => o.line.slice(1).map((b, i) => ({ c: o.line[i], d: b, share: o.shared ? 0.5 : 1 })));
  /* every unit of it: a square's side is one straight line, two points */
  const pts = densify(e.line, 1);
  /* the cloth's side of a direction */
  const onCloth = (p: Pt, u: Pt): Pt => {
    let n: Pt = [-u[1], u[0]];
    if (lay.side !== undefined) n = [n[0] * lay.side, n[1] * lay.side];
    else if (lay.toward && n[0] * (lay.toward[0] - p[0]) + n[1] * (lay.toward[1] - p[1]) < 0) n = [-n[0], -n[1]];
    return n;
  };
  /* how far a ray from p along n runs before it meets another edge, as a share of what rows may take of it */
  const ray = (p: Pt, n: Pt): number => {
    let least = Infinity;
    const r: Pt = [n[0] * 40, n[1] * 40];
    for (const { c, d, share } of segments) {
      const s: Pt = [d[0] - c[0], d[1] - c[1]];
      const den = r[0] * s[1] - r[1] * s[0];
      if (Math.abs(den) < 1e-9) continue;
      const q: Pt = [c[0] - p[0], c[1] - p[1]];
      const t = (q[0] * s[1] - q[1] * s[0]) / den;
      const u = (q[0] * r[1] - q[1] * r[0]) / den;
      if (t > 0 && t <= 1 && u >= 0 && u <= 1) least = Math.min(least, t * 40 * share);
    }
    return least;
  };
  const free = (p: Pt) => !zones.some((z) => Math.hypot(p[0] - z.at[0], p[1] - z.at[1]) < z.reach);
  const unitOf = (a: Pt, b: Pt): Pt => {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  };
  let least = Infinity;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    if (free(p)) least = Math.min(least, ray(p, onCloth(p, unitOf(pts[i - 1], pts[i + 1]))));
  }
  /* each corner: rows turn it in a mitre, which reaches 1 / cos(half the turn) of their depth */
  if (lay.corners) {
    for (const i of cornersOf(pts)) {
      const p = pts[i];
      if (!free(p) || i < 3 || i > pts.length - 4) continue;
      const a = unitOf(pts[i - 3], p);
      const b = unitOf(p, pts[i + 3]);
      const [na, nb] = [onCloth(p, a), onCloth(p, b)];
      const m: Pt = [na[0] + nb[0], na[1] + nb[1]];
      const ml = Math.hypot(m[0], m[1]);
      if (ml < 1e-6) continue;
      const half = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1]))) / 2;
      least = Math.min(least, ray(p, [m[0] / ml, m[1] / ml]) * Math.cos(half));
    }
  }
  return least;
}

/**
 * Each sleeve's hem: a sewn or loose sleeve's own hem — or, where a band or a
 * cuff is sewn on below it, the band's foot, with only the band's depth to
 * lay into — on the sleeve and the band; a kimono's or a dolman's, cut on
 * with the bodice, on the bodice; and a cap's free edge round the arm, which
 * is all the hem a cap has. Nothing sleeveless.
 */
function sleeveEdges(b: Bodice, sleeve: SleeveChoice): Edge[] {
  const k = b.sleeveCut;
  if (!k || sleeve.length === "sleeveless") return [];
  const hem = k.raw?.hem ?? k.left.cutOn?.hem;
  const out: Edge[] = [];
  for (const side of [0, 1] as const) {
    const flip = (pts: Pt[]): Pt[] => (side === 0 ? pts : pts.map(([x, y]) => [600 - x, y] as Pt));
    const cloth = k.sleeves[side] ?? k.body;
    const pieces = [cloth, k.bands[side]]
      .filter((d): d is string => Boolean(d))
      .map((d) => ({ index: b.pieces.indexOf(d), d }))
      .filter((p) => p.index >= 0);
    if (hem) {
      const at = flip(hem);
      const into = intoCloth(at, cloth);
      /*
        A band or cuff hangs below the sleeve's hem, sewn to it there: the
        sleeve's end is then the band's foot, and the stripes go round the band.
      */
      const band = k.bands[side];
      const mid = at[Math.floor(at.length / 2)];
      const up = band ? ringsOf(band).flat().map(([x, y]) => (x - mid[0]) * into[0] + (y - mid[1]) * into[1]) : [0];
      const below = Math.max(0, -Math.min(...up));
      out.push({
        kind: "sleeve",
        side,
        line: at.map(([x, y]) => [x - into[0] * below, y - into[1] * below] as Pt),
        pieces,
        lay: { by: "level", into, inset: 0 },
        /* on a band, only the band's depth: what is laid there is fitted to it — see `fittedBands` — and on a wide band, centred */
        ...(band ? { room: Math.max(...up) + below } : {}),
        ...(band && sleeve.cuff === "band" ? { centred: true as const } : {}),
      });
    } else if (sleeve.type === "cap") {
      /* along the cap's edge from its end on the arm, stopping at the underarm */
      out.push({
        kind: "sleeve",
        side,
        line: flip(k.left.armhole),
        pieces,
        lay: { by: "follow", toward: side === 0 ? [262, 214] : [338, 214], round: 12, ends: [16, 0] },
      });
    }
  }
  return out;
}

/**
 * Along the neckline and on across the shoulders either side of it, to the
 * armholes: the bodice's whole top edge, on the bodice and what is sewn to
 * it — a placket — but never a sleeve, which lies over its ends. None where a
 * collar is sewn over it.
 *
 * The boat's is the one approved first, an even curve between its shoulder
 * lines, laid toward the middle of the chest. Every other cut's is its own
 * top edge as drawn, right tip round to left — a V down to its point and up,
 * a square round its four corners, a sweetheart over both curves — and its
 * stripes turn each corner square, mitred, as braid does; an off-shoulder's
 * is its band's top edge, across both arms.
 */
function necklineEdges(b: Bodice, choice: GarmentChoice): Edge[] {
  const id = cutOf(choice.neckline);
  if (choice.opening || !NECKLINE_EDGED.includes(id)) return [];
  const sleeves = new Set([...(b.sleeveCut?.sleeves ?? []), ...(b.sleeveCut?.bands ?? []), ...(b.bandSleeves?.paths ?? [])]);
  const pieces = b.pieces.map((d, index) => ({ index, d })).filter(({ d }) => !sleeves.has(d));
  const neck = b.cut.neck;
  const parts = b.cut.parts;
  if (id === "boat" && neck && parts) {
    const arc = Array.from({ length: 49 }, (_, i) => {
      const t = Math.PI - (i / 48) * Math.PI;
      return [neck.center + neck.half * Math.cos(t), neck.seamY + neck.dip * Math.sin(t)] as Pt;
    });
    const line = [...reverse(parts.strapLeft), ...arc.slice(1, -1), ...reverse(parts.strapRight)];
    return [{ kind: "neckline", line, pieces, lay: { by: "follow", toward: [300, 262], round: 12, ends: [20, 20] } }];
  }
  const line = b.cut.band ? b.cut.band.top : upperEdge(b);
  if (line.length < 2) return [];
  const host = b.cut.band ? pieces.map((p) => p.d) : [b.pieces[0]];
  const lay = (run: Pt[]) => ({ by: "follow" as const, side: clothSide(run, host), round: 6, ends: [16, 16] as const, corners: true as const });
  /* a halter's neckband lies over the top of its edge: braid runs up each armhole to the band, two edges, a pair */
  if (b.cut.halter) {
    const band = ringsOf(b.cut.extras[0] ?? "");
    const fine = densify(line, 1);
    const runs: Pt[][] = [];
    let run: Pt[] = [];
    for (const p of fine) {
      if (insideRings(band, p)) {
        if (run.length > 1) runs.push(run);
        run = [];
      } else run.push(p);
    }
    if (run.length > 1) runs.push(run);
    const sides = runs.filter((r) => r.length > 8).sort((a, c) => a[0][0] - c[0][0]);
    return sides.slice(0, 2).map((r, i) => ({ kind: "neckline" as const, side: i as 0 | 1, line: i === 1 ? reverse(r) : r, pieces: pieces.filter(({ d }) => d !== b.cut.extras[0]), lay: lay(i === 1 ? reverse(r) : r) }));
  }
  /*
    A wrap's along each panel's own edge, not one V, which stopped both at
    the crossing: the top panel's its whole length — over its shoulder, down
    past the centre to the waist at the side, and on under the sash; the
    under panel's from its shoulder only to where the two cross, where it
    goes under the top one, drawn first so the top one's lies over it.
  */
  if (b.cut.wrap) {
    const { apex, over } = b.cut.wrap;
    const iApex = line.reduce((best, p, i) => (Math.hypot(p[0] - apex[0], p[1] - apex[1]) < Math.hypot(line[best][0] - apex[0], line[best][1] - apex[1]) ? i : best), 0);
    const topAbove = line.slice(0, iApex + 1);
    const topRun = [...topAbove, ...over.slice(1)];
    const underRun = reverse(line.slice(iApex));
    return [
      { kind: "neckline", side: 1, line: underRun, pieces, lay: { ...lay(underRun), ends: [16, 0] } },
      { kind: "neckline", side: 0, line: topRun, pieces, lay: { ...lay(topAbove), ends: [16, 0] } },
    ];
  }
  return [{ kind: "neckline", line, pieces, lay: lay(line) }];
}

/**
 * A bodice's top edge as drawn, left tip to right: its cut's `edge`, which
 * runs from the right tip round to the left one, read from the outline it is
 * part of — where it starts is the point before it there.
 */
function upperEdge(b: Bodice): Pt[] {
  const host = b.pieces.find((d) => d.includes(b.cut.edge));
  if (!host || !b.cut.edge) return [];
  const before = host.slice(0, host.indexOf(b.cut.edge)).match(/-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  if (before.length < 2) return [];
  const start = `M${before[before.length - 2]} ${before[before.length - 1]} `;
  const [ring] = ringsOf(start + b.cut.edge);
  return ring ? reverse(ring) : [];
}

/** Which side of a line, as it runs, its cloth is on: 1 its left, -1 its right — tried a few units off its middle. */
function clothSide(line: Pt[], pieces: string[]): 1 | -1 {
  const rings = pieces.map((d) => ringsOf(d));
  const i = Math.floor(line.length / 2);
  const [a, b] = [line[Math.max(0, i - 2)], line[Math.min(line.length - 1, i + 2)]];
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const left: Pt = [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
  for (const d of [3, 6, 10]) {
    const p: Pt = [line[i][0] + left[0] * d, line[i][1] + left[1] * d];
    if (rings.some((r) => insideRings(r, p))) return 1;
  }
  return -1;
}

/** The skirt's hem, on the skirt and on any placket down it to the hem, laid in past the hem's turn. */
function hemEdge(choice: GarmentChoice): Edge {
  const skirt = choice.skirt ?? DEFAULT_SKIRT;
  const placket = buttonedToHem(choice);
  const sk = skirtFor(choice.inside, skirt, placket);
  const pieces = [{ index: 0, d: sk.path }, ...(placket ? [{ index: 1, d: skirtPlacketFor(choice.inside, skirt).path }] : [])];
  return { kind: "hem", line: sk.hem, pieces, lay: { by: "level", into: [0, -1], inset: HEM_STRIPE_INSET } };
}

/** The middle of her throat, which the neckline is cut about: three units left of her shoulders' centre. */
export const NECK_CENTRE = (NECK_LEFT[0] + NECK_RIGHT[0]) / 2;

/** How far in from a fabric belt's end, at her left side, a tie is knotted at its side, at most: about where a wrap's is. */
export const BELT_SIDE_IN = 18;

/** How far a tie on the belt keeps inside the dress's side, and clear of her arm: 0.4 cm. */
export const TIE_CLEAR = 2;

/**
 * Her left arm's inner edge, row by row, where the photograph is drawn again
 * over the clothes — see `inFront` in `MannequinStage`: the forearm's and the
 * hand's zones. Anything laid past it is painted over there.
 */
const ARM_LEFT: Pt[][] = (["forearm", "hand"] as const).flatMap((z) =>
  flatten(bodies.female.zones[z] ?? "").filter((ring) => ring.every(([x]) => x > 300))
);
const armInnerAt = (y: number): number => Math.min(...ARM_LEFT.map((ring) => spanAt([ring], y)?.[0] ?? Infinity));

/**
 * Every tie a belt is tied with at its side, at the origin, as points: what
 * has to fit where it is knotted — see `beltSideAt`. The belt bow, which the
 * knot is there and every sash is tied in, and the scarf as it is on a belt.
 */
const BELT_TIES: Pt[] = (["knot", "scarf"] as const).flatMap((s) => tieAt(s, [0, 0], "belt-side").pieces.flatMap((d) => flatten(d).flat()));

/** A belt's end at her left, on its middle row: its left end, mirrored. */
function beltEndAt(b: ReturnType<typeof beltFor>): number {
  const i = Math.max(1, b.left.findIndex(([, y]) => y >= b.mid));
  const [p, q] = [b.left[i - 1], b.left[i]];
  return 600 - (p[0] + ((b.mid - p[1]) * (q[0] - p[0])) / (q[1] - p[1] || 1));
}

/**
 * Where a tie is knotted at a belt's side — a fabric belt's, a sash's:
 * `BELT_SIDE_IN` in from its end at her left — or further in, as far as
 * every tie the belt takes then fits: on the belt, inside the bodice's side
 * above it and the skirt's below it, and clear of her arm beside her hip,
 * `TIE_CLEAR` from each, so no loop or tail runs off the dress or under her
 * arm. The belt bow's loop reaches `BOW_REACH.side` from the knot, so the
 * knot sits that far in from the end, about 7 cm, as photo 2's does.
 */
function beltSideAt(skirt: SkirtChoice, b: ReturnType<typeof beltFor>, end: number): number {
  /* the skirt alone decides it — its belt and its end are its — so it is worked out once a skirt */
  const key = skirtKey(skirt);
  const known = sidePoints.get(key);
  if (known !== undefined) return known;
  const x = fitSide(skirt, b, end);
  sidePoints.set(key, x);
  return x;
}
const sidePoints = new Map<string, number>();

/** The fitting `beltSideAt` does, for a skirt it has not seen. */
function fitSide(skirt: SkirtChoice, b: ReturnType<typeof beltFor>, end: number): number {
  const sk = flattened(skirtFor(undefined, skirt).path);
  const body = flattened(bodiceFor("round", DEFAULT_SLEEVE, skirt.waist).pieces[0]);
  let x = end - BELT_SIDE_IN;
  for (const [px, py] of BELT_TIES) {
    const y = b.mid + py;
    const side = y < b.top ? (spanAt(body, y)?.[1] ?? end) : y <= b.bottom ? end : Math.min(spanAt(sk, y)?.[1] ?? end, armInnerAt(y));
    x = Math.min(x, side - TIE_CLEAR - px);
  }
  return x;
}

/**
 * The centre front of a cut's neck, where a tie is knotted: a V's point, a
 * round, scooped or boat neck's lowest, the middle of a square's lower edge,
 * where a wrap's two panels cross — at its waist, which a wrap's edge runs
 * to. None on a cut whose front has no middle.
 */
function neckPoint(id: NecklineId, waist: WaistId = "natural"): Pt | null {
  /* a tie is knotted at a bare neck — a collar knots its own — so at the neck as drawn bare */
  const { cut } = bodiceFor(id, undefined, id === "wrap" ? waist : "natural", "none", false, false, true);
  if (cut.vee) return cut.vee.apex;
  if (cut.neck) return [cut.neck.center, cut.neck.seamY + cut.neck.dip];
  if (cut.wrap) return cut.wrap.apex;
  if (id === "square" && cut.parts) {
    /* where the lower edge crosses the middle of the opening */
    const mid = (cut.parts.neck[0] + cut.parts.neckRight[0]) / 2;
    const seam = ringsOf(cut.seam)[0];
    for (let i = 1; i < seam.length; i++) {
      const [a, b] = [seam[i - 1], seam[i]];
      if ((a[0] - mid) * (b[0] - mid) <= 0 && a[0] !== b[0]) return [mid, a[1] + ((mid - a[0]) * (b[1] - a[1])) / (b[0] - a[0])];
    }
  }
  return null;
}

/**
 * The points of the dress a part can be set at, as a choice cuts it — where
 * a tie is knotted: the centre front of its neck, see `neckPoint`; and, on a
 * fabric belt, its front, over the buckle's place, and its side, at her
 * left, `BELT_SIDE_IN` in from its end — each on the belt's middle.
 */
export function dressPoints(choice: GarmentChoice): EdgePoint[] {
  const id = cutOf(choice.neckline);
  /* only on a cut a tie is knotted at the neck of — see `NECKLINE_TIED`: a cowl's drape is its own trimming */
  const at = NECKLINE_TIED.includes(id) ? neckPoint(id, choice.skirt?.waist) : null;
  const neck: EdgePoint[] = at ? [{ kind: "neck", at, down: [0, 1] }] : [];
  if (!fabricBelt(choice)) return neck;
  const b = beltFor({ ...DEFAULT_SKIRT, ...choice.skirt });
  return [
    ...neck,
    { kind: "belt-front", at: [b.buckle.x, b.mid], down: [0, 1] },
    { kind: "belt-side", at: [beltSideAt({ ...DEFAULT_SKIRT, ...choice.skirt }, b, beltEndAt(b)), b.mid], down: [0, 1] },
  ];
}

/**
 * Where a choice's tie is knotted, if it wears one the dress draws: at its
 * neck, or on its belt — see `dressPoints`. None for a tie knotted under
 * its collar — round a shirt collar's band, her bow under a Peter Pan —
 * which the collar draws: see `GarmentChoice.tieUnder`.
 */
export function tiePoint(choice: GarmentChoice): Pt | null {
  if (!choice.tie || choice.tieUnder) return null;
  const kind = choice.tieAt ?? "neck";
  return dressPoints(choice).find((p) => p.kind === kind)?.at ?? null;
}

/** Whether a sleeve's own edge turns, and so meets the neckline's at the shoulder: a cap's. */
const turnsAt = (s: SleeveChoice): boolean => s.type === "cap" && s.length !== "sleeveless";

/** Whether a choice stripes both its neckline and its sleeves, which then share the cloth between them where they run close. */
const sharing = (c: GarmentChoice): boolean => Boolean(c.stripes?.on.includes("neckline") && c.stripes?.on.includes("sleeves"));

/** A sleeve as its armhole: its type and length — a longer sleeve is drafted to a lower, fuller armhole — but not its cuff. */
const armholeKey = (s: SleeveChoice): { type: SleeveChoice["type"]; length: SleeveChoice["length"] } => ({ type: s.type, length: s.length });

/** A sleeve as a key: its type, length and cuff, nothing else. */
const sleeveKey = (s: SleeveChoice = DEFAULT_SLEEVE): SleeveChoice => (s.cuff ? { type: s.type, length: s.length, cuff: s.cuff } : { type: s.type, length: s.length });

/**
 * Every sleeve the dress offers on a cut that keeps both sleeves: each type
 * at each length it is cut at, sleeveless too — the panel offers every type
 * without its sleeve — and each cuff on a long one.
 */
const everySleeve = (offer: EdgeOffer): SleeveChoice[] =>
  offer.sleeves.types
    .filter((type) => SLEEVE_KINDS[type as SleeveChoice["type"]].construction !== "band")
    .flatMap((type) =>
      (["sleeveless", ...SLEEVE_KINDS[type as SleeveChoice["type"]].lengths] as SleeveChoice["length"][]).flatMap((length) => {
        const sleeve = { type, length } as SleeveChoice;
        const cuffs = cuffsOffered(offer.sleeves.cuffs as CuffId[] | undefined, sleeve);
        return [sleeve, ...cuffs.filter((c) => c !== "none").map((cuff) => ({ ...sleeve, cuff }))];
      })
    );

/** The cuts that keep both sleeves. */
const SLEEVED_CUTS = NECKLINE_IDS.filter((id) => NECKLINE_SLEEVES[id] === "both");

/**
 * Whether a sleeve is cut from the bodice itself rather than sewn to it — a
 * kimono's, a dolman's, a cap's: its hem is then the bodice's edge, and runs
 * where each cut's bodice does. Read off the draft, so it cannot drift.
 */
const fromBodice = (() => {
  const known = new Map<string, boolean>();
  return (type: SleeveChoice["type"]): boolean => {
    let b = known.get(type);
    if (b === undefined) {
      const k = bodiceFor(DEFAULT_CUT, { type, length: SLEEVE_KINDS[type].lengths[0] }).sleeveCut;
      b = Boolean(k && !k.sleeves[0]);
      known.set(type, b);
    }
    return b;
  };
})();

/**
 * What shapes each edge of the dress, declared — see `EdgeSpec`. Narrower
 * than the whole choice, which is the point: a sleeve's hem is the same on
 * every cut that keeps both sleeves, so it is checked once per sleeve and
 * waist rather than once per cut as well; `check:garments` proves it on whole
 * outfits.
 */
export const DRESS_EDGE_SPECS: EdgeSpec<any>[] = [
  {
    kind: "sleeve",
    /*
      Its sleeve, and the waist a long one hangs beside; and of the cut, only
      whether it keeps both sleeves — except for a sleeve cut from the bodice
      itself, whose hem is the bodice's edge on that cut.
    */
    /*
      A cap's edge turns, and meets the neckline's at each shoulder: so it also
      depends on whether there is a neckline edge there — none under a
      collar — and on whether both are striped, when they share the cloth
      between them.
    */
    shapedBy: (c: GarmentChoice) => {
      const sleeve = sleeveKey(c.sleeve);
      const cut = cutOf(c.neckline);
      const sleeved = NECKLINE_SLEEVES[cut] === "both";
      const cap = sleeved && turnsAt(sleeve);
      return {
        sleeved,
        cut: sleeved && fromBodice(sleeve.type) ? cut : null,
        sleeve,
        waist: c.skirt?.waist ?? "natural",
        open: cap ? !c.opening : null,
        shared: cap ? !c.opening && sharing(c) : null,
      };
    },
    choiceFor: (k: { sleeved: boolean; cut: NecklineId | null; sleeve: SleeveChoice; waist: WaistId; open: boolean | null; shared: boolean | null }): GarmentChoice => ({
      neckline: k.cut ?? (k.sleeved ? DEFAULT_CUT : "halter"),
      sleeve: k.sleeve,
      skirt: { ...DEFAULT_SKIRT, waist: k.waist },
      ...(k.open === false ? { opening: NECKLINE_OPENING[k.cut ?? DEFAULT_CUT] ?? "round" } : {}),
      ...(k.shared ? { stripes: { count: "three" as const, on: ["neckline", "sleeves"] as StripeEdgeId[] } } : {}),
    }),
    every: (offer: EdgeOffer) =>
      everySleeve(offer)
        .filter((sleeve) => sleeve.length !== "sleeveless")
        .flatMap((sleeve) =>
          (fromBodice(sleeve.type) ? SLEEVED_CUTS : [null]).flatMap((cut) =>
            offer.skirt.waists.flatMap((waist) => {
              const base = { sleeved: true, cut, sleeve, waist: waist as WaistId };
              if (!turnsAt(sleeve)) return [{ ...base, open: null as boolean | null, shared: null as boolean | null }];
              /* a collar over the cut, or not; and with no collar, the neckline striped beside it, or not */
              return [
                { ...base, open: true, shared: false },
                { ...base, open: true, shared: true },
                ...((offer.collared ? offer.collared.includes(cut ?? DEFAULT_CUT) : NECKLINE_OPENING[cut ?? DEFAULT_CUT]) ? [{ ...base, open: false, shared: false }] : []),
              ];
            })
          )
        ),
  },
  {
    kind: "hem",
    /* the skirt, whether it is buttoned to its hem, and the jacket hem it comes out from under */
    shapedBy: (c: GarmentChoice) => ({ skirt: c.skirt ?? DEFAULT_SKIRT, toHem: buttonedToHem(c), inside: c.inside ?? null }),
    choiceFor: (k: { skirt: SkirtChoice; toHem: boolean; inside: Tuck | null }): GarmentChoice => ({
      neckline: DEFAULT_CUT,
      skirt: k.skirt,
      buttons: k.toHem ? "hem" : "none",
      ...(k.inside ? { inside: k.inside } : {}),
    }),
    every: (offer: EdgeOffer) =>
      offer.skirt.shapes.flatMap((shape) =>
        shapeLengths(shape as SkirtChoice["shape"], offer.skirt.lengths as SkirtChoice["length"][]).flatMap((length) =>
          offer.skirt.waists.flatMap((waist) => {
            const skirt = { shape, length, waist } as SkirtChoice;
            const toHem = offer.buttons.includes("hem") && !BUTTONED_TO_WAIST_ONLY.includes(skirt.shape);
            return [false, ...(toHem ? [true] : [])].map((t) => ({ skirt, toHem: t, inside: null }));
          })
        )
      ),
  },
  {
    kind: "neckline",
    /*
      The cut and whether a collar covers it; the sleeve's type, whose armhole
      the shoulders run to — or that it has none — on a cut that keeps one; a
      placket down the front; and, beside a cap sleeve, whether the cap is
      striped too, when the two share the cloth between them.
    */
    shapedBy: (c: GarmentChoice) => {
      const cut = cutOf(c.neckline);
      const sleeve = c.sleeve ?? DEFAULT_SLEEVE;
      /* every cut that keeps a sleeve — an off-shoulder's hangs from its band, and the band is drafted to it */
      const keeps = NECKLINE_SLEEVES[cut] !== "none";
      return {
        cut,
        collared: Boolean(c.opening),
        sleeve: keeps ? armholeKey(sleeve) : null,
        placket: placketOn(cut, placketButtons(c)),
        shared: NECKLINE_SLEEVES[cut] === "both" && turnsAt(sleeve) && !c.opening ? sharing(c) : null,
        /* a wrap's crossing edge runs down to its waist */
        waist: bodiceFor(cut).cut.wrap ? (c.skirt?.waist ?? "natural") : null,
      };
    },
    choiceFor: (k: { cut: NecklineId; collared: boolean; sleeve: { type: SleeveChoice["type"]; length: SleeveChoice["length"] } | null; placket: boolean; shared: boolean | null; waist: WaistId | null }): GarmentChoice => ({
      neckline: k.cut,
      ...(k.sleeve ? { sleeve: { type: k.sleeve.type, length: k.sleeve.length } } : {}),
      ...(k.placket ? { buttons: "waist" } : {}),
      ...(k.collared ? { opening: NECKLINE_OPENING[k.cut] ?? "round" } : {}),
      ...(k.shared ? { stripes: { count: "three" as const, on: ["neckline", "sleeves"] as StripeEdgeId[] } } : {}),
      ...(k.waist ? { skirt: { ...DEFAULT_SKIRT, waist: k.waist } } : {}),
    }),
    every: (offer: EdgeOffer) =>
      NECKLINE_EDGED.flatMap((cut) => {
        const mode = NECKLINE_SLEEVES[cut];
        /* the sleeves the panel offers on the cut — see `sleeveTypesFor` and `sleeveLengthsFor` */
        const types = (
          mode === "band"
            ? BAND_CUT_TYPES.filter((t) => SLEEVE_KINDS[t].construction === "band" || offer.sleeves.types.includes(t))
            : offer.sleeves.types.filter((t) => {
                const kind = SLEEVE_KINDS[t as SleeveChoice["type"]];
                if (kind.construction === "band") return false;
                return mode === "both" || (kind.construction === "set-in" && !SHOULDER_TYPES.includes(t as SleeveChoice["type"]));
              })
        ) as SleeveChoice["type"][];
        const lengthsOf = (type: SleeveChoice["type"]) =>
          (mode === "band" || SLEEVE_KINDS[type].construction === "band" ? SLEEVE_KINDS[type].lengths : ["sleeveless", ...SLEEVE_KINDS[type].lengths]) as SleeveChoice["length"][];
        const sleeves = mode !== "none" ? types.flatMap((type) => lengthsOf(type).map((length) => ({ type, length }))) : [null];
        const plackets = [false, ...(offer.buttons.includes("waist") && placketOn(cut, "waist") ? [true] : [])];
        const waists: (WaistId | null)[] = bodiceFor(cut).cut.wrap ? (offer.skirt.waists as WaistId[]) : [null];
        return sleeves.flatMap((sleeve) =>
          plackets.flatMap((placket) =>
            waists.flatMap((waist) => {
              const capped = mode === "both" && sleeve !== null && turnsAt(sleeve);
              return (capped ? [false, true] : [null]).map((shared) => ({ cut, collared: false, sleeve, placket, shared, waist }));
            })
          )
        );
      }),
  },
  {
    kind: "belt",
    /* the skirt it lies over — its waist, and its shape and length, which set how far out its ends reach — and that it is a fabric belt */
    shapedBy: (c: GarmentChoice) => ({ belted: fabricBelt(c), skirt: fabricBelt(c) ? (c.skirt ?? DEFAULT_SKIRT) : null }),
    choiceFor: (k: { belted: boolean; skirt: SkirtChoice | null }): GarmentChoice => ({
      neckline: DEFAULT_CUT,
      ...(k.skirt ? { skirt: k.skirt } : {}),
      ...(k.belted ? { belt: "self" as const } : {}),
    }),
    every: (offer: EdgeOffer) =>
      offer.skirt.shapes.flatMap((shape) =>
        shapeLengths(shape as SkirtChoice["shape"], offer.skirt.lengths as SkirtChoice["length"][]).flatMap((length) =>
          offer.skirt.waists.map((waist) => ({ belted: true, skirt: { shape, length, waist } as SkirtChoice }))
        )
      ),
  },
];

/**
 * What shapes the dress's points, declared as its edges' are — see
 * `EdgeSpec`: its neck's, the cut (and a wrap's waist); its belt's, a
 * fabric belt and the skirt it is worn on — not the cut, which only says
 * whether it takes one.
 */
export const BELT_POINT_SPEC = {
  shapedBy: (c: GarmentChoice) => ({ belted: fabricBelt(c), skirt: fabricBelt(c) ? { ...DEFAULT_SKIRT, ...c.skirt } : null }),
  choiceFor: (k: { belted: boolean; skirt: SkirtChoice | null }): GarmentChoice => ({ neckline: DEFAULT_CUT, ...(k.belted ? { belt: "self" as const } : {}), ...(k.skirt ? { skirt: k.skirt } : {}) }),
  every: (offer: EdgeOffer) =>
    offer.skirt.shapes.flatMap((shape) =>
      shapeLengths(shape as SkirtChoice["shape"], offer.skirt.lengths as SkirtChoice["length"][]).flatMap((length) =>
        offer.skirt.waists.map((waist) => ({ belted: true, skirt: { shape, length, waist } as SkirtChoice }))
      )
    ),
};

/**
 * What shapes the dress's sash — see `sashOn`: which sash, where it is
 * tied, and the skirt it is worn on. The cut only says whether it wears one:
 * a wrap always, at its side.
 */
export const SASH_SPEC = {
  shapedBy: (c: GarmentChoice) => {
    const sash = sashOf(c) ?? null;
    return { sash, place: sash ? bowPlaceOf(c) : null, skirt: sash ? { ...DEFAULT_SKIRT, ...c.skirt } : null };
  },
  choiceFor: (k: { sash: SashId | null; place: BowAtId | null; skirt: SkirtChoice | null }): GarmentChoice => ({
    neckline: DEFAULT_CUT,
    ...(k.sash && k.place ? { belt: k.sash, bowAt: k.place } : {}),
    ...(k.skirt ? { skirt: k.skirt } : {}),
  }),
  every: (offer: EdgeOffer) =>
    (Object.keys(SASHES) as SashId[]).flatMap((sash) =>
      (["front", "side"] as BowAtId[]).flatMap((place) =>
        offer.skirt.shapes.flatMap((shape) =>
          shapeLengths(shape as SkirtChoice["shape"], offer.skirt.lengths as SkirtChoice["length"][]).flatMap((length) =>
            offer.skirt.waists.map((waist) => ({ sash, place, skirt: { shape, length, waist } as SkirtChoice }))
          )
        )
      )
    ),
};

/** What shapes the dress's neck point: its cut, and a wrap's waist. */
export const DRESS_POINT_SPEC = {
  /* the cut — and a wrap's waist, which its edge runs to */
  shapedBy: (c: GarmentChoice) => ({ cut: cutOf(c.neckline), waist: cutOf(c.neckline) === "wrap" ? (c.skirt?.waist ?? "natural") : null }),
  choiceFor: (k: { cut: NecklineId; waist: WaistId | null }): GarmentChoice => ({ neckline: k.cut, ...(k.waist ? { skirt: { ...DEFAULT_SKIRT, waist: k.waist } } : {}) }),
  every: (offer?: EdgeOffer) =>
    NECKLINE_IDS.flatMap((cut): { cut: NecklineId; waist: WaistId | null }[] =>
      cut === "wrap" ? ((offer?.skirt.waists ?? ["natural"]) as WaistId[]).map((waist) => ({ cut, waist })) : [{ cut, waist: null }]
    ),
};
