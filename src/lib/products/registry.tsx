import type { ReactNode } from "react";
import type { GarmentPartId, Localized, ProductKind } from "@/types";
import type { RegionDrawing } from "@/components/visualizer/FabricRegion";
import { ROUND, horizontal, vertical } from "@/lib/garments/shading";

/**
 * Home-product geometry, as data.
 *
 * Every product is a list of *parts*. A part owns its outline, its own fabric
 * fill, its own fixed shading and its own topstitch — so a two-tone sofa is
 * simply a product with two parts instead of one, and adding a piped edge later
 * means adding a record to a `parts` array. No renderer changes.
 *
 * A part's `shape` returns its pieces one by one, back to front — never one
 * group. `FabricRegion` draws a region piece by piece, each piece's outline
 * with it, so a piece in front covers the outline of what is behind it: a
 * sofa's arm hides the end of the cushion it stands beside, and only the
 * outlines that can be seen are drawn.
 *
 * Clothing does not live here. A garment is worn on a body, in layers, and
 * carries coverage and compatibility a curtain has no use for; it has its own
 * model in `lib/data/garments.ts` and its own drawings in `lib/garments/art/`.
 *
 * All geometry below lives in one 400×400 space. `cmPerUnit` says what an SVG
 * unit is worth in the real world; combined with a fabric's own repeat it is
 * what makes a check on a cushion the size of a check on a cushion.
 */

export interface ProductPart extends RegionDrawing {
  id: GarmentPartId;
  label: Localized;
  /** Where a close-up should centre. Defaults to the middle of the canvas. */
  focus?: [x: number, y: number];
}

export interface Product {
  kind: ProductKind;
  label: Localized;
  /** Real-world centimetres represented by one SVG unit. */
  cmPerUnit: number;
  /**
   * How wide its cloth is made, in centimetres — what the drawing's cloth
   * spans at `cmPerUnit`, and so how many repeats of a print run across it.
   * The true-scale check holds the drawing to it.
   */
  widthCm: number;
  parts: ProductPart[];
}

/** The canvas home products are drawn in. */
export const PRODUCT_CANVAS = [400, 400] as const;

/* ------------------------------------------------------- single-part goods */

/** A single-fabric product: one part covering the whole piece. */
const wholePiece = (
  shape: ProductPart["shape"],
  shading: ProductPart["shading"],
  defs: ProductPart["defs"],
  stitch?: string,
  focus: [number, number] = [200, 200]
): ProductPart[] => [
  {
    id: "main",
    label: { en: "Fabric", ar: "القماش" },
    shape,
    defs,
    shading,
    stitch,
    focus,
  },
];

/* ------------------------------------------------------------------- sofa */

/**
 * A three-seat sofa, 220 cm wide, in units of 0.66 cm: the back at 85 cm, the
 * arms at 60, the seat at 45, on 12 cm legs set under the arms — the
 * proportions of a real one. Three back cushions and three seat cushions sit
 * between the arms.
 */
const SOFA = {
  left: 33,
  right: 367,
  /** the top of the back: 85 cm */
  top: 137,
  /** the floor, where the legs stand */
  floor: 266,
  /** the top of the arms: 60 cm */
  armTop: 175,
  armWidth: 30,
  /** the top of the seat cushions: 45 cm */
  seatTop: 198,
  /** their underside: cushions 15 cm deep at the front */
  seatBottom: 221,
  /** the frame's underside, on the legs */
  base: 248,
  /** the back cushions' tops, a little below the back */
  cushionTop: 148,
} as const;
const SOFA_INNER: [number, number] = [SOFA.left + SOFA.armWidth, SOFA.right - SOFA.armWidth];
/** The three cushions' spans across the seat, a unit apart. */
const SOFA_CUSHIONS: [number, number][] = [0, 1, 2].map((i) => {
  const w = (SOFA_INNER[1] - SOFA_INNER[0]) / 3;
  return [SOFA_INNER[0] + i * w + 0.5, SOFA_INNER[0] + (i + 1) * w - 0.5];
});
const SOFA_BACK = { x: SOFA.left, y: SOFA.top, width: SOFA.right - SOFA.left, height: 95, rx: 14 };
const SOFA_BASE = { x: SOFA_INNER[0], y: SOFA.seatBottom - 5, width: SOFA_INNER[1] - SOFA_INNER[0], height: SOFA.base - SOFA.seatBottom + 5, rx: 3 };
const sofaArm = (x: number) => ({ x, y: SOFA.armTop, width: SOFA.armWidth, height: SOFA.base - SOFA.armTop, rx: 9 });
const SOFA_ARMS = [sofaArm(SOFA.left), sofaArm(SOFA.right - SOFA.armWidth)];
const backCushion = ([x0, x1]: [number, number]) => ({ x: x0, y: SOFA.cushionTop, width: x1 - x0, height: 66, rx: 12 });
const seatCushion = ([x0, x1]: [number, number]) => ({ x: x0, y: SOFA.seatTop, width: x1 - x0, height: SOFA.seatBottom - SOFA.seatTop, rx: 7 });

