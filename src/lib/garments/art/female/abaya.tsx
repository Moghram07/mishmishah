import { DRAPE, vertical } from "@/lib/garments/shading";
import { foldDefs, foldLights, foldShadows, hangingFolds, mirrorFold, rowSpan, type Fold } from "@/lib/garments/folds";
import { draft, hem, line, mirrorPts, type Pt } from "@/lib/garments/fit";
import type { Robe } from "@/lib/garments/sleeves";
import type { GarmentArt, GarmentChoice, RegionArt } from "../index";
import { rowsOf, sewnDrape, shoulderFall } from "../sleevedTop";
import { seamShadows, sleeveFoldDefs, sleeveFolds } from "../sleeveFolds";
import { ABAYA, bodyOf, closedStitch, robeFor } from "./abayaCut";

/**
 * Abaya, front: a loose robe over whatever she wears, open down the front or
 * closed, with a regular, a wide, a kimono or a butterfly sleeve — see `robe`
 * in `garments/sleeves.ts` for how it is cut, and `abayaCut.ts` for its
 * numbers.
 *
 * One fabric, the whole of it. Its sleeves are drawn as every top draws them —
 * the shoulder's light carried down onto each — and they hang in front of its
 * body, which falls wider than her arms. A regular sleeve is a sewn one:
 * outlined only along its free edges, its armhole a soft line of shadow, the
 * shared drape down it. A wide one is the bell, outlined all round and folded
 * as it flares. A kimono's is cut in one with the body, laid over it with no
 * seam where it leaves the shoulder, and folded under the arm. A butterfly
 * has no sleeve to draw: its wings are its body, hung as a cape from her
 * arms, which show under the cloth only as its light along them and its
 * shadow beside them; its hand comes out under a lip at the wrist. A few long
 * folds fall from under each arm to the hem, opening as the robe widens — and
 * more of them from a butterfly's arms. It holds what is worn under it: from
 * the shoulders to the hem that shows only between the fronts, in its
 * neckline, at the cuffs and below the hem — see `encloses`.
 *
 * Closed, the fronts meet down the centre on hidden snaps: one panel with a
 * plain seam down the middle, topstitched beside it on the front that laps
 * over, and what is worn under it shows only in its neckline.
 *
 * It claims no torso, hip or leg, open or closed: open, its fronts stand
 * apart over them, and what shows there is whatever is worn under it, or her;
 * closed, its cloth simply paints over them.
 */

/** One way of wearing it at the front: its body's pieces and edges, its folds, seams and stitch. */
interface FrontArt {
  body: string[];
  edges: string[];
  folds: Fold[];
  seams: string[];
  stitch: string;
}

