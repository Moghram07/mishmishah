import { describe, expect, it } from "vitest";
import { garmentById } from "@/lib/data/garments";
import { collarsFitting, collarOf, cutFrom, everyWardrobe, necklineOf, regionsOf, setCollar, setNeckline, setSleeve, sleeveOf, switchBody, takeOff, wear } from "./outfit";
import { necklinesForGarment } from "@/lib/data/necklines";
import type { BodyType, Outfit, WornGarment } from "@/types";
import { DEFAULT_SKIN_TONE } from "@/lib/data/skinTones";

/**
 * Switching mannequin, and what it must never do: redesign a garment.
 *
 * The reported case, exactly: a dress cut high, sewn with a mandarin collar,
 * puff sleeves to the elbow and a plaid skirt. Female → male → female brought
 * it back cut round (shown as no neckline at all), set-in short, the skirt in
 * the bodice's linen — and still wearing the mandarin, now on a neck it did not
 * fit. The outfit was one list, a switch replaced it with the other body's
 * counterparts, and the way back rebuilt the dress from the thobe.
 */

const LINEN = "fb-apricot-linen";
const PLAID = "fb-indigo-plaid";

const g = (id: string) => {
  const found = garmentById(id);
  if (!found) throw new Error(`no garment "${id}"`);
  return found;
};

const dressed = (body: BodyType, worn: WornGarment[]): Outfit => ({
  bodyType: body,
  skinTone: DEFAULT_SKIN_TONE,
  worn,
  direction: 0,
});

/** The reported dress: High, Mandarin, Puff to the elbow, a plaid skirt in gold thread. */
function reportedDress(): WornGarment[] {
  let worn = [cutFrom(g("female-dress"), LINEN)];
  worn = setNeckline(worn, "female-dress", "female-high-neckline");
  worn = setCollar(worn, "female-dress", "female-mandarin-collar");
  worn = setSleeve(worn, "female-dress", { type: "puff", length: "elbow" });
  return worn.map((w) => ({
    ...w,
    fabrics: { ...w.fabrics, bottom: PLAID },
    stitch: { ...w.stitch, bottom: "gold" },
  }));
}

/** Everything the picker shows about a worn garment, read the way it reads it. */
const design = (w: WornGarment) => ({
  garment: w.garmentId,
  neckline: necklineOf(w)?.id,
  collar: collarOf(w)?.id,
  sleeve: sleeveOf(w),
  fabrics: w.fabrics,
  stitch: w.stitch,
});

const there = (o: Outfit, body: BodyType) =>
  body === o.bodyType ? o : switchBody(o, body, LINEN);

describe("a mannequin switch never redesigns a garment", () => {
  it("brings the reported dress back exactly: female → male → female", () => {
    const start = dressed("female", reportedDress());
    expect(design(start.worn[0])).toMatchObject({
      neckline: "female-high-neckline",
      collar: "female-mandarin-collar",
      sleeve: { type: "puff", length: "elbow" },
    });

    const back = there(there(start, "male"), "female");
    expect(back.bodyType).toBe("female");
    expect(back.worn).toEqual(start.worn);
    expect(back.worn.map(design)).toEqual(start.worn.map(design));
  });

  it("brings his outfit back exactly: male → female → male", () => {
    let worn = [cutFrom(g("male-thobe"), LINEN)];
    worn = setCollar(worn, "male-thobe", "male-shirt-collar");
    worn = setSleeve(worn, "male-thobe", { type: "raglan", length: "three-quarter" });
    worn = worn.map((w) => ({ ...w, fabrics: { ...w.fabrics, placket: PLAID } }));
    const start = dressed("male", worn);

    const back = there(there(start, "female"), "male");
    expect(back.worn).toEqual(start.worn);
    expect(design(back.worn[0])).toMatchObject({
      collar: "male-shirt-collar",
      sleeve: { type: "raglan", length: "three-quarter" },
    });
  });

  it("survives any number of trips, with either body edited in between", () => {
    let o = there(dressed("female", reportedDress()), "male");
    // he is changed while he is on the stage...
    o = { ...o, worn: setSleeve(o.worn, "male-thobe", { type: "kimono", length: "elbow" }) };
    const his = o.worn;
    o = there(o, "female");
    const hers = o.worn;
    for (let i = 0; i < 3; i++) {
      o = there(there(o, "male"), "female");
    }
    expect(o.worn).toEqual(hers);
    // ...and what was done to him is still on him, not on her
    expect(there(o, "male").worn).toEqual(his);
    expect(sleeveOf(hers[0])).toEqual({ type: "puff", length: "elbow" });
  });

  it("holds for every neckline, every collar it can carry, and every sleeve it offers", () => {
    const dress = g("female-dress");
    for (const neckline of necklinesForGarment(dress)) {
      const cut = setNeckline([cutFrom(dress, LINEN)], dress.id, neckline.id);
      const collars = [undefined, ...collarsFitting(dress, cut[0]).map((c) => c.id)];
      for (const collarId of collars) {
        let worn = collarId ? setCollar(cut, dress.id, collarId) : cut;
        const sleeve = sleeveOf(worn[0]);
        if (sleeve) worn = setSleeve(worn, dress.id, { ...sleeve, length: "long" });
        const start = dressed("female", worn);
        const back = there(there(start, "male"), "female");
        const label = `${neckline.cut} + ${collarId ?? "no collar"}`;
        expect(back.worn.map(design), label).toEqual(start.worn.map(design));
      }
    }
  });

  it("keeps a whole outfit — fabric and thread on every piece", () => {
    let worn = wear([], cutFrom(g("female-t-shirt"), PLAID));
    worn = wear(worn, cutFrom(g("female-skirt"), "fb-rose-silk"));
    worn = wear(worn, cutFrom(g("female-jacket"), "fb-emerald-velvet"));
    worn = setSleeve(worn, "female-t-shirt", { type: "bell", length: "elbow" });
    const start = dressed("female", worn);
    const back = there(there(start, "male"), "female");
    expect(back.worn).toEqual(start.worn);
  });

  it("leaves a mannequin that was undressed undressed", () => {
    let o = there(dressed("female", reportedDress()), "male");
    o = { ...o, worn: takeOff(o.worn, "male-thobe") };
    o = there(there(o, "female"), "male");
    expect(o.worn).toEqual([]);
  });

  it("never lets one body's garments reach the other", () => {
    let o = dressed("female", reportedDress());
    for (const body of ["male", "female", "male"] as const) {
      o = there(o, body);
      for (const w of o.worn) expect(g(w.garmentId).gender).toBe(body);
      for (const [owner, list] of Object.entries(o.away ?? {})) {
        for (const w of list ?? []) expect(g(w.garmentId).gender).toBe(owner);
      }
    }
  });
});

