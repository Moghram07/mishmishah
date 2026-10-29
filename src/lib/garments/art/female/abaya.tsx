import { DRAPE, vertical } from "@/lib/garments/shading";
import { foldDefs, foldLights, foldShadows, hangingFolds, mirrorFold, rowSpan } from "@/lib/garments/folds";
import { hem, line, mirrorPts, type Pt } from "@/lib/garments/fit";
import type { GarmentArt } from "../index";
import { rowsOf, sewnDrape, shoulderFall } from "../sleevedTop";
import { seamShadows, sleeveFoldDefs } from "../sleeveFolds";
import { ABAYA, ROBE } from "./abayaCut";

/**
 * Abaya, front: a loose robe open down the front, over whatever she wears —
 * see `openRobe` in `garments/sleeves.ts` for how it is cut, and
 * `abayaCut.ts` for its numbers.
 *
 * One fabric, the whole of it. Its sleeves are sewn sleeves drawn as every
 * top draws them — outlined only along their free edges, the armhole a soft
 * line of shadow, the shoulder's light carried onto the sleeve head, the
 * shared drape down each — and they hang in front of its body, which falls
 * wider than her arms. Down each front a few long folds fall from under the
 * arm to the hem, opening as the robe widens. It holds what is worn under it:
 * from the shoulders to the hem that shows only between the fronts, at the
 * cuffs and below the hem — see `encloses`.
 *
 * It claims no torso, hip or leg: its fronts stand open over them, and what
 * shows there is whatever is worn under it, or her.
 */

const pieces = [ROBE.right, ROBE.left, ROBE.sleeveLeft, ROBE.sleeveRight];
const edges = [ROBE.edges.right, ROBE.edges.left, ROBE.edges.sleeveLeft, ROBE.edges.sleeveRight];
const sleeves = [ROBE.sleeveLeft, ROBE.sleeveRight];
const [bodyTop, bodyBottom] = rowsOf(ROBE.panel);
const drape = sewnDrape(ROBE.cut);

/*
  The long folds down each front: released under the arm, where the robe
  leaves her, and falling to the hem, opening as it widens — three to a
  front, between its side and its edge.
*/
const FROM = ROBE.underarm + 30;
const [frontEdge] = ROBE.frontEdges;
const edgeAt = (y: number): number => {
  for (let i = 1; i < frontEdge.length; i++) {
    const [[x0, y0], [x1, y1]] = [frontEdge[i - 1], frontEdge[i]];
    if (y1 >= y) return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0 || 1);
  }
  return frontEdge[frontEdge.length - 1][0];
};
const across = rowSpan(ROBE.left, FROM) ?? [200, 280];
const hemLeft = ROBE.encloses.hem.x;
const foot = frontEdge[frontEdge.length - 1];
const folds = hangingFolds({
  seam: [
    [across[0] + 8, FROM],
    [edgeAt(FROM) - 10, FROM],
  ],
  hem: [
    [hemLeft + 8, ABAYA.hemY],
    [foot[0] - 10, foot[1]],
  ],
  count: 3,
  width: [2, 16],
  shadow: 0.45,
  light: 0.26,
  seed: 53,
});
const FOLDS = [...folds, ...folds.map(mirrorFold)];

/* the hem's topstitch, eight units up, and each front edge's, set in along it */
const hemStitch = hem([hemLeft + 6, ABAYA.hemY - 8], [600 - hemLeft - 6, ABAYA.hemY - 8], 12, 24);
const edgeStitch = (edge: Pt[], inward: number): Pt[] =>
  edge.map(([x, y]) => [x + inward, y] as Pt).filter(([, y]) => y < foot[1] - 10);
const STITCH = [
  ROBE.stitch,
  line(hemStitch.filter(([x]) => x < foot[0] - 12)),
  line(mirrorPts(hemStitch.filter(([x]) => x < foot[0] - 12))),
  line(edgeStitch(ROBE.frontEdges[0], -5)),
  line(edgeStitch(ROBE.frontEdges[1], 5)),
].join(" ");

export const abayaFront: GarmentArt = {
  regions: {
    body: {
      focus: [300, 420],
      surface: { blur: 18, relief: 5, warp: 5, joined: true },
      shape: (fill) => (
        <>
          {pieces.map((d, i) => (
            <path key={i} d={d} fill={fill} />
          ))}
        </>
      ),
      edge: () => (
        <>
          {edges.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </>
      ),
      defs: (uid) => (
        <>
          {vertical(uid("drape"), DRAPE)}
          <linearGradient id={uid("fall")} gradientUnits="userSpaceOnUse" x1="0" y1={bodyTop} x2="0" y2={bodyBottom}>
            {shoulderFall(DRAPE).map(([o, c]) => (
              <stop key={o} offset={o} stopColor={c} />
            ))}
          </linearGradient>
          {sleeveFoldDefs(uid)}
          {foldDefs(uid)}
          <mask id={uid("fold-sleeves")} maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="1000">
            {sleeves.map((d, i) => (
              <path key={i} d={d} fill="#fff" />
            ))}
          </mask>
          <mask id={uid("fold-fronts")} maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="1000">
            <path d={ROBE.right} fill="#fff" />
            <path d={ROBE.left} fill="#fff" />
            {sleeves.map((d, i) => (
              <path key={i} d={d} fill="#000" />
            ))}
          </mask>
        </>
      ),
      shading: (uid) => (
        <>
          <path d={ROBE.right} fill={`url(#${uid("drape")})`} />
          <path d={ROBE.left} fill={`url(#${uid("drape")})`} />
          {sleeves.map((d, i) => (
            <path key={i} d={d} fill={`url(#${uid("fall")})`} />
          ))}
          <g mask={`url(#${uid("fold-fronts")})`}>{foldShadows(uid, FOLDS)}</g>
          <g mask={`url(#${uid("fold-sleeves")})`}>{foldShadows(uid, drape)}</g>
          {seamShadows(uid, ROBE.seams)}
        </>
      ),
      light: (uid) => (
        <>
          <g mask={`url(#${uid("fold-fronts")})`}>{foldLights(uid, FOLDS)}</g>
          <g mask={`url(#${uid("fold-sleeves")})`}>{foldLights(uid, drape)}</g>
        </>
      ),
      stitch: STITCH,
    },
  },
  armCover: () => sleeves,
  encloses: ROBE.encloses,
};
