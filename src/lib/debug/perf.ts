/*
  TEMPORARY — the phone-speed round's measuring switch, `?debug=perf`
  (`?debug=off` turns it off). It must not reach release.

  Every tap is timed from the tap itself (the click's own time stamp) to:
  - "card": the end of the first frame drawn after it — when whatever was
    tapped shows its new state;
  - "figure": the end of the frame that draws the figure anew, when the tap
    changed it — split into "js", until React has put the new figure in the
    page, and the rest, the browser drawing it.
  A frame's end is read as a task run right after its animation frame: by
  then the page has laid itself out and painted.

  A pinch or a drag on the stage: its frames — how many, the typical and the
  worst gap between two, and how many took over 34 ms (a dropped frame at
  60 Hz) — and after a pinch, the redraw once the fingers lift.
  The first load: the page's own timings, then opening the visualizer, and
  until its option pictures are in.
*/

export type PerfKind =
  | "load"
  | "open"
  | "pictures"
  | "look"
  | "card"
  | "chip"
  | "option"
  | "fabric"
  | "part"
  | "filter"
  | "tab"
  | "zoom"
  | "undo"
  | "pinch"
  | "drag"
  | "other";

export interface PerfRecord {
  n: number;
  kind: PerfKind;
  label: string;
  /** Tap → the first frame after it, ms. */
  card?: number;
  /** Tap → the frame showing the new figure, ms. */
  figure?: number;
  /** Tap → React has put the new figure in the page, ms. */
  js?: number;
  /** A gesture's frames. */
  frames?: { count: number; typical: number; worst: number; slow: number };
  note?: string;
}

const KEY = "mishmishah:debug-perf";

/** Whether the switch is on: `?debug=perf` turns it on for the visit, `?debug=off` off. */
export function perfEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const q = new URLSearchParams(window.location.search).get("debug");
  try {
    if (q === "perf") sessionStorage.setItem(KEY, "1");
    if (q === "off") sessionStorage.removeItem(KEY);
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return q === "perf";
  }
}

/* ------------------------------------------------------------- the store */

let records: PerfRecord[] = [];
let count = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const subscribePerf = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const perfRecords = () => records;
export function clearPerf() {
  records = [];
  count = 0;
  current = null;
  emit();
}

const add = (r: Omit<PerfRecord, "n">): PerfRecord => {
  const rec = { ...r, n: ++count };
  records = [...records, rec];
  emit();
  return rec;
};
const update = (n: number, patch: Partial<PerfRecord>) => {
  records = records.map((r) => (r.n === n ? { ...r, ...patch } : r));
  emit();
};

/** At the end of the next frame: a task run right after its animation frame, by when it has been laid out and painted. */
const afterFrame = (cb: (t: number) => void) =>
  requestAnimationFrame(() => setTimeout(() => cb(performance.now()), 0));

const ms = (v: number) => Math.round(v);

/* ------------------------------------------------------------------ taps */

/** The action being timed: the last tap, until the next one or a few seconds. */
let current: { n: number; t0: number } | null = null;
/** How long after a tap a redraw of the figure still counts as its own. */
const WINDOW = 6000;

const isDialogOpen = () => !!document.querySelector("[role=dialog]");

function classify(el: Element, wasOpen: boolean): PerfKind {
  if (!wasOpen) return "open";
  if (el.getAttribute("role") === "tab") return "tab";
  if (el.closest(".grid-cols-3")) return "fabric";
  const cat = el.closest("[data-perf-cat]")?.getAttribute("data-perf-cat");
  if (cat === "looks") return "look";
  if (cat) return "card";
  if (el.hasAttribute("data-on")) return "chip";
  if (el.closest("[data-perf=stage]")) {
    const text = (el.textContent ?? "").trim();
    if (/×$/.test(text) || el.querySelector("svg.lucide-maximize2")) return "zoom";
    if (/undo|redo|تراجع|إعادة/i.test(el.getAttribute("aria-label") ?? "")) return "undo";
    return "other";
  }
  if (el.getAttribute("aria-expanded") !== null && el.closest("section")) return "filter";
  const group = el.closest("[role=group]");
  if (group && group.closest("section")) return /اللون|نوع|النقشة|Color|type|Pattern/.test(group.getAttribute("aria-label") ?? "") ? "filter" : "option";
  if (el.closest("section")) return "part";
  return "other";
}

const labelOf = (el: Element) =>
  (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 26);

function onClick(e: MouseEvent) {
  const el = (e.target as Element | null)?.closest?.("button, a, [role=tab]");
  // the overlay's own buttons are not actions
  if (!el || el.closest("[data-perf-ui]")) return;
  const now = performance.now();
  // the click's own time, in the same clock, when the browser gives a sane one
  const t0 = e.timeStamp > 0 && e.timeStamp <= now && now - e.timeStamp < 1000 ? e.timeStamp : now;
  const wasOpen = isDialogOpen();
  const kind = classify(el, wasOpen);
  if (kind === "open" && !/visuali|معاينة|جرّب|Try/i.test(labelOf(el))) return; // a link elsewhere on the page
  const rec = add({ kind, label: labelOf(el) });
  current = { n: rec.n, t0 };
  afterFrame((t) => {
    if (kind === "open" && !isDialogOpen()) {
      records = records.filter((r) => r.n !== rec.n);
      emit();
      return;
    }
    update(rec.n, { card: ms(t - t0) });
    if (kind === "open") watchPictures(t0);
  });
}

