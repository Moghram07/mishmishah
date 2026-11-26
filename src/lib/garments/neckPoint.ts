/*
  Plain `.ts`, relative and extensioned, and no JSX — so `scripts/
  preview-garments.mjs` imports the necklines the app draws. See `dressCut.ts`.
*/
import { OUTLINE } from "../mannequin/outline.ts";
import { BODY_CANVAS } from "../mannequin/bodies.ts";
import { edgeAt, profileFor } from "../mannequin/profile.ts";
import { run, type Pt } from "./fit.ts";
import type { BodyType } from "@/types";

/**
 * A neckline's corner as drawn, without the point it makes beside the neck:
 * the dress's crew and V (see `trimmedEdge` in `dressCut.ts`) and the abaya's
 * neck (see `robe`). Each shoulder line rises straight into the neck and ends
 * where the opening meets the neck's drawn edge.
 */

/** A body's drawn outline, as points: each of its curves sampled. */
const OUTLINES = new Map<BodyType, Pt[]>();
function drawnOutline(body: BodyType): Pt[] {
  const known = OUTLINES.get(body);
  if (known) return known;
  const tok = OUTLINE[body].match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const pts: Pt[] = [];
  let i = 0;
  let cmd = "";
  let x = 0;
  let y = 0;
  const num = () => Number(tok[i++]);
  while (i < tok.length) {
    if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++];
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    const c = cmd.toLowerCase();
    if (c === "m" || c === "l") {
      x = num() + ox;
      y = num() + oy;
      pts.push([x, y]);
      if (c === "m") cmd = rel ? "l" : "L";
    } else if (c === "c") {
      const s: Seg = [[x, y], [num() + ox, num() + oy], [num() + ox, num() + oy], [num() + ox, num() + oy]];
      for (let k = 1; k <= 12; k++) pts.push(bezierAt(s, k / 12));
      [x, y] = s[3];
    } else if (c !== "z") throw new Error(`${body} outline: no ${cmd}`);
  }
  OUTLINES.set(body, pts);
  return pts;
}

/** A drawn outline's sides, filed under every unit row each one spans: a point's row holds every side that can cross it. */
const ROWS = new Map<BodyType, Map<number, [number, number, number, number][]>>();
function outlineRows(body: BodyType): Map<number, [number, number, number, number][]> {
  const known = ROWS.get(body);
  if (known) return known;
  const poly = drawnOutline(body);
  const rows = new Map<number, [number, number, number, number][]>();
  for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
    const [xa, ya] = poly[a];
    const [xb, yb] = poly[b];
    for (let r = Math.floor(Math.min(ya, yb)); r <= Math.floor(Math.max(ya, yb)); r++) {
      const row = rows.get(r);
      if (row) row.push([xa, ya, xb, yb]);
      else rows.set(r, [[xa, ya, xb, yb]]);
    }
  }
  ROWS.set(body, rows);
  return rows;
}

/** Whether a point is inside a body's drawn outline: its row's sides crossed, counted. */
export function onBody(p: Pt, body: BodyType): boolean {
  let inside = false;
  for (const [xa, ya, xb, yb] of outlineRows(body).get(Math.floor(p[1])) ?? []) {
    if (ya > p[1] !== yb > p[1] && p[0] < ((xb - xa) * (p[1] - ya)) / (yb - ya) + xa) inside = !inside;
  }
  return inside;
}

