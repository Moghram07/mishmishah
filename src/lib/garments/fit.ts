/*
  Relative rather than aliased, and deliberately: `scripts/preview-garments.mjs`
  imports this module directly to draft the same outlines the app draws, and a
  plain Node process does not resolve the `@/` alias, nor an extensionless
  specifier. `collar.ts` is importable
  from `scripts/` for the same reason. Type-only imports are erased before Node
  ever sees them, so those may stay aliased.
*/
import { BODY_CANVAS } from "../mannequin/bodies.ts";
import { profileFor, type BodyEdge } from "../mannequin/profile.ts";
import type { BodyType } from "@/types";

/**
 * How a garment is cut against a body.
 *
 * Every outline in this wardrobe used to be a list of typed coordinates. That
 * is the single root cause behind every fit complaint this project has had, and
 * it is worth being precise about why, because each symptom looks like its own
 * separate bug and none of them is:
 *
 *   • **A crooked shoulder.** The left seam and the right seam were written out
 *     as two independent curves. `art/female/yoke.ts` called the second one
 *     "the same curve run the other way" and it was not — the two differed by
 *     five units at y 194, which is the steepest part of the shoulder slope and
 *     exactly where the eye reads shoulder shape. Two hand-typed halves drift.
 *     Nothing but mirroring can stop them.
 *
 *   • **Triangular wedges off the shoulders.** A sleeve was four or five points
 *     joined by straight lines, with an underarm guessed twenty units below the
 *     real one. Cloth cut to a guess and hung on a straight line is a wedge.
 *
 *   • **No gap between the arms and the ribs.** Both mannequins hold their arms
 *     clear of the body — hers by up to 27 units, his by up to 32 — and that
 *     fact appeared in no file anywhere. So every top was drawn with its sleeve
 *     welded to its side seam, and the figure came out as one flat slab.
 *
 *   • **Legs with no daylight between them.** Same again, and worse, because it
 *     is not the same on the two bodies: her ankles are 42 units apart and his
 *     are 96. One silhouette scaled to fit both cannot be right for either.
 *
 * So drawings do not type coordinates any more. They ask the body where it is.
 * `mannequin/profile.ts` holds the measured edges — generated straight from the
 * photographs — and this turns them into seams, armholes, sleeves and legs with
 * ease added. A left side is built once and **mirrored**, which is the only
 * construction under which the two shoulders cannot disagree.
 */

const W = BODY_CANVAS.width;
const CENTER = W / 2;

export type Pt = [number, number];

/* ------------------------------------------------------------ the geometry */

/**
 * Reflect a run of points about the centre line.
 *
 * Exported as `mirrorPts`, not as `mirror`, because `collar.ts` already has a
 * `mirror` and it takes a path *string*. Both kits are flattened into one
 * namespace by `scripts/preview-garments.mjs` to evaluate a drawing's
 * constants, and when this one won that contest the collar drawings called it
 * with a string, `.map` threw, the evaluator swallowed the error, and three
 * male collars were silently measured from whatever constants still resolved.
 * They reported as *too small* rather than as broken, which is a long way to
 * chase a duplicated name.
 */
const mirror = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [W - x, y] as Pt);
export { mirror as mirrorPts };

/** Run a list backwards, for tracing down one side of a piece and up the other. */
export const reverse = (pts: Pt[]): Pt[] => [...pts].reverse();

/** The same points, each raised `by(x, y)` units: a fold that keeps a set height above the seam it follows. */
export const lifted = (pts: Pt[], by: (x: number, y: number) => number): Pt[] =>
  pts.map(([x, y]) => [x, y - by(x, y)] as Pt);

/** Drop points that repeat the one before, which a join between runs produces. */
const dedupe = (pts: Pt[]): Pt[] =>
  pts.filter(
    (p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 0.4
  );

const n = (v: number) => {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
};

/**
 * A smooth curve through every point, as cubic Béziers.
 *
 * Catmull-Rom with the tangents scaled by a sixth, which is the standard
 * conversion and passes exactly through each sample. Cloth has no straight
 * edges, and `check:garments` measures how much of an outline is straight — a
 * measured edge walked as `L` commands would blow that budget on its own while
 * also reading as a folded paper doll.
 */
function through(pts: Pt[], closed: boolean): string {
  const p = dedupe(pts);
  if (p.length < 2) return "";
  const at = (i: number): Pt =>
    closed
      ? p[((i % p.length) + p.length) % p.length]
      : p[Math.min(p.length - 1, Math.max(0, i))];

  const out: string[] = [];
  const last = closed ? p.length : p.length - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    /*
      Control points held inside the segment they belong to.

      Plain Catmull-Rom overshoots at a corner — it carries the tangent from
      before the turn on through it — and the sharpest corner on either body is
      the deltoid, where the silhouette moves 21 units in four rows. A shoulder
      seam drawn through it bulged back *inside* the body between two samples
      that were both safely outside it, which reads as skin above the cloth and
      is invisible in the point list. Clamping each handle to its own segment's
      box is the standard monotone fix; on a convex run, where the handles are
      inside the box anyway, it changes nothing.
    */
    const hold = (v: number, a: number, b: number) =>
      Math.min(Math.max(v, Math.min(a, b)), Math.max(a, b));
    const c1: Pt = [
      hold(p1[0] + (p2[0] - p0[0]) / 6, p1[0], p2[0]),
      hold(p1[1] + (p2[1] - p0[1]) / 6, p1[1], p2[1]),
    ];
    const c2: Pt = [
      hold(p2[0] - (p3[0] - p1[0]) / 6, p1[0], p2[0]),
      hold(p2[1] - (p3[1] - p1[1]) / 6, p1[1], p2[1]),
    ];
    out.push(`C${n(c1[0])} ${n(c1[1])} ${n(c2[0])} ${n(c2[1])} ${n(p2[0])} ${n(p2[1])}`);
  }
  return out.join(" ");
}

/** One closed piece of cloth, from runs of points laid end to end. */
export function outline(...runs: Pt[][]): string {
  const pts = dedupe(runs.flat());
  if (pts.length < 2) return "";
  return `M${n(pts[0][0])} ${n(pts[0][1])} ${through(pts, true)} Z`;
}

/**
 * Curve segments only, continuing from wherever the path already is.
 *
 * The yoke arrives as a path fragment — a shared curve three garments hang
 * from — so a body panel is that string followed by this. Pass every run in
 * **one** call rather than concatenating several: the tangent at a join is
 * computed from the neighbouring points, and two calls each clamp their own
 * ends, which puts a visible kink at every seam.
 */
export function run(...runs: Pt[][]): string {
  const pts = dedupe(runs.flat());
  return pts.length < 2 ? "" : through(pts, false);
}

/** An open line — a seam to topstitch, or a neckline handed to a collar. */
export function line(...runs: Pt[][]): string {
  const pts = dedupe(runs.flat());
  if (pts.length < 2) return "";
  return `M${n(pts[0][0])} ${n(pts[0][1])} ${through(pts, false)}`;
}

/** A run of points laid on a straight line, for hems and cuffs. */
export const span = (from: Pt, to: Pt, steps = 4): Pt[] =>
  Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t] as Pt;
  });

/**
 * A hem, bowed downward the way cloth hangs between two side seams.
 *
 * Drawn flat it is the longest straight edge in the wardrobe and reads as the
 * bottom of a rectangle. `dip` is how far the centre front falls below the
 * seams — small on a shirt, more on anything cut full.
 */
export const hem = (left: Pt, right: Pt, dip = 8, steps = 8): Pt[] =>
  Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const x = left[0] + (right[0] - left[0]) * t;
    const y = left[1] + (right[1] - left[1]) * t;
    return [x, y + Math.sin(Math.PI * t) * dip] as Pt;
  });

/**
 * A shirttail hem: the side seams end high, the hem drops steeply away from
 * each and runs nearly level across the front.
 *
 * A shirt is cut long to stay tucked in and rounded up at the sides so the
 * tails do not bunch at the hip. `depth` is how far the front falls below the
 * side seams; the steep start is what reads as a shirttail rather than as a
 * hem that sags.
 */
export const shirttail = (left: Pt, right: Pt, depth: number, steps = 16): Pt[] =>
  Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const x = left[0] + (right[0] - left[0]) * t;
    const y = left[1] + (right[1] - left[1]) * t;
    return [x, y + Math.sin(Math.PI * t) ** SHIRTTAIL_ROUND * depth] as Pt;
  });

/** Under 1 rounds a hem up into its side seams; 0.6 is a shirt's, not a sack's. */
const SHIRTTAIL_ROUND = 0.6;

/**
 * A seam and its reflection, as path fragments — the shoulder, in practice.
 *
 * Give it the cubic for the **left** side, neck point to shoulder point, and it
 * returns that run and the same run mirrored and reversed, ready to close an
 * outline with. `art/female/yoke.ts` used to carry the second one written out
 * by hand under a comment calling it "the same curve run the other way"; it
 * differed by five units at the steepest part of the shoulder slope, which is
 * the crooked shoulder you could see on the figure. Two hand-typed halves
 * drift. This pair cannot.
 */
export function seamPair(
  from: Pt,
  c1: Pt,
  c2: Pt,
  to: Pt
): { left: string; right: string } {
  const f = (q: Pt) => `${n(q[0])} ${n(q[1])}`;
  const m = (q: Pt): Pt => [W - q[0], q[1]];
  return {
    left: `C${f(c1)} ${f(c2)} ${f(to)}`,
    right: `C${f(m(c2))} ${f(m(c1))} ${f(m(from))}`,
  };
}

/* --------------------------------------------------------- reading an edge */

/**
 * An edge's x at any height, clamped at both ends and across any gap.
 *
 * A measurement has holes in it — a wrist thins past the alpha threshold and
 * comes back — and it stops where the limb does. A drawing asking for a cuff
 * two units below the last sample should get the last sample, not `null` and a
 * hole in a sleeve, so this reads the nearest solid value rather than failing.
 */
const solidCache = new WeakMap<BodyEdge, [number, number][]>();

function solid(edge: BodyEdge): [number, number][] {
  let s = solidCache.get(edge);
  if (!s) {
    s = edge.x
      .map((v, i) => [edge.fromY + i * edge.step, v] as [number, number | null])
      .filter((pair): pair is [number, number] => pair[1] !== null);
    solidCache.set(edge, s);
  }
  return s;
}

export function at(edge: BodyEdge, y: number): number {
  const s = solid(edge);
  if (s.length === 0) return CENTER;
  if (y <= s[0][0]) return s[0][1];
  if (y >= s[s.length - 1][0]) return s[s.length - 1][1];
  for (let i = 1; i < s.length; i++) {
    if (s[i][0] < y) continue;
    const [y0, x0] = s[i - 1];
    const [y1, x1] = s[i];
    return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0);
  }
  return s[s.length - 1][1];
}

/** How far apart seams are sampled. Twelve units is 2.3 cm of cloth. */
const STEP = 12;

/**
 * Pull a string taut down the outside of a run of edge samples.
 *
 * The lower convex hull in (y, x) — every returned point is at or outside the
 * body, the ends are kept, and the middle is bridged wherever the body falls
 * away. Physically this is what a hanging panel does between two points of
 * contact, and geometrically it is what stops a "straight-cut" garment from
 * being drawn as a literal straight line, which is the other way to get this
 * wrong.
 */
export function taut(pts: Pt[]): Pt[] {
  const hull = outerHull(pts);
  // Re-sample the hull at the original heights so the seam keeps its spacing:
  // three points make a smooth curve badly, and every other run here is dense.
  return pts.map(([, y]) => {
    for (let i = 1; i < hull.length; i++) {
      if (hull[i][1] < y) continue;
      const [x0, y0] = hull[i - 1];
      const [x1, y1] = hull[i];
      const t = y1 === y0 ? 0 : (y - y0) / (y1 - y0);
      return [x0 + (x1 - x0) * t, y] as Pt;
    }
    return [hull[hull.length - 1][0], y] as Pt;
  });
}

/** The corners `taut` pulls its string between: the outer hull of a run, in order. */
function outerHull(pts: Pt[]): Pt[] {
  const cross = (o: Pt, a: Pt, b: Pt) =>
    (a[1] - o[1]) * (b[0] - o[0]) - (a[0] - o[0]) * (b[1] - o[1]);
  const hull: Pt[] = [];
  for (const q of pts) {
    while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], q) <= 0) {
      hull.pop();
    }
    hull.push(q);
  }
  return hull;
}

/**
 * The same string, but rounded: a curve through the corners `taut` pulls
 * between, rather than straight runs from one to the next.
 *
 * Taut, a run over a rounded shape is a polygon, and a polygon has corners —
 * on a drop shoulder, one where the seam leaves the trapezius and one where it
 * reaches the sleeve. Through the same corners a spline bulges a little
 * further out between them, never in, so it still clears the body. `lead` is
 * the point before the run, so the curve leaves its first point in the
 * direction the line was already going. Re-sampled at the run's own heights.
 */
