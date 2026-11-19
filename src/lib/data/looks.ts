import type { BodyType, FabricRegionId, Localized, WornGarment } from "@/types";
import { garmentById } from "./garments";
import {
  cutFrom,
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
  wear,
} from "@/lib/garments/outfit";

/**
 * The ready-made looks — «تصاميم جاهزة» — the first category of the phone's
 * «القصّة»: a whole design in one tap, then every part of it free to change.
 *
 * Each is built with the visualizer's own outfit helpers, the way a person
 * would build it in the panel, so a look is never something the panel could
 * not make; `looks.test.ts` checks every choice lands, since a helper given an
 * id it does not know drops the choice without a word. Each brings its own
 * cloths, all of them our samples.
 */
export interface Look {
  id: string;
  body: BodyType;
  name: Localized;
  /** The garments, worn in order, each cut and in its cloths. */
  worn: () => WornGarment[];
}

const D = "female-dress";
const ABAYA = "female-abaya";
const THOBE = "male-thobe";
const SHIRT = "male-shirt";
const TROUSERS = "male-trousers";
const JACKET = "male-jacket";

/** Put a garment on, cut from one cloth throughout. */
const put = (worn: WornGarment[], id: string, cloth: string) => wear(worn, cutFrom(garmentById(id)!, cloth));
/** Give some of a worn garment's parts cloths of their own. */
const parts = (worn: WornGarment[], id: string, cloths: Partial<Record<FabricRegionId, string>>) =>
  worn.map((w) => (w.garmentId === id ? { ...w, fabrics: { ...w.fabrics, ...cloths } } : w));

export const LOOKS: readonly Look[] = [
  {
    id: "sailor",
    body: "female",
    name: { ar: "فستان بحّار", en: "Sailor dress" },
    worn: () => {
      let w = put([], D, "fb-navy");
      w = setNeckline(w, D, "female-boat-neckline");
      w = setCollar(w, D, "female-sailor-collar");
      w = setStripes(w, D, "three", "fb-white");
      w = setStripeEdges(w, D, ["collar", "hem"]);
      w = setTie(w, D, "scarf", "fb-red");
      w = setTieAt(w, D, "neck");
      w = setButtons(w, D, "waist");
      w = setButtonRows(w, D, "two");
      w = setSleeve(w, D, { type: "set-in", length: "sleeveless" });
      w = setSkirt(w, D, { shape: "pleated", length: "midi" });
      return parts(w, D, { trim: "fb-white", tie: "fb-red", collar: "fb-navy" });
    },
  },
  {
    id: "shirt-dress",
    body: "female",
    name: { ar: "فستان قميص", en: "Shirt dress" },
    worn: () => {
      let w = put([], D, "fb-blue-pinstripe");
      w = setNeckline(w, D, "female-collared-neckline");
      w = setCollar(w, D, "female-shirt-collar");
      w = setButtons(w, D, "hem");
      w = setBelt(w, D, "self");
      w = setSleeve(w, D, { type: "set-in", length: "short" });
      w = setSkirt(w, D, { shape: "aline", length: "midi" });
      return parts(w, D, { belt: "fb-blue-pinstripe", collar: "fb-blue-pinstripe" });
    },
  },
  {
    id: "modest-maxi",
    body: "female",
    name: { ar: "ماكسي محتشم", en: "Modest maxi" },
    worn: () => {
      let w = put([], D, "fb-ivory-roses");
      w = setNeckline(w, D, "female-high-neckline");
      w = setSleeve(w, D, { type: "set-in", length: "long", cuff: "plain" });
      return setSkirt(w, D, { shape: "flared", length: "maxi" });
    },
  },
  {
    id: "abaya",
    body: "female",
    name: { ar: "عباية", en: "Abaya" },
    worn: () => {
      // the black crepe dress under it shows only when the front is opened
      let w = put([], D, "fb-black-crepe");
      w = setSkirt(w, D, { shape: "aline", length: "maxi" });
      w = put(w, ABAYA, "fb-black-crepe-satin");
      w = setFront(w, ABAYA, "closed");
      return setSleeve(w, ABAYA, { type: "bell", length: "long" });
    },
  },
  {
    id: "evening",
    body: "female",
    name: { ar: "فستان سهرة", en: "Evening dress" },
    worn: () => {
      let w = put([], D, "fb-emerald-satin");
      w = setNeckline(w, D, "female-boat-neckline");
      w = setSleeve(w, D, { type: "bell", length: "long" });
      w = setSkirt(w, D, { shape: "flared", length: "maxi" });
      w = setBowAt(setBelt(w, D, "sash"), D, "front");
      return parts(w, D, { belt: "fb-emerald-satin" });
    },
  },
  {
    id: "white-thobe",
    body: "male",
    name: { ar: "ثوب أبيض", en: "White thobe" },
    worn: () => {
      let w = put([], THOBE, "fb-snow-white");
      w = setCollar(w, THOBE, "male-regular-collar");
      return setSleeve(w, THOBE, { type: "set-in", length: "long", cuff: "french" });
    },
  },
  {
    id: "winter-thobe",
    body: "male",
    name: { ar: "ثوب شتوي", en: "Winter thobe" },
    worn: () => {
      let w = put([], THOBE, "fb-winter-navy");
      w = setCollar(w, THOBE, "male-mandarin-collar");
      return setSleeve(w, THOBE, { type: "set-in", length: "long", cuff: "plain" });
    },
  },
  {
    id: "summer-linen",
    body: "male",
    name: { ar: "كتّان صيفي", en: "Summer linen" },
    worn: () => {
      let w = put([], SHIRT, "fb-sky-linen");
      w = setSleeve(w, SHIRT, { type: "set-in", length: "short" });
      w = put(w, TROUSERS, "fb-natural-linen");
      return setLeg(w, TROUSERS, "straight");
    },
  },
  {
    id: "suit",
    body: "male",
    name: { ar: "بدلة", en: "Suit" },
    worn: () => {
      let w = put([], SHIRT, "fb-snow-white");
      w = setSleeve(w, SHIRT, { type: "set-in", length: "long", cuff: "formal" });
      w = setTie(w, SHIRT, "necktie", "fb-burgundy-satin");
      w = parts(w, SHIRT, { tie: "fb-burgundy-satin" });
      w = put(w, TROUSERS, "fb-navy-pinstripe");
      w = setLeg(w, TROUSERS, "straight");
      return put(w, JACKET, "fb-navy-pinstripe");
    },
  },
];

/** The looks for the mannequin on the stage. */
export const looksFor = (body: BodyType) => LOOKS.filter((l) => l.body === body);
