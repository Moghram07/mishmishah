/*
  Relative and extensioned, like `fit.ts` and for the same reason:
  `scripts/preview-garments.mjs` imports this module directly to draft the same
  outlines the app draws, and a plain Node process resolves neither the `@/`
  alias nor an extensionless specifier.
*/
import {
  draft,
  line,
  mirrorPts,
  outline,
  reverse,
  run,
  seamCurve,
  span,
  type Neckline,
  type Pt,
} from "./fit.ts";
import type { BodyType, OpeningShape } from "@/types";

/**
 * The neckline: a **cut**, not a piece.
 *
 * This is the distinction the whole file turns on. A collar is a separate piece
 * of cloth sewn on — its own record, its own drawing, its own fabric region,
 * its own coverage — and it is why nine of them can be swapped onto one blouse.
 * A neckline is not that. It reshapes the garment's own outline, and for six of
 * the fifteen it also removes the shoulders and the sleeves. So it takes no
 * fabric region of its own, and it has to be able to change what the garment
 * covers rather than only what it looks like.
 *
 * Everything here is drafted through `fit.ts` against the measured body in
 * `mannequin/profile.ts` — her actual throat, trapezius, deltoid and armhole.
 * No coordinate is typed. That is not neatness: it is the only construction
 * that avoids the shoulder pads, the triangular wedges and the misplaced neck
 * holes that the last several rounds of this project were spent removing, and
 * fifteen hand-drawn shapes would have reintroduced every one of them.
 *
 * Two rules the cuts obey, both learned the hard way:
 *
 *   • **Every endpoint sits on the body.** An opening's corners are placed by
 *     walking *along the shoulder seam* rather than by naming an x — so a wide
 *     boat neck lands on the shoulder instead of floating in the air beside it,
 *     whatever width it asks for.
 *   • **A corner is a join between runs.** Curves within a run are smoothed by
 *     Catmull-Rom, which rounds anything it passes through; a V's apex and a
 *     square's corners have to be corners, so they are the seams between two
 *     separate `run()` fragments.
 */

export const NECKLINE_IDS = [
  "round",
  "scoop",
  "boat",
  "v",
  "square",
  "high",
  "keyhole",
  "cowl",
  "wrap",
  "collared",
  "off-shoulder",
  "sweetheart",
  "halter",
  "asymmetrical",
] as const;

export type NecklineId = (typeof NECKLINE_IDS)[number];

/** What the garment knows and the cut needs: where it hangs and how loose. */
export interface CutSpec {
  /** The shoulder point the garment hangs from — its yoke's tip. */
  shoulderTip: Pt;
  /** How far outside the body the body panel is cut. */
  ease: number;
  /** The row a collar would be sewn at. */
  seamY: number;
  /** How far outside the throat the opening is cut. */
  neckEase?: number;
  /** The row the throat is measured at — the column, not the flare. */
  columnY?: number;
  /** The row the bodice ends at, where a skirt is sewn on: her own waist, unless given. */
  waistY?: number;
  /** The ease the shoulder seam is walked at. */
  shoulderEase?: number;
}

export interface NecklineCut {
  /**
   * Where the body panel's top corner sits.
   *
   * The yoke's shoulder point for anything with shoulders; down on the arm for
   * an off-shoulder band; at the underarm for anything strapless. The garment
   * asks for the cut *before* it builds the rest, because this is what the side
   * seams and the armhole hang from.
   */
  tip: Pt;
  /** The whole upper edge, right tip round to left tip. Replaces the yoke. */
  edge: string;
  /** The seam a collar is sewn to, as an open line. Empty if it takes none. */
  seam: string;
  /** Topstitch along the opening. */
  stitch: string;
  /** Extra cloth the cut adds: a band, a strap, a placket. Same fabric. */
  extras: string[];
  /** Fold lines — drape that is shading rather than silhouette. */
  folds: string[];
  /**
   * Each extra piece's free edges, in the order of `extras`, where not all of
   * its outline is free — an off-shoulder band's lower edge across the chest
   * lies on the bodice, a fold rather than an edge. Absent, each is outlined whole.
   */
  extraEdges?: string[];
  /** An off-shoulder band's shape, for the drawing to gather and light — see `OffShoulderBand`. */
  band?: OffShoulderBand;
  /** A cowl's drape, for the drawing to light and bend the print along — see `CowlDrape`. */
  drape?: CowlDrape;
  /** A wrap's top panel, for the drawing to edge and tie — see `WrapPanel`. */
  wrap?: WrapPanel;
  /** A halter's neckband, for the drawing to light and gather the bodice into — see `HalterBand`. */
  halter?: HalterBand;
  /**
   * The opening as the half-ellipse it is cut on, for a flat collar to lie
   * along — see `flatCollar`. The cuts with a plain curved opening have it:
   * a collar sewn to one follows that cut's own line, not a crew neck's.
   */
  neck?: Neckline;
  /** A V's two edges and its point, right corner down to the point and up to the left, for a collar sewn down them. */
  vee?: { right: Pt[]; apex: Pt; left: Pt[] };
  /** Its buttons, where they go and how big: a placket's, or a keyhole's at its closure. */
  buttons?: { at: Pt[]; r: number };
  /** A keyhole's fabric loop round its button: the loop's outer rim, for the light it catches. */
  loopRim?: Pt[];
  /**
   * The edge in its three parts — right shoulder, opening, left shoulder — for
   * a cut that keeps both shoulders. A raglan sleeve takes the two shoulder
   * seams off the bodice and onto itself, so it needs them apart.
   */
  parts?: {
    neck: Pt;
    neckRight: Pt;
    /** Corner out to the left shoulder end. */
    strapLeft: Pt[];
    /** Right shoulder end in to its corner. */
    strapRight: Pt[];
    /** The opening, right corner round to the left. */
    opening: string;
  };
}

/**
 * A halter's neckband: the band round the neck that holds the dress up, seen
 * from the front at the base of the neck and running back round both sides of
 * it to fasten behind. The bodice is gathered into its lower edge across the
 * front.
 */
export interface HalterBand {
  /** Where the bodice is sewn to it, left to right — the seam the gathers fan out from. */
  seam: Pt[];
  /** Its lower and upper edges, left to right, from where each goes behind the neck. */
  lower: Pt[];
  upper: Pt[];
}

/**
 * The folded band across an off-shoulder cut: its top edge from one arm to the
 * other, its lower edge across the chest, and the part of it round each upper
 * arm, which is the top of a short sleeve. Left arm first; the right mirrors it.
 */
export interface OffShoulderBand {
  /** The top edge, left arm to right arm. */
  top: Pt[];
  /** The lower edge across the chest, left underarm to right, where the band lies on the bodice. */
  lower: Pt[];
  /** The top edge over the same columns as `lower`, for gathers that run between the two. */
  topOverLower: Pt[];
  /**
   * Round each upper arm: the top edge over it, the corner where it turns
   * down the arm, the outer edge down, the hem across, and the inner edge up
   * to the underarm.
   */
  arms: { top: Pt[]; corner: Pt[]; outer: Pt[]; hem: Pt[]; inner: Pt[] }[];
  /**
   * The band for a sleeve sewn on below it, edge to edge: its hem square at
   * the corners, since the sleeve carries on from it there, and its free edges
   * without the hem, which is then a seam.
   */
  sleeved: { outline: string; edges: string };
  /**
   * The band when a sleeve hangs from it, as on a real off-shoulder gown with
   * sleeves: a folded strip across the bust and both upper arms, the sleeves
   * and the bodice sewn to its lower edge, and a raglan seam from that edge,
   * where the arm meets the chest, down to the underarm.
   */
  raglan: {
    outline: string;
    /** Its free edges: the top. Round each corner and down the arm is the sleeve's edge, and its lower edge is a seam. */
    edges: string;
    /** The lower edge, left to right — a seam the sleeves and the bodice are sewn to. */
    lower: Pt[];
    /** The top edge over the same columns, for the gathers between them. */
    topOverLower: Pt[];
    /** Round the left corner, from the top edge onto the outside of the arm. */
    corner: Pt[];
    /**
     * Down the outside of the left arm, from the corner to where the sleeve
     * hangs from. The sleeve carries it, and the corner: the outside of the arm
     * is one edge, from the band's top to the sleeve's hem, drawn once.
     */
    side: Pt[];
    /** Where the left sleeve leaves the band, on the outside of the arm. */
    start: Pt;
    /** How far the band stands off the arm round its outside: a fitted sleeve carries straight on at the same. */
    ease: number;
    /** The left raglan seam, from the band down to the underarm. */
    seam: Pt[];
    /** Where the bodice's top runs on under the band and the sleeves, left to right. */
    hidden: Pt[];
  };
}