export function rounded(pts: Pt[], lead?: Pt): Pt[] {
  const hull = outerHull(pts);
  if (hull.length < 3) return taut(pts);
  const first = lead ?? hull[0];
  const [a, b] = [hull[hull.length - 2], hull[hull.length - 1]];
  const ctrl: Pt[] = [first, ...hull, [2 * b[0] - a[0], 2 * b[1] - a[1]]];
  const dense: Pt[] = [];
  for (let i = 1; i < ctrl.length - 2; i++) {
    const [p0, p1, p2, p3] = [ctrl[i - 1], ctrl[i], ctrl[i + 1], ctrl[i + 2]];
    for (let k = 0; k < 8; k++) {
      const t = k / 8;
      const t2 = t * t;
      const t3 = t2 * t;
      const at = (j: 0 | 1) =>
        0.5 * (2 * p1[j] + (p2[j] - p0[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 +
          (3 * p1[j] - p0[j] - 3 * p2[j] + p3[j]) * t3);
      dense.push([at(0), at(1)]);
    }
  }
  dense.push(hull[hull.length - 1]);
  const hulled = taut(pts);
  return pts.map(([, y], i) => {
    let x = hulled[i][0];
    for (let j = 1; j < dense.length; j++) {
      const [x0, y0] = dense[j - 1];
      const [x1, y1] = dense[j];
      if ((y0 <= y && y <= y1) || (y1 <= y && y <= y0)) {
        x = Math.min(x, y1 === y0 ? x0 : x0 + ((x1 - x0) * (y - y0)) / (y1 - y0));
        break;
      }
    }
    return [x, y] as Pt;
  });
}

/** How many samples a run takes, and the ease at each of them. */
function paces(r: Run): { y: number; ease: number }[] {
  const step = r.step ?? STEP;
  const rows = Math.max(1, Math.round(Math.abs(r.to - r.from) / step));
  const toEase = r.toEase ?? r.ease;
  return Array.from({ length: rows + 1 }, (_, i) => {
    const t = i / rows;
    return { y: r.from + (r.to - r.from) * t, ease: r.ease + (toEase - r.ease) * t };
  });
}

/** Walk an edge from one height to another, `ease` units clear of the body. */
function walk(edge: BodyEdge, r: Run, sign: 1 | -1): Pt[] {
  return paces(r).map(({ y, ease }) => [at(edge, y) + sign * ease, y] as Pt);
}

/* ------------------------------------------------------------- the drafting */

export interface Run {
  /** Where the run starts and ends, in canvas units down the figure. */
  from: number;
  to: number;
  /** How far outside the body the cloth sits at `from`. */
  ease: number;
  /**
   * The ease at `to`, if the piece is not cut parallel to the body.
   *
   * A short sleeve flares toward its hem, a trouser leg tapers toward its cuff
   * and a skirt does nothing else. Interpolated along the run, so one number
   * turns a tube into a shape.
   */
  toEase?: number;
  /** Sampling interval; the default suits any seam. */
  step?: number;
}

/**
 * Everything a drawing needs to know about one body.
 *
 * Each of these returns the **left** side, top to bottom, as points. Mirror it
 * for the right and the two cannot disagree; that is the entire discipline, and
 * it is what the old hand-typed pairs could not offer.
 */
export interface Draft {
  /** Where the outline turns from shoulder to arm: the end of the shoulder seam. */
  shoulderPointY: number;
  /** The elbow and the wrist — what every sleeve length is measured to. */
  elbowY: number;
  wristY: number;
  /** The row the arms leave the ribs. Any true armhole bottoms out here. */
  armpitY: number;
  /** The body's own waist: the middle of the trunk's narrowest band. */
  waistY: number;
  /** The first row below the waist where the trunk is widest — what a skirt rests on. */
  hipY: number;
  /** The row the legs part. */
  crotchY: number;
  /** The row the hands run out — a sleeve past it is a sleeve onto air. */
  armEndY: number;

  /** The trunk's edge: a side seam that follows the body, for anything fitted. */
  side(run: Run): Pt[];
  /**
   * A side seam that skims the body instead of clinging to it.
   *
   * Cloth hanging from the chest does not dive into the waist and climb back
   * out over the hip — it bridges, the way a string pulled taut round a shape
   * does, touching only where the body is widest. So this is the taut line: the
   * convex hull of the measured edge between the two ends, which touches at the
   * bust and the hip and passes clear of everything between.
   *
   * A t-shirt, a shirt and a polo are cut this way. A blouse and a dress use
   * `side` and take the waist, because that is what makes them what they are.
   */
  skim(run: Run & { bridge?: number }): Pt[];
  /** The arm's outer edge: the outside of a sleeve. */
  armOut(run: Run): Pt[];
  /** The arm's edge facing the ribs: the raw edge, with no regard for the ribs. */
  armIn(run: Run): Pt[];
  /**
   * A sleeve's inner edge — the arm's, but never closer to the trunk than
   * `clear` units.
   *
   * This is the one that garments use, and the clamp is the whole point. Ease
   * eats the daylight from both sides: near the armpit her arm hangs less than
   * ten units clear of her ribs, so four units of ease on the sleeve and four
   * on the side seam close the gap completely and the two pieces fuse back into
   * the slab this was all meant to fix. Holding the sleeve off the side seam
   * costs a sliver of ease exactly where a real sleeve is cut close anyway.
   */
  sleeveIn(run: Run & { clear?: number; seamEase?: number }): Pt[];
  /** One leg's outer edge, followed exactly. */
  legOut(run: Run): Pt[];
  /** One leg's edge facing the other leg, followed exactly. */
  legIn(run: Run): Pt[];
  /**
   * The same two edges, but hanging rather than clinging.
   *
   * A trouser leg is cloth suspended from the hip. It touches the thigh and the
   * calf and bridges the hollows between, which is why a straight-leg trouser
   * is straight — not because anyone drew it with a ruler. Followed exactly,
   * the measured edge turns a pair of trousers into a pair of leggings: it dives
   * in behind the knee, swells at the calf and pinches at the ankle, all of
   * which a photograph shows and none of which cloth does.
   */
  legOutHang(run: Run): Pt[];
  legInHang(run: Run): Pt[];

  /** The body's own edge at a height, with ease — for placing a single point. */
  sideAt(y: number, ease: number): number;
  armOutAt(y: number, ease: number): number;
  armInAt(y: number, ease: number): number;
  legOutAt(y: number, ease: number): number;
  legInAt(y: number, ease: number): number;

  /**
   * Where a garment's underarm sits: a little below the body's own armpit,
   * because cloth cannot be cut into the crease itself.
   */
  underarm(ease: number, drop?: number): Pt;

  /** A bowed run between two points, pushed `bow` units away from the body. */
  arc(from: Pt, to: Pt, bow: number, steps?: number): Pt[];

  /** The throat at a height: both edges, and the centre between them. */
  neck(y: number): { left: number; right: number; center: number; width: number };

  /**
   * The shoulder seam: from a neck point out to a shoulder point, following the
   * body.
   *
   * This used to be a single hand-solved cubic, and the reason it had to be is
   * that nothing had measured the shoulder. A cubic cannot hug a slope that
   * breaks as sharply as this one — her silhouette drops fifteen units between
   * y 178 and y 188 — so the curve that cleared her everywhere cleared her by
   * up to **11.7 units at y 192**, which is two and a quarter centimetres of
   * cloth standing off the trapezius. That is a shoulder pad, and it is what
   * the cloth looked like.
   *
   * Walking the measured edge holds the seam at a constant small ease the whole
   * way, so the cloth falls off the shoulder instead of bridging it.
   */
  shoulder(neckPt: Pt, tip: Pt, ease: number): Pt[];

  /**
   * The armhole, from the shoulder point down to the underarm: the seam where
   * the sleeve is set into the body.
   *
   * Head-on it runs from the end of the shoulder seam almost straight down to
   * the armpit, bowed a little outward — the line between the torso and the
   * arm, which is where a sleeve is sewn on every set-in garment. It used to
   * start on the outside of the deltoid and cut diagonally across the top of
   * the arm to the armpit, because the shoulder point it started from was.
   */
  scye(tip: Pt, ease: number, drop?: number): Pt[];

  /**
   * The sleeve head's seam edge, from the underarm up to the shoulder point —
   * the same line as the armhole it is set into, so the seam drawn along it is
   * the seam between the two pieces.
   *
   * A cap is cut longer than the armhole and the surplus eased in, so it
   * stands a little proud at the shoulder point. That small roll is most of
   * what makes a shoulder read as constructed rather than as a silhouette that
   * happens to bend.
   */
  cap(tip: Pt, ease: number, rise?: number, drop?: number): Pt[];
}

/** How far below the body's armpit a garment's underarm seam sits. */
const UNDERARM_DROP = 8;
/**
 * How far a sleeve head stands above the shoulder point.
 *
 * Two, not four. A cap is cut longer than the armhole it is set into and the
 * surplus eased in, so it does stand a little proud — but it was four units up
 * and bowed six out over a shoulder seam that was itself standing eleven units
 * off the body, where nobody could tell. Now that the seam hugs, the same cap
 * reads as a tab stuck on the end of the shoulder.
 */
const CAP_RISE = 2;

/**
 * How far an armhole bows outward of the straight line from the shoulder point
 * to the underarm — and the sleeve cap with it, because they are the same seam.
 */
const SCYE_BOW = 3;

/**
 * A seam between two points, bowed `bow` units toward the outside of the
 * figure at its middle.
 *
 * Measured off the chord, not off the start point. The armhole used to be a
 * curve whose control point sat `bow` units outside the *shoulder point*, so
 * it left the shoulder vertically and swung in only at the bottom — right
 * while the shoulder point was out on the arm, and ten units across the arm
 * once it is where the shoulder actually ends.
 */
export function seamCurve(from: Pt, to: Pt, bow: number, steps = 5): Pt[] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  // the normal on the outside of the figure: the one pointing away from centre
  let nx = -dy / len;
  let ny = dx / len;
  if ((from[0] + to[0]) / 2 < CENTER ? nx > 0 : nx < 0) {
    nx = -nx;
    ny = -ny;
  }
  const cx = (from[0] + to[0]) / 2 + nx * bow * 2;
  const cy = (from[1] + to[1]) / 2 + ny * bow * 2;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const m = 1 - t;
    return [
      m * m * from[0] + 2 * m * t * cx + t * t * to[0],
      m * m * from[1] + 2 * m * t * cy + t * t * to[1],
    ] as Pt;
  });
}

/** The daylight a sleeve keeps between itself and the side seam. */
const GAP = 5;
export { GAP as SLEEVE_GAP, GAP_RAMP as SLEEVE_GAP_RAMP, SEAM_EASE as SLEEVE_SEAM_EASE, CAP_RISE as SLEEVE_CAP_RISE, SCYE_BOW as SLEEVE_SCYE_BOW, UNDERARM_DROP as SLEEVE_UNDERARM_DROP };

/**
 * The side-seam ease `sleeveIn` measures its clearance against.
 *
 * The clamp has to be against where the *body panel* will be, not against the
 * sleeve's own ease — otherwise a sleeve cut close reads its clearance from a
 * seam that is not there, and the gap comes out wrong in whichever direction
 * the two eases differ.
 */
const SEAM_EASE = 4;

/** How far below the underarm the gap takes to open fully. */
const GAP_RAMP = 45;

/**
 * The furthest a straight-cut seam may stand off the body it bridges.
 *
 * Three, not seven. Seven plus the garment's own four put a t-shirt's side seam
 * **11 units off her waist** — two and a tenth centimetres of air on each side,
 * which is a garment hovering rather than hanging. The bridge exists so that
 * cloth falling from the bust does not dive into a waist and climb back out
 * over a hip, and three units is enough to say that: it still clears the
 * narrowest point, and it lands the seam within a couple of units of the body
 * everywhere else.
 *
 * Fitted cuts pass 0 here and hug the measured edge, which is why the blouse
 * and the dress were already right at a constant four.
 */
const BRIDGE = 3;
/** How far below the underarm that bridge takes to open up. */
const BRIDGE_RAMP = 80;

/**
 * The furthest a trouser leg may stand off the leg it hangs on.
 *
 * `legOutHang` pulls a taut line down the outside of a leg, which is what makes
 * a straight-leg trouser straight — and, uncapped, is what made it a tube. Her
 * calf narrows away from the line by seven units on top of the ease, so the
 * cloth stood 18 units clear at the knee: a wide shape placed around a leg
 * rather than a trouser on one.
 */
const LEG_BRIDGE = 3;

