/**
 * Puts a photographed mannequin onto the shared body canvas.
 *
 *     node scripts/normalise-mannequin.mjs
 *
 * This is an art tool, not app code — nothing in `src/` imports it, and the app
 * only ever loads the PNGs it leaves behind. It replaced a renderer that *built*
 * the figure from stacked ellipses, and the reason it did is worth keeping: a
 * body made of ellipses on a midline has shoulders that read as bells, and the
 * deltoid cannot be made to grow out of one without reintroducing a step in the
 * outline. A photograph has no such problem. Nothing here draws a body; it
 * measures one and places it.
 *
 * What it does, and all it does:
 *
 *   1. Reads the source cut-out and finds the figure in it — the alpha channel's
 *      bounding box, and the **median midpoint of the trunk** across the torso,
 *      which is the axis clothes are cut about. (Not the bounding box, which an
 *      arm pulls off centre; and not every whole row's midpoint either, which
 *      the hands still pull — that left both trunks 2.5 units right of centre.)
 *   2. Scales it **uniformly** so crown lands on `CROWN_Y` and floor on
 *      `FLOOR_Y`, which is the vertical skeleton every garment is cut against.
 *   3. Pads it onto the canvas with that axis on `CENTRE_X`.
 *
 * It does not retouch, redraw, clean up or stretch. If a photograph is the wrong
 * shape, the answer is another photograph — see the shooting spec in README.md.
 *
 * The originals are read and never written.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { decodePngRgba, encodePng } from "./mannequin/png.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public", "mannequin");

/** The canvas and skeleton from `src/lib/mannequin/bodies.ts`. */
const CANVAS = { width: 600, height: 1000 };
const CROWN_Y = 40;
const FLOOR_Y = 950;
const CENTRE_X = 300;

/** Output pixels per canvas unit. 1.5 ⇒ 900×1500, ample for a 440 px stage. */
const SCALE = 1.5;

/** Alpha at or below this is background, not body. */
const SOLID = 128;

/**
 * The rows the trunk's axis is read over, as fractions of the figure's height
 * from the crown: below the armpits, above the crotch, on both bodies.
 */
const TRUNK_BAND = [0.28, 0.46];

/** Where the sources live. Yours, untouched. */
const SOURCES = {
  female: "C:/Users/Omar Alshehri/Desktop/FemaleManniqen.png",
  male: "C:/Users/Omar Alshehri/Desktop/MaleMannequin.png",
};

/* ------------------------------------------------------------- measuring */

/**
 * Where the figure is in its own file.
 *
 * `midline` is the median row midpoint rather than the centre of the bounding
 * box, and `rows` is kept so the caller can report what it placed.
 */
function findFigure({ width, height, rgba }) {
  const alphaAt = (x, y) => rgba[(y * width + x) * 4 + 3];
  let x0 = width, x1 = -1, y0 = height, y1 = -1;
  const mids = [];

  for (let y = 0; y < height; y++) {
    let lo = width, hi = -1;
    for (let x = 0; x < width; x++) {
      if (alphaAt(x, y) <= SOLID) continue;
      if (x < lo) lo = x;
      if (x > hi) hi = x;
    }
    if (hi < 0) continue;
    mids.push((lo + hi) / 2);
    if (lo < x0) x0 = lo;
    if (hi > x1) x1 = hi;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }

  if (x1 < 0) throw new Error("No figure found — is the background transparent?");
  const median = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
  const rough = median(mids);

  /*
    The axis is the **trunk's**, not the whole row's.

    A whole row runs from one hand to the other, and hands are not held
    symmetrically: his right hangs further out than his left, and hers too by
    less. Centring on whole rows put both trunks 2.5 units right of the canvas
    centre — and every garment is mirrored about that centre, so every one of
    them stood 5 units further off one hip than the other. The trunk is the
    thing clothes are cut about, so it is the thing that goes on the axis.

    Read over the band of rows between the armpits and the crotch, and only the
    run straddling the rough axis, so an arm hanging clear of the ribs is not
    part of it.
  */
  const trunk = [];
  const from = Math.round(y0 + (y1 - y0) * TRUNK_BAND[0]);
  const to = Math.round(y0 + (y1 - y0) * TRUNK_BAND[1]);
  const seed = Math.round(rough);
  for (let y = from; y <= to; y++) {
    if (alphaAt(seed, y) <= SOLID) continue;
    let lo = seed, hi = seed;
    while (lo > 0 && alphaAt(lo - 1, y) > SOLID) lo--;
    while (hi < width - 1 && alphaAt(hi + 1, y) > SOLID) hi++;
    trunk.push((lo + hi) / 2);
  }
  if (trunk.length === 0) throw new Error("No trunk found across the torso band.");

  return {
    x0, x1, y0, y1,
    midline: median(trunk),
    wholeRowMidline: rough,
    opaqueRows: mids.length,
  };
}