/**
 * A cowl's drape: the roll along its top edge, and the folds hanging from the
 * shoulders below it. Every run is left to right.
 */
export interface CowlDrape {
  /** The crest of the roll the top edge is folded over, just inside the edge. */
  roll: Pt[];
  /** Each fold's crest, from the topmost down: from one shoulder, down to the centre, and up to the other. */
  ridges: Pt[][];
}

/**
 * A wrap's top panel: its front edge — one line from the neck to the far side
 * of the waist — and the tie it is knotted with there.
 */
export interface WrapPanel {
  /** The front edge, from the neck point down across the bust to the waist. */
  edge: Pt[];
  /** The part of it below the V, where it lies on the panel under it. */
  over: Pt[];
  /** The bottom of the V, where the two panels cross. */
  apex: Pt;
  /** Where the edge reaches the waist, and the tie is knotted. */
  tie: Pt;
}

/* ------------------------------------------------------------ the geometry */

/** A point a fraction of the way along a run, by arc length. */
function along(pts: Pt[], t: number): Pt {
  if (t <= 0) return pts[0];
  if (t >= 1) return pts[pts.length - 1];
  const legs: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    legs.push(
      legs[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    );
  }
  const want = legs[legs.length - 1] * t;
  for (let i = 1; i < legs.length; i++) {
    if (legs[i] < want) continue;
    const f = (want - legs[i - 1]) / (legs[i] - legs[i - 1] || 1);
    return [
      pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f,
      pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f,
    ];
  }
  return pts[pts.length - 1];
}

/** The part of a run from `t` to its end. */
function after(pts: Pt[], t: number): Pt[] {
  const cut = along(pts, t);
  const rest = pts.filter((p) => {
    const d0 = Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]);
    const dc = Math.hypot(cut[0] - pts[0][0], cut[1] - pts[0][1]);
    return d0 > dc;
  });
  return [cut, ...rest];
}

/**
 * An elliptical arc between two points on the same row, dipping below them.
 *
 * Traversed **right to left**, which is the direction an upper edge runs: the
 * body panel is walked left tip → hem → right tip, and the neckline closes it.
 */
function arc(right: Pt, left: Pt, dip: number, steps = 16): Pt[] {
  const cx = (left[0] + right[0]) / 2;
  const cy = (left[1] + right[1]) / 2;
  const halfW = (right[0] - left[0]) / 2;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = (i / steps) * Math.PI;
    return [cx + halfW * Math.cos(t), cy + dip * Math.sin(t)] as Pt;
  });
}

/**
 * A run offset onto the cloth — where an edge is actually topstitched.
 *
 * Perpendicular to the local tangent, on the side the cloth is. For an upper
 * edge walked right to left that is downward, which is what the sign works out
 * to: travelling in `-x`, the normal `(dy, -dx)` points in `+y`.
 */
function inset(pts: Pt[], by: number): Pt[] {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    return [p[0] + (dy / len) * by, p[1] + (-dx / len) * by] as Pt;
  });
}

/** Everything a cut needs to know about the body it is cut into. */
function anatomy(body: BodyType, spec: CutSpec) {
  const d = draft(body);
  const neckEase = spec.neckEase ?? 3;
  const columnY = spec.columnY ?? 164;
  const { center, width } = d.neck(columnY);
  const half = width / 2 + neckEase;
  const { seamY, shoulderTip: tip, ease } = spec;

  const neckLeft: Pt = [center - half, seamY];
  const neckRight: Pt = [center + half, seamY];
  /** The shoulder seam, neck point out to the shoulder point. */
  const shoulder = d.shoulder(neckLeft, tip, spec.shoulderEase ?? 3);
  const underarm = d.underarm(ease);

  /** Half the neck's own width, above where it widens into the shoulders. */
  const column = width / 2;
  const waistY = spec.waistY ?? d.waistY;
  return { d, center, half, column, seamY, ease, tip, neckLeft, neckRight, shoulder, underarm, waistY };
}

type Anatomy = ReturnType<typeof anatomy>;

/**
 * A symmetric opening between two points on the shoulder seam.
 *
 * `t` is how far along the seam the opening's corners sit — 0 at the collar
 * point, 1 at the shoulder point. Placing them this way rather than by naming
 * an x is what keeps a wide neckline on the body: a boat neck asks to be wide
 * and gets corners that are still on her shoulder, not floating beside it.
 */
function acrossShoulders(a: Anatomy, t: number, arcPts: (r: Pt, l: Pt) => Pt[]) {
  const cornerLeft = along(a.shoulder, t);
  /*
    Mirrored about the **throat** at the collar point and about the body at the
    shoulder point, and in between in proportion. The two are not the same line:
    her neck sits 1.7 units left of her trunk, so a corner at the collar point
    reflected about the trunk lands four units wide of the opening every collar
    and every other top is cut to — which is what left 41 points of the dress's
    seam bare under every stand collar. The yoke does the same thing by snapping
    its reflected seam onto the measured collar point.
  */
  const axis = a.center + (CENTER_X - a.center) * t;
  const cornerRight: Pt = [2 * axis - cornerLeft[0], cornerLeft[1]];
  /** The seam from the corner out to the shoulder point, and its mirror. */
  const strapLeft = after(a.shoulder, t);
  const strapRight = reverse(mirrorPts(strapLeft));
  strapRight[strapRight.length - 1] = cornerRight;
  const opening = arcPts(cornerRight, cornerLeft);
  return { cornerLeft, cornerRight, strapLeft, strapRight, opening };
}

/**
 * The common shape: shoulders and sleeves untouched, only the opening differs.
 *
 * Ten of the fifteen are this. The edge is the right shoulder seam inward, the
 * opening, then the left shoulder seam outward — three runs, so the two collar
 * points come out as corners rather than being rounded away.
 */
function overShoulders(
  a: Anatomy,
  t: number,
  arcPts: (r: Pt, l: Pt) => Pt[],
  extras: string[] = [],
  folds: string[] = []
): NecklineCut {
  const { strapLeft, strapRight, opening, cornerLeft, cornerRight } =
    acrossShoulders(a, t, arcPts);
  /* the half-ellipse it is cut on — `arc`'s, read back off its own points */
  const seamY = (cornerLeft[1] + cornerRight[1]) / 2;
  const neck: Neckline = {
    left: cornerLeft,
    right: cornerRight,
    front: run(opening),
    points: opening,
    center: (cornerLeft[0] + cornerRight[0]) / 2,
    seamY,
    dip: Math.max(...opening.map(([, y]) => y)) - seamY,
    half: (cornerRight[0] - cornerLeft[0]) / 2,
  };
  return {
    tip: a.tip,
    edge: [run(strapRight), run(opening), run(strapLeft)].join(" "),
    seam: line(opening),
    stitch: line(inset(opening, 5)),
    extras,
    folds,
    neck,
    parts: { neck: cornerLeft, neckRight: cornerRight, strapLeft, strapRight, opening: run(opening) },
  };
}

