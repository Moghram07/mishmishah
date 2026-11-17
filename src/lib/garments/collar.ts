/**
 * The geometry every collar is drawn from.
 *
 * Collars were hand-typed polygons — `M297 188 L271 180 L256 202 L285 233 Z`
 * and twelve more like it — and that is why they read as folded paper rather
 * than as cloth. Cloth has no straight edges, a mirrored pair typed out twice
 * drifts, and a topstitch typed out a third time drifts from both. All three
 * are the same mistake: the numbers were written down instead of being derived.
 *
 * So a collar piece is now **a list of corners and how much each edge between
 * them bows**, and everything else falls out of that one source:
 *
 *   • `blade(corners, bows)`   — the outline, as cubics.
 *   • `mirror(path)`           — the other side, which therefore cannot drift.
 *   • `shrink(corners, units)` — the same corners pulled in, for the topstitch,
 *                                which therefore cannot drift either.
 *
 * Body-agnostic on purpose. Where a collar sits is a fact about a *neck* and
 * lives in `art/<body>/yoke.ts`; what shape it is, is this.
 *
 * `scripts/preview-garments.mjs` imports this module directly rather than
 * evaluating it — it is plain `.ts` with no JSX, so node can strip its types —
 * which is why nothing here has to be written as a single expression the way
 * the helpers in `yoke.ts` do.
 */

/** A point on the 600×1000 canvas every drawing shares. */
export type Point = readonly [x: number, y: number];

/** The figure's centre line. Everything mirrors about it. */
const AXIS = 600;

/** Paths are written to a tenth of a unit — below that is noise. */
const round1 = (n: number) => Math.round(n * 10) / 10;

const xy = (p: Point) => `${round1(p[0])} ${round1(p[1])}`;

/* ---------------------------------------------------------------- the edges */

/**
 * A cubic from `a` to `b`, bowed `bow` units off the straight chord between
 * them.
 *
 * **Positive bows to the left of the direction of travel**, in screen terms —
 * so on a piece written anticlockwise a positive bow is convex and a negative
 * one is hollow, and reversing the direction flips both. That one sentence is
 * the whole sign convention, and it is worth reading twice before editing any
 * collar's numbers.
 *
 * The control points sit at 0.28 and 0.72 along, offset by the full `bow`,
 * which puts the curve's own furthest point at about three quarters of it. Near
 * enough: `bow` is a dial a collar turns until the edge looks like cloth, not a
 * measurement anybody takes off a pattern.
 */
export function arc(a: Point, b: Point, bow: number): string {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * bow;
  const ny = (dx / len) * bow;
  const at = (t: number): Point => [a[0] + dx * t + nx, a[1] + dy * t + ny];
  const pieces = Math.ceil(len / LONG_EDGE);
  if (pieces <= 1) return `C${xy(at(0.28))} ${xy(at(0.72))} ${xy(b)}`;

  /*
    A long edge is written as several cubics on the *same* curve, split with
    de Casteljau. One cubic is flattened into a fixed number of steps however
    long it is, so a lapel's 150-unit edge came out as steps too long to tell
    from a ruled line, and read as one.
  */
  const out: string[] = [];
  let p: Point[] = [a, at(0.28), at(0.72), b];
  for (let k = pieces; k > 1; k--) {
    const t = 1 / k;
    const mix = (u: Point, v: Point): Point => [u[0] + (v[0] - u[0]) * t, u[1] + (v[1] - u[1]) * t];
    const q0 = mix(p[0], p[1]);
    const q1 = mix(p[1], p[2]);
    const q2 = mix(p[2], p[3]);
    const r0 = mix(q0, q1);
    const r1 = mix(q1, q2);
    const s = mix(r0, r1);
    out.push(`C${xy(q0)} ${xy(r0)} ${xy(s)}`);
    p = [s, r1, q2, p[3]];
  }
  out.push(`C${xy(p[1])} ${xy(p[2])} ${xy(p[3])}`);
  return out.join(" ");
}

/** An edge longer than this is written as more than one cubic. */
const LONG_EDGE = 100;

/**
 * A closed piece of cloth: corners, and how much each edge between them bows.
 *
 * Edge `i` runs from `corners[i]` to the next corner round, so `bows` is read
 * in the same order and a missing entry is a straight edge — which should be
 * rare enough to be worth noticing. A collar leaf is three corners; a lapel or
 * a sailor panel is four or five.
 */
/**
 * A placket's long edges: a hair of barrel on each, and square across the
 * ends — see `art/placket.tsx`. Here, in plain TypeScript, so that every
 * drawing's placket path can be evaluated by `check:garments`; it was in the
 * placket's own JSX file, which the checker cannot load, and no placket was
 * ever checked.
 */
export const PLACKET_BOWS = [0, -1, 0, -1];

