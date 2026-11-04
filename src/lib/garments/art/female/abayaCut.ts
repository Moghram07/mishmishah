/*
  Plain `.ts`, relative and extensioned, and no JSX — so `scripts/
  preview-garments.mjs` imports the abaya the app draws, and holds every
  garment under it to what the abaya actually encloses. See `dressCut.ts`
  for why the checker must see the real geometry.
*/
import { BODY_CANVAS, FEMALE_ANCHORS } from "../../../mannequin/bodies.ts";
import { robe, type Robe, type RobeSpec } from "../../sleeves.ts";
import type { Pt } from "../../fit.ts";
import type { FrontId, SleeveTypeId } from "@/types";
import type { GarmentChoice } from "../index.ts";
import { OUTER_NECK_LEFT, OUTER_NECK_RIGHT, OUTER_TIP_LEFT } from "./yoke.ts";

const CM = 1 / BODY_CANVAS.cmPerUnit;

/**
 * Her abaya: a loose robe worn over whatever she wears, from her shoulders to
 * her ankles — see `robe`.
 *
 * - **Its shoulders** are outerwear's: three units of ease more than a top's,
 *   over the top underneath, and soft — walked along her, not padded.
 * - **Its body** is eight units off her, room for the clothes under it, and
 *   falls straight from where it leaves her under the arm, 12 units out in
 *   every 100 down: loose over her waist and hips, and wide enough at the
 *   ankle to hang over a skirt.
 * - **Its hem** just covers her ankle bone, y 906.
 * - **Its sleeves**, all long and all ending where a long sleeve does, so one
 *   worn under them does not show; each with four units of room over it,
 *   hanging in front of the robe's own side. The regular sleeve «عادي»
 *   follows her arm; the wide «واسع» is the bell, flaring from the elbow; the
 *   kimono «كيمونو» is cut in one with the body, from a deep underarm. The
 *   butterfly «فراشة» has no underarm: its wings are the body, and with her
 *   arms down they hang as a cape, from the foot of the shoulder past her
 *   arms to the hem, 10 units out in every 100 down — a little steeper than
 *   the body falls under the other sleeves, so it is fuller at the hem.
 * - **Its fronts** almost meet under the neck, 5 cm apart, and fall a little
 *   apart as they hang: 15 cm at the hem. Or it is closed on hidden snaps:
 *   the fronts meet down the centre under a plain seam, topstitched five
 *   units beside it on the front that laps over.
 */
export const ABAYA = {
  hemY: FEMALE_ANCHORS.ankleY,
  ease: 8,
  slope: 0.12,
  /* a butterfly's wings, from the arm */
  wing: 0.1,
  neckDip: 20,
  gap: [5 * CM, 15 * CM] as const,
};

const SPEC: RobeSpec = {
  tip: [OUTER_TIP_LEFT[0], OUTER_TIP_LEFT[1]],
  neck: [OUTER_NECK_LEFT[0], OUTER_NECK_LEFT[1]],
  neckRight: [OUTER_NECK_RIGHT[0], OUTER_NECK_RIGHT[1]],
  shoulderEase: 6,
  ease: ABAYA.ease,
  hemY: ABAYA.hemY,
  dip: 12,
  straight: ABAYA.slope,
  sleeve: [6, 8],
  inner: [3, 4],
  /* its kimono cut wide, as an abaya's is: ten units fuller each side than a dress's; its butterfly's wings */
  finish: { over: 4, front: true, full: 10, wing: ABAYA.wing },
  neckDip: ABAYA.neckDip,
  gap: ABAYA.gap,
};

/** The sleeves it is cut with, all long: regular, wide, kimono and butterfly. */
export const SLEEVE_TYPES: SleeveTypeId[] = ["set-in", "bell", "kimono", "butterfly"];

/** It, cut with each of them. */
const ROBES = new Map<SleeveTypeId, Robe>(SLEEVE_TYPES.map((type) => [type, robe("female", SPEC, { type, length: "long" })]));

/** As it arrives, with its regular sleeve. */
export const ROBE = ROBES.get("set-in")!;

/** It cut with the sleeve chosen, or as it arrives. */
export const robeFor = (choice: GarmentChoice = {}): Robe => ROBES.get(choice.sleeve?.type ?? "set-in") ?? ROBE;

/** Its body alone, without the sleeves, open or closed: what the stand-off is read off. */
export const bodyOf = (front: FrontId = "open", r: Robe = ROBE): string[] =>
  front === "closed" ? [r.closed.body] : [r.open.right, r.open.left];

/** Its body as worn: open or closed, with the sleeve chosen. */
export const bodyFor = (choice: GarmentChoice = {}): string[] => bodyOf(choice.front, robeFor(choice));

/** Every piece of cloth it is, as worn — what `check:garments` rasterises. */
export const cloth = (choice: GarmentChoice = {}): string[] => [...bodyFor(choice), ...robeFor(choice).sleeves];

/** Its sleeves alone, left then right, sewn or cut on: what is measured for hanging as a tube. */
export const sleevesOf = (choice: GarmentChoice = {}): string[] => robeFor(choice).sleeveAreas;

/**
 * Closed, its topstitch: down the front that laps over — hers on the right,
 * the left as seen — five units beside the seam, from the neckline to just
 * above the hem's own stitch.
 */
export const closedStitch = (r: Robe = ROBE): Pt[] => {
  const foot = r.closed.seam[r.closed.seam.length - 1][1];
  return r.closed.seam.map(([x, y]) => [x - 5, y] as Pt).filter(([, y]) => y < foot - 10);
};
export const CLOSED_STITCH: Pt[] = closedStitch(ROBE);

/** What fastens it closed, for `check:garments`: the seam and its stitch, on the cloth they are sewn to. */
export const fasteningOf = (choice: GarmentChoice = {}) => {
  const r = robeFor(choice);
  return { pieces: bodyOf("closed", r), seam: r.closed.seam, stitch: closedStitch(r) };
};

/** What it holds inside it, with the sleeve chosen — see `Encloses`. */
export const enclosesFor = (choice: GarmentChoice = {}) => robeFor(choice).encloses;

/**
 * Where it falls clear of her, for `check:garments`: straight from where its
 * body leaves her under the arm — under a kimono's, lower — at its slope; and
 * wide enough that its sleeve hangs in front of it, as a sleeve does in front
 * of an A-line. A butterfly's falls from her arms instead, at its wings' slope.
 */
export const fallsOf = (choice: GarmentChoice = {}) =>
  choice.sleeve?.type === "butterfly"
    ? { from: robeFor(choice).underarm, slope: ABAYA.wing, front: true, arms: true }
    : { from: robeFor(choice).underarm, slope: ABAYA.slope, front: true };