/** The body's axis — the photographs are registered with the trunk on it. */
const CENTER_X = 300;

/** How far below the shoulder point an off-shoulder band's top edge crosses the arm: about 4 cm. */
const OFF_SHOULDER_BELOW = 21;
/** The band round the arm: a little ease, as a short sleeve has. */
const OFF_SHOULDER_EASE = 2;
/**
 * A halter's neckband — see `HalterBand`: how deep it is, about 2.5 cm; how
 * far it stands off the neck where it goes round behind it; how much higher
 * it sits there, at the sides of the neck, than at the front, where it lies at
 * the base of the throat — half of how much higher it fastens behind, at the
 * nape; and how far the bodice runs on up under it.
 */
const HALTER_BAND_DEEP = 13;
/**
 * A sweetheart's top edge — see the cut: how high each curve rises over the
 * bust above the line from the underarm to the notch; how far either side of
 * centre front the notch begins, how far above the underarms, and how deep
 * it dips.
 */
const SWEETHEART_CREST = 15;
const SWEETHEART_NOTCH = 7;
const SWEETHEART_NOTCH_UP = 10;
const SWEETHEART_NOTCH_DEPTH = 5;
/**
 * A keyhole's closure — see the cut: how far apart the slit's edges are
 * where they meet at the neck edge; the button's radius and where it sits
 * from the top of the slit; and the fabric loop round it, its two radii and
 * how wide it opens toward the slit's far edge, where it is sewn.
 */
const KEYHOLE_SLIT = 0.6;
const KEYHOLE_BUTTON = 2.1;
const KEYHOLE_BUTTON_AT: Pt = [-2.4, 2.8];
const KEYHOLE_LOOP: readonly [inner: number, outer: number] = [2.5, 3.7];
const KEYHOLE_LOOP_OPEN = (35 * Math.PI) / 180;
/**
 * A shirt-dress's placket buttons — see the collared cut: how many, and where
 * the first and last sit, below the neckline seam and above the waist seam.
 * The first clears her shirt collar's points, which reach about 31 units
 * below where its leaves meet; four, about 7.3 cm apart, as a shirt's are,
 * with the collar band's own button above them.
 */
const COLLARED_BUTTONS = 4;
/** A shirt-dress button's radius: about 1.1 cm across. */
const COLLARED_BUTTON = 2.8;
const COLLARED_FIRST_BUTTON = 45;
const COLLARED_LAST_BUTTON = 12;
const HALTER_BAND_OFF = 1.5;
const HALTER_BAND_RISE = 14;
const HALTER_TUCK = 3;
/**
 * Its ease at the underarm, where it stops following the arm out and drops
 * straight to its hem: from there down it never widens. Enough that a sleeve
 * carrying on from its hem at its own width still clears her forearm, which
 * is wider than her upper arm.
 */
const OFF_SHOULDER_EASE_UNDER = 3.7;
/** How round the corners of the band's hem are, where it is the hem. */
const OFF_SHOULDER_HEM_ROUND = 3;
/** With a sleeve hanging from it, how deep the band is over the arms and at the sides of the chest, and at centre front. */
const OFF_SHOULDER_SLEEVED_SIDE = 15;
const OFF_SHOULDER_SLEEVED_CENTRE = 22;
/** How far in from the underarm the raglan seam leaves the band: where the arm meets the chest. */
const OFF_SHOULDER_SEAM_IN = 9;

/** How much lower its top edge runs across the chest than over the arm, and how much more it dips at centre front. */
const OFF_SHOULDER_CHEST = 9;
const OFF_SHOULDER_DIP = 6;
/** The band's depth across the chest at centre front: about 5.5 cm of folded band. */
const OFF_SHOULDER_DEPTH = 29;
/** How much the sleeve's hem bows as it goes round the arm. */
const OFF_SHOULDER_HEM_BOW = 1.5;
/** How round the band's top corners are, where it turns round the arm. */
const OFF_SHOULDER_CORNER = 6;

/** How far below the base of the neck a wrap's front edge is drawn toward: it sets how deep the V is. */
const WRAP_PULL = 100;
/** How far in from the side seam the tie is knotted, on the front of the waist. */
const WRAP_TIE_IN = 12;

/** How far along the shoulder seam a cowl's opening starts: a little past the neck. */
const COWL_WIDTH = 0.28;
/** How far its top edge dips at centre front below where it leaves the shoulders: about 9 cm. */
const COWL_DIP = 46;
/** How many folds hang below the edge, and how much lower at the centre each hangs than the one above. */
const COWL_FOLDS = 3;
const COWL_STEP = 15;
/** How much further out on the shoulder each fold hangs from than the one above. */
const COWL_SPREAD = 0.1;
/** How far inside the edge the crest of its roll is. */
const COWL_ROLL = 3.5;

/**
 * How cloth hangs between two points: deep and round at the bottom, flattening
 * as it nears the points it hangs from. 1 at the middle, 0 at the ends.
 */
const hang = (u: number) => 0.5 * ((1 + Math.cos(Math.PI * u)) / 2) + 0.5 * (1 - u * u);

/** Cloth hung from `right` to `left`, sagging `dip` at its middle — walked right to left, as an upper edge is. */
function droop(right: Pt, left: Pt, dip: number, steps = 16): Pt[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const s = i / steps;
    const u = Math.abs(2 * s - 1);
    return [right[0] + (left[0] - right[0]) * s, right[1] + (left[1] - right[1]) * s + dip * hang(u)] as Pt;
  });
}

/* ------------------------------------------------------------- the fifteen */