describe("the first time a body is dressed, from the other", () => {
  it("carries the collar, and the sleeve where he has one", () => {
    const o = there(dressed("female", reportedDress()), "male");
    expect(o.worn.map((w) => w.garmentId)).toEqual(["male-thobe"]);
    const [thobe] = o.worn;
    expect(collarOf(thobe)?.id).toBe("male-mandarin-collar");
    // no puff sleeve is cut for him, so the thobe's own type — at her length
    expect(sleeveOf(thobe)).toEqual({ type: "set-in", length: "elbow" });
    // the bodice's cloth, and the collar's own
    expect(thobe.fabrics.body).toBe(LINEN);
    expect(regionsOf(g("male-thobe"), thobe)).toContain("collar");
  });

  it("cuts her a neck that carries the collar coming across", () => {
    // A thobe has no neckline to copy, and arrives in the regular thobe collar,
    // which she has none of: it comes across as her mandarin — see
    // `Collar.across` — and a mandarin needs a high opening, so the dress is
    // cut high rather than left round under a collar it cannot take.
    let worn = [cutFrom(g("male-thobe"), LINEN)];
    worn = setSleeve(worn, "male-thobe", { type: "raglan", length: "elbow" });
    const o = there(dressed("male", worn), "female");
    const [dress] = o.worn;
    expect(dress.garmentId).toBe("female-dress");
    expect(necklineOf(dress)?.id).toBe("female-high-neckline");
    expect(collarOf(dress)?.id).toBe("female-mandarin-collar");
    expect(sleeveOf(dress)).toEqual({ type: "raglan", length: "elbow" });
  });

  it("dresses a new body when nothing worn has a counterpart that fits", () => {
    const o = switchBody(dressed("female", reportedDress()), "male", LINEN);
    expect(o.worn.length).toBeGreaterThan(0);
    expect(switchBody(dressed("female", []), "male", LINEN).worn).toEqual([]);
  });
});

describe("a cut and its collar always agree", () => {
  it("reads a dress with no cut stored as the cut it is drawn in", () => {
    const { necklineId: _gone, ...uncut } = cutFrom(g("female-dress"), LINEN);
    expect(necklineOf(uncut)?.id).toBe("female-round-neckline");
  });

  it("does not sew a collar to a neck that cannot carry it", () => {
    // Stored, but the round opening has nothing for a mandarin to stand on.
    const stale: WornGarment = {
      ...cutFrom(g("female-dress"), LINEN),
      collarId: "female-mandarin-collar",
    };
    expect(collarOf(stale)).toBeUndefined();
    expect(regionsOf(g("female-dress"), stale)).not.toContain("collar");
  });

  it("takes a collar off when the dress is recut under it", () => {
    const worn = setNeckline(reportedDress(), "female-dress", "female-v-neckline");
    expect(worn[0].collarId).toBeUndefined();
    expect(worn[0].fabrics.collar).toBeUndefined();
  });
});

describe("a change made everywhere", () => {
  it("reaches the mannequin put away as well as the one on the stage", () => {
    const o = there(dressed("female", reportedDress()), "male");
    const recut = everyWardrobe(o, (worn) =>
      worn.map((w) => cutFrom(g(w.garmentId), "fb-rose-silk"))
    );
    expect(recut.worn[0].fabrics.body).toBe("fb-rose-silk");
    expect(recut.away?.female?.[0].fabrics.top).toBe("fb-rose-silk");
  });
});
