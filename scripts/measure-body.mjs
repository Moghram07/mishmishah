import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { decodePngAlpha, decodePngRgba } from "./mannequin/png.mjs";

/**
 * Read the body out of the photograph, and write it down as numbers.
 *
 * `bodies.ts` has always held a handful of scalars — shoulder width at one row,
 * the height of the waist — and a set of axis-aligned *zones*, which are for
 * erasing the photograph and are documented as not being a body outline. So a
 * drawing that wanted to know where the body actually was at some height had
 * nothing to ask, and every garment in the wardrobe answered the question by
 * hand: a typed coordinate, guessed, and guessed again for the other side.
 *
 * That is the whole of why the clothes fit badly. A hand-typed left and a
 * hand-typed right drift apart, which is a crooked shoulder. A hand-typed
 * underarm lands twenty units below the real one, which is a triangular wedge.
 * And nothing hand-typed can know that this mannequin's arms hang *clear* of
 * its ribs, because that fact is not written down anywhere — so every sleeve
 * was drawn joined to its body and the figure came out a slab.
 *
 * This writes the fact down. It walks each row of the alpha channel, works out
 * which runs of opaque pixels are the trunk, which are the arms and which are
 * the legs, and emits `src/lib/mannequin/profile.ts` — the edges a garment is
 * drafted against. Regenerate with `npm run measure:body` after replacing a
 * photograph; `npm run check:garments` fails if the file and the PNG disagree.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** A newline, named, so the generator's own source stays free of escapes. */
const NL = String.fromCharCode(10);

/** The canvas the whole app draws in. Kept in step with `BODY_CANVAS`. */
const W = 600;
const H = 1000;
const CENTER = W / 2;

/** Alpha at or above this counts as body. Below it is the cut-out's feather. */
const OPAQUE = 128;

/** Rows are sampled this far apart. Four units is 0.76 cm — finer than cloth. */
const STEP = 4;

/** A run narrower than this is a speck in the cut-out, not a limb. */
const SPECK = 2;

/**
 * The highest row the outer edge is sampled from — the base of the neck.
 *
 * It was 196, which is below the shoulder slope, so a yoke had no measured edge
 * to follow and every shoulder seam was a hand-solved cubic instead. One cubic
 * cannot hug a shape whose deltoid breaks as sharply as this one does, so it
 * cleared the silhouette by standing up to 11.7 units off her trapezius — which
 * is a shoulder pad, and is what the cloth looked like.
 *
 * From 174 the same edge runs continuously from beside the throat, out over the
 * shoulder, down the deltoid and on to the wrist. A yoke rides the top of it
 * and a sleeve cap rides the rest; neither needs its own guess.
 */
const CAP_TOP = 174;

/** The rows the neck column is read over: below the jaw, above the flare. */
const NECK_FROM = 136;
const NECK_TO = 196;

/* ------------------------------------------------------------ reading rows */

function reader(file) {
  const { width, height, alpha } = decodePngAlpha(readFileSync(file));
  const sx = width / W;
  const sy = height / H;
  return (y) => {
    const py = Math.min(height - 1, Math.max(0, Math.round(y * sy)));
    const runs = [];
    let start = -1;
    for (let px = 0; px < width; px++) {
      const on = alpha[py * width + px] >= OPAQUE;
      if (on && start < 0) start = px;
      if (!on && start >= 0) {
        runs.push([start / sx, (px - 1) / sx]);
        start = -1;
      }
    }
    if (start >= 0) runs.push([start / sx, (width - 1) / sx]);
    return runs.filter(([a, b]) => b - a >= SPECK);
  };
}

const span = (list) =>
  list.length === 0
    ? null
    : [Math.min(...list.map((r) => r[0])), Math.max(...list.map((r) => r[1]))];

/**
 * One row, sorted into trunk, arms and legs — by where the runs are, never by
 * how many there are.
 *
 * Counting runs is the obvious way and it does not survive contact with a
 * photograph: a hand held against a thigh splits into two runs, a wrist thins
 * to nothing and comes back, and the number of runs on a row swings between one
 * and five down the length of a leg. What is stable is position. The trunk is
 * whatever covers the centre line; when nothing does, the legs have parted and
 * the two runs nearest the centre are the legs. Anything further out is an arm.
 */
