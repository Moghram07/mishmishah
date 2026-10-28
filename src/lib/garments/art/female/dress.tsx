import { DRAPE, softShadow, vertical } from "@/lib/garments/shading";
import {
  contour,
  dart,
  foldDefs,
  foldLights,
  foldOpen,
  foldShadows,
  gathers,
  hangingFolds,
  mirrorFold,
  puffDrape,
  rowSpan,
  sleeveDrape,
  type Fold,
} from "@/lib/garments/folds";
import { draft, line, outline, type Pt, type Tuck } from "@/lib/garments/fit";
import { BUST } from "./yoke";
import { NECKLINE_IDS, type CowlDrape, type HalterBand, type NecklineId, type OffShoulderBand, type WrapPanel } from "@/lib/garments/necklines";
import { BODICES, DEFAULT_SKIRT, DEFAULT_SLEEVE, SKIRT, WAIST_Y, bodiceFor, cloth, seamAt, skirtFor } from "./dressCut";
import { fallOf, hangs, sameSkirt, skirtKey } from "@/lib/garments/skirts";
import type { FabricRegionId, SkirtChoice, SleeveChoice, WaistId } from "@/types";
import type { GarmentArt, GarmentChoice, RegionArt } from "../index";
import { litButtons } from "../buttons";
import { puffLightDefs, puffShade, seamShadows, sleeveFoldDefs, sleeveFolds } from "../sleeveFolds";
import { CUFF, CuffHardware, cuffMarks, rowsOf, sewnDrape, shoulderFall } from "../sleevedTop";
import { horizontal, type Stop } from "@/lib/garments/shading";

/**
 * Midi dress, front — the garment the region system exists for. The bodice and
 * the skirt are separate fabric regions, so the same dress can be cut in one
 * cloth or two without becoming two garments.
 *
 * Two constructions, which is exactly what it is: a fitted bodice with set-in
 * sleeves down to the waist, and a column of cloth flaring from there. Both are
 * drafted against her photograph — see `garments/fit.ts`.
 *
 * **The bodice is now cut to a neckline** rather than drawn once. Fifteen cuts
 * live in `garments/necklines.ts`; this file asks for one and assembles the
 * rest of the dress around it. It used to carry a `variants.high` block that
 * repeated the whole top region to change a single curve, which is the thing
 * that does not survive being done fifteen times.
 */

/*
  The skirt's folds — see `garments/folds.tsx`. It is gathered into the waist
  seam: short tight folds right under it, then the cloth released below them
  falls into pipe folds that open toward the hem, where the flare gives it the
  most cloth to fold. They used to be nine grey wedges fanned evenly from the
  waist, which read as a printed sunburst rather than as cloth.
*/
const SEAM: readonly [Pt, Pt] = [
  [SKIRT.waistLeft[0] + 6, WAIST_Y],
  [600 - SKIRT.waistLeft[0] - 6, WAIST_Y],
];
/** The seam a skirt in a style is gathered into, across its waist's row. */
const seamOf = (skirt: SkirtChoice): readonly [Pt, Pt] => {
  if (!skirt.waist || skirt.waist === "natural") return SEAM;
  const sk = skirtFor(undefined, skirt);
  const y = seamAt(skirt.waist);
  return [
    [sk.waistLeft[0] + 6, y],
    [600 - sk.waistLeft[0] - 6, y],
  ];
};
/**
 * The skirt's folds, from the waist — or, under a jacket, from the jacket's
 * hem, where the skirt comes out, so they follow the outline it has there.
 */
const skirtFolds = (inside?: Tuck, skirt: SkirtChoice = DEFAULT_SKIRT): Fold[] => {
  const sk = skirtFor(inside, skirt);
  const seam = seamOf(skirt);
  const hem: readonly [Pt, Pt] = [sk.hemLeft, [600 - sk.hemLeft[0], sk.hemLeft[1]]];
  /*
    A fitted shape — a pencil, a mermaid — is darted to her, not gathered:
    two small darts each side from a seam at her waist, and none from one
    above or below it, where there is no waist to take in. Its folds are
    released at the hip, or where it starts to flare — a mermaid's above the
    knee — or under a jacket's hem, and open as far as it flares; one that
    does not flare, a pencil, hangs smooth and has none.
  */
  const fall = fallOf(skirt.shape);
  if (fall.fitted) {
    const at = Math.max(fall.from ?? draft("female").hipY, inside?.y ?? 0);
    const [l, r] = rowSpan(sk.path, at) ?? [sk.hemLeft[0], 600 - sk.hemLeft[0]];
    const y = seamAt(skirt.waist);
    const darts = (skirt.waist ?? "natural") === "natural" ? [256, 276].map((x) => dart([x, y], [x + 1, y + (x < 266 ? 46 : 38)], 2)) : [];
    const flare = l - sk.hemLeft[0];
    const open = foldOpen(flare);
    if (flare <= 0) return [...darts, ...darts.map(mirrorFold)];
    return [
      ...darts,
      ...darts.map(mirrorFold),
      ...hangingFolds({
        seam: [
          [l + 6, at],
          [r - 6, at],
        ],
        hem,
        hemDip: 22 * fall.dip,
        count: 8,
        width: [1.5, 22 * open],
        shadow: 0.55 * Math.min(1, 0.4 + open),
        light: 0.32 * Math.min(1, 0.4 + open),
        seed: 7,
      }),
    ];
  }
  const from: readonly [Pt, Pt] = inside
    ? [
        [inside.x + 6, inside.y],
        [600 - inside.x - 6, inside.y],
      ]
    : seam;
  return [
    ...gathers({ seam, count: 12, length: [12, 34], width: 2.4, shadow: 0.3, light: 0.22, seed: 3 }),
    ...hangingFolds({
      seam: from,
      hem,
      hemDip: 22,
      count: 8,
      width: [2, 22],
      start: inside ? 0 : 14,
      shadow: 0.55,
      light: 0.32,
      seed: 7,
    }),
  ];
};
const SKIRT_FOLDS: Fold[] = skirtFolds();

