import type { BodyType, Garment, WornGarment } from "@/types";
import { garmentsFor } from "@/lib/data/garments";
import { necklinesForGarment } from "@/lib/data/necklines";
import { sleeveCuffsFor, sleeveLengthsFor, sleeveTypesFor } from "@/lib/data/sleeves";
import { beltsFor } from "@/lib/data/closures";
import { tiesFor } from "@/lib/data/collars";
import { fabricById, tieStartOn } from "@/lib/data/fabrics";
import { bodyById } from "@/lib/mannequin/bodies";
import { edgeAt, profileFor } from "@/lib/mannequin/profile";
import { focusOf } from "@/lib/garments/closeUp";
import {
  collarsFitting,
  cutFrom,
  necklineOf,
  setBelt,
  setBowAt,
  setCollar,
  setNeckline,
  setSleeve,
  setTie,
  sleeveOf,
  tiesOffered,
} from "@/lib/garments/outfit";
import { LOOKS } from "@/lib/data/looks";
import { pictureKey, PICTURE_PX, type PictureKind } from "./optionPictures";

/**
 * How each option picture on the phone's cards is drawn: the garment it is
 * an option of, wearing that option, framed on it — by the real
 * `MannequinStage`, in one cloth, so the only difference between two cards
 * is the option. `optionPictures.test.tsx` draws them all into one sheet;
 * `scripts/option-pictures.mjs` photographs each into a small WebP.
 *
 * Every option is drawn on the garment it is offered on: an abaya's butterfly
 * sleeve looks nothing like a dress's flutter, so a sleeve type has a picture
 * per garment, not one for all.
 *
 * Only for the tests and the generator — the app reads the manifest alone.
 */

/** The cloth every picture is cut from: the apricot linen the visualizer opens in. */
export const PICTURE_CLOTH = "fb-apricot-linen";
/** A part that would vanish in the garment's own cloth — a tie, a sash — is cut from this instead, so it shows. */
export const PICTURE_CONTRAST = "fb-navy";

export interface PictureRecipe {
  key: string;
  kind: PictureKind;
  body: BodyType;
  garmentId: string;
  worn: WornGarment[];
  zoom: number;
  focus: readonly [number, number];
}

/** How each garment's own card is framed: on the garment, top to hem. */
const GARMENT_VIEW: Record<string, { zoom: number; focus: [number, number] }> = {
  "female-t-shirt": { zoom: 2, focus: [300, 340] },
  "female-blouse": { zoom: 2, focus: [300, 340] },
  "female-jacket": { zoom: 1.9, focus: [300, 360] },
  "female-skirt": { zoom: 1.7, focus: [300, 560] },
  "female-trousers": { zoom: 1.35, focus: [300, 640] },
  "female-dress": { zoom: 1.3, focus: [300, 480] },
  "female-abaya": { zoom: 1.15, focus: [300, 520] },
  "male-t-shirt": { zoom: 2, focus: [300, 350] },
  "male-shirt": { zoom: 2, focus: [300, 350] },
  "male-polo": { zoom: 2, focus: [300, 350] },
  "male-jacket": { zoom: 1.9, focus: [300, 370] },
  "male-trousers": { zoom: 1.35, focus: [300, 650] },
  "male-thobe": { zoom: 1.15, focus: [300, 520] },
};

/** A sleeve type's picture shows the length its character shows best: a puff short, a bishop long. */
const SHORT_TYPES = new Set(["puff", "flutter", "cap", "off-shoulder"]);
function pictureLength(type: string, lengths: string[]): string {
  if (SHORT_TYPES.has(type)) return lengths.find((l) => l !== "sleeveless") ?? lengths[0];
  return lengths.includes("long") ? "long" : lengths[lengths.length - 1];
}

/** The garment's necklines, its own default first — the picture is drawn on the first that offers the option. */
function necklineIds(g: Garment, base: WornGarment): (string | undefined)[] {
  const all = necklinesForGarment(g).map((n) => n.id);
  if (all.length === 0) return [undefined];
  const own = base.necklineId;
  return own ? [own, ...all.filter((id) => id !== own)] : all;
}

const on = (worn: WornGarment[], g: Garment, necklineId: string | undefined) =>
  necklineId && necklineId !== worn[0].necklineId ? setNeckline(worn, g.id, necklineId) : worn;

