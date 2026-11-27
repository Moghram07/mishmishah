import type {
  BeltId,
  BodyType,
  BowAtId,
  ButtonRowsId,
  ButtonsId,
  CuffId,
  FabricRegionId,
  FrontId,
  GrainDirection,
  LegId,
  Outfit,
  SkirtChoice,
  SkirtLengthId,
  SkirtShapeId,
  SleeveLengthId,
  SleeveTypeId,
  StripeEdgeId,
  StripesId,
  TieAtId,
  TieId,
  WaistId,
  WornGarment,
} from "@/types";
import { garmentById } from "@/lib/data/garments";
import { necklinesForGarment, retiredNeckline } from "@/lib/data/necklines";
import { fabricById } from "@/lib/data/fabrics";
import { sleeveCuffsFor, sleeveLengthsFor, sleeveTypesFor } from "@/lib/data/sleeves";
import { skirtLengthsFor } from "@/lib/data/skirts";
import { beltsFor, buttonsFor } from "@/lib/data/closures";
import { GRAIN_PRESETS } from "@/lib/fabrics/grain";
import {
  beltOf,
  bowAtOf,
  bowPlacesOf,
  buttonRowsOf,
  buttonRowsOffered,
  buttonsOf,
  clothOf,
  collarOf,
  collarsFitting,
  cutFrom,
  frontOf,
  legOf,
  necklineOf,
  regionsOf,
  setBelt,
  setBowAt,
  setButtonRows,
  setButtons,
  setCollar,
  setFront,
  setLeg,
  setNeckline,
  setSkirt,
  setSleeve,
  setStripeEdges,
  setStripes,
  setTie,
  setTieAt,
  skirtOf,
  sleeveOf,
  stack,
  stripeEdgesOf,
  stripesOf,
  stripesOnOf,
  switchBody,
  tieAtOf,
  tieOf,
  tiePlacesOf,
  tiesOffered,
  wear,
  wornOn,
} from "@/lib/garments/outfit";
import { DESIGN_HASH } from "./sentLink";

/**
 * A design as a link: the part after `#d=` — catalogue ids and nothing else.
 * No name, no skin tone, nothing stored anywhere: the link is the design.
 *
 *     1.f.0~dress_n.boat_c.sailor_s.set-in.sleeveless_k.pleated.midi.natural_f.navy.trim.white
 *
 * The version, the body (`f`, `m`) and the grain, then each garment worn,
 * innermost first, after a `~`: its piece, and after each `_` one choice — a
 * letter, then its ids after dots, in the order the panel makes them:
 *
 * | | |
 * |-|-|
 * | `n` | the neckline's cut |
 * | `c` | the collar, or `none` |
 * | `s` | the sleeve: type, length, cuff |
 * | `k` | the skirt: shape, length, waist |
 * | `o` | the front, open or closed |
 * | `l` | the trousers' leg |
 * | `b` | the belt, and where its bow is tied |
 * | `u` | the buttons, and their rows |
 * | `x` | the stripes' count, then the edges they go along |
 * | `t` | the tie, and where it is knotted |
 * | `f` | the cloth it is cut from, then each part in another: part, cloth |
 *
 * Every id is the catalogue's own, less what the link already says: the body
 * off a garment's (`female-dress` is `dress`) and a collar's, `-collar` off a
 * collar's, `fb-` off a fabric's. Only letters, digits, `-`, `.`, `_` and `~`
 * — nothing a messaging app would rewrite or cut a link at.
 *
 * Reading one is strict. Each choice is made the way the panel makes it, and
 * only if the panel would offer it there and then — a collar only if it fits
 * the cut just made, a cuff only on a long sleeve that takes one, a fabric
 * only from those offered. Anything else — an id we do not know, or one this
 * garment does not offer — is left out and counted, and the rest of the
 * design still opens. Nothing in a link can make it throw.
 */

/** The link's version: a link from a later one is not read as this one. */
const VERSION = "1";

/** Longer than any design could be: anything past it is not a link this site made. */
const MOST = 2000;

/** The most garments one body can wear at once is far below this. */
const MOST_GARMENTS = 12;

const BODY_CODES: Record<BodyType, string> = { female: "f", male: "m" };

/** An id as the catalogue writes them: lower-case words joined by hyphens. */
const WORD = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const COLLAR = "-collar";
const FABRIC = "fb-";

/* each id, less what the link already says */
const garmentCode = (id: string, body: BodyType) => id.slice(body.length + 1);
const collarCode = (id: string, body: BodyType) => id.slice(body.length + 1, -COLLAR.length);
const fabricCode = (id: string) => id.slice(FABRIC.length);