/*
  The bodice's: the turn of the cloth under each bust, lit above and in shadow
  below. Every cut keeps it — all of them cover the bust. It had a waist dart
  under each bust point too; the bodice is shaped by princess seams now, or by
  a cut's own — see `princessSeams`.
*/
const BODICE_FOLDS: Fold[] = BUST.points.map(([x]) =>
  contour({ centre: [x, BUST.creaseY], half: 26, sag: 9, width: 7, shadow: 0.24, light: 0.16, soft: 6 })
);

/**
 * An off-shoulder band's folds — see `necklines.ts`. It is a folded band
 * gathered onto the dress, as in the photographs, and was a flat strip with a
 * scalloped ruffle hung from it:
 *
 * - a soft roll along its top edge, where the cloth is folded over — light on
 *   the turn, a little shadow under it, and no topstitch;
 * - fine gathers across the chest and round each arm, lit above and shaded
 *   below, running between its top edge and its lower one;
 * - each arm's part lit as the short sleeve it is: turning away at the outside
 *   of the arm, in the body's shade on the inside;
 * - its lower edge turning under, and the shadow it throws on the bodice.
 */
function bandFolds(band: OffShoulderBand): Fold[] {
  /* a line a share of the way from one edge to the other, rippling a little as gathers do */
  const between = (a: Pt[], b: Pt[], t: number, phase: number): Pt[] =>
    a.map(([x, y], i) => {
      const [bx, by] = b[i];
      const mx = x + (bx - x) * t;
      return [mx, y + (by - y) * t + Math.sin(mx / 17 + phase) * 0.8] as Pt;
    });
  /* an edge as `n` points evenly along its own list, so two edges can be paired point for point */
  const resample = (pts: Pt[], n: number): Pt[] =>
    Array.from({ length: n }, (_, i) => {
      const f = (i / (n - 1)) * (pts.length - 1);
      const k = Math.min(pts.length - 2, Math.floor(f));
      const u = f - k;
      return [pts[k][0] + (pts[k + 1][0] - pts[k][0]) * u, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * u] as Pt;
    });
  const gather = (ridge: Pt[]): Fold => ({ ridge, width: [1.8, 1.8], shadow: 0.16, light: 0.14, soft: 1 });
  const SHARES = [0.3, 0.55, 0.8];

  const roll: Fold = { ridge: band.top.map(([x, y]) => [x, y + 2.5] as Pt), width: [2.4, 2.4], shadow: 0.2, light: 0.4, soft: 1.5 };
  const chest = SHARES.map((t, k) => gather(between(band.topOverLower, band.lower, t, k * 2.1)));
  const arms = band.arms.flatMap((arm, side): Fold[] => {
    /* which way is out from this arm: the left arm's outside is toward smaller x */
    const out = side === 0 ? -1 : 1;
    const top = resample(arm.top, 8);
    const hem = resample(arm.hem, 8);
    const gathered = SHARES.map((t, k) => gather(between(top, hem, t, k * 2.1 + side)));
    return [
      ...gathered,
      { ridge: arm.outer.map(([x, y]) => [x - out * 4, y] as Pt), width: [4, 4], shadow: 0.24, light: 0, soft: 3, shadowToward: [out, 0] },
      { ridge: arm.inner.map(([x, y]) => [x + out * 3, y] as Pt), width: [3, 3], shadow: 0.16, light: 0, soft: 3, shadowToward: [-out, 0] },
      /* the hem turning under */
      { ridge: arm.hem.map(([x, y]) => [x, y - 2.5] as Pt), width: [2.2, 2.2], shadow: 0.12, light: 0, soft: 1.5, shadowToward: [0, 1] },
    ];
  });
  const under: Fold[] = [
    { ridge: band.lower.map(([x, y]) => [x, y - 3] as Pt), width: [2.5, 2.5], shadow: 0.12, light: 0, soft: 1.5, shadowToward: [0, 1] },
    { ridge: band.lower.map(([x, y]) => [x, y + 1] as Pt), width: [3.5, 3.5], shadow: 0.3, light: 0, soft: 2, shadowToward: [0, 1] },
  ];
  return [roll, ...chest, ...arms, ...under];
}

/**
 * The band when sleeves hang from it — see its `raglan` in `necklines.ts`:
 * a folded strip across the bust and both upper arms, the sleeves and the
 * bodice sewn to its lower edge. Its soft roll along the top, and its
 * gathers running across the whole of it, arms and chest alike, since it is
 * one piece; no shadow under its lower edge, which is a seam, not a layer.
 */
