import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

/**
 * The phone panel's option pictures, photographed from the real drawing.
 *
 *     SHEETS=1 npx vitest run src/components/visualizer/optionPictures.test.tsx
 *     node scripts/option-pictures.mjs
 *
 * The test draws every option on its garment into one sheet
 * (`.preview/option-pictures/sheet.html`, see `lib/visualizer/pictureRecipes.ts`)
 * with each drawing's hash beside it; this shows each figure on its own in a
 * headless Edge or Chrome, photographs it on a clear background, and writes
 * it as a small WebP to `public/options/<garment>/<kind>-<option>.webp`, then
 * the manifest the app reads (`lib/visualizer/optionPictures.json`): each
 * picture's own hash, for its URL, and the drawing's, for the test.
 *
 * Only pictures that are new, or whose drawing changed, are photographed
 * again (`--all` for every one): the rest keep their files and hashes, so a
 * phone that has them keeps them.
 *
 * The sheet fetches the mannequin photographs from the dev server on :3000,
 * as every preview sheet does. WebP through `sharp`, which Next installs.
 */

const SHEET = ".preview/option-pictures/sheet.html";
const DRAWN = ".preview/option-pictures/drawn.json";
const OUT = "public/options";
const MANIFEST = "src/lib/visualizer/optionPictures.json";
const SIZE = [240, 200];
/** Picked by eye and by weight: no visible blocking at the card's size, a few kilobytes each. */
const WEBP = { quality: 78, alphaQuality: 90, effort: 6, smartSubsample: true };

const CANDIDATES = [
  process.env.BROWSER,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

const PORT = 9343;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hash = (buf, n) => createHash("sha256").update(buf).digest("hex").slice(0, n);

async function main() {
  if (!existsSync(SHEET) || !existsSync(DRAWN)) {
    console.error(`no sheet — run: SHEETS=1 npx vitest run src/components/visualizer/optionPictures.test.tsx`);
    process.exit(2);
  }
  try {
    await fetch("http://localhost:3000/", { method: "HEAD" });
  } catch {
    console.error('the sheet loads the mannequin from http://localhost:3000/ — start "npm run dev" first');
    process.exit(2);
  }
  const browser = CANDIDATES.find((p) => existsSync(p));
  if (!browser) {
    console.error("no Chromium found — set BROWSER to Edge's or Chrome's executable");
    process.exit(2);
  }
  const drawn = JSON.parse(readFileSync(DRAWN, "utf8"));
  const keys = Object.keys(drawn).sort();
  const before = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
  const all = process.argv.includes("--all");
  const keep = (key) => !all && before[key]?.drawn === drawn[key] && existsSync(join(OUT, `${key}.webp`));

  const profile = mkdtempSync(join(tmpdir(), "option-pictures-"));
  const proc = spawn(
    browser,
    ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "--hide-scrollbars", "--allow-file-access-from-files", "about:blank"],
    { stdio: "ignore" }
  );
  const manifest = {};
  for (const key of keys) if (keep(key)) manifest[key] = before[key];
  const todo = keys.filter((key) => !keep(key));
  console.log(`${todo.length} to photograph, ${keys.length - todo.length} unchanged`);
  try {
    const page = await connect();
    await page.send("Page.enable");
    await page.send("Emulation.setDeviceMetricsOverride", { width: SIZE[0], height: SIZE[1], deviceScaleFactor: 1, mobile: false });
    await page.send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
    await page.send("Page.navigate", { url: pathToFileURL(resolve(SHEET)).href });
    await settle(page);
    // one figure at a time: a page of them all at once runs past the raster budget and drops tiles
    await page.eval(`(() => { for (const f of document.querySelectorAll("figure")) f.style.display = "none"; })()`);
    let n = 0;
    for (const key of todo) {
      const shown = await page.eval(`(() => {
        for (const f of document.querySelectorAll("figure[data-on]")) { f.style.display = "none"; f.removeAttribute("data-on"); }
        const f = document.getElementById(${JSON.stringify(key)});
        if (!f) return false;
        f.style.display = "block"; f.setAttribute("data-on", "");
        return true;
      })()`);
      if (!shown) throw new Error(`${key} is not on the sheet`);
      await sleep(120);
      // twice, and the second kept: the first frame after showing a figure can still be painting its masks
      await page.send("Page.captureScreenshot", { format: "png" });
      await sleep(60);
      const shot = Buffer.from((await page.send("Page.captureScreenshot", { format: "png" })).data, "base64");
      const webp = await sharp(shot).webp(WEBP).toBuffer();
      const file = join(OUT, `${key}.webp`);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, webp);
      manifest[key] = { v: hash(webp, 8), drawn: drawn[key] };
      if (++n % 20 === 0) console.log(`${n}/${todo.length}`);
    }
    page.close();
  } finally {
    proc.kill();
    await new Promise((done) => {
      proc.once("exit", done);
      setTimeout(done, 3000);
    });
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    } catch (e) {
      console.warn(`could not remove the browser profile ${profile}: ${e.message}`);
    }
  }

  // pictures of options no longer offered go
  for (const f of readdirSync(OUT, { recursive: true })) {
    const path = join(OUT, String(f));
    if (!String(f).endsWith(".webp")) continue;
    const key = relative(OUT, path).replace(/\\/g, "/").replace(/\.webp$/, "");
    if (!manifest[key]) unlinkSync(path);
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + "\n");
  const total = Object.keys(manifest).reduce((s, k) => s + readFileSync(join(OUT, `${k}.webp`)).length, 0);
  console.log(`${keys.length} pictures, ${(total / 1024).toFixed(0)} KB in all → ${OUT}, ${MANIFEST}`);
}

/** The first page target, over its DevTools websocket. */
async function connect() {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      target = list.find((t) => t.type === "page");
    } catch {
      // not up yet
    }
  }
  if (!target) throw new Error("the browser never opened a page");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, fail) => {
    ws.onopen = ok;
    ws.onerror = fail;
  });
  let id = 0;
  const waiting = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    const done = waiting.get(msg.id);
    if (!done) return;
    waiting.delete(msg.id);
    if (msg.error) done.fail(new Error(msg.error.message));
    else done.ok(msg.result);
  };
  const send = (method, params = {}) =>
    new Promise((ok, fail) => {
      waiting.set(++id, { ok, fail });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;
  return { send, eval: evaluate, close: () => ws.close() };
}

/** Until the page has loaded and stopped fetching (the photographs are SVG images, not in `document.images`). */
async function settle(page) {
  for (let i = 0; i < 100; i++) {
    if ((await page.eval("document.readyState")) === "complete") break;
    await sleep(100);
  }
  let last = -1;
  for (let i = 0; i < 40; i++) {
    const n = await page.eval("performance.getEntriesByType('resource').length");
    if (n === last) break;
    last = n;
    await sleep(400);
  }
  await sleep(500);
}

await main();
