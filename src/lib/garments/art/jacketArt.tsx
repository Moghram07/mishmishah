import { DRAPE, softShadow, vertical } from "@/lib/garments/shading";
import { foldDefs, foldLights, foldShadows, jacketFolds } from "@/lib/garments/folds";
import type { Tailored } from "@/lib/garments/sleeves";
import { rowsOf, sewnDrape, shoulderFall } from "./sleevedTop";
import { seamFolds, sleeveFoldDefs } from "./sleeveFolds";
import type { GarmentArt } from "./index";
import { litButtons } from "./buttons";

/** What a jacket has that its construction does not: pockets, a welt, darts, a button. */
export interface JacketDetails {
  focus: [number, number];
  /** The flap pockets, left and right, and the shadow each throws below it. */
  flaps: readonly [string, string];
  flapCasts: readonly [string, string];
  /** The breast welt: a mark on the cloth, not a piece of it. */
  welt: string;
  /** The left front's dart: where it starts at the chest, that row, and the row it runs to. */
  dart: { x: number; from: number; to: number };
  buttonY: number;
  buttonR: number;
}

/**
 * A tailored jacket's drawing, his and hers alike — see `tailored` in
 * `garments/sleeves.ts` for how it is cut.
 *
 * Its sleeves are sewn sleeves and drawn as every top draws them: outlined
 * only along their free edges, the armhole a soft fold, lit with the
 * fronts as one surface, the shoulder's light carried onto the sleeve head and
 * the shared drape down each sleeve. It holds whatever is worn under it — see
 * `encloses` — and lies over the arms, so a bare forearm is never painted back
 * over its sleeves.
 */
export function jacketArt(J: Tailored, x: JacketDetails): GarmentArt {
  const pieces = [J.right, J.left, J.sleeveLeft, J.sleeveRight, x.flaps[0], x.flaps[1]];
  const edges = [J.edges.right, J.edges.left, J.edges.sleeveLeft, J.edges.sleeveRight, x.flaps[0], x.flaps[1]];
  const sleeves = [J.sleeveLeft, J.sleeveRight];
  const [bodyTop, bodyBottom] = rowsOf(J.panel);
  const drape = sewnDrape(J.cut);
  const seams = seamFolds(J.seams);
  /* the fronts' own: folds pulled toward the button, and darts that follow the body */
  const fronts = jacketFolds({ button: [300, x.buttonY], side: J.cut.left.side, dart: x.dart, seed: 37 });
  return {
    regions: {
      body: {
        focus: x.focus,
        surface: { blur: 16, relief: 5, warp: 5, joined: true },
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
            {softShadow(uid("soft"), 2)}
            {sleeveFoldDefs(uid)}
            {foldDefs(uid)}
            <mask id={uid("fold-sleeves")} maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="1000">
              {sleeves.map((d, i) => (
                <path key={i} d={d} fill="#fff" />
              ))}
            </mask>
            <mask id={uid("fold-fronts")} maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="1000">
              <path d={J.right} fill="#fff" />
              <path d={J.left} fill="#fff" />
              {[...sleeves, ...x.flaps].map((d, i) => (
                <path key={i} d={d} fill="#000" />
              ))}
            </mask>
          </>
        ),
        shading: (uid) => (
          <>
            <path d={J.right} fill={`url(#${uid("drape")})`} />
            <path d={J.left} fill={`url(#${uid("drape")})`} />
            {sleeves.map((d, i) => (
              <path key={i} d={d} fill={`url(#${uid("fall")})`} />
            ))}
            <g filter={`url(#${uid("soft")})`} opacity="0.45">
              <path d={x.flapCasts[0]} fill="#8a8a8a" />
              <path d={x.flapCasts[1]} fill="#8a8a8a" />
            </g>
            <path d={x.welt} fill="#9a9a9a" opacity="0.55" />
            <g mask={`url(#${uid("fold-fronts")})`}>{foldShadows(uid, fronts)}</g>
            <g mask={`url(#${uid("fold-sleeves")})`}>{foldShadows(uid, drape)}</g>
            {foldShadows(uid, seams)}
          </>
        ),
        light: (uid) => (
          <>
            <g mask={`url(#${uid("fold-fronts")})`}>{foldLights(uid, fronts)}</g>
            <g mask={`url(#${uid("fold-sleeves")})`}>{foldLights(uid, drape)}</g>
            {foldLights(uid, seams)}
          </>
        ),
        stitch: J.stitch,
      },
    },
    armCover: () => sleeves,
    encloses: J.encloses,
    trim: (
      <>
        {litButtons([[300, x.buttonY]], x.buttonR)}
        {/* the buttons at each sleeve's end, up its outer side, touching — over the sleeve, which the arm is never painted over */}
        {litButtons(J.sleeveButtons.at, J.sleeveButtons.r)}
      </>
    ),
  };
}