function raglanBandFolds(band: OffShoulderBand): Fold[] {
  const { topOverLower, lower } = band.raglan;
  const between = (t: number, phase: number): Pt[] =>
    lower.map(([x, y], i) => {
      const [, ty] = topOverLower[i];
      return [x, ty + (y - ty) * t + Math.sin(x / 17 + phase) * 0.7] as Pt;
    });
  const roll: Fold = { ridge: band.top.map(([x, y]) => [x, y + 2.5] as Pt), width: [2.4, 2.4], shadow: 0.2, light: 0.4, soft: 1.5 };
  const gathers = [0.35, 0.68].map(
    (t, k): Fold => ({ ridge: between(t, k * 2.1), width: [1.8, 1.8], shadow: 0.16, light: 0.14, soft: 1 })
  );
  return [roll, ...gathers];
}

/**
 * A halter's bodice, gathered into its neckband — see `HalterBand` in
 * `necklines.ts`: fine gathers fanning out from the band down over the bust,
 * long ones and short ones between them, as cloth eased into a short seam
 * does; and the soft turn along the band's top, where it is folded.
 */
function halterFolds(h: HalterBand): Fold[] {
  const { seam, upper } = h;
  /* a point `u` of the way along the seam */
  const at = (u: number): Pt => {
    const k = u * (seam.length - 1);
    const i = Math.min(seam.length - 2, Math.floor(k));
    const t = k - i;
    return [seam[i][0] + (seam[i + 1][0] - seam[i][0]) * t, seam[i][1] + (seam[i + 1][1] - seam[i][1]) * t];
  };
  const [fx, fy] = HALTER_FAN;
  const gather = (u: number, reach: number, width: number, shadow: number): Fold => {
    const [sx, sy] = at(u);
    const len = Math.hypot(sx - fx, sy - fy) || 1;
    const [dx, dy] = [(sx - fx) / len, (sy - fy) / len];
    /* bowing a little outward as it goes, the way cloth falls off the bust */
    const bow = (u - 0.5) * 4;
    const ridge: Pt[] = [0, 0.35, 0.7, 1].map((t) => [sx + dx * reach * t + bow * Math.sin(Math.PI * t), sy + 1 + dy * reach * t] as Pt);
    return { ridge, width: [width, 0.3], shadow, light: 0.28, soft: 1 };
  };
  const folds: Fold[] = [];
  for (let k = 0; k < HALTER_GATHERS; k++) {
    /* not evenly: gathered by hand, they bunch a little here and spread there */
    const u = (k + 0.5 + 0.28 * Math.sin(k * 2.9)) / HALTER_GATHERS;
    /* the long ones reach down over the bust, longest at the sides; a short one between each pair */
    const reach = 52 + 26 * Math.abs(2 * u - 1) + 8 * Math.sin(k * 2.3);
    folds.push(gather(u, reach, 1.6, 0.42 + 0.08 * Math.sin(k * 1.7)));
    if (k + 1 < HALTER_GATHERS) folds.push(gather((k + 1 + 0.2 * Math.sin(k * 1.3)) / HALTER_GATHERS, 16 + 6 * Math.sin(k * 3.1), 1.2, 0.34));
  }
  const roll: Fold = { ridge: upper.map(([x, y]) => [x, y + 2] as Pt), width: [1.8, 1.8], shadow: 0.12, light: 0.22, soft: 1 };
  return [...folds, roll];
}
/** Where a halter's gathers fan out from, above the band, and how many long ones there are. */
const HALTER_FAN: Pt = [298, 120];
const HALTER_GATHERS = 13;
/** A halter's neckband, lit as the strip round the neck it is: fullest a little left of centre, turning away at both sides. */
const HALTER_BAND_LIGHT: Stop[] = [
  [0, "#c4c4c4"],
  [0.32, "#ffffff"],
  [0.62, "#f3f3f3"],
  [1, "#bdbdbd"],
];

/**
 * A cowl's light — see `CowlDrape` in `necklines.ts`. Its folds used to be
 * three blurred grey arcs, which read as a smudge on a plain cloth and were
 * lost entirely in a print. Now:
 *
 * - **the edge** is lit as the roll it is: a soft highlight along its crest,
 *   just inside the edge, and a little shade below it;
 * - **each fold** has a lit crest and a soft shadow in the trough below it,
 *   strong enough to read through a busy print, fading as it flattens out
 *   toward the shoulders it hangs from.
 */
function cowlFolds(drape: CowlDrape): Fold[] {
  const roll: Fold = { ridge: drape.roll, width: [3, 3], shadow: 0.18, light: 0.55, soft: 2 };
  const folds = drape.ridges.flatMap((ridge, k): Fold[] => {
    const mid = Math.floor(ridge.length / 2);
    const [left, right] = [ridge.slice(0, mid + 1), ridge.slice(mid)];
    /* lower folds hang a little fuller */
    const w = 6.5 + k;
    /*
      Each fold twice: broad and soft for the turn of the cloth, and narrow
      and firmer at the crest and just under it — the line a print is read by,
      where a broad soft shadow alone sinks into the pattern.
    */
    const broad = (pts: Pt[], width: readonly [number, number]): Fold => ({ ridge: pts, width, shadow: 0.55, light: 0.45, soft: 4 });
    const crest = (pts: Pt[], width: readonly [number, number]): Fold => ({ ridge: pts, width, shadow: 0.5, light: 0.5, soft: 1.5 });
    return [
      broad(left, [1.5, w]),
      broad(right, [w, 1.5]),
      crest(left, [0.4, 2.4]),
      crest(right, [2.4, 0.4]),
    ];
  });
  return [roll, ...folds];
}

