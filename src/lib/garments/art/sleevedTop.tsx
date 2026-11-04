import type { ReactNode } from "react";
import { DRAPE, horizontal, vertical, type Stop, type Uid } from "@/lib/garments/shading";
import { coverFrom, type CuffTrim, type SleeveCut, type TopDraft } from "@/lib/garments/sleeves";
import type { Tuck } from "@/lib/garments/fit";
import type { SleeveChoice } from "@/types";
import type { GarmentChoice, RegionArt } from "./index";
import { puffLightDefs, puffShade, seamFolds, seamShadows, sleeveFoldDefs, sleeveFolds } from "./sleeveFolds";
import { foldDefs, foldLights, foldShadows, puffDrape, sleeveDrape, type Fold } from "@/lib/garments/folds";
import { litButtons } from "./buttons";

/**
 * Across a plain cuff: a band of doubled cloth round the wrist, so it turns
 * like a small cylinder — lit a little left of centre, falling away at both
 * sides, darker on the side toward the body.
 */
export const CUFF: Stop[] = [
  [0, "#d2d2d2"],
  [0.3, "#ffffff"],
  [0.58, "#f6f6f6"],
  [1, "#c6c6c6"],
];

/** The rows a path spans: the least and the greatest y among its points. */
export function rowsOf(d: string): [number, number] {
  const n = (d.match(/-?[0-9]*[.]?[0-9]+/g) ?? []).map(Number);
  const ys = n.filter((_, i) => i % 2 === 1);
  return [Math.min(...ys), Math.max(...ys)];
}

/**
 * The part of a body's light a sewn sleeve takes: the fall from the shoulders
 * to where the body is first fully lit, and full light below it.
 *
 * A sleeve head has to be exactly as lit as the shoulder it is sewn to, or it
 * reads as a brighter piece set into a darker one. But the body's light also
 * deepens toward its own hem, and a long sleeve on a short top runs on past
 * that hem — laid on whole, the forearm took the shadow of a hem it is
 * nowhere near.
 */
export function shoulderFall(stops: Stop[]): Stop[] {
  const lit = stops.findIndex(([, c]) => c.toLowerCase() === "#ffffff");
  return lit < 0 ? stops : stops.slice(0, lit + 1);
}

/**
 * The drape a sewn sleeve hangs in — see `sleeveDrape`: lit as a tube, two
 * long soft folds, the body's shadow on its inner edge, a crease at the inner
 * elbow, and gathers into a cuff where it has one. Every garment's sewn
 * sleeves hang the same way, so they are folded the same way. `only` names the
 * sleeves to hang, for a garment sleeved on one side; each keeps its own seed.
 */
export function sewnDrape(k: SleeveCut, only: string[] = k.sleeves): Fold[] {
  const s = k.seamed;
  if (!s) return [];
  return k.sleeves.flatMap((path, i) =>
    !only.includes(path) ? [] : sleeveDrape({
      sleeve: path,
      underarm: k.underarm ?? 0,
      cuff: s.hem,
      elbowY: s.elbowY,
      wristY: s.wristY,
      cuffTop: s.cuffTop,
      round: true,
      /* cut to length: without a cuff it just ends, nothing gathered above the hem */
      collects: false,
      seed: 40 + i,
    })
  );
}

/**
 * A cuff's marks, as shading: the soft lines of a French cuff's split and
 * turned-back edge and of a formal cuff's placket, a rib's ribs — fine, and
 * close — and the roll of a French cuff's fold. None of it touches the print.
 */
