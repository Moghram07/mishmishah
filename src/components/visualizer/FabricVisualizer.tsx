"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RotateCcw,
  Compass,
  X,
  Sparkles,
  Check,
  Download,
  Ruler,
  Scissors,
  Loader2,
  ZoomIn,
  Move,
  Shirt,
  Sofa,
} from "lucide-react";
import { useVisualizer } from "@/components/providers/VisualizerProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { productTemplates } from "@/lib/data/products";
import { garmentById, garmentsFor, defaultGarment } from "@/lib/data/garments";
import { collarsForGarment } from "@/lib/data/collars";
import { necklinesForGarment } from "@/lib/data/necklines";
import { skirtLengthsFor, skirtShapesFor, waistsFor } from "@/lib/data/skirts";
import { frontsFor } from "@/lib/data/fronts";
import {
  sleeveCuffById,
  sleeveCuffsFor,
  sleeveLengthById,
  firstLength,
  sleeveLengthsFor,
  sleeveTypeById,
  sleeveTypesFor,
} from "@/lib/data/sleeves";
import { fabrics, fabricById } from "@/lib/data/fabrics";
import { DEFAULT_SKIN_TONE, skinToneById, skinTones } from "@/lib/data/skinTones";
import { stitchColors } from "@/lib/data/stitches";
import { regionLabel } from "@/lib/data/fabricRegions";
import { BODY_CANVAS, bodyTypes } from "@/lib/mannequin/bodies";
import { productByKind } from "@/lib/products/registry";
import { frameFor, panBy, type Viewport } from "@/lib/mannequin/frame";
import { PRODUCT_CANVAS } from "@/lib/products/registry";
import { needsZoom } from "@/lib/fabrics/printScale";
import { focusOf } from "@/lib/garments/closeUp";
import {
  collarOf,
  collarsFitting,
  cutFrom,
  frontOf,
  isWearing,
  necklineOf,
  regionsOf,
  setCollar,
  setFront,
  setNeckline,
  setSkirt,
  setSleeve,
  skirtOf,
  sleeveOf,
  stack,
  switchBody,
  everyWardrobe,
  takeOff,
  visibleStack,
  wear,
  wornOn,
} from "@/lib/garments/outfit";
import { fabricBackground, fabricRepeatCm } from "@/lib/fabrics/artwork";
import { exportShareCard, type ShareEntry } from "@/lib/share/shareCard";
import { ProductTemplate, productPanBy } from "./ProductTemplate";
import { MannequinStage } from "./MannequinStage";
import { Silhouette, boxAround } from "./Silhouette";
import { garmentArt } from "@/lib/garments/art";
import { cutAs } from "@/lib/garments/skirts";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import { FEATURES } from "@/lib/features";
import type {
  BodyType,
  Design,
  Fabric,
  FabricRegionId,
  FrontId,
  GarmentPartId,
  Outfit,
  ProductKind,
  SkirtChoice,
  SleeveChoice,
  StitchId,
} from "@/types";

/**
 * Room the whole figure keeps from the stage's edges, in pixels. Underneath it
 * there is also the height of the controls laid over the bottom of the stage.
 */
const STAGE_ROOM = 24;

/** Grain angles worth one click: straight, true bias, cross grain. */
const GRAIN_PRESETS = [0, 45, 90];

const GRAIN_LABELS: Record<
  number,
  "viz.grainStraight" | "viz.grainBias" | "viz.grainCross"
> = {
  0: "viz.grainStraight",
  45: "viz.grainBias",
  90: "viz.grainCross",
};

/** The two things the visualizer can dress: a body, or a room. */
type Subject = "wardrobe" | "home";

/** Which region of which garment the fabric picker is currently cutting. */
interface Cutting {
  garmentId: string;
  region: FabricRegionId;
}

const newOutfit = (fabric: Fabric, body: BodyType = "female"): Outfit => ({
  bodyType: body,
  skinTone: DEFAULT_SKIN_TONE,
  worn: [cutFrom(defaultGarment(body), fabric.id)],
  direction: 0,
});

const startCutting = (body: BodyType): Cutting => ({
  garmentId: defaultGarment(body).id,
  region: defaultGarment(body).fabricRegions[0],
});

const newDesign = (productId: ProductKind, fabric: Fabric): Design => ({
  productId,
  parts: Object.fromEntries(
    productByKind(productId).parts.map((p) => [p.id, fabric.id])
  ),
  stitch: {},
  direction: 0,
});