/**
 * The same folds as shapes the weave is bent along — see `clothWarp`: a band
 * round each crest, full at the centre and narrowing to nothing at the shoulders.
 */
function cowlRidges(drape: CowlDrape): string {
  return drape.ridges
    .map((ridge) => {
      const n = ridge.length - 1;
      const half = (i: number) => 0.5 + 4.5 * (1 - Math.abs((2 * i) / n - 1) ** 2);
      const above = ridge.map(([x, y], i) => [x, y - half(i)] as Pt);
      const below = ridge.map(([x, y], i) => [x, y + half(i)] as Pt).reverse();
      return `M${[...above, ...below].map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")} Z`;
    })
    .join(" ");
}

/* --------------------------------------------------------------- the wrap */

/** The tie's two tails: how long each hangs below the knot, and how wide it is at the knot and at its end. */
const TIE_TAILS = [
  { length: 160, from: 3, lean: 8, width: [9.5, 8] as const, cut: -5 },
  { length: 185, from: -3, lean: -10, width: [10.5, 8.5] as const, cut: 5 },
];
/** The knot, across and down. */
const KNOT: readonly [number, number] = [15, 11];

/** Points along a cubic from `a` to `d`. */
const cubic = (a: Pt, b: Pt, c: Pt, d: Pt, n: number): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const m = 1 - t;
    return [
      m * m * m * a[0] + 3 * m * m * t * b[0] + 3 * m * t * t * c[0] + t * t * t * d[0],
      m * m * m * a[1] + 3 * m * m * t * b[1] + 3 * m * t * t * c[1] + t * t * t * d[1],
    ] as Pt;
  });

/** A strip of cloth along a centreline, `width` across from its start to its end. */
function strip(centre: Pt[], width: readonly [number, number]): { left: Pt[]; right: Pt[] } {
  const n = centre.length - 1;
  const left: Pt[] = [];
  const right: Pt[] = [];
  centre.forEach(([x, y], i) => {
    const [px, py] = centre[Math.max(0, i - 1)];
    const [qx, qy] = centre[Math.min(n, i + 1)];
    const len = Math.hypot(qx - px, qy - py) || 1;
    const [nx, ny] = [-(qy - py) / len, (qx - px) / len];
    const w = (width[0] + (width[1] - width[0]) * (i / n)) / 2;
    left.push([x - nx * w, y - ny * w]);
    right.push([x + nx * w, y + ny * w]);
  });
  return { left, right };
}

/**
 * The tie at the waist: a small knot, and two tails hanging from it over the
 * skirt, about thirty and thirty-five centimetres — in the bodice's cloth,
 * drawn after the skirt so that it hangs in front of it. Each tail a narrow
 * strip hanging in a slight S, cut on the slant at its end; lit as cloth, with
 * a shadow on the skirt.
 */
