/*
  The mannequin photographs, made ready to draw: for each body, its outline
  as a smooth vector path, and the photograph once per skin tone, already
  tinted.

  Before this the stage tinted the grey photograph with an SVG filter on
  every redraw, and drew the photograph a second time through a second
  filter to get its silhouette for the masks — together about two fifths of
  a redraw on a phone. And the photograph's own edge is 1.5 pixels to a
  unit: at 8× a pixel of it is ten on a phone's screen, and the neck and the
  arms ended in steps.

  - The outline: the photograph's alpha traced at half coverage, to a
    fraction of a pixel (marching squares), smoothed over about two pixels,
    thinned (Ramer–Douglas–Peucker, 0.3 px) and drawn through the points
    left as cubic curves. Written to `src/lib/mannequin/outline.ts`. The
    masks fill it white; the body is clipped to it — a clean edge at any zoom.
  - The tinted photographs: the tone's three lookup tables from
    `mannequin/skinTint.ts` — the very curve the filter used — applied to
    each pixel, in sRGB, as the filter did. Inside the edge the photograph is
    made solid, the colour from two pixels within it carried out over the
    cut-out's own lighter rim, so the outline, not the old stepped alpha or
    its rim, is the edge drawn. Lossless WebP in
    `public/mannequin/tinted/`, their hashes in `src/lib/mannequin/tinted.json`.

  usage: node --experimental-strip-types --no-warnings scripts/mannequin/tinted.mjs
*/
import { register } from "node:module";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
// the app's own modules, as written: "@/…" and extensionless relative imports
register(
  "data:text/javascript," +
    encodeURIComponent(`
const SRC = ${JSON.stringify(pathToFileURL(join(ROOT, "src")).href)};
export async function resolve(spec, ctx, next) {
  const tries = spec.startsWith("@/") ? [SRC + spec.slice(1)] : /^\\.\\.?\\//.test(spec) && !/\\.[a-z]+$/i.test(spec) ? [spec] : null;
  if (tries) for (const base of tries) for (const ext of [".ts", ".tsx", "/index.ts"]) { try { return await next(base + ext, ctx); } catch {} }
  return next(spec, ctx);
}`)
);
const src = (p) => pathToFileURL(join(ROOT, p)).href;
const { skinTones } = await import(src("src/lib/data/skinTones.ts"));
const { skinTint, tinted } = await import(src("src/lib/mannequin/skinTint.ts"));
const { profileFor } = await import(src("src/lib/mannequin/profile.ts"));
const { bodies, BODY_CANVAS } = await import(src("src/lib/mannequin/bodies.ts"));

const ISO = 127.5;
const SOLID = 230;
/** The cut-out's own rim — a pixel or two of lighter matte at the edge — is not trusted: the colour comes from this far in. */
const RIM = 2;
const BLEED = RIM + 4;

/** The photograph's contours at half coverage, in pixel-centre coordinates: closed loops of points. */
function contours(alpha, w, h) {
  // padded by one empty pixel all round, so every contour closes
  const W = w + 2;
  const H = h + 2;
  const a = new Float32Array(W * H);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) a[(y + 1) * W + x + 1] = alpha[y * w + x];
  const at = (x, y) => a[y * W + x];
  // a crossing on the edge between two pixel centres, keyed by that edge
  const point = new Map();
  const cross = (x0, y0, x1, y1) => {
    const key = x0 === x1 ? `v${x0},${Math.min(y0, y1)}` : `h${Math.min(x0, x1)},${y0}`;
    if (!point.has(key)) {
      const v0 = at(x0, y0);
      const v1 = at(x1, y1);
      const t = (ISO - v0) / (v1 - v0);
      point.set(key, [x0 + (x1 - x0) * t - 1, y0 + (y1 - y0) * t - 1]);
    }
    return key;
  };
  const links = new Map();
  const link = (p, q) => {
    (links.get(p) ?? links.set(p, []).get(p)).push(q);
    (links.get(q) ?? links.set(q, []).get(q)).push(p);
  };
  for (let y = 0; y < H - 1; y++)
    for (let x = 0; x < W - 1; x++) {
      const tl = at(x, y) > ISO;
      const tr = at(x + 1, y) > ISO;
      const br = at(x + 1, y + 1) > ISO;
      const bl = at(x, y + 1) > ISO;
      const c = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
      if (c === 0 || c === 15) continue;
      const T = () => cross(x, y, x + 1, y);
      const R = () => cross(x + 1, y, x + 1, y + 1);
      const B = () => cross(x, y + 1, x + 1, y + 1);
      const L = () => cross(x, y, x, y + 1);
      const centre = (at(x, y) + at(x + 1, y) + at(x + 1, y + 1) + at(x, y + 1)) / 4 > ISO;
      switch (c) {
        case 1: case 14: link(L(), B()); break;
        case 2: case 13: link(B(), R()); break;
        case 3: case 12: link(L(), R()); break;
        case 4: case 11: link(T(), R()); break;
        case 6: case 9: link(T(), B()); break;
        case 7: case 8: link(L(), T()); break;
        case 5: if (centre) { link(L(), T()); link(B(), R()); } else { link(L(), B()); link(T(), R()); } break;
        case 10: if (centre) { link(T(), R()); link(L(), B()); } else { link(L(), T()); link(B(), R()); } break;
      }
    }
  const loops = [];
  const seen = new Set();
  for (const start of links.keys()) {
    if (seen.has(start)) continue;
    const loop = [];
    let prev = null;
    let cur = start;
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      loop.push(point.get(cur));
      const next = links.get(cur).find((n) => n !== prev && !seen.has(n));
      prev = cur;
      cur = next;
    }
    if (loop.length > 8) loops.push(loop);
  }
  return loops;
}