/* ------------------------------------------------------------------ chair */

/**
 * A dining chair, 96 cm tall in units of 0.33 cm: a back 42 cm wide on a seat
 * 49 cm wide and 8 cm thick, at 50 cm. The seat is drawn after the back, so
 * the back's lower corners are hidden behind it, as they are.
 */
const CHAIR_BACK = { x: 136.4, y: 56, width: 127.2, height: 150, rx: 18 };
const CHAIR_SEAT = { x: 126, y: 196, width: 148, height: 24.2, rx: 10 };

/* ----------------------------------------------------------------- pillow */

/**
 * A 50 cm pillow, stuffed: its corners come to points, its sides pull in
 * between them, and its middle is domed. Two squares seamed at the edge, so
 * the seam is the outline itself.
 */
const PILLOW_PATH = (() => {
  type P = [number, number];
  const [lo, hi] = [96, 304];
  /** how far each side pulls in at its middle: 2 cm */
  const pull = 8;
  /** how far along a side, as a share of it, its corner's point is turned: about a centimetre */
  const blunt = 0.025;
  const corners: P[] = [
    [lo, lo],
    [hi, lo],
    [hi, hi],
    [lo, hi],
  ];
  /* a side is a quadratic from corner to corner, its control pulled toward the middle so its midpoint lands `pull` in */
  const control = (a: P, b: P): P => {
    const m: P = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const len = Math.hypot(200 - m[0], 200 - m[1]);
    return [m[0] + ((200 - m[0]) / len) * 2 * pull, m[1] + ((200 - m[1]) / len) * 2 * pull];
  };
  /* the curve's blossom: at u = v the point at t; at (u, v) the control of the part between them */
  const blossom = (a: P, c: P, b: P, u: number, v: number): P => [
    (1 - u) * (1 - v) * a[0] + ((1 - u) * v + u * (1 - v)) * c[0] + u * v * b[0],
    (1 - u) * (1 - v) * a[1] + ((1 - u) * v + u * (1 - v)) * c[1] + u * v * b[1],
  ];
  const f = (p: P) => `${+p[0].toFixed(2)} ${+p[1].toFixed(2)}`;
  const sides = corners.map((a, i) => {
    const b = corners[(i + 1) % 4];
    const c = control(a, b);
    /* the side, short of both its corners */
    return { from: blossom(a, c, b, blunt, blunt), via: blossom(a, c, b, blunt, 1 - blunt), to: blossom(a, c, b, 1 - blunt, 1 - blunt), corner: b };
  });
  /* each side, then its far corner, turned on the corner's own point into the next side */
  return (
    sides
      .map((s, i) => `${i === 0 ? `M${f(s.from)} ` : ""}Q${f(s.via)} ${f(s.to)} Q${f(s.corner)} ${f(sides[(i + 1) % 4].from)}`)
      .join(" ") + " Z"
  );
})();

/* ---------------------------------------------------------------- curtain */

/**
 * A curtain 242 cm wide and 243 cm long, in units of 0.89 cm, hung from a
 * 3 cm rod: straight down to a straight double hem 10 cm deep.
 */
const CURTAIN = { left: 64, right: 336, top: 56.7, hem: 330, hemDepth: 11 } as const;
const CURTAIN_PATH = `M${CURTAIN.left} ${CURTAIN.top} L${CURTAIN.right} ${CURTAIN.top} L${CURTAIN.right} ${CURTAIN.hem} L${CURTAIN.left} ${CURTAIN.hem} Z`;

/* --------------------------------------------------------------- registry */