export function blade(corners: Point[], bows: number[] = []): string {
  const edges = corners.map((from, i) =>
    arc(from, corners[(i + 1) % corners.length], bows[i] ?? 0)
  );
  return `M${xy(corners[0])} ${edges.join(" ")} Z`;
}

/**
 * The same edges, left open — a seam rather than a piece.
 *
 * Walks `corners[0]` to the last one and stops: no closing edge, no `Z`. It is
 * what a topstitch actually is. `blade` traces a closed outline, and stitching
 * a collar with one runs a dashed line right across the **fold** — an edge no
 * collar on earth is stitched along, because there is no seam there to finish.
 * Every piece outlined all the way round reads as an appliqué patch laid on the
 * shirt, which is what thirteen of them did.
 */
export function seam(corners: Point[], bows: number[] = []): string {
  const edges = corners
    .slice(0, -1)
    .map((from, i) => arc(from, corners[i + 1], bows[i] ?? 0));
  return `M${xy(corners[0])} ${edges.join(" ")}`;
}

/**
 * The same edges, each corner rounded off over `round[i]` units — a knit's
 * edge, which has no crisp corner anywhere.
 *
 * Continues from wherever the path already is, which must be `corners[0]`, so
 * it can follow a run of points such as a fold. Each corner is cut back
 * `round[i]` units along both edges that meet there and the two cut ends are
 * joined by a curve that the corner itself pulls on. The two ends are never
 * rounded, and a missing radius leaves the corner sharp.
 */
export function softEdges(corners: Point[], bows: number[] = [], round: number[] = []): string {
  const toward = (from: Point, to: Point, by: number): Point => {
    const len = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
    return [from[0] + ((to[0] - from[0]) * by) / len, from[1] + ((to[1] - from[1]) * by) / len];
  };
  const out: string[] = [];
  let from = corners[0];
  for (let i = 1; i < corners.length; i++) {
    const corner = corners[i];
    const r = i < corners.length - 1 ? round[i] ?? 0 : 0;
    out.push(arc(from, r > 0 ? toward(corner, corners[i - 1], r) : corner, bows[i - 1] ?? 0));
    if (r > 0) {
      from = toward(corner, corners[i + 1], r);
      out.push(`Q${xy(corner)} ${xy(from)}`);
    } else {
      from = corner;
    }
  }
  return out.join(" ");
}

/* ------------------------------------------------------------- the topstitch */

/**
 * The same corners pulled `units` in toward the piece's own centre.
 *
 * A topstitch runs a few millimetres inside the edge it finishes, so its route
 * is not a second drawing — it is the first one, smaller. Typed out separately
 * it drifts: the shirt collar's leaf ran `L271 180 L256 202` while its stitch
 * ran `L272 183 L259 202`, three units adrift on one corner and one on the
 * next, and what you saw was a line drawn near a collar rather than a seam in
 * it.
 *
 * Pulling toward the centroid rather than along each edge's normal is the
 * cheap version, and on a shape as small and as convex as a collar piece the
 * two agree to well under a unit.
 */
export function shrink(corners: Point[], units: number): Point[] {
  const cx = corners.reduce((sum, p) => sum + p[0], 0) / corners.length;
  const cy = corners.reduce((sum, p) => sum + p[1], 0) / corners.length;
  return corners.map(([x, y]) => {
    const dx = cx - x;
    const dy = cy - y;
    const len = Math.hypot(dx, dy) || 1;
    return [
      round1(x + (dx / len) * units),
      round1(y + (dy / len) * units),
    ] as Point;
  });
}

/* --------------------------------------------------------------- the mirror */

/** How many numbers each command takes, and which of them are x coordinates. */
const COMMAND: Record<string, { take: number; xs: number[] }> = {
  M: { take: 2, xs: [0] },
  L: { take: 2, xs: [0] },
  T: { take: 2, xs: [0] },
  H: { take: 1, xs: [0] },
  V: { take: 1, xs: [] },
  Q: { take: 4, xs: [0, 2] },
  S: { take: 4, xs: [0, 2] },
  C: { take: 6, xs: [0, 2, 4] },
  Z: { take: 0, xs: [] },
};

/**
 * The line a piece is reflected about: a fixed x, or an x that changes with
 * height.
 *
 * A fixed 300 was right while the photographs were centred on it. They are
 * registered on the **trunk** now, and her neck sits three units left of her
 * trunk — so a collar cut to her neck and reflected about 300 comes out three
 * units wide on one side and three short on the other, which is the lopsided
 * sailor and the one-sided ruffle. A collar is reflected about the neck where
 * it is at the neck, and about the trunk where it has reached the body: see
 * `collarAxis` in `garments/fit.ts`.
 */
export type Axis = number | ((y: number) => number);