export function draft(body: BodyType): Draft {
  const p = profileFor(body);

  const edgeRun = (edge: BodyEdge, sign: 1 | -1) => (r: Run) => walk(edge, r, sign);

  const point = (edge: BodyEdge, sign: 1 | -1) => (y: number, ease: number) =>
    at(edge, y) + sign * ease;

  const sideAt = point(p.torso, -1);
  const armOutAt = point(p.armOuter, -1);
  const armInAt = point(p.armInner, +1);

  const underarm = (ease: number, drop = UNDERARM_DROP): Pt => [
    sideAt(p.armpitY + drop, ease),
    p.armpitY + drop,
  ];

  /**
   * A hollow curve between two points, sampled.
   *
   * `bow` pushes the middle of the run toward the outside of the figure, which
   * on an armhole is what makes it a scye rather than a diagonal.
   */
  const hollow = (from: Pt, to: Pt, bow: number, steps = 5): Pt[] =>
    Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps;
      const m = 1 - t;
      // a quadratic whose control point sits outside the chord
      const cx = from[0] - bow;
      const cy = from[1] + (to[1] - from[1]) * 0.72;
      return [
        m * m * from[0] + 2 * m * t * cx + t * t * to[0],
        m * m * from[1] + 2 * m * t * cy + t * t * to[1],
      ] as Pt;
    });

  return {
    shoulderPointY: p.shoulderPointY,
    elbowY: p.elbowY,
    wristY: p.wristY,
    armpitY: p.armpitY,
    waistY: p.waistY,
    hipY: p.hipY,
    crotchY: p.crotchY,
    armEndY: p.armEndY,

    side: edgeRun(p.torso, -1),

    skim: (r) => {
      const walked = paces(r);
      const raw: Pt[] = walked.map(({ y }) => [at(p.torso, y), y] as Pt);
      const hull = taut(raw);
      /*
        The taut line, but not taken literally.

        A string pulled from her armpit to her hip passes 23 units outside her
        waist — four and a half centimetres — because her waist is narrower than
        both. Cloth does not do that: it falls and rests against the body rather
        than holding a chord across the front of it. Left unbounded this was
        eating the whole arm gap: the side seam stood so far out that the sleeve
        had nowhere to be except underneath it, and `check:garments` measured
        the daylight at zero on four garments.

        So the bridge is capped, and the cap ramps in from nothing at the
        underarm — where a garment genuinely is against the body — to `BRIDGE`
        a hand's width below it.
      */
      return hull.map(([x, y], i) => {
        const body = raw[i][0];
        const ramp = Math.min(1, Math.abs(y - r.from) / BRIDGE_RAMP);
        const bridge = Math.min(body - x, (r.bridge ?? BRIDGE) * ramp);
        return [body - bridge - walked[i].ease, y] as Pt;
      });
    },
    armOut: edgeRun(p.armOuter, -1),
    armIn: edgeRun(p.armInner, +1),
    legOut: edgeRun(p.legOuter, -1),
    legIn: (r) =>
      paces(r).map(
        ({ y, ease }) => [Math.min(at(p.legInner, y) + ease, CENTER), y] as Pt
      ),

    legOutHang: (r) => {
      const walked = paces(r);
      const raw: Pt[] = walked.map(({ y }) => [at(p.legOuter, y), y] as Pt);
      /*
        Taut, but capped — the same correction the side seam needed, for the
        same reason. A string pulled down the outside of a leg bridges every
        hollow it passes, and her calf falls seven units away from it; left
        uncapped that put the cloth 18 units clear of the leg at the knee.
        Capped at five, the trouser is still straight-legged and is on the leg.
      */
      return taut(raw).map(([x, y], i) => {
        const body = raw[i][0];
        const bridge = Math.min(body - x, LEG_BRIDGE);
        return [body - bridge - walked[i].ease, y] as Pt;
      });
    },

    /*
      `taut` pulls its string toward *small* x, which is the outside of the left
      half. The inner edge hangs the other way, so it is folded across the
      centre line, pulled taut there, and folded back.
    */
    legInHang: (r) => {
      const walked = paces(r);
      const raw: Pt[] = walked.map(({ y }) => [W - at(p.legInner, y), y] as Pt);
      return taut(raw).map(
        ([x, y], i) => [Math.min(W - x + walked[i].ease, CENTER), y] as Pt
      );
    },

    sleeveIn: (r) => {
      const clear = r.clear ?? GAP;
      /*
        Measured against where this garment's *own* side seam will be. A jacket
        is cut nine units off the body and a t-shirt four; clamping both against
        one constant lets the jacket's sleeve sit inboard of its own side seam,
        which does not narrow the gap so much as turn it inside out.
      */
      const seamEase = r.seamEase ?? SEAM_EASE;
      return paces(r).map(({ y, ease }) => {
        // The daylight opens below the underarm rather than starting there. At
        // the seam itself a sleeve and a body panel meet — that is what a seam
        // is — and a gap forced open at the top reads as a tear rather than as
        // an arm hanging free.
        const open = Math.min(1, Math.abs(y - r.from) / GAP_RAMP);
        return [
          Math.min(armInAt(y, ease), sideAt(y, seamEase) - clear * open),
          y,
        ] as Pt;
      });
    },

    sideAt,
    armOutAt,
    armInAt,
    legOutAt: point(p.legOuter, -1),
    /*
      Clamped at the centre line. Right at the crotch the two legs are still
      touching, so the measured inner edge plus ease lands *past* centre and the
      two trouser legs would cross over each other. Meeting there is correct —
      that is the inseam — so they meet and part below it.
    */
    legInAt: (y: number, ease: number) =>
      Math.min(at(p.legInner, y) + ease, CENTER),

    underarm,

    arc: hollow,

    neck: (y) => {
      const left = at(p.neckLeft, y);
      const right = at(p.neckRight, y);
      return { left, right, center: (left + right) / 2, width: right - left };
    },

    shoulder: (neckPt, tip, ease) => {
      /*
        The seam hugs the shoulder. It does not bridge it.

        Cloth laid over a shoulder follows it: in a front view the garment's
        outer edge at the shoulder *is* the body's edge plus the thickness of
        the cloth. Two other constructions were tried here and both put the
        shoulder pad back. Taking the outermost edge within a couple of rows
        stood 21 units off at the corner; pulling a taut line from the neck
        point — which sits inboard of the silhouette, so the line has to bridge
        everything outboard of it — stood 20.8 off the trapezius, which is worse
        than the hand-solved cubic this replaced.

        Hugging is safe now only because `armOuter` is stored as a conservative
        outer envelope: each sample is the outermost edge over the rows it
        stands for, so interpolating between two of them can never cut inside
        the body. Before that it could, and did, by five units at the deltoid.

        Sampled every two units, matching how finely that edge is recorded.
      */
      const rows = Math.max(1, Math.round((tip[1] - neckPt[1]) / 2));
      const pts: Pt[] = [];
      for (let i = 0; i <= rows; i++) {
        const y = neckPt[1] + ((tip[1] - neckPt[1]) * i) / rows;
        pts.push([at(p.armOuter, y) - ease, y]);
      }
      // The seam starts *on* the body at the neck point, not at its edge — the
      // neck point is inboard of the silhouette, which is what a neck point is.
      pts[0] = neckPt;
      pts[pts.length - 1] = tip;
      /*
        Past the shoulder point the seam is on the arm — a drop shoulder and a
        cap both carry it down the deltoid — and there the measured edge steps
        from sample to sample, which read as a row of small bumps along the
        top of the arm. Rounded over that stretch — see `rounded` — it turns
        over the deltoid in one line and still never cuts inside it.
      */
      const past = pts.findIndex(([, y]) => y > p.shoulderPointY);
      if (past > 0 && pts.length - past > 1) {
        const tail = rounded(pts.slice(past - 1), pts[past - 2]);
        pts.splice(past - 1, tail.length, ...tail);
      }
      return pts;
    },

    scye: (tip, ease, drop = UNDERARM_DROP) =>
      seamCurve(tip, underarm(ease, drop), SCYE_BOW),

    cap: (tip, ease, rise = CAP_RISE, drop = UNDERARM_DROP) =>
      reverse(seamCurve([tip[0], tip[1] - rise], underarm(ease, drop), SCYE_BOW, 9)),
  };
}

/* ---------------------------------------------------------- whole garments */

/**
 * A top with set-in sleeves, cut against a body.
 *
 * This is the part of the system that matters, because it is what every new
 * garment has to go through. All four fit faults this wardrobe has had came
 * from a drawing typing its own outline — two shoulders that disagreed, an
 * underarm guessed twenty units low, a sleeve welded to a side seam, a leg
 * silhouette shared between two different bodies. None of them can be expressed
 * here. The left side is built once and mirrored, the armhole bottoms out at
 * the measured armpit, and the sleeve's inner edge is held off the side seam by
 * construction rather than by care.
 *
 * A drawing supplies what is genuinely its own — where its hem falls, how much
 * ease it is cut with, where its sleeve stops — and nothing else.
 */
export interface TopSpec {
  /** The shoulder point the garment hangs from: its yoke's tip. */
  tip: Pt;
  /** How far outside the body the body panel is cut. */
  ease: number;
  /** Where the body panel stops. */
  hemY: number;
  /** How far the hem dips at centre front. */
  dip?: number;
  /**
   * A shirttail instead of a dipped hem: how far the front falls below the
   * side seams, which end at `hemY`. See `shirttail`.
   */
  tail?: number;
  /** Extra ease at the hem — anything cut full takes some. */
  hemEase?: number;
  /** Where the sleeve stops. Omitted, the garment is sleeveless. */
  cuffY?: number;
  /** The sleeve's outer ease, at the cap and at the cuff. */
  sleeve?: [number, number];
  /** The sleeve's inner ease, at the cap and at the cuff. */
  inner?: [number, number];
  /**
   * Whether the side seam takes the waist.
   *
   * A blouse and a dress do; a t-shirt, a shirt and a polo bridge it. See
   * `skim`, which explains why bridging is the truer default.
   */
  fitted?: boolean;
  /**
   * How far the seam may stand off the body where it bridges, overriding
   * whichever of the two `fitted` would pick.
   *
   * A tailored jacket is the case that needs it: shaped at the waist, but not
   * to the millimetre the way a blouse is. Cut with the full bridge it stood
   * so far off the ribs that the sleeve had nowhere to hang; cut with none it
   * came out as an hourglass.
   */
  bridge?: number;
  /**
   * A robe's A-line, as `column`'s `straight` cuts a skirt's: the side seam
   * straight from where it leaves her below the underarm, out by this much
   * per unit down to the hem, and never closer to her than its ease. An
   * abaya hangs this way, loose over whatever is worn under it.
   */
  straight?: number;
}

/**
 * A side straightened from where a line of `slope` first touches it from
 * outside: above that point the side as it was, below it the line — so the
 * line clears every row below, as an A-line's does. See `column`.
 */
function straightened(side: Pt[], slope: number): Pt[] {
  let k = 0;
  side.forEach(([x, y], i) => {
    if (x + slope * y < side[k][0] + slope * side[k][1]) k = i;
  });
  const [kx, ky] = side[k];
  return side.map(([x, y], i) => (i <= k ? [x, y] : [kx - slope * (y - ky), y]) as Pt);
}

export interface Top {
  /**
   * The body panel from one shoulder point round to the other, as a path
   * fragment — a yoke goes before it and a neckline after.
   */
  sides: string;
  /** Each sleeve as its own closed piece, the right one mirroring the left. */
  sleeveLeft: string;
  sleeveRight: string;
  /** Both armhole seams, both cuffs and the hem, ready to topstitch. */
  stitch: string;
  /** The underarm the body panel and the sleeve are both cut to. */
  underarm: Pt;
  /** Where the side seam ends, for anything sewn onto the hem. */
  hemLeft: Pt;
  /**
   * The runs `sides` is made of, before they were joined and mirrored.
   *
   * `sides` is the left half, the hem, and the left half reflected — which is
   * right for every garment that is the same on both sides, and is exactly
   * wrong for the two that are not. A one-shoulder cut covers one shoulder and
   * crosses the chest to the opposite underarm, so it needs the armhole on one
   * side and not the other, and it can only get that by reassembling these.
   *
   * Left side only, top to bottom. Mirror for the right.
   */
  parts: { scye: Pt[]; side: Pt[]; hem: Pt[] };
}

/**
 * A top's side seam, from `fromY` — the underarm, or lower for a sleeve that
 * is cut with a deeper one — down to its hem.
 */
export function bodySide(body: BodyType, spec: TopSpec, fromY: number): Pt[] {
  const side = hungSide(body, spec, fromY);
  return spec.straight === undefined ? side : straightened(side, spec.straight);
}