/** Its body region, open and closed, cut with one sleeve. */
function regionsOf(robe: Robe): { open: RegionArt; closed: RegionArt } {
  const sleeves = robe.sleeves;
  const [bodyTop, bodyBottom] = rowsOf(robe.panel);
  /* a sewn sleeve hangs in the shared drape; a bell and a kimono have folds of their own */
  const drape = sewnDrape(robe.cut);

  /*
    The long folds down each front: released under the arm, where the robe
    leaves her, and falling to the hem, opening as it widens — three to a
    front, between its side and its edge. A butterfly has no sleeve of its
    own: its wings are its body, hung from her arms with all the cloth a
    farasha has to spare, so its folds fall from where they leave the arm
    and there are more of them.
  */
  const cape = sleeves.length === 0;
  const FROM = robe.underarm + 30;
  const [frontEdge] = robe.open.frontEdges;
  const edgeAt = (y: number): number => {
    for (let i = 1; i < frontEdge.length; i++) {
      const [[x0, y0], [x1, y1]] = [frontEdge[i - 1], frontEdge[i]];
      if (y1 >= y) return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0 || 1);
    }
    return frontEdge[frontEdge.length - 1][0];
  };
  const across = rowSpan(robe.open.left, FROM) ?? [200, 280];
  const hemLeft = robe.encloses.hem.x;
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
    count: cape ? 5 : 3,
    width: [2, cape ? 20 : 16],
    shadow: 0.45,
    light: 0.26,
    seed: 53,
  });
  /*
    A butterfly over her arms: its cloth lies on each arm from the shoulder
    to the wrist and falls away from the arm's inner side, toward her — lit
    along the arm, in shadow beside it — and is in shadow just inside the
    opening its hand comes out of.
  */
  const arm = draft("female");
  const wrist = robe.cut.left.wrist;
  const onArms: Fold[] = wrist
    ? [
        {
          ridge: Array.from({ length: 9 }, (_, i) => {
            const y = robe.underarm + 4 + ((arm.wristY - robe.underarm - 4) * i) / 8;
            return [arm.armInAt(y, 0), y] as Pt;
          }),
          width: [6, 9],
          shadow: 0.4,
          light: 0.22,
          soft: 6,
          shadowToward: [1, 0],
        },
        { ridge: wrist.map(([x, y]) => [x, y + 1] as Pt), width: [5, 5], shadow: 0.5, light: 0, soft: 4, shadowToward: [0, 1] },
      ]
    : [];
  const ARMS = [...onArms, ...onArms.map(mirrorFold)];
  const FOLDS = [...folds, ...folds.map(mirrorFold), ...ARMS];

  /* the hem's topstitch, eight units up, and each front edge's, set in along it */
  const hemStitch = hem([hemLeft + 6, ABAYA.hemY - 8], [600 - hemLeft - 6, ABAYA.hemY - 8], 12, 24);
  const edgeStitch = (edge: Pt[], inward: number): Pt[] =>
    edge.map(([x, y]) => [x + inward, y] as Pt).filter(([, y]) => y < foot[1] - 10);
  const STITCH = [
    robe.stitch,
    line(hemStitch.filter(([x]) => x < foot[0] - 12)),
    line(mirrorPts(hemStitch.filter(([x]) => x < foot[0] - 12))),
    line(edgeStitch(robe.open.frontEdges[0], -5)),
    line(edgeStitch(robe.open.frontEdges[1], 5)),
  ].join(" ");

  const OPEN: FrontArt = {
    body: bodyOf("open", robe),
    edges: [robe.open.edges.right, robe.open.edges.left],
    folds: FOLDS,
    seams: robe.seams,
    stitch: STITCH,
  };

  /*
    Closed, the same folds across the one panel: released under each arm and
    falling to the hem between its side and the centre seam — four to a half,
    so they lie as far apart as they do on an open front.
  */
  const [seamTop, seamFoot] = [robe.closed.seam[0], robe.closed.seam[robe.closed.seam.length - 1]];
  const closedFolds = hangingFolds({
    seam: [
      [across[0] + 8, FROM],
      [seamTop[0] - 10, FROM],
    ],
    hem: [
      [hemLeft + 8, ABAYA.hemY],
      [seamFoot[0] - 10, seamFoot[1]],
    ],
    count: cape ? 6 : 4,
    width: [2, cape ? 20 : 16],
    shadow: 0.45,
    light: 0.26,
    seed: 53,
  });

  const CLOSED: FrontArt = {
    body: bodyOf("closed", robe),
    edges: [robe.closed.edge],
    folds: [...closedFolds, ...closedFolds.map(mirrorFold), ...ARMS],
    /* the centre seam it closes under, a soft line like the armholes' */
    seams: [...robe.seams, line(robe.closed.seam)],
    /* the hem's topstitch right across, and the placket's beside the seam */
    stitch: [robe.stitch, line(hemStitch), line(closedStitch(robe))].join(" "),
  };

  const region = (front: FrontArt): RegionArt => {
    const pieces = [...front.body, ...sleeves];
    const edges = [...front.edges, ...robe.sleeveEdges];
    return {
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
            {front.body.map((d, i) => (
              <path key={`body-${i}`} d={d} fill="#fff" />
            ))}
            {sleeves.map((d, i) => (
              <path key={i} d={d} fill="#000" />
            ))}
          </mask>
        </>
      ),
      shading: (uid) => (
        <>
          {front.body.map((d, i) => (
            <path key={`body-${i}`} d={d} fill={`url(#${uid("drape")})`} />
          ))}
          {sleeves.map((d, i) => (
            <path key={i} d={d} fill={`url(#${uid("fall")})`} />
          ))}
          <g mask={`url(#${uid("fold-fronts")})`}>{foldShadows(uid, front.folds)}</g>
          <g mask={`url(#${uid("fold-sleeves")})`}>{foldShadows(uid, drape)}</g>
          {sleeveFolds(uid, robe.sleeveFolds)}
          {seamShadows(uid, front.seams)}
        </>
      ),
      light: (uid) => (
        <>
          <g mask={`url(#${uid("fold-fronts")})`}>{foldLights(uid, front.folds)}</g>
          <g mask={`url(#${uid("fold-sleeves")})`}>{foldLights(uid, drape)}</g>
        </>
      ),
      stitch: front.stitch,
    };
  };

  return { open: region(OPEN), closed: region(CLOSED) };
}

/* each sleeve's regions, drawn once */
const REGIONS = new Map<Robe, { open: RegionArt; closed: RegionArt }>();
const regionsFor = (choice: GarmentChoice) => {
  const robe = robeFor(choice);
  let r = REGIONS.get(robe);
  if (!r) {
    r = regionsOf(robe);
    REGIONS.set(robe, r);
  }
  return r;
};

export const abayaFront: GarmentArt = {
  /* as it arrives: open, with its regular sleeve */
  regions: {
    body: regionsFor({}).open,
  },
  cut: (choice) => {
    const r = regionsFor(choice);
    if (choice.front === "closed") return { body: r.closed };
    return r.open === regionsFor({}).open ? {} : { body: r.open };
  },
  armCover: (choice) => robeFor(choice).sleeveAreas,
  encloses: (choice) => robeFor(choice).encloses,
};