/**
 * Refuse a file whose background is white rather than transparent.
 *
 * It is the one defect that would pass every other check in this project and
 * corrupt every number in it: the alpha bounding box becomes the whole frame,
 * so anchors, seams and coverage all measure the rectangle. Cheap to test —
 * a cut-out has a transparent corner and a framed photograph does not.
 */
function refuseOpaqueBackground(name, { width, height, rgba }) {
  const corners = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]];
  const opaque = corners.filter(([x, y]) => rgba[(y * width + x) * 4 + 3] > SOLID);
  if (opaque.length === 0) return;
  throw new Error(
    `${name}: ${opaque.length} of 4 corners are opaque, so the background is ` +
      `painted rather than transparent. Every measurement in this project reads ` +
      `the alpha channel, so this would silently measure the frame instead of ` +
      `the body. Cut the background out to real transparency and try again.`
  );
}

/* -------------------------------------------------------------- resampling */

/**
 * Area-average resample into the canvas, in **premultiplied** alpha.
 *
 * Premultiplying matters at the cut-out's edge: a pixel that is half
 * transparent still carries a full-strength colour, and averaging that colour in
 * unweighted pulls the white of the background into the silhouette. The result
 * is a pale halo round the figure that looks like bad masking. Weighting each
 * sample by its own alpha is the whole fix.
 */
function place(src, fig) {
  const { width: sw, rgba } = src;
  const scale = (FLOOR_Y - CROWN_Y) / (fig.y1 - fig.y0);
  const W = Math.round(CANVAS.width * SCALE);
  const H = Math.round(CANVAS.height * SCALE);
  const out = Buffer.alloc(W * H * 4);

  // one output pixel spans this much of the source
  const step = 1 / (scale * SCALE);

  for (let py = 0; py < H; py++) {
    // output pixel -> canvas units -> source pixels
    const cy = py / SCALE;
    const sy0 = fig.y0 + (cy - CROWN_Y) / scale;
    for (let px = 0; px < W; px++) {
      const cx = px / SCALE;
      const sx0 = fig.midline + (cx - CENTRE_X) / scale;

      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let dy = 0; dy < step; dy += 1) {
        const sy = Math.round(sy0 + dy);
        if (sy < 0 || sy >= src.height) continue;
        for (let dx = 0; dx < step; dx += 1) {
          const sx = Math.round(sx0 + dx);
          if (sx < 0 || sx >= sw) continue;
          const i = (sy * sw + sx) * 4;
          const av = rgba[i + 3] / 255;
          r += rgba[i] * av; g += rgba[i + 1] * av; b += rgba[i + 2] * av;
          a += rgba[i + 3];
          n += 1;
        }
      }
      if (n === 0) continue;
      const o = (py * W + px) * 4;
      const alpha = a / n;
      out[o + 3] = Math.round(alpha);
      if (alpha <= 0) continue;
      // back out of premultiplied
      const k = 255 / alpha;
      out[o] = Math.min(255, Math.round((r / n) * k));
      out[o + 1] = Math.min(255, Math.round((g / n) * k));
      out[o + 2] = Math.min(255, Math.round((b / n) * k));
    }
  }
  return { out, W, H, scale };
}

/* -------------------------------------------------------------------- main */

mkdirSync(OUT_DIR, { recursive: true });

for (const [body, source] of Object.entries(SOURCES)) {
  const src = decodePngRgba(readFileSync(source));
  refuseOpaqueBackground(body, src);

  const fig = findFigure(src);
  const { out, W, H, scale } = place(src, fig);

  const file = join(OUT_DIR, `${body}-front.png`);
  writeFileSync(file, encodePng(out, W, H));

  console.log(
    `${body.padEnd(7)} ${src.width}×${src.height} → ${W}×${H}` +
      `   figure x ${fig.x0}–${fig.x1}, y ${fig.y0}–${fig.y1}` +
      `   trunk axis at x ${fig.midline.toFixed(1)}` +
      ` (whole rows ${fig.wholeRowMidline.toFixed(1)})   scale ×${scale.toFixed(4)}`
  );
}
