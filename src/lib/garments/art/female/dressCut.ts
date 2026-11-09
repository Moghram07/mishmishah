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
import { hemRow, top, type Frame, type PuffShape, type SleeveChoice, type SleeveCut } from "../../sleeves.ts";
import { WAIST_DROP, fallOf, sameSkirt, skirtCut, skirtKey, type CutSkirt, type SkirtFinish } from "../../skirts.ts";
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
  OWN_PLACKET,
  PANEL_HALF,
  PLACKET_HALF,
  PLACKET_STITCH,
} from "../../closures.ts";
import type { ButtonsId, SkirtChoice, WaistId } from "@/types";
import type { GarmentChoice } from "../index.ts";
import { mirror as mirrorPath } from "../../collar.ts";
import {
  ONE_SIDED,
  NECKLINE_IDS,
  NECKLINE_SLEEVES,
  necklineCut,
  type NecklineCut,
  type NecklineId,
  type OffShoulderBand,
} from "../../necklines.ts";
import { NECK_BASE_SEAM, NECK_LEFT, NECK_RIGHT, SHOULDER_EASE, TIP_LEFT } from "./yoke.ts";

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
function bodice(id: NecklineId, sleeve: SleeveChoice, waist: WaistId): Bodice {
  const sleeves = NECKLINE_SLEEVES[id];
  const S = sleevesFor(waist);
  const cut = necklineCut("female", id, {
    shoulderTip: sleeves === "both" ? S.shoulderEnd(sleeve) : TIP,
    ease: EASE,
    seamY: NECK_BASE_SEAM,
    waistY: seamAt(waist),
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
      pieces: [k.body, ...cut.extras, ...k.sleeves, ...k.bands],
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
  collared = false
): Bodice {
  /* buttoned to the waist or to the hem, the bodice is the same: its placket runs to the waist seam either way */
  const placketed = placketOn(id, buttons);
  const key = `${id}|${sleeve.type}|${sleeve.length}|${sleeve.cuff ?? "none"}|${waist}${placketed ? "|placket" : ""}`;
  /* with a collar sewn on, the neck edge's topstitch goes, and a keyhole's own closure — see `underCollar` */
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
    b = placketed ? withPlacket(bodiceFor(id, sleeve, waist), waist) : bodice(id, sleeve, waist);
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
  const neck = b.cut.neckStitch ?? b.cut.stitch;
  const off = (stitch: string) => (neck && stitch.startsWith(neck) ? stitch.slice(neck.length).trimStart() : stitch);
  const { neckStitch: _neck, ...sewn } = b.cut;
  const stitched = { ...b, stitch: off(b.stitch), cut: { ...sewn, stitch: off(b.cut.stitch) } };
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
export function buttonRun(first: number, last: number): { at: number[]; pitch: number } {
  const [, want] = BUTTON_PITCH;
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
  const id = cutOf(choice.neckline);
  const asked = choice.buttons ?? "none";
  /* over a mermaid, to the hem is to the waist */
  const buttons = asked === "hem" && !buttonedToHem(choice) ? "waist" : asked;
  const waist = choice.skirt?.waist ?? "natural";
  /* a cut's own closure stays only with no collar over it — see `underCollar` */
  const b = bodiceFor(id, choice.sleeve, waist, buttons, Boolean(choice.opening));
  const own = b.cut.buttons;
  if (buttons === "none" || !BUTTONED_CUTS.includes(id)) return { groups: own ? [own] : [] };
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
  const sk = skirtFor(undefined, skirt);
  const seam = seamAt(skirt.waist);
  const mid = seam - BELT_ABOVE_SEAM;
  const [top, bottom] = [mid - BELT_WIDTH / 2, mid + BELT_WIDTH / 2];
  const d = draft("female");
  const polys = flatten(sk.path);
  /* the bodice as drawn, its body piece: it stands a little further out than her side plus its ease under the bust */
  const body = flatten(bodiceFor("round", DEFAULT_SLEEVE, skirt.waist).pieces[0]);
  const leftAt = (y: number) => {
    const x = [y <= seam ? Math.min(d.sideAt(y, EASE), spanAt(body, y)?.[0] ?? Infinity) : Infinity, spanAt(polys, y)?.[0] ?? Infinity];
    return Math.min(...x) - BELT_OUT;
  };
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
  const { neckline, sleeve, inside, skirt, buttons, opening } = choice;
  const toHem = buttonedToHem(choice);
  return [
    /* with a collar on it, a keyhole without its own loop — see `underCollar` */
    ...bodiceFor(cutOf(neckline), sleeve, skirt?.waist, buttons, Boolean(opening)).pieces,
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
