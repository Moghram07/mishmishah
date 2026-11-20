/**
 * Every filter and mask on the stage limited to what is on screen.
 *
 * A close-up shows a small window of the figure, but each filter and mask
 * still worked over its whole region: the canvas-wide ones over the whole
 * canvas, each piece's over the whole piece. At the neckline's 3× zoom that
 * is several times the pixels on screen, in every one of them — most of the
 * time a redraw took, on a phone.
 *
 * Limited, each one works on the view and a margin round it, and nothing on
 * screen changes. Four rules make it pixel-identical, each found measuring
 * WebKit (Safari's engine) pixel by pixel:
 *
 * 1. The margin is twice the furthest any filter on the stage reaches —
 *    every blur 3.5 of its sigma, an erosion its radius, an offset its shift,
 *    a displacement half its scale, lighting one unit, added up per filter —
 *    and it is the same for every filter and mask: a mask clips what is
 *    drawn inside it, filters and all, so a blur inside a mask needs the
 *    margin too, and one blur nested in another adds its reach to it. At
 *    once the reach, 3 of 45 stages still differed in a pixel or two; at
 *    twice, none.
 * 2. A cut edge moves by whole device pixels from the region's own corner.
 *    WebKit lays a region's buffer out on whole pixels from that corner; cut
 *    a fraction of a pixel off it, hard edges moved by up to 77 levels.
 * 3. A filter in box units is limited only where one element uses it. Each
 *    element takes its own box's region; one shared region, cut, would be
 *    the union of them all, and one element's blur then showed where its own
 *    region used to stop it — 4,911 pixels of a thobe at 4×. Giving each
 *    element a copy of its own fixed that, but changed something else: WebKit
 *    keeps one result of a filter shared by two elements, and a copy made it
 *    draw both afresh — up to 59 levels along an abaya's folds. So a shared
 *    filter is left as it is.
 * 4. What cannot be made identical is left as it is: anything drawn inside a
 *    turned group (its region is in turned units), anything whose region or
 *    primitives are not plain user units, and what the caller names — the
 *    two drawn straight from the mannequin photograph, which WebKit resamples
 *    differently in a smaller buffer.
 *
 * Only an attribute whose value changes is written. What React drew is
 * remembered off the page, attribute by attribute: a value React changes
 * after a cut is taken as its own, and whatever is no longer cut — out of
 * the margin's reach, shared, turned — goes back exactly as React drew it.
 */

/** One filter primitive, as far as its reach goes. */
export interface PrimitiveSpec {
  tag: string;
  stdDeviation?: string | null;
  radius?: string | null;
  dx?: string | null;
  dy?: string | null;
  scale?: string | null;
  order?: string | null;
}

const numbers = (v: string | null | undefined) =>
  (v ?? "")
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n));

/**
 * How far a filter reaches past the pixels it is given, in user units — or
 * Infinity for a primitive whose output depends on the region itself (a tile).
 */
export function filterReach(primitives: readonly PrimitiveSpec[]): number {
  let reach = 1;
  for (const p of primitives) {
    const tag = p.tag.toLowerCase();
    if (tag === "fegaussianblur") reach += 3.5 * Math.max(0, ...numbers(p.stdDeviation));
    else if (tag === "femorphology") reach += Math.max(0, ...numbers(p.radius));
    else if (tag === "feoffset") reach += Math.hypot(numbers(p.dx)[0] ?? 0, numbers(p.dy)[0] ?? 0);
    else if (tag === "fedisplacementmap") reach += (numbers(p.scale)[0] ?? 0) / 2;
    else if (tag === "fediffuselighting" || tag === "fespecularlighting") reach += 1;
    else if (tag === "feconvolvematrix") reach += Math.max(3, ...numbers(p.order));
    else if (tag === "fetile") return Infinity;
  }
  return reach;
}

export type Box = readonly [x0: number, y0: number, x1: number, y1: number];

/**
 * A region cut to the view and its margin, the cut edges on the screen's
 * pixel grid; an edge the cut does not reach stays exactly where it was.
 * Null when nothing is left to draw.
 */