export type Seg = [Pt, Pt, Pt, Pt];
export const bezierAt = (s: Seg, t: number): Pt => {
  const u = 1 - t;
  return [
    u * u * u * s[0][0] + 3 * u * u * t * s[1][0] + 3 * u * t * t * s[2][0] + t * t * t * s[3][0],
    u * u * u * s[0][1] + 3 * u * u * t * s[1][1] + 3 * u * t * t * s[2][1] + t * t * t * s[3][1],
  ];
};
/** A cubic split at `t`: the part before, and the part after. */
export function splitAt(s: Seg, t: number): [Seg, Seg] {
  const mix = (a: Pt, b: Pt): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const ab = mix(s[0], s[1]);
  const bc = mix(s[1], s[2]);
  const cd = mix(s[2], s[3]);
  const abc = mix(ab, bc);
  const bcd = mix(bc, cd);
  const m = mix(abc, bcd);
  return [
    [s[0], ab, abc, m],
    [m, bcd, cd, s[3]],
  ];
}
/** A run as `run` draws it, read back off its own path: one cubic per `C`, from its first point. */
export function cubicsOf(from: Pt, d: string): { text: string; seg: Seg }[] {
  let at = from;
  return d
    .split("C")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const v = s.split(/\s+/).map(Number);
      const seg: Seg = [at, [v[0], v[1]], [v[2], v[3]], [v[4], v[5]]];
      at = seg[3];
      return { text: `C${s}`, seg };
    });
}
/* as `run` writes a number: to a tenth */
const tenth = (v: number) => {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
};
export const cubicText = (s: Seg) => `C${tenth(s[1][0])} ${tenth(s[1][1])} ${tenth(s[2][0])} ${tenth(s[2][1])} ${tenth(s[3][0])} ${tenth(s[3][1])}`;
/** Where along a cubic it first comes onto the body (from its start), or last leaves her (from its end). */
export function meetsBody(s: Seg, fromEnd: boolean, body: BodyType): number | null {
  const steps = 64;
  for (let k = 1; k <= steps; k++) {
    const t = fromEnd ? 1 - k / steps : k / steps;
    if (!onBody(bezierAt(s, t), body)) continue;
    let off = fromEnd ? t + 1 / steps : t - 1 / steps;
    let on = t;
    for (let j = 0; j < 24; j++) {
      const mid = (off + on) / 2;
      if (onBody(bezierAt(s, mid), body)) on = mid;
      else off = mid;
    }
    return on;
  }
  return null;
}
/**
 * Where a straight line from `n` touches a shoulder line, nearest the neck:
 * walking out from the corner (`fromEnd`: the corner is the run's end), the
 * point the line to which from `n` falls most steeply, before it falls less
 * steeply again. `outward` is which way x runs away from the neck.
 */
export function touches(n: Pt, cubics: { seg: Seg }[], outward: 1 | -1, fromEnd: boolean): { i: number; t: number } | null {
  const fall = (p: Pt) => {
    const across = (p[0] - n[0]) * outward;
    return across > 0.5 ? (p[1] - n[1]) / across : -Infinity;
  };
  const steps = 64;
  let best: { i: number; t: number; f: number } | null = null;
  walk: for (let k = 0; k < cubics.length; k++) {
    const i = fromEnd ? cubics.length - 1 - k : k;
    for (let j = 0; j <= steps; j++) {
      const t = fromEnd ? 1 - j / steps : j / steps;
      const f = fall(bezierAt(cubics[i].seg, t));
      if (!best || f > best.f) best = { i, t, f };
      else if (f < best.f - 0.01) break walk;
    }
  }
  if (!best || best.f === -Infinity) return null;
  /* to a hair: the steepest fall near the sample */
  let lo = Math.max(0, best.t - 1 / steps);
  let hi = Math.min(1, best.t + 1 / steps);
  const seg = cubics[best.i].seg;
  for (let j = 0; j < 40; j++) {
    const a = lo + (hi - lo) / 3;
    const b = hi - (hi - lo) / 3;
    if (fall(bezierAt(seg, a)) < fall(bezierAt(seg, b))) lo = a;
    else hi = b;
  }
  return { i: best.i, t: (lo + hi) / 2 };
}
/** A straight run from one point to another, as a cubic. */
export const straight = (a: Pt, b: Pt): Seg => [a, [a[0] + (b[0] - a[0]) / 3, a[1] + (b[1] - a[1]) / 3], [a[0] + (2 * (b[0] - a[0])) / 3, a[1] + (2 * (b[1] - a[1])) / 3], b];

/**
 * Where each corner of a neckline is cut — see `trimEdge`: its shoulder lines
 * and opening as drawn, where the opening meets the neck's drawn edge, and
 * where a straight line from there touches each shoulder line; with the right
 * shoulder line from its tip to that point, and the left from that point to
 * its tip. Nothing, if the opening never comes onto the body or no such line
 * touches a shoulder.
 */