/** A fabric a link may name: one of ours, and offered — never a hidden one. */
const offered = (code: string | undefined): string | undefined => {
  if (code === undefined || !WORD.test(code)) return undefined;
  const fabric = fabricById(FABRIC + code);
  return fabric && !fabric.hidden ? fabric.id : undefined;
};

/** The parts whose cloth, until one is chosen, is the cloth of the part they are sewn to — see `clothOf`. */
const SEWN_TO: Partial<Record<FabricRegionId, (w: WornGarment) => string | undefined>> = {
  cuff: (w) => w.fabrics.top ?? w.fabrics.body,
  belt: (w) => w.fabrics.bottom ?? w.fabrics.top,
};

/* ------------------------------------------------------------- writing */

/** One garment, as the link writes it: what is drawn, choice by choice. */
function garmentText(w: WornGarment, body: BodyType, fallback: string): string | undefined {
  const garment = garmentById(w.garmentId);
  if (!garment || garment.gender !== body) return undefined;
  const out = [garmentCode(garment.id, body)];
  const put = (key: string, ...ids: (string | undefined)[]) => out.push([key, ...ids.filter((id) => id !== undefined)].join("."));

  const neckline = necklinesForGarment(garment).length > 0 ? necklineOf(w) : undefined;
  if (neckline) put("n", neckline.cut);
  if (collarsFitting(garment, w).length > 0) {
    const collar = collarOf(w);
    put("c", collar ? collarCode(collar.id, body) : "none");
  }
  const sleeve = sleeveOf(w);
  if (sleeve) put("s", sleeve.type, sleeve.length, sleeve.cuff);
  const skirt = skirtOf(w);
  if (skirt) put("k", skirt.shape, skirt.length, skirt.waist);
  const front = frontOf(w);
  if (front) put("o", front);
  const leg = legOf(w);
  if (leg) put("l", leg);
  const belt = beltOf(w);
  if (belt) put("b", belt, bowAtOf(w));
  const buttons = buttonsOf(w);
  if (buttons) put("u", buttons, buttonRowsOffered(w).length > 0 ? buttonRowsOf(w) : undefined);
  const stripes = stripesOf(w);
  if (stripes && stripeEdgesOf(w).length > 0) put("x", stripes, ...stripesOnOf(w));
  const tie = tieOf(w);
  if (tie) put("t", tie, tieAtOf(w));

  /* its cloths: the first part's, then each part drawn in another than the link would give it unsaid */
  const drawn = (region: FabricRegionId) => fabricById(clothOf(w, region) ?? "")?.id ?? fallback;
  const regions = regionsOf(garment, w);
  const base = drawn(regions[0]);
  const cloths = [fabricCode(base)];
  for (const region of regions) {
    const own = drawn(region);
    const sewn = SEWN_TO[region];
    if (own !== (sewn ? sewn(w) : base)) cloths.push(region, fabricCode(own));
  }
  put("f", ...cloths);
  return out.join("_");
}

/**
 * The design on the stage as a link's `#` part: the body on the stage, and
 * everything it wears. `fallback` is the cloth a part with none of its own is
 * drawn in — the visualizer's fabric.
 */
export function designPayload(outfit: Outfit, fallback: string): string {
  const body = outfit.bodyType;
  const direction = GRAIN_PRESETS.includes(outfit.direction) ? outfit.direction : 0;
  const garments = stack(wornOn(outfit.worn, body)).flatMap(({ worn }) => garmentText(worn, body, fallback) ?? []);
  return [`${VERSION}.${BODY_CODES[body]}.${direction}`, ...garments].join("~");
}

/** The link to the design on the stage, on this site: its front page, the design after the `#`. */
export const designLink = (origin: string, outfit: Outfit, fallback: string): string =>
  `${origin}/${DESIGN_HASH}${designPayload(outfit, fallback)}`;

/* ------------------------------------------------------------- reading */

/** A design read from a link: a body, what it wears, and the grain. */
export interface SentDesign {
  body: BodyType;
  worn: WornGarment[];
  direction: GrainDirection;
}

export interface ReadDesign {
  /** The design, every part of it one the panel could have made — `null` when nothing in the link could be read. */
  design: SentDesign | null;
  /** How many things the link asked for that are not known here, or not offered where they were asked for — each left out. */
  skipped: number;
}

const KEYS = ["n", "c", "s", "k", "o", "l", "b", "u", "x", "t", "f"] as const;
type Key = (typeof KEYS)[number];

const has = <T extends string>(list: readonly T[], id: string | undefined): id is T =>
  id !== undefined && (list as readonly string[]).includes(id);