const CUTS: Record<NecklineId, (a: Anatomy) => NecklineCut> = {
  /** The crew. What every top in the wardrobe was already cut to. */
  round: (a) => overShoulders(a, 0, (r, l) => arc(r, l, 34)),

  /** Wider and much deeper — a long U, still on the collarbone at its sides. */
  scoop: (a) => overShoulders(a, 0.2, (r, l) => arc(r, l, 58)),

  /**
   * Wide and shallow: almost flat from shoulder to shoulder, high on the chest.
   *
   * The one that most needs its corners placed along the seam. Asked for by
   * width it would want to start at x 251, which at the neckline's own row is
   * seventeen units outside her body — a neckline hanging in the air. Asked for
   * as 58% of the way to the shoulder point, it lands on the shoulder.
   */
  boat: (a) => overShoulders(a, 0.58, (r, l) => arc(r, l, 16)),

  /**
   * A real V: two straight runs meeting at a point.
   *
   * The apex is a join between two `run()` fragments and not a sampled curve,
   * because Catmull-Rom rounds whatever it passes through and a rounded V is a
   * scoop.
   */
  v: (a) => {
    const { strapLeft, strapRight, cornerLeft, cornerRight } = acrossShoulders(
      a,
      0,
      () => []
    );
    const apex: Pt = [a.center, a.seamY + 74];
    // a shade hollow, so it reads as cloth rather than as a drawn angle
    const rightEdge = span(cornerRight, apex, 6).map(
      ([x, y], i, all) => [x + Math.sin((i / (all.length - 1)) * Math.PI) * 2, y] as Pt
    );
    const leftEdge = span(apex, cornerLeft, 6).map(
      ([x, y], i, all) => [x - Math.sin((i / (all.length - 1)) * Math.PI) * 2, y] as Pt
    );
    return {
      tip: a.tip,
      edge: [run(strapRight), run(rightEdge), run(leftEdge), run(strapLeft)].join(" "),
      parts: {
        neck: cornerLeft,
        neckRight: cornerRight,
        strapLeft,
        strapRight,
        opening: [run(rightEdge), run(leftEdge)].join(" "),
      },
      seam: line(rightEdge, leftEdge),
      vee: { right: rightEdge, apex, left: leftEdge },
      stitch: [line(inset(rightEdge, 5)), line(inset(leftEdge, 5))].join(" "),
      extras: [],
      folds: [],
    };
  },

  /**
   * Straight down from the straps, straight across: four corners, four runs,
   * each a crisp corner where two runs meet.
   *
   * Its corners sit halfway along the shoulder, as a square neckline's do,
   * leaving a strap of shoulder either side. They sat two centimetres out from
   * the neck points, and the opening was a deep slot little wider than her
   * neck.
   */
  square: (a) => {
    const t = 0.5;
    const { strapLeft, strapRight, cornerLeft, cornerRight } = acrossShoulders(
      a,
      t,
      () => []
    );
    const baseY = a.seamY + 58;
    const downRight = span(cornerRight, [cornerRight[0], baseY], 4);
    const across = span([cornerRight[0], baseY], [cornerLeft[0], baseY], 8).map(
      ([x, y], i, all) =>
        [x, y + Math.sin((i / (all.length - 1)) * Math.PI) * 3] as Pt
    );
    const upLeft = span([cornerLeft[0], baseY], cornerLeft, 4);
    return {
      tip: a.tip,
      edge: [
        run(strapRight),
        run(downRight),
        run(across),
        run(upLeft),
        run(strapLeft),
      ].join(" "),
      parts: {
        neck: cornerLeft,
        neckRight: cornerRight,
        strapLeft,
        strapRight,
        opening: [run(downRight), run(across), run(upLeft)].join(" "),
      },
      seam: line(downRight, across, upLeft),
      stitch: [
        line(inset(downRight, 5)),
        line(inset(across, 5)),
        line(inset(upLeft, 5)),
      ].join(" "),
      extras: [],
      folds: [],
    };
  },

  /** At the base of the throat — as high as cloth goes without a band on it. */
  high: (a) => overShoulders(a, 0, (r, l) => arc(r, l, 5)),

  /**
   * A high opening with a teardrop cut below it, joined by a slit.
   *
   * One continuous boundary, deliberately: a hole punched as a second subpath
   * would need `evenodd`, and overlapping subpaths under that rule cancel — the
   * bug that left three transparent holes in the male collars. The opening dips
   * into a narrow slit, opens into the drop, and comes back up the same way.
   */
  keyhole: (a) => {
    const { strapLeft, strapRight, opening, cornerLeft, cornerRight } = acrossShoulders(a, 0, (r, l) =>
      arc(r, l, 7)
    );
    const topY = a.seamY + 7;
    /* the slit's edges all but meet at the neck edge, where the closure holds them */
    const slit = KEYHOLE_SLIT;
    /*
      Split where the slit actually is, not at the midpoint of the list. Cut at
      the midpoint and the boundary runs back on itself for three units before
      diving, which is a self-intersection: the fill rule then cancels the
      sliver and the keyhole comes out with a nick in its shoulder.
    */
    const rightHalf = opening.filter((p) => p[0] >= a.center + slit);
    const leftHalf = opening.filter((p) => p[0] <= a.center - slit);
    const drop: Pt[] = [
      ...span([a.center + slit, topY], [a.center + 12, topY + 20], 4),
      ...arc([a.center + 12, topY + 20], [a.center - 12, topY + 20], 14, 12),
      ...span([a.center - 12, topY + 20], [a.center - slit, topY], 4),
    ];
    /*
      Closed at the top: a small button on the left of the slit, and a loop
      of the dress's own cloth sewn to the right edge and slipped round it —
      so the opening is the teardrop below a neck edge that runs on across.
      It used to be open to the neck edge, a slit three units wide.
    */
    const button: Pt = [a.center + KEYHOLE_BUTTON_AT[0], topY + KEYHOLE_BUTTON_AT[1]];
    const [inner, outer] = KEYHOLE_LOOP;
    const around = (r: number, from: number, to: number, n = 10): Pt[] =>
      Array.from({ length: n + 1 }, (_, i) => {
        const t = from + ((to - from) * i) / n;
        return [button[0] + r * Math.cos(t), button[1] + r * Math.sin(t)] as Pt;
      });
    /* from its upper end round the left of the button to its lower end, and back inside */
    const loop = outline(
      around(outer, -KEYHOLE_LOOP_OPEN, -2 * Math.PI + KEYHOLE_LOOP_OPEN),
      around(inner, -2 * Math.PI + KEYHOLE_LOOP_OPEN, -KEYHOLE_LOOP_OPEN)
    );
    return {
      tip: a.tip,
      edge: [
        run(strapRight),
        run(rightHalf),
        run(drop),
        run(leftHalf),
        run(strapLeft),
      ].join(" "),
      parts: {
        neck: cornerLeft,
        neckRight: cornerRight,
        strapLeft,
        strapRight,
        opening: [run(rightHalf), run(drop), run(leftHalf)].join(" "),
      },
      seam: line(opening),
      stitch: [line(inset(opening, 5)), line(inset(drop, 4))].join(" "),
      extras: [loop],
      loopRim: around(outer, -KEYHOLE_LOOP_OPEN, -2 * Math.PI + KEYHOLE_LOOP_OPEN),
      buttons: { at: [button], r: KEYHOLE_BUTTON },
      folds: [],
    };
  },

  /**
   * A cowl: the top edge a soft fold of the cloth itself, and the cloth below
   * it hanging from the shoulders in folds.
   *
   * It used to be a crisp neckline — the same banded, topstitched edge as the
   * others — with three blurred grey arcs drawn under it, which read as a
   * smudge on a plain cloth and vanished on a print. A cowl is cut with more
   * cloth at the neck than the neck needs, and the extra hangs:
   *
   * - **The edge** is a fold, not a cut — the cloth is turned back on itself —
   *   so it has no band and no topstitch, and it is lit as a roll. It leaves
   *   each shoulder a little past the neck and sags about nine centimetres at
   *   centre front, flattening where it leaves the shoulders, as hanging cloth does.
   * - **The folds** hang from the shoulders below it, each from a little further
   *   out on the shoulder than the one above and each lower at the centre, the
   *   lowest about eighteen centimetres below the base of the neck. They are
   *   handed to the drawing, which lights each one — a lit crest, a shadow in
   *   the trough below — and bends the print a little along them.
   */
  cowl: (a) => {
    const base = overShoulders(a, COWL_WIDTH, (r, l) => droop(r, l, COWL_DIP));
    const corner = along(a.shoulder, COWL_WIDTH);
    const centreY = corner[1] + COWL_DIP;
    const ridges = Array.from({ length: COWL_FOLDS }, (_, i) => {
      const k = i + 1;
      const t = COWL_WIDTH + COWL_SPREAD * k;
      const end = along(a.shoulder, t);
      const axis = a.center + (CENTER_X - a.center) * t;
      /* hung from just below the shoulder seam, on the cloth */
      const left: Pt = [end[0], end[1] + 4];
      const right: Pt = [2 * axis - end[0], end[1] + 4];
      return reverse(droop(right, left, centreY + COWL_STEP * k - left[1]));
    });
    const opening = droop(base.parts!.neckRight, base.parts!.neck, COWL_DIP);
    return {
      ...base,
      /* a folded edge: no topstitch on it */
      stitch: "",
      folds: [],
      drape: { roll: reverse(inset(opening, COWL_ROLL)), ridges },
    };
  },

  /**
   * Two panels crossing on the diagonal, tied at the waist.
   *
   * The top panel's front edge is one line: from the neck point, steeply down
   * across the bust, and on to the far side of the waist, where it is tied.
   * The under panel's edge is its mirror, and the V is where the two cross —
   * so the edge keeps one direction through it. It was a V with a separate
   * line drawn on from its point at another angle, blurred into a stripe.
   *
   * Below the V the top panel's edge lies on the under panel: the drawing
   * gives it the fine dark edge and the shadow it throws there, the tie, and
   * the folds the tie pulls into the panel — see `WrapPanel`.
   */
  wrap: (a) => {
    const t = 0.05;
    const { strapLeft, strapRight, cornerLeft, cornerRight } = acrossShoulders(a, t, () => []);
    const waistY = a.waistY;
    const tie: Pt = [2 * CENTER_X - a.d.sideAt(waistY, a.ease) - WRAP_TIE_IN, waistY];
    /* steep from the neck, flattening as it crosses to the waist */
    const pull: Pt = [a.center - 6, a.seamY + WRAP_PULL];
    const at = (u: number): Pt => {
      const m = 1 - u;
      return [
        m * m * cornerLeft[0] + 2 * m * u * pull[0] + u * u * tie[0],
        m * m * cornerLeft[1] + 2 * m * u * pull[1] + u * u * tie[1],
      ];
    };
    /* the under panel's edge: the same line, mirrored — about the neck at the neck and the body below */
    const axisAt = (y: number) => {
      const axis0 = a.center + (CENTER_X - a.center) * t;
      return axis0 + (CENTER_X - axis0) * Math.max(0, Math.min(1, (y - cornerLeft[1]) / (waistY - cornerLeft[1])));
    };
    const mirrorAt = ([x, y]: Pt): Pt => [2 * axisAt(y) - x, y];
    /* where the two cross: where the top panel's edge reaches the axis */
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      const [x, y] = at(mid);
      if (x < axisAt(y)) lo = mid;
      else hi = mid;
    }
    const tApex = (lo + hi) / 2;
    const apex = at(tApex);
    const N = 40;
    const edge = Array.from({ length: N + 1 }, (_, i) => at(i / N));
    const upper = [...edge.filter((_, i) => i / N < tApex), apex];
    const over = [apex, ...edge.filter((_, i) => i / N > tApex)];
    const rightEdge = upper.map(mirrorAt);
    rightEdge[0] = cornerRight;
    const leftEdge = reverse(upper);
    leftEdge[leftEdge.length - 1] = cornerLeft;
    return {
      tip: a.tip,
      edge: [run(strapRight), run(rightEdge), run(leftEdge), run(strapLeft)].join(" "),
      parts: {
        neck: cornerLeft,
        neckRight: cornerRight,
        strapLeft,
        strapRight,
        opening: [run(rightEdge), run(leftEdge)].join(" "),
      },
      seam: line(rightEdge, leftEdge),
      /* topstitched along the whole of the top panel's edge, neck to tie, on the panel */
      stitch: line(inset(reverse(edge), 4)),
      extras: [],
      folds: [],
      wrap: { edge, over, apex, tie },
    };
  },

  /**
   * A high opening with a short placket down the centre front.
   *
   * The placket is drawn in the garment's own cloth rather than as a fabric
   * region of its own — it is the same cloth, and `fabricRegions` stays as it
   * was. The collar that goes over it is the existing, swappable one.
   */
  collared: (a) => {
    const base = overShoulders(a, 0, (r, l) => arc(r, l, 7));
    const topY = a.seamY + 4;
    /*
      A shirt-dress's button placket, about 3 cm across, from under the collar
      down the bodice to the waist seam, buttoned evenly from just below the
      collar's points to just above the seam. It was a tab with an inch of it
      showing below the collar, which read as a tag; narrow, so that with the
      collar's points either side of its top it still reads as a shirt front
      and not as a necktie.
    */
    const half = 8;
    const footY = a.waistY;
    const buttons = Array.from({ length: COLLARED_BUTTONS }, (_, i) => {
      const [first, last] = [a.seamY + COLLARED_FIRST_BUTTON, footY - COLLARED_LAST_BUTTON];
      return [a.center, first + ((last - first) * i) / (COLLARED_BUTTONS - 1)] as Pt;
    });
    const placket = outline(
      span([a.center - half, topY], [a.center - half, footY], 5),
      span([a.center - half, footY], [a.center + half, footY], 2),
      span([a.center + half, footY], [a.center + half, topY], 5)
    );
    return {
      ...base,
      extras: [placket],
      buttons: { at: buttons, r: COLLARED_BUTTON },
      stitch: [
        base.stitch,
        line(span([a.center - half + 4, topY + 4], [a.center - half + 4, footY - 5], 5)),
        line(span([a.center + half - 4, topY + 4], [a.center + half - 4, footY - 5], 5)),
      ].join(" "),
    };
  },

  /* ------------------------------- shoulders and sleeves gone ------------- */

  /**
   * Off the shoulders: a folded band across the chest that is the top of two
   * short sleeves.
   *
   * It used to be a band across the chest at armpit height with a flat
   * scalloped ruffle hung from it, its ends standing on the outer arms — so
   * above it, between each arm and the chest, the armpit showed. A real one is
   * sewn the other way round: the band wraps each upper arm as the top of a
   * short sleeve, and the sleeve is sewn to the bodice under the arm, so the
   * cloth runs on from the band into the side of the bodice and the armpit is
   * never seen.
   *
   * - **The top edge** crosses each upper arm about four centimetres below the
   *   shoulder point, well above the armpit, and runs a little lower across the
   *   chest with a gentle dip at centre front.
   * - **Round the arm** the band follows the arm's own outline with a little
   *   ease, and ends in a hem round the arm at mid upper arm, square to it.
   * - **Under the arm** its inner edge runs up the arm to the underarm, where
   *   the bodice's side seam starts: the bodice is the panel below the band,
   *   its top hidden under it.
   * - **Across the chest** the band's lower edge lies on the bodice — a fold,
   *   drawn as one, not an edge.
   */
  "off-shoulder": (a) => {
    const { d } = a;
    const e = OFF_SHOULDER_EASE;
    const topY = d.shoulderPointY + OFF_SHOULDER_BELOW;
    const outerX = d.armOutAt(topY, e);
    /*
      The top edge's row at a column: lower across the chest, dipping gently
      at centre front — level there, not coming to a point, which a slope that
      ran straight in from each side made of it.
    */
    const topAt = (x: number) => {
      const t = Math.max(0, Math.min(1, (Math.min(x, 2 * CENTER_X - x) - outerX) / (CENTER_X - outerX)));
      return topY + OFF_SHOULDER_CHEST * Math.sin((Math.PI / 2) * t) + (OFF_SHOULDER_DIP * (1 - Math.cos(Math.PI * t))) / 2;
    };
    /*
      The corner where the band turns round the arm, rounded as folded cloth
      turns: from the top edge, pulled toward the corner, onto the outside of
      the arm. It was cut back two units either side and read as square.
    */
    const R = OFF_SHOULDER_CORNER;
    const cornerFrom: Pt = [outerX + R, topAt(outerX + R)];
    const cornerTo: Pt = [d.armOutAt(topY + R, e), topY + R];
    const corner: Pt[] = Array.from({ length: 7 }, (_, i) => {
      const t = i / 6;
      const m = 1 - t;
      return [
        m * m * cornerFrom[0] + 2 * m * t * outerX + t * t * cornerTo[0],
        m * m * cornerFrom[1] + 2 * m * t * topY + t * t * cornerTo[1],
      ] as Pt;
    });
    const top: Pt[] = Array.from({ length: 15 }, (_, i) => {
      const x = cornerFrom[0] + (CENTER_X - cornerFrom[0]) * (i / 14);
      return [x, topAt(x)] as Pt;
    });

    /* the sleeve's hem: round the arm at mid upper arm, square to the arm's lean */
    const mid = (d.shoulderPointY + d.elbowY) / 2;
    const centreAt = (y: number) => (d.armOutAt(y, 0) + d.armInAt(y, 0)) / 2;
    const lean = (centreAt(mid + 20) - centreAt(mid - 20)) / 40;
    const hemAt = (x: number) => mid - lean * (x - centreAt(mid));
    const under = a.underarm;
    const rows = (from: number, to: number) => {
      const out: number[] = [];
      for (let y = from; y < to; y += 4) out.push(y);
      return [...out, to];
    };
    /*
      The outside of the band: round the arm with a little ease, a little more
      by the underarm — and from there straight down to the hem. Following the
      arm on out below the underarm, the band widened all the way to its hem,
      and a sleeve carrying on from it could only widen with it or step in.
      Held, it never widens; and the hold stays clear of the arm on every row,
      however far the arm leans out under it.
    */
    const easeAt = (y: number) =>
      e + (OFF_SHOULDER_EASE_UNDER - e) * Math.max(0, Math.min(1, (y - topY) / (under[1] - topY || 1)));
    const yHem = hemAt(d.armOutAt(mid, e));
    const hold = Math.min(
      d.armOutAt(under[1], OFF_SHOULDER_EASE_UNDER),
      ...rows(under[1], yHem + 2).map((y) => d.armOutAt(y, 0.5))
    );
    const outerAt = (y: number) => (y < under[1] ? d.armOutAt(y, easeAt(y)) : hold);
    const yOut = hemAt(outerAt(yHem));
    const yIn = hemAt(under[0]);
    /*
      The inside of the sleeve never further from the bodice than the underarm
      is. Below the underarm her arm hangs a few units off her side, and with
      the band's ease and the bodice's on, what was left between them was a
      hairline of the page — a crack where the cloth runs on into the bodice.
    */
    const insideAt = (y: number) => Math.max(d.armInAt(y, e), under[0]);
    const hemOut: Pt = [outerAt(yOut), yOut];
    const hemIn: Pt = [insideAt(yIn), yIn];
    const bowAt = (t: number) => Math.sin(t * Math.PI) * OFF_SHOULDER_HEM_BOW;
    const hem = span(hemOut, hemIn, 6).map(([x, y], i, all) => [x, y + bowAt(i / (all.length - 1))] as Pt);

    /* down the outside of the arm, and up its inside to the underarm */
    const outer: Pt[] = rows(topY + R, yOut).map((y) => [outerAt(y), y] as Pt);
    const inner: Pt[] = [...rows(under[1], yIn).map((y) => [insideAt(y), y] as Pt).reverse().slice(0, -1), under];

    /*
      The hem as the band's own hem, when it has no sleeve below: going round
      the arm, so curving a little, and turning softly into it at each side —
      square, the corners read as the end of a box.
    */
    const H = OFF_SHOULDER_HEM_ROUND;
    const across = hemIn[0] - hemOut[0];
    const curve = (from: Pt, via: Pt, to: Pt): Pt[] =>
      Array.from({ length: 5 }, (_, i) => {
        const t = (i + 1) / 5;
        const m = 1 - t;
        return [
          m * m * from[0] + 2 * m * t * via[0] + t * t * to[0],
          m * m * from[1] + 2 * m * t * via[1] + t * t * to[1],
        ] as Pt;
      });
    const hemOn: Pt = [hemOut[0] + H, hemOut[1] + (hemIn[1] - hemOut[1]) * (H / across) + bowAt(H / across)];
    const hemOff: Pt = [hemIn[0] - H, hemIn[1] - (hemIn[1] - hemOut[1]) * (H / across) + bowAt(1 - H / across)];
    const outerRound = outer.filter(([, y]) => y <= yOut - H);
    const innerRound = inner.filter(([, y]) => y <= yIn - H);
    const roundHem: Pt[] = [
      ...curve(outerRound[outerRound.length - 1], hemOut, hemOn),
      ...hem.filter(([x]) => x > hemOn[0] + 1 && x < hemOff[0] - 1),
      hemOff,
      ...curve(hemOff, hemIn, innerRound[0]).slice(0, -1),
    ];

    /* across the chest: the band's lower edge, from the underarm to centre front */
    const depthAt = (x: number) => {
      const t = (x - under[0]) / (CENTER_X - under[0]);
      return under[1] - topAt(under[0]) + (OFF_SHOULDER_DEPTH - (under[1] - topAt(under[0]))) * t;
    };
    const lower: Pt[] = Array.from({ length: 13 }, (_, i) => {
      const x = under[0] + (CENTER_X - under[0]) * (i / 12);
      return [x, topAt(x) + depthAt(x)] as Pt;
    });

    /* the band round both arms and across the chest, its arms ending in `end` */
    const bandWith = (down: Pt[], end: Pt[], up: Pt[]) =>
      outline(
        reverse(top),
        corner,
        down,
        end,
        up,
        lower,
        mirrorPts(reverse(lower)).slice(1),
        mirrorPts(reverse(up)),
        mirrorPts(reverse(end)),
        mirrorPts(reverse(down)),
        mirrorPts(reverse(corner)),
        mirrorPts(top).slice(0, -1)
      );
    const band = bandWith(outerRound, roundHem, innerRound);

    /*
      With a sleeve hanging from it: the band a folded strip across the bust
      and both upper arms, no deeper over the arm than at the side of the
      chest, so that a raglan seam has room to run from it down to the
      underarm; down the outside of the arm it follows the arm at its own
      ease, and the sleeve carries straight on from it.
    */
    const sleevedDepth = (x: number) => {
      const seamX = under[0] + OFF_SHOULDER_SEAM_IN;
      const u = Math.max(0, Math.min(1, (x - seamX) / (CENTER_X - seamX)));
      return OFF_SHOULDER_SLEEVED_SIDE + (OFF_SHOULDER_SLEEVED_CENTRE - OFF_SHOULDER_SLEEVED_SIDE) * u * u * (3 - 2 * u);
    };
    const startY = topY + OFF_SHOULDER_SLEEVED_SIDE;
    const side: Pt[] = rows(topY + R, startY).map((y) => [d.armOutAt(y, e), y] as Pt);
    const start = side[side.length - 1];
    const lowerAt = (x: number) => topAt(Math.max(x, outerX)) + sleevedDepth(x);
    const lowerSleeved: Pt[] = Array.from({ length: 21 }, (_, i) => {
      const x = start[0] + (CENTER_X - start[0]) * (i / 20);
      return [x, i === 0 ? start[1] : lowerAt(x)] as Pt;
    });
    const seamTop: Pt = [under[0] + OFF_SHOULDER_SEAM_IN, lowerAt(under[0] + OFF_SHOULDER_SEAM_IN)];
    const raglanSeam = seamCurve(seamTop, under, 1.2, 9);
    const lowerFullSleeved = [...lowerSleeved, ...reverse(mirrorPts(lowerSleeved)).slice(1)];
    /*
      Square where each sleeve leaves it: three runs, so the corner is a corner.
      Drawn as one smooth outline it was rounded off just where the sleeve
      carries on, and a hairline of the page showed in the notch.
    */
    const centreTop = top[top.length - 1];
    const raglanBand =
      `M${centreTop[0]} ${centreTop[1]} ` +
      `${run(reverse(top), corner, side)} ` +
      `${run(lowerSleeved, mirrorPts(reverse(lowerSleeved)).slice(1))} ` +
      `${run(mirrorPts(reverse(side)), mirrorPts(reverse(corner)), mirrorPts(top))} Z`;

    /* the bodice's top, under the band: its lower edge raised, from under the sleeve to under the other */
    const hiddenSleeved: Pt[] = lowerFullSleeved
      .filter(([x]) => x >= under[0] - 6 && x <= 2 * CENTER_X - under[0] + 6)
      .map(([x, y]) => [x, y - 6] as Pt);
    /* the bodice's own top, under the band: the band's lower edge, raised out of sight */
    const hidden: Pt[] = [under, ...lower.slice(1).map(([x, y]) => [x, y - 8] as Pt)];
    const tip = under;
    const topFull = [...top, ...reverse(mirrorPts(top)).slice(1)];
    const lowerFull = [...lower, ...reverse(mirrorPts(lower)).slice(1)];
    const armLeft = { top: top.filter(([x]) => x <= under[0]), corner, outer, hem, inner };
    const flip = (pts: Pt[]) => mirrorPts(pts);
    const topEdge = line(mirrorPts(top), reverse(top).slice(1));
    return {
      tip,
      edge: run(mirrorPts(hidden), reverse(hidden).slice(1)),
      seam: "",
      /* a folded band: no topstitch on it */
      stitch: "",
      extras: [band],
      extraEdges: [
        [
          topEdge,
          line(corner, outerRound, roundHem, innerRound),
          line(flip(corner), flip(outerRound), flip(roundHem), flip(innerRound)),
        ].join(" "),
      ],
      folds: [],
      band: {
        top: topFull,
        lower: lowerFull,
        topOverLower: lowerFull.map(([x]) => [x, topAt(x)] as Pt),
        arms: [
          armLeft,
          { top: flip(armLeft.top), corner: flip(corner), outer: flip(outer), hem: flip(hem), inner: flip(inner) },
        ],
        raglan: {
          outline: raglanBand,
          edges: [
            line(mirrorPts(top), reverse(top).slice(1)),
          ].join(" "),
          lower: lowerFullSleeved,
          topOverLower: lowerFullSleeved.map(([x]) => [x, topAt(Math.max(Math.min(x, 2 * CENTER_X - outerX), outerX))] as Pt),
          corner,
          side,
          start,
          ease: e,
          seam: raglanSeam,
          hidden: hiddenSleeved,
        },
        sleeved: {
          outline: bandWith(outer, hem, inner),
          edges: [
            topEdge,
            line(corner, outer),
            line(inner),
            line(flip(corner), flip(outer)),
            line(flip(inner)),
          ].join(" "),
        },
      },
    };
  },

  /**
   * Strapless: two curves over the bust meeting in a soft notch at centre
   * front, a structured bodice.
   *
   * The top corners are the underarms, so the bodice is exactly the panel below
   * the arms and nothing else. Each curve is half an ellipse, rising gently
   * over the bust; where they meet, a short rounded dip, its sides running on
   * from theirs. The edge is finished — faced, no topstitch — and the bodice
   * below it is plain cloth.
   *
   * The curves rose half as high again and met in a point, a heart drawn
   * rather than a bodice cut, with a row of topstitch along them. And a seam
   * ran from the crown of each curve over the bust to the waist, drawn as a
   * dark line across the cloth.
   */
  sweetheart: (a) => {
    const tip = a.underarm;
    const tipRight = mirrorPts([tip])[0];
    const notchY = tip[1] - SWEETHEART_NOTCH_UP;
    const meetRight: Pt = [a.center + SWEETHEART_NOTCH, notchY];
    const meetLeft: Pt = [a.center - SWEETHEART_NOTCH, notchY];
    /* half an ellipse between two points at different heights, rising `crest` above the line joining them */
    const curve = (from: Pt, to: Pt, crest: number, steps = 10): Pt[] =>
      Array.from({ length: steps + 1 }, (_, i) => {
        const t = (i / steps) * Math.PI;
        const u = (1 - Math.cos(t)) / 2;
        return [from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u - crest * Math.sin(t)] as Pt;
      });
    const lobeRight = curve(tipRight, meetRight, SWEETHEART_CREST);
    const notch = arc(meetRight, meetLeft, SWEETHEART_NOTCH_DEPTH, 6);
    const lobeLeft = curve(meetLeft, tip, SWEETHEART_CREST);
    return {
      tip,
      edge: run(lobeRight, notch.slice(1), lobeLeft.slice(1)),
      seam: "",
      stitch: "",
      extras: [],
      folds: [],
    };
  },

  /**
   * Straps rising from the bust and meeting at the throat, gathered into a
   * neckband that holds the dress up.
   *
   * The cloth covers the centre of the chest and leaves the outer chest and
   * both shoulders bare, which is the opposite of every other cut here: the
   * edge runs *upward and inward* from the underarm rather than across.
   *
   * **The band** goes round the neck and fastens behind it. From the front it
   * lies at the base of the throat and runs back round both sides of the neck,
   * rising as it goes, until it passes behind it: its edges are each half an
   * ellipse round the neck, lowest at the front. The bodice is gathered into
   * its lower edge across the front, between the tops of the straps, and runs
   * on up under it. It used to stop at a bare edge across the throat, with a
   * blurred cross on it for straps twisted there.
   */
  halter: (a) => {
    const tip = a.underarm;
    const tipRight = mirrorPts([tip])[0];
    /* the band's lower edge: lowest at the front, where the bodice's top was, rising round the neck */
    const front = a.seamY + 15;
    const side = front - HALTER_BAND_RISE;
    /*
      Round the neck itself, not the widening into the shoulders below it,
      which from the front is behind it: the band's ends are where it passes
      behind the neck.
    */
    const roundNeck = (y: number, depth: number) =>
      Array.from({ length: 17 }, (_, i) => {
        const t = -Math.PI / 2 + (Math.PI * i) / 16;
        return [a.center + (a.column + HALTER_BAND_OFF) * Math.sin(t), y + depth * Math.cos(t)] as Pt;
      });
    const lower = roundNeck(side, front - side);
    const upper = roundNeck(side - HALTER_BAND_DEEP, front - side);
    /* where a strap meets the band: its top, on the band's lower edge */
    const onBand = (x: number): Pt => {
      for (let i = 1; i < lower.length; i++) {
        const [x0, y0] = lower[i - 1];
        const [x1, y1] = lower[i];
        if ((x0 - x) * (x1 - x) <= 0 && x0 !== x1) return [x, y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)];
      }
      return [x, front];
    };
    const throatRight = onBand(a.center + a.half - 6);
    const throatLeft = onBand(a.center - a.half + 6);
    const upRight = span(tipRight, throatRight, 8).map(
      ([x, y], i, all) =>
        [x + Math.sin((i / (all.length - 1)) * Math.PI) * 7, y] as Pt
    );
    const downLeft = span(throatLeft, tip, 8).map(
      ([x, y], i, all) =>
        [x - Math.sin((i / (all.length - 1)) * Math.PI) * 7, y] as Pt
    );
    /* the seam, between the straps' tops, and the bodice running on up under the band above it */
    const seam = [throatLeft, ...lower.filter(([x]) => x > throatLeft[0] && x < throatRight[0]), throatRight];
    const under = reverse(seam).map(([x, y]) => [x, y - HALTER_TUCK] as Pt);
    /* the band: its lower edge, round behind the neck on the right, its upper edge back, and round on the left */
    const band = outline(lower, reverse(upper));
    const sideLeft = lower.filter(([x]) => x <= throatLeft[0]);
    const sideRight = lower.filter(([x]) => x >= throatRight[0]);
    return {
      tip,
      edge: [run(upRight, under, downLeft)].join(" "),
      seam: "",
      stitch: [line(inset(upRight, 5)), line(inset(downLeft, 5))].join(" "),
      extras: [band],
      /* free all round but where the bodice is sewn to it */
      extraEdges: [line(reverse(sideLeft), upper, reverse(sideRight))],
      folds: [],
      halter: { seam, lower, upper },
    };
  },

  /* ------------------------------------------- one shoulder, then the other */

  /**
   * The same asymmetry at a shallower angle, over a shoulder that keeps its
   * sleeve — which is the whole difference between the two in the reference.
   */
  asymmetrical: (a) => {
    const from = mirrorPts([a.underarm])[0];
    const corner = along(a.shoulder, 0.5);
    const diagonal = span(from, corner, 10).map(
      ([x, y], i, all) =>
        [x, y + Math.sin((i / (all.length - 1)) * Math.PI) * 14] as Pt
    );
    return {
      tip: a.tip,
      edge: [run(diagonal), run(after(a.shoulder, 0.5))].join(" "),
      seam: "",
      stitch: line(inset(diagonal, 5)),
      extras: [],
      folds: [],
    };
  },
};

