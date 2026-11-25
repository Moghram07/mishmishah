import { describe, expect, it } from "vitest";
import {
  LOPSIDED,
  NECKLINE_BARES,
  NECKLINE_IDS,
  NECKLINE_OPENING,
  NECKLINE_SLEEVES,
  NECKLINE_WANTS,
  necklineCut,
  type NecklineId,
  neckLandmarks,
  outlineX,
} from "./necklines";
import { BODICES, bodiceFor, cloth } from "./art/female/dressCut";
import { necklineById, necklines, necklinesForGarment } from "@/lib/data/necklines";
import { collarById, collars, collarsForGarment } from "@/lib/data/collars";
import { garmentById } from "@/lib/data/garments";
import { collarsFitting, cutFrom, necklineOf, setCollar, setNeckline, setSleeve, sleeveOf } from "./outfit";
import { effectiveCoverage } from "./outfit";
import { TIP_LEFT, NECK_BASE_SEAM } from "./art/female/yoke";
import type { SleeveChoice } from "@/types";
import { bodies } from "@/lib/mannequin/bodies";
import { insideRings, ringsOf } from "./stripes";

/**
 * The fifteen cuts.
 *
 * `check:garments` measures each one against the mannequin — holes, the arm
 * gap, the shoulder seam, symmetry. What it cannot say is whether the record
 * and the geometry agree about what a cut *does*: a record claiming a cut bares
 * the shoulders, over a cut that still covers them, would erase nothing and
 * look perfectly fine while being a lie the rest of the system reads.
 */

const spec = {
  shoulderTip: [TIP_LEFT[0], TIP_LEFT[1]] as [number, number],
  ease: 6,
  seamY: NECK_BASE_SEAM,
};

/** Every number in a path, as points. */
const points = (d: string) => {
  const xs = (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);
  return Array.from({ length: Math.floor(xs.length / 2) }, (_, i) => [
    xs[2 * i],
    xs[2 * i + 1],
  ]);
};

describe("every cut draws something, against the real body", () => {
  it.each(NECKLINE_IDS)("drafts %s", (id) => {
    const cut = necklineCut("female", id, spec);
    expect(cut.edge.length, id).toBeGreaterThan(20);
    expect(cut.tip[0], id).toBeGreaterThan(100);
    expect(cut.tip[0], id).toBeLessThan(300);
    // nothing is drafted above the jaw, which is at y 131 on her
    for (const [, y] of points(cut.edge)) {
      expect(y, `${id} reaches y ${y}`).toBeGreaterThan(140);
    }
  });

  it.each(NECKLINE_IDS)("gives %s a bodice with cloth in it", (id) => {
    expect(BODICES[id].pieces.length, id).toBeGreaterThan(0);
    expect(cloth({ neckline: id }).length, id).toBeGreaterThan(1);
  });
});

describe("the record and the geometry agree", () => {
  it("has one record per cut, and no more", () => {
    expect(necklines.map((n) => n.cut).sort()).toEqual([...NECKLINE_IDS].sort());
  });

  it("drops the shoulders exactly where the cut leaves them", () => {
    /*
      A cut whose top corner is at the shoulder point still has shoulders; one
      whose corner has dropped onto the arm or down to the underarm does not.
      The record has to say the same thing, or coverage erases a shoulder that
      nothing paints over.
    */
    for (const id of NECKLINE_IDS) {
      const cut = necklineCut("female", id, spec);
      const onTheShoulder = cut.tip[1] <= spec.shoulderTip[1] + 1;
      if (!onTheShoulder) {
        expect(NECKLINE_BARES[id], id).toContain("shoulderCap");
      }
    }
  });

  it("bares the arm exactly when it takes a sleeve off, or its opening reaches into the arm's zone", () => {
    /* the upper arm's zone, and each cut's opening: a cut whose opening reaches inside it would erase skin it leaves bare */
    const zone = ringsOf(bodies.female.zones.upperArm);
    const reaches = (id: (typeof NECKLINE_IDS)[number]) => {
      const opening = bodiceFor(id).cut.parts?.opening;
      return opening ? ringsOf(opening).flat().some((p) => insideRings(zone, p)) : false;
    };
    expect(reaches("square")).toBe(true);
    expect(reaches("round")).toBe(false);
    for (const id of NECKLINE_IDS) {
      const bares = NECKLINE_SLEEVES[id] !== "both" || reaches(id);
      expect(NECKLINE_BARES[id].includes("upperArm"), id).toBe(bares);
    }
  });

  it("offers a seam exactly where it offers an opening", () => {
    for (const id of NECKLINE_IDS) {
      const seam = BODICES[id].cut.seam;
      if (NECKLINE_OPENING[id] === null) continue;
      expect(seam.length, `${id} presents an opening with no seam`).toBeGreaterThan(10);
    }
  });

  it("only wants a collar that exists and fits the opening it presents", () => {
    for (const [id, wanted] of Object.entries(NECKLINE_WANTS)) {
      const collar = collarById(wanted!);
      expect(collar, `${id} wants ${wanted}`).toBeDefined();
      expect(collar!.opening, id).toBe(NECKLINE_OPENING[id as NecklineId]);
    }
  });
});