export function cuffMarks(uid: Uid, cuff: NonNullable<SleeveCut["cuff"]>): ReactNode {
  if (!cuff.marks.length && !cuff.ribs.length && !cuff.folds.length) return null;
  return (
    <>
      {cuff.marks.length ? seamShadows(uid, cuff.marks) : null}
      {cuff.ribs.length ? (
        <g fill="none" stroke="#7a7a7a" strokeWidth="0.7" opacity="0.32">
          {cuff.ribs.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      ) : null}
      {cuff.folds.length ? foldShadows(uid, cuff.folds) : null}
    </>
  );
}

/**
 * What a cuff closes with: a shirt button, or a cufflink — hardware, so drawn
 * over the cloth and never in its fabric.
 */
export function CuffHardware({ trims }: { trims: CuffTrim[] }): ReactNode {
  const buttons = trims.flatMap((t) => t.buttons);
  const links = trims.flatMap((t) => t.links);
  if (!buttons.length && !links.length) return null;
  return (
    <g>
      {litButtons(buttons, 2.4)}
      {links.map(([x, y], i) => (
        <g key={`l${i}`}>
          <circle cx={x} cy={y} r="3.2" fill="#b4b4b4" stroke="#6a6a6a" strokeWidth="0.6" />
          <circle cx={x - 0.9} cy={y - 0.9} r="1.2" fill="#f4f4f4" opacity="0.85" />
        </g>
      ))}
    </g>
  );
}

/** Shading and topstitch that belong to one opening — a crew neck's band, say. */
interface OpeningFinish {
  shading?: (uid: Uid) => ReactNode;
  stitch?: string;
}

export interface SleevedTopSpec {
  draft: TopDraft;
  /** The garment's own opening, and the high one a standing collar needs. */
  openings: { own: string; high?: string };
  defaultSleeve: SleeveChoice;
  focus: [number, number];
  surface?: { blur: number; relief: number; warp?: number };
  /** The body's light, top to bottom. */
  drape?: [number, string][];
  /** Extra definitions a garment's own shading needs. */
  defs?: (uid: Uid) => ReactNode;
  /** Shading drawn under the body's light — a thobe's long folds. */
  under?: (uid: Uid) => ReactNode;
  /**
   * The garment's folds for one cut — see `garments/folds.tsx`: those on the
   * body panel and those on the sleeves. Each set is kept to its own pieces,
   * so a fold hanging down the body never shades the sleeve beside it.
   */
  folds?: (k: SleeveCut, sleeve: SleeveChoice) => { body?: Fold[]; sleeves?: Fold[] };
  own?: OpeningFinish;
  high?: OpeningFinish;
}

export interface SleevedTop {
  /** The body region, cut to the choice. */
  region(choice: GarmentChoice): RegionArt;
  /** The cloth over the arms, for the renderer's arm mask. */
  armCover(choice: GarmentChoice): string[];
  /** What the cuffs close with, for the choice — see `CuffHardware`. */
  cuffTrim(choice: GarmentChoice): ReactNode;
  /** What it lets a bottom worn under it show, for the choice — see `coverOf`. */
  cover(choice: GarmentChoice): Tuck;
}

/**
 * The body region of a top with a choice of sleeve, for any choice.
 *
 * Every such top is the same drawing — a body panel, its sleeves, their bands
 * and folds, lit the same way — with only its opening and its numbers its own.
 * So it is written once: the six tops that take a sleeve differ in their draft
 * and their neckline finish, and in nothing this has to know about.
 */
export function sleevedTop(spec: SleevedTopSpec): SleevedTop {
  const cuts = new Map<string, SleeveCut>();
  const regions = new Map<string, RegionArt>();

  const resolve = (choice: GarmentChoice) => {
    const high = choice.opening === "high" && spec.openings.high !== undefined;
    const sleeve = choice.sleeve ?? spec.defaultSleeve;
    const inside = choice.inside;
    const key =
      `${sleeve.type}|${sleeve.length}|${sleeve.cuff ?? "none"}|${high ? "high" : "own"}` +
      (inside ? `|${inside.y}|${inside.x}` : "");
    return { high, sleeve, key, inside };
  };

  const cutFor = (choice: GarmentChoice): SleeveCut => {
    const { high, sleeve, key, inside } = resolve(choice);
    let k = cuts.get(key);
    if (!k) {
      const opening = high ? spec.openings.high! : spec.openings.own;
      k = spec.draft.cut(sleeve, spec.draft.frame(opening, sleeve), inside);
      cuts.set(key, k);
    }
    return k;
  };

  const region = (choice: GarmentChoice): RegionArt => {
    const { high, key, sleeve } = resolve(choice);
    let r = regions.get(key);
    if (r) return r;
    const k = cutFor(choice);
    const own = spec.folds?.(k, sleeve) ?? {};
    /* a sewn sleeve hangs in the shared drape unless the garment folds it itself; a puff is gathered */
    const puffs = k.puff ?? [];
    const folds = { body: own.body, sleeves: own.sleeves ?? [...sewnDrape(k), ...puffs.flatMap((s, i) => puffDrape(s, 60 + i))] };
    const hasFolds = Boolean(folds.body?.length || folds.sleeves?.length);
    /* its seams as folds — see `seamFolds`: a sewn sleeve's armholes and cuffs, or a cuff's on a sleeve cut on */
    const seamFold = seamFolds(k.seamed?.seams ?? []);
    const cuffFold = !k.seamed && k.cuff ? seamFolds(k.cuff.seams) : [];
    const softFolds = [...seamFold, ...cuffFold];
    /** Each set of folds, inside the pieces it belongs to. */
    const drawFolds = (uid: Uid, draw: typeof foldShadows) => (
      <>
        {folds.body?.length ? <g mask={`url(#${uid("fold-body")})`}>{draw(uid, folds.body)}</g> : null}
        {folds.sleeves?.length ? (
          <g mask={`url(#${uid("fold-sleeves")})`}>{draw(uid, folds.sleeves)}</g>
        ) : null}
      </>
    );
    const finish = (high ? spec.high : spec.own) ?? {};
    const pieces = [k.body, ...k.sleeves, ...k.bands];
    const seamed = k.seamed;
    /*
      A sewn sleeve's light runs on over its armholes: the body's fall from the
      shoulders is laid over the sleeves too, measured against the body panel —
      see `shoulderFall`.
    */
    const [bodyTop, bodyBottom] = seamed ? rowsOf(k.body) : [0, 0];
    const surface = spec.surface ?? { blur: 16, relief: 5, warp: 5 };
    r = {
      focus: spec.focus,
      surface: seamed ? { ...surface, joined: true } : surface,
      shape: (fill) => (
        <>
          {pieces.map((d, i) => (
            <path key={i} d={d} fill={fill} />
          ))}
        </>
      ),
      ...(seamed
        ? {
            edge: () => (
              <>
                {seamed.edges.map((d, i) => (
                  <path key={i} d={d} />
                ))}
              </>
            ),
          }
        : k.cuff
          ? {
              /* the body and its bands, each band outlined but for its top, which is a seam */
              edge: () => (
                <>
                  {[k.body, ...k.sleeves, ...k.cuff!.edges].map((d, i) => (
                    <path key={i} d={d} />
                  ))}
                </>
              ),
            }
          : {}),
      defs: (uid) => (
        <>
          {vertical(uid("drape"), spec.drape ?? DRAPE)}
          {seamed && (
            <linearGradient
              id={uid("fall")}
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1={bodyTop}
              x2="0"
              y2={bodyBottom}
            >
              {shoulderFall(spec.drape ?? DRAPE).map(([o, c]) => (
                <stop key={o} offset={o} stopColor={c} />
              ))}
            </linearGradient>
          )}
          {(seamed || k.cuff) && horizontal(uid("cuff"), CUFF)}
          {puffs.length > 0 && puffLightDefs(uid, puffs)}
          {!hasFolds && (k.cuff?.folds.length || softFolds.length) ? foldDefs(uid) : null}
          {spec.defs?.(uid)}
          {sleeveFoldDefs(uid)}
          {hasFolds && (
            <>
              {foldDefs(uid)}
              <mask id={uid("fold-body")} maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="1000">
                <path d={k.body} fill="#fff" />
                {[...k.sleeves, ...k.bands].map((d, i) => (
                  <path key={i} d={d} fill="#000" />
                ))}
              </mask>
              <mask id={uid("fold-sleeves")} maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="1000">
                {k.sleeves.map((d, i) => (
                  <path key={i} d={d} fill="#fff" />
                ))}
                {/* a cuff lies over its sleeve, and the sleeve's folds stop at it */}
                {k.bands.map((d, i) => (
                  <path key={`b${i}`} d={d} fill="#000" />
                ))}
              </mask>
            </>
          )}
        </>
      ),
      shading: (uid) => (
        <>
          {spec.under?.(uid)}
          <path d={k.body} fill={`url(#${uid("drape")})`} />
          {seamed &&
            k.sleeves.map((d, i) => <path key={i} d={d} fill={`url(#${uid("fall")})`} />)}
          {finish.shading?.(uid)}
          {/* a puff lit round: darker as it turns away toward its edges */}
          {puffs.length > 0 && <g mask={`url(#${uid("fold-sleeves")})`}>{puffShade(uid, k.sleeves)}</g>}
          {sleeveFolds(uid, k.folds)}
          {hasFolds && drawFolds(uid, foldShadows)}
          {seamed && (
            <>
              {k.bands.map((d, i) => (
                <path key={i} d={d} fill={`url(#${uid("cuff")})`} />
              ))}
              {foldShadows(uid, seamFold)}
            </>
          )}
          {/* a cuff on a sleeve cut in one with the body: its band, and its seam */}
          {!seamed && k.cuff && (
            <>
              {k.bands.map((d, i) => (
                <path key={i} d={d} fill={`url(#${uid("cuff")})`} />
              ))}
              {foldShadows(uid, cuffFold)}
            </>
          )}
          {k.cuff && cuffMarks(uid, k.cuff)}
        </>
      ),
      ...(hasFolds || k.cuff?.folds.length || softFolds.length
        ? {
            light: (uid: Uid) => (
              <>
                {hasFolds && drawFolds(uid, foldLights)}
                {k.cuff?.folds.length ? foldLights(uid, k.cuff.folds) : null}
                {softFolds.length ? foldLights(uid, softFolds) : null}
              </>
            ),
          }
        : {}),
      stitch: [finish.stitch, k.stitch].filter(Boolean).join(" "),
    };
    regions.set(key, r);
    return r;
  };

  return {
    region,
    armCover: (choice) => cutFor(choice).armCover,
    cuffTrim: (choice) => {
      const trim = cutFor(choice).cuff?.trim;
      return trim ? <CuffHardware trims={[trim.left, trim.right]} /> : null;
    },
    cover: (choice) => coverFrom(cutFor(choice)),
  };
}