export function pictureRecipes(): PictureRecipe[] {
  const cloth = fabricById(PICTURE_CLOTH)!;
  const out: PictureRecipe[] = [];
  for (const body of ["female", "male"] as const) {
    const a = bodyById(body).anchors;
    const p = profileFor(body);
    const x = a.centerX;
    const wristX = (edgeAt(p.armOuter, p.wristY) ?? 160) + 14;
    const VIEW: Record<Exclude<PictureKind, "garment" | "look">, { zoom: number; focus: [number, number] }> = {
      neckline: { zoom: 3.4, focus: [x, a.shoulderY + 43] },
      sleeve: { zoom: 2.6, focus: [x, Math.round((a.shoulderY + p.wristY) / 2) + 8] },
      collar: { zoom: 3.6, focus: [x, a.shoulderY + 15] },
      tie: { zoom: 3, focus: [x, a.shoulderY + 85] },
      belt: { zoom: 2.5, focus: [x, a.waistY + 70] },
      cuff: { zoom: 4.5, focus: [wristX, p.wristY] },
    };

    for (const g of garmentsFor(body)) {
      const base = [cutFrom(g, cloth.id)];
      const add = (kind: Exclude<PictureKind, "look">, id: string | undefined, worn: WornGarment[], view = kind === "garment" ? GARMENT_VIEW[g.id] : VIEW[kind]) => {
        if (!view) throw new Error(`no picture framing for ${g.id}`);
        out.push({ key: pictureKey(g.id, kind, id), kind, body, garmentId: g.id, worn, zoom: view.zoom, focus: view.focus });
      };
      const done = new Set<string>();
      const once = (kind: PictureKind, id: string) => {
        const k = `${kind}:${id}`;
        if (done.has(k)) return false;
        done.add(k);
        return true;
      };

      add("garment", undefined, base);

      for (const n of necklinesForGarment(g)) add("neckline", n.id, setNeckline(base, g.id, n.id));

      for (const nid of necklineIds(g, base[0])) {
        const worn = on(base, g, nid);
        const neckline = necklineOf(worn[0]);

        // each sleeve type, at the length its character shows
        for (const type of sleeveTypesFor(g, neckline)) {
          if (!once("sleeve", type)) continue;
          const length = pictureLength(type, sleeveLengthsFor(type, neckline, g));
          add("sleeve", type, setSleeve(worn, g.id, { type, length } as never));
        }

        // no collar, and each collar the cut takes
        const collars = collarsFitting(g, worn[0]);
        if (collars.length > 0 && once("collar", "none")) add("collar", "none", setCollar(worn, g.id, undefined));
        for (const c of collars) if (once("collar", c.id)) add("collar", c.id, setCollar(worn, g.id, c.id), { ...VIEW.collar, focus: collarFocus(g, setCollar(worn, g.id, c.id)[0], VIEW.collar.focus) });

        // each tie, on the first collar (or none) that takes it, in a cloth that shows
        for (const c of [undefined, ...collars.map((c) => c.id)]) {
          const collared = c === undefined ? setCollar(worn, g.id, undefined) : setCollar(worn, g.id, c);
          for (const t of tiesFor(tiesOffered(collared[0]), g.gender)) {
            if (!once("tie", t.id)) continue;
            const tied = t.id === "none" ? collared : setTie(collared, g.id, t.id, tieStartOn(cloth).id);
            add("tie", t.id, tied.map((w) => (w.garmentId === g.id && t.id !== "none" && t.id !== "necktie" && t.id !== "bowtie" ? { ...w, fabrics: { ...w.fabrics, tie: PICTURE_CONTRAST } } : w)));
          }
        }

        // each belt; a sash or a ribbon tied at the front, in a cloth that shows
        for (const b of beltsFor(g, neckline?.cut)) {
          if (!once("belt", b.id)) continue;
          let belted = setBelt(worn, g.id, b.id);
          if (b.id === "sash" || b.id === "ribbon") {
            belted = setBowAt(belted, g.id, "front").map((w) => (w.garmentId === g.id ? { ...w, fabrics: { ...w.fabrics, belt: PICTURE_CONTRAST } } : w));
          }
          add("belt", b.id, belted);
        }

        // each cuff, on the first sleeve that takes it — a long set-in one when it can
        const types = sleeveTypesFor(g, neckline);
        for (const type of ["set-in", ...types.filter((t) => t !== "set-in")]) {
          if (!types.includes(type as never)) continue;
          const lengths = sleeveLengthsFor(type as never, neckline, g);
          for (const length of ["long", ...lengths.filter((l) => l !== "long")]) {
            if (!lengths.includes(length as never)) continue;
            const sleeved = setSleeve(worn, g.id, { type, length } as never);
            const sleeve = sleeveOf(sleeved[0]);
            if (!sleeve) continue;
            for (const cuff of sleeveCuffsFor(g, sleeve)) {
              if (!once("cuff", cuff)) continue;
              add("cuff", cuff, setSleeve(worn, g.id, { type, length, cuff } as never));
            }
          }
        }
      }
    }
  }
  // the ready-made looks, each whole, in its own cloths
  for (const look of LOOKS) {
    out.push({ key: pictureKey(look.body, "look", look.id), kind: "look", body: look.body, garmentId: look.body, worn: look.worn(), zoom: 1.15, focus: [300, 505] });
  }
  return out;
}

/** A collar's own focus, on its drawing, when it has one; else the body's. */
function collarFocus(g: Garment, worn: WornGarment, fallback: [number, number]): [number, number] {
  const f = focusOf(g, worn, "collar");
  return f ? [f[0], f[1]] : fallback;
}

/** The stage a picture is drawn into: the card's picture well, at the pixels it is shot at. */
export const PICTURE_VIEWPORT = { width: PICTURE_PX[0], height: PICTURE_PX[1] } as const;