function hungSide(body: BodyType, spec: TopSpec, fromY: number): Pt[] {
  const d = draft(body);
  const { ease, hemY, hemEase = 0 } = spec;
  const waistEase = ease;
  const upper: Run = {
    from: fromY,
    to: Math.min(hemY, d.crotchY),
    ease,
    toEase: hemY > d.crotchY ? waistEase : ease + hemEase,
  };
  const bridge = spec.bridge ?? (spec.fitted ? 0 : undefined);
  const shaped = { ...upper, bridge };
  if (hemY <= d.crotchY) return d.skim(shaped);

  /*
    Past the crotch there is no trunk left to follow, and the legs are not
    something to follow either: one piece of cloth hangs from the hips over
    both of them. The seam used to walk each leg's outer edge, so it came in
    at the knee and flared out again below it — a mermaid, on a thobe. It hangs
    instead: skimming the body to the hip, then the tightest line from there
    to the hem that clears the thighs — straight, or as A-line as `hemEase`
    makes it, and never back in.
  */
  const hipY = Math.min(d.hipY, d.crotchY);
  const toHip = d.skim({ ...shaped, to: hipY, toEase: waistEase });
  const hip = toHip[toHip.length - 1];
  const legs = d.legOut({ from: d.crotchY, to: hemY, ease: waistEase });
  const hem: Pt = [hip[0] - hemEase, hemY];
  const hang = taut([hip, ...legs.slice(0, -1), hem]);
  return [...toHip, ...hang.slice(1)];
}

export function setIn(body: BodyType, spec: TopSpec): Top {
  const d = draft(body);
  const { tip, ease, hemY, dip = 9, hemEase = 0, cuffY } = spec;
  const [capEase, cuffEase] = spec.sleeve ?? [ease, ease + 3];
  const [inTop, inHem] = spec.inner ?? [2, 4];

  const scye = d.scye(tip, ease);
  const under = d.underarm(ease);

  /*
    A garment longer than the crotch runs out of trunk to follow, so below that
    row it hangs on the outside of the legs instead. The thobe is the only thing
    here that reaches so far, and without this its side seam would freeze at the
    last measured hip value and fall as a dead vertical for four hundred units.
  */
  /*
    A robe hangs straight to the crotch and flares below it — which is how a
    thobe is actually cut, and also what keeps the flare out of the one place
    it cannot afford to be. Spread over the chest as well, the extra ease put
    the side seam so far out by the ribs that the sleeve had nowhere to hang:
    `check:garments` measured the daylight at zero.
  */
  const side = bodySide(body, spec, under[1]);
  const hemLeft = side[side.length - 1];
  const hemRun = hem(hemLeft, mirror([hemLeft])[0], dip);

  const sides = run(
    scye,
    side,
    hemRun,
    mirror(reverse(side)),
    mirror(reverse(scye))
  );

  const hemStitch = line(
    hem([hemLeft[0] + 5, hemY - 8], [W - hemLeft[0] - 5, hemY - 8], dip)
  );

  if (cuffY === undefined) {
    return {
      sides,
      sleeveLeft: "",
      sleeveRight: "",
      stitch: hemStitch,
      underarm: under,
      hemLeft,
      parts: { scye, side, hem: hemRun },
    };
  }

  const out = d.armOut({ from: tip[1], to: cuffY, ease: capEase, toEase: cuffEase });

  /*
    The sleeve is held off the side seam that was *actually drawn*, read back
    out of `side` — not off a seam recomputed from the body edge and this
    garment's ease.

    The two are not the same thing, and the difference is the whole gap. A
    straight-cut top's seam is a taut line (`skim`), which stands well outside
    the body wherever the body falls away: at her chest it sits seven units
    further out than the clinging seam does. Clamping the sleeve against the
    clinging one let it drift *under* the body panel, and `check:garments`
    reported the daylight as exactly zero on four garments — the same slab, back
    again, by a different route.
  */
  const seamAt = (y: number): number => {
    if (y <= side[0][1]) return side[0][0];
    for (let i = 1; i < side.length; i++) {
      if (side[i][1] < y) continue;
      const [x0, y0] = side[i - 1];
      const [x1, y1] = side[i];
      return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0);
    }
    return side[side.length - 1][0];
  };

  /*
    Two demands, and the arm wins when they conflict. The sleeve is pulled out
    toward the side seam for daylight, but it may never come off the arm it is
    covering: `upperArm` is an erased zone, so a sleeve that stops short of the
    arm's own edge leaves a stripe of body with nothing painted over it. Where
    a garment is cut loose enough that its side seam sits over the arm, there is
    genuinely no daylight to be had on that row, and the honest answer is to
    cover the arm and let the two overlap.
  */
  const inner = d
    .sleeveIn({ from: under[1], to: cuffY, ease: inTop, toEase: inHem, clear: 0 })
    .map(([x, y]) => {
      const open = Math.min(1, Math.max(0, y - under[1]) / GAP_RAMP);
      const wanted = Math.min(x, seamAt(y) - GAP * open);
      return [Math.max(wanted, d.armInAt(y, 0)), y] as Pt;
    });
  const capTop: Pt = [tip[0], tip[1] - CAP_RISE];
  // The cap lands on the sleeve's own underarm, not on the body's, so the two
  // edges meet instead of leaving a notch where the seam should be.
  /*
    The cap is set into the armhole the body panel was actually cut with: it
    ends at the body's underarm point, not at the top of the sleeve's own
    inner edge a few units inboard of it. Ended there, the two seams diverged
    at the bottom and left a sliver of erased body between them with nothing
    painted over it.
  */
  const cap = reverse(seamCurve(capTop, under, SCYE_BOW, 9));
  const cuff = span(out[out.length - 1], inner[inner.length - 1], 3);

  const sleeve: Pt[] = [...out, ...cuff, ...reverse(inner), ...cap];

  const cuffLine = span(
    [out[out.length - 1][0] + 4, cuffY - 8],
    [inner[inner.length - 1][0] - 3, cuffY - 8],
    3
  );

  return {
    sides,
    sleeveLeft: outline(sleeve),
    sleeveRight: outline(mirror(sleeve)),
    stitch: [
      line(cap),
      line(mirror(cap)),
      line(cuffLine),
      line(mirror(cuffLine)),
      hemStitch,
    ].join(" "),
    underarm: under,
    hemLeft,
    parts: { scye, side, hem: hemRun },
  };
}

/**
 * Trousers: two legs, each its own piece, with the body's own daylight between.
 *
 * Both trouser drawings used to carry the same inner edge to the unit — the run
 * `L295 760 L298 640 L300 512` appears character for character in each — so the
 * one measurement that most separates the two figures was the one thing the two
 * garments shared. His ankles are 96 units apart and hers are 42. Measured,
 * that difference costs nothing to honour, and it is most of what tells a pair
 * of men's trousers from a woman's at a glance.
 *
 * Two pieces rather than one shape with a notch cut in it, because a filter
 * applied to a piece lights that piece: one shape gives one slab of light
 * across both legs, and two give two tubes.
 */
export interface LegsSpec {
  /**
   * How far below the body's own waist the waistband's top edge sits.
   *
   * Relative, never absolute. Both pairs of trousers used to type `waistY: 362`
   * — the same row on two bodies whose waists are 33 units apart — which put
   * his waistband four centimetres up his stomach. The body says where its
   * waist is (`draft().waistY`); the garment says only how it wears there.
   */
  rise: number;
  /** How deep the waistband is. */
  band: number;
  hemY: number;
  /**
   * Ease at the waistband. A band grips the waist — that is its job — so it is
   * cut to the body, not to the seat. Defaults to `WAISTBAND_EASE`.
   */
  waistEase?: number;
  /** Ease at the hip, down the outside of the leg, and at the hem. */
  ease: number;
  legEase?: number;
  cuffEase?: number;
  /** Ease on the inside of the leg; an inseam is cut closer than a side seam. */
  innerEase?: number;
  /** The hem of a jacket worn over them — see `tucked`. */
  inside?: Tuck;
  /**
   * The fly, in centimetres: its J topstitched `width` from the centre front
   * and `length` down from the band, on the wearer's `on` side — a man's
   * on his left, a woman's on her right. See `trouserDetails`.
   */
  fly?: { length: number; width: number; on: "left" | "right" };
  /** How far below the band, in centimetres, a slanted pocket's opening reaches the side seam. */
  pocket?: number;
}

export interface Legs {
  left: string;
  right: string;
  /** Each leg's free edges — everything but where it is sewn to, or lies against, the other. */
  edges: [string, string];
  /** The centre front seam, waist to crotch, and wherever the two inseams lie against each other below it. */
  seam: string;
  /** The row the waistband's top edge is on, and its bottom edge. */
  waistY: number;
  bandY: number;
  /**
   * The waistband, cut from the legs' own edge between those rows — so it
   * narrows and widens with the body under it instead of being a trapezoid
   * typed across it.
   */
  band: string;
  /** Topstitch along the band's top and bottom edges. */
  bandStitch: string;
  /** Both inseams and both hems. */
  stitch: string;
  /** The waist's left corner, for a band drawn across it. */
  waistLeft: Pt;
  /** The fly, the slanted pockets and the belt loops — see `trouserDetails`. */
  details: TrouserDetails;
}

/**
 * The details sewn into a pair of trousers, seen from the front. None of them
 * moves the outline: each lies on the cloth, inside it.
 */
export interface TrouserDetails {
  /**
   * The fly: its J of topstitch; the centre front edge it closes along, from
   * the band to the J's foot; and the soft shadow that edge throws on the side
   * it laps over.
   */
  fly: { stitch: string; edge: string; lap: string } | null;
  /**
   * A slanted pocket on each leg: the opening's edge, its topstitch on the
   * front panel, the facing behind the opening — which its shadow is kept
   * to — and that shadow, deepest where the opening lifts most.
   */
  pockets: { edge: string; stitch: string; facing: string; lift: string }[];
  /**
   * The belt loops a front view sees — two at the front creases, one just
   * inside each side seam — as pieces of cloth; each one's free edges (its
   * top is folded over the band's own top edge); and the tacks that hold
   * each down at the top and the foot.
   */
  loops: { pieces: string[]; edges: string[]; tacks: string };
}

/**
 * A waistband cut from a garment's own side edge, from its top down to `bandY`.
 *
 * The band is the top of the side seam and the same seam mirrored, so it
 * narrows and widens with the body under it. It used to be a trapezoid typed
 * from the top corner — `600 - x` across, four units in at the bottom — which
 * is a band that knows one number about the body it is on.
 */
function waistband(side: Pt[], bandY: number): { band: string; bandStitch: string } {
  const xAt = (y: number): number => {
    for (let i = 1; i < side.length; i++) {
      const [x0, y0] = side[i - 1];
      const [x1, y1] = side[i];
      if (y1 >= y) return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0 || 1);
    }
    return side[side.length - 1][0];
  };
  const top = side[0][1];
  const half: Pt[] = [...side.filter(([, y]) => y < bandY), [xAt(bandY), bandY]];
  return {
    band: outline(half, mirror(reverse(half))),
    bandStitch: [top + 6, bandY - 4]
      .map((y) => line(span([xAt(y) + 5, y], [W - xAt(y) - 5, y], 3)))
      .join(" "),
  };
}

/**
 * The waistband's ease: one unit, enough to cover the soft edge of the
 * photograph's cut-out and no more. A band is done up on the body.
 */
const WAISTBAND_EASE = 1;

