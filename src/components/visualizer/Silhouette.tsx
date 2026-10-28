/** A rectangle of the canvas, in its units. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The box round every outline in every set, with `pad` units of room: one box
 * for a whole row of icons, so each is drawn at the same scale as the others
 * and a shorter or narrower cut looks it beside them.
 */
export function boxAround(sets: string[][], pad = 8): Box {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const d of sets.flat()) {
    const n = (d.match(/-?[0-9]*[.]?[0-9]+/g) ?? []).map(Number);
    for (let i = 0; i + 1 < n.length; i += 2) {
      x0 = Math.min(x0, n[i]);
      x1 = Math.max(x1, n[i]);
      y0 = Math.min(y0, n[i + 1]);
      y1 = Math.max(y1, n[i + 1]);
    }
  }
  if (!Number.isFinite(x0)) return { x: 0, y: 0, w: 1, h: 1 };
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
}

/**
 * A garment's outline as a small icon, in the text colour: the pieces it is
 * cut from as the stage draws them — see `GarmentArt.silhouette` — framed by
 * `box`.
 */
export function Silhouette({ pieces, box, className }: { pieces: string[]; box: Box; className?: string }) {
  return (
    <svg viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} className={className} aria-hidden="true" focusable="false">
      {pieces.map((d, i) => (
        <path key={i} d={d} fill="currentColor" />
      ))}
    </svg>
  );
}
