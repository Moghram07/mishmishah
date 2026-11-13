/*
  Plain `.ts`, relative and extensioned, and no JSX — so `scripts/
  preview-garments.mjs` can import it as it does the cuts.

  The edges of a garment that parts are sewn along, and the points parts are
  placed at. An edge is a line, the side of it its cloth is on, and the
  pieces of cloth it lies on: a sleeve's hem and its cuff, a skirt's hem and
  its placket, a neckline and the bodice, a collar's free edge and the
  collar. A part laid along one — stripes now; bands and trims later — needs
  nothing else, so it goes on any edge a garment has, and is checked once per
  edge rather than once per outfit: see `check:garments`, which builds every
  edge over only the choices that shape it, and then proves, on whole outfits,
  that nothing else does.
*/
import type { Pt } from "./fit.ts";
import type { GarmentChoice } from "./art/index.ts";

/** What an edge is: a neckline's, a sleeve's hem, a skirt's hem, or a collar's free edge. */
export type EdgeKind = "neckline" | "sleeve" | "hem" | "collar" | "belt";

/**
 * How a part is laid in from an edge, `d` units onto the cloth.
 *
 * - `level`: the edge moved straight in along `into`, every point alike — a
 *   hem, whose waves and steps each stripe then keeps, `inset` further in
 *   past the hem's own turn.
 * - `follow`: the edge smoothed (`round` units) and offset square to
 *   itself onto the cloth — a neckline and the shoulders either side of it,
 *   a cap sleeve's edge round the arm; carried on past its two ends by
 *   `ends`. The cloth is the side `toward` a point on it, or, given
 *   `side`, always the same side of the edge as it runs: to its left (1) or
 *   its right (-1) — which a V needs, its two sides facing each other. With
 *   `corners`, it is smoothed between its corners and not through them, and
 *   each stripe turns a corner square, mitred, as braid is folded at one.
 * - `own`: the edge lays its own, already cut to its piece — a sailor
 *   collar's outer edge, offset along its own curve.
 */
export type EdgeLay =
  | { by: "level"; into: Pt; inset: number }
  | { by: "follow"; toward?: Pt; side?: 1 | -1; round: number; ends: readonly [head: number, tail: number]; corners?: true }
  | { by: "own"; inFrom: (d: number) => Pt[] };

/** A piece of cloth an edge lies on: its index in its region's `shape`, and its outline. */
export interface EdgePiece {
  index: number;
  d: string;
}

export interface Edge {
  kind: EdgeKind;
  /** Which of a pair: 0 the left (her right), 1 the other — a sleeve's, a collar panel's. Absent for an edge across the middle. */
  side?: 0 | 1;
  /** The edge, as points along it. */
  line: Pt[];
  /** The cloth it lies on: what is laid along it is cut to these. */
  pieces: EdgePiece[];
  lay: EdgeLay;
  /**
   * How much cloth there is in from it, where that is less than a part may
   * want — a band or a cuff, a few centimetres deep: what is laid there is
   * fitted finer to it. Absent where the cloth runs on.
   */
  room?: number;
  /**
   * Whether what is laid in its `room` is centred across it rather than
   * set in from the edge — braid on a wide band or a belt, an even margin of
   * the band's cloth either side.
   */
  centred?: true;
  /**
   * Where an end of it meets another edge at a corner — a cap sleeve's edge
   * and the shoulder line, at the tip of the shoulder: the corner, and the
   * line halving it, into the cloth. What is laid along it ends on that line,
   * so braid along the two edges meets in a mitre, as a picture frame does.
   */
  meets?: { head?: EdgeStop; tail?: EdgeStop };
  /**
   * The other finished edges of its cloth, as lines — the neckline beside a
   * cap sleeve. Braid that would run into one before reaching its own end is
   * ended there, every row together, square across: not cut off at a slant.
   */
  against?: Pt[][];
}

/** A corner an edge ends at: the point, and the line halving the corner, pointing into the cloth. */
export interface EdgeStop {
  at: Pt;
  dir: Pt;
}

/** What a point is: the centre front of the neck — a V's point, a round neck's lowest. */
export type PointKind = "neck" | "belt-front" | "belt-side";

/** A place a part is set at — a tie, later a brooch: where, and which way is down from it. */
export interface EdgePoint {
  kind: PointKind;
  at: Pt;
  down: Pt;
}

/**
 * What shapes one kind of edge, declared — so it can be checked once per
 * shape it takes rather than once per outfit.
 *
 * `shapedBy` names, from a whole choice, everything the edge depends on, as a
 * plain value; `choiceFor` turns that back into a choice with nothing else
 * set; `every` lists each value the garment offers. `check:garments` builds
 * every edge from `every` and holds each to the edge rules, then proves the
 * declaration on whole outfits: an edge built from a whole choice must be the
 * edge built from `choiceFor(shapedBy(choice))`. If anything undeclared
 * shapes it, that fails.
 */
export interface EdgeSpec<K = unknown> {
  kind: EdgeKind;
  shapedBy: (choice: GarmentChoice) => K;
  choiceFor: (key: K) => GarmentChoice;
  every: (offer: EdgeOffer) => K[];
}

/** What a garment offers, from its record — what `EdgeSpec.every` lists edges over. */
export interface EdgeOffer {
  sleeves: { types: readonly string[]; cuffs?: readonly string[] };
  skirt: { shapes: readonly string[]; lengths: readonly string[]; waists: readonly string[] };
  buttons: readonly string[];
  /** The cuts some collar it takes can be sewn to — the sailor's follow cuts with no collar opening of their own. Absent, those with one. */
  collared?: readonly string[];
}

/** The same points mirrored about the column at `x`. */
export const mirrorX = (pts: Pt[], x: number): Pt[] => pts.map(([px, py]) => [2 * x - px, py] as Pt);
