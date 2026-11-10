import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { collars } from "@/lib/data/collars";
import { collarArt, garmentArt, type RegionArt } from "./art";
import { NECKLINE_IDS, NECKLINE_OPENING } from "./necklines";
import { bow } from "./art/female/collarCuts";
import { bodiceFor, covers, frontButtons } from "./art/female/dressCut";
import { FLAT_LIT } from "./shading";
import { BODY_CANVAS } from "../mannequin/bodies";
import { FabricRegion, beneathMasks, type RegionDrawing } from "@/components/visualizer/FabricRegion";
import { fabrics } from "@/lib/data/fabrics";
import { MannequinStage } from "@/components/visualizer/MannequinStage";
import { garmentById } from "@/lib/data/garments";
import { DEFAULT_SKIN_TONE } from "@/lib/data/skinTones";
import { cutFrom, wear } from "./outfit";
import type { Outfit } from "@/types";

/**
 * Round 13: every collar, on either body, lit as a seam is — and her
 * mandarin, the bow on a keyhole and the keyhole's edge as the user asked.
 */

const uid = (name: string) => `t-${name}`;
const CM = BODY_CANVAS.cmPerUnit;

/** A path's points, its curves' controls and ends alike — every command these drawings write is absolute. */
const points = (d: string): [number, number][] => {
  const n = (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < n.length; i += 2) out.push([n[i], n[i + 1]]);
  return out;
};
const pathOf = (markup: string) => [...markup.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]);

/** Every drawing of a collar: its front and its back, and the front on each cut it is sewn to. */
const drawingsOf = (c: (typeof collars)[number]): [string, RegionArt][] => {
  const out: [string, RegionArt][] = [];
  for (const asset of [c.asset.front, c.asset.behindBody].filter((a): a is string => Boolean(a))) {
    const art = collarArt(asset);
    if (art?.regions.collar) out.push([asset, art.regions.collar]);
    for (const cut of NECKLINE_IDS) {
      const on = art?.cut?.({ neckline: cut, opening: NECKLINE_OPENING[cut] ?? undefined })?.collar;
      if (on && on !== art?.regions.collar) out.push([`${asset} · ${cut}`, on]);
    }
  }
  return out;
};

