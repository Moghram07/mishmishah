import { BODY_CANVAS } from "./bodies.ts";

/**
 * What a close-up is looking at.
 *
 * The window into the canvas: where it is centred, how wide it is, and how far
 * it has been dragged. This used to be four lines inside `MannequinStage`,
 * which is fine until it is wrong — and it was wrong in a way nothing could
 * catch, because a viewBox computed inside a render has nothing to assert
 * against. Zooming a collar put the camera on the hips and the only symptom was
 * that you could not see the collar.
 *
 * It is a pure function of zoom, focus, pan and the stage it is drawn into, so
 * it can be tested.
 */

const [VX, VY, VW, VH] = BODY_CANVAS.viewBox.split(" ").map(Number);

export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Ready for an SVG `viewBox` attribute. */
  viewBox: string;
}

/**
 * The element the frame is drawn into, in CSS pixels, and the room the whole
 * figure keeps clear of its edges — for the controls laid over the stage.
 *
 * The close-up used to be drawn into a box the shape of the figure, standing
 * in the middle of the stage. Zoomed out that box is invisible, because the
 * figure fills it and the rest is transparent; zoomed in, the body filled it
 * edge to edge and was cut off square on all four sides, in the middle of an
 * empty stage — a picture in a window. Drawn into the whole stage instead, the
 * only edges a close-up has are the stage's own.
 */
export interface Viewport {
  width: number;
  height: number;
  /** Top, right, bottom, left, in pixels. */
  inset?: readonly [number, number, number, number];
}

/** The whole figure, which is what zoom 1 always shows. */
export const WHOLE: readonly [number, number] = [VX + VW / 2, VY + VH / 2];

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), hi);

/**
 * What zoom 1 shows: the whole figure, fitted inside the viewport's inset and
 * widened to fill the rest of it, so the frame is always the viewport's shape.
 *
 * Without a viewport it is the figure alone — what an element sized to the
 * figure shows, and what every other picture of the mannequin is.
 */
export function homeFrame(viewport?: Viewport | null): Omit<Frame, "viewBox"> {
  if (!viewport || viewport.width <= 0 || viewport.height <= 0) {
    return { x: VX, y: VY, w: VW, h: VH };
  }
  const [top, right, bottom, left] = viewport.inset ?? [0, 0, 0, 0];
  const inner = [
    Math.max(1, viewport.width - left - right),
    Math.max(1, viewport.height - top - bottom),
  ];
  // pixels per canvas unit: the figure fitted, whole, inside the inset
  const s = Math.min(inner[0] / VW, inner[1] / VH);
  return {
    x: WHOLE[0] - (left + inner[0] / 2) / s,
    y: WHOLE[1] - (top + inner[1] / 2) / s,
    w: viewport.width / s,
    h: viewport.height / s,
  };
}

/**
 * The window a close-up frames.
 *
 * `focus` is where the app would like to look — a garment region's own
 * `focus`, which for a collar is up at the throat. `pan` is how far the viewer
 * has dragged from there, in canvas units, and is clamped along with
 * everything else so the frame never leaves what zoom 1 shows: drag as far as
 * you like and the figure stays in shot.
 *
 * At zoom 1 the frame is the whole of that, so focus and pan cannot move it —
 * there is nowhere to move it to. That is why panning is only offered when
 * zoomed in.
 */
export function frameFor(
  zoom: number,
  focus?: readonly [number, number] | null,
  pan: readonly [number, number] = [0, 0],
  viewport?: Viewport | null
): Frame {
  const home = homeFrame(viewport);
  const scale = Math.max(1, zoom);
  const w = home.w / scale;
  const h = home.h / scale;
  const centre = focus ?? WHOLE;

  const x = clamp(centre[0] + pan[0], home.x + w / 2, home.x + home.w - w / 2) - w / 2;
  const y = clamp(centre[1] + pan[1], home.y + h / 2, home.y + home.h - h / 2) - h / 2;

  return { x, y, w, h, viewBox: `${x} ${y} ${w} ${h}` };
}

/**
 * How far a drag of `dx, dy` **screen** pixels moves the view, in canvas units.
 *
 * The frame shrinks as the zoom grows, so a pixel of drag is worth less canvas
 * the further in you are — which is what makes dragging feel like moving the
 * picture rather than moving a slider. Dragging right moves the *view* left, so
 * the picture follows the pointer.
 */
export function panBy(
  pan: readonly [number, number],
  dx: number,
  dy: number,
  zoom: number,
  renderedPx: number,
  viewport?: Viewport | null
): [number, number] {
  if (renderedPx <= 0) return [pan[0], pan[1]];
  const unitsPerPx = homeFrame(viewport).w / Math.max(1, zoom) / renderedPx;
  return [pan[0] - dx * unitsPerPx, pan[1] - dy * unitsPerPx];
}