/** Draft one neckline against one body. */
export function necklineCut(
  body: BodyType,
  id: NecklineId,
  spec: CutSpec
): NecklineCut {
  return CUTS[id](anatomy(body, spec));
}

/**
 * The opening each cut presents to a collar, or `null` for none.
 *
 * Lives beside the geometry rather than only in the record, because it is a
 * fact *about the cut*: a collar with a stand needs cloth at the base of the
 * throat to stand on, and whether there is any is decided here.
 */
export const NECKLINE_OPENING: Record<NecklineId, OpeningShape | null> = {
  round: "round",
  scoop: "round",
  boat: "round",
  /* a V: the sailor collar's, its panels sewn down the V's edges to meet at its point */
  v: "v",
  square: null,
  high: "high",
  keyhole: "high",
  cowl: null,
  wrap: null,
  collared: "high",
  "off-shoulder": null,
  sweetheart: null,
  halter: null,
  asymmetrical: null,
};

/**
 * Which sleeves survive each cut. The off-shoulder's are its own: its band is
 * the top of them, at every length it is offered in.
 */
export const NECKLINE_SLEEVES: Record<
  NecklineId,
  "both" | "none" | "left" | "right" | "band"
> = {
  round: "both",
  scoop: "both",
  boat: "both",
  v: "both",
  square: "both",
  high: "both",
  keyhole: "both",
  cowl: "both",
  wrap: "both",
  collared: "both",
  "off-shoulder": "band",
  sweetheart: "none",
  halter: "none",
  /* The covered side keeps its sleeve; that is what separates the two. */
  asymmetrical: "left",
};