describe("asymmetry is on purpose, and only where it is claimed", () => {
  const lopsided = (id: NecklineId) => {
    const pts = points(BODICES[id].pieces[0]);
    let worst = 0;
    for (const [x, y] of pts) {
      // the nearest point on the other side at roughly this height
      let near = Infinity;
      for (const [x2, y2] of pts) {
        if (Math.abs(y2 - y) > 2) continue;
        near = Math.min(near, Math.abs(600 - x2 - x));
      }
      if (near !== Infinity) worst = Math.max(worst, near);
    }
    return worst;
  };

  it("draws the lopsided cuts lopsidedly", () => {
    for (const id of LOPSIDED) {
      expect(lopsided(id), id).toBeGreaterThan(20);
    }
  });

  it("draws the rest as one shape mirrored", () => {
    for (const id of NECKLINE_IDS) {
      if (LOPSIDED.includes(id)) continue;
      expect(lopsided(id), id).toBeLessThan(6);
    }
  });
});

describe("cutting a dress, and what it does to the collar", () => {
  const dress = garmentById("female-dress")!;
  const wornAs = (cut: NecklineId) =>
    setNeckline([cutFrom(dress, "fb-apricot-linen")], dress.id, `female-${cut}-neckline`)[0];

  it("offers all fourteen on the dress and none on a skirt", () => {
    expect(necklinesForGarment(dress)).toHaveLength(14);
    expect(necklinesForGarment(garmentById("female-skirt")!)).toHaveLength(0);
  });

  it("opens a look cut to the retired one-shoulder as the asymmetrical, sleeveless", () => {
    const worn = setNeckline([cutFrom(dress, "fb-apricot-linen")], dress.id, "female-one-shoulder-neckline")[0];
    expect(necklineOf(worn)?.id).toBe("female-asymmetrical-neckline");
    expect(sleeveOf(worn)?.length).toBe("sleeveless");
    expect(necklinesForGarment(dress).map((n) => n.id)).not.toContain("female-one-shoulder-neckline");
    /* and it is offered under the name the old one had */
    expect(necklineById("female-asymmetrical-neckline")?.name).toEqual({ en: "One-shoulder", ar: "كتف واحد" });
  });

  it("takes a collar off when the cut cannot carry one", () => {
    const withCollar = setCollar(
      [cutFrom(dress, "fb-apricot-linen")],
      dress.id,
      "female-turtleneck-collar"
    );
    const strapless = setNeckline(withCollar, dress.id, "female-sweetheart-neckline")[0];
    expect(strapless.collarId).toBeUndefined();
  });

  it("sews one on for the cut that is not itself without one", () => {
    expect(wornAs("collared").collarId).toBe("female-shirt-collar");
  });

  it("offers only the collars the cut can actually take", () => {
    // a standing band needs cloth at the base of the throat
    const high = collarsFitting(dress, wornAs("high"));
    expect(high.length).toBeGreaterThan(0);
    expect(high.every((c) => c.opening === "high")).toBe(true);

    // a strapless bodice has nothing to sew one to
    expect(collarsFitting(dress, wornAs("sweetheart"))).toHaveLength(0);

    // and a flat collar wants the wide opening, not the high one — besides the sailor, which follows it
    const round = collarsFitting(dress, wornAs("round"));
    expect(round.filter((c) => c.id !== "female-sailor-collar").every((c) => c.opening === "round")).toBe(true);

    // a V takes the sailor collar, which began on one, and nothing else
    expect(collarsFitting(dress, wornAs("v")).map((c) => c.id)).toEqual(["female-sailor-collar"]);
    // and the sailor goes on the cuts it follows, each cut its own way, and on no other
    for (const cut of ["round", "scoop", "boat", "v", "square", "high", "keyhole", "cowl", "wrap", "collared", "off-shoulder", "sweetheart", "halter", "asymmetrical"] as const) {
      const offered = collarsFitting(dress, wornAs(cut)).map((c) => c.id).includes("female-sailor-collar");
      expect(offered, cut).toBe(["v", "boat", "wrap", "round", "square", "scoop"].includes(cut));
    }
    // nor on a top: neither her t-shirt nor her blouse has a V
    for (const id of ["female-t-shirt", "female-blouse"]) {
      expect(collarsForGarment(garmentById(id)!).map((c) => c.id), id).not.toContain("female-sailor-collar");
    }
  });

  it("bares the shoulders on the cuts that have none", () => {
    const covered = effectiveCoverage(dress, wornAs("round"));
    expect(covered).toContain("shoulderCap");
    // A short sleeve ends above the elbow and does not span the upper arm, so
    // it does not claim it: the arm below the cuff is left in the photograph.
    expect(covered).not.toContain("upperArm");
    const elbow = setSleeve([wornAs("round")], dress.id, { type: "set-in", length: "elbow" })[0];
    expect(effectiveCoverage(dress, elbow)).toContain("upperArm");

    const bare = effectiveCoverage(dress, wornAs("halter"));
    expect(bare).not.toContain("shoulderCap");
    expect(bare).not.toContain("upperArm");
    // and keeps everything the cut does not touch
    expect(bare).toContain("torso");
    expect(bare).toContain("thigh");
  });

  it("keeps the cut when a collar is taken off", () => {
    // `setCollar` used to rebuild the worn garment longhand, which dropped
    // every field it did not name — invisible while `collarId` was the only one.
    const cut = wornAs("collared");
    expect(cut.collarId).toBeDefined();
    const bare = setCollar([cut], dress.id, undefined)[0];
    expect(bare.necklineId).toBe("female-collared-neckline");
  });

  it("refuses a cut the garment was never offered", () => {
    const worn = setNeckline(
      [cutFrom(dress, "fb-apricot-linen")],
      dress.id,
      "female-made-up-neckline"
    )[0];
    // stored, but never honoured — the same guard `collarOf` is
    expect(effectiveCoverage(dress, worn)).toEqual(
      effectiveCoverage(dress, cutFrom(dress, "fb-apricot-linen"))
    );
  });
});