export function trousers(body: BodyType, spec: LegsSpec): Legs {
  const d = draft(body);
  const { hemY, ease } = spec;
  const waistY = d.waistY + spec.rise;
  const bandY = waistY + spec.band;
  const legEase = spec.legEase ?? ease;
  const cuffEase = spec.cuffEase ?? legEase;
  const innerEase = spec.innerEase ?? 4;

  /*
    Three stretches, not one. The band grips, so it is cut at `waistEase` from
    its top to its bottom edge. Below it the cloth eases out over the belly to
    the seat's ease, which it reaches at the hip — the widest part, where
    trousers need room to sit. From the hip to the crotch it eases on toward the
    leg's.

    It used to be one run at the seat's ease from the top of the band to the
    crotch, so the band stood five units off the waist exactly as the seat
    stands off the hip — and on top of that the measured edge is a conservative
    envelope that runs up to two and a half units wide where the waist flares
    into the hip, which is where the band is. Seven and a half units of air at
    the waist is a band placed round the body rather than done up on it.
  */
  const waistEase = spec.waistEase ?? WAISTBAND_EASE;
  const hipY = Math.min(Math.max(d.hipY, bandY), d.crotchY);
  const hip = [
    ...d.side({ from: waistY, to: bandY, ease: waistEase }),
    ...d.side({ from: bandY, to: hipY, ease: waistEase, toEase: ease }).slice(1),
    ...(hipY < d.crotchY
      ? d.side({ from: hipY, to: d.crotchY, ease, toEase: legEase }).slice(1)
      : []),
  ];
  /* below the crotch each leg hangs from the thigh — see `hungLeg` */
  const hung = hungLeg(d, { from: d.crotchY, to: hemY, legEase, cuffEase, innerEase });
  const out = hung.out;
  /*
    The outside of a leg hangs; the inside follows the leg. A trouser leg is a
    tube around a limb, and its inseam tracks the limb — which is also what the
    daylight between two legs is *of*. Pulled taut like the outer edge it would
    bridge from the crotch to the ankle and quietly close most of the gap this
    was all for. Sampled coarsely, because an inseam is one long gentle curve
    and reading it every twelve units puts the photograph's own jitter into it.
  */
  const inner = hung.inner;
  const cuff = span(out[out.length - 1], inner[inner.length - 1], 3);

  /* Both legs reach the centre line here, and part below it. That is the
     inseam, and it is the whole of the difference between trousers and a
     rectangle with a slot cut in it. */
  const rise: Pt = [CENTER, d.crotchY];
  const waist = span(hip[0], [CENTER, waistY], 4);

  /* under a jacket, the outer edge comes out from under its hem — see `tucked` */
  const outer = tucked([...hip, ...out], spec.inside);
  const leg: Pt[] = [
    ...outer,
    ...cuff,
    ...reverse(inner),
    rise,
    ...reverse(waist),
  ];

  /*
    Topstitch sits *inboard* of the seam it is sewn along, which is both how a
    trouser is made and what keeps it legible. Only the hem's, though: the
    inseam runs down the inside of the leg, where a front view does not see
    it, and drawn there it read as two dashed lines down the inner legs.
  */
  const hemLine = span(
    [out[out.length - 1][0] + 5, hemY - 10],
    [inner[inner.length - 1][0] - 4, hemY - 10],
    3
  );

  const { band, bandStitch } = waistband(hip, bandY);
  const details = trouserDetails(d, spec, { outer, leg, waistY, bandY });

  /*
    The free edges: down the outside, across the hem, up the inseam wherever
    it has parted from the other leg, and the waistband's top. Not the centre
    front, where the two legs are sewn together — outlined there, it was a thin
    pale stripe on a dark page — nor wherever the two inseams lie against each
    other on the centre line: just below the crotch, before they part, and on
    her from the knees down, where her knees touch and a leg hanging straight
    from them meets the other all the way to the hem. Each of those is drawn
    as a seam is, a soft darker line where two tubes of cloth meet.
  */
  const apart = ([x]: Pt) => x < CENTER - 0.5;
  const runs: { apart: boolean; pts: Pt[] }[] = [];
  for (const p of reverse(inner)) {
    const last = runs[runs.length - 1];
    if (last && last.apart === apart(p)) last.pts.push(p);
    else runs.push({ apart: apart(p), pts: last ? [last.pts[last.pts.length - 1], p] : [p] });
  }
  const [first, ...rest] = runs;
  const hemUp = [...outer, ...cuff, ...(first?.apart ? first.pts.slice(1) : [])];
  const parted = rest.filter((r) => r.apart).map((r) => r.pts);
  const touching = runs.filter((r) => !r.apart && r.pts.length > 1).map((r) => r.pts);
  const free = (m: (pts: Pt[]) => Pt[]) =>
    [line(m(hemUp)), ...parted.map((r) => line(m(r))), line(m(reverse(waist)))].join(" ");
  return {
    left: outline(leg),
    right: outline(mirror(leg)),
    edges: [free((pts) => pts), free(mirror)],
    seam: [line(span([CENTER, waistY], rise, 4)), ...touching.map((r) => line(r))].join(" "),
    waistY,
    bandY,
    band,
    bandStitch,
    stitch: [
      line(hemLine),
      line(mirror(hemLine)),
    ].join(" "),
    waistLeft: hip[0],
    details,
  };
}

/* ------------------------------------------------------ the trousers' details */

/** A centimetre, in canvas units. */
const CM = 1 / BODY_CANVAS.cmPerUnit;

/**
 * The least a fly's J stops short of the crotch: "a little above" it. On his
 * short rise the band's foot is only 18.2 cm above the crotch, so a J cut to
 * the 18 cm a man's fly runs would end at the crotch itself; it stops here.
 */
const FLY_CLEAR = 2 * CM;
/** How tall the J's curve is, in fly widths: it turns in over the last of its length. */
const FLY_TURN = 1.1;
/** The angle below the level at which the J's foot meets the centre seam — a J, not a U. */
const FLY_MEET = (40 * Math.PI) / 180;
/** How far the fly's front edge stands off the side it laps over: the width of its shadow there. */
const FLY_LIFT = 1.4;

/** Where a slanted pocket's opening leaves the band: four centimetres in from the side seam. */
const POCKET_IN = 4 * CM;
/** Its topstitch, this far onto the front panel from the opening's edge. */
const POCKET_STITCH = 0.65 * CM;
/** How far the opening lifts off the facing behind it at its middle: the width of its shadow there. */
const POCKET_LIFT = 2.4;

/** A belt loop: a centimetre wide. */
const LOOP_WIDTH = 1 * CM;
/** How far below the band a loop's foot is sewn. */
const LOOP_FOOT = 0.6 * CM;
/** How far in from the side seam the side loops' outer edge is: just inside it. */
const LOOP_SIDE_IN = 0.85 * CM;
/** How far in from a loop's ends its tacks are sewn. */
const LOOP_TACK = 1.8;

/** Where a run of points, top to bottom, is at a row. */
function xOn(run: Pt[], y: number): number {
  if (y <= run[0][1]) return run[0][0];
  for (let i = 1; i < run.length; i++) {
    if (run[i][1] < y) continue;
    const [x0, y0] = run[i - 1];
    const [x1, y1] = run[i];
    return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0 || 1);
  }
  return run[run.length - 1][0];
}

/** Where a closed outline crosses a row: its leftmost and rightmost crossing. */
function across(pts: Pt[], y: number): [number, number] {
  const xs: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
  }
  return [Math.min(...xs), Math.max(...xs)];
}

/** A run of points as straight lines, corners kept: a piece cut square, or a mask. */
const straight = (pts: Pt[], closed: boolean): string =>
  `M${pts.map(([x, y]) => `${n(x)} ${n(y)}`).join(" L")}${closed ? " Z" : ""}`;

/** A cubic from four points, sampled. */
const bezier = (a: Pt, b: Pt, c: Pt, e: Pt, steps: number): Pt[] =>
  Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const m = 1 - t;
    return [
      m * m * m * a[0] + 3 * m * m * t * b[0] + 3 * m * t * t * c[0] + t * t * t * e[0],
      m * m * m * a[1] + 3 * m * m * t * b[1] + 3 * m * t * t * c[1] + t * t * t * e[1],
    ] as Pt;
  });

/**
 * A soft shadow along an edge: the edge itself, and the edge pushed `lift(t)`
 * units toward `side` — a lens, nothing at an end the edge is sewn down at.
 */
function lens(edge: Pt[], side: Pt, lift: (t: number) => number): string {
  const off = edge.map(([x, y], i) => {
    const w = lift(i / (edge.length - 1));
    return [x + side[0] * w, y + side[1] * w] as Pt;
  });
  return outline(edge, reverse(off));
}

/** How far a pocket's opening lifts along it, 0 at the band to 1 at the side seam: most in the middle, none where it is sewn. */
const pocketLift = (t: number) => POCKET_LIFT * Math.pow(Math.sin(Math.PI * t), 0.8);

/**
 * The fly, the slanted front pockets and the belt loops, drafted onto the legs
 * as cut — read off the drawn outline, so under a jacket they follow its tuck.
 *
 * - **The fly.** A J of topstitch, from the band straight down `fly.width` from
 *   the centre front, curving in at its foot to meet the centre seam at an
 *   angle — a little above the crotch, never at it. Its front edge, down the
 *   centre from the band to the J's foot, laps over the other side and throws
 *   a soft shadow on it.
 * - **The pockets.** Each opening leaves the band `POCKET_IN` in from the side
 *   seam and runs straight down to the side seam `pocket` cm below the band —
 *   both as a front view sees them. Its edge is the front panel's, folded and
 *   topstitched; it lies over the facing behind it and lifts a little off it in
 *   the middle, which is where its shadow is deepest.
 * - **The belt loops.** A centimetre wide, crossing the band from its top edge
 *   to just below it: two on the front creases — where `trouserFolds` starts
 *   them, the middle of the leg just below the band — and one just inside
 *   each side seam, leaning with it.
 *
 * The left leg is drafted and mirrored for the right; the fly is on one side.
 */
function trouserDetails(
  d: Draft,
  spec: LegsSpec,
  { outer, leg, waistY, bandY }: { outer: Pt[]; leg: Pt[]; waistY: number; bandY: number }
): TrouserDetails {
  const sideAt = (y: number) => xOn(outer, y);

  /* the fly: the wearer's left is the canvas's right */
  let fly: TrouserDetails["fly"] = null;
  if (spec.fly) {
    const s = spec.fly.on === "left" ? 1 : -1;
    const w = spec.fly.width * CM;
    const foot = Math.min(bandY + spec.fly.length * CM, d.crotchY - FLY_CLEAR);
    const x = CENTER + s * w;
    const turn = foot - FLY_TURN * w;
    const reach = 0.45 * w;
    const j: Pt[] = [
      ...span([x, bandY + 1], [x, turn], 6),
      ...bezier(
        [x, turn],
        [x, turn + 0.5 * (foot - turn)],
        [CENTER + s * reach * Math.cos(FLY_MEET), foot - reach * Math.sin(FLY_MEET)],
        [CENTER, foot],
        10
      ).slice(1),
    ];
    const edge = span([CENTER, bandY], [CENTER, foot], 8);
    fly = {
      stitch: line(j),
      edge: line(edge),
      /* full a little below the band, gone by the J's foot, where the fly is sewn shut */
      lap: lens(edge, [-s, 0], (t) => FLY_LIFT * Math.min(1, t / 0.12) * Math.min(1, (1 - t) / 0.35)),
    };
  }

  /* the pockets */
  const pockets: TrouserDetails["pockets"] = [];
  if (spec.pocket) {
    const depth = spec.pocket * CM;
    const top: Pt = [sideAt(bandY) + POCKET_IN, bandY];
    const foot: Pt = [sideAt(bandY + depth), bandY + depth];
    const len = Math.hypot(foot[0] - top[0], foot[1] - top[1]);
    const dir: Pt = [(foot[0] - top[0]) / len, (foot[1] - top[1]) / len];
    /* toward the front panel, in and down; the facing is the other way */
    const front: Pt = [dir[1], -dir[0]];
    const edge = span(top, foot, 8);
    /* the topstitch: parallel, on the front panel, from the band down to where it meets the side seam */
    const xStitch = (y: number) => top[0] + ((foot[0] - top[0]) * (y - bandY)) / depth + POCKET_STITCH / dir[1];
    let low = foot[1];
    while (low < foot[1] + depth && xStitch(low) > sideAt(low)) low += 0.25;
    const stitch = span([xStitch(bandY + 0.5), bandY + 0.5], [xStitch(low), low], 6);
    const facing: Pt[] = [top, [top[0] - 40, bandY], [foot[0] - 40, foot[1]], foot];
    pockets.push(
      {
        edge: line(edge),
        stitch: line(stitch),
        facing: straight(facing, true),
        lift: lens(edge, [-front[0], -front[1]], pocketLift),
      },
      {
        edge: line(mirror(edge)),
        stitch: line(mirror(stitch)),
        facing: straight(mirror(facing), true),
        lift: lens(mirror(edge), [front[0], -front[1]], pocketLift),
      }
    );
  }

  /* the belt loops, each by the line down its middle */
  const loopFoot = bandY + LOOP_FOOT;
  const crease =
    [8, 20, 32].reduce((sum, dy) => {
      const [a, b] = across(leg, bandY + dy);
      return sum + (a + b) / 2;
    }, 0) / 3;
  const middles: [Pt, Pt][] = [
    [[crease, waistY], [crease, loopFoot]],
    [
      [sideAt(waistY) + LOOP_SIDE_IN + LOOP_WIDTH / 2, waistY],
      [sideAt(loopFoot) + LOOP_SIDE_IN + LOOP_WIDTH / 2, loopFoot],
    ],
  ];
  const half = LOOP_WIDTH / 2;
  const corners: Pt[][] = [];
  const tacks: Pt[][] = [];
  for (const [a, b] of middles) {
    corners.push([[a[0] - half, a[1]], [b[0] - half, b[1]], [b[0] + half, b[1]], [a[0] + half, a[1]]]);
    for (const y of [a[1] + LOOP_TACK, b[1] - LOOP_TACK]) {
      const x = a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]);
      tacks.push([[x - half + 0.9, y], [x + half - 0.9, y]]);
    }
  }
  const pieces = [...corners, ...corners.map(mirror)];
  return {
    fly,
    pockets,
    loops: {
      pieces: pieces.map((c) => straight(c, true)),
      /* down one side, across the foot, up the other: the top is the band's own edge */
      edges: pieces.map((c) => straight(c, false)),
      tacks: [...tacks, ...tacks.map(mirror)].map((t) => straight(t, false)).join(" "),
    },
  };
}

