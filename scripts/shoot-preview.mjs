import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Photograph `.preview/*.html` sheets as PNGs, the whole page each.
 *
 *     npm run shoot -- .preview/skin-tones.html .preview/wardrobe/*.html
 *
 * The sheets are written by the `*.test.tsx` previews and drawn by the real
 * `MannequinStage`, so a PNG of one is what the app draws — filters, masks and
 * all. They fetch the mannequin photographs through `<base href>` from the dev
 * server on :3000, so that has to be running; a production build is never
 * needed.
 *
 * Drives a headless Chromium (Edge or Chrome, whichever is installed — or the
 * one `BROWSER` names) over the DevTools protocol, because its one-shot
 * `--screenshot` flag can only capture a window of a size given in advance.
 * Each PNG is written next to its sheet.
 */

const CANDIDATES = [
  process.env.BROWSER,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

const PORT = 9341;
const DEV_SERVER = "http://localhost:3000/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main(files) {
  if (files.length === 0) {
    console.error("usage: npm run shoot -- <sheet.html> [...]");
    process.exit(2);
  }
  try {
    await fetch(DEV_SERVER, { method: "HEAD" });
  } catch {
    console.error(`the sheets load the mannequin from ${DEV_SERVER} — start "npm run dev" first`);
    process.exit(2);
  }
  const browser = CANDIDATES.find((p) => existsSync(p));
  if (!browser) {
    console.error("no Chromium found — set BROWSER to Edge's or Chrome's executable");
    process.exit(2);
  }

  const profile = mkdtempSync(join(tmpdir(), "shoot-preview-"));
  const proc = spawn(
    browser,
    [
      "--headless=new",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--hide-scrollbars",
      "--allow-file-access-from-files",
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  try {
    const page = await connect();
    await page.send("Page.enable");
    for (const file of files) {
      const out = resolve(file).replace(/\.html$/, ".png");
      await page.send("Emulation.setDeviceMetricsOverride", {
        width: 1600,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await page.send("Page.navigate", { url: pathToFileURL(resolve(file)).href });
      await settle(page);
      // The drawing's own extent, not the window's: a sheet narrower than the
      // window would otherwise come out padded to it.
      const size = await page.eval(`(() => {
        let right = 0, bottom = 0;
        for (const el of document.body.querySelectorAll("*")) {
          // A drawing's own paths run past its frame, and a block runs the
          // window's width; what shows is each frame, and each run of text.
          if (el.ownerSVGElement) continue;
          let r;
          if (el instanceof SVGSVGElement) r = el.getBoundingClientRect();
          else if (el.children.length === 0) {
            const range = document.createRange();
            range.selectNodeContents(el);
            r = range.getBoundingClientRect();
            if (r.width === 0) r = el.getBoundingClientRect();
          } else continue;
          right = Math.max(right, r.right);
          bottom = Math.max(bottom, r.bottom);
        }
        const pad = parseFloat(getComputedStyle(document.body).paddingLeft) || 0;
        return [Math.ceil(right + pad), Math.ceil(bottom + pad)];
      })()`);
      await page.send("Emulation.setDeviceMetricsOverride", {
        width: size[0],
        height: size[1],
        deviceScaleFactor: 1,
        mobile: false,
      });
      await sleep(300);
      const shot = await page.send("Page.captureScreenshot", { format: "png" });
      writeFileSync(out, Buffer.from(shot.data, "base64"));
      console.log(`${size[0]}×${size[1]}  ${out}`);
    }
    page.close();
  } finally {
    proc.kill();
    /*
      The profile is a throwaway, made for this run: removed once the browser
      has let go of it. Left behind, one a run piled up in the temp folder —
      about 460 of them, ten gigabytes, before the disk filled.
    */
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
  const evaluate = async (expression) =>
    (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }))
      .result.value;
  return { send, eval: evaluate, close: () => ws.close() };
}

/**
 * Wait until the page has loaded and stopped fetching: the photographs are SVG
 * `<image>`s, which `document.images` does not list, so the signal is the
 * resource count holding still.
 */
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

await main(process.argv.slice(2));