const area = (pts) => {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    s += x0 * y1 - x1 * y0;
  }
  return Math.abs(s) / 2;
};

/**
 * A Gaussian average round the loop, sigma SMOOTH points (about two pixels):
 * the cut-out's own one- to three-pixel bumps, which a crisp edge would show
 * as steps, smoothed away; anything the size of a finger kept.
 */
const SMOOTH = 3;
function smooth(pts) {
  const n = pts.length;
  const r = Math.ceil(3 * SMOOTH);
  const w = Array.from({ length: 2 * r + 1 }, (_, k) => Math.exp(-((k - r) ** 2) / (2 * SMOOTH * SMOOTH)));
  const total = w.reduce((a, b) => a + b, 0);
  return pts.map((_, i) => {
    let x = 0;
    let y = 0;
    for (let k = -r; k <= r; k++) {
      const q = pts[(i + k + n) % n];
      x += q[0] * w[k + r];
      y += q[1] * w[k + r];
    }
    return [x / total, y / total];
  });
}

/** Ramer–Douglas–Peucker on a closed loop: the points within `tol` of the line between those kept dropped. */
function thin(pts, tol) {
  const keep = new Uint8Array(pts.length);
  const rdp = (i, j) => {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[j];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1e-9;
    let far = -1;
    let at = -1;
    for (let k = i + 1; k < j; k++) {
      const d = Math.abs((pts[k][0] - x0) * dy - (pts[k][1] - y0) * dx) / len;
      if (d > far) [far, at] = [d, k];
    }
    if (far > tol) {
      keep[at] = 1;
      rdp(i, at);
      rdp(at, j);
    }
  };
  // split the loop at its first point and the point furthest from it
  let opp = 0;
  let best = -1;
  for (let k = 0; k < pts.length; k++) {
    const d = Math.hypot(pts[k][0] - pts[0][0], pts[k][1] - pts[0][1]);
    if (d > best) [best, opp] = [d, k];
  }
  keep[0] = keep[opp] = 1;
  rdp(0, opp);
  const ring = [...pts.slice(opp), pts[0]];
  const keepRing = new Uint8Array(ring.length);
  keepRing[0] = keepRing[ring.length - 1] = 1;
  const rdp2 = (i, j) => {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[j];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1e-9;
    let far = -1;
    let at = -1;
    for (let k = i + 1; k < j; k++) {
      const d = Math.abs((ring[k][0] - x0) * dy - (ring[k][1] - y0) * dx) / len;
      if (d > far) [far, at] = [d, k];
    }
    if (far > tol) {
      keepRing[at] = 1;
      rdp2(i, at);
      rdp2(at, j);
    }
  };
  rdp2(0, ring.length - 1);
  const out = pts.slice(0, opp + 1).filter((_, k) => keep[k]);
  for (let k = 1; k < ring.length - 1; k++) if (keepRing[k]) out.push(ring[k]);
  return out;
}

/** A closed loop through `pts` as cubic curves — each point's tangent along its neighbours, each handle a third of its own segment — in units, relative. */
function curve(pts, unit) {
  const n = pts.length;
  const P = pts.map(([x, y]) => [(x + 0.5) * unit, (y + 0.5) * unit]);
  const tangent = (i) => {
    const a = P[(i - 1 + n) % n];
    const b = P[(i + 1) % n];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  };
  const T = P.map((_, i) => tangent(i));
  const r = (v) => {
    const s = (Math.round(v * 100) / 100).toFixed(2).replace(/\.?0+$/, "");
    return s === "-0" ? "0" : s;
  };
  let d = `M${r(P[0][0])} ${r(P[0][1])}`;
  let [cx, cy] = [Math.round(P[0][0] * 100) / 100, Math.round(P[0][1] * 100) / 100];
  for (let i = 0; i < n; i++) {
    const p = P[i];
    const q = P[(i + 1) % n];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]) / 3;
    const c1 = [p[0] + T[i][0] * len, p[1] + T[i][1] * len];
    const c2 = [q[0] - T[(i + 1) % n][0] * len, q[1] - T[(i + 1) % n][1] * len];
    // relative to the rounded current point, so rounding never drifts along the loop
    const end = [Math.round(q[0] * 100) / 100, Math.round(q[1] * 100) / 100];
    d += `c${r(c1[0] - cx)} ${r(c1[1] - cy)} ${r(c2[0] - cx)} ${r(c2[1] - cy)} ${r(end[0] - cx)} ${r(end[1] - cy)}`;
    [cx, cy] = end;
  }
  return d + "z";
}