function sortRow(runs) {
  if (runs.length === 0) return null;
  const trunk = runs.find(([a, b]) => a <= CENTER && b >= CENTER);
  if (trunk) {
    return {
      parted: false,
      trunk,
      armL: span(runs.filter(([, b]) => b < trunk[0])),
      armR: span(runs.filter(([a]) => a > trunk[1])),
    };
  }
  const left = runs.filter(([, b]) => b < CENTER).sort((p, q) => q[1] - p[1]);
  const right = runs.filter(([a]) => a > CENTER).sort((p, q) => p[0] - q[0]);
  return {
    parted: true,
    legL: left[0] ?? null,
    legR: right[0] ?? null,
    armL: span(left.slice(1)),
    armR: span(right.slice(1)),
  };
}

/* ------------------------------------------------- folding the two sides in */

/**
 * The two sides of the body, folded into one left-hand edge.
 *
 * A garment is cut symmetrically — that is not a simplification, it is how
 * clothes are made — but a photographed mannequin is never quite square to the
 * camera. His shoulders sit six units off centre. So each edge is taken at
 * whichever side of the body reaches furthest, and the symmetric garment drawn
 * against it clears both: a little more ease on the near side, none missing on
 * the far one. Fold the other way and the garment cuts into him on one side.
 */
const fold = (left, right) => {
  const both = [];
  if (left != null) both.push(left);
  if (right != null) both.push(W - right);
  return both;
};

const outermost = (left, right) => {
  const both = fold(left, right);
  return both.length === 0 ? null : Math.min(...both);
};

const innermost = (left, right) => {
  const both = fold(left, right);
  return both.length === 0 ? null : Math.max(...both);
};

/* ------------------------------------------------------------- the sampling */