export function limitedRegion(region: Box, view: Box, margin: number, devicePxPerUnit: number, grid: "screen" | "region" = "region"): Box | null {
  const s = devicePxPerUnit;
  const want: Box = [view[0] - margin, view[1] - margin, view[2] + margin, view[3] + margin];
  // the grid the cut corners keep to: the screen's pixels, or whole pixels from the region's own corner
  const [gx, gy] = grid === "screen" ? [view[0], view[1]] : [region[0], region[1]];
  const x0 = region[0] < want[0] ? gx + Math.floor((want[0] - gx) * s) / s : region[0];
  const y0 = region[1] < want[1] ? gy + Math.floor((want[1] - gy) * s) / s : region[1];
  const x1 = region[2] > want[2] ? gx + Math.ceil((want[2] - gx) * s) / s : region[2];
  const y1 = region[3] > want[3] ? gy + Math.ceil((want[3] - gy) * s) / s : region[3];
  // snapped outward, an edge may pass the original: keep the original then
  const box: Box = [Math.max(x0, region[0]), Math.max(y0, region[1]), Math.min(x1, region[2]), Math.min(y1, region[3])];
  return box[2] > box[0] && box[3] > box[1] ? box : null;
}

/* ------------------------------------------------------------- the stage */

const ATTRS = ["x", "y", "width", "height"] as const;

/** A region as it stands on the element — units, x, y, width, height; null where an attribute is absent. */
type Region = (string | null)[];

const names = (def: Element) => [def.tagName.toLowerCase() === "mask" ? "maskUnits" : "filterUnits", ...ATTRS];
const read = (def: Element): Region => names(def).map((n) => def.getAttribute(n));
const same = (a: Region, b: Region) => a.every((v, i) => v === b[i]);

/**
 * Each filter and mask written to: what React drew there, and what was
 * written over it — kept off the page.
 */
const memory = new WeakMap<Element, { drawn: Region; wrote: Region }>();

/** The region as React drew it: React's value wherever an attribute still holds what was written over it. */
function drawnOf(def: Element): Region {
  const now = read(def);
  const kept = memory.get(def);
  return kept ? now.map((v, i) => (v === kept.wrote[i] ? kept.drawn[i] : v)) : now;
}

/** Give the element region `next`, touching only the attributes that differ. */
function put(def: Element, drawn: Region, next: Region) {
  const n = names(def);
  next.forEach((v, i) => {
    if (def.getAttribute(n[i]) === v) return;
    if (v === null) def.removeAttribute(n[i]);
    else def.setAttribute(n[i], v);
  });
  if (same(next, drawn)) memory.delete(def);
  else memory.set(def, { drawn, wrote: next });
}

/** How many of the stage's filters and masks are cut to the view right now. */
export function limitedCount(svg: SVGSVGElement): number {
  return [...svg.querySelectorAll("filter, mask")].filter((def) => memory.has(def)).length;
}

/** Every filter and mask of `svg` back exactly as React drew it. */
export function unlimit(svg: SVGSVGElement): void {
  for (const def of svg.querySelectorAll("filter, mask")) {
    if (!memory.has(def)) continue;
    const drawn = drawnOf(def);
    put(def, drawn, drawn);
  }
}