export function neckCorners(strapRight: Pt[], opening: Pt[][], strapLeft: Pt[], body: BodyType) {
  const right = cubicsOf(strapRight[0], run(strapRight));
  const left = cubicsOf(strapLeft[0], run(strapLeft));
  const firstOpen = cubicsOf(opening[0][0], run(opening[0]));
  const lastOpen = opening.length === 2 ? cubicsOf(opening[1][0], run(opening[1])) : firstOpen;

  /* where the opening meets the neck's drawn edge: on her right from the corner in, on her left out to the corner */
  const iR = firstOpen.findIndex(({ seg }) => meetsBody(seg, false, body) !== null);
  let iL = -1;
  for (let k = lastOpen.length - 1; k >= 0; k--) if (meetsBody(lastOpen[k].seg, true, body) !== null) {
    iL = k;
    break;
  }
  if (iR < 0 || iL < 0) return null;
  const tR = meetsBody(firstOpen[iR].seg, false, body)!;
  const tL = meetsBody(lastOpen[iL].seg, true, body)!;
  const nRight = bezierAt(firstOpen[iR].seg, tR);
  const nLeft = bezierAt(lastOpen[iL].seg, tL);

  /* where a straight line from there touches each shoulder line: her right's runs out to the shoulder, her left's in from it */
  const atR = touches(nRight, right, 1, true);
  const atL = touches(nLeft, left, -1, false);
  if (!atR || !atL) return null;
  const headR = splitAt(right[atR.i].seg, atR.t)[0];
  const tailL = splitAt(left[atL.i].seg, atL.t)[1];
  /* where the line leaves the shoulder line at one of its own points, the split's other part has no length: none drawn */
  const some = (s: Seg) => (Math.hypot(s[3][0] - s[0][0], s[3][1] - s[0][1]) > 0.05 ? [cubicText(s)] : []);
  return {
    firstOpen,
    lastOpen,
    iR,
    iL,
    tR,
    tL,
    nRight,
    nLeft,
    headR,
    tailL,
    rightTo: [...right.slice(0, atR.i).map((c) => c.text), ...some(headR)],
    leftFrom: [...some(tailL), ...left.slice(atL.i + 1).map((c) => c.text)],
  };
}

export function trimEdge(edge: string, strapRight: Pt[], opening: Pt[][], strapLeft: Pt[], body: BodyType): string {
  const runs = [strapRight, ...opening, strapLeft];
  /* the edge is these runs, each its own `run`: anything else, and it is drawn as cut */
  if (runs.map((r) => run(r)).join(" ") !== edge) return edge;
  const c = neckCorners(strapRight, opening, strapLeft, body);
  if (!c) return edge;
  const { firstOpen, lastOpen, iR, iL, tR, tL, nRight, nLeft, headR, tailL } = c;
  const curveRight = straight(headR[3], nRight);
  const curveLeft = straight(nLeft, tailL[0]);

  const openText = (cubics: { text: string; seg: Seg }[], from: number, to: number, head?: Seg, tail?: Seg) =>
    [...(head ? [cubicText(head)] : []), ...cubics.slice(from, to).map((x) => x.text), ...(tail ? [cubicText(tail)] : [])].join(" ");
  const opened =
    opening.length === 2
      ? [
          openText(firstOpen, iR + 1, firstOpen.length, splitAt(firstOpen[iR].seg, tR)[1]),
          openText(lastOpen, 0, iL, undefined, splitAt(lastOpen[iL].seg, tL)[0]),
        ].join(" ")
      : openText(firstOpen, iR + 1, iL, splitAt(firstOpen[iR].seg, tR)[1], splitAt(firstOpen[iL].seg, tL)[0]);
  return [...c.rightTo, cubicText(curveRight), opened, cubicText(curveLeft), ...c.leftFrom].join(" ");
}

/**
 * Her neck's drawn edge from `from`, on it, up to the row `toY`: the outline's
 * own points, the last one on that row.
 */
export function upTheNeck(from: Pt, toY: number, body: BodyType): Pt[] {
  const poly = drawnOutline(body);
  let at = 0;
  for (let i = 1; i < poly.length; i++) if (Math.hypot(poly[i][0] - from[0], poly[i][1] - from[1]) < Math.hypot(poly[at][0] - from[0], poly[at][1] - from[1])) at = i;
  const n = poly.length;
  const dir = poly[(at + n - 1) % n][1] < poly[(at + 1) % n][1] ? -1 : 1;
  const out: Pt[] = [];
  for (let k = 0, i = at; k < n; k++, i = (i + dir + n) % n) {
    const p = poly[i];
    if (p[1] <= toY) {
      const q = out.length ? out[out.length - 1] : from;
      const t = (q[1] - toY) / (q[1] - p[1] || 1);
      out.push([q[0] + (p[0] - q[0]) * t, toY]);
      return out;
    }
    if (p[1] < from[1]) out.push(p);
  }
  return out;
}

/** A point as a path writes it, to a tenth. */
export const pointText = (p: Pt) => `${tenth(p[0])} ${tenth(p[1])}`;

/**
 * One corner of a closed piece, as drawn: `into`, the run of its opening that
 * comes into the corner, and `from`, the run of its shoulder line that leaves
 * it, each as `cubicsOf` reads its path. Trimmed as the dress's crew is — see
 * `trimEdge`: the opening up to where it meets the body's drawn outline
 * nearest the corner, and the shoulder line from where a straight line from
 * there touches it, so the piece closes along that line. `outward` is which way
 * x runs from the neck along the shoulder. Nothing, if the opening never
 * comes onto the body or no such line touches the shoulder.
 */