/** How much narrower than the knee a trouser's hem may be: it falls nearly straight. */
const HEM_TAPER = 0.93;
/** How far below the crotch the hanging leg takes over from the hip's own line. */
const THIGH_BLEND = 40;
/**
 * How close to the other leg an inseam may come and still be apart: nearer,
 * and the two legs touch. A gap of a unit or two between them is no daylight
 * anyone sees — it drew as a hairline of the page down between her legs.
 */
const LEGS_TOUCH = 1.5;
/**
 * How much of the body's own daylight between the legs a trouser keeps, from
 * the knee to the hem. Hung straight from her knees, which are close, over
 * feet that are together, her legs met from the calf down; in a busy print the
 * soft line where they met disappeared, and the pair read as a long skirt.
 */
const LEG_DAYLIGHT = 0.45;
/** The rows above a trouser's hem its daylight is judged over: the ankle, not the foot alone. */
const HEM_ROWS = 30;

/**
 * A trouser leg below the crotch, left leg, as it hangs.
 *
 * It used to follow the leg: the outer edge pulled taut but capped three units
 * off it, the inner edge on it exactly — so it came in at the knee, swelled
 * over the calf and pinched at the ankle, 61, 65 and 48 units across on him,
 * which is a pair of leggings. Cloth hangs from the thigh. So:
 *
 * - **A line through the leg.** The leg's middle, from the top of the thigh to
 *   the ankle, fitted with one straight line: the leg leans out, and the
 *   trouser hangs along it.
 * - **A width that never grows going down** — the sleeves' rule. Each row is
 *   cut as wide as the widest the leg needs anywhere below it, so a calf wider
 *   than the knee widens the knee instead of bulging out of it.
 * - **Nearly straight from the knee.** The hem is at least `HEM_TAPER` of the
 *   knee, whatever the ankle is.
 *
 * Both edges are that width about the line, so each runs straight or gently
 * tapered over the knee and the calf rather than following them; the inseam
 * meets the other leg's at the centre at the top. Just under the crotch the
 * outer edge blends from the hip's own line into the hanging one.
 */
function hungLeg(
  d: Draft,
  s: { from: number; to: number; legEase: number; cuffEase: number; innerEase: number }
): { out: Pt[]; inner: Pt[] } {
  const ys: number[] = [];
  for (let y = s.from; y < s.to; y += 6) ys.push(y);
  ys.push(s.to);
  const t = (y: number) => (y - s.from) / (s.to - s.from || 1);
  const outNeed = (y: number) => d.legOutAt(y, s.legEase + (s.cuffEase - s.legEase) * t(y));
  const inNeed = (y: number) => d.legInAt(y, s.innerEase);

  /* the line through the leg: its middle, fitted below the thigh's top */
  let n = 0, sy = 0, sx = 0, syy = 0, sxy = 0;
  for (const y of ys) {
    if (y < s.from + THIGH_BLEND) continue;
    const x = (outNeed(y) + inNeed(y)) / 2;
    n++; sy += y; sx += x; syy += y * y; sxy += x * y;
  }
  const den = n * syy - sy * sy;
  const slope = den > 0 ? (n * sxy - sx * sy) / den : 0;
  const base = n > 0 ? (sx - slope * sy) / n : (outNeed(s.from) + inNeed(s.from)) / 2;
  const axis = (y: number) => base + slope * y;

  /* the width each row needs, made never to grow, then nearly straight from the knee */
  const need = ys.map((y) => 2 * Math.max(axis(y) - outNeed(y), inNeed(y) - axis(y)));
  const held = need.map((_, i) => Math.max(...need.slice(i)));
  const knee = (s.from + s.to) / 2;
  const kneeAt = ys.findIndex((y) => y >= knee);
  const kneeW = held[Math.max(0, kneeAt)];
  const width = held.map((w, i) => {
    const y = ys[i];
    if (y < knee) return w;
    const floor = kneeW * (1 - (1 - HEM_TAPER) * ((y - knee) / (s.to - knee || 1)));
    return Math.max(w, floor);
  });
  /* smoothed, which keeps a width that never grows from growing */
  const smooth = width.map((_, i) => {
    const near = width.slice(Math.max(0, i - 2), i + 3);
    return near.reduce((a, b) => a + b, 0) / near.length;
  });
  const steady = smooth.map((_, i) => Math.max(...smooth.slice(i)));

  const blend = (y: number) => {
    const u = Math.max(0, Math.min(1, (y - s.from) / THIGH_BLEND));
    return u * u * (3 - 2 * u);
  };
  /*
    Daylight. Where a leg hung on that line would close on the other toward
    the hem, it leans out a little instead — by an amount growing evenly from
    the bottom of the knee to the hem, so the leg keeps its width and both
    edges stay straight: on her it hangs plumb from the knee, as cloth does,
    rather than following her shins in toward feet that are together. As much
    as the rows at the hem ask for, and no more, so a pair of legs that already
    stand apart is not moved. From the bottom of the knee — the row below the
    knee where the inside of the leg comes furthest in — because started any
    higher, the knee itself pushed out through the inseam.
  */
  const kneeLow = ys
    .filter((y) => y >= knee && y <= (knee + s.to) / 2)
    .reduce((a, y) => (inNeed(y) > inNeed(a) ? y : a), knee);
  const along = (y: number) => Math.max(0, (y - kneeLow) / (s.to - kneeLow || 1));
  const clearOf = (y: number) => Math.max(inNeed(y), CENTER - LEG_DAYLIGHT * (CENTER - d.legInAt(y, 0)));
  const lean = Math.max(
    0,
    ...ys.map((y, i) => (y >= s.to - HEM_ROWS ? (axis(y) + steady[i] / 2 - clearOf(y)) / (along(y) || 1) : 0))
  );
  const hangs = (y: number) => axis(y) - lean * along(y);
  const out: Pt[] = ys.map((y, i) => {
    const hungX = hangs(y) - steady[i] / 2;
    const ownX = outNeed(y);
    /* never inside the leg: of the two lines, whichever is further out, eased together at the top */
    const x = Math.min(ownX, hungX);
    return [ownX + (x - ownX) * blend(y), y] as Pt;
  });
  const inner: Pt[] = ys.map((y, i) => {
    const x = Math.min(CENTER, Math.max(inNeed(y), hangs(y) + steady[i] / 2));
    return [x > CENTER - LEGS_TOUCH ? CENTER : x, y] as Pt;
  });
  return { out, inner };
}

/**
 * A column of cloth hanging from the waist — a skirt, or the body of a robe.
 *
 * It has no leg split by definition, so what it needs from the body is only the
 * hip it hangs over and how much it flares below that. Above the crotch it
 * follows the trunk; below it, the outside of the legs, which is the only thing
 * still there to hang on.
 */
/**
 * Where a skirt's folds fall across it, 0 at the left side seam to 1 at the
 * right: evenly, nudged by a seed so a row of them is not a printed fan — and
 * the right half the left half mirrored, because the skirt is one shape
 * mirrored and its hem waves where they fall.
 *
 * Here rather than with the folds, because the skirt's hem waves where its
 * folds reach it, and the hem is outline — read by `check:garments` out of
 * the drawing — while the folds are shading. Both ask this for the places.
 */
export function foldPlaces(count: number, seed: number): number[] {
  let a = seed >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const half = Array.from({ length: Math.floor(count / 2) }, (_, i) => (i + 0.5 + (rnd() - 0.5) * 0.45) / count);
  return [...half, ...(count % 2 ? [0.5] : []), ...half.map((t) => 1 - t).reverse()];
}

/** How far a hem drops where a fold reaches it, and how wide the drop is. */
const WAVE_WIDTH = 9;

/**
 * Where a jacket worn over a garment ends: its hem's row, and its left
 * corner's x there — the right is the left reflected. See `tucked`.
 */
export interface Tuck {
  y: number;
  x: number;
}

/** How far above a jacket's hem a garment under it starts to draw in to meet it: under the jacket, unseen. */
const TUCK_BLEND = 24;

/**
 * A garment's left side as it is worn under a jacket.
 *
 * The jacket lies on top of it, so where the jacket ends the garment under it
 * cannot be wider: it comes out from under the hem at the jacket's width and
 * flares from there. Drawn at its own width it jumped out sideways right below
 * the hem, a shelf with square corners — a skirt's flare, cut off above by the
 * jacket and shown in full below it.
 *
 * So the side is moved in by however much wider than the jacket's hem it is
 * at that row: drawn in smoothly over `TUCK_BLEND` above the hem, where the
 * jacket hides it, and let out again smoothly below it, all the way to its own
 * hem, which stays exactly where it was. The side leaves the jacket's corner
 * running straight down and flares as it falls — no step, no horizontal edge.
 * A garment that is no wider than the jacket's hem there is left as it is.
 */
export function tucked(side: Pt[], tuck?: Tuck): Pt[] {
  if (!tuck || side.length < 2) return side;
  const end = side[side.length - 1];
  if (end[1] <= tuck.y + 4) return side;
  const xAt = (y: number): number => {
    if (y <= side[0][1]) return side[0][0];
    for (let i = 1; i < side.length; i++) {
      if (side[i][1] < y) continue;
      const [x0, y0] = side[i - 1];
      const [x1, y1] = side[i];
      return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0 || 1);
    }
    return end[0];
  };
  const over = tuck.x - xAt(tuck.y);
  if (over <= 0.05) return side;
  const from = tuck.y - TUCK_BLEND;
  const smooth = (t: number) => {
    const u = Math.max(0, Math.min(1, t));
    return u * u * (3 - 2 * u);
  };
  const rows: number[] = [];
  for (let y = from; y < end[1]; y += 4) rows.push(y);
  rows.push(end[1]);
  return [
    ...side.filter(([, y]) => y < from),
    ...rows.map((y) => {
      const s = y <= tuck.y ? smooth((y - from) / TUCK_BLEND) : 1 - smooth((y - tuck.y) / (end[1] - tuck.y));
      return [xAt(y) + over * s, y] as Pt;
    }),
  ];
}

