import {
  cutEdge,
  softShadow,
  vertical,
} from "@/lib/garments/shading";
import { opening, standBehind } from "../yoke";
import { reverse, run } from "@/lib/garments/fit";
import { behindBandArt } from "../../behindBand";
import type { GarmentArt } from "../../index";

/**
 * Ruffled collar: a gathered frill standing round the throat.
 *
 * **The front of one.** It used to be a complete ring — thirteen scallops swept
 * the whole way round a centre on the figure's axis, with a hole cut in the
 * middle for the neck to come through — and every word of the argument for
 * that was about how a ruff is built rather than about what you can see. Head
 * on you cannot see the back of a collar. What the closed sweep drew was the
 * far side of the frill, floating above the throat where the head is, and the
 * neck rising through a hole in it: a 3D ring pasted onto a 2D drawing.
 *
 * So the sweep stops at the sides. Eight scallops run from beside the neck,
 * down round the front, and up to the other side; the top is simply open, and
 * the neck rises out of it in front of nothing. The five that would have
 * closed it are behind the neck, and the piece that stands for them is
 * `standBehind`, drawn *under* the photograph where the back of a band belongs.
 *
 * Two earlier failures are still worth keeping off: it must not be a filled
 * disc (the head then sits on a plate with no neck under it), and it must not
 * reach the jaw at y 152 — nothing in this stage is ever drawn in front of a
 * collar, so cloth up there is cloth across a face. An open sweep satisfies the
 * first by construction; `UP` still holds the second.
 */

/** Thirteen: enough to read as gathered, few enough for each bump to show. */
const SCALLOPS = 13;

/**
 * The centre the sweep is struck from — her neck's own centre, on the column.
 *
 * It was the canvas centre, x 300, while the gathered edge is her neckline,
 * cut about her neck three units to the left of it. So the scallops were
 * struck about one line and sewn to a seam centred on another, and the two
 * ends came out different: the left one pinched to a point, the right one
 * rounded. Struck from the centre the neckline is cut about, the sweep and the
 * edge it is gathered onto are one symmetric shape.
 *
 * Only the front of the sweep is drawn, so this is no longer the centre of
 * anything you can see: it is where the frill would be gathered if you could
 * see round the back of it. It stays on the column and level with the throat
 * because that is what puts the two visible ends beside the neck, which is
 * where cloth gathered round a throat passes out of sight.
 */
const RING = { x: opening(6).center, y: 168 };

/**
 * How far the frill reaches, in canvas units.
 *
 * Three radii rather than one, because a ruff is none of it circular. It
 * **spreads sideways** far more than it stands up, and it **hangs**: gathered
 * cloth falls under its own weight, so there is more of it below the band than
 * above. `UP` is what holds the whole collar under the jawline at y 152:
 * fifteen units above a centre at 168 puts the topmost scallop tip at 153.
 */
const OUT = 56;
const UP = 15;
/*
  Seventy-two, not fifty-eight. With the back of the sweep no longer drawn the
  frill lost the fifteen units it used to reach *above* the neck, and a ruff
  measured 10.4 cm deep against the 12–18 its record declares. The answer is
  not to put the back half back: gathered cloth hangs, so the length it lost
  above belongs below.
*/
const DOWN = 72;

/**
 * Where the cloth is gathered, as a fraction of the frill's reach.
 *
 * It used to be the radius of the hole the neck came through, back when the
 * sweep closed. There is no hole now — the inner edge is `GATHER`, the
 * neckline itself — so this is only the root of the folds: where each gather
 * wedge starts before it fans out to the scalloped tip.
 */
const INNER = 0.3;
/** The scallops' troughs, between the tips at 1. */
const TROUGH = 0.82;

/**
 * Where the visible sweep starts and stops, in scallops from the top.
 *
 * Two and a half round from the top on each side puts the two ends level with
 * the sides of the neck, which is where a frill passes out of sight behind it.
 * Eight scallops between them: the front of a thirteen-scallop ruff.
 */
const FROM = 2.5;
const SPAN = 8;

/** How far round the ring a given scallop sits, in radians from the top. */
const angle = (turn: number) => (turn / SCALLOPS) * Math.PI * 2 - Math.PI / 2;

/**
 * A point on the frill: `turn` scallops round, `t` of the way out from the
 * centre. Above the centre line the reach is `UP` and below it `DOWN`, which is
 * the whole of what makes this hang rather than float.
 *
 * Written as one expression, and it has to be. `constTable` in
 * `scripts/preview-garments.mjs` reads these constants out of the source with a
 * regex that stops at the first `;` on its own line, so a block-bodied arrow
 * silently fails to evaluate — and then every path built from it resolves to
 * nothing, and the checker measures the band alone and calls the collar too
 * small. `art/<body>/yoke.ts` follows the same rule for the same reason.
 * `lib/garments/collar.ts` does not, because that one the checker imports.
 */
const ring = (turn: number, t: number) =>
  `${(RING.x + Math.cos(angle(turn)) * OUT * t).toFixed(1)} ` +
  `${(
    RING.y +
    Math.sin(angle(turn)) * (Math.sin(angle(turn)) < 0 ? UP : DOWN) * t
  ).toFixed(1)}`;

/** The scalloped outer edge, over the front of the sweep only. */
const scallops = (t: number, tip: number) =>
  Array.from(
    { length: SPAN },
    (_, i) => `Q${ring(FROM + i + 0.5, tip)} ${ring(FROM + i + 1, t)}`
  ).join(" ");