function measure(file) {
  const rowAt = reader(file);

  // Where the arms leave the ribs, and where the legs part. Both are read at
  // full resolution rather than on the sampling grid: they are the two rows
  // every garment is anchored to, and rounding them to the nearest four units
  // moves an armhole by half a centimetre.
  let armpitY = null;
  let crotchY = null;
  for (let y = 200; y < H; y++) {
    const row = sortRow(rowAt(y));
    if (!row) continue;
    if (armpitY === null && !row.parted && row.armL && row.armR) armpitY = y;
    if (armpitY !== null && crotchY === null && row.parted) crotchY = y;
  }
  if (armpitY === null || crotchY === null) {
    throw new Error(`${file}: could not find the armpit or the crotch`);
  }

  // How far down the arms go. Below the hand the row has no arm runs at all.
  let armEndY = armpitY;
  for (let y = armpitY; y < H; y++) {
    const row = sortRow(rowAt(y));
    if (row && (row.armL || row.armR)) armEndY = y;
  }

  /**
   * One sample per stored row — and each one is the **outermost** edge across
   * the rows it stands for, not the edge at its own row.
   *
   * Her silhouette drops thirteen units between y 196 and y 197, in a single
   * row: that is the outer corner of the deltoid, and it is a step rather than
   * a slope. A grid that records only y 196 and y 198 misses it entirely, and
   * anything interpolated across the gap sits inside the shoulder — which is
   * skin showing above the cloth, and is invisible in the numbers because both
   * samples are perfectly good.
   *
   * Taking the envelope over each interval makes the stored edge a conservative
   * outer bound everywhere, which is the only property a seam drafted from it
   * actually needs.
   */
  const sample = (fromY, toY, pick, step = STEP, side = "outer") => {
    const x = [];
    for (let y = fromY; y <= toY; y += step) {
      const seen = [];
      for (let k = 0; k < step; k++) {
        const v = pick(sortRow(rowAt(y + k)), y + k);
        if (v != null) seen.push(v);
      }
      x.push(
        seen.length === 0
          ? null
          : side === "outer"
            ? Math.min(...seen)
            : Math.max(...seen)
      );
    }
    return { fromY, step, x };
  };

  const trunkEdge = (row) => (row && !row.parted ? row.trunk : null);

  const arm = (row) => {
    if (!row) return [null, null];
    return [outermost(row.armL?.[0], row.armR?.[1]), innermost(row.armL?.[1], row.armR?.[0])];
  };

  // Above the armpit the arm is welded to the ribs, so there is no arm *run* to
  // read — but the outermost thing on the row is still the arm, and a sleeve
  // cap has to follow it over the shoulder. Take the silhouette's own edge
  // there. Only there: once the arms have parted, a row that momentarily loses
  // one to the alpha threshold must report nothing rather than fall back to the
  // trunk, which is thirty units inboard and would pinch the sleeve shut.
  const armOuterAt = (row, y) => {
    if (!row) return null;
    if (row.armL || row.armR) return arm(row)[0];
    if (y < armpitY && !row.parted) return outermost(row.trunk[0], row.trunk[1]);
    return null;
  };

  const leg = (row) => {
    if (!row || !row.parted) return [null, null];
    const l = row.legL;
    const r = row.legR;
    return [outermost(l?.[0], r?.[1]), innermost(l?.[1], r?.[0])];
  };

  return {
    armpitY,
    crotchY,
    armEndY,
    torso: sample(armpitY, crotchY, (row) => {
      const t = trunkEdge(row);
      return t ? outermost(t[0], t[1]) : null;
    }),
    /*
      From beside the throat, so a yoke and a sleeve cap ride one edge — and
      sampled twice as finely as everything else, because of the one place on
      this body where four units is too coarse: her silhouette moves 21 units
      between y 196 and y 200. Read on a four-unit grid the deltoid's corner
      falls between samples, and a seam interpolated across it ends up inside
      the shoulder it is supposed to clear.
    */
    armOuter: sample(CAP_TOP, armEndY, armOuterAt, 2, "outer"),
    /*
      The neck, left and right, and deliberately **not** folded together.

      Everything else here is folded to whichever side reaches further, because
      a garment is cut symmetrically. The neck is the one place that does not
      work: his neck column sits about 3 units right of the canvas centre, and
      an opening cut symmetrically about 300 crowds one side of his throat while
      gaping on the other — which is exactly the "neck hole is off to the left"
      that is visible on him. A neckline is small enough, and close enough to
      the eye, that it has to be cut where the neck actually is.
    */
    neckLeft: sample(NECK_FROM, NECK_TO, (row) =>
      row && !row.parted ? row.trunk[0] : null
    ),
    neckRight: sample(
      NECK_FROM,
      NECK_TO,
      (row) => (row && !row.parted ? row.trunk[1] : null),
      STEP,
      "inner"
    ),
    armInner: sample(armpitY, armEndY, (row) => arm(row)[1], STEP, "inner"),
    legOuter: sample(crotchY, H - 40, (row) => leg(row)[0]),
    legInner: sample(crotchY, H - 40, (row) => leg(row)[1], STEP, "inner"),
  };
}

/* -------------------------------------------------------------- smoothing */

/**
 * Three smoothing passes over each edge.
 *
 * One is not enough. A single pass leaves about two units of the photograph's
 * own pixel noise in the edge, which is invisible on a side seam and very
 * visible on an inseam: the two are only twenty units apart, so the eye reads
 * the wobble against its neighbour rather than against the whole figure, and a
 * trouser leg comes out looking hand-torn.
 *
 *
 * The alpha is quantised to the photograph's own pixels, so a measured edge
 * jitters by a unit from row to row. Drafting straight off it puts that jitter
 * into the seam, where it reads as a wobble in the cloth rather than as the
 * shape of a body. Holes — rows where the limb was not found — are left alone
 * and interpolated by the accessor instead.
 */