/** Whether each pixel is at least `r` pixels inside the solid body: the opaque pixels, eroded by a square of radius r. */
export function deepInside(rgba, w, h, r) {
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) solid[i] = rgba[i * 4 + 3] >= SOLID ? 1 : 0;
  const rows = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let all = 1;
      for (let k = -r; k <= r && all; k++) all = x + k >= 0 && x + k < w && solid[y * w + x + k] ? 1 : 0;
      rows[y * w + x] = all;
    }
  const deep = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let all = 1;
      for (let k = -r; k <= r && all; k++) all = y + k >= 0 && y + k < h && rows[(y + k) * w + x] ? 1 : 0;
      deep[y * w + x] = all;
    }
  return deep;
}

/** Inside the edge made solid: the colour from RIM pixels in carried out BLEED pixels, alpha 255 there, 0 beyond. */
function solidify(rgba, w, h) {
  const solid = deepInside(rgba, w, h, RIM);
  const out = Buffer.from(rgba);
  for (let round = 0; round < BLEED; round++) {
    const add = [];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (solid[i]) continue;
        let n = 0;
        const sum = [0, 0, 0];
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            const j = yy * w + xx;
            if (!solid[j]) continue;
            n++;
            for (let c = 0; c < 3; c++) sum[c] += out[j * 4 + c];
          }
        if (n) add.push([i, sum.map((s) => Math.round(s / n))]);
      }
    for (const [i, c] of add) {
      solid[i] = 1;
      for (let k = 0; k < 3; k++) out[i * 4 + k] = c[k];
    }
  }
  for (let i = 0; i < w * h; i++) {
    out[i * 4 + 3] = solid[i] ? 255 : 0;
    if (!solid[i]) out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = 0;
  }
  return out;
}

const outlines = {};
const manifest = {};
const outDir = join(ROOT, "public", "mannequin", "tinted");
mkdirSync(outDir, { recursive: true });
for (const body of Object.values(bodies)) {
  const file = join(ROOT, "public", body.view.front);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const unit = BODY_CANVAS.width / w;
  const alpha = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = data[i * 4 + 3];

  // the outline: every loop of a real size, as curves; holes and all, filled even-odd
  const loops = contours(alpha, w, h).filter((l) => area(l) > 4);
  outlines[body.id] = loops.map((l) => curve(thin(smooth(l), 0.3), unit)).join("");
  console.log(`${body.id}: ${loops.length} loops, ${loops.map((l) => l.length).join("+")} points traced → ${(outlines[body.id].length / 1024).toFixed(1)} KB of path`);

  // the photograph per tone, tinted exactly as the filter did, solid inside the edge
  const solid = solidify(data, w, h);
  const light = profileFor(body.id).light;
  for (const tone of skinTones) {
    const tables = skinTint(tone.color, light);
    const lut = tables.map((t) => Uint8Array.from({ length: 256 }, (_, v) => Math.round(255 * tinted(t, v / 255))));
    const px = Buffer.from(solid);
    for (let i = 0; i < w * h; i++) for (let c = 0; c < 3; c++) px[i * 4 + c] = lut[c][solid[i * 4 + c]];
    const webp = await sharp(px, { raw: { width: w, height: h, channels: 4 } }).webp({ lossless: true, effort: 4 }).toBuffer();
    const name = `${body.id}-${tone.id}`;
    writeFileSync(join(outDir, `${name}.webp`), webp);
    manifest[name] = createHash("sha256").update(webp).digest("hex").slice(0, 10);
  }
  console.log(`${body.id}: ${skinTones.length} tinted photographs`);
}

writeFileSync(
  join(ROOT, "src", "lib", "mannequin", "outline.ts"),
  `/**
 * Each mannequin's outline, traced from its photograph's alpha at half
 * coverage and drawn as curves — made by \`scripts/mannequin/tinted.mjs\`,
 * do not edit. In canvas units; fill it even-odd.
 */
import type { BodyType } from "@/types";

export const OUTLINE: Record<BodyType, string> = ${JSON.stringify(outlines, null, 2)};
`
);
writeFileSync(join(ROOT, "src", "lib", "mannequin", "tinted.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log("written: outline.ts, tinted.json,", Object.keys(manifest).length, "photographs");