function tieArt(at: Pt): RegionArt {
  const knot: Pt = [at[0], at[1] + 3];
  const tails = TIE_TAILS.map(({ length, from, lean, width, cut }) => {
    const top: Pt = [knot[0] + from, knot[1] + 2];
    const end: Pt = [knot[0] + from + lean, knot[1] + length];
    const centre = cubic(top, [top[0] + lean * 0.1, top[1] + length * 0.35], [end[0] - lean * 0.4, end[1] - length * 0.35], end, 24);
    const { left, right } = strip(centre, width);
    /* the end cut on the slant */
    left[left.length - 1] = [left[left.length - 1][0], left[left.length - 1][1] + cut / 2];
    right[right.length - 1] = [right[right.length - 1][0], right[right.length - 1][1] - cut / 2];
    return { centre, left, right, path: outline(left, [...right].reverse()) };
  });
  const knotPts: Pt[] = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    const [rx, ry] = [KNOT[0] / 2, KNOT[1] / 2];
    /* a little squarer than an ellipse, and tipped, as a knot pulled tight is */
    const r = 1 + 0.08 * Math.cos(4 * a);
    const [x, y] = [Math.cos(a) * rx * r, Math.sin(a) * ry * r];
    const tip = -0.25;
    return [knot[0] + x * Math.cos(tip) - y * Math.sin(tip), knot[1] + x * Math.sin(tip) + y * Math.cos(tip)] as Pt;
  });
  const knotPath = outline(knotPts);
  const pieces = [...tails.map((t) => t.path), knotPath];
  /* each tail lit from the upper left: a soft light down its left side, a shade down its right, a twist under the knot */
  const tailFolds: Fold[] = tails.flatMap((t) => [
    { ridge: t.centre.map(([x, y], i) => [x - 1.2, y] as Pt).filter((_, i) => i > 1), width: [1.6, 1.6], shadow: 0, light: 0.3, soft: 1.5 },
    {
      ridge: t.right.map(([x, y]) => [x - 1.4, y] as Pt).filter((_, i) => i > 0),
      width: [1.8, 1.8],
      shadow: 0.3,
      light: 0,
      soft: 1.5,
      shadowToward: [1, 0] as Pt,
    },
    { ridge: t.centre.slice(0, 4), width: [2.5, 0.5], shadow: 0.35, light: 0.1, soft: 1.5 },
  ]);
  /* the knot lit as a small round: light across its top, shade under it — in proportion to its size */
  const [kx, ky] = [KNOT[0] / 2, KNOT[1] / 2];
  const knotFolds: Fold[] = [
    {
      ridge: [[knot[0] - kx * 0.65, knot[1] - ky * 0.35], [knot[0], knot[1] - ky * 0.6], [knot[0] + kx * 0.65, knot[1] - ky * 0.45]],
      width: [2, 2],
      shadow: 0.15,
      light: 0.45,
      soft: 1,
    },
    {
      ridge: [[knot[0] - kx * 0.6, knot[1] + ky * 0.55], [knot[0] + kx * 0.65, knot[1] + ky * 0.5]],
      width: [2, 2],
      shadow: 0.35,
      light: 0,
      soft: 1,
      shadowToward: [0, 1],
    },
  ];
  const nudge = (pts: Pt[], dx: number, dy: number) => pts.map(([x, y]) => [x + dx, y + dy] as Pt);
  return {
    focus: [at[0], at[1] + 80],
    surface: { blur: 3, relief: 3, warp: 1 },
    shape: (fill) => (
      <>
        {pieces.map((d, i) => (
          <path key={i} d={d} fill={fill} />
        ))}
      </>
    ),
    defs: (uid) => (
      <>
        {softShadow(uid("tie-soft"), 2.5)}
        {foldDefs(uid)}
      </>
    ),
    /* its shadow on the skirt */
    cast: (uid) => (
      <g filter={`url(#${uid("tie-soft")})`} fill="#7a7a7a" opacity="0.4">
        {tails.map((t, i) => (
          <path key={i} d={outline(nudge(t.left, 2, 3), [...nudge(t.right, 2, 3)].reverse())} />
        ))}
        <path d={outline(nudge(knotPts, 1.5, 2))} />
      </g>
    ),
    shading: (uid) => foldShadows(uid, [...tailFolds, ...knotFolds]),
    light: (uid) => foldLights(uid, [...tailFolds, ...knotFolds]),
  };
}

/**
 * The folds the tie pulls into the top panel: tension folds running up from
 * the knot across the bodice toward the far side, strongest at the knot and
 * fading as they go, each a little flatter than the edge so that it stays on
 * the panel it is pulling.
 */
function wrapFolds(w: WrapPanel): Fold[] {
  const [qx, qy] = w.tie;
  return [
    { angle: 20, length: 84, start: 6 },
    { angle: 32, length: 74, start: 5 },
    { angle: 44, length: 62, start: 4 },
  ].map(({ angle, length, start }) => {
    const a = (angle * Math.PI) / 180;
    const from: Pt = [qx - start * Math.cos(a), qy - start * Math.sin(a) - 2];
    const to: Pt = [qx - length * Math.cos(a), qy - length * Math.sin(a)];
    /* bowing a little, as cloth drawn to a point does */
    const mid: Pt = [(from[0] + to[0]) / 2 + 3 * Math.sin(a), (from[1] + to[1]) / 2 + 3 * Math.cos(a)];
    return { ridge: [from, mid, to], width: [4.5, 1] as const, shadow: 0.42, light: 0.34, soft: 3 };
  });
}

/* ----------------------------------------------------------- the drawings */

/** The bodice's light, top to bottom. */
const BODICE_DRAPE: Stop[] = [
  [0, "#cfcfcf"],
  [0.16, "#ffffff"],
  [0.7, "#f6f6f6"],
  [1, "#c6c6c6"],
];