/**
 * Smoothing may move an edge outward, never inward.
 *
 * Three taps are what it takes to get the photograph's pixel noise out of an
 * inseam, and they are far too many at the shoulder: her silhouette drops 21
 * units between y 196 and y 200, and a filter run across that cliff rounds the
 * corner off by six. A seam drafted from the rounded edge then sits *inside*
 * the deltoid, which is skin showing above the cloth — the exact defect the
 * smoothing is downstream of.
 *
 * So every sample is clamped back against the raw measurement. On a gentle run
 * the clamp never binds and the noise still goes; at a cliff the clamp binds on
 * the inward side only, and the edge keeps its corner. `side` says which way is
 * out: `outer` for a left-facing edge a garment passes outside of, `inner` for
 * one it has to reach past.
 */
function smooth(edge, side, passes = 3) {
  const raw = edge.x;
  let x = raw;
  for (let pass = 1; pass < passes; pass++) x = tap(x);
  const out = tap(x).map((v, i) => {
    if (v === null || raw[i] === null) return v;
    return side === "outer" ? Math.min(v, raw[i]) : Math.max(v, raw[i]);
  });
  return { ...edge, x: out.map((v) => (v === null ? null : Math.round(v * 10) / 10)) };
}

/** One pass: each sample pulled a quarter of the way toward its neighbours. */
function tap(x) {
  return x.map((v, i) => {
    if (v === null) return null;
    const a = x[i - 1];
    const b = x[i + 1];
    if (a === null || a === undefined || b === null || b === undefined) return v;
    return (a + 2 * v + b) / 4;
  });
}

/* ---------------------------------------------------------------- emitting */

const list = (xs) =>
  xs
    .map((v) => (v === null ? "null" : String(v)))
    .reduce((rows, v) => {
      const last = rows[rows.length - 1];
      if (last && last.length + v.length + 2 <= 72) rows[rows.length - 1] = `${last}, ${v}`;
      else rows.push(v);
      return rows;
    }, [])
    .map((row) => `    ${row},`)
    .join("\n");

const edge = (name, e) =>
  `  ${name}: {\n    fromY: ${e.fromY},\n    step: ${e.step},\n    x: [\n${list(e.x)}\n    ],\n  },`;

function emit(name, m) {
  return [
    `export const ${name}: BodyProfile = {`,
    `  armpitY: ${m.armpitY},`,
    `  shoulderPointY: ${m.shoulderPointY},`,
    `  elbowY: ${m.elbowY},`,
    `  wristY: ${m.wristY},`,
    `  waistY: ${m.waistY},`,
    `  hipY: ${m.hipY},`,
    `  crotchY: ${m.crotchY},`,
    `  armEndY: ${m.armEndY},`,
    `  light: { median: ${m.light.median}, highlight: ${m.light.highlight} },`,
    edge("torso", m.torso),
    edge("armOuter", m.armOuter),
    edge("neckLeft", m.neckLeft),
    edge("neckRight", m.neckRight),
    edge("armInner", m.armInner),
    edge("legOuter", m.legOuter),
    edge("legInner", m.legInner),
    `};`,
  ].join("\n");
}