/**
 * The zones each cut bares, subtracted from the garment's own coverage.
 *
 * Coverage decides what of the *photograph* is erased, so subtracting from it
 * is safe in a way adding never is: the mannequin's shoulder is simply drawn,
 * and the garment paints over whatever part of it the cloth actually covers.
 * That is why a one-shoulder cut needs no per-side zone — `shoulderCap` is one
 * shape covering both, and leaving it un-erased shows both shoulders, with
 * cloth over the one that has cloth.
 *
 * `upperArm` goes with it wherever there is no sleeve on **both** sides. The
 * asymmetrical cut keeps its left sleeve and still bares the zone, because the
 * right arm has none and a zone is claimed or it is not.
 */
export const NECKLINE_BARES: Record<NecklineId, ("shoulderCap" | "upperArm")[]> = {
  round: [],
  /*
    The four wide cuts bare the shoulder even though they still cover most of
    it, because `shoulderCap` is one zone running from the neck point out to the
    deltoid and an opening that reaches past its inner edge exposes part of it.
    `check:garments` found each of these — 1254 px of bare shoulder on the boat
    neck, which is the widest.

    Releasing the whole zone is the right answer rather than a concession: what
    is not erased is simply drawn, and the cloth is painted over the part it
    does cover. The alternative would be splitting the zone in two, which every
    other garment would then have to know about.
  */
  scoop: ["shoulderCap"],
  boat: ["shoulderCap"],
  v: [],
  square: ["shoulderCap"],
  high: [],
  keyhole: [],
  cowl: ["shoulderCap"],
  wrap: [],
  collared: [],
  "off-shoulder": ["shoulderCap", "upperArm"],
  sweetheart: ["shoulderCap", "upperArm"],
  halter: ["shoulderCap", "upperArm"],
  asymmetrical: ["shoulderCap", "upperArm"],
};