export function FabricVisualizer() {
  const { isOpen, fabric, close, setFabric } = useVisualizer();
  const { t, pick, locale, dir } = useI18n();
  const { theme } = useTheme();

  const [subject, setSubject] = useState<Subject>("wardrobe");
  const [outfit, setOutfit] = useState<Outfit>(() => newOutfit(fabric));
  const [design, setDesign] = useState<Design>(() => newDesign("sofa", fabric));
  const [cutting, setCutting] = useState<Cutting>(() =>
    startCutting("female")
  );
  const [activePart, setActivePart] = useState<GarmentPartId>("main");
  /** What was being cut on each body when it left the stage. */
  const lastCut = useRef<Partial<Record<BodyType, Cutting>>>({});
  /** Close-up magnification — how fine weaves become visible. */
  const [zoom, setZoom] = useState(1);
  /**
   * How far the viewer has dragged the close-up, in canvas units.
   *
   * Zoom on its own only ever showed whatever the app had decided to point at,
   * so there was no way to go and look at something else. Dragging is the whole
   * of the answer: aim it automatically, then let it be moved.
   */
  const [pan, setPan] = useState<[number, number]>([0, 0]);
  const drag = useRef<{ x: number; y: number } | null>(null);

  /*
    The stage, and the controls laid over the bottom of it, measured. The
    mannequin is drawn into the whole stage rather than a box its own shape, so
    a close-up runs to the stage's edges instead of being cut off square in the
    middle of it — see `mannequin/frame.ts`. Zoomed out, the figure stands in
    what is left above the controls.
  */
  const [stageEl, setStageEl] = useState<HTMLDivElement | null>(null);
  const [dockEl, setDockEl] = useState<HTMLDivElement | null>(null);
  const stageSize = useElementSize(stageEl);
  const dockSize = useElementSize(dockEl);
  const viewport = useMemo<Viewport | null>(
    () =>
      stageSize
        ? {
            width: stageSize.width,
            height: stageSize.height,
            inset: [
              STAGE_ROOM,
              STAGE_ROOM,
              (dockSize?.height ?? 0) + STAGE_ROOM / 3,
              STAGE_ROOM,
            ],
          }
        : null,
    [stageSize, dockSize]
  );
  const [exporting, setExporting] = useState(false);

  const stageRef = useRef<SVGSVGElement>(null);
  const product = productByKind(design.productId);
  // Everything the picker, the stage and the share card work from is filtered
  // to the active body first, so a garment cut for the other one can never
  // reach any of them.
  const worn = useMemo(
    () => stack(wornOn(outfit.worn, outfit.bodyType)),
    [outfit.worn, outfit.bodyType]
  );
  const wardrobe = useMemo(
    () => garmentsFor(outfit.bodyType),
    [outfit.bodyType]
  );

  /**
   * The garment the fabric picker is cutting — only ever one that is actually
   * on the body, so taking a garment off cannot leave the picker editing it.
   */
  const cuttingEntry = worn.find((e) => e.garment.id === cutting.garmentId);
  const cuttingGarment = cuttingEntry?.garment;

  // Auto-replacement can remove the garment being edited — and so can taking
  // off a collar, which removes a region rather than a garment. Follow both.
  useEffect(() => {
    if (worn.length === 0) return;
    const still = worn.find((e) => e.garment.id === cutting.garmentId);
    if (still && regionsOf(still.garment, still.worn).includes(cutting.region)) {
      return;
    }
    const next = still ?? worn[worn.length - 1];
    setCutting({
      garmentId: next.garment.id,
      region: regionsOf(next.garment, next.worn)[0],
    });
  }, [worn, cutting]);

  // Opening from a fabric card dresses everything in that fabric; once inside,
  // picking a fabric only re-cuts the region being edited.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      // Both mannequins, the one put away as well as the one on the stage.
      setOutfit((o) =>
        everyWardrobe(o, (worn) =>
          worn.map((w) => {
            const garment = garmentById(w.garmentId);
            return garment ? cutFrom(garment, fabric.id, w.stitch) : w;
          })
        )
      );
      setDesign((d) => ({ ...d, ...newDesign(d.productId, fabric) }));
    }
    wasOpen.current = isOpen;
  }, [isOpen, fabric]);

  // Close on Escape + lock body scroll while open.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, close]);

  /** Every worn garment's regions, resolved to fabrics. */
  const outfitFabrics = useMemo(() => {
    const out: Record<string, Partial<Record<FabricRegionId, Fabric>>> = {};
    for (const { garment, worn: w } of worn) {
      const regions: Partial<Record<FabricRegionId, Fabric>> = {};
      for (const region of regionsOf(garment, w)) {
        regions[region] = fabricById(w.fabrics[region] ?? "") ?? fabric;
      }
      out[garment.id] = regions;
    }
    return out;
  }, [worn, fabric]);

  const partFabrics = useMemo(() => {
    const out: Partial<Record<GarmentPartId, Fabric>> = {};
    for (const part of product.parts) {
      out[part.id] = fabricById(design.parts[part.id] ?? "") ?? fabric;
    }
    return out;
  }, [product, design.parts, fabric]);

  const activeFabric =
    (subject === "wardrobe"
      ? outfitFabrics[cutting.garmentId]?.[cutting.region]
      : partFabrics[activePart]) ?? fabric;

  const activeStitch =
    subject === "wardrobe"
      ? outfit.worn.find((w) => w.garmentId === cutting.garmentId)?.stitch[
          cutting.region
        ] ?? "tonal"
      : design.stitch[activePart] ?? "tonal";

  /**
   * Change the mannequin.
   *
   * Each body keeps its own wardrobe — see `switchBody`. The one leaving is put
   * away exactly as it is and the one arriving comes back exactly as it was
   * left, down to the part that was being cut. Only a body never shown before
   * is dressed from this one.
   */
  const setBody = (id: BodyType) => {
    if (outfit.bodyType === id) return;
    const next = switchBody(outfit, id, fabric.id);
    setOutfit(next);

    // Point the fabric picker at something on the new body in the same commit,
    // or the region row renders empty until the effect below catches up.
    lastCut.current[outfit.bodyType] = cutting;
    const kept = lastCut.current[id];
    const first = next.worn[0] && garmentById(next.worn[0].garmentId);
    setCutting(
      kept && next.worn.some((w) => w.garmentId === kept.garmentId)
        ? kept
        : first
          ? { garmentId: first.id, region: first.fabricRegions[0] }
          : startCutting(id)
    );
  };

  /**
   * Sew a collar onto the garment being cut, or take it off.
   *
   * Only ever one the garment can actually take: the list comes from
   * `collarsForGarment`, and `collarOf` refuses anything else on the way to the
   * renderer even if it were set some other way.
   */
  const chooseCollar = (collarId: string | undefined) => {
    if (!cuttingGarment) return;
    setOutfit((o) => ({
      ...o,
      worn: setCollar(o.worn, cuttingGarment.id, collarId),
    }));
    // Cutting the collar is what you almost always want next.
    setCutting({
      garmentId: cuttingGarment.id,
      region: collarId ? "collar" : cuttingGarment.fabricRegions[0],
    });
  };

  /**
   * Recut the garment being edited.
   *
   * `setNeckline` takes off a collar the new cut cannot carry, and sews on the
   * one a cut is not itself without — the Collared cut arrives wearing a shirt
   * collar, which then stays swappable like any other.
   */
  const chooseNeckline = (necklineId: string) => {
    if (!cuttingGarment) return;
    setOutfit((o) => ({
      ...o,
      worn: setNeckline(o.worn, cuttingGarment.id, necklineId),
    }));
  };

  /**
   * Recut the garment's sleeves: a new type, a new length, a new cuff.
   *
   * A type keeps the length already worn when it comes in it; otherwise it
   * takes its own first — a bishop has no short length to keep. The cuff is
   * carried along as chosen, so a sleeve taken short and back to long comes
   * back with the cuff it had; `sleeveOf` drops it wherever none is offered.
   */
  const chooseSleeve = (next: Partial<SleeveChoice>) => {
    if (!cuttingGarment || !cuttingEntry) return;
    const current = sleeveOf(cuttingEntry.worn);
    if (!current) return;
    const type = next.type ?? current.type;
    const lengths = sleeveLengthsFor(type, necklineOf(cuttingEntry.worn));
    const length =
      next.length && lengths.includes(next.length)
        ? next.length
        : lengths.includes(current.length)
          ? current.length
          : firstLength(type);
    const cuff = next.cuff ?? cuttingEntry.worn.sleeve?.cuff;
    setOutfit((o) => ({
      ...o,
      worn: setSleeve(o.worn, cuttingGarment.id, { type, length, ...(cuff ? { cuff } : {}) }),
    }));
  };

  /** Recut the skirt of the garment being cut — resolved when read, see `skirtOf`. */
  const chooseSkirt = (next: Partial<SkirtChoice>) => {
    if (!cuttingGarment || !cuttingEntry) return;
    const current = skirtOf(cuttingEntry.worn);
    if (!current) return;
    setOutfit((o) => ({ ...o, worn: setSkirt(o.worn, cuttingGarment.id, { ...current, ...next }) }));
  };

  /** Wear the garment being cut open or closed at the front — resolved when read, see `frontOf`. */
  const chooseFront = (front: FrontId) => {
    if (!cuttingGarment) return;
    setOutfit((o) => ({ ...o, worn: setFront(o.worn, cuttingGarment.id, front) }));
  };

  /** Put a garment on or take it off. Layer and compatibility rules apply. */
  const toggleGarment = (id: string) => {
    const garment = garmentById(id);
    // Never wear something cut for the other mannequin, whatever asked.
    if (!garment || garment.gender !== outfit.bodyType) return;
    const takingOff = isWearing(outfit.worn, id);
    setOutfit((o) => ({
      ...o,
      worn: takingOff
        ? takeOff(o.worn, id)
        : wear(o.worn, cutFrom(garment, fabric.id)),
    }));
    // Putting something on is also choosing what to cut next.
    if (!takingOff) {
      setCutting({ garmentId: id, region: garment.fabricRegions[0] });
    }
  };

  const cutRegion = (f: Fabric) => {
    if (subject === "wardrobe") {
      setOutfit((o) => ({
        ...o,
        worn: o.worn.map((w) =>
          w.garmentId === cutting.garmentId
            ? { ...w, fabrics: { ...w.fabrics, [cutting.region]: f.id } }
            : w
        ),
      }));
    } else {
      setDesign((d) => ({
        ...d,
        parts: { ...d.parts, [activePart]: f.id },
      }));
    }
    setFabric(f);
  };

  const setStitch = (id: StitchId) => {
    if (subject === "wardrobe") {
      setOutfit((o) => ({
        ...o,
        worn: o.worn.map((w) =>
          w.garmentId === cutting.garmentId
            ? { ...w, stitch: { ...w.stitch, [cutting.region]: id } }
            : w
        ),
      }));
    } else {
      setDesign((d) => ({ ...d, stitch: { ...d.stitch, [activePart]: id } }));
    }
  };

  const direction = subject === "wardrobe" ? outfit.direction : design.direction;
  const setDirection = (value: number) => {
    if (subject === "wardrobe") setOutfit((o) => ({ ...o, direction: value }));
    else setDesign((d) => ({ ...d, direction: value }));
  };

  const reset = () => {
    setZoom(1);
    if (subject === "wardrobe") {
      // Re-dress the mannequin that is actually on the stage. Resetting used
      // to reach for the female default whichever body was showing.
      // Only the mannequin on the stage; the one put away keeps its outfit.
      setOutfit((o) => ({
        ...newOutfit(fabric, o.bodyType),
        skinTone: o.skinTone,
        ...(o.away ? { away: o.away } : {}),
      }));
      setCutting(startCutting(outfit.bodyType));
    } else {
      setDesign((d) => newDesign(d.productId, fabric));
    }
  };

  /**
   * What a close-up centres on — the region being edited.
   *
   * See `garments/closeUp.ts`: a collar's focus lives on the collar's own art,
   * not on the garment's, and looking in the wrong place is what made zooming
   * always land on the middle of the body.
   */
  const focus =
    cuttingGarment && cuttingEntry
      ? focusOf(cuttingGarment, cuttingEntry.worn, cutting.region)
      : undefined;

  /*
    Dragging the stage moves the close-up. Only when zoomed in — at 1× the
    frame is already the whole canvas and there is nowhere to go — and the pan
    resets whenever the thing being looked at changes, so picking a collar
    always lands on the collar rather than wherever the last drag left off.
  */
  const pannable = zoom > 1;

  useEffect(() => {
    setPan([0, 0]);
  }, [cutting.region, cutting.garmentId, outfit.bodyType, subject, design.productId, activePart]);

  /*
    The drawing on the stage, measured — how many screen pixels a unit of it
    takes, and so how big a print comes out on it. Measured again whenever
    the stage swaps its drawing, since each subject draws its own.
  */
  const [stagePx, setStagePx] = useState(0);
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setStagePx(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [subject, isOpen]);

  /*
    Whether a print in view is too small to read where it is. It is drawn at
    its true size whatever the zoom, softened when a repeat is only a few
    pixels across (see `printScale.ts`) — so when one is, say so: zooming in
    is how to see it. A plain weave has no print to see.
  */
  const smallPrint = useMemo(() => {
    if (stagePx <= 0) return false;
    const [cmPerUnit, pxPerUnit, inView] =
      subject === "wardrobe"
        ? [
            BODY_CANVAS.cmPerUnit,
            stagePx / frameFor(zoom, focus, pan, viewport).w,
            Object.values(outfitFabrics).flatMap((regions) => Object.values(regions)),
          ]
        : [product.cmPerUnit, stagePx / (PRODUCT_CANVAS[0] / Math.max(1, zoom)), Object.values(partFabrics)];
    return inView.some(
      (f) =>
        f !== undefined &&
        !(f.source === "procedural" && f.motif === "solid") &&
        needsZoom((fabricRepeatCm(f) / cmPerUnit) * pxPerUnit)
    );
  }, [stagePx, subject, zoom, focus, pan, viewport, outfitFabrics, product, partFabrics]);

  const onDragStart = (e: React.PointerEvent) => {
    if (!pannable) return;
    drag.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onDragMove = (e: React.PointerEvent) => {
    const from = drag.current;
    if (!from) return;
    const width = e.currentTarget.getBoundingClientRect().width;
    const [dx, dy] = [e.clientX - from.x, e.clientY - from.y];
    setPan((p) =>
      subject === "wardrobe"
        ? panBy(p, dx, dy, zoom, width, viewport)
        : productPanBy(p, dx, dy, zoom, width, design.productId, activePart)
    );
    drag.current = { x: e.clientX, y: e.clientY };
  };

  const onDragEnd = () => {
    drag.current = null;
  };

  const share = useCallback(async () => {
    if (!stageRef.current) return;
    setExporting(true);
    try {
      const entries: ShareEntry[] =
        subject === "wardrobe"
          ? visibleStack(wornOn(outfit.worn, outfit.bodyType)).flatMap(
              ({ garment, worn: w }) => {
                const regions = regionsOf(garment, w);
                return regions.map((region) => {
                  const f = outfitFabrics[garment.id]?.[region] ?? fabric;
                  return {
                    partLabel:
                      regions.length > 1
                        ? `${pick(garment.name)} · ${pick(regionLabel(region))}`
                        : pick(garment.name),
                    fabric: f,
                    fabricName: pick(f.name),
                  };
                });
              }
            )
          : product.parts.map((part) => {
              const f = partFabrics[part.id] ?? fabric;
              return {
                partLabel:
                  product.parts.length > 1
                    ? pick(part.label)
                    : t("share.fabric"),
                fabric: f,
                fabricName: pick(f.name),
              };
            });

      await exportShareCard({
        svg: stageRef.current,
        /*
          The whole figure, whatever the stage is showing. The stage is wider
          than the figure, and a close-up of it on a card is the body cut off
          square in the middle of the picture — the window the stage no
          longer has. A card is for the outfit; its fabrics are listed under it.
        */
        viewBox: subject === "wardrobe" ? BODY_CANVAS.viewBox : undefined,
        brand: t("brand.name"),
        productName:
          subject === "wardrobe" ? t("viz.wardrobe") : pick(product.label),
        tagline: t("share.tagline"),
        entries,
        locale,
        dark: theme === "dark",
        fileName: `mishmishah-${
          subject === "wardrobe" ? "outfit" : design.productId
        }.png`,
      });
    } finally {
      setExporting(false);
    }
  }, [
    subject,
    outfit.worn,
    outfitFabrics,
    product,
    partFabrics,
    fabric,
    locale,
    theme,
    design.productId,
    t,
    pick,
  ]);

  /*
    A garment cut in two parts — the dress's top and its skirt — shows the
    part being cut and that part's options: the bodice's neckline, sleeves and
    collar, or the skirt's. A garment that is one part shows its own.
  */
  const onBottom = subject === "wardrobe" && cutting.region === "bottom";
  const wornSkirt = cuttingEntry ? skirtOf(cuttingEntry.worn) : undefined;
  const skirtShapeChoices = cuttingGarment ? skirtShapesFor(cuttingGarment) : [];
  /* the lengths the shape being worn is cut at: a mermaid's, midi and maxi */
  const skirtLengthChoices = cuttingGarment ? skirtLengthsFor(cuttingGarment, wornSkirt?.shape) : [];
  const waistChoices = cuttingGarment ? waistsFor(cuttingGarment) : [];
  const showSkirt =
    subject === "wardrobe" &&
    (skirtShapeChoices.length > 1 || skirtLengthChoices.length > 1 || waistChoices.length > 1) &&
    (onBottom || !cuttingGarment?.fabricRegions.includes("bottom"));

  /* how a robe is worn at the front, her abaya's: open or closed */
  const frontChoices = cuttingGarment ? frontsFor(cuttingGarment) : [];
  const wornFront = cuttingEntry ? frontOf(cuttingEntry.worn) : undefined;
  const showFront = subject === "wardrobe" && frontChoices.length > 1 && wornFront !== undefined;

  /*
    On a phone the controls under the stage show a few rows at a time, and the
    skirt's switches sat below them. Picking the skirt's part — the dress's
    Bottom, or the skirt — brings them into view, so its length is never a
    scroll away; where they already show, nothing moves. Picking the abaya
    does the same for its front.
  */
  const skirtOptions = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen || !showSkirt) return;
    skirtOptions.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [isOpen, showSkirt, cutting.garmentId, cutting.region]);
  const frontOptions = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen || !showFront) return;
    frontOptions.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [isOpen, showFront, cutting.garmentId]);

  if (!isOpen) return null;

  /*
    Each shape's icon is the garment as worn — its cut, its sleeve, its waist
    and its length — cut to that shape instead, so an icon is what picking it
    gives; and all are framed alike, so a narrower or a fuller one looks it.
  */
  const shapeIcons = (() => {
    if (!showSkirt || !wornSkirt || !cuttingGarment || !cuttingEntry || skirtShapeChoices.length < 2) return null;
    const art = garmentArt(cuttingGarment.asset.front);
    const w = cuttingEntry.worn;
    /* at the length each would be cut at: a mermaid picked at the knee is a midi */
    const lengths = cuttingGarment.skirt?.lengths ?? [];
    const pieces = skirtShapeChoices.map(
      (shape) =>
        art?.silhouette?.({ neckline: necklineOf(w)?.cut, sleeve: sleeveOf(w), skirt: cutAs({ ...wornSkirt, shape: shape.id }, lengths) }) ?? []
    );
    return { pieces, box: boxAround(pieces) };
  })();

  /**
   * The cuts this garment can be given, and the collars that fit the one it is
   * currently cut to.
   *
   * The second list narrows as the first changes, which is the honest version
   * of what the dress used to do silently: it recut *itself* to a high opening
   * whenever a standing collar was picked. With a neckline you can see, that
   * would make the picker a liar — so a collar that no longer fits comes off,
   * and the chip shows it.
   */
  const necklineChoices = cuttingGarment
    ? necklinesForGarment(cuttingGarment)
    : [];
  const wornNecklineId = cuttingEntry && necklineOf(cuttingEntry.worn)?.id;
  const sleeveChoices =
    cuttingGarment && cuttingEntry
      ? sleeveTypesFor(cuttingGarment, necklineOf(cuttingEntry.worn))
      : [];
  const wornSleeve = cuttingEntry ? sleeveOf(cuttingEntry.worn) : undefined;
  const collarChoices =
    cuttingGarment && cuttingEntry
      ? collarsFitting(cuttingGarment, cuttingEntry.worn)
      : [];
  const wornCollarId = cuttingEntry && collarOf(cuttingEntry.worn)?.id;

  const regions =
    subject === "wardrobe"
      ? (cuttingEntry
          ? regionsOf(cuttingEntry.garment, cuttingEntry.worn)
          : []
        ).map((region) => ({
          key: region as string,
          label: regionLabel(region),
          fabric: outfitFabrics[cutting.garmentId]?.[region],
          active: cutting.region === region,
          onClick: () => setCutting({ garmentId: cutting.garmentId, region }),
        }))
      : product.parts.map((part) => ({
          key: part.id as string,
          label: part.label,
          fabric: partFabrics[part.id],
          active: activePart === part.id,
          onClick: () => setActivePart(part.id),
        }));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("viz.title")}
      dir={dir}
      className="fixed inset-0 z-[100] flex items-stretch justify-center animate-fade-in"
    >
      {/* backdrop */}
      <button
        aria-label={t("viz.close")}
        onClick={close}
        className="absolute inset-0 cursor-default bg-charcoal/60 backdrop-blur-sm"
      />

      {/* sheet */}
      <div className="relative z-10 m-0 flex h-full w-full max-w-6xl flex-col overflow-hidden bg-background shadow-lift animate-scale-in sm:m-4 sm:h-[calc(100%-2rem)] sm:rounded-3xl">
        {/* header */}
        <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-apricot-500/15 text-apricot-600">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h2 className="heading-display text-lg leading-none">
                {t("viz.title")}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("viz.subtitle")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={share}
              disabled={exporting}
              className="btn-focus inline-flex h-10 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-60"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">{t("viz.share")}</span>
            </button>
            <button
              onClick={close}
              aria-label={t("viz.close")}
              className="btn-focus inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          {/*
            stage — a fixed share of a phone's height, so the controls below
            scroll without squeezing the mannequin out of sight
          */}
          <div
            ref={setStageEl}
            className="relative flex h-[58svh] shrink-0 items-center justify-center overflow-hidden bg-gradient-to-b from-muted/40 to-background p-6 sm:p-10 lg:h-auto lg:flex-1 lg:shrink"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-apricot-radial" />

            {subject === "wardrobe" ? (
              <MannequinStage
                ref={stageRef}
                outfit={outfit}
                fabrics={outfitFabrics}
                zoom={zoom}
                focus={focus}
                pan={pan}
                viewport={viewport}
                onPointerDown={onDragStart}
                onPointerMove={onDragMove}
                onPointerUp={onDragEnd}
                onPointerCancel={onDragEnd}
                className={cn(
                  // The whole stage, not a box the figure's shape: see `viewport`.
                  "absolute inset-0 z-10 h-full w-full text-foreground drop-shadow-[0_24px_48px_rgba(27,23,20,0.22)]",
                  // Held back until the stage is measured, so it opens where it stays.
                  !viewport && "invisible",
                  // `touch-none` so a drag on a phone moves the close-up
                  // instead of scrolling the sheet out from under it.
                  pannable && "cursor-grab touch-none active:cursor-grabbing"
                )}
              />
            ) : (
              <ProductTemplate
                ref={stageRef}
                kind={design.productId}
                fabrics={partFabrics}
                direction={design.direction}
                stitch={design.stitch}
                zoom={zoom}
                focusPart={activePart}
                pan={pan}
                onPointerDown={onDragStart}
                onPointerMove={onDragMove}
                onPointerUp={onDragEnd}
                onPointerCancel={onDragEnd}
                className={cn(
                  "relative z-10 h-full max-h-[440px] w-full max-w-[440px] text-foreground drop-shadow-[0_24px_48px_rgba(27,23,20,0.22)]",
                  pannable && "cursor-grab touch-none active:cursor-grabbing"
                )}
              />
            )}

            {/*
              Under the figure: who is wearing it, then the close-up. Laid over
              the stage, and measured, so a zoomed-out figure stands clear of it
              and a close-up runs on underneath.
            */}
            <div
              ref={setDockEl}
              className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 px-2 pb-3 sm:px-4 sm:pb-4"
            >
              {subject === "wardrobe" && (
                <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-2xl border border-border/60 bg-card/85 px-3 py-2 shadow-soft backdrop-blur sm:gap-x-5 sm:px-4 sm:py-2.5">
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("viz.body")}
                    </span>
                    <div
                      role="group"
                      aria-label={t("viz.body")}
                      className="grid grid-cols-2 gap-1 rounded-full bg-muted/70 p-1"
                    >
                      {bodyTypes.map((b) => (
                        <button
                          key={b.id}
                          onClick={() => setBody(b.id)}
                          aria-pressed={outfit.bodyType === b.id}
                          className={cn(
                            "btn-focus rounded-full px-3 py-1 text-sm font-semibold transition-all sm:px-3.5",
                            outfit.bodyType === b.id
                              ? "bg-card text-foreground shadow-soft"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {pick(b.label)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <span
                    aria-hidden="true"
                    className="hidden h-10 w-px bg-border sm:block"
                  />

                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("viz.skinTone")}
                      <span className="ms-1.5 font-medium normal-case tracking-normal text-foreground/80">
                        {pick(skinToneById(outfit.skinTone).label)}
                      </span>
                    </span>
                    <div
                      role="group"
                      aria-label={t("viz.skinTone")}
                      className="flex items-center gap-1.5 py-1 sm:gap-2"
                    >
                      {skinTones.map((s) => (
                        <SkinSwatch
                          key={s.id}
                          label={pick(s.label)}
                          color={s.color}
                          active={outfit.skinTone === s.id}
                          onClick={() =>
                            setOutfit((o) => ({ ...o, skinTone: s.id }))
                          }
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/*
                close-up — the only way a 1 cm herringbone is ever visible.

                The slider has a row to itself and nothing in the dock changes
                size with the zoom. It used to share a centred row with the
                note below, whose text changes at 1× — so the row re-centred,
                the slider slid 85px under a pointer dragging it, the pointer
                now meant another value, the note changed back, and the zoom
                flicked between 1× and a close-up on every move. The arrow keys
                never read the pointer, which is why they worked. The dock's
                height also frames the figure (`viewport`), so it must not
                change with the zoom either.
              */}
              <div className="pointer-events-auto flex shrink-0 items-center gap-2 rounded-full bg-card/85 px-3 py-1.5 shadow-soft backdrop-blur">
                <ZoomIn className="h-3.5 w-3.5 shrink-0 text-apricot-500" />
                <input
                  type="range"
                  min={1}
                  max={8}
                  step={0.5}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  aria-label={t("viz.zoom")}
                  className="h-1.5 w-28 cursor-pointer appearance-none rounded-full bg-muted accent-apricot-500"
                />
                <span className="w-8 shrink-0 text-xs tabular-nums text-muted-foreground">
                  {zoom}×
                </span>
              </div>
              {/*
                Zoomed in, the useful thing to say is that the picture can be
                moved — the close-up is aimed at whatever is being edited, and
                until you know you can drag it there is no way to go and look
                at anything else. One line whatever it says, so saying
                something else moves nothing. A print too small to read where
                it is says so first: it is drawn at its true size, softened,
                and zooming in is the way to see it.
              */}
              <span className="pointer-events-auto inline-flex h-7 max-w-full items-center gap-1.5 whitespace-nowrap rounded-full bg-card/80 px-3 text-xs font-medium text-muted-foreground shadow-soft backdrop-blur">
                {smallPrint ? (
                  <>
                    <ZoomIn className="h-3.5 w-3.5 shrink-0 text-apricot-500" />
                    <span className="truncate">{t("viz.zoomToSee")}</span>
                  </>
                ) : pannable ? (
                  <>
                    <Move className="h-3.5 w-3.5 shrink-0 text-apricot-500" />
                    <span className="truncate">{t("viz.drag")}</span>
                  </>
                ) : (
                  <>
                    <Ruler className="h-3.5 w-3.5 shrink-0 text-apricot-500" />
                    <span className="truncate sm:hidden">
                      {t("viz.trueScaleShort")}
                    </span>
                    <span className="hidden truncate sm:inline">
                      {t("viz.trueScale")}
                    </span>
                  </>
                )}
              </span>
            </div>
          </div>

          {/* controls */}
          <aside className="flex min-h-0 w-full flex-1 flex-col gap-6 overflow-y-auto border-t border-border bg-card/40 p-5 sm:p-7 lg:w-[380px] lg:flex-none lg:border-s lg:border-t-0">
            {/* selected fabric */}
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <span
                className="h-14 w-14 shrink-0 rounded-xl border border-border"
                style={fabricBackground(activeFabric, {
                  viewCm: 8,
                  elementPx: 56,
                  fitRepeat: true,
                })}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {pick(activeFabric.name)}
                  </p>
                  <span
                    title={t("viz.applied")}
                    aria-label={t("viz.applied")}
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-apricot-500/12 text-apricot-700 dark:text-apricot-300"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {t("card.sample")}
                </p>
              </div>
            </div>

            {/* what we are dressing: clothes, or a home product while those are switched on */}
            {FEATURES.home && (
              <div className="grid grid-cols-2 gap-2 rounded-full bg-muted/60 p-1">
                {(
                  [
                    ["wardrobe", t("viz.wardrobe"), <Shirt key="s" className="h-4 w-4" />],
                    ["home", t("viz.home"), <Sofa key="h" className="h-4 w-4" />],
                  ] as const
                ).map(([key, label, icon]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setSubject(key);
                      setZoom(1);
                    }}
                    aria-pressed={subject === key}
                    className={cn(
                      "btn-focus inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold transition-all",
                      subject === key
                        ? "bg-card text-foreground shadow-soft"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>
            )}

            {subject === "wardrobe" ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("viz.wear")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {wardrobe.map((g) => {
                    const on = isWearing(outfit.worn, g.id);
                    return (
                      <button
                        key={g.id}
                        onClick={() => toggleGarment(g.id)}
                        aria-pressed={on}
                        className={cn(
                          "btn-focus rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all",
                          on
                            ? "border-apricot-500 bg-apricot-500 text-white shadow-soft"
                            : "border-border bg-card text-foreground hover:border-apricot-400"
                        )}
                      >
                        {pick(g.name)}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {t("viz.layersHint")}
                </p>
              </div>
            ) : (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("viz.chooseProduct")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {productTemplates.map((p) => (
                    <button
                      key={p.kind}
                      onClick={() => {
                        setDesign((d) => ({
                          ...newDesign(p.kind, fabric),
                          direction: d.direction,
                          stitch: d.stitch,
                        }));
                        setActivePart(productByKind(p.kind).parts[0].id);
                      }}
                      className={cn(
                        "btn-focus rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all",
                        design.productId === p.kind
                          ? "border-apricot-500 bg-apricot-500 text-white shadow-soft"
                          : "border-border bg-card text-foreground hover:border-apricot-400"
                      )}
                    >
                      {pick(p.label)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* which garment is being cut */}
            {subject === "wardrobe" && worn.length > 1 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("viz.editing")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {worn.map(({ garment }) => (
                    <button
                      key={garment.id}
                      onClick={() =>
                        setCutting({
                          garmentId: garment.id,
                          region: garment.fabricRegions[0],
                        })
                      }
                      className={cn(
                        "btn-focus rounded-full border px-3 py-1 text-xs font-medium transition-all",
                        cutting.garmentId === garment.id
                          ? "border-apricot-500 bg-apricot-500/10 text-foreground"
                          : "border-border bg-card text-muted-foreground hover:border-apricot-400"
                      )}
                    >
                      {pick(garment.name)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* per-region fabric — the heart of a multi-part piece, and which part's options show */}
            {regions.length > 1 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("viz.parts")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {regions.map((region) => (
                    <button
                      key={region.key}
                      onClick={region.onClick}
                      className={cn(
                        "btn-focus flex items-center gap-2 rounded-full border py-1.5 pe-3.5 ps-1.5 text-sm font-medium transition-all",
                        region.active
                          ? "border-apricot-500 bg-apricot-500/10 text-foreground"
                          : "border-border bg-card text-muted-foreground hover:border-apricot-400"
                      )}
                    >
                      <span
                        className="h-6 w-6 rounded-full border border-border"
                        style={
                          region.fabric
                            ? fabricBackground(region.fabric, {
                                viewCm: 4,
                                elementPx: 24,
                                fitRepeat: true,
                              })
                            : undefined
                        }
                      />
                      {pick(region.label)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* how it is worn at the front, an abaya's: open or closed, one row */}
            {showFront && wornFront && (
              <div ref={frontOptions} className="scroll-my-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("viz.front")}
                </p>
                <div
                  role="group"
                  aria-label={t("viz.front")}
                  className="grid gap-1 rounded-full bg-muted/60 p-1"
                  style={{ gridTemplateColumns: `repeat(${frontChoices.length}, minmax(0, 1fr))` }}
                >
                  {frontChoices.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => chooseFront(f.id)}
                      aria-pressed={wornFront === f.id}
                      className={cn(
                        "btn-focus rounded-full px-3 py-2 text-sm font-semibold transition-all",
                        wornFront === f.id
                          ? "bg-card text-foreground shadow-soft"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {pick(f.name)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* the skirt's switches, together */}
            {showSkirt && wornSkirt && (
              <div ref={skirtOptions} className="flex scroll-my-4 flex-col gap-6">
                {/* the skirt's length: three choices, one row */}
                {skirtLengthChoices.length > 1 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("viz.length")}
                    </p>
                    <div
                      role="group"
                      aria-label={t("viz.length")}
                      className="grid gap-1 rounded-full bg-muted/60 p-1"
                      style={{ gridTemplateColumns: `repeat(${skirtLengthChoices.length}, minmax(0, 1fr))` }}
                    >
                      {skirtLengthChoices.map((l) => (
                        <button
                          key={l.id}
                          onClick={() => chooseSkirt({ length: l.id })}
                          aria-pressed={wornSkirt.length === l.id}
                          className={cn(
                            "btn-focus rounded-full px-3 py-2 text-sm font-semibold transition-all",
                            wornSkirt.length === l.id
                              ? "bg-card text-foreground shadow-soft"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {pick(l.name)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* the skirt's shape: a row of the garment cut to each */}
                {shapeIcons && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("viz.shape")}
                    </p>
                    <div role="group" aria-label={t("viz.shape")} className="flex gap-2 overflow-x-auto pb-1">
                      {skirtShapeChoices.map((shape, i) => {
                        const on = wornSkirt.shape === shape.id;
                        return (
                          <button
                            key={shape.id}
                            onClick={() => chooseSkirt({ shape: shape.id })}
                            aria-pressed={on}
                            className={cn(
                              "btn-focus flex w-20 shrink-0 flex-col items-center gap-1.5 rounded-2xl border px-2 pb-2 pt-2.5 text-xs font-semibold transition-all",
                              on
                                ? "border-apricot-500 bg-apricot-500/10 text-foreground"
                                : "border-border bg-card text-muted-foreground hover:border-apricot-400"
                            )}
                          >
                            <Silhouette
                              pieces={shapeIcons.pieces[i]}
                              box={shapeIcons.box}
                              className={cn("h-16 w-full", on && "text-apricot-500")}
                            />
                            {pick(shape.name)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* the waist its skirt hangs from, a dress's: one row */}
                {waistChoices.length > 1 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("viz.waist")}
                    </p>
                    <div
                      role="group"
                      aria-label={t("viz.waist")}
                      className="grid gap-1 rounded-full bg-muted/60 p-1"
                      style={{ gridTemplateColumns: `repeat(${waistChoices.length}, minmax(0, 1fr))` }}
                    >
                      {waistChoices.map((w) => (
                        <button
                          key={w.id}
                          onClick={() => chooseSkirt({ waist: w.id })}
                          aria-pressed={wornSkirt.waist === w.id}
                          className={cn(
                            "btn-focus rounded-full px-3 py-2 text-sm font-semibold transition-all",
                            wornSkirt.waist === w.id
                              ? "bg-card text-foreground shadow-soft"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {pick(w.name)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/*
              The collar, as a part rather than a style. It is offered only
              where a garment has a neckline to sew one to, and only the ones
              cut to fit that neckline are listed.
            */}
            {subject === "wardrobe" && !onBottom && necklineChoices.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("viz.neckline")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {necklineChoices.map((n) => (
                    <CollarChoice
                      key={n.id}
                      label={pick(n.name)}
                      active={wornNecklineId === n.id}
                      onClick={() => chooseNeckline(n.id)}
                    />
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {t("viz.necklineHint")}
                </p>
              </div>
            )}

            {/*
              Sleeves: how the sleeve is built, then where it ends. Two rows,
              because the two are separate choices — a type offers only the
              lengths it is made in, and changing type keeps the length when
              it can.
            */}
            {subject === "wardrobe" && !onBottom && sleeveChoices.length > 0 && wornSleeve && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("viz.sleeve")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {sleeveChoices.map((id) => (
                    <CollarChoice
                      key={id}
                      label={pick(sleeveTypeById(id)!.name)}
                      active={wornSleeve.type === id}
                      onClick={() => chooseSleeve({ type: id })}
                    />
                  ))}
                </div>
                <p className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("viz.sleeveLength")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {sleeveLengthsFor(wornSleeve.type, cuttingEntry ? necklineOf(cuttingEntry.worn) : undefined).map((id) => (
                    <CollarChoice
                      key={id}
                      label={pick(sleeveLengthById(id)!.name)}
                      active={wornSleeve.length === id}
                      onClick={() => chooseSleeve({ length: id })}
                    />
                  ))}
                </div>
                {/* a cuff is a long sleeve's, on a garment that offers one */}
                {cuttingGarment && sleeveCuffsFor(cuttingGarment, wornSleeve).length > 0 && (
                  <>
                    <p className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("viz.cuff")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {sleeveCuffsFor(cuttingGarment, wornSleeve).map((id) => (
                        <CollarChoice
                          key={id}
                          label={pick(sleeveCuffById(id)!.name)}
                          active={wornSleeve.cuff === id}
                          onClick={() => chooseSleeve({ cuff: id })}
                        />
                      ))}
                    </div>
                  </>
                )}
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {t("viz.sleeveHint")}
                </p>
              </div>
            )}

            {subject === "wardrobe" && !onBottom && collarChoices.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("viz.collar")}
                </p>
                <div className="flex flex-wrap gap-2">
                  <CollarChoice
                    label={t("viz.noCollar")}
                    active={!wornCollarId}
                    onClick={() => chooseCollar(undefined)}
                  />
                  {collarChoices.map((c) => (
                    <CollarChoice
                      key={c.id}
                      label={pick(c.name)}
                      active={wornCollarId === c.id}
                      onClick={() => chooseCollar(c.id)}
                    />
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {t("viz.collarHint")}
                </p>
              </div>
            )}

            {/* fabric switcher */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {regions.length > 1
                  ? `${t("viz.cutFrom")} — ${pick(
                      regions.find((r) => r.active)?.label ?? {
                        en: "",
                        ar: "",
                      }
                    )}`
                  : t("viz.pickFabric")}
              </p>
              <div className="grid grid-cols-6 gap-2">
                {fabrics.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => cutRegion(f)}
                    aria-label={pick(f.name)}
                    title={`${pick(f.name)} · ${fabricRepeatCm(f).toFixed(
                      1
                    )} cm`}
                    className={cn(
                      "aspect-square rounded-lg border transition-all",
                      f.id === activeFabric.id
                        ? "border-apricot-500 ring-2 ring-apricot-500/30"
                        : "border-border hover:border-apricot-400"
                    )}
                    style={fabricBackground(f, {
                      viewCm: 6,
                      elementPx: 44,
                      fitRepeat: true,
                    })}
                  />
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {t("viz.repeat")}:{" "}
                <span className="font-semibold text-foreground">
                  {fabricRepeatCm(activeFabric).toFixed(1)} {t("unit.cm")}
                </span>
              </p>
            </div>

            {/* finishing */}
            <div className="space-y-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("viz.controls")}
              </p>

              {/*
                Free 0–360 rotation: straight grain, true bias and cross grain
                are all real cuts, so the control is not restricted to a few.
              */}
              <Field
                icon={<Compass className="h-4 w-4" />}
                label={t("viz.rotation")}
                value={`${direction}°`}
              >
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={1}
                  value={direction}
                  onChange={(e) => setDirection(Number(e.target.value))}
                  aria-label={t("viz.rotation")}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-apricot-500"
                />
                <div className="mt-2 flex gap-2">
                  {GRAIN_PRESETS.map((d) => (
                    <Choice
                      key={d}
                      active={direction === d}
                      onClick={() => setDirection(d)}
                    >
                      {`${d}° · ${t(GRAIN_LABELS[d])}`}
                    </Choice>
                  ))}
                </div>
              </Field>

              <Field
                icon={<Scissors className="h-4 w-4" />}
                label={t("viz.stitch")}
              >
                <div className="flex flex-wrap gap-2">
                  {stitchColors.map((s) => (
                    <StitchChoice
                      key={s.id}
                      label={pick(s.label)}
                      color={
                        s.id === "tonal"
                          ? activeFabric.palette?.accent ?? activeFabric.color
                          : s.color
                      }
                      active={activeStitch === s.id}
                      onClick={() => setStitch(s.id)}
                    />
                  ))}
                </div>
              </Field>

              <button
                onClick={reset}
                className="btn-focus inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-apricot-600"
              >
                <RotateCcw className="h-4 w-4" />
                {t("viz.reset")}
              </button>
            </div>

            <Button variant="primary" className="w-full" onClick={share}>
              <Download className="h-4 w-4" />
              {t("viz.share")}
            </Button>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  /** Optional read-out shown opposite the label — e.g. the current angle. */
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
          <span className="text-apricot-500">{icon}</span>
          {label}
        </span>
        {value && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {value}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "btn-focus flex-1 rounded-full border px-3 py-1.5 text-sm font-medium transition-all",
        active
          ? "border-apricot-500 bg-apricot-500 text-white"
          : "border-border bg-card text-foreground hover:border-apricot-400"
      )}
    >
      {children}
    </button>
  );
}

/** A collar in the picker. Narrower than `Choice` — there are ten of them. */
function CollarChoice({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "btn-focus rounded-full border px-3 py-1 text-xs font-medium transition-all",
        active
          ? "border-apricot-500 bg-apricot-500 text-white shadow-soft"
          : "border-border bg-card text-muted-foreground hover:border-apricot-400"
      )}
    >
      {label}
    </button>
  );
}

/**
 * One skin tone, in its own colour and nothing else. It once had a painted-on
 * highlight, which turned the deepest tones grey: the swatch has to be the
 * colour the body is drawn in.
 */
function SkinSwatch({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        "btn-focus h-6 w-6 shrink-0 rounded-full transition-transform hover:scale-110 sm:h-7 sm:w-7",
        active
          ? "scale-110 ring-2 ring-apricot-500 ring-offset-2 ring-offset-card"
          : "ring-1 ring-black/10 dark:ring-white/15"
      )}
      style={{ backgroundColor: color }}
    />
  );
}

/**
 * An element's size in CSS pixels, once it has been laid out — `null` until
 * then. Takes the element itself, not a ref, so it notices an element that
 * mounts after the component does (the sheet renders nothing while closed).
 */
function useElementSize(el: HTMLElement | null) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null
  );

  useEffect(() => {
    if (!el || typeof ResizeObserver === "undefined") {
      setSize(null);
      return;
    }
    const ro = new ResizeObserver(() => {
      // Padding included: what is drawn into it is positioned against that box.
      const width = el.clientWidth;
      const height = el.clientHeight;
      setSize((prev) =>
        prev && prev.width === width && prev.height === height
          ? prev
          : width > 0 && height > 0
            ? { width, height }
            : null
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);

  return size;
}

function StitchChoice({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color: string | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className={cn(
        "btn-focus inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
        active
          ? "border-apricot-500 bg-apricot-500/10 text-foreground"
          : "border-border bg-card text-muted-foreground hover:border-apricot-400"
      )}
    >
      <span
        className="h-3.5 w-3.5 rounded-full border border-border"
        style={
          color
            ? { backgroundColor: color }
            : {
                backgroundImage:
                  "linear-gradient(45deg, transparent 45%, currentColor 45%, currentColor 55%, transparent 55%)",
              }
        }
      />
      {label}
    </button>
  );
}