/**
 * One garment from its link, made as the panel makes it: cut from its cloth
 * throughout, then each choice in the panel's order, each only if it is
 * offered as the garment then stands.
 */
function readGarment(text: string, body: BodyType, fallback: string): { worn: WornGarment | null; skipped: number } {
  const [code, ...fields] = text.split("_");
  const garment = code && WORD.test(code) ? garmentById(`${body}-${code}`) : undefined;
  if (!garment || garment.gender !== body) return { worn: null, skipped: 1 };

  let skipped = 0;
  const asked = new Map<Key, string[]>();
  for (const field of fields) {
    const [key, ...ids] = field.split(".");
    if (!has(KEYS, key) || asked.has(key) || ids.length === 0 || !ids.every((id) => WORD.test(id))) skipped++;
    else asked.set(key, ids);
  }
  /* each choice reads its ids in turn; any it is given beyond those is left out */
  const take = (key: Key, most: number): (string | undefined)[] | undefined => {
    const ids = asked.get(key);
    if (!ids) return undefined;
    if (ids.length > most) skipped += ids.length - most;
    return [...ids.slice(0, most), ...Array<undefined>(Math.max(0, most - ids.length)).fill(undefined)];
  };

  const cloth = asked.get("f") ?? [];
  const base = offered(cloth[0]);
  if (cloth.length > 0 && !base) skipped++;
  const id = garment.id;
  let w: WornGarment[] = [cutFrom(garment, base ?? fallback)];
  const now = () => w[0];

  const n = take("n", 1);
  if (n) {
    const cuts = necklinesForGarment(garment);
    const neckline = cuts.find((x) => x.cut === n[0]);
    /* a cut no longer offered opens as the one that replaced it, as a look cut to it does — see `retiredNeckline` */
    const retired = cuts.length > 0 && !neckline && n[0] ? retiredNeckline(`${body}-${n[0]}-neckline`) : undefined;
    if (neckline) w = setNeckline(w, id, neckline.id);
    else if (retired) w = setNeckline(w, id, `${body}-${n[0]}-neckline`);
    else skipped++;
  }

  const c = take("c", 1);
  if (c) {
    const fitting = collarsFitting(garment, now());
    const collar = fitting.find((x) => x.id === `${body}-${c[0]}${COLLAR}`);
    if (collar) w = setCollar(w, id, collar.id);
    else if (c[0] === "none" && fitting.length > 0) w = setCollar(w, id, undefined);
    else skipped++;
  }

  const s = take("s", 3);
  if (s) {
    const [type, length, cuff] = s;
    const types = sleeveOf(now()) ? sleeveTypesFor(garment, necklineOf(now())) : [];
    if (has<SleeveTypeId>(types, type)) {
      const lengths = sleeveLengthsFor(type, necklineOf(now()), garment);
      if (has<SleeveLengthId>(lengths, length)) {
        const cuffs = sleeveCuffsFor(garment, { type, length });
        if (cuff !== undefined && !has<CuffId>(cuffs, cuff)) skipped++;
        w = setSleeve(w, id, { type, length, ...(has<CuffId>(cuffs, cuff) ? { cuff } : {}) });
      } else skipped++;
    } else skipped++;
  }

  const k = take("k", 3);
  if (k) {
    const [shape, length, waist] = k;
    const current = skirtOf(now());
    const offer = garment.skirt;
    if (offer && current) {
      const next: SkirtChoice = { ...current };
      if (has<SkirtShapeId>(offer.shapes, shape)) next.shape = shape;
      else skipped++;
      if (has<SkirtLengthId>(skirtLengthsFor(garment, next.shape).map((l) => l.id), length)) next.length = length;
      else skipped++;
      if (waist !== undefined) {
        if (offer.waists && has<WaistId>(offer.waists, waist)) next.waist = waist;
        else skipped++;
      }
      w = setSkirt(w, id, next);
    } else skipped++;
  }

  const o = take("o", 1);
  if (o) {
    if (garment.fronts && has<FrontId>(garment.fronts.offered, o[0])) w = setFront(w, id, o[0]);
    else skipped++;
  }

  const l = take("l", 1);
  if (l) {
    if (garment.legs && has<LegId>(garment.legs.offered, l[0])) w = setLeg(w, id, l[0]);
    else skipped++;
  }

  const b = take("b", 2);
  if (b) {
    const [belt, at] = b;
    const belts = beltsFor(garment, necklineOf(now())?.cut).map((x) => x.id);
    if (has<BeltId>(belts, belt)) {
      w = setBelt(w, id, belt);
      if (at !== undefined) {
        if (has<BowAtId>(bowPlacesOf(now()), at)) w = setBowAt(w, id, at);
        else skipped++;
      }
    } else skipped++;
  }

  const u = take("u", 2);
  if (u) {
    const [buttons, rows] = u;
    const offer = buttonsFor(garment, necklineOf(now())?.cut, skirtOf(now())?.shape).map((x) => x.id);
    if (has<ButtonsId>(offer, buttons)) {
      w = setButtons(w, id, buttons);
      if (rows !== undefined) {
        if (has<ButtonRowsId>(buttonRowsOffered(now()), rows)) w = setButtonRows(w, id, rows);
        else if (buttonRowsOf(now()) !== rows) skipped++;
      }
    } else skipped++;
  }

  const x = asked.get("x");
  if (x) {
    const [count, ...on] = x;
    const edges = stripeEdgesOf(now());
    if (edges.length > 0 && garment.stripes && has<StripesId>(garment.stripes.offered, count)) {
      w = setStripes(w, id, count, base ?? fallback);
      if (count === "none") skipped += on.length;
      else {
        /* exactly the edges sent — none, if every one was taken off — of those this garment has */
        const along = on.filter((e): e is StripeEdgeId => has(edges, e));
        skipped += on.length - along.length;
        w = setStripeEdges(w, id, along);
      }
    } else skipped++;
  }

  const t = take("t", 2);
  if (t) {
    const [tie, at] = t;
    if (has<TieId>(tiesOffered(now()), tie)) {
      w = setTie(w, id, tie, base ?? fallback);
      if (at !== undefined) {
        if (tie !== "none" && has<TieAtId>(tiePlacesOf(now(), tie), at)) w = setTieAt(w, id, at);
        else skipped++;
      }
    } else skipped++;
  }

  /* each part in a cloth of its own: only a part it now has, in a cloth we offer */
  const regions = regionsOf(garment, now());
  const fabrics = { ...now().fabrics };
  const pairs = cloth.slice(1);
  if (pairs.length % 2 === 1) skipped++;
  for (let i = 0; i + 1 < pairs.length; i += 2) {
    const region = pairs[i] as FabricRegionId;
    const fabric = offered(pairs[i + 1]);
    if (regions.includes(region) && fabric) fabrics[region] = fabric;
    else skipped++;
  }
  return { worn: { ...now(), fabrics }, skipped };
}