const topRegion = (id: NecklineId, sleeve: SleeveChoice, waist: WaistId): RegionArt => {
  const { pieces, stitch, cut, folds, seamed, cuff, edges, bandSleeves, puff, princess } = bodiceFor(id, sleeve, waist);
  /* a puff is lit round and gathered at both ends — see `PuffShape` */
  const puffFolds = puff ? puff.shapes.flatMap((s, i) => puffDrape(s, 60 + i)) : [];
  const puffed = new Set(puff?.sleeves ?? []);
  /*
    An off-shoulder's longer sleeves hang in the drape every fitted sleeve
    does — see `sleeveDrape` — and the band is the top of them: the whole arm,
    band and sleeve, is lit as one tube, so there is no change of light where
    they are sewn together.
  */
  const arm = draft("female");
  /* the fitted one hangs in the shared drape; the loose ones carry their own folds, as on every cut */
  const bandDrape = bandSleeves?.fitted
    ? bandSleeves.shapes.flatMap((path, i) =>
        sleeveDrape({
          sleeve: path,
          underarm: bandSleeves.under,
          cuff: bandSleeves.hem,
          elbowY: arm.elbowY,
          wristY: arm.wristY,
          cuffTop: bandSleeves.cuffTop,
          round: true,
          collects: false,
          seed: 40 + i,
        })
      )
    : [];
  const sleeveCreases = folds.filter((d) => !cut.folds.includes(d));
  /*
    A wrap's top panel: below the V its edge lies on the under panel, so it is
    drawn as every edge lying on cloth is — fine and dark, with a soft shadow
    on the panel under it, on that side only. Above the V it is the cut's own
    edge, against her skin, and the stage draws it so already.
  */
  const wrap = cut.wrap;
  const wrapUnder = wrap
    ? outline(wrap.over, [
        [wrap.tie[0] + 160, wrap.tie[1] + 4],
        [wrap.tie[0] + 160, wrap.apex[1] - 160],
        [wrap.apex[0] - 20, wrap.apex[1] - 160],
      ])
    : "";
  const wrapPanel = wrap
    ? outline(wrap.edge, [
        [wrap.tie[0] + 4, wrap.tie[1] + 30],
        [wrap.edge[0][0] - 160, wrap.tie[1] + 30],
        [wrap.edge[0][0] - 160, wrap.edge[0][1] - 40],
      ])
    : "";
  const bodiceFolds = [
    ...BODICE_FOLDS,
    ...(cut.band ? (bandSleeves ? raglanBandFolds(cut.band) : bandFolds(cut.band)) : []),
    ...(cut.drape ? cowlFolds(cut.drape) : []),
    ...(cut.halter ? halterFolds(cut.halter) : []),
  ];
  /*
    Sewn sleeves, drawn as every top draws them — see `sleevedTop`: outlined
    only along free edges, seams as shadow, lit with the bodice as one surface,
    the shoulder's light carried onto the sleeve head, and the shared drape.
  */
  const [bodyTop, bodyBottom] = seamed ? rowsOf(pieces[0]) : [0, 0];
  const drape = seamed ? sewnDrape(seamed.cut, seamed.sleeves) : [];
  const own = new Set(seamed?.sleeves ?? []);
  return {
    focus: [300, 268],
    surface: {
      blur: 16,
      relief: 5,
      warp: 5,
      /* a sewn sleeve, or an off-shoulder's band and sleeve: one surface across the seam */
      ...(seamed || bandSleeves ? { joined: true } : {}),
      /* a cowl's print bends a little along its folds */
      ...(cut.drape ? { ridges: cowlRidges(cut.drape) } : {}),
    },
    shape: (fill) => (
      <>
        {pieces.map((d, i) => (
          <path key={i} d={d} fill={fill} />
        ))}
      </>
    ),
    ...(seamed || edges
      ? {
          edge: () => (
            <>
              {(seamed?.edges ?? edges ?? []).map((d, i) => (
                <path key={i} d={d} />
              ))}
            </>
          ),
        }
      : {}),
    defs: (uid) => (
      <>
        {vertical(uid("drape"), BODICE_DRAPE)}
        {softShadow(uid("blur"), 5)}
        {sleeveFoldDefs(uid)}
        {foldDefs(uid)}
        {cuff && horizontal(uid("cuff"), CUFF)}
        {cut.halter && horizontal(uid("halter-band"), HALTER_BAND_LIGHT)}
        {/* the body panel and nothing drawn over it: each princess seam starts where a sleeve or a band does */}
        {princess && (
          <mask id={uid("princess")} maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="1000">
            <path d={pieces[0]} fill="#fff" />
            {pieces.slice(1).map((d, i) => (
              <path key={i} d={d} fill="#000" />
            ))}
          </mask>
        )}
        {wrap && (
          <>
            <mask id={uid("wrap-under")} maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="1000">
              <path d={wrapUnder} fill="#fff" />
            </mask>
            <mask id={uid("wrap-panel")} maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="1000">
              <path d={wrapPanel} fill="#fff" />
            </mask>
            <filter id={uid("wrap-soft")} filterUnits="userSpaceOnUse" x="0" y="0" width="600" height="1000">
              <feGaussianBlur stdDeviation={1.6} />
            </filter>
          </>
        )}
        {puff && (
          <>
            {puffLightDefs(uid, puff.shapes)}
            <mask id={uid("puffs")} maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="1000">
              {puff.sleeves.map((d, i) => (
                <path key={i} d={d} fill="#fff" />
              ))}
              {puff.over.map((d, i) => (
                <path key={`over-${i}`} d={d} fill="#000" />
              ))}
            </mask>
          </>
        )}
        {bandSleeves && (
          <mask id={uid("band-sleeves")} maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="1000">
            {[...bandSleeves.paths, bandSleeves.band].map((d, i) => (
              <path key={i} d={d} fill="#fff" />
            ))}
            {(cuff?.bands ?? []).map((d, i) => (
              <path key={`over-${i}`} d={d} fill="#000" />
            ))}
          </mask>
        )}
        {seamed && (
          <>
            <linearGradient id={uid("fall")} gradientUnits="userSpaceOnUse" x1="0" y1={bodyTop} x2="0" y2={bodyBottom}>
              {shoulderFall(BODICE_DRAPE).map(([o, c]) => (
                <stop key={o} offset={o} stopColor={c} />
              ))}
            </linearGradient>
            <mask id={uid("fold-sleeves")} maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="1000">
              {seamed.sleeves.map((d, i) => (
                <path key={i} d={d} fill="#fff" />
              ))}
            </mask>
          </>
        )}
      </>
    ),
    shading: (uid) => (
      <>
        {/* a puff takes its own light, not the bodice's fall */}
        {pieces
          .filter((d) => !puffed.has(d))
          .map((d, i) => (
            <path key={i} d={d} fill={`url(#${uid(own.has(d) ? "fall" : "drape")})`} />
          ))}
        {puff && (
          <g mask={`url(#${uid("puffs")})`}>
            {puffShade(uid, puff.sleeves)}
            {foldShadows(uid, puffFolds)}
          </g>
        )}
        {/* the cut's own seams down the bodice — a sweetheart's, from each curve to the waist */}
        {cut.seams && seamShadows(uid, cut.seams.map((s) => line(s)))}
        {/*
          Or its princess seams, on the body panel. A wrap's top panel crosses
          from her left over to her right, so the seam on her right is on the
          panel under it, and goes under it.
        */}
        {princess && (
          <g mask={`url(#${uid("princess")})`}>
            {seamShadows(uid, [princess[0]])}
            {wrap ? (
              <g mask={`url(#${uid("wrap-under")})`}>{seamShadows(uid, [princess[1]])}</g>
            ) : (
              seamShadows(uid, [princess[1]])
            )}
          </g>
        )}
        {/* a halter's neckband, lit round the neck, and the seam the bodice is gathered into */}
        {cut.halter && (
          <>
            <path d={cut.extras[0]} fill={`url(#${uid("halter-band")})`} />
            {seamShadows(uid, [line(cut.halter.seam)])}
          </>
        )}
        {/*
          Drape that is shading rather than silhouette — a cowl's rolls, the
          twist where a halter's straps cross. Drawn as cloth they would be the
          same fill as the panel behind them and therefore invisible; what makes
          them read is the shadow under each fold.
        */}
        <g filter={`url(#${uid("blur")})`}>
          {cut.folds.map((d) => (
            <path
              key={d}
              d={d}
              fill="none"
              stroke="#a9a9a9"
              strokeWidth="15"
              strokeLinecap="round"
              opacity="0.5"
            />
          ))}
        </g>
        {sleeveFolds(uid, sleeveCreases)}
        {foldShadows(uid, bodiceFolds)}
        {wrap && (
          <>
            {/* the folds the tie pulls into the top panel, kept to it */}
            <g mask={`url(#${uid("wrap-panel")})`}>{foldShadows(uid, wrapFolds(wrap))}</g>
            {/* the top panel's edge lying on the under panel: its shadow there, then the edge */}
            <g mask={`url(#${uid("wrap-under")})`}>
              <path
                d={line(wrap.over)}
                fill="none"
                stroke="#5c4a3e"
                strokeOpacity={0.5}
                strokeWidth={3.2}
                strokeLinejoin="round"
                filter={`url(#${uid("wrap-soft")})`}
              />
            </g>
            <path d={line(wrap.over)} fill="none" stroke="#241e19" strokeOpacity={0.22} strokeWidth={2} strokeLinejoin="round" />
          </>
        )}
        {bandDrape.length > 0 && <g mask={`url(#${uid("band-sleeves")})`}>{foldShadows(uid, bandDrape)}</g>}
        {/* where each sleeve is sewn to the band: a seam, and the band's gathers end at it */}
        {bandSleeves && seamShadows(uid, bandSleeves.seams)}
        {seamed && (
          <>
            <g mask={`url(#${uid("fold-sleeves")})`}>{foldShadows(uid, drape)}</g>
            {seamShadows(uid, seamed.seams)}
          </>
        )}
        {/* the cuffs: each band's light, its seam on a sleeve cut on, and its marks */}
        {cuff && (
          <>
            {cuff.bands.map((d, i) => (
              <path key={i} d={d} fill={`url(#${uid("cuff")})`} />
            ))}
            {!seamed && seamShadows(uid, cuff.cut.seams)}
            {cuffMarks(uid, cuff.cut)}
          </>
        )}
      </>
    ),
    light: (uid) => (
      <>
        {foldLights(uid, bodiceFolds)}
        {/* a keyhole's loop: a rouleau, rounded, catching the light along its rim */}
        {cut.loopRim && <path d={line(cut.loopRim)} fill="none" stroke="#ffffff" strokeWidth={0.7} strokeLinecap="round" opacity={0.45} />}
        {puff && (
          <g mask={`url(#${uid("puffs")})`}>{foldLights(uid, puffFolds)}</g>
        )}
        {wrap && <g mask={`url(#${uid("wrap-panel")})`}>{foldLights(uid, wrapFolds(wrap))}</g>}
        {bandDrape.length > 0 && <g mask={`url(#${uid("band-sleeves")})`}>{foldLights(uid, bandDrape)}</g>}
        {cuff?.cut.folds.length ? foldLights(uid, cuff.cut.folds) : null}
        {seamed && <g mask={`url(#${uid("fold-sleeves")})`}>{foldLights(uid, drape)}</g>}
      </>
    ),
    stitch,
    /* a wrap's tie, hanging over the skirt */
    ...(wrap ? { over: tieArt(wrap.tie) } : {}),
  };
};

