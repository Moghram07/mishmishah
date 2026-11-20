import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { skinTones } from "@/lib/data/skinTones";
import { bodies } from "./bodies";
import { profileFor } from "./profile";
import { skinTint, tinted } from "./skinTint";
import { OUTLINE } from "./outline";
import { TINTED, tintedPhoto } from "./tinted";

const PUBLIC = join(process.cwd(), "public");

/** The body at least `r` pixels in from its edge (alpha 230 and over): what the photograph keeps as it is — the script's own rule. */
function deepInside(alpha: (i: number) => number, w: number, h: number, r: number) {
  const rows = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let all = true;
      for (let k = -r; k <= r && all; k++) all = x + k >= 0 && x + k < w && alpha(y * w + x + k) >= 230;
      rows[y * w + x] = all ? 1 : 0;
    }
  const deep = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let all = true;
      for (let k = -r; k <= r && all; k++) all = y + k >= 0 && y + k < h && rows[(y + k) * w + x] === 1;
      deep[y * w + x] = all ? 1 : 0;
    }
  return deep;
}
const remake = "remake them: node --experimental-strip-types --no-warnings scripts/mannequin/tinted.mjs";

describe("the mannequin photographs, tinted once and outlined", () => {
  it("has every body in every tone on disk, each URL carrying its file's own hash, and an outline per body", () => {
    for (const body of Object.values(bodies)) {
      expect(OUTLINE[body.id], `${body.id}'s outline`).toMatch(/^M[\d.]+ [\d.]+c.*z$/);
      for (const tone of skinTones) {
        const url = tintedPhoto(body.id, tone.id);
        const file = join(PUBLIC, url.split("?")[0]);
        expect(existsSync(file), `${body.id} ${tone.id} missing — ${remake}`).toBe(true);
        const hash = createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 10);
        expect(url, `${body.id} ${tone.id} changed since its hash — ${remake}`).toBe(`/mannequin/tinted/${body.id}-${tone.id}.webp?v=${hash}`);
      }
    }
    expect(Object.keys(TINTED)).toHaveLength(Object.keys(bodies).length * skinTones.length);
  });

  it("is the photograph tinted by the very curve the filter used: every pixel of the body, two in from its edge", async () => {
    for (const body of Object.values(bodies)) {
      const grey = await sharp(join(PUBLIC, body.view.front)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      // the edge's own colours come from further in (the cut-out's rim is not trusted): the rest is the photograph's
      const deep = deepInside((i) => grey.data[i * 4 + 3], grey.info.width, grey.info.height, 2);
      for (const tone of [skinTones[0], skinTones[skinTones.length - 1]]) {
        const tables = skinTint(tone.color, profileFor(body.id).light);
        const file = join(PUBLIC, tintedPhoto(body.id, tone.id).split("?")[0]);
        const out = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        expect([out.info.width, out.info.height]).toEqual([grey.info.width, grey.info.height]);
        let checked = 0;
        let worst = 0;
        for (let i = 0; i < grey.info.width * grey.info.height; i++) {
          if (!deep[i]) continue;
          for (let c = 0; c < 3; c++) {
            const want = Math.round(255 * tinted(tables[c], grey.data[i * 4 + c] / 255));
            worst = Math.max(worst, Math.abs(out.data[i * 4 + c] - want));
          }
          checked++;
        }
        expect(checked, `${body.id}: opaque pixels`).toBeGreaterThan(100_000);
        expect(worst, `${body.id} ${tone.id}: off the curve`).toBe(0);
      }
    }
  });
});
