import type { Uid } from "@/lib/garments/shading";
import type { PuffShape } from "@/lib/garments/sleeves";

/** A puff's bulge, on the canvas: its left edge and width at its widest row, that row, and its height. */
function bulge(s: PuffShape) {
  const row = s.across.reduce((best, r) => (Math.abs(r[0] - s.widest) < Math.abs(best[0] - s.widest) ? r : best));
  const [, outer, inner] = row;
  const top = Math.min(s.top[0][1], s.top[1][1]);
  return { left: Math.min(outer, inner), width: Math.abs(inner - outer), y: s.widest, height: s.bottom[0][1] - top };
}

/**
 * A puff's light — see `PuffShape`. Matte, as cotton is: one broad, soft
 * gradient, the cloth's own colour over most of the bulge on the side toward
 * the light and darker as it turns away, toward every edge and down into the
 * band, with the gathers breaking it up. The light comes from the upper left,
 * as it does on the rest of the garment, so both sleeves are lit from that
 * side — the left one on its outside, the right one on the side by the body.
 *
 * It had a sheen as well, a round spot a quarter brighter than the cloth
 * round it, which is how a glossy surface catches the light: it read as
 * leather.
 */
export function puffLightDefs(uid: Uid, shapes: PuffShape[]) {
  return (
    <>
      {shapes.map((s, i) => {
        const b = bulge(s);
        const cx = b.left + PUFF_LIT[0] * b.width;
        const cy = b.y - PUFF_LIT[1] * b.height;
        const [rx, ry] = [PUFF_SPREAD[0] * b.width, PUFF_SPREAD[1] * b.height];
        return (
          <radialGradient
            key={i}
            id={uid(`puff-shade-${i}`)}
            gradientUnits="userSpaceOnUse"
            cx={cx}
            cy={cy}
            r={rx}
            gradientTransform={`translate(${cx} ${cy}) scale(1 ${ry / rx}) translate(${-cx} ${-cy})`}
          >
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.45" stopColor="#fcfcfc" />
            <stop offset="0.72" stopColor="#eeeeee" />
            <stop offset="0.92" stopColor="#dedede" />
            <stop offset="1" stopColor="#d6d6d6" />
          </radialGradient>
        );
      })}
    </>
  );
}
/**
 * Where on a puff the light is fullest, as shares of its width from its left
 * edge and of its height above its widest row; and how far the gradient
 * spreads from there, as shares of its width and height — far enough that
 * most of the bulge is all but its own colour.
 */
const PUFF_LIT: readonly [number, number] = [0.38, 0.18];
const PUFF_SPREAD: readonly [number, number] = [0.8, 0.75];

/** Each puff filled with its light — for a region's `shading`, inside a mask that keeps it off the bands. */
export function puffShade(uid: Uid, paths: string[]) {
  return paths.map((d, i) => <path key={i} d={d} fill={`url(#${uid(`puff-shade-${i}`)})`} />);
}

/**
 * A sleeve's folds — the gathers where a puff or a bishop is drawn into its
 * band, the flare of a bell, the drape under a kimono — drawn as shading.
 *
 * Fine and soft, because they are creases in cloth rather than edges of it: the
 * same fill as the sleeve they lie in, so what makes them read is the shadow
 * along each one. Every top with a choice of sleeve draws them the same way.
 */
export function sleeveFolds(uid: Uid, folds: string[]) {
  if (folds.length === 0) return null;
  return (
    <g filter={`url(#${uid("foldBlur")})`}>
      {folds.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke="#8f8f8f"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.5"
        />
      ))}
    </g>
  );
}

/** The blur the folds are drawn through, for a region's `defs`. */
export function sleeveFoldDefs(uid: Uid) {
  return (
    <filter id={uid("foldBlur")} x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="0.8" />
    </filter>
  );
}

/**
 * Seams drawn as what they are on a robe: a soft line of shadow where two
 * pieces are sewn and the cloth dips into the join. Not the edge of a piece —
 * that is stroked in the stage's text colour, which turns pale on a dark page,
 * and a pale line round an armhole is what made the sleeve head read as a
 * separate puffed piece.
 */
export function seamShadows(uid: Uid, seams: string[]) {
  if (seams.length === 0) return null;
  return (
    <g filter={`url(#${uid("foldBlur")})`}>
      {seams.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke="#6e6e6e"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.45"
        />
      ))}
    </g>
  );
}