export const products: Product[] = [
  {
    kind: "sofa",
    label: { en: "Sofa", ar: "كنبة" },
    cmPerUnit: 0.66, // 220 cm wide, 85 cm tall
    widthCm: 220.4,
    parts: wholePiece(
      (fill) => (
        <>
          <rect {...SOFA_BACK} fill={fill} />
          {SOFA_CUSHIONS.map((span, i) => (
            <rect key={`back-${i}`} {...backCushion(span)} fill={fill} />
          ))}
          <rect {...SOFA_BASE} fill={fill} />
          {SOFA_CUSHIONS.map((span, i) => (
            <rect key={`seat-${i}`} {...seatCushion(span)} fill={fill} />
          ))}
          {SOFA_ARMS.map((arm, i) => (
            <rect key={`arm-${i}`} {...arm} fill={fill} />
          ))}
        </>
      ),
      (uid) => (
        <>
          <rect {...SOFA_BACK} fill={`url(#${uid("back")})`} />
          {SOFA_CUSHIONS.map((span, i) => (
            <rect key={`back-${i}`} {...backCushion(span)} fill={`url(#${uid("cushion")})`} />
          ))}
          <rect {...SOFA_BASE} fill={`url(#${uid("base")})`} />
          {SOFA_CUSHIONS.map((span, i) => (
            <rect key={`seat-${i}`} {...seatCushion(span)} fill={`url(#${uid("seat")})`} />
          ))}
          {SOFA_ARMS.map((arm, i) => (
            <g key={`arm-${i}`}>
              <rect {...arm} fill={`url(#${uid("arm")})`} />
              <rect {...arm} fill={`url(#${uid("arm-top")})`} />
            </g>
          ))}
        </>
      ),
      (uid) => (
        <>
          {vertical(uid("back"), [
            [0, "#ffffff"],
            [0.5, "#f2f2f2"],
            [1, "#d2d2d2"],
          ])}
          {/* a back cushion: lit on its crown, in shadow where it tucks in behind the seat */}
          {vertical(uid("cushion"), [
            [0, "#f4f4f4"],
            [0.12, "#ffffff"],
            [0.62, "#f0f0f0"],
            [1, "#c6c6c6"],
          ])}
          {/* a seat cushion's front: the edge it turns over catches the light */}
          {vertical(uid("seat"), [
            [0, "#ffffff"],
            [0.25, "#fbfbfb"],
            [1, "#d6d6d6"],
          ])}
          {/* under the cushions, in their shadow */}
          {vertical(uid("base"), [
            [0, "#b9b9b9"],
            [0.35, "#cdcdcd"],
            [1, "#d8d8d8"],
          ])}
          {horizontal(uid("arm"), ROUND)}
          {vertical(uid("arm-top"), [
            [0, "#ffffff"],
            [0.5, "#f6f6f6"],
            [1, "#dcdcdc"],
          ])}
        </>
      ),
      SOFA_CUSHIONS.map(([x0, x1]) => `M${x0 + 12} 156 Q${(x0 + x1) / 2} 151 ${x1 - 12} 156`).join(" "),
      [200, 200]
    ),
  },
  {
    kind: "chair",
    label: { en: "Dining chair", ar: "كرسي طعام" },
    cmPerUnit: 0.33, // ~96 cm tall
    widthCm: 48.8,
    parts: wholePiece(
      (fill) => (
        <>
          <rect {...CHAIR_BACK} fill={fill} />
          <rect {...CHAIR_SEAT} fill={fill} />
        </>
      ),
      (uid) => (
        <>
          <rect {...CHAIR_BACK} fill={`url(#${uid("round")})`} />
          <rect {...CHAIR_SEAT} fill={`url(#${uid("seat")})`} />
        </>
      ),
      (uid) => (
        <>
          {horizontal(uid("round"), ROUND)}
          {vertical(uid("seat"), [
            [0, "#ffffff"],
            [1, "#c8c8c8"],
          ])}
        </>
      ),
      "M144.4 64 L255.6 64 M144.4 198 L255.6 198",
      [200, 140]
    ),
  },
  {
    kind: "pillow",
    label: { en: "Pillow", ar: "مخدة" },
    cmPerUnit: 0.24, // 50 cm square
    widthCm: 49.9,
    parts: wholePiece(
      (fill) => <path d={PILLOW_PATH} fill={fill} />,
      (uid) => (
        <>
          {/* the dome: lit from the upper left, turning away toward the edges and into the corners */}
          <path d={PILLOW_PATH} fill={`url(#${uid("dome")})`} />
          {/* the seam: the edge itself, where the two faces turn into each other */}
          <path d={PILLOW_PATH} fill="none" stroke="#c9c9c9" strokeWidth="5" filter={`url(#${uid("seam")})`} />
        </>
      ),
      (uid) => (
        <>
          <radialGradient id={uid("dome")} cx="0.44" cy="0.4" r="0.72">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.4" stopColor="#f6f6f6" />
            <stop offset="0.75" stopColor="#dcdcdc" />
            <stop offset="1" stopColor="#c0c0c0" />
          </radialGradient>
          <filter id={uid("seam")} x="0" y="0" width="400" height="400" filterUnits="userSpaceOnUse">
            <feGaussianBlur stdDeviation="1.2" />
          </filter>
        </>
      ),
      undefined,
      [200, 200]
    ),
  },
  {
    kind: "curtain",
    label: { en: "Curtain", ar: "ستارة" },
    cmPerUnit: 0.89, // ~243 cm drop
    widthCm: 242.1,
    parts: wholePiece(
      (fill) => <path d={CURTAIN_PATH} fill={fill} />,
      (uid) => (
        <>
          {[64, 98, 132, 166, 200, 234, 268, 302].map((x, i) => (
            <rect
              key={x}
              x={x}
              y={CURTAIN.top}
              width="17"
              height={CURTAIN.hem - CURTAIN.top}
              fill={`url(#${uid("pleat")})`}
              opacity={i % 2 === 0 ? 0.5 : 1}
            />
          ))}
          <path d={CURTAIN_PATH} fill={`url(#${uid("drape")})`} />
          {/* the double hem: its folded top edge, and the extra weight of cloth below it */}
          <rect x={CURTAIN.left} y={CURTAIN.hem - CURTAIN.hemDepth} width={CURTAIN.right - CURTAIN.left} height={CURTAIN.hemDepth} fill={`url(#${uid("hem")})`} />
          <line x1={CURTAIN.left} x2={CURTAIN.right} y1={CURTAIN.hem - CURTAIN.hemDepth} y2={CURTAIN.hem - CURTAIN.hemDepth} stroke="#cfcfcf" strokeWidth="1.2" />
        </>
      ),
      (uid) => (
        <>
          {horizontal(uid("pleat"), [
            [0, "#ffffff"],
            [0.5, "#c6c6c6"],
            [1, "#ffffff"],
          ])}
          {vertical(uid("drape"), [
            [0, "#e0e0e0"],
            [0.14, "#ffffff"],
            [0.82, "#ffffff"],
            [1, "#d2d2d2"],
          ])}
          {vertical(uid("hem"), [
            [0, "#e9e9e9"],
            [0.3, "#f7f7f7"],
            [1, "#e4e4e4"],
          ])}
        </>
      ),
      `M${CURTAIN.left} ${CURTAIN.top + 9.3} L${CURTAIN.right} ${CURTAIN.top + 9.3} M${CURTAIN.left} ${CURTAIN.hem - CURTAIN.hemDepth + 1.2} L${CURTAIN.right} ${CURTAIN.hem - CURTAIN.hemDepth + 1.2}`,
      [200, 190]
    ),
  },
];