export function trimCorner(
  into: { text: string; seg: Seg }[],
  from: { text: string; seg: Seg }[],
  outward: 1 | -1,
  body: BodyType
): { into: string; from: string; n: Pt; t: Pt } | null {
  let iN = -1;
  let tN = 0;
  for (let k = into.length - 1; k >= 0; k--) {
    const t = meetsBody(into[k].seg, true, body);
    if (t !== null) {
      iN = k;
      tN = t;
      break;
    }
  }
  if (iN < 0) return null;
  const n = bezierAt(into[iN].seg, tN);
  const at = touches(n, from, outward, false);
  if (!at) return null;
  const head = splitAt(into[iN].seg, tN)[0];
  const tail = splitAt(from[at.i].seg, at.t)[1];
  /* where the line leaves the shoulder line at one of its own points, the split's other part has no length: none drawn */
  const some = (s: Seg) => (Math.hypot(s[3][0] - s[0][0], s[3][1] - s[0][1]) > 0.05 ? [cubicText(s)] : []);
  return {
    into: [...into.slice(0, iN).map((c) => c.text), ...some(head)].join(" "),
    from: [...some(tail), ...from.slice(at.i + 1).map((c) => c.text)].join(" "),
    n,
    t: tail[0],
  };
}

/**
 * The middle of a body's neck where it is narrowest: its throat, the line a
 * neckline is cut about. Measured as `check:garments` measures it.
 */
export function throatOf(body: BodyType): number {
  const p = profileFor(body);
  let best: [number, number] | null = null;
  for (let y = 0; y < BODY_CANVAS.height; y++) {
    const l = edgeAt(p.neckLeft, y);
    const r = edgeAt(p.neckRight, y);
    if (l === null || r === null) continue;
    if (!best || r - l < best[1] - best[0]) best = [l, r];
  }
  return best ? (best[0] + best[1]) / 2 : BODY_CANVAS.width / 2;
}

/** A run's x at a row, read between its points: none outside the rows it spans. */
function xOn(run: Pt[], y: number): number | null {
  for (let i = 1; i < run.length; i++) {
    const [x0, y0] = run[i - 1];
    const [x1, y1] = run[i];
    if ((y - y0) * (y - y1) > 0) continue;
    return y0 === y1 ? x0 : x0 + ((x1 - x0) * (y - y0)) / (y1 - y0);
  }
  return null;
}

/** A run with a point added on each half row across `rows`, and on both its ends, so a change across them follows them. */
function onRows(run: Pt[], [from, to]: readonly [number, number]): Pt[] {
  const marks: number[] = [];
  for (let y = from; y < to; y += 0.5) marks.push(y);
  marks.push(to);
  const out: Pt[] = [run[0]];
  for (let i = 1; i < run.length; i++) {
    const [x0, y0] = run[i - 1];
    const [x1, y1] = run[i];
    /* the run climbs: rows passed between these two points, in the order it meets them */
    const passed = marks.filter((m) => (m - y0) * (m - y1) < 0).sort((a, b) => (y1 < y0 ? b - a : a - b));
    for (const m of passed) out.push([x0 + ((x1 - x0) * (m - y0)) / (y1 - y0), m]);
    out.push(run[i]);
  }
  return out;
}

/**
 * Two runs up either side of the neck, brought nearer even about the throat:
 * on each row across `rows` that both reach, where one side stands further
 * from the throat than the other by more than `within`, the nearer side
 * reaches out toward it — over the page beside the neck — by at most `reach`.
 * Neither side ever comes in, so nothing held before is let go; each run's
 * first point, on the cloth, stays where it is.
 */
export function evenAbout(
  left: Pt[],
  right: Pt[],
  throat: number,
  { within, reach, rows }: { within: number; reach: number; rows: readonly [number, number] }
): [Pt[], Pt[]] {
  const [from, to] = rows;
  if (!(to > from)) return [left, right];
  const L0 = onRows(left, rows);
  const R0 = onRows(right, rows);
  const L = L0.map(([x, y], i) => {
    const r = i === 0 || y < from || y > to ? null : xOn(right, y);
    const short = r === null ? 0 : r - throat - (throat - x) - within;
    return (short > 0 ? [x - Math.min(reach, short), y] : [x, y]) as Pt;
  });
  const R = R0.map(([x, y], i) => {
    const l = i === 0 || y < from || y > to ? null : xOn(left, y);
    const short = l === null ? 0 : throat - l - (x - throat) - within;
    return (short > 0 ? [x + Math.min(reach, short), y] : [x, y]) as Pt;
  });
  /* a side that does not move keeps its own points: the ones added along it would only be rounded off it */
  const moved = (a: Pt[], b: Pt[]) => a.some((p, i) => p[0] !== b[i][0]);
  return [moved(L, L0) ? L : left, moved(R, R0) ? R : right];
}
