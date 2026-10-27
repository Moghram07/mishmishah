import { softShadow } from "@/lib/garments/shading";
import { COLLAR_AXIS, THOBE_PLACKET, standFrontEdges } from "../yoke";
import type { GarmentArt } from "../../index";
import { litButtons } from "../../buttons";

/**
 * His band collars' fronts, drawn the same way — a band standing round the
 * neck and nothing else, and how its two ends close at the throat:
 *
 * - **a tab**: one end runs on past the centre and buttons over the other,
 *   the regular thobe collar «رقبة عادي» and its short version. The tab ends
 *   exactly over the placket's edge below it, so band and placket read as one
 *   strip, buttoned down its middle; or
 * - **a gap**: the two ends stop short of the centre, leaving a small V over
 *   the placket — the mandarin «رقبة صيني», cut into the band itself.
 *
 * Each collar's own file names its band, so `check:garments` measures it —
 * see `regular.tsx`, `regularShort.tsx` and `mandarin.tsx`.
 */

/**
 * Where a tab ends, and the line its buttons are on: over the thobe's
 * placket — the edge of it, and the middle — so the band runs straight on
 * into the placket. A man's closes left over right, so the tab is the end on
 * his left — the canvas's right — lying over his right one.
 */
const TAB_END = THOBE_PLACKET[0];
const STRIP_MIDDLE = (THOBE_PLACKET[0] + THOBE_PLACKET[1]) / 2;

/** How the band is lit and where its ends close: a crease, or a tab's edge lying on the other end. */
export function bandFront(s: {
  band: string;
  cast: string;
  rise: number;
  closes: "tab" | "gap";
  /** The buttons on a tab, one above the other. */
  buttons: number;
}): GarmentArt {
  const edges = standFrontEdges(s.rise);
  /** Where an edge of the band is at a column. */
  const rowAt = (pts: [number, number][], x: number): number => {
    const sorted = [...pts].sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < sorted.length; i++) {
      const [[x0, y0], [x1, y1]] = [sorted[i - 1], sorted[i]];
      if (x >= x0 && x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1);
    }
    return sorted[sorted.length - 1][1];
  };
  const top = (x: number) => rowAt(edges.top, x);
  const foot = (x: number) => rowAt(edges.foot, x);
  /* the tab's free end, on his right of the centre: square, down the band, over the placket's edge */
  const tabX = TAB_END;
  const r = 3.5;
  const buttons = Array.from({ length: s.buttons }, (_, i) => {
    const [y0, y1] = [top(STRIP_MIDDLE), foot(STRIP_MIDDLE)];
    return [STRIP_MIDDLE, y1 - ((y1 - y0) * (i + 0.5)) / s.buttons] as const;
  });
  return {
    regions: {
      collar: {
        focus: [300, 172],
        surface: { blur: 4, relief: 4, warp: 2 },
        /**
         * Cut across the grain, which is how a band is cut: it has to bend
         * round a throat without dragging, and a crossgrain strip does that
         * where a straight-grain one fights it.
         */
        grain: { turn: 90 },
        shape: (fill) => <path d={s.band} fill={fill} />,
        defs: (uid) => (
          <>
            {softShadow(uid("soft"), 3)}
            {s.closes === "tab" && (
              <filter id={uid("tab-soft")} filterUnits="userSpaceOnUse" x="0" y="0" width="600" height="1000" colorInterpolationFilters="sRGB">
                <feGaussianBlur stdDeviation={1.2} />
              </filter>
            )}
          </>
        ),
        /* the band's lower edge, dropped onto the garment it is sewn to */
        cast: (uid) => <path d={s.cast} fill="#7a7a7a" opacity="0.4" filter={`url(#${uid("soft")})`} />,
        /* a gap is cut into the band itself; a tab's end lies on the end under it */
        shading:
          s.closes === "gap"
            ? () => null
            : /* a soft shadow on the end under it, then the edge, fine and dark */
              (uid) => (
                <>
                  <path
                    d={`M${tabX - 1.2} ${top(tabX) + 1} L${tabX - 1.2} ${foot(tabX) - 1}`}
                    stroke="#5c4a3e"
                    strokeWidth="2.6"
                    opacity="0.5"
                    filter={`url(#${uid("tab-soft")})`}
                  />
                  <path
                    d={`M${tabX} ${top(tabX) + 0.4} L${tabX} ${foot(tabX) - 0.4}`}
                    stroke="#241e19"
                    strokeWidth="1.4"
                    opacity="0.3"
                  />
                </>
              ),
      },
    },
    /**
     * The tab's buttons, one above the other down the strip's middle, on the
     * line the placket's continue, whatever the garment asks for: the band
     * carries its own. A gapped band has none — the garment's placket buttons
     * from just under it.
     */
    ...(s.buttons > 0 ? { bandButtons: () => litButtons(buttons, r) } : {}),
  };
}