export const productByKind = (kind: ProductKind): Product =>
  products.find((p) => p.kind === kind) ?? products[0];

/**
 * Non-fabric hardware, drawn behind the fabric parts: legs, a rod and its
 * finials. Each piece says how it is lit — `side` down its length, a leg;
 * `top` along it, a rod; `round`, a ball — and `ProductTemplate` gives it a
 * wood finish and an outline, so it still reads on a dark page.
 */
export interface HardwarePiece {
  d: string;
  light: "side" | "top" | "round";
}

/** A tapered leg, `top` wide at its head and `foot` at its foot. */
const leg = (cx: number, y0: number, y1: number, top: number, foot: number) =>
  `M${cx - top / 2} ${y0} L${cx + top / 2} ${y0} L${cx + foot / 2} ${y1} L${cx - foot / 2} ${y1} Z`;
/** A circle as a path. */
const ball = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy} A${r} ${r} 0 1 0 ${cx + r} ${cy} A${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
/** A rectangle as a path, its ends rounded by `r`. */
const bar = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y} L${x + w - r} ${y} A${r} ${r} 0 0 1 ${x + w - r} ${y + h} L${x + r} ${y + h} A${r} ${r} 0 0 1 ${x + r} ${y} Z`;

/** The curtain rod's centre line, and its thickness: 3 cm. */
const ROD = { y: 55, thick: 3.4, from: 46, to: 354 } as const;

export const HARDWARE: Partial<Record<ProductKind, HardwarePiece[]>> = {
  sofa: [
    { d: leg(47, SOFA.base - 1, SOFA.floor, 10, 7), light: "side" },
    { d: leg(353, SOFA.base - 1, SOFA.floor, 10, 7), light: "side" },
  ],
  chair: [
    { d: leg(157, 214, 348, 14, 11), light: "side" },
    { d: leg(243, 214, 348, 14, 11), light: "side" },
  ],
  curtain: [
    { d: bar(ROD.from, ROD.y - ROD.thick / 2, ROD.to - ROD.from, ROD.thick, ROD.thick / 2), light: "top" },
    /* a finial at each end: a short collar and a ball, about 7 cm across */
    { d: bar(ROD.from - 4, ROD.y - 2.6, 4, 5.2, 0.8), light: "top" },
    { d: bar(ROD.to, ROD.y - 2.6, 4, 5.2, 0.8), light: "top" },
    { d: ball(ROD.from - 8, ROD.y, 4.2), light: "round" },
    { d: ball(ROD.to + 8, ROD.y, 4.2), light: "round" },
  ],
};

/** Everything a product draws behind its cloth, as one silhouette — for the masks of what lies under an edge. */
export const hardwareShape = (kind: ProductKind, fill: string): ReactNode =>
  (HARDWARE[kind] ?? []).map((p, i) => <path key={i} d={p.d} fill={fill} />);