describe("every collar, lit as a seam is", () => {
  it("draws no line round any collar, and gives none a form of its own", () => {
    for (const c of collars) {
      for (const [name, r] of drawingsOf(c)) {
        expect(r.outline, name).toBe("soft");
        expect(r.surface, name).toBeUndefined();
      }
    }
  });

  it("shades every collar in the garment's own light, and nothing darker but soft folds", () => {
    for (const c of collars) {
      for (const [name, r] of drawingsOf(c)) {
        const shading = r.shading ? renderToStaticMarkup(<>{r.shading(uid)}</>) : "";
        // the garment's flat light, first — or the collar comes out a shade lighter than the dress
        expect(shading, name).toContain(`fill="${FLAT_LIT}"`);
        // no gradient ramping it darker, no cut edge or rib stroked in grey, no hard-edged wedge
        expect(shading, name).not.toMatch(/url\(#t-(fall|under|flat|lift|shoulder)\)/);
        expect(shading, name).not.toMatch(/stroke="#(8a8a8a|9a9a9a|241e19)"/);
        expect(shading, name).not.toMatch(/fill="#(9d9d9d|c8c8c8|8a8a8a)"/);
        // and it throws no shadow of its own beyond the soft one its outline casts
        expect(r.cast, name).toBeUndefined();
      }
    }
  });
});

describe("a soft outline", () => {
  /* one square of cloth lying on something, drawn through the fabric renderer itself */
  const draw = (drawing: RegionDrawing) =>
    renderToStaticMarkup(
      <svg>
        <FabricRegion
          uidBase="t"
          drawing={drawing}
          fabric={fabrics.find((f) => f.id === "fb-apricot-linen")!}
          cmPerUnit={CM}
          pxPerUnit={1}
          direction={0}
          pivot={[300, 500]}
          canvas={[600, 1000]}
          stitch="tonal"
          beneath={beneathMasks((n) => `m-${n}`)}
        />
      </svg>
    );
  const square = (fill: string) => <path d="M100 100 L140 100 L140 140 L100 140 Z" fill={fill} />;

  it("strokes no line round the piece, against the page or on what it lies on", () => {
    const plain = draw({ shape: square });
    const soft = draw({ shape: square, outline: "soft" });
    // a piece drawn as before keeps both its rim and its dark edge
    expect(plain).toContain(`stroke="currentColor"`);
    expect(plain).toContain(`stroke="#241e19"`);
    expect(soft).not.toContain(`stroke="currentColor"`);
    expect(soft).not.toContain(`stroke="#241e19"`);
  });

  it("still throws a soft shadow under its edge, lighter than other pieces throw", () => {
    const opacity = (markup: string) => Number(/stroke="#5c4a3e" stroke-opacity="([\d.]+)"/.exec(markup)?.[1]);
    const plain = opacity(draw({ shape: square }));
    const soft = opacity(draw({ shape: square, outline: "soft" }));
    expect(soft).toBeGreaterThan(0);
    expect(soft).toBeLessThan(plain);
  });

  /*
    Round 14: on a busy print the Peter Pan all but disappeared at whole-figure
    size. Its shadow is the one edge it has, so it is stronger — and thrown
    only from its free edges, never along the neckline, which is a seam.
  */
  it("under a Peter Pan, stronger and wider than a soft outline's, from its free edges only, still no line", () => {
    /* each piece's shadow, drawn just before it: its strength, and the edges it is thrown from */
    const shadowOf = (markup: string) => {
      const gs = [...markup.matchAll(/<g filter="url\(#t-contact\)" fill="none" stroke="#5c4a3e" stroke-opacity="([\d.]+)" stroke-width="([\d.]+)"[^>]*>(.*?)<\/g>/g)];
      return gs.length ? { opacity: Number(gs[0][1]), width: Number(gs[0][2]), edges: gs.flatMap((g) => pathOf(g[3])) } : null;
    };
    const soft = shadowOf(draw({ shape: square, outline: "soft" }))!;
    const art = collarArt("female-peter-pan-collar-front")!;
    for (const neckline of [undefined, "round", "scoop", "boat"]) {
      const pp = (neckline ? art.cut?.({ neckline })?.collar : undefined) ?? art.regions.collar!;
      const markup = draw(pp);
      const s = shadowOf(markup)!;
      expect(s.opacity, neckline).toBeGreaterThan(soft.opacity);
      expect(s.opacity, neckline).toBeLessThanOrEqual(0.55);
      expect(s.width, neckline).toBeGreaterThan(soft.width);
      // still a soft outline: no rim, no dark edge
      expect(markup, neckline).not.toContain(`stroke="currentColor"`);
      expect(markup, neckline).not.toContain(`stroke="#241e19"`);
      // two open free edges, one a half, neither closed back along the neckline
      const halves = pathOf(renderToStaticMarkup(<>{pp.shape("#fff")}</>));
      expect(s.edges, neckline).toHaveLength(2);
      for (const [i, d] of s.edges.entries()) {
        expect(d, neckline).not.toMatch(/Z\s*$/);
        expect(points(d).length, neckline).toBeLessThan(points(halves[i]).length);
      }
      // each free edge ends at centre front, and starts out on the shoulder, not at the neck
      for (const d of s.edges) {
        const p = points(d);
        expect(Math.abs(p.at(-1)![0] - 297.6), neckline).toBeLessThan(2);
        expect(Math.abs(p[0][0] - 297.6), neckline).toBeGreaterThan(40);
      }
    }
  });
});

describe("her mandarin", () => {
  const band = collarArt("female-mandarin-collar-front")!.regions.collar!;
  const pts = points(pathOf(renderToStaticMarkup(<>{band.shape("#fff")}</>))[0]);
  const near = pts.filter(([x]) => Math.abs(x - 297.05) < 6);
  /* the top edge at centre front, and the lower edge: the band's full height there */
  const top = Math.min(...near.map(([, y]) => y));
  const foot = Math.max(...near.map(([, y]) => y));
  /* its points below the rounded top corners, above the lower edge: the V between its two ends */
  const v = near.filter(([, y]) => y > top + 3 && y < foot - 0.5);

  it("meets at centre front over a V no more than 0.6 cm across, not a notch cut out of it", () => {
    expect(v.length).toBeGreaterThan(2);
    const widest = Math.max(...v.map(([x]) => Math.abs(x - 297.05))) * 2 * CM;
    expect(widest).toBeLessThanOrEqual(0.6);
  });

  it("closes the V on the band's lower edge, so its two ends meet the whole way down", () => {
    expect(foot - top).toBeGreaterThan(20);
    expect(Math.max(...v.map(([, y]) => y))).toBeGreaterThan(foot - 6);
  });
});

describe("the bow on a keyhole", () => {
  const keyhole = bodiceFor("keyhole").cut;
  /* the opening below the neck: the cut's own opening, as far down as it drops */
  const drop = points(keyhole.parts!.opening).filter(([, y]) => y > 186);
  const dropPath = `M${drop.map(([x, y]) => `${x} ${y}`).join(" L")} Z`;
  const b = bow("keyhole");
  const knotFoot = Math.max(...points(b.knot).map(([, y]) => y));
  const bandFootAtCentre = Math.max(...points(b.band).filter(([x]) => Math.abs(x - 297) < 2).map(([, y]) => y));

  it("sits its knot on the band, above the opening", () => {
    expect(knotFoot).toBeLessThanOrEqual(bandFootAtCentre + 0.5);
  });

  it("leaves the opening below the knot uncovered, its tails falling either side of it", () => {
    const pieces = [...b.tails, ...b.loops, b.knot];
    let inside = 0;
    for (let y = Math.ceil(knotFoot) + 1; y < 219; y += 1) {
      for (let x = 280; x <= 314; x += 1) {
        if (!covers(dropPath, x, y)) continue;
        inside++;
        for (const p of pieces) expect(covers(p, x, y), `(${x}, ${y})`).toBe(false);
      }
    }
    expect(inside).toBeGreaterThan(300);
    // each tail at least two units clear of the opening's edge
    for (const tail of b.tails) {
      for (const [tx, ty] of points(tail).filter(([, y]) => y > 186 && y < 222)) {
        const clear = Math.min(...drop.map(([x, y]) => Math.hypot(x - tx, y - ty)));
        expect(clear, `${tx}, ${ty}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("is tied at the throat, as it was, on every other cut", () => {
    expect(bow("high")).toEqual(bow());
    expect(bow().lift).toBe(0);
  });
});

describe("the keyhole's edge and closure", () => {
  it("draws its opening's edge as a soft fold, not a ring of topstitch", () => {
    const cut = bodiceFor("keyhole").cut;
    expect(cut.faced).toBeTruthy();
    expect(Math.max(...points(cut.faced!).map(([, y]) => y))).toBeGreaterThan(210);
    // the topstitch runs along the neck edge only: none of it goes down round the opening
    expect(Math.max(...points(cut.stitch).map(([, y]) => y))).toBeLessThan(195);
  });

  it("gives its own button and loop up to a collar sewn over them", () => {
    const open = bodiceFor("keyhole");
    const collared = bodiceFor("keyhole", undefined, "natural", "none", true);
    expect(open.cut.buttons).toBeDefined();
    expect(collared.cut.buttons).toBeUndefined();
    expect(collared.cut.loopRim).toBeUndefined();
    expect(collared.pieces.length).toBe(open.pieces.length - 1);
    expect(frontButtons({ neckline: "keyhole" }).groups).toHaveLength(1);
    expect(frontButtons({ neckline: "keyhole", opening: "high" }).groups).toHaveLength(0);
    // every other cut keeps every piece it has with a collar on
    for (const id of NECKLINE_IDS.filter((c) => c !== "keyhole")) {
      expect(bodiceFor(id, undefined, "natural", "none", true).pieces, id).toEqual(bodiceFor(id).pieces);
    }
  });
});

/* ------------------------------------------------------- round 13, before its commit */

describe("under a collar, no topstitch along the neck", () => {
  /* every cut a collar is sewn to: those presenting an opening */
  const collarCuts = NECKLINE_IDS.filter((id) => NECKLINE_OPENING[id]);
  const dress = garmentArt("female-dress-front")!;

  it("leaves the neck edge's stitch off the dress, and every other row of it on", () => {
    expect(collarCuts.length).toBeGreaterThan(5);
    let stitched = 0;
    for (const id of collarCuts) {
      const open = bodiceFor(id);
      const on = bodiceFor(id, undefined, "natural", "none", true);
      const neck = open.cut.neckStitch ?? open.cut.stitch;
      if (!neck) continue;
      stitched++;
      expect(on.stitch, id).not.toContain(neck);
      // the sleeves' hems and the rest are still stitched: only the neck edge's run is gone
      expect(open.stitch.replace(neck, "").trim(), id).toBe(on.stitch);
      // and the drawing the stage asks for, with a collar worn, draws it so
      const top = dress.cut!({ neckline: id, opening: NECKLINE_OPENING[id] ?? undefined }).top!;
      expect(top.stitch, id).not.toContain(neck);
    }
    expect(stitched).toBeGreaterThan(5);
  });

  it("keeps a shirt-dress's rows down its placket, and every cut stitched round its neck with no collar on", () => {
    const shirt = bodiceFor("collared", undefined, "natural", "none", true);
    const placketRows = bodiceFor("collared").cut.stitch.replace(bodiceFor("collared").cut.neckStitch!, "").trim();
    expect(placketRows.length).toBeGreaterThan(20);
    expect(shirt.stitch).toContain(placketRows);
    for (const id of collarCuts) {
      const neck = bodiceFor(id).cut.neckStitch ?? bodiceFor(id).cut.stitch;
      if (neck) expect(dress.cut!({ neckline: id }).top!.stitch, id).toContain(neck);
    }
  });

  it("takes a crew neck's band and its stitch off a top with a collar sewn to its opening", () => {
    for (const asset of ["female-t-shirt-front", "male-t-shirt-front"]) {
      const art = garmentArt(asset)!;
      const bare = art.cut!({}).body!;
      const collared = art.cut!({ opening: "round" }).body!;
      expect(collared.stitch!.length, asset).toBeLessThan(bare.stitch!.length);
      expect(bare.stitch!.endsWith(collared.stitch!), asset).toBe(true);
      const shade = (r: RegionArt) => renderToStaticMarkup(<>{r.shading?.(uid)}</>);
      expect(shade(bare), asset).toContain(`fill="#c9c9c9"`);
      expect(shade(collared), asset).not.toContain(`fill="#c9c9c9"`);
    }
  });
});

describe("every button strip, lit as a collar is", () => {
  const PLACKETED = ["female-blouse-front", "male-shirt-front", "male-polo-front", "male-thobe-front"];

  it("draws no line round a shirt's placket, nor any shading darker than the shirt", () => {
    for (const asset of PLACKETED) {
      const art = garmentArt(asset)!;
      const plackets = [art.regions.placket, ...Object.values(art.variants ?? {}).map((v) => v.placket)];
      for (const p of plackets) {
        expect(p, asset).toBeDefined();
        expect(p!.outline, asset).toBe("soft");
        expect(p!.cast, asset).toBeUndefined();
        expect(p!.surface, asset).toBeUndefined();
        const shading = renderToStaticMarkup(<>{p!.shading?.(uid)}</>);
        expect(shading, asset).toContain(`fill="${FLAT_LIT}"`);
        expect(shading, asset).not.toMatch(/url\(#/);
        // and a little light along its folded edges
        expect(renderToStaticMarkup(<>{p!.light?.(uid)}</>), asset).toContain(`stroke="#ffffff"`);
      }
    }
  });

  it("draws the dress's plackets — buttoned on, a shirt-dress's own, and on down the skirt — the same way", () => {
    const dress = garmentArt("female-dress-front")!;
    const pieceCount = (r: RegionArt) => (renderToStaticMarkup(<>{r.shape("#fff")}</>).match(/<path/g) ?? []).length;
    const waist = dress.cut!({ neckline: "round", buttons: "waist" }).top!;
    expect(waist.softPieces).toEqual([1]);
    expect(pieceCount(waist)).toBeGreaterThan(1);
    const shirt = dress.cut!({ neckline: "collared" }).top!;
    expect(shirt.softPieces).toEqual([bodiceFor("collared").pieces.indexOf(bodiceFor("collared").cut.placket!)]);
    expect(shirt.softPieces![0]).toBeGreaterThan(0);
    const hem = dress.cut!({ neckline: "round", buttons: "hem" }).bottom!;
    expect(hem.softPieces).toEqual([1]);
    // nothing else on the dress is drawn so
    expect(dress.cut!({ neckline: "round" }).top!.softPieces).toBeUndefined();
    expect(dress.regions.bottom!.softPieces).toBeUndefined();
  });
});

describe("a region with one soft piece", () => {
  const draw = (drawing: RegionDrawing, stitch: "tonal" | "cream" = "tonal", fabricId = "fb-apricot-linen") =>
    renderToStaticMarkup(
      <svg>
        <FabricRegion
          uidBase="t"
          drawing={drawing}
          fabric={fabrics.find((f) => f.id === fabricId)!}
          cmPerUnit={CM}
          pxPerUnit={1}
          direction={0}
          pivot={[300, 500]}
          canvas={[600, 1000]}
          stitch={stitch}
          beneath={beneathMasks((n) => `m-${n}`)}
        />
      </svg>
    );
  const two = (fill: string) => (
    <>
      <path d="M100 100 L200 100 L200 200 L100 200 Z" fill={fill} />
      <path d="M140 100 L160 100 L160 200 L140 200 Z" fill={fill} />
    </>
  );

  it("outlines the other pieces as before, and that one not at all", () => {
    const count = (markup: string, s: string) => markup.split(s).length - 1;
    const plain = draw({ shape: two, surface: { blur: 8, relief: 3 } });
    const soft = draw({ shape: two, surface: { blur: 8, relief: 3 }, softPieces: [1] });
    expect(count(plain, `stroke="currentColor"`)).toBe(2);
    expect(count(soft, `stroke="currentColor"`)).toBe(1);
    expect(count(plain, `stroke="#241e19"`)).toBe(2);
    expect(count(soft, `stroke="#241e19"`)).toBe(1);
    // its lighter shadow, and lit flat rather than given a form of its own
    expect(count(soft, `stroke-opacity="0.3"`)).toBe(1);
    expect(count(plain, `filter="url(#t-surface)"`)).toBe(2);
    expect(count(soft, `filter="url(#t-surface)"`)).toBe(1);
    expect(soft).toContain(`fill="${FLAT_LIT}"`);
  });
});

describe("topstitch in tonal thread", () => {
  /* at 5× unless said: a close-up, where a thread shows — see `TONAL_THREAD.seen` */
  const draw = (stitch: "tonal" | "cream", fabricId: string, zoom = 5) =>
    renderToStaticMarkup(
      <svg>
        <FabricRegion
          uidBase="t"
          drawing={{ shape: (fill) => <path d="M100 100 L200 100 L200 200 L100 200 Z" fill={fill} />, stitch: "M110 110 L190 110" }}
          fabric={fabrics.find((f) => f.id === fabricId)!}
          cmPerUnit={CM}
          pxPerUnit={1}
          zoom={zoom}
          direction={0}
          pivot={[300, 500]}
          canvas={[600, 1000]}
          stitch={stitch}
        />
      </svg>
    );
  const threadOf = (markup: string) => /<g mask="url\(#t-mask\)"( style="mix-blend-mode:multiply")?><path d="M110 110 L190 110"[^>]*>/.exec(markup);

  it("is the cloth's own colour a little darker, never the print's accent", () => {
    for (const f of fabrics) {
      const t = threadOf(draw("tonal", f.id));
      expect(t, f.id).not.toBeNull();
      // multiplied over the cloth, so on a print it is each motif's own colour
      expect(t![1], f.id).toBeTruthy();
      expect(t![0], f.id).toContain(`stroke="#000000"`);
      if (f.palette?.accent) expect(t![0], f.id).not.toContain(f.palette.accent);
      const opacity = Number(/stroke-opacity="([\d.]+)"/.exec(t![0])![1]);
      const width = Number(/stroke-width="([\d.]+)"/.exec(t![0])![1]);
      expect(opacity, f.id).toBeLessThanOrEqual(0.25);
      expect(width, f.id).toBeLessThan(0.9);
    }
  });

  it("is seen only close up: none at whole-figure size or 2×, fading in to full strength by 4×", () => {
    const opacityAt = (zoom: number) => {
      const t = threadOf(draw("tonal", "fb-apricot-linen", zoom));
      return t ? Number(/stroke-opacity="([\d.]+)"/.exec(t[0])![1]) : 0;
    };
    // the whole figure, and up to 2.5×: not drawn at all
    for (const zoom of [1, 1.5, 2, 2.5]) {
      expect(threadOf(draw("tonal", "fb-apricot-linen", zoom)), `${zoom}`).toBeNull();
    }
    // a close-up: there at full strength, and never more
    for (const zoom of [4, 5, 8]) expect(opacityAt(zoom), `${zoom}`).toBeCloseTo(0.22, 3);
    // and between, growing with the close-up
    const between = [2.75, 3, 3.25, 3.5].map(opacityAt);
    expect(between[0]).toBeGreaterThan(0);
    for (let i = 1; i < between.length; i++) expect(between[i]).toBeGreaterThan(between[i - 1]);
    expect(between.at(-1)!).toBeLessThan(0.22);
  });

  it("leaves a thread picked to show in its own colour, at any size", () => {
    expect(threadOf(draw("cream", "fb-midnight-floral", 1))).not.toBeNull();
    const t = threadOf(draw("cream", "fb-midnight-floral"));
    expect(t![1]).toBeUndefined();
    expect(t![0]).toContain(`stroke="#FBF7F0"`);
  });
});

describe("topstitch on the figure", () => {
  /* her t-shirt and trousers, in one plain cloth: every hem, sleeve hem and the neckline topstitched */
  const at = (zoom: number) => {
    const cloth = fabrics.find((f) => f.id === "fb-apricot-linen")!;
    let worn: Outfit["worn"] = [];
    const by: Record<string, Record<string, typeof cloth>> = {};
    for (const id of ["female-t-shirt", "female-trousers"]) {
      const g = garmentById(id)!;
      worn = wear(worn, cutFrom(g, cloth.id));
      by[id] = Object.fromEntries(g.fabricRegions.map((r) => [r, cloth]));
    }
    const outfit: Outfit = { bodyType: "female", skinTone: DEFAULT_SKIN_TONE, direction: 0, worn };
    const markup = renderToStaticMarkup(<MannequinStage outfit={outfit} fabrics={by} zoom={zoom} focus={[300, 400]} />);
    return (markup.match(/stroke-dasharray="2.6 2.2"/g) ?? []).length;
  };

  it("is drawn by the stage only in a close-up, the zoom passed down to every region", () => {
    expect(at(1)).toBe(0);
    expect(at(2)).toBe(0);
    // the t-shirt body, its sleeves and the trousers, each its own region
    expect(at(5)).toBeGreaterThanOrEqual(3);
  });
});