describe("every collar still has somewhere to go", () => {
  it("leaves no female collar unwearable", () => {
    const dress = garmentById("female-dress")!;
    for (const collar of collars.filter((c) => c.gender === "female")) {
      if (!collar.compatibleWith.includes("dress")) continue;
      /* the openings it is sewn into on a dress — see `Collar.cuts` */
      const cut = NECKLINE_IDS.find((id) => (collar.cuts ?? [collar.opening]).some((o) => NECKLINE_OPENING[id] === o));
      expect(cut, `${collar.id} fits no cut of the dress`).toBeDefined();
      expect(
        collarsFitting(
          dress,
          setNeckline(
            [cutFrom(dress, "fb-apricot-linen")],
            dress.id,
            `female-${cut}-neckline`
          )[0]
        ).map((c) => c.id)
      ).toContain(collar.id);
    }
  });
});

describe("the bodice's cloth", () => {
  it("draws no seam lines down any cut, at any waist: the fabric shows whole", () => {
    for (const waist of ["empire", "natural", "dropped"] as const) {
      for (const id of NECKLINE_IDS) {
        const b = bodiceFor(id, undefined, waist);
        /* no princess seams of the dress's, and no cut — a sweetheart — with seams of its own */
        expect("princess" in b, `${id} ${waist}`).toBe(false);
        expect("seams" in b.cut, `${id} ${waist}`).toBe(false);
      }
    }
  });
});