const HEADER = `/**
 * The body, as measured — not as guessed.
 *
 * **Generated by \`npm run measure:body\` from the mannequin photographs. Do not
 * edit by hand.** Every number here was read out of a PNG's alpha channel, and
 * \`npm run check:garments\` re-reads those PNGs and fails if this file has
 * drifted from them.
 *
 * \`bodies.ts\` holds the body's *skeleton* — a dozen anchors — and its
 * coverage *zones*, which exist to erase the photograph and are deliberately
 * boxier than any body. Neither describes an outline, and a garment drafted
 * against either is a garment drawn near a body rather than onto one. This is
 * the outline: where the trunk's edge runs at each height, where each arm's own
 * edges run, and where the legs run once they part.
 *
 * Everything is a **left-hand** edge, mirrored for the right. Clothes are cut
 * symmetrically and a photographed mannequin never is, so each edge is folded
 * to whichever side reaches further out — the symmetric garment then clears
 * both sides instead of cutting into the one the camera favoured.
 *
 * Nothing draws with these directly. \`lib/garments/fit.ts\` turns them into
 * seams, armholes, sleeves and legs with ease added, and the drawings use that.
 */

/** One edge of the body, sampled down the canvas. \`null\` where it is absent. */
export interface BodyEdge {
  /** The row the first sample was taken at. */
  fromY: number;
  /** How far apart the samples are, in canvas units. */
  step: number;
  /** The edge's x at \`fromY\`, \`fromY + step\`, and so on. */
  x: (number | null)[];
}

export interface BodyProfile {
  /** The row the arms leave the ribs — the bottom of any true armhole. */
  armpitY: number;
  /** Where the outline turns from shoulder to arm: the end of the shoulder seam. */
  shoulderPointY: number;
  /** The elbow, placed between the shoulder point and the wrist by proportion. */
  elbowY: number;
  /** The wrist: the narrowest the arm gets above the hand. */
  wristY: number;
  /** The middle of the trunk's narrowest band — where a waistband is hung from. */
  waistY: number;
  /** The first row below the waist at which the trunk is widest: where a skirt rests. */
  hipY: number;
  /** The row the legs part. */
  crotchY: number;
  /** The row the hands run out. Below it there is no arm to sleeve. */
  armEndY: number;
  /**
   * How the photograph is lit, as grey levels from 0 to 1 over the opaque
   * body: its median, and the level only its brightest 1% exceeds. A skin
   * tone is a curve over this grey — see \`mannequin/skinTint.ts\` — so the
   * median is what renders as the swatch, and the highlight is what must stay
   * short of white.
   */
  light: { median: number; highlight: number };
  /** The trunk's left edge, from the armpit to the crotch. */
  torso: BodyEdge;
  /**
   * The outer silhouette, from beside the throat down to the wrist.
   *
   * One continuous edge — the shoulder slope, the deltoid, then the arm. A yoke
   * rides its top and a sleeve cap rides the rest, so neither has to guess.
   */
  armOuter: BodyEdge;
  /** The arm's edge that faces the ribs. */
  armInner: BodyEdge;
  /**
   * The throat, each side kept separately — the one edge that is not folded.
   *
   * His neck column sits about three units right of the canvas centre, and an
   * opening cut symmetrically about 300 crowds one side of it while gaping on
   * the other. A neckline is close enough to the eye that it has to be cut
   * where the neck is.
   */
  neckLeft: BodyEdge;
  neckRight: BodyEdge;
  /** One leg's outer edge, and the edge that faces the other leg. */
  legOuter: BodyEdge;
  legInner: BodyEdge;
}
`;

const ACCESSORS = `
/**
 * An edge's x at any height, interpolated between samples.
 *
 * Returns \`null\` above or below the edge's own run, and across any gap the
 * measurement left in it — a wrist that thinned past the alpha threshold, say.
 * Callers treat that as "no limb here", which is the truthful answer and the
 * one that keeps a sleeve from being drawn onto air.
 */
export function edgeAt(edge: BodyEdge, y: number): number | null {
  const t = (y - edge.fromY) / edge.step;
  if (t < 0 || t > edge.x.length - 1) return null;
  const i = Math.floor(t);
  const a = edge.x[i];
  if (i === edge.x.length - 1) return a;
  const b = edge.x[i + 1];
  if (a === null || b === null) return a ?? b;
  return a + (b - a) * (t - i);
}

/** The last row at which an edge is present. */
export function edgeEnd(edge: BodyEdge): number {
  for (let i = edge.x.length - 1; i >= 0; i--) {
    if (edge.x[i] !== null) return edge.fromY + i * edge.step;
  }
  return edge.fromY;
}

export const profiles: Record<BodyType, BodyProfile> = {
  female: FEMALE_PROFILE,
  male: MALE_PROFILE,
};

export const profileFor = (id: BodyType): BodyProfile =>
  profiles[id] ?? FEMALE_PROFILE;
`;

/**
 * The measurement, for anyone who needs it rather than the file.
 *
 * `scripts/preview-garments.mjs` re-measures the shipped PNGs on every run and
 * compares them with the checked-in `profile.ts`, so replacing a photograph
 * without regenerating fails the build instead of silently cutting the whole
 * wardrobe to a body that is no longer there.
 */
