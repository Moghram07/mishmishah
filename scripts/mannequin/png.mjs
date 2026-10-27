import { deflateSync, inflateSync } from "node:zlib";

/** Minimal RGBA PNG encoder — enough to write a cut-out with real alpha. */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/**
 * Filter one scanline five ways and keep the cheapest, the heuristic the PNG
 * spec itself suggests. On smooth gradients it roughly halves the file.
 */
function filterRow(row, prev, bpp, out) {
  const n = row.length;
  let best = null;
  let bestScore = Infinity;

  for (let type = 0; type < 5; type++) {
    const buf = Buffer.allocUnsafe(n);
    let score = 0;
    for (let i = 0; i < n; i++) {
      const a = i >= bpp ? row[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v;
      switch (type) {
        case 0: v = row[i]; break;
        case 1: v = row[i] - a; break;
        case 2: v = row[i] - b; break;
        case 3: v = row[i] - ((a + b) >> 1); break;
        default: v = row[i] - paeth(a, b, c);
      }
      v &= 0xff;
      buf[i] = v;
      score += v < 128 ? v : 256 - v;
    }
    if (score < bestScore) {
      bestScore = score;
      best = { type, buf };
    }
  }
  out.push(Buffer.from([best.type]), best.buf);
}

/** Encode an RGBA byte buffer (`width * height * 4`) as a PNG. */
export function encodePng(rgba, width, height) {
  const bpp = 4;
  const stride = width * bpp;
  const parts = [];
  let prev = Buffer.alloc(stride);

  for (let y = 0; y < height; y++) {
    const row = rgba.subarray(y * stride, (y + 1) * stride);
    filterRow(row, prev, bpp, parts);
    prev = row;
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(parts), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * Un-filter an 8-bit RGBA PNG into raw pixels.
 *
 * Enough of a decoder to answer "what is in this file?", which is all either
 * caller needs. Because both read the file rather than the model that produced
 * it, a photograph dropped into the same slot is measured exactly as
 * thoroughly as anything generated — which is the whole reason the body is a
 * photograph now.
 */
export function decodePngRgba(buffer) {
  let pos = 8; // past the signature
  let width = 0;
  let height = 0;
  const idat = [];

  while (pos < buffer.length) {
    const length = buffer.readUInt32BE(pos);
    const type = buffer.toString("ascii", pos + 4, pos + 8);
    const data = buffer.subarray(pos + 8, pos + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) {
        throw new Error("Expected a non-interlaced 8-bit RGBA PNG");
      }
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    pos += 12 + length;
  }

  const raw = inflateSync(Buffer.concat(idat));
  const bpp = 4;
  const stride = width * bpp;
  const rgba = Buffer.alloc(width * height * bpp);
  let prev = Buffer.alloc(stride);
  let at = 0;

  for (let y = 0; y < height; y++) {
    const filter = raw[at++];
    const row = Buffer.from(raw.subarray(at, at + stride));
    at += stride;

    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? row[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      switch (filter) {
        case 1: row[i] = (row[i] + a) & 0xff; break;
        case 2: row[i] = (row[i] + b) & 0xff; break;
        case 3: row[i] = (row[i] + ((a + b) >> 1)) & 0xff; break;
        case 4: row[i] = (row[i] + paeth(a, b, c)) & 0xff; break;
        default: break;
      }
    }
    row.copy(rgba, y * stride);
    prev = row;
  }

  return { width, height, rgba };
}

/**
 * Just the alpha channel — the cut-out's silhouette.
 *
 * Every anchor, seam and coverage measurement in this project is taken from
 * this and nothing else, which is why a file whose background is *white* rather
 * than transparent is so dangerous: it measures the rectangle instead of the
 * body, silently and without failing anything.
 */
export function decodePngAlpha(buffer) {
  const { width, height, rgba } = decodePngRgba(buffer);
  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];
  return { width, height, alpha };
}
