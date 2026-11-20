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

  it("is the photograph tinted by the very curve the filter used: every opaque pixel, every tone", async () => {
    for (const body of Object.values(bodies)) {
      const grey = await sharp(join(PUBLIC, body.view.front)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      for (const tone of [skinTones[0], skinTones[skinTones.length - 1]]) {
        const tables = skinTint(tone.color, profileFor(body.id).light);
        const file = join(PUBLIC, tintedPhoto(body.id, tone.id).split("?")[0]);
        const out = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        expect([out.info.width, out.info.height]).toEqual([grey.info.width, grey.info.height]);
        let checked = 0;
        let worst = 0;
        for (let i = 0; i < grey.info.width * grey.info.height; i++) {
          // the body itself: opaque in the photograph — its edge is the outline's now
          if (grey.data[i * 4 + 3] < 255) continue;
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