/** The cut the dress arrives in when nothing has chosen one. */
const DEFAULT_CUT: NecklineId = "round";

const tops = new Map<string, RegionArt>();

/** The bodice region for a cut, a sleeve and a waist, drawn once and kept. */
const topFor = (choice: GarmentChoice): RegionArt => {
  const id = (NECKLINE_IDS as readonly string[]).includes(choice.neckline ?? "")
    ? (choice.neckline as NecklineId)
    : DEFAULT_CUT;
  const sleeve = choice.sleeve ?? DEFAULT_SLEEVE;
  const waist = choice.skirt?.waist ?? "natural";
  const key = `${id}|${sleeve.type}|${sleeve.length}|${sleeve.cuff ?? "none"}|${waist}`;
  let region = tops.get(key);
  if (!region) {
    region = topRegion(id, sleeve, waist);
    tops.set(key, region);
  }
  return region;
};

/**
 * The skirt's region in a style, on its own or under a jacket, where it comes
 * out from under the hem — and, hung from above her waist, behind the sleeves
 * hanging beside it: `under`.
 */
const bottomRegion = (inside?: Tuck, skirt: SkirtChoice = DEFAULT_SKIRT, under: string[] = []): RegionArt => {
  const sk = skirtFor(inside, skirt);
  const folds = inside || !sameSkirt(skirt, DEFAULT_SKIRT) ? skirtFolds(inside, skirt) : SKIRT_FOLDS;
  return {
    ...(under.length ? { under } : {}),
    focus: [300, 580],
    surface: { blur: 16, relief: 5, warp: 5 },
    shape: (fill) => <path d={sk.path} fill={fill} />,
    defs: (uid) => (
      <>
        {vertical(uid("drape"), DRAPE)}
        {foldDefs(uid)}
      </>
    ),
    shading: (uid) => (
      <>
        <path d={sk.path} fill={`url(#${uid("drape")})`} />
        {foldShadows(uid, folds)}
      </>
    ),
    light: (uid) => foldLights(uid, folds),
    stitch: `M${sk.waistLeft[0] + 6} ${seamAt(skirt.waist) - 2} L${594 - sk.waistLeft[0]} ${seamAt(skirt.waist) - 2}`,
  };
};

