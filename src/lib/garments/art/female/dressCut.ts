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
import { column, draft, line, mirrorPts, outline, princess, reverse, run, setIn, span, type Pt, type Tuck } from "../../fit.ts";
import { hasArmhole, hemRow, top, type Frame, type PuffShape, type SleeveChoice, type SleeveCut } from "../../sleeves.ts";
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
import { BUST, NECK_BASE_SEAM, NECK_LEFT, NECK_RIGHT, SHOULDER_EASE, TIP_LEFT } from "./yoke.ts";

/**
 * Where the bodice ends and the skirt is sewn on: **her** waist, as measured.
 *
 * It was a typed 366 — sixteen units below the narrowest part of her, so the
 * seam crossed her where she is already widening toward the hip, and the skirt
 * started out from there.
 */
export const WAIST_Y = draft("female").waistY;

/**
 * The bodice's ease, and the skirt's at the seam — the same number, because a
 * skirt sewn to a bodice has the bodice's waist. Four is the blouse's fitted
 * ease; this was six on the bodice and ten on the skirt, which is the step
 * outward at the waist the figure showed.
 */
const EASE = 4;
const TIP: Pt = [TIP_LEFT[0], TIP_LEFT[1]];

/** How the skirt is cut: the same numbers worn on its own and under a jacket. */
const SKIRT_SPEC = {
  /* Starts under the bodice, so the seam is cloth over cloth. */
  rise: -8,
  toY: 760,
  ease: EASE,
  flare: 80,
  dip: 22,
};

export const SKIRT = column("female", SKIRT_SPEC);

/**
 * The skirt worn under a jacket: drawn in under the jacket's hem and flaring
 * from there to its own hem — see `tucked`. One per jacket, kept.
 */
const tuckedSkirts = new Map<string, ReturnType<typeof column>>();
export function skirtFor(inside?: Tuck): ReturnType<typeof column> {
  if (!inside) return SKIRT;
  const key = `${inside.y}|${inside.x}`;
  if (!tuckedSkirts.has(key)) tuckedSkirts.set(key, column("female", { ...SKIRT_SPEC, inside }));
  return tuckedSkirts.get(key)!;
}

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
  /**
   * Its princess seams, left then right — see `princessSeams` — drawn on the
   * body panel alone, the first of `pieces`: whatever is drawn over it, a
   * sleeve or a band, is where each starts. Absent on a cut with its own.
   */
  princess?: [string, string];
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
/** The skirt's left edge at a row: what a long sleeve hangs beside below the waist. */
const skirtEdge = (y: number): number => {
  const n = (SKIRT.path.match(/-?[0-9]*[.]?[0-9]+/g) ?? []).map(Number);
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
  below: skirtEdge,
});

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
function raglanSleeves(raglan: OffShoulderBand["raglan"], sleeve: SleeveChoice) {
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
  const k = SLEEVES.cut(drafted, frame);
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
    ...(fitted && style ? { cuffTop: SLEEVES.cuffRows(style, hem).seam } : {}),
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
function bodice(id: NecklineId, sleeve: SleeveChoice): Bodice {
  const sleeves = NECKLINE_SLEEVES[id];
  const cut = necklineCut("female", id, {
    shoulderTip: sleeves === "both" ? SLEEVES.shoulderEnd(sleeve) : TIP,
    ease: EASE,
    seamY: NECK_BASE_SEAM,
  });

  if (sleeves === "none" || sleeves === "band") {
    /* No sleeves: the bodice is the panel below whatever the cut left. */
    const T = setIn("female", { tip: cut.tip, ease: EASE, hemY: WAIST_Y, dip: 0, fitted: true });
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
        ? raglanSleeves(cut.band.raglan, sleeve)
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
  const k = SLEEVES.cut(sleeve, frame);

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

/**
 * Her princess seams on a cut, in a sleeve — see `princess` — shaping the
 * bodice over the bust in place of darts: from the armhole wherever the cut
 * has one, and from the shoulder where the sleeve is cut on with the bodice.
 * None on a cut with seams of its own, which do the same work: a
 * sweetheart's, from each curve to the waist.
 */
function princessSeams(cut: NecklineCut, id: NecklineId, sleeve: SleeveChoice): [string, string] | undefined {
  if (cut.seams) return undefined;
  const left = princess(draft("female"), {
    tip: TIP,
    neck: [NECK_LEFT[0], NECK_LEFT[1]],
    ease: EASE,
    bust: [BUST.points[0][0], BUST.points[0][1]],
    waistY: WAIST_Y,
    /* into the waist seam, which the skirt is sewn across */
    to: WAIST_Y + 2,
    from: NECKLINE_SLEEVES[id] === "both" && !hasArmhole(sleeve.type) ? "shoulder" : "armhole",
  });
  return [line(left), line(mirrorPts(left))];
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
  sleeve: SleeveChoice
): { pieces: string[]; underarm: number; hem: number; join: number; fitted: boolean; cuffTop?: number } | null {
  const b = bodiceFor(id, sleeve);
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

export function bodiceFor(id: NecklineId, sleeve: SleeveChoice = DEFAULT_SLEEVE): Bodice {
  const key = `${id}|${sleeve.type}|${sleeve.length}|${sleeve.cuff ?? "none"}`;
  let b = cache.get(key);
  if (!b) {
    const made = bodice(id, sleeve);
    const seams = princessSeams(made.cut, id, sleeve);
    b = seams ? { ...made, princess: seams } : made;
    cache.set(key, b);
  }
  return b;
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
 * Every piece of cloth the dress is made of, for one cut and one sleeve —
 * bodice and skirt.
 *
 * What `check:garments` rasterises. It is a function rather than a table so
 * that the checker and the renderer ask the same question and cannot be given
 * two different answers.
 */
export const cloth = (id: NecklineId = DEFAULT_CUT, sleeve?: SleeveChoice, inside?: Tuck): string[] => [
  ...bodiceFor(NECKLINE_IDS.includes(id) ? id : DEFAULT_CUT, sleeve).pieces,
  skirtFor(inside).path,
];