describe("the neck's landmarks, and the cuts on a bare neck", () => {
  it("marks where the neck meets each shoulder, mirrored about the neck's own axis, and the front of its base below them", () => {
    for (const body of ["female", "male"] as const) {
      const { left, right, front, axis } = neckLandmarks(body);
      expect(left[1], body).toBe(right[1]);
      expect(left[0] + right[0], body).toBeCloseTo(2 * axis, 9);
      expect(front[0], body).toBe(axis);
      expect(front[1] - left[1], body).toBeGreaterThan(8);
      expect(front[1] - left[1], body).toBeLessThan(20);
    }
  });

  it("cuts the crew and the V from those points: no cloth up the neck, and the back of the neckline behind it", () => {
    const lm = neckLandmarks("female");
    // the V from those points; the crew a little out onto the shoulder from them, 0.5–1 cm (2.6–5.3 units)
    const crew = necklineCut("female", "round", { ...spec, bare: true }).parts!;
    const out = Math.hypot(crew.neck[0] - lm.left[0], crew.neck[1] - lm.left[1]);
    expect(out).toBeGreaterThan(2.6);
    expect(out).toBeLessThan(5.3);
    expect(crew.neck[0] + crew.neckRight[0]).toBeCloseTo(2 * lm.axis + 2 * (300 - lm.axis) * 0, 0);
    for (const id of ["round", "v"] as const) {
      const bare = necklineCut("female", id, { ...spec, bare: true });
      if (id === "v") expect(bare.parts!.neck, id).toEqual(lm.left);
      if (id === "v") expect(bare.parts!.neckRight, id).toEqual(lm.right);
      // nothing of its top edge higher than where the neck meets the shoulders
      const top = Math.min(...points(bare.edge).map(([, y]) => y));
      expect(top, id).toBeGreaterThan(lm.left[1] - 0.5);
      expect(bare.backNeck, id).toBeTruthy();
      // with a collar sewn on, the cut every collar was drafted against
      expect(necklineCut("female", id, spec).edge, id).not.toBe(bare.edge);
      expect(necklineCut("female", id, spec).backNeck, id).toBeUndefined();
    }
    // the crew's lowest point 2.5–3 cm (13.2–15.8 units) below the front of the neck's base, on its axis — not a high neck
    const opening = necklineCut("female", "round", { ...spec, bare: true }).neck!;
    expect(opening.seamY + opening.dip - neckLandmarks("female").front[1]).toBeGreaterThan(13.2);
    expect(opening.seamY + opening.dip - neckLandmarks("female").front[1]).toBeLessThan(15.8);
  });

  it("wraps a halter's band round the neck, and bares the shoulders and the upper chest beside it", () => {
    expect(NECKLINE_BARES.halter).toEqual(expect.arrayContaining(["shoulderCap", "upperArm", "upperChest"]));
    const band = necklineCut("female", "halter", spec).halter!;
    // its ends on the neck's own outline, above where the neck meets the shoulders
    const lm = neckLandmarks("female");
    for (const end of [band.upper[0], band.upper[band.upper.length - 1], band.lower[0], band.lower[band.lower.length - 1]]) expect(end[1]).toBeLessThan(lm.left[1]);
  });
});

describe("the corners on the outline as drawn, and the back band along it", () => {
  it("puts the bare crew's, V's, wrap's and scoop's corners on the drawn outline, mirrored, the cloth lying on the body there", () => {
    const lm = neckLandmarks("female");
    // the side points on the drawn outline
    expect(outlineX("female", lm.left[1], -1)).toBeCloseTo(lm.left[0], 6);
    expect(outlineX("female", lm.right[1], 1)).toBeCloseTo(lm.right[0], 6);
    for (const id of ["round", "v", "wrap", "scoop"] as const) {
      const p = necklineCut("female", id, { ...spec, bare: true }).parts!;
      // on the outline at its own row, and its twin level with it
      expect(Math.abs(outlineX("female", p.neck[1], -1) - p.neck[0]), id).toBeLessThan(1e-6);
      expect(p.neckRight[1], id).toBeCloseTo(p.neck[1], 9);
      // the shoulder seam leaves the corner along the body: never further off it than the seam's own ease, and only outward
      const strap = p.strapLeft;
      for (let i = 1; i < strap.length; i++) expect(strap[i][0], `${id} ${i}`).toBeLessThanOrEqual(strap[i - 1][0] + 1e-9);
    }
    // the wrap and the V from the same two points
    expect(necklineCut("female", "wrap", { ...spec, bare: true }).parts!.neck).toEqual(lm.left);
  });

  it("draws the back of the crew's and the V's neckline as a thin band: up the neck no higher than its rise, off the body by little", () => {
    const lm = neckLandmarks("female");
    for (const id of ["round", "v"] as const) {
      const back = necklineCut("female", id, { ...spec, bare: true }).backNeck!;
      const pts = points(back);
      expect(Math.min(...pts.map(([, y]) => y)), id).toBeGreaterThanOrEqual(lm.left[1] - 4 - 1e-6);
      // its outer edge on her left: past the drawn outline by no more than the seam's own ease there and a thin band
      for (const [x, y] of pts.filter(([x]) => x < lm.axis)) {
        const edge = outlineX("female", y, -1);
        const ease = 3 * Math.min(1, Math.max(0, (y - lm.left[1]) / 8));
        if (!Number.isNaN(edge) && y < lm.left[1] + 3) expect(edge - x - ease, `${id} at ${y.toFixed(1)}`).toBeLessThan(0.9);
      }
    }
  });
});