export function measureBody(file) {
  const m = measure(file);
  /*
    Which way is "out" for each edge — the side a garment passes on. Smoothing
    is allowed to move an edge that way and not the other; see `smooth`.
  */
  const SIDE = {
    torso: "outer",
    armOuter: "outer",
    armInner: "inner",
    legOuter: "outer",
    legInner: "inner",
    neckLeft: "outer",
    neckRight: "inner",
  };
  for (const key of Object.keys(SIDE)) {
    m[key] = smooth(m[key], SIDE[key]);
  }
  Object.assign(m, trunkLandmarks(m.torso));
  m.shoulderPointY = shoulderPoint(m.armOuter, m.armpitY);
  Object.assign(m, armLandmarks(m));
  m.light = photoLight(file);
  return m;
}

/** The share of the lit body brighter than the highlight level: its sheen. */
const HIGHLIGHT_SHARE = 0.01;

/**
 * The photograph's own light: the median grey of the opaque body, and the
 * grey only its brightest 1% exceeds. Read from the green channel — the
 * photographs are neutral grey, and green carries most of the luminance.
 */
function photoLight(file) {
  const { width, height, rgba } = decodePngRgba(readFileSync(file));
  const grey = [];
  for (let i = 0; i < width * height; i++) {
    if (rgba[i * 4 + 3] === 255) grey.push(rgba[i * 4 + 1]);
  }
  grey.sort((a, b) => a - b);
  const at = (q) => grey[Math.min(grey.length - 1, Math.floor(grey.length * q))] / 255;
  const round = (v) => Math.round(v * 1000) / 1000;
  return { median: round(at(0.5)), highlight: round(at(1 - HIGHLIGHT_SHARE)) };
}

/** The share of shoulder-to-wrist that is upper arm: humerus against forearm. */
const UPPER_ARM = 0.55;
/** Rows within this of the narrowest count as the wrist: the photograph's jitter. */
const WRIST_SLACK = 0.8;

/**
 * The wrist and the elbow, where a sleeve's length is measured to.
 *
 * The wrist is read off the photograph: the narrowest the arm gets in its
 * lower part, before the hand widens it again. The elbow is not — a hanging
 * arm has no corner at the elbow for an outline to find, and his forearm
 * widens so gradually that any threshold picks a different row — so it is
 * placed between the two measured ends by the arm's own proportions.
 *
 * Every sleeve used to type its own cuff row, 330 to 505, and a "short" sleeve
 * on one garment ended where an elbow-length one did on another.
 */
function armLandmarks(m) {
  const at = (edge, y) => {
    const i = (y - edge.fromY) / edge.step;
    const a = edge.x[Math.floor(i)];
    const b = edge.x[Math.ceil(i)];
    return a === null || b === null || a === undefined || b === undefined
      ? null
      : a + (b - a) * (i - Math.floor(i));
  };
  const from = Math.round(m.armpitY + 0.6 * (m.armEndY - m.armpitY));
  const to = m.armEndY - 36;
  const rows = [];
  for (let y = from; y <= to; y += 2) {
    const o = at(m.armOuter, y);
    const i = at(m.armInner, y);
    if (o !== null && i !== null) rows.push({ y, w: i - o });
  }
  const narrow = Math.min(...rows.map((r) => r.w));
  const band = rows.filter((r) => r.w <= narrow + WRIST_SLACK);
  const wristY = Math.round((band[0].y + band[band.length - 1].y) / 2);
  const elbowY = Math.round(m.shoulderPointY + UPPER_ARM * (wristY - m.shoulderPointY));
  return { wristY, elbowY };
}

/** Steeper than this — units of x per unit of y — and the outline is arm. */
const ARM_SLOPE = 1.25;