function read(payload: string, fallback: string): ReadDesign {
  const unread: ReadDesign = { design: null, skipped: 1 };
  if (payload.length === 0 || payload.length > MOST) return unread;
  let text: string;
  try {
    text = decodeURIComponent(payload);
  } catch {
    return unread;
  }
  const [head, ...garments] = text.split("~");
  const [version, bodyCode, grain, ...more] = head.split(".");
  if (version !== VERSION) return unread;
  const body = (Object.keys(BODY_CODES) as BodyType[]).find((b) => BODY_CODES[b] === bodyCode);
  if (!body) return unread;

  let skipped = more.length;
  const direction = grain !== undefined && /^\d{1,3}$/.test(grain) && GRAIN_PRESETS.includes(Number(grain)) ? Number(grain) : 0;
  if (grain !== undefined && String(direction) !== grain) skipped++;

  let worn: WornGarment[] = [];
  if (garments.length > MOST_GARMENTS) skipped += garments.length - MOST_GARMENTS;
  for (const piece of garments.slice(0, MOST_GARMENTS)) {
    const { worn: one, skipped: left } = readGarment(piece, body, fallback);
    skipped += left;
    if (!one) continue;
    /* a garment twice, or one that cannot be worn with what is already on: what is on stays */
    const next = wear(worn, one);
    if (worn.some((w) => w.garmentId === one.garmentId) || next.length < worn.length + 1) skipped++;
    else worn = next;
  }
  if (worn.length === 0) return { design: null, skipped: Math.max(1, skipped) };
  return { design: { body, worn, direction }, skipped };
}

/**
 * The design in a link's `#` part, read strictly — see the top of this file.
 * `fallback` is a cloth to cut a garment from when its own is unknown: the
 * visualizer's fabric. Never throws: a link it cannot read gives no design.
 */
export function readDesign(payload: string, fallback: string): ReadDesign {
  try {
    return read(payload, fallback);
  } catch {
    return { design: null, skipped: 1 };
  }
}

/**
 * The outfit with a sent design on it: on the body it was made on — the one
 * on the stage put away exactly as it is, as changing the mannequin does —
 * in place of everything that body wore. The skin tone stays the viewer's own.
 */
export function wearSent(outfit: Outfit, design: SentDesign, fabricId: string): Outfit {
  const onBody = switchBody(outfit, design.body, fabricId);
  return { ...onBody, worn: design.worn, direction: design.direction };
}