const axisAt = (axis: Axis, y: number): number =>
  typeof axis === "number" ? axis : axis(y);

/**
 * Reflect a path about an axis — the figure's centre line unless told otherwise.
 *
 * The two sides of a collar are the same collar, so writing one and reflecting
 * it is the only way they cannot drift apart — `mannequin/bodies.ts` reached
 * the same conclusion about the two shoulders and says so in the same words.
 *
 * Absolute `M L H V C S Q T Z` only, which is the whole vocabulary the art
 * uses. A reflection reverses the winding, which is exactly why every piece is
 * drawn as its own `<path>`: subpaths of one path cancel where they overlap,
 * and a mirrored one winds the other way.
 */
export function mirror(d: string, axis: Axis = AXIS / 2): string {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+/g) ?? [];
  const out: string[] = [];
  let cmd = "M";
  let i = 0;
  let lastY = 0;
  // A command letter runs into its first number — `C312 206 …`, the way every
  // path in this codebase is written — so it is held back rather than pushed.
  let lead = "";

  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) {
      cmd = tokens[i].toUpperCase();
      lead = tokens[i];
      i += 1;
      if (cmd === "Z") {
        out.push(lead);
        lead = "";
        continue;
      }
    }
    const spec = COMMAND[cmd] ?? COMMAND.L;
    const nums: string[] = [];
    while (nums.length < spec.take && i < tokens.length && !/[A-Za-z]/.test(tokens[i])) {
      nums.push(tokens[i]);
      i += 1;
    }
    nums.forEach((token, k) => {
      let n = token;
      if (spec.xs.includes(k)) {
        // an x is reflected about the axis at its own height
        const y = cmd === "H" ? lastY : Number(nums[k + 1] ?? lastY);
        n = String(round1(2 * axisAt(axis, y) - Number(token)));
      }
      out.push(lead + n);
      lead = "";
    });
    if (cmd === "V") lastY = Number(nums[0] ?? lastY);
    else if (cmd !== "H" && nums.length >= 2) lastY = Number(nums[nums.length - 1]);
    // Coordinate pairs repeated after an `M` are implicit line-tos.
    if (cmd === "M") cmd = "L";
  }
  return out.join(" ");
}

/**
 * A path moved bodily — the same shape, somewhere else.
 *
 * For a shadow a piece casts: the piece itself, dropped a few units. The bands'
 * casts were typed as their own crescents under a lower edge that has since
 * moved, so they fell where the band no longer was. Derived, they cannot.
 */
export function nudge(d: string, dx: number, dy: number): string {
  let i = 0;
  let cmd = "M";
  return d.replace(/[A-Za-z]|-?[0-9]*[.]?[0-9]+/g, (token) => {
    if (/[A-Za-z]/.test(token)) {
      cmd = token.toUpperCase();
      i = 0;
      return token;
    }
    const isY = cmd === "V" ? true : cmd === "H" ? false : i % 2 === 1;
    i += 1;
    return String(round1(Number(token) + (isY ? dy : dx)));
  });
}

/** The same corners, reflected. For when a piece needs its mirror's numbers. */
export const flip = (corners: Point[], axis: Axis = AXIS / 2): Point[] =>
  corners.map(([x, y]) => [round1(2 * axisAt(axis, y) - x), y] as Point);

/* ------------------------------------------------------------- the shadows */

/**
 * The shadow a piece of cloth throws on whatever it lies over.
 *
 * A collar sits a few millimetres proud of the shirt it is sewn to. With
 * nothing at the join the two are coplanar, and coplanar cloth reads as paint —
 * which, blurred edges aside, is the single largest reason these looked like
 * decals. This is the piece's own outline pushed down and out a little, drawn
 * *under* it through `RegionDrawing.cast`, and blurred.
 *
 * `drop` is how far the light is above and behind: two or three units at this
 * scale, which is a centimetre of standing collar.
 */
export const shadowOf = (corners: Point[], bows: number[], drop: number) =>
  blade(
    corners.map(([x, y]) => [x, y + drop] as Point),
    bows
  );

/**
 * The band of shade along the roll, where a fall folds back over its stand.
 *
 * Two collars can share a silhouette to the unit and only one of them look
 * made, and this is usually the difference: you do not see a collar's fold, you
 * see the dark line under it. Given the roll's two ends it returns a thin lens
 * hanging below the line between them — `depth` is how far it hangs, so it is
 * negated against the sign convention rather than asking every caller to.
 */
export const rollShade = (from: Point, to: Point, depth: number) =>
  `M${xy(from)} ${arc(from, to, 0)} ${arc(to, from, -depth)} Z`;

/* --------------------------------------------------------- a shirt collar's V */