export function column(
  body: BodyType,
  spec: {
    /** How far below the body's own waist the top edge sits; negative is above. */
    rise: number;
    toY: number;
    ease: number;
    flare?: number;
    /**
     * The row by which it has flared `flare` out: its hem, unless given. A
     * shape cut at several lengths gives one row for all of them, so a short
     * one is the long one cut shorter rather than a steeper skirt.
     */
    flareTo?: number;
    /**
     * Where the flare starts, if below the hip — a mermaid's, above the knee:
     * close to her down to there, following her thighs in.
     */
    flareFrom?: number;
    /**
     * How the flare opens: in a straight line, as a flared skirt does, or as a
     * bell — slowly from where it starts, then fast — the further above 1.
     */
    curve?: number;
    /**
     * A pencil's taper: how far in its side leans below the hip, per unit
     * down. It hangs from the hip on that line rather than flaring, and never
     * comes closer to her than its ease.
     */
    taper?: number;
    /**
     * An A-line's: straight from where it leaves her, out by `slope` per unit
     * down. It leaves her at `from` — how far below her own waist, a dress's
     * seam — or lower, where she widens faster than the line would below it:
     * her high hip. Above there it is close to her.
     */
    straight?: { slope: number; from: number };
    dip?: number;
    /** A waistband this deep, cut from the column's own edge. */
    band?: number;
    /**
     * A hem that waves where the folds reach it: the folds' places across the
     * skirt — see `foldPlaces` — and how far it drops at each. Only ever down,
     * so a wave never uncovers what the hem covered.
     */
    wave?: { at: number[]; depth: number };
    /** The hem of a jacket worn over it — see `tucked`. */
    inside?: Tuck;
    /**
     * Where it hangs from, if above her waist: how far below it, so negative
     * — an empire's seam, under the bust. From there it does not follow her
     * in at the waist but falls straight down past her ribs and her waist,
     * close to her, until her hip takes it out. Omitted, it is close from its
     * top edge to the hip.
     */
    hang?: number;
  }
): {
  path: string;
  hemLeft: Pt;
  waistLeft: Pt;
  waistY: number;
  band: string;
  bandStitch: string;
  /** Where a straight shape leaves her — see `straight` — for its folds to be released at. */
  leaves?: number;
} {
  const d = draft(body);
  const { toY, ease, flare = 0, dip = 14 } = spec;
  const fromY = d.waistY + spec.rise;

  /*
    Close from the waist to the hip, and free only below it.

    The flare used to ramp in from the waist — a third of it spent by the
    crotch — so the skirt stood 26 units off her hip, and a skirt sewn to a
    fitted bodice stepped out ten units at the seam. An A-line does neither: it
    is cut to the waist, rests on the widest part of the hip, and flares from
    there. So the ease holds at the waist's value down to `hipY` and the flare
    is shared out over what hangs below it, in proportion to the drop.
  */
  const hipY = Math.max(fromY, Math.min(d.hipY, toY));
  /* a bell: flaring from lower down, or not in a straight line — see `flareFrom` and `curve` */
  const bell = spec.flareFrom !== undefined || spec.curve !== undefined;
  const opens = Math.max(hipY, spec.flareFrom ?? hipY);
  const easeAt = (y: number) =>
    !bell
      ? y <= hipY ? ease : ease + (flare * (y - hipY)) / Math.max(1, (spec.flareTo ?? toY) - hipY)
      : y <= opens ? ease : ease + flare * ((y - opens) / Math.max(1, (spec.flareTo ?? toY) - opens)) ** (spec.curve ?? 1);

  /*
    Hung from above the waist, it is close from its top edge to the seam it
    hangs from — under the bodice there — and from the seam it falls straight
    down at the same ease, past her ribs and her waist, until her hip takes it
    out: soft cloth gathered in under the bust, close to her, so it leaves the
    seam exactly where the bodice ends and meets the hip where it rests. It
    used to fall on the taut line from the seam to the hip, which stood 18
    units off her waist: a cone from her chest.
  */
  const hangY = spec.hang === undefined ? hipY : Math.min(hipY, Math.max(fromY, d.waistY + spec.hang));
  const fall = hangY < hipY ? d.side({ from: hangY, to: hipY, ease }) : [];
  const hung = fall.map(([x, y]) => [Math.min(fall[0][0], x), y] as Pt).slice(1);

  const trunkTo = Math.min(d.crotchY, toY);
  const upper =
    fromY >= trunkTo
      ? []
      : [
          ...d.side({ from: fromY, to: hangY, ease }),
          ...hung,
          ...(hipY < trunkTo
            ? d.side({ from: hipY, to: trunkTo, ease, toEase: easeAt(trunkTo) }).slice(1)
            : []),
        ];
  const lowerFrom = Math.max(fromY, d.crotchY);
  /* a bell's ease is not a straight run between its ends, so it is taken row by row */
  const lower =
    toY <= lowerFrom
      ? []
      : bell
        ? d.legOutHang({ from: lowerFrom, to: toY, ease: 0 }).map(([x, y]) => [x - easeAt(y), y] as Pt)
        : d.legOutHang({ from: lowerFrom, to: toY, ease: easeAt(lowerFrom), toEase: easeAt(toY) });
  /*
    A pencil's side below the hip: the line it hangs on from there, leaning
    in, or her own edge at its ease wherever she is wider than that line —
    at the top of her thighs, before the line takes over.
  */
  const { taper } = spec;
  const hipX = d.sideAt(hipY, ease);
  const shaped =
    taper === undefined
      ? [...upper, ...lower]
      : [...upper, ...lower].map(([x, y]) => (y <= hipY ? [x, y] : [Math.min(x, hipX + taper * (y - hipY)), y]) as Pt);
  /*
    An A-line's side: close to her down to where it leaves her, then
    straight. Where it leaves her is the point the line of its slope touches
    from outside, below its start — the one where her side, plus its ease,
    is furthest out for its height — so the line clears every row below.
  */
  const { straight } = spec;
  let leaves: number | undefined;
  let lined = shaped;
  if (straight) {
    const start = d.waistY + straight.from;
    let k = -1;
    shaped.forEach(([x, y], i) => {
      if (y >= start - 0.01 && (k < 0 || x + straight.slope * y < shaped[k][0] + straight.slope * shaped[k][1])) k = i;
    });
    if (k >= 0) {
      const [kx, ky] = shaped[k];
      leaves = ky;
      lined = shaped.map(([x, y], i) => (i <= k ? [x, y] : [kx - straight.slope * (y - ky), y]) as Pt);
    }
  }
  const side = tucked(lined, spec.inside);
  const hemLeft = side[side.length - 1];
  const waistLeft = side[0];
  const hemRight = mirror([hemLeft])[0];
  const wave = spec.wave;
  const hemPts = wave
    ? hem(hemLeft, hemRight, dip, 48).map(([x, y]) => {
        const drop = wave.at.reduce((sum, t) => {
          const at = hemLeft[0] + (hemRight[0] - hemLeft[0]) * t;
          return sum + wave.depth * Math.exp(-(((x - at) / WAVE_WIDTH) ** 2));
        }, 0);
        return [x, y + Math.min(wave.depth, drop)] as Pt;
      })
    : hem(hemLeft, hemRight, dip);
  const path = outline(
    side,
    hemPts,
    mirror(reverse(side)),
    reverse(span(waistLeft, mirror([waistLeft])[0], 6))
  );
  const { band, bandStitch } = spec.band
    ? waistband(side, fromY + spec.band)
    : { band: "", bandStitch: "" };
  return { path, hemLeft, waistLeft, waistY: fromY, band, bandStitch, ...(leaves !== undefined ? { leaves } : {}) };
}

/* --------------------------------------------------------- the neck opening */

/**
 * A neckline: the **front arc** of an opening, cut where the neck actually is.
 *
 * Three things this fixes, all of them visible on the figure:
 *
 *   • **It is cut about the neck's own centre.** His throat sits 2.9 units
 *     right of the canvas centre — the photograph is very slightly turned — and
 *     every opening in the wardrobe was cut symmetrically about 300, so cloth
 *     crowded one side of his neck and gaped on the other. That is the "neck
 *     hole is off to the left" you can see on him and not on her.
 *
 *   • **It is one curve, mirrored.** The old plain necklines ran from a right
 *     collar point at x 328 to a left one at 278 — six units adrift, because
 *     the two ends were typed independently, and the path then closed itself
 *     with a straight diagonal across the gap. The high necklines, which
 *     happened to be written as a mirrored pair, were fine. This makes that
 *     structural rather than lucky.
 *
 *   • **It is only the front.** The figure is a front view and the neck behind
 *     the opening is opaque, so the only part of a neckline that can be seen is
 *     the arc passing round the front of the throat — dipping at centre front,
 *     rising to the two collar points. Nothing above that line is the garment's
 *     business; it is neck.
 *
 * A half-ellipse: width from the measured throat plus ease, depth from `dip`,
 * which is the one number that separates a crew from a scoop from a V.
 */
export interface Neckline {
  /** The collar points, where the opening meets the shoulder seams. */
  left: Pt;
  right: Pt;
  /** Right collar point round to the left — a fragment that closes a body. */
  front: string;
  /** The same arc as points, for a topstitch or a shadow to follow. */
  points: Pt[];
  /** The centre of the opening, and how far it dips below the seam. */
  center: number;
  seamY: number;
  dip: number;
  half: number;
}

export function neckline(
  body: BodyType,
  spec: {
    seamY: number;
    dip: number;
    ease?: number;
    steps?: number;
    /**
     * The row the throat is *measured* at, if not the row the seam sits on.
     *
     * These are different questions. The seam sits at the base of the neck,
     * where the trapezius has already begun to flare — her silhouette is 62
     * units across at y 178 against a 48-unit neck column — so sizing the
     * opening there gives a boat neck. A crew neck is cut to the **column** and
     * then sewn on at the base, which is what these two rows say.
     */
    at?: number;
  }
): Neckline {
  const d = draft(body);
  const { seamY, dip, ease = 0, steps = 16 } = spec;
  const { center, width } = d.neck(spec.at ?? seamY);
  const half = width / 2 + ease;

  // From the right collar point round to the left, dipping at centre front.
  const points: Pt[] = Array.from({ length: steps + 1 }, (_, i) => {
    const t = (i / steps) * Math.PI;
    return [center + half * Math.cos(t), seamY + dip * Math.sin(t)] as Pt;
  });

  return {
    left: points[points.length - 1],
    right: points[0],
    front: run(points),
    points,
    center,
    seamY,
    dip,
    half,
  };
}

/**
 * The same arc, offset onto the cloth — where a neckline is really topstitched.
 *
 * Run along the cut itself the dashes land on the boundary and read as a torn
 * edge; run on a curve of its own, as these were, it wanders in and out of the
 * opening. The old crew stitch was eight units outside the cut on one side and
 * two inside on the other, which is why it crossed the hole. Topstitch sits a
 * few units onto the cloth, parallel to the edge, all the way round.
 *
 * Offset along the ellipse's own outward normal, which is the side the cloth is
 * on — everything above the arc is the opening.
 */
/**
 * The shadow a neckline throws onto the chest — a band following the cut.
 *
 * It used to be a shape of its own, drawn on a different curve from the
 * opening: a crescent reaching 40 units below a neckline that only reached 34,
 * so it read as a much deeper scoop than the cloth was actually cut to. Built
 * from the cut itself it cannot disagree with it.
 */
/**
 * A flat collar: the cloth lying on a garment **outside** its neckline.
 *
 * The two halves of one, as point lists — left and right, meeting at centre
 * front — cut from the opening they are sewn to rather than drawn beside it.
 * That is the whole of the fix this exists for. Drawn by hand, the Peter Pan's
 * inner edge dipped only to y 196 while its ends rose to 179, so instead of
 * lying outside a 34-unit opening it *covered the top of it* and left a small
 * round hole of its own — and a neck coming up through a hole in a collar is
 * the "complete circle around the mannequin's neck" it was reported as. Built
 * from `neck.points`, the inner edge simply **is** the seam, and cannot.
 *
 * The outer edge is the same arc pushed out along its own normal, widest at
 * centre front and tapering to `point` at the two collar points. Tapering is
 * not decoration: this is a front view, and the end of a flat collar is where
 * the cloth turns to go behind the shoulder. Carried round at full width it
 * would stand out sideways at neck height on both sides — which is the other
 * half of what reads as a ring.
 */
export function flatCollar(
  neck: Neckline,
  spec: { width: number[] }
): { left: Pt[]; right: Pt[] } {
  const { width } = spec;
  const { center, seamY, dip, half, points } = neck;
  const last = points.length - 1;

  /**
   * How wide the cloth is at one point along the arc, `u` running 0 at centre
   * front to 1 at the collar point.
   *
   * A list rather than a taper, because the widest part of a flat collar is
   * neither of its ends: it is the lobe over the collarbone, about three
   * quarters of the way out. Tapered from centre front the collar comes out a
   * bib; held at full width it stands out sideways at neck height, which in a
   * front view is the part that is behind the shoulder and not visible at all.
   */
  const widthAt = (u: number) => {
    const span = (width.length - 1) * Math.min(Math.max(u, 0), 1);
    const i = Math.min(Math.floor(span), width.length - 2);
    return width[i] + (width[i + 1] - width[i]) * (span - i);
  };

  const outer = points.map(([x, y], i) => {
    const t = (i / last) * Math.PI;
    const w = widthAt(Math.abs(t - Math.PI / 2) / (Math.PI / 2));
    // the outward normal of the ellipse the opening is cut on
    const nx = (x - center) / (half * half);
    const ny = dip === 0 ? 1 : (y - seamY) / (dip * dip);
    const len = Math.hypot(nx, ny) || 1;
    return [x + (nx / len) * w, y + (ny / len) * w] as Pt;
  });

  /* `points` runs right collar point → centre front → left, so the middle
     index is centre front and each half is one side of it. They butt together
     there rather than overlapping: two subpaths that cross cancel where they
     do, and a mirrored one winds the other way. */
  const mid = Math.floor(last / 2);
  return {
    right: [...points.slice(0, mid + 1), ...reverse(outer.slice(0, mid + 1))],
    left: [...points.slice(mid), ...reverse(outer.slice(mid))],
  };
}

/**
 * A knit neckband's depth: 9 units, about 1.7 cm — a rib band, not a collar.
 * It was 14, and with its shading it read as a dark stripe round the neck.
 */
export const NECKBAND = 9;

export function necklineShadow(neck: Neckline, depth = NECKBAND): string {
  return outline(neck.points, reverse(offsetArc(neck, depth)));
}

/** The neckline's arc, pushed `offset` units onto the cloth. */
function offsetArc(neck: Neckline, offset: number): Pt[] {
  const { center, seamY, dip, half, points } = neck;
  return points.map(([x, y]) => {
    const nx = (x - center) / (half * half);
    const ny = dip === 0 ? 1 : (y - seamY) / (dip * dip);
    const len = Math.hypot(nx, ny) || 1;
    return [x + (nx / len) * offset, y + (ny / len) * offset] as Pt;
  });
}

/** The band's topstitch: on the body, just below the seam the band is sewn to. */
export function necklineStitch(neck: Neckline, offset = NECKBAND + 3): string {
  return line(offsetArc(neck, offset));
}

/* ------------------------------------------------------------- the stand */

/** How far a band's lower edge runs past the seam it is sewn to: its allowance. */
const STAND_ALLOWANCE = 3;
/**
 * How much of the seam's dip a band's top edge follows.
 *
 * Not all of it. The seam drops at centre front because a neckline does — it
 * runs down to the hollow of the throat — but a stand is drafted to stand up
 * round the neck, and its fold runs nearly level. Lifted parallel to the seam,
 * the top edge curved down as far as the seam did and the band came out a
 * crescent: a cup, which is the ring this is replacing, from the other side.
 */
const STAND_TOP_DIP = 0.35;
/** How far apart a band's sides are sampled up the throat. */
const STAND_STEP = 4;