/**
 * The edge the frill is gathered onto: the neckline, cut a little shallow.
 *
 * The inner boundary has two jobs a single arc struck from the ring's centre
 * could not do at once — sit above the neckline seam at centre front, and
 * clear the sides of the throat thirty units higher up. Pulled down far enough
 * to cover the seam it closed over the neck; pulled up far enough to clear the
 * neck it left 33 of the dress's 289 seam points bare.
 *
 * The neckline is the curve that does both, because it is the curve the
 * garment cut round the throat in the first place. Six rather than the ten the
 * high opening dips, so the cloth — which lies *outside* this edge — falls
 * over the seam of all three garments it is sewn to rather than one of them.
 */
const GATHER = opening(6);

/**
 * The frill: a scalloped crescent, open where the neck is.
 *
 * One subpath and no hole. The old one cut its opening by sweeping an inner
 * ring the opposite way so the winding cancelled — which works, and which was
 * only ever needed because the outline closed round the neck in the first
 * place. An open sweep needs no hole: the gathered edge runs back along the
 * neckline and the two ends are where the cloth passes behind the neck.
 *
 * **Both ends are turned the same way.** The right end curved into the
 * neckline through a control point pulled in toward the gathers, which rounds
 * it into a lobe; the left one used its own end point as the control — a
 * straight run in — and came out a thin pointed tab. The left join is now the
 * right one reflected, so the two ends are the same end.
 */
const RUFF_PATH =
  `M${ring(FROM, TROUGH)} ` +
  scallops(TROUGH, 1) +
  ` Q${ring(FROM + SPAN, INNER)} ${GATHER.left[0]} ${GATHER.left[1]} ` +
  run(reverse(GATHER.points)) +
  ` Q${ring(FROM, INNER)} ${ring(FROM, TROUGH)} Z`;

/**
 * The arc of the gathering band that passes behind the neck.
 *
 * There is no front band any more. `standFront(10)` used to be drawn across the
 * throat and it is exactly what filled the ring's opening — the frill is
 * gathered onto a band in life, but head-on that band is behind the neck, not
 * in front of it. This half is drawn under the photograph, so it cannot come
 * back through the hole, and `check:garments` requires it of anything with a
 * stand.
 */
const STAND_BEHIND_PATH = standBehind(10);

/**
 * The gathers, as **alternating wedges** rather than as lines.
 *
 * A frill is gathered cloth, and gathered cloth reads entirely by alternation:
 * every other fold turns toward the light and the one between it turns away. A
 * single flat ramp over the whole ring plus seven grey sticks laid on top gave
 * neither — it read as a scalloped disc with pencil marks on it.
 *
 * Each wedge is one scallop, from the gathered edge out to the tip, and every
 * second one is shaded. Generated off the same `ring` the outline is, so a
 * shadow cannot land anywhere but on the fold it belongs to.
 */
const GATHER_WEDGES = Array.from(
  { length: SPAN },
  (_, i) =>
    `M${ring(FROM + i, INNER)} L${ring(FROM + i, TROUGH)} ` +
    `Q${ring(FROM + i + 0.5, 1)} ${ring(FROM + i + 1, TROUGH)} ` +
    `L${ring(FROM + i + 1, INNER)} Z`
);

/** The scalloped edge itself — the cut the frill is finished on. */
const EDGE = `M${ring(FROM, TROUGH)} ` + scallops(TROUGH, 1);

/** The frill dropped onto the shoulders it sits on. */
const RUFF_CAST_PATH =
  `M${ring(FROM, TROUGH + 0.04)} ` +
  scallops(TROUGH + 0.04, 1.05) +
  " " +
  Array.from(
    { length: SPAN },
    (_, i) =>
      `Q${ring(FROM + SPAN - i - 0.5, INNER)} ${ring(FROM + SPAN - i - 1, INNER)}`
  ).join(" ") +
  " Z";

const LIFT: [number, string][] = [
  [0, "#ffffff"],
  [0.4, "#f4f4f4"],
  [1, "#c2c2c2"],
];

export const ruffledCollarFront: GarmentArt = {
  regions: {
    collar: {
      focus: [300, 184],
      surface: { blur: 5, relief: 4, warp: 2 },
      /** Cut across the grain and gathered on the crossway, as a frill is. */
      grain: { turn: 90 },
      shape: (fill) => <path d={RUFF_PATH} fill={fill} />,
      defs: (uid) => (
        <>
          {vertical(uid("lift"), LIFT)}
          {softShadow(uid("soft"), 4)}
        </>
      ),
      cast: (uid) => (
        <path
          d={RUFF_CAST_PATH}
          fill="#7a7a7a"
          opacity="0.32"
          filter={`url(#${uid("soft")})`}
        />
      ),
      shading: (uid) => (
        <>
          <path d={RUFF_PATH} fill={`url(#${uid("lift")})`} />
          {GATHER_WEDGES.map((d, i) =>
            i % 2 === 0 ? null : (
              <path key={d} d={d} fill="#9d9d9d" opacity="0.3" />
            )
          )}
          {cutEdge(EDGE, 2.5, 0.34)}
        </>
      ),
    },
  },
};

export const ruffledCollarBehind = behindBandArt(STAND_BEHIND_PATH);