const NUMBER = /^\s*[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?\s*$/i;
/** A plain number of user units; NaN for anything else (a percentage, a unit, nothing). */
const plain = (v: string | null) => (v !== null && NUMBER.test(v) ? Number(v) : NaN);
/** A fraction of a box from an objectBoundingBox attribute — "-12%" or "-0.12", the spec's default when absent; NaN for anything else. */
const fraction = (v: string | null, fallback: number) => {
  if (v === null) return fallback;
  const pct = v.trim().endsWith("%");
  return plain(pct ? v.trim().slice(0, -1) : v) / (pct ? 100 : 1);
};

/** Limit every filter and mask of `svg` to its view. `skip` names those to leave as they are. */
export function limitToView(svg: SVGSVGElement, skip: ReadonlySet<string>): void {
  const vb = svg.viewBox?.baseVal;
  const cssWidth = svg.clientWidth;
  // content drawn again elsewhere through <use> is drawn in that place's units: leave the stage as it is
  if (!vb || !vb.width || !vb.height || !cssWidth || svg.querySelector("use")) return unlimit(svg);
  const s = (cssWidth / vb.width) * (window.devicePixelRatio || 1);
  const view: Box = [vb.x, vb.y, vb.x + vb.width, vb.y + vb.height];

  const defs = [...svg.querySelectorAll("filter, mask")];
  const filters = defs.filter((d) => d.tagName.toLowerCase() === "filter");
  let margin = 1;
  const unsafe = new Set<string>();
  for (const f of filters) {
    const prims = [...f.children].map((p) => ({
      tag: p.tagName,
      stdDeviation: p.getAttribute("stdDeviation"),
      radius: p.getAttribute("radius"),
      dx: p.getAttribute("dx"),
      dy: p.getAttribute("dy"),
      scale: p.getAttribute("scale"),
      order: p.getAttribute("order"),
    }));
    const r = filterReach(prims);
    // a region-relative primitive, or primitives in box units: never limited
    const relative =
      f.getAttribute("primitiveUnits") === "objectBoundingBox" ||
      [...f.children].some((p) => p.tagName.toLowerCase() === "feimage" && ATTRS.some((a) => !p.hasAttribute(a)));
    if (!Number.isFinite(r) || relative) unsafe.add(f.id);
    else margin = Math.max(margin, r);
  }

  /* each def's users, and whether any is drawn turned — directly, or inside a mask some turned element uses */
  const users = new Map<string, Element[]>();
  for (const el of svg.querySelectorAll("[filter], [mask]")) {
    for (const attr of ["filter", "mask"]) {
      const ref = /url\(#([^)]+)\)/.exec(el.getAttribute(attr) ?? "")?.[1];
      if (ref) users.set(ref, [...(users.get(ref) ?? []), el]);
    }
  }
  const turnedMemo = new Map<Element, boolean>();
  const turned = (el: Element, depth = 0): boolean => {
    if (depth > 8) return true;
    const known = turnedMemo.get(el);
    if (known !== undefined) return known;
    let result = false;
    for (let p: Element | null = el; p && p !== svg; p = p.parentElement) {
      const tag = p.tagName.toLowerCase();
      if (p !== el && tag === "mask") {
        result = (users.get(p.id) ?? []).some((u) => turned(u, depth + 1));
        break;
      }
      // a pattern's, a marker's or a symbol's content is drawn in units of its own
      if (p.hasAttribute("transform") || tag === "pattern" || tag === "marker" || tag === "symbol") {
        result = true;
        break;
      }
    }
    turnedMemo.set(el, result);
    return result;
  };
  const inMask = (el: Element) => {
    for (let p: Element | null = el.parentElement; p && p !== svg; p = p.parentElement) if (p.tagName.toLowerCase() === "mask") return true;
    return false;
  };

  /** The region `def` is cut to — or null, to leave it as React drew it. */
  const cutOf = (def: Element, drawn: Region): Region | null => {
    if (skip.has(def.id) || unsafe.has(def.id)) return null;
    const of = users.get(def.id);
    if (!of?.length || of.some((u) => turned(u))) return null;
    const [units, ...values] = drawn;
    let region: Box;
    if (units === "userSpaceOnUse") {
      const [x, y, w, h] = values.map(plain);
      if (![x, y, w, h].every(Number.isFinite)) return null;
      region = [x, y, x + w, y + h];
    } else {
      // box units: its one user's own box, as WebKit takes it — not one inside a mask, whose content is not laid out on its own
      if (of.length > 1 || inMask(of[0])) return null;
      const [fx, fy, fw, fh] = [fraction(values[0], -0.1), fraction(values[1], -0.1), fraction(values[2], 1.2), fraction(values[3], 1.2)];
      if (![fx, fy, fw, fh].every(Number.isFinite)) return null;
      let b: DOMRect;
      try {
        b = (of[0] as SVGGraphicsElement).getBBox();
      } catch {
        return null;
      }
      region = [b.x + fx * b.width, b.y + fy * b.height, b.x + (fx + fw) * b.width, b.y + (fy + fh) * b.height];
    }
    const cut = limitedRegion(region, view, 2 * margin, s);
    if (cut && cut.every((v, i) => v === region[i])) return null;
    const r4 = (v: number) => String(Math.round(v * 10000) / 10000);
    // wholly off screen: an empty region, drawn not at all
    const [x0, y0, x1, y1] = cut ?? [view[0], view[1], view[0], view[1]];
    return ["userSpaceOnUse", r4(x0), r4(y0), r4(x1 - x0), r4(y1 - y0)];
  };

  for (const def of defs) {
    const drawn = drawnOf(def);
    put(def, drawn, cutOf(def, drawn) ?? drawn);
  }
}
