import type { Pt } from "@/lib/garments/fit";
import type { BodyType } from "@/types";
import type { RegionArt } from "./index";
import { BOW_SHADOW, asFold, crispLayers, type CrispPart } from "./female/tieArt";
import { shirtTie, type ShirtTieStyle } from "./shirtTies";

/**
 * A tie worn with a shirt collar, as a region of the garment the collar is
 * sewn to — see `shirtTie` for its pieces. Lit as the round 24 bows are, flat
 * and crisp in any cloth: each piece in the flat tone, its folds a crisp
 * crest over a soft turn, a fine light along the edges of what shows of each
 * part, and under its edges a narrow, sharp shadow — no blur, no relief, so
 * a print on it stays at its true size. In a cloth of its own: see `setTie`.
 */

const cache = new Map<string, RegionArt>();

export function shirtTieArt(style: ShirtTieStyle, body: BodyType, meet: Pt, waistY: number): RegionArt {
  const key = `${style}|${body}|${meet[0]}|${meet[1]}|${waistY}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const tie = shirtTie(style, body, meet, waistY);
  /* what shows of each part: it, less every part after it */
  const parts: CrispPart[] = tie.parts.map((p, i) => ({
    id: `tie-${p.id}`,
    pieces: p.pieces,
    over: tie.parts.slice(i + 1).flatMap((q) => q.pieces),
    folds: p.folds.map(asFold),
  }));
  const art: RegionArt = {
    /* a close-up of a necktie takes in its knot and the blade under it; of a bow tie, the bow */
    focus: [Math.round(tie.at[0]), Math.round(tie.at[1]) + (style === "necktie" ? 40 : 14)],
    outline: "soft",
    /** Cut on the bias, which is why a tie ties and drapes at all. */
    grain: { turn: 45 },
    shape: (fill) => (
      <>
        {tie.pieces.map((d, i) => (
          <path key={i} d={d} fill={fill} />
        ))}
      </>
    ),
    ...crispLayers(tie.pieces, parts),
    shadow: BOW_SHADOW,
  };
  cache.set(key, art);
  return art;
}
