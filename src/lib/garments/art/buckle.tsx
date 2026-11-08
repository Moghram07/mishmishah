/**
 * A belt's buckle, over the belt at the centre front: a rounded frame of
 * antique gold, the belt seen through it, and its prong lying across the
 * belt from the frame's near bar — see `BUCKLE` in `garments/closures.ts`.
 *
 * Hardware, not cloth: it never takes the fabric, and it is drawn without
 * ids — solid colours and offsets rather than gradients and filters — so any
 * number of stages on one page draw it the same.
 */

const METAL = "#b8944c";
const METAL_DARK = "#6f5426";
const METAL_LIGHT = "#f2dea2";

/** A rounded rectangle's outline, its corners round by `r`. */
const roundRect = (x: number, y: number, w: number, h: number, r: number): string =>
  `M${x + r} ${y} H${x + w - r} A${r} ${r} 0 0 1 ${x + w} ${y + r} V${y + h - r} A${r} ${r} 0 0 1 ${x + w - r} ${y + h} ` +
  `H${x + r} A${r} ${r} 0 0 1 ${x} ${y + h - r} V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y} Z`;

export function Buckle({ x, y, w, h, frame, round }: { x: number; y: number; w: number; h: number; frame: number; round: number }) {
  const [x0, y0] = [x - w / 2, y - h / 2];
  const outer = roundRect(x0, y0, w, h, round);
  const inner = roundRect(x0 + frame, y0 + frame, w - 2 * frame, h - 2 * frame, Math.max(0.5, round - frame));
  const ring = `${outer} ${inner}`;
  /* the prong, from the near bar across the belt to a little past the middle */
  const prong = `M${x0 + frame - 0.4} ${y} L${x + w * 0.12} ${y}`;
  return (
    <g>
      {/* its shadow on the belt, close under it */}
      <path d={ring} fill="#000" fillRule="evenodd" opacity={0.28} transform="translate(0.5 1)" />
      <path d={prong} stroke="#000" strokeWidth={2.2} strokeLinecap="round" opacity={0.25} transform="translate(0.4 0.9)" />
      {/* the frame: lit on its upper and left faces, in shade on its lower and right */}
      <path d={ring} fill={METAL_DARK} fillRule="evenodd" />
      <path d={ring} fill={METAL} fillRule="evenodd" transform="translate(-0.35 -0.35)" />
      <path
        d={`M${x0 + round * 0.6} ${y0 + 0.9} H${x0 + w - round} M${x0 + 0.9} ${y0 + round} V${y0 + h - round}`}
        stroke={METAL_LIGHT}
        strokeWidth={0.8}
        strokeLinecap="round"
        opacity={0.75}
      />
      {/* the prong, lit along its top */}
      <path d={prong} stroke={METAL_DARK} strokeWidth={2.2} strokeLinecap="round" />
      <path d={prong} stroke={METAL} strokeWidth={1.6} strokeLinecap="round" transform="translate(0 -0.25)" />
      <path d={prong} stroke={METAL_LIGHT} strokeWidth={0.5} strokeLinecap="round" opacity={0.7} transform="translate(0 -0.7)" />
    </g>
  );
}