const bottoms = new Map<string, RegionArt>();

export const dressFront: GarmentArt = {
  regions: {
    top: topFor({}),
    bottom: bottomRegion(),
  },
  /**
   * Recut to a neckline, a sleeve and a skirt. The skirt changes with its own
   * style, or a jacket over it — and, hung from above her waist, with the
   * sleeves: it falls beside her arms there, and a sleeve hangs in front of
   * it, so it is drawn behind whatever cloth lies over them.
   */
  cut: (choice): Partial<Record<FabricRegionId, RegionArt>> => {
    const { inside, skirt = DEFAULT_SKIRT } = choice;
    if (!inside && sameSkirt(skirt, DEFAULT_SKIRT)) return { top: topFor(choice) };
    const id = (NECKLINE_IDS as readonly string[]).includes(choice.neckline ?? "")
      ? (choice.neckline as NecklineId)
      : DEFAULT_CUT;
    const sleeve = choice.sleeve ?? DEFAULT_SLEEVE;
    const under = hangs(skirt) ? bodiceFor(id, sleeve, skirt.waist).armCover : [];
    const key =
      `${skirtKey(skirt)}|${inside ? `${inside.y}|${inside.x}` : ""}` +
      (under.length ? `|${id}|${sleeve.type}|${sleeve.length}|${sleeve.cuff ?? "none"}` : "");
    if (!bottoms.has(key)) bottoms.set(key, bottomRegion(inside, skirt, under));
    return { top: topFor(choice), bottom: bottoms.get(key)! };
  },
  /** The cuffs' hardware — the near side's only, on a cut with one sleeve. */
  cuffTrim: (choice) => {
    const id = (NECKLINE_IDS as readonly string[]).includes(choice.neckline ?? "")
      ? (choice.neckline as NecklineId)
      : DEFAULT_CUT;
    const cuff = bodiceFor(id, choice.sleeve ?? DEFAULT_SLEEVE, choice.skirt?.waist).cuff;
    if (!cuff) return null;
    const { left, right } = cuff.cut.trim;
    return <CuffHardware trims={cuff.oneSided ? [left] : [left, right]} />;
  },
  /** The cut's buttons — a shirt-dress's placket, a keyhole's closure — drawn under any collar. */
  cutTrim: (choice) => {
    const id = (NECKLINE_IDS as readonly string[]).includes(choice.neckline ?? "")
      ? (choice.neckline as NecklineId)
      : DEFAULT_CUT;
    const buttons = bodiceFor(id, choice.sleeve ?? DEFAULT_SLEEVE, choice.skirt?.waist).cut.buttons;
    if (!buttons) return null;
    return litButtons(buttons.at, buttons.r);
  },
  armCover: (choice) =>
    bodiceFor(
      (NECKLINE_IDS as readonly string[]).includes(choice.neckline ?? "")
        ? (choice.neckline as NecklineId)
        : DEFAULT_CUT,
      choice.sleeve ?? DEFAULT_SLEEVE,
      choice.skirt?.waist
    ).armCover,
  /** The whole dress as cut — bodice and skirt — for the shape picker. */
  silhouette: (choice) => cloth(choice),
};

/** The seam a collar is sewn to, for the cut the dress defaults to. */
export const NECK_SEAM = BODICES[DEFAULT_CUT].cut.seam;
