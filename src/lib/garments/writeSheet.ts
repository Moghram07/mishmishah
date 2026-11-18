import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * A preview sheet, from a test that draws one — whole outfits, products,
 * collars, laid out for an eye to judge (see `look.test.tsx`).
 *
 * Every test run draws every sheet: that is the test — every look on the
 * stage renders, and draws something. Only when images are being made
 * (`SHEETS=1 npx vitest run <file> -t "<describe>"`; PowerShell
 * `$env:SHEETS=1`) is the sheet written to `.preview`, nearly a gigabyte of
 * HTML across them all. An ordinary run writes nothing.
 */
export function writeSheet(path: string, html: string): void {
  if (!html.includes("<svg") && !html.includes("<SVG")) throw new Error(`${path}: the sheet drew nothing`);
  if (!process.env.SHEETS) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, html);
}