/** The stage was given a new figure — called from the visualizer's commit. */
export function perfStage() {
  if (!enabled) return;
  const now = performance.now();
  const target = afterPinch ?? current;
  if (!target || now - target.t0 > WINDOW) return;
  const { n, t0 } = target;
  update(n, { js: ms(now - t0) });
  afterFrame((t) => update(n, { figure: ms(t - t0) }));
}

/** After opening: until every option picture in the panel is loaded and decoded. */
function watchPictures(t0: number) {
  const rec = add({ kind: "pictures", label: "option pictures" });
  const tick = () => {
    const imgs = [...document.querySelectorAll<HTMLImageElement>("[role=dialog] section img")];
    if (imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0)) {
      Promise.all(imgs.map((i) => i.decode().catch(() => undefined))).then(() =>
        afterFrame((t) => update(rec.n, { figure: ms(t - t0), note: `${imgs.length} pictures` }))
      );
      return;
    }
    if (performance.now() - t0 > 15000) return update(rec.n, { note: "not all in after 15 s" });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* -------------------------------------------------------------- gestures */

let gesture: {
  pointers: Map<number, [number, number]>;
  start: Map<number, [number, number]>;
  kind: "drag" | "pinch";
  moved: boolean;
  last: number;
  gaps: number[];
  raf: number;
  redrawn: boolean;
} | null = null;
let afterPinch: { n: number; t0: number } | null = null;

const onStage = (e: PointerEvent) => {
  const el = e.target as Element | null;
  return !!el?.closest?.("[data-perf=stage]") && !el.closest("button, a, [role=group], [role=menu]");
};

function frameLoop(t: number) {
  if (!gesture) return;
  if (gesture.moved) gesture.gaps.push(t - gesture.last);
  gesture.last = t;
  gesture.raf = requestAnimationFrame(frameLoop);
}

function onDown(e: PointerEvent) {
  if (!onStage(e)) return;
  if (!gesture) {
    gesture = { pointers: new Map(), start: new Map(), kind: "drag", moved: false, last: performance.now(), gaps: [], raf: 0, redrawn: false };
    gesture.raf = requestAnimationFrame(frameLoop);
  }
  gesture.pointers.set(e.pointerId, [e.clientX, e.clientY]);
  gesture.start.set(e.pointerId, [e.clientX, e.clientY]);
  if (gesture.pointers.size >= 2) gesture.kind = "pinch";
}

function onMove(e: PointerEvent) {
  if (!gesture || !gesture.pointers.has(e.pointerId)) return;
  const s = gesture.start.get(e.pointerId)!;
  if (Math.hypot(e.clientX - s[0], e.clientY - s[1]) > 4) gesture.moved = true;
}

function onUp(e: PointerEvent) {
  if (!gesture || !gesture.pointers.has(e.pointerId)) return;
  gesture.pointers.delete(e.pointerId);
  if (gesture.pointers.size > 0) return;
  const g = gesture;
  gesture = null;
  cancelAnimationFrame(g.raf);
  if (!g.moved || g.gaps.length < 3) return;
  const sorted = [...g.gaps].sort((a, b) => a - b);
  const frames = {
    count: sorted.length,
    typical: ms(sorted[Math.floor(sorted.length / 2)]),
    worst: ms(sorted[sorted.length - 1]),
    slow: sorted.filter((v) => v > 34).length,
  };
  const rec = add({ kind: g.kind, label: g.kind === "pinch" ? "two fingers" : "one finger", frames });
  // a pinch is redrawn sharp once the fingers lift: timed from the lift
  if (g.kind === "pinch") {
    afterPinch = { n: rec.n, t0: performance.now() };
    setTimeout(() => (afterPinch = null), WINDOW);
  }
}

/* ----------------------------------------------------------------- start */

let enabled = false;
let started = false;

/** The page's own load timings, read once it has loaded. */
function recordLoad(hydrated: number) {
  const read = () => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime;
    const js = performance
      .getEntriesByType("resource")
      .filter((r) => /\.js(\?|$)/.test(r.name)) as PerformanceResourceTiming[];
    const kb = Math.round(js.reduce((s, r) => s + (r.encodedBodySize || r.transferSize || 0), 0) / 1024);
    const parts = [
      nav ? `first byte ${ms(nav.responseStart)}` : null,
      fcp ? `first paint ${ms(fcp)}` : null,
      `ready ${ms(hydrated)}`,
      nav && nav.loadEventEnd ? `loaded ${ms(nav.loadEventEnd)}` : null,
      kb ? `JS ${js.length} files ${kb} KB` : `JS ${js.length} files`,
    ].filter(Boolean);
    add({ kind: "load", label: "page", note: parts.join(" · ") });
  };
  if (document.readyState === "complete") setTimeout(read, 0);
  else window.addEventListener("load", () => setTimeout(read, 0), { once: true });
}

/** Turn the measuring on — once, after the page has hydrated. */
export function startPerf() {
  if (started || !perfEnabled()) return;
  started = enabled = true;
  recordLoad(performance.now());
  document.addEventListener("click", onClick, true);
  document.addEventListener("pointerdown", onDown, { capture: true, passive: true });
  document.addEventListener("pointermove", onMove, { capture: true, passive: true });
  document.addEventListener("pointerup", onUp, { capture: true, passive: true });
  document.addEventListener("pointercancel", onUp, { capture: true, passive: true });
  // for the scripted runs: read the records, clear them
  (window as unknown as { __perf: unknown }).__perf = { records: () => records, clear: clearPerf };
}
