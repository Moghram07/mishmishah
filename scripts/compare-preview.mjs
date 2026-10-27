import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Before/after sheets for garment work.
 *
 *     node scripts/compare-preview.mjs round1 male-thobe female-blouse ...
 *     npm run shoot -- .preview/wardrobe/compare/*.html .preview/wardrobe/round1.html
 *
 * Pairs `.preview/wardrobe/before/<id>.png` — copied there before the work
 * started — with the current `.preview/wardrobe/<id>.png`, one sheet per
 * garment in `compare/` and every garment on one sheet named after the round.
 * The renders themselves come from `look.test.tsx` and `npm run shoot`.
 */

const [round, ...ids] = process.argv.slice(2);
if (!round || ids.length === 0) {
  console.error("usage: node scripts/compare-preview.mjs <round> <garment-id> [...]");
  process.exit(2);
}

const DIR = join(".preview", "wardrobe");
mkdirSync(join(DIR, "compare"), { recursive: true });
for (const id of ids) {
  for (const f of [join(DIR, "before", `${id}.png`), join(DIR, `${id}.png`)]) {
    if (!existsSync(f)) {
      console.error(`missing ${f}`);
      process.exit(1);
    }
  }
}

const css =
  "<style>body{margin:0;padding:14px;background:#efeae4;font:13px system-ui;color:#333}" +
  "h2{font-size:14px;margin:4px 0 8px}.pair{display:flex;gap:14px;margin-bottom:18px}" +
  "figure{margin:0}figcaption{font-weight:600;margin-bottom:4px}img{display:block;width:620px;border-radius:8px}</style>";
const pair = (id, prefix) =>
  `<h2>${id}</h2><div class="pair">` +
  `<figure><figcaption>Before</figcaption><img src="${prefix}before/${id}.png"></figure>` +
  `<figure><figcaption>After</figcaption><img src="${prefix}${id}.png"></figure></div>`;

for (const id of ids) {
  writeFileSync(join(DIR, "compare", `${id}.html`), `<!doctype html><meta charset="utf-8">${css}${pair(id, "../")}`);
}
writeFileSync(
  join(DIR, `${round}.html`),
  `<!doctype html><meta charset="utf-8">${css}<h1 style="font-size:16px">${round}</h1>${ids.map((id) => pair(id, "")).join("")}`
);
console.log(`wrote ${ids.length} pairs and ${join(DIR, `${round}.html`)}`);