export interface StandSpec {
  /** How far the band rises above the seam, at the collar points. */
  rise: number;
  /** The seam row at the collar points, and the row the neck column is read at. */
  seamY: number;
  at: number;
  /** Ease past the throat — the opening's own, so the band covers its seam. */
  ease: number;
  /** How far the opening it is sewn to dips at centre front. */
  dip: number;
  /** Extra clearance past the throat, for the half that passes behind the neck. */
  off?: number;
  /** A top edge that does not dip — for the half behind the neck. */
  flatTop?: boolean;
  /**
   * A gap cut into the top edge at centre front: what makes a mandarin.
   * Rounded at the bottom and stopping short of the seam; or, `v`, a V whose
   * point is on the band's lower edge, the two ends' top corners softly
   * rounded — the gap a thobe's mandarin leaves above its placket.
   */
  notch?: { half: number; depth: number; v?: boolean };
}

/**
 * A standing band, seen from the front: the half of it in front of the neck.
 *
 * It is a strip **sewn along the opening**: its lower edge is that seam, its
 * ends run up the sides of the throat, and its fold dips a little at centre
 * front — less than the seam does, because a stand stands.
 *
 * It used to be drawn as a ring seen from above. The top edge *lifted* at
 * centre front while the lower edge was a cubic sagging eighteen units below
 * the seam, and a shape narrow at the top and cupped at the bottom, with the
 * neck coming out of it, is the outline of a hoop lying round a neck: an
 * object placed on the figure rather than cloth sewn to the garment. Head-on,
 * a band's lower edge is the neckline it is sewn to plus a seam allowance and
 * nothing more.
 */
export function stand(body: BodyType, spec: StandSpec): string {
  const { leftSide, top, rightSide, foot } = standEdges(body, spec);
  return outline(leftSide, top, reverse(rightSide), foot);
}

/**
 * The same band as `stand`, as its four edges rather than one outline: each
 * side from the seam up to the fold, the fold from left to right, and the foot
 * along the seam from right to left.
 *
 * A collar that folds over its band needs the fold itself — a shirt collar's
 * leaves are sewn to the top of the band and hang from exactly that line.
 */
export function standEdges(
  body: BodyType,
  spec: StandSpec
): { leftSide: Pt[]; top: Pt[]; rightSide: Pt[]; foot: Pt[] } {
  const d = draft(body);
  const { rise, seamY, at: column, ease, dip, off = 0 } = spec;
  const seam = neckline(body, { seamY, at: column, ease, dip });
  const throat = (y: number) => d.neck(Math.min(y, column));
  const topY = seamY - rise;

  const rows: number[] = [];
  for (let y = seamY - STAND_STEP; y > topY; y -= STAND_STEP) rows.push(y);
  const leftSide: Pt[] = [
    [seam.left[0] - off, seamY],
    ...rows.map((y) => [throat(y).left - ease - off, y] as Pt),
    [throat(topY).left - ease - off, topY],
  ];
  const rightSide: Pt[] = [
    [seam.right[0] + off, seamY],
    ...rows.map((y) => [throat(y).right + ease + off, y] as Pt),
    [throat(topY).right + ease + off, topY],
  ];

  /* The top edge: the fold, dipping gently at centre front. */
  const tl = leftSide[leftSide.length - 1];
  const tr = rightSide[rightSide.length - 1];
  const cx = (tl[0] + tr[0]) / 2;
  const hw = (tr[0] - tl[0]) / 2;
  const topDip = spec.flatTop ? 0 : dip * STAND_TOP_DIP;
  const topAt = (x: number) =>
    topY + topDip * Math.sqrt(Math.max(0, 1 - ((x - cx) / hw) ** 2));
  const arc: Pt[] = Array.from({ length: 17 }, (_, i) => {
    const t = Math.PI - (i / 16) * Math.PI;
    return [cx + hw * Math.cos(t), topY + topDip * Math.sin(t)] as Pt;
  });

  let top: Pt[] = arc;
  if (spec.notch?.v) {
    /*
      A V: each end's top corner rounded off, then straight down to a point on
      the lower edge at centre front, where the band is sewn over the
      placket's middle.
    */
    const { half } = spec.notch;
    const round = 3;
    const point: Pt = [cx, seamY + dip + STAND_ALLOWANCE];
    const side = (sign: -1 | 1): Pt[] => {
      const x = cx + sign * half;
      const corner = topAt(x);
      return [
        [x + sign * round, topAt(x + sign * round)],
        [x + sign * 0.35 * round, corner + 0.35 * round],
        [x, corner + round],
        ...span([x, corner + round], point, 4).slice(1, -1),
      ];
    };
    top = [
      ...arc.filter(([x]) => x < cx - half - 3),
      ...side(-1),
      point,
      ...reverse(side(1)),
      ...arc.filter(([x]) => x > cx + half + 3),
    ];
  } else if (spec.notch) {
    /*
      The two ends of a mandarin meet with a gap between them, rounded at the
      lips. It stops above the seam, so the neckline stays covered.
    */
    const { half } = spec.notch;
    const lip = 4;
    const floor = Math.min(topAt(cx) + spec.notch.depth, seamY + dip - 2);
    const u = (a: number) => [cx + half * Math.cos(a), floor - half + half * Math.sin(a)] as Pt;
    top = [
      ...arc.filter(([x]) => x < cx - half - lip),
      [cx - half - lip, topAt(cx - half - lip)],
      [cx - half, topAt(cx - half) + lip],
      ...Array.from({ length: 7 }, (_, i) => u(Math.PI - (i / 6) * Math.PI)),
      [cx + half, topAt(cx + half) + lip],
      [cx + half + lip, topAt(cx + half + lip)],
      ...arc.filter(([x]) => x > cx + half + lip),
    ];
  }

  /* The lower edge: the seam itself, with its allowance, right to left. */
  const last = seam.points.length - 1;
  const scale = (seam.half + off) / seam.half;
  const foot: Pt[] = seam.points.map(([x, y], i) => [
    seam.center + (x - seam.center) * scale,
    y + STAND_ALLOWANCE * Math.sin((i / last) * Math.PI),
  ] as Pt);

  return { leftSide, top, rightSide, foot };
}

/* ------------------------------------------------------- the collar's axis */

/**
 * The line a collar is symmetric about, at each height.
 *
 * The neck's own centre at the neckline and above, because that is what a
 * collar goes round; the trunk's centre from the natural waist down, because
 * that is where the garment closes; and in between, a straight blend.
 *
 * The two are not the same line. The photographs are registered on the trunk,
 * and her neck sits three units left of it — so a collar reflected about the
 * canvas centre is three units wide of her neck on one side and three short on
 * the other. Blended linearly, it also keeps a straight edge straight when it
 * is reflected, which is what lets a lapel's roll line on one side be the exact
 * reflection of the other and still run straight to the button.
 */
export function collarAxis(
  body: BodyType,
  spec: { seamY: number; at: number }
): (y: number) => number {
  const d = draft(body);
  const neck = d.neck(spec.at).center;
  const from = spec.seamY;
  const to = d.waistY;
  return (y: number) =>
    y <= from ? neck : y >= to ? CENTER : neck + ((CENTER - neck) * (y - from)) / (to - from);
}

/* --------------------------------------------------------- the open front */

export interface OpenFrontSpec extends TopSpec {
  /** Where the V leaves the neck on the left, and on the right. */
  neck: Pt;
  neckRight: Pt;
  /** The shoulder seam's ease — the yoke's. */
  shoulderEase: number;
  /** The row of the one button the fronts close on: where the lapels break. */
  buttonY: number;
  /** How far each front laps past the centre line at the button. */
  lap: number;
  /** How far from the centre line each front has fallen away at the hem. */
  cutaway: number;
  /** The radius of the rounded corner where a front turns into the hem. */
  corner: number;
}

export interface OpenFront {
  /** The two fronts. The left one laps over the right, so it is drawn second. */
  left: string;
  right: string;
  sleeveLeft: string;
  sleeveRight: string;
  stitch: string;
  /** Each front's break point: where its V meets its front edge at the button. */
  breakLeft: Pt;
  breakRight: Pt;
  /** The V each front is cut to, neck to break — what a lapel is sewn along. */
  seam: string;
}

/**
 * A jacket that is open at the front: two fronts closing on one button.
 *
 * Above the button each front is cut in a straight V from the neck to the
 * break, which is what the lapel folds back along. Below it the two fronts
 * fall away from each other and round off into the hem, so the jacket opens in
 * an inverted V over whatever is worn beneath. Both are one garment cut once:
 * the fronts share their sides, sleeves and shoulders with \`setIn\`, and only
 * the edges at the centre are the jacket's own.
 *
 * The right front is the left one reflected about the trunk, except at the
 * neck, where it starts from the right neck point — which is cut about the
 * *neck*, three units away. The yoke does the same with its shoulder seam.
 */
export function openFront(body: BodyType, spec: OpenFrontSpec): OpenFront {
  const d = draft(body);
  const T = setIn(body, spec);
  const { scye, side } = T.parts;
  const { hemY, buttonY: by, lap, cutaway, corner } = spec;

  const shoulder = d.shoulder(spec.neck, spec.tip, spec.shoulderEase);
  const breakLeft: Pt = [CENTER + lap, by];

  /* The front edge below the button, falling away slowly and then faster. */
  const cornerX = CENTER - cutaway;
  const fall = hemY - corner - by;
  const front: Pt[] = Array.from({ length: 9 }, (_, i) => {
    const t = i / 8;
    return [CENTER + lap - (lap + cutaway) * t ** 1.6, by + fall * t] as Pt;
  });
  /* A quarter round into the hem, from the foot of the front edge. */
  const round: Pt[] = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 5) * (Math.PI / 2);
    return [
      cornerX - corner + corner * Math.cos(a),
      hemY - corner + corner * Math.sin(a),
    ] as Pt;
  });
  const hemLeft = side[side.length - 1];
  const hemRun = span(hemLeft, round[round.length - 1], 4);
  const up = [...reverse(round), ...reverse(front)];
  const vLeft = span(breakLeft, spec.neck, 6);

  const left =
    `M${n(spec.neck[0])} ${n(spec.neck[1])} ${run(shoulder)} ` +
    `${run(scye, side)} ${run(hemRun, up)} ${run(vLeft)} Z`;

  const shoulderR = mirror(shoulder);
  shoulderR[0] = spec.neckRight;
  const breakRight: Pt = [CENTER - lap, by];
  const vRight = span(breakRight, spec.neckRight, 6);
  const right =
    `M${n(spec.neckRight[0])} ${n(spec.neckRight[1])} ${run(shoulderR)} ` +
    `${run(mirror(scye), mirror(side))} ${run(mirror(hemRun), mirror(up))} ` +
    `${run(vRight)} Z`;

  return {
    left,
    right,
    sleeveLeft: T.sleeveLeft,
    sleeveRight: T.sleeveRight,
    stitch: T.stitch,
    breakLeft,
    breakRight,
    seam: `${line(reverse(span(breakRight, spec.neckRight, 12)))} ${line(span(breakLeft, spec.neck, 12))}`,
  };
}

/* ------------------------------------------------------------- the lapel */

export interface LapelSpec {
  /** Where the V leaves the neck, and where it breaks at the button. */
  neck: Pt;
  break: Pt;
  /** How far down the V the collar meets the lapel: the gorge. */
  gorge: number;
  /** How wide the lapel is at the notch. */
  width: number;
  /** How far the notch opens between the collar's point and the lapel's. */
  notch: number;
  /** How far the collar stands up the side of the neck above the neck point. */
  rise: number;
}

/**
 * A notched lapel and the collar above it, both cut along the jacket's V.
 *
 * A lapel is the top of the front folded back: its inner edge **is** the V,
 * from the gorge down to the break, and it narrows to nothing at the button.
 * The collar sits above it, its inner edge running up the rest of the V to the
 * neck and on up the side of the throat, where it turns to go round the back.
 * The notch is the gap between the collar's point and the lapel's, opening
 * outward from the gorge where the two are sewn together.
 *
 * Returned as corners for \`blade\`, left side only. Reflected about the
 * collar's axis they land exactly on the right front's V, because that V is
 * the left one reflected about the same axis.
 */
export function lapel(spec: LapelSpec): { lapel: Pt[]; collar: Pt[] } {
  const [nx, ny] = spec.neck;
  const [bx, by] = spec.break;
  const t = spec.gorge / (by - ny);
  const gorge: Pt = [nx + (bx - nx) * t, ny + spec.gorge];
  const peak: Pt = [gorge[0] - spec.width, gorge[1] + spec.notch * 0.6];
  const point: Pt = [peak[0] + spec.notch, peak[1] - spec.notch * 1.2];
  const top: Pt = [nx, ny - spec.rise];
  return {
    lapel: [gorge, peak, spec.break],
    collar: [top, point, gorge, spec.neck],
  };
}