/**
 * The shoulders each cut leaves bare, by side of the canvas: `left` is
 * x < 300, the figure's right. On a bare side no cloth may lie on the shoulder
 * or the arm — see `check:garments`, which found a one-shoulder bodice
 * climbing the bare arm to the far shoulder point.
 *
 * The off-shoulder is not here: its band is the top of two short sleeves, and
 * cloth round the upper arm is the point of it.
 */
export const NECKLINE_BARE_SHOULDERS: Record<NecklineId, ("left" | "right")[]> = {
  round: [],
  scoop: [],
  boat: [],
  v: [],
  square: [],
  high: [],
  keyhole: [],
  cowl: [],
  wrap: [],
  collared: [],
  "off-shoulder": [],
  sweetheart: ["left", "right"],
  halter: ["left", "right"],
  /* it covers the canvas-left shoulder and crosses to the right underarm */
  asymmetrical: ["right"],
};

/**
 * A collar a cut arrives wearing, where it is not itself without one.
 *
 * Only the Collared cut: a placket and a high opening is a shirt front, and it
 * is not a collared neck until a collar is over it. It stays swappable — the
 * collar system owns collars, and a neckline drawing its own would be two
 * places to fix the same thing.
 */
export const NECKLINE_WANTS: Partial<Record<NecklineId, string>> = {
  collared: "female-shirt-collar",
};