/**
 * The shoulder point: where the outline stops being shoulder and becomes arm.
 *
 * Down from the neck the outer edge runs almost level along the top of the
 * shoulder — five or six units out for every unit down at its steepest — then
 * turns and drops down the arm. The shoulder seam ends at that turn and the
 * armhole begins there, so it is the anchor every sleeve hangs from: the first
 * row below the steepest part of the shoulder where the edge is steeper than
 * `ARM_SLOPE`.
 *
 * Garments used to hang from the outline at a fixed y 220, which on both
 * bodies is already partway down the deltoid. The shoulder seam ran on over
 * the top of the arm and the armhole cut diagonally across it to the armpit,
 * which is the seam you could see crossing the sleeve.
 */
function shoulderPoint(edge, armpitY) {
  const xAt = (y) => {
    const i = (y - edge.fromY) / edge.step;
    const a = edge.x[Math.floor(i)];
    const b = edge.x[Math.ceil(i)];
    return a === null || b === null ? null : a + (b - a) * (i - Math.floor(i));
  };
  let steepest = edge.fromY;
  let most = -Infinity;
  for (let y = edge.fromY; y + 2 <= armpitY; y += 2) {
    const a = xAt(y);
    const b = xAt(y + 2);
    if (a === null || b === null) continue;
    const slope = (a - b) / 2;
    if (slope > most) {
      most = slope;
      steepest = y;
    }
  }
  for (let y = steepest + 2; y + 2 <= armpitY; y += 2) {
    const a = xAt(y);
    const b = xAt(y + 2);
    if (a !== null && b !== null && (a - b) / 2 <= ARM_SLOPE) return y;
  }
  return steepest + 2;
}

/** Rows within this of the extreme count as part of it: the photograph's own jitter. */
const LANDMARK_SLACK = 0.6;

/**
 * The waist and the hip, read off the trunk edge rather than typed per garment.
 *
 * Every garment used to type its own waist, and both pairs of trousers typed
 * the same one — y 362 — on two bodies whose waists are thirty units apart. A
 * waistband is hung from the body's waist, so the waist has to be something the
 * body says.
 *
 * `waistY` is the middle of the narrowest band of the trunk between the
 * armpits and the crotch: a waist is a hollow, and on a mannequin a flat one,
 * so its middle is the honest single row. `hipY` is the first row below it at
 * which the trunk reaches its widest before the legs part — the point a skirt
 * rests on, and below which it is free to flare.
 */
function trunkLandmarks(torso) {
  const rows = torso.x
    .map((x, i) => ({ x, y: torso.fromY + i * torso.step }))
    .filter((r) => r.x !== null);
  const narrow = Math.max(...rows.map((r) => r.x));
  const band = rows.filter((r) => r.x >= narrow - LANDMARK_SLACK);
  const waistY = Math.round((band[0].y + band[band.length - 1].y) / 2);
  const below = rows.filter((r) => r.y > waistY);
  const wide = Math.min(...below.map((r) => r.x));
  const hipY = below.find((r) => r.x <= wide + LANDMARK_SLACK).y;
  return { waistY, hipY };
}

const bodies = { FEMALE_PROFILE: "female", MALE_PROFILE: "male" };

/** Writing the file is what `npm run measure:body` does; importing is free. */
export function writeProfile() {
  const blocks = Object.entries(bodies).map(([name, id]) => {
    const m = measureBody(join(ROOT, "public", "mannequin", `${id}-front.png`));
    process.stdout.write(
      `${id}: light median=${m.light.median} highlight=${m.light.highlight}  shoulder point y=${m.shoulderPointY}  elbow y=${m.elbowY}  wrist y=${m.wristY}  armpit y=${m.armpitY}  waist y=${m.waistY}  hip y=${m.hipY}  crotch y=${m.crotchY}  arms end y=${m.armEndY}` +
        NL
    );
    return emit(name, m);
  });

  const out = [
    HEADER,
    `import type { BodyType } from "@/types";`,
    "",
    ...blocks.map((b) => b + NL),
    ACCESSORS.trimStart(),
  ].join(NL);

  const dest = join(ROOT, "src", "lib", "mannequin", "profile.ts");
  writeFileSync(dest, out);
  process.stdout.write(`wrote ${dest}` + NL);
}

// Run as a script, not when imported for the measurement alone.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  writeProfile();
}
