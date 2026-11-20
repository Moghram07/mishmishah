import type { BodyType } from "@/types";
import { bodyById } from "@/lib/mannequin/bodies";
import { profileFor } from "@/lib/mannequin/profile";
import { frameFor, WHOLE, type Frame, type Viewport } from "@/lib/mannequin/frame";

/**
 * What the phone's stage shows: the figure, or a close-up of the part being
 * chosen — and who chose that.
 *
 * On a phone the figure is drawn about 300 px tall, so a neckline is a few
 * dozen pixels across and changing it shows almost nothing. Choosing a
 * category — the neckline, the belt — brings the stage in on that part. Two
 * promises keep that from getting in the way: there is always one clear way
 * back to the whole figure, and a view the viewer set themselves — a pinch, a
 * drag, the zoom button — is never moved by the app. It holds until they go
 * back to the whole figure; after that, choosing a category frames its part
 * again.
 */

export interface StageView {
  /** 1 = the whole figure. */
  zoom: number;
  /** What the close-up centres on, in canvas units; null is the whole figure's middle. */
  centre: readonly [number, number] | null;
  /** Who set it: the app, following the category, or the viewer. */
  by: "app" | "viewer";
}

export const WHOLE_VIEW: StageView = { zoom: 1, centre: null, by: "app" };

/** The closest the stage goes, as on desktop. */
export const MOST_ZOOM = 8;

/** A close-up of a part: how close, and where. */
export interface PartView {
  zoom: number;
  focus: readonly [number, number];
}

/**
 * The phone panel's categories. Those not listed in `partView` show the whole
 * figure: the garments, a skirt's or a pair of trousers' shape and the abaya's
 * front read only as a whole, and stripes run along several edges at once.
 */
export type PartId =
  | "pieces"
  | "neckline"
  | "sleeve"
  | "skirt"
  | "waist"
  | "front"
  | "leg"
  | "collar"
  | "stripes"
  | "tie"
  | "buttons"
  | "belt"
  | "cuff";

/**
 * Where the stage looks while a category is chosen, read off the body — its
 * shoulder, waist and wrist, so his lower waist is followed — or null for the
 * whole figure. A collar and a tie have a focus of their own on their
 * drawing (`garments/closeUp.ts`), passed as `own`.
 */
export function partView(part: string, body: BodyType, own?: readonly [number, number]): PartView | null {
  const a = bodyById(body).anchors;
  const p = profileFor(body);
  const x = a.centerX;
  switch (part) {
    case "neckline":
      // from the chin to below the bust: the opening, the shoulders either side of it
      return { zoom: 3, focus: [x, a.shoulderY + 45] };
    case "collar":
      return { zoom: 3.2, focus: own ?? [x, a.shoulderY + 20] };
    case "sleeve":
      // both arms, from the shoulder to the hand
      return { zoom: 1.9, focus: [x, Math.round((a.shoulderY + p.wristY) / 2) + 10] };
    case "waist":
      // the bust to the hip: wherever the seam is, high, natural or low
      return { zoom: 2.2, focus: [x, a.waistY + 30] };
    case "tie":
      return { zoom: 2.4, focus: own ?? [x, a.shoulderY + 90] };
    case "buttons":
      return { zoom: 1.8, focus: [x, a.waistY] };
    case "belt":
      // the belt and a sash's bow, its tails hanging below it
      return { zoom: 2.2, focus: [x, a.waistY + 60] };
    case "cuff":
      // both wrists
      return { zoom: 3, focus: [x, p.wristY] };
    default:
      return null;
  }
}

/** A category was chosen: frame its part — unless the viewer has a view of their own. */
export function viewForPart(view: StageView, part: PartView | null): StageView {
  if (view.by === "viewer" && view.zoom > 1) return view;
  return part ? { zoom: part.zoom, centre: part.focus, by: "app" } : WHOLE_VIEW;
}

/** The zoom button: the whole figure → 2× → 4× → the whole figure. */
export function nextZoom(zoom: number): number {
  return zoom < 2 - 1e-6 ? 2 : zoom < 4 - 1e-6 ? 4 : 1;
}

/** The frame a view shows on a stage. */
export const frameOf = (view: StageView, viewport: Viewport | null | undefined): Frame =>
  frameFor(view.zoom, view.centre ?? WHOLE, [0, 0], viewport);

/** The middle of what a frame shows: a view's centre after `frameFor` has kept it on the figure. */
export const centreOf = (f: Frame): [number, number] => [f.x + f.w / 2, f.y + f.h / 2];

/**
 * A view the viewer moved to: zoomed by `k` and moved so that the canvas
 * point that was under `from` (stage pixels) is now under `to` — two fingers
 * pinching, or one dragging (`k` = 1). Kept to the figure and to the zoom's
 * range; back at 1× it is the whole figure again, the app's to frame.
 */
export function movedView(
  view: StageView,
  viewport: Viewport,
  from: readonly [number, number],
  to: readonly [number, number],
  k: number
): StageView {
  const f = frameOf(view, viewport);
  const zoom = Math.min(MOST_ZOOM, Math.max(1, view.zoom * k));
  if (zoom <= 1.001) return WHOLE_VIEW;
  const s0 = viewport.width / f.w;
  const s1 = s0 * (zoom / view.zoom);
  // the canvas point under the fingers, and the frame that puts it under them again
  const ux = f.x + from[0] / s0;
  const uy = f.y + from[1] / s0;
  const w = f.w * (view.zoom / zoom);
  const h = f.h * (view.zoom / zoom);
  const centre: [number, number] = [ux - to[0] / s1 + w / 2, uy - to[1] / s1 + h / 2];
  // through `frameFor`, so a drag past the edge stops at it rather than storing a centre off the figure
  return { zoom, centre: centreOf(frameFor(zoom, centre, [0, 0], viewport)), by: "viewer" };
}

/** What the stage has drawn, or is to draw: a view on a stage of a size. */
export interface Shown {
  view: StageView;
  viewport: Viewport;
}

/**
 * The CSS transform (from the stage's top-left corner) that carries the
 * picture drawn for `from` to where the picture for `to` will be — the same
 * canvas point under the same screen point — so the GPU can show the new
 * view at once by scaling the old picture, softly, until the new one is drawn
 * sharp. Also what a pinch or a drag shows while the fingers move.
 */
export function transformBetween(from: Shown, to: Shown): { k: number; tx: number; ty: number } {
  const f0 = frameOf(from.view, from.viewport);
  const f1 = frameOf(to.view, to.viewport);
  const s0 = from.viewport.width / f0.w;
  const s1 = to.viewport.width / f1.w;
  return { k: s1 / s0, tx: (f0.x - f1.x) * s1, ty: (f0.y - f1.y) * s1 };
}

export const cssTransform = ({ k, tx, ty }: { k: number; tx: number; ty: number }) => `translate(${tx}px, ${ty}px) scale(${k})`;