/**
 * Where a shirt collar's fold leaves the side of the neck and where it comes
 * into the point where its halves meet, as shares of the way across and down
 * between them: the first handle, from the side; the second, back from the
 * meeting point.
 *
 * A shirt collar wraps the neck. Seen from the front it stands up at each side
 * of the neck, and its fold runs down from there to centre front, where the
 * two halves meet just above the top button: a wide V, the neck showing in it
 * (the user's photos bowtieMen and TiePositions-Shapes). So the fold leaves the
 * side steeply, still going round the neck, and comes into the meeting point
 * at about 37° below level — the two halves meet in a V, not a U. It used to be
 * level straight across the throat, the points hanging off its ends: a strip.
 */
const FOLD_LEAVE = [0.12, 0.5] as const;
const FOLD_ARRIVE = [0.35, 0.3] as const;

/** One half of a shirt collar's fold, as a cubic from the side of the neck, `side`, to where the halves meet, `meet`: its four points. */
export function foldCurve(side: Point, meet: Point): [Point, Point, Point, Point] {
  const [dx, dy] = [meet[0] - side[0], meet[1] - side[1]];
  return [
    side,
    [side[0] + FOLD_LEAVE[0] * dx, side[1] + FOLD_LEAVE[1] * dy],
    [meet[0] - FOLD_ARRIVE[0] * dx, meet[1] - FOLD_ARRIVE[1] * dy],
    meet,
  ];
}

/** That half of the fold as points, side to meeting point — for a band's top edge, a fold's light, measuring. */
export function foldPoints(side: Point, meet: Point, n = 16): [number, number][] {
  const [a, b, c, d] = foldCurve(side, meet);
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const u = 1 - t;
    return [
      round1(u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0]),
      round1(u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]),
    ] as [number, number];
  });
}

/** The whole fold, left to right: the left half from the side down to where the halves meet, and up the other side — the same half, reflected about `axis`. */
export function foldRoll(side: Point, meet: Point, axis: Axis): [number, number][] {
  const half = foldPoints(side, meet);
  const other = half
    .slice(0, -1)
    .reverse()
    .map(([x, y]) => [round1(2 * axisAt(axis, y) - x), y] as [number, number]);
  return [...half, ...other];
}

/** The same half as a path segment, back from the meeting point to the side — for a leaf's outline, which starts where the halves meet. */
export function foldBack(side: Point, meet: Point): string {
  const [a, b, c] = foldCurve(side, meet);
  return `C${xy(c)} ${xy(b)} ${xy(a)}`;
}

/**
 * A shirt collar's back, seen from the front, as the points of its outline:
 * the band behind the neck, its top level behind the neck at the height the
 * collar stands to at its sides, and its two outer corners rounded off — a
 * quarter ellipse from `drop` below the top on its outer side, up and in to
 * where the front's fold starts at that side, `corners` — so that beside the
 * neck the collar turns round it, rather than standing up as a box. It was
 * the plain band behind the neck: straight sides and a flat top, square at
 * both ends — a rectangle behind the collar (the user's note).
 *
 * `edges` are the band's: each side from the seam up, the foot from right to
 * left — see `standEdges`.
 */
export function roundedBack(
  edges: { leftSide: readonly (readonly [number, number])[]; rightSide: readonly (readonly [number, number])[]; foot: readonly (readonly [number, number])[] },
  corners: readonly [Point, Point],
  drop: number,
  n = 8
): [number, number][] {
  const top = corners[0][1];
  const below = top + drop;
  /* a side's outer x at a row, between its samples */
  const xAt = (side: readonly (readonly [number, number])[], y: number): number => {
    for (let i = 1; i < side.length; i++) {
      const [[x0, y0], [x1, y1]] = [side[i - 1], side[i]];
      if ((y0 - y) * (y1 - y) <= 0 && y0 !== y1) return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0);
    }
    return side[side.length - 1][0];
  };
  /* a quarter ellipse from the outer side at `below`, up and in to the corner — vertical where it leaves the side, level where it arrives */
  const quarter = (from: Point, to: Point): [number, number][] =>
    Array.from({ length: n + 1 }, (_, i) => {
      const t = (i / n) * (Math.PI / 2);
      return [round1(from[0] + (to[0] - from[0]) * (1 - Math.cos(t))), round1(from[1] + (to[1] - from[1]) * Math.sin(t))] as [number, number];
    });
  const left = quarter([xAt(edges.leftSide, below), below], corners[0]);
  const right = quarter([xAt(edges.rightSide, below), below], corners[1]).reverse();
  const pts = (side: readonly (readonly [number, number])[]) => side.filter(([, y]) => y > below + 0.5).map(([x, y]) => [x, y] as [number, number]);
  return [...pts(edges.leftSide), ...left, ...right, ...pts(edges.rightSide).reverse(), ...edges.foot.map(([x, y]) => [x, y] as [number, number])];
}