/**
 * Cuts whose **construction** is one-sided: an armhole on one side and none on
 * the other.
 *
 * These cannot take `setIn`'s `sides`, which is the left half, the hem, and the
 * left half reflected. They are reassembled from its parts instead.
 */
export const ONE_SIDED: NecklineId[] = ["asymmetrical"];

/**
 * Cuts no longer offered, and what a look cut to one opens as.
 *
 * The one-shoulder was the asymmetrical without its sleeve: the same diagonal
 * from the far underarm, to the neck rather than to mid-shoulder. Two near
 * copies in a picker of fifteen, and the one with no choice of sleeve the
 * weaker — so the asymmetrical is offered under its name instead, and a look
 * cut to the old one opens as it, sleeveless.
 */
export const RETIRED_NECKLINES: Record<string, { as: NecklineId; sleeveless: boolean }> = {
  "one-shoulder": { as: "asymmetrical", sleeveless: true },
};

/**
 * Cuts whose **outline** is deliberately not a mirror of itself.
 *
 * The one-sided cuts, and no others. The wrap used to be here, with its V set
 * sixteen units off centre to make it read as a wrap; but a wrap's V is where
 * two mirrored panels cross, at centre front, and what makes it a wrap is the
 * top panel's edge running on to the far side of the waist and the tie there —
 * drawn over a cut that is a mirror of itself, and held to the mirror rule.
 */
export const LOPSIDED: NecklineId[] = [...ONE_SIDED];
