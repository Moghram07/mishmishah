"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RotateCcw,
  X,
  Sparkles,
  Download,
  Ruler,
  Loader2,
  ZoomIn,
  Move,
  Shirt,
  Sofa,
  Undo2,
  Redo2,
} from "lucide-react";
import { useVisualizer } from "@/components/providers/VisualizerProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { productTemplates } from "@/lib/data/products";
import { garmentById, garmentsFor, defaultGarment } from "@/lib/data/garments";
import { stripeEdgesFor, stripesFor, tiesFor } from "@/lib/data/collars";
import { necklinesForGarment } from "@/lib/data/necklines";
import { skirtLengthsFor, skirtShapesFor, waistsFor } from "@/lib/data/skirts";
import { legsFor } from "@/lib/data/legs";
import { frontsFor } from "@/lib/data/fronts";
import { beltsFor, buttonsFor } from "@/lib/data/closures";
import {
  sleeveCuffById,
  sleeveCuffsFor,
  sleeveLengthById,
  fallbackLength,
  sleeveLengthsFor,
  sleeveTypeName,
  sleeveTypesFor,
} from "@/lib/data/sleeves";
import { contrastingPlain, fabrics, fabricById } from "@/lib/data/fabrics";
import { DEFAULT_SKIN_TONE, skinToneById, skinTones } from "@/lib/data/skinTones";
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
  setLeg,
  legOf,
  setButtons,
  buttonsOf,
  setBelt,
  beltOf,
  setStripes,
  setTie,
  stripeEdgesOf,
  stripesOnOf,
  toggleStripeEdge,
  stripesOf,
  tieOf,
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
import { fabricHasDirection } from "@/lib/fabrics/patterns";
import { exportShareCard, type ShareEntry } from "@/lib/share/shareCard";
import { ProductTemplate, productPanBy } from "./ProductTemplate";
import { MannequinStage } from "./MannequinStage";
import { Silhouette, boxAround } from "./Silhouette";
import { useHistory } from "./history";
import {
  BodyButton,
  Chip,
  Choice,
  PanelRow,
  PanelTabs,
  RowHeading,
  RowHint,
  Segmented,
  SkinSwatch,
  type PanelTab,
} from "./PanelControls";
import { garmentArt } from "@/lib/garments/art";
import { cutAs } from "@/lib/garments/skirts";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import { FEATURES } from "@/lib/features";
import type {
  BeltId,
  BodyType,
  ButtonsId,
  Design,
  Fabric,
  FabricRegionId,
  FrontId,
  GarmentPartId,
  Outfit,
  ProductKind,
  SkirtChoice,
  LegId,
  SleeveChoice,
  StripeEdgeId,
  StripesId,
  TieId,
} from "@/types";

/**
 * Room the whole figure keeps from the stage's edges, in pixels. Underneath it
 * there is also the height of the controls laid over the bottom of the stage.
 */
const STAGE_ROOM = 24;

/**
 * The ways a pattern can be laid on the body, in degrees: lengthwise, across,
 * and on the bias — the three a tailor actually cuts. A free 0–360 slider
 * offered every angle in between, and none of them is a cut anyone makes.
 */
const GRAIN_PRESETS = [0, 90, 45];

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
  /*
    The outfit and the home design, with undo and redo: every choice is one
    step back — see `history.ts`. Zoom, panning and which part is being cut
    are where you are looking, not what you designed, so they are not steps.
  */
  const {
    state: designed,
    set: setDesigned,
    rebase,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<{ outfit: Outfit; design: Design }>(() => ({
    outfit: newOutfit(fabric),
    design: newDesign("sofa", fabric),
  }));
  const { outfit, design } = designed;
  const setOutfit = useCallback(
    (next: Outfit | ((o: Outfit) => Outfit)) =>
      setDesigned((s) => {
        const o = typeof next === "function" ? next(s.outfit) : next;
        return o === s.outfit ? s : { ...s, outfit: o };
      }),
    [setDesigned]
  );
  const setDesign = useCallback(
    (next: Design | ((d: Design) => Design)) =>
      setDesigned((s) => {
        const d = typeof next === "function" ? next(s.design) : next;
        return d === s.design ? s : { ...s, design: d };
      }),
    [setDesigned]
  );
  /* the panel's group, and the row open in each — one at a time */
  const [tab, setTab] = useState<PanelTab>("cut");
  const [openRow, setOpenRow] = useState<Partial<Record<PanelTab, string>>>({});
  /* the fabrics group keeps the part being cut open, until it is closed */
  const [fabricsOpen, setFabricsOpen] = useState(true);
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
  // picking a fabric only re-cuts the region being edited. A fresh start: the
  // last visit's steps are not this one's to undo.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      rebase((s) => ({
        // Both mannequins, the one put away as well as the one on the stage.
        outfit: everyWardrobe(s.outfit, (worn) =>
          worn.map((w) => {
            const garment = garmentById(w.garmentId);
            return garment ? cutFrom(garment, fabric.id, w.stitch) : w;
          })
        ),
        design: { ...s.design, ...newDesign(s.design.productId, fabric) },
      }));
    }
    wasOpen.current = isOpen;
  }, [isOpen, fabric, rebase]);

  // Close on Escape, undo and redo on their keys, and lock body scroll while open.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return close();
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      /* by the key's place, not its letter, so they work on an Arabic keyboard too */
      if (e.code === "KeyZ" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (e.code === "KeyY" || (e.code === "KeyZ" && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, close, undo, redo]);

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
  /**
   * Stripe the garment being cut — along its sailor collar, or its boat
   * neckline — or take its stripes off. They arrive in the plain cloth that
   * stands out most against the cloth they lie on — see `contrastingPlain` —
   * and the picker moves to them, since their cloth is what you almost always
   * want next.
   */
  const chooseStripes = (stripes: StripesId) => {
    if (!cuttingGarment || !cuttingEntry) return;
    const w = cuttingEntry.worn;
    const under = fabricById(w.fabrics.collar ?? w.fabrics[cuttingGarment.fabricRegions[0]] ?? "") ?? fabric;
    setOutfit((o) => ({
      ...o,
      worn: setStripes(o.worn, cuttingGarment.id, stripes, contrastingPlain(under).id),
    }));
    if (stripes === "none") {
      if (cutting.region === "trim") setCutting({ garmentId: cuttingGarment.id, region: cuttingGarment.fabricRegions[0] });
    } else setCutting({ garmentId: cuttingGarment.id, region: "trim" });
  };

  /** Sew the stripes along an edge, or take them off it — the same cloth and count on every edge. */
  const toggleStripes = (edge: StripeEdgeId) => {
    if (!cuttingGarment) return;
    setOutfit((o) => ({ ...o, worn: toggleStripeEdge(o.worn, cuttingGarment.id, edge) }));
  };

  /**
   * Tie the collar at its V, or untie it. The tie arrives in the stripes'
   * cloth on a striped collar, the collar's on a plain one — see `setTie` —
   * and the picker moves to it, to cut it from another if wanted.
   */
  const chooseTie = (tie: TieId) => {
    if (!cuttingGarment) return;
    setOutfit((o) => ({ ...o, worn: setTie(o.worn, cuttingGarment.id, tie) }));
    if (tie === "none") {
      if (cutting.region === "tie") setCutting({ garmentId: cuttingGarment.id, region: "collar" });
    } else setCutting({ garmentId: cuttingGarment.id, region: "tie" });
  };

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
    const lengths = sleeveLengthsFor(type, necklineOf(cuttingEntry.worn), cuttingGarment);
    const length =
      next.length && lengths.includes(next.length)
        ? next.length
        : lengths.includes(current.length)
          ? current.length
          : fallbackLength(type, lengths);
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

  /** Recut the legs of the trousers being cut — resolved when read, see `legOf`. */
  const chooseLeg = (leg: LegId) => {
    if (!cuttingGarment) return;
    setOutfit((o) => ({ ...o, worn: setLeg(o.worn, cuttingGarment.id, leg) }));
  };

  /** Button the dress being cut down its front so far — resolved when read, see `buttonsOf`. */
  const chooseButtons = (buttons: ButtonsId) => {
    if (!cuttingGarment) return;
    setOutfit((o) => ({ ...o, worn: setButtons(o.worn, cuttingGarment.id, buttons) }));
  };

  /** Belt the dress being cut — resolved when read, see `beltOf`. */
  const chooseBelt = (belt: BeltId) => {
    if (!cuttingGarment) return;
    setOutfit((o) => ({ ...o, worn: setBelt(o.worn, cuttingGarment.id, belt) }));
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

  const wornSkirt = cuttingEntry ? skirtOf(cuttingEntry.worn) : undefined;
  const skirtShapeChoices = cuttingGarment ? skirtShapesFor(cuttingGarment) : [];
  /* the lengths the shape being worn is cut at: a mermaid's, midi and maxi */
  const skirtLengthChoices = cuttingGarment ? skirtLengthsFor(cuttingGarment, wornSkirt?.shape) : [];
  const waistChoices = cuttingGarment ? waistsFor(cuttingGarment) : [];
  const showSkirt = subject === "wardrobe" && (skirtShapeChoices.length > 1 || skirtLengthChoices.length > 1);

  /* how a pair of trousers' legs are cut: straight, slim or wide */
  const legChoices = cuttingGarment ? legsFor(cuttingGarment) : [];
  const wornLeg = cuttingEntry ? legOf(cuttingEntry.worn) : undefined;
  const showLeg = subject === "wardrobe" && legChoices.length > 1 && wornLeg !== undefined;

  /* how a robe is worn at the front, her abaya's: open or closed */
  const frontChoices = cuttingGarment ? frontsFor(cuttingGarment) : [];
  const wornFront = cuttingEntry ? frontOf(cuttingEntry.worn) : undefined;
  const showFront = subject === "wardrobe" && frontChoices.length > 1 && wornFront !== undefined;

  /*
    A dress's buttons, beside the cut they depend on — offered only where its
    centre front is straight — and its belt, beside the waist it sits on.
  */
  const cutNow = cuttingEntry ? necklineOf(cuttingEntry.worn)?.cut : undefined;
  const buttonChoices = cuttingGarment ? buttonsFor(cuttingGarment, cutNow, wornSkirt?.shape) : [];
  const wornButtons = cuttingEntry ? buttonsOf(cuttingEntry.worn) : undefined;
  const showButtons = subject === "wardrobe" && buttonChoices.length > 1 && wornButtons !== undefined;
  const beltChoices = cuttingGarment ? beltsFor(cuttingGarment, cutNow) : [];
  const wornBelt = cuttingEntry ? beltOf(cuttingEntry.worn) : undefined;
  const showBelt = beltChoices.length > 1 && wornBelt !== undefined;

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

  /* each leg's icon: the trousers cut to it, all framed alike, so a slimmer or a wider one looks it */
  const legIcons = (() => {
    if (!showLeg || !cuttingGarment) return null;
    const art = garmentArt(cuttingGarment.asset.front);
    const pieces = legChoices.map((leg) => art?.silhouette?.({ leg: leg.id }) ?? []);
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
  /* the lengths the sleeve worn is cut at, on this garment */
  const sleeveLengths =
    wornSleeve && cuttingEntry
      ? sleeveLengthsFor(wornSleeve.type, necklineOf(cuttingEntry.worn), cuttingGarment)
      : [];
  const collarChoices =
    cuttingGarment && cuttingEntry
      ? collarsFitting(cuttingGarment, cuttingEntry.worn)
      : [];
  const wornCollarId = cuttingEntry && collarOf(cuttingEntry.worn)?.id;
  /*
    Its stripes, where its collar or its neckline takes them — a sailor's, a
    boat's — and how far they go; and, on a collar, its tie.
  */
  const wornCollar = cuttingEntry ? collarOf(cuttingEntry.worn) : undefined;
  const stripeEdges = cuttingEntry ? stripeEdgesFor(stripeEdgesOf(cuttingEntry.worn)) : [];
  const stripeChoices = stripeEdges.length > 0 ? stripesFor(cuttingGarment?.stripes) : [];
  const wornStripes = cuttingEntry ? stripesOf(cuttingEntry.worn) : undefined;
  const wornStripesOn = cuttingEntry ? stripesOnOf(cuttingEntry.worn) : [];
  const tieChoices = tiesFor(wornCollar);
  const wornTie = cuttingEntry ? tieOf(cuttingEntry.worn) : undefined;

  /*
    The panel, as rows: each choice closed to a line saying what is chosen,
    opening in place. Each row names the part a close-up should look at while
    it is open — the skirt's rows the skirt, the collar's the collar.
  */
  interface RowSpec {
    id: string;
    label: string;
    value?: string;
    region?: FabricRegionId;
    body: React.ReactNode;
  }
  const named = (list: { id: string; name: { en: string; ar: string } }[], id: string | undefined) => {
    const hit = list.find((c) => c.id === id);
    return hit ? pick(hit.name) : undefined;
  };

  /* القصّة: how the garment being edited is cut */
  const cutRows: RowSpec[] = [];
  if (subject === "wardrobe" && necklineChoices.length > 0) {
    cutRows.push({
      id: "neckline",
      label: t("viz.neckline"),
      value: named(necklineChoices, wornNecklineId),
      region: "top",
      body: (
        <>
          <div className="flex flex-wrap gap-2">
            {necklineChoices.map((n) => (
              <Chip key={n.id} label={pick(n.name)} active={wornNecklineId === n.id} onClick={() => chooseNeckline(n.id)} />
            ))}
          </div>
          <RowHint>{t("viz.necklineHint")}</RowHint>
        </>
      ),
    });
  }
  /*
    Sleeves: how the sleeve is built, then where it ends — two choices, since a
    type offers only the lengths it is made in, and changing type keeps the
    length when it can.
  */
  if (subject === "wardrobe" && sleeveChoices.length > 0 && wornSleeve) {
    const length = sleeveLengthById(wornSleeve.length);
    cutRows.push({
      id: "sleeve",
      label: t("viz.sleeve"),
      value:
        wornSleeve.length === "sleeveless" && length
          ? pick(length.name)
          : [length && sleeveLengths.length > 1 ? pick(length.name) : undefined, pick(sleeveTypeName(cuttingGarment, wornSleeve.type))]
              .filter(Boolean)
              .join(" · "),
      region: "top",
      body: (
        <>
          <div className="flex flex-wrap gap-2">
            {sleeveChoices.map((id) => (
              <Chip key={id} label={pick(sleeveTypeName(cuttingGarment, id))} active={wornSleeve.type === id} onClick={() => chooseSleeve({ type: id })} />
            ))}
          </div>
          {/* where it ends — not asked of a garment cut at one length only, an abaya's long sleeves */}
          {sleeveLengths.length > 1 && (
            <>
              <RowHeading>{t("viz.sleeveLength")}</RowHeading>
              <div className="flex flex-wrap gap-2">
                {sleeveLengths.map((id) => (
                  <Chip key={id} label={pick(sleeveLengthById(id)!.name)} active={wornSleeve.length === id} onClick={() => chooseSleeve({ length: id })} />
                ))}
              </div>
            </>
          )}
          <RowHint>{t("viz.sleeveHint")}</RowHint>
        </>
      ),
    });
  }
  /* the skirt: its shape, as a row of the garment cut to each, and its length */
  if (showSkirt && wornSkirt) {
    cutRows.push({
      id: "skirt",
      /* «شكل التنورة», not «القصّة» (the whole group's name) nor «التنورة» (a garment's) */
      label: t("viz.skirt"),
      value: [named(skirtShapeChoices, wornSkirt.shape), named(skirtLengthChoices, wornSkirt.length)].filter(Boolean).join(" · "),
      region: "bottom",
      body: (
        <>
          {shapeIcons && (
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
                      on ? "border-apricot-500 bg-apricot-500/10 text-foreground" : "border-border bg-card text-muted-foreground hover:border-apricot-400"
                    )}
                  >
                    <Silhouette pieces={shapeIcons.pieces[i]} box={shapeIcons.box} className={cn("h-16 w-full", on && "text-apricot-500")} />
                    {pick(shape.name)}
                  </button>
                );
              })}
            </div>
          )}
          {skirtLengthChoices.length > 1 && (
            <>
              <RowHeading>{t("viz.length")}</RowHeading>
              <Segmented
                label={t("viz.length")}
                choices={skirtLengthChoices.map((l) => ({ id: l.id, label: pick(l.name) }))}
                active={wornSkirt.length}
                onPick={(length) => chooseSkirt({ length })}
              />
            </>
          )}
        </>
      ),
    });
  }
  /* the waist its skirt hangs from, a dress's */
  if (subject === "wardrobe" && waistChoices.length > 1 && wornSkirt) {
    cutRows.push({
      id: "waist",
      label: t("viz.waist"),
      value: named(waistChoices, wornSkirt.waist),
      region: "bottom",
      body: (
        <Segmented
          label={t("viz.waist")}
          choices={waistChoices.map((w) => ({ id: w.id, label: pick(w.name) }))}
          active={wornSkirt.waist ?? waistChoices[0].id}
          onPick={(waist) => chooseSkirt({ waist })}
        />
      ),
    });
  }
  /* how it is worn at the front, an abaya's: open or closed */
  if (showFront && wornFront) {
    cutRows.push({
      id: "front",
      label: t("viz.front"),
      value: named(frontChoices, wornFront),
      body: (
        <Segmented
          label={t("viz.front")}
          choices={frontChoices.map((f) => ({ id: f.id, label: pick(f.name) }))}
          active={wornFront}
          onPick={chooseFront}
        />
      ),
    });
  }
  /* a pair of trousers' legs: a row of them cut to each */
  if (legIcons && wornLeg) {
    cutRows.push({
      id: "leg",
      /* «شكل البنطلون», not «القصّة» (the whole group's name) nor «بنطلون» (the garment's) */
      label: t("viz.trousersShape"),
      value: named(legChoices, wornLeg),
      body: (
        <div role="group" aria-label={t("viz.leg")} className="flex gap-2 overflow-x-auto pb-1">
          {legChoices.map((leg, i) => {
            const on = wornLeg === leg.id;
            return (
              <button
                key={leg.id}
                onClick={() => chooseLeg(leg.id)}
                aria-pressed={on}
                className={cn(
                  "btn-focus flex w-20 shrink-0 flex-col items-center gap-1.5 rounded-2xl border px-2 pb-2 pt-2.5 text-xs font-semibold transition-all",
                  on ? "border-apricot-500 bg-apricot-500/10 text-foreground" : "border-border bg-card text-muted-foreground hover:border-apricot-400"
                )}
              >
                <Silhouette pieces={legIcons.pieces[i]} box={legIcons.box} className={cn("h-16 w-full", on && "text-apricot-500")} />
                {pick(leg.name)}
              </button>
            );
          })}
        </div>
      ),
    });
  }

  /* الإضافات: what is added to it */
  const extraRows: RowSpec[] = [];
  /*
    The collar, as a part rather than a style. It is offered only where a
    garment has a neckline to sew one to, and only the ones cut to fit that
    neckline are listed.
  */
  if (subject === "wardrobe" && collarChoices.length > 0) {
    extraRows.push({
      id: "collar",
      label: t("viz.collar"),
      value: wornCollar ? pick(wornCollar.name) : t("viz.noCollar"),
      region: wornCollar ? "collar" : "top",
      body: (
        <>
          <div className="flex flex-wrap gap-2">
            <Chip label={t("viz.noCollar")} active={!wornCollarId} onClick={() => chooseCollar(undefined)} />
            {collarChoices.map((c) => (
              <Chip key={c.id} label={pick(c.name)} active={wornCollarId === c.id} onClick={() => chooseCollar(c.id)} />
            ))}
          </div>
          <RowHint>{t("viz.collarHint")}</RowHint>
        </>
      ),
    });
  }
  /*
    Stripes in a cloth of their own: how many, and along which of its edges
    — each on or off on its own, the same count and cloth on all of them.
  */
  if (subject === "wardrobe" && stripeChoices.length > 1 && wornStripes) {
    extraRows.push({
      id: "stripes",
      label: t("viz.stripes"),
      value: [named(stripeChoices, wornStripes), ...(wornStripes !== "none" ? stripeEdges.filter((c) => wornStripesOn.includes(c.id)).map((c) => pick(c.name)) : [])].join(" · "),
      region: wornStripesOn.length > 0 ? "trim" : undefined,
      body: (
        <>
          <Segmented label={t("viz.stripes")} choices={stripeChoices.map((c) => ({ id: c.id, label: pick(c.name) }))} active={wornStripes} onPick={chooseStripes} />
          {wornStripes !== "none" && (
            <>
              <RowHeading>{t("viz.stripesAt")}</RowHeading>
              <div role="group" aria-label={t("viz.stripesAt")} className="flex flex-wrap gap-2">
                {stripeEdges.map((c) => (
                  <Chip key={c.id} label={pick(c.name)} active={wornStripesOn.includes(c.id)} onClick={() => toggleStripes(c.id)} />
                ))}
              </div>
            </>
          )}
        </>
      ),
    });
  }
  /* a sailor collar's tie */
  if (subject === "wardrobe" && tieChoices.length > 1 && wornTie) {
    extraRows.push({
      id: "tie",
      label: t("viz.tie"),
      value: named(tieChoices, wornTie),
      region: wornTie !== "none" ? "tie" : undefined,
      body: <Segmented label={t("viz.tie")} choices={tieChoices.map((c) => ({ id: c.id, label: pick(c.name) }))} active={wornTie} onPick={chooseTie} />,
    });
  }
  /* a dress's buttons down its front, on a cut with a straight centre front */
  if (showButtons && wornButtons) {
    extraRows.push({
      id: "buttons",
      label: t("viz.buttons"),
      value: named(buttonChoices, wornButtons),
      region: "top",
      body: <Segmented label={t("viz.buttons")} choices={buttonChoices.map((b) => ({ id: b.id, label: pick(b.name) }))} active={wornButtons} onPick={chooseButtons} />,
    });
  }
  /* a belt on its waist seam, a dress's: none, its own cloth, or leather */
  if (subject === "wardrobe" && showBelt && wornBelt) {
    extraRows.push({
      id: "belt",
      label: t("viz.belt"),
      value: named(beltChoices, wornBelt),
      region: "bottom",
      body: (
        <div role="group" aria-label={t("viz.belt")} className="flex flex-wrap gap-2">
          {beltChoices.map((b) => (
            <Chip key={b.id} label={pick(b.name)} active={wornBelt === b.id} onClick={() => chooseBelt(b.id)} />
          ))}
        </div>
      ),
    });
  }
  /* a long sleeve's cuff, on a garment that offers one */
  const cuffChoices = cuttingGarment && wornSleeve ? sleeveCuffsFor(cuttingGarment, wornSleeve) : [];
  if (subject === "wardrobe" && wornSleeve && cuffChoices.length > 0) {
    extraRows.push({
      id: "cuff",
      label: t("viz.cuff"),
      value: wornSleeve.cuff ? pick(sleeveCuffById(wornSleeve.cuff)!.name) : undefined,
      region: "top",
      body: (
        <div className="flex flex-wrap gap-2">
          {cuffChoices.map((id) => (
            <Chip key={id} label={pick(sleeveCuffById(id)!.name)} active={wornSleeve.cuff === id} onClick={() => chooseSleeve({ cuff: id })} />
          ))}
        </div>
      ),
    });
  }

  /*
    الأقمشة: every part on the figure, each with its fabric. Opening one is
    choosing what the swatches cut; it stays open as you try them.
  */
  const fabricRows =
    subject === "wardrobe"
      ? worn.flatMap(({ garment, worn: w }) => {
          const regions = regionsOf(garment, w);
          return regions.map((region) => ({
            key: `${garment.id}:${region}`,
            label:
              worn.length > 1
                ? regions.length > 1
                  ? `${pick(garment.name)} · ${pick(regionLabel(region))}`
                  : pick(garment.name)
                : regions.length > 1
                  ? pick(regionLabel(region))
                  : pick(garment.name),
            fabric: outfitFabrics[garment.id]?.[region] ?? fabric,
            active: cutting.garmentId === garment.id && cutting.region === region,
            choose: () => setCutting({ garmentId: garment.id, region }),
          }));
        })
      : product.parts.map((part) => ({
          key: part.id as string,
          label: pick(part.label),
          fabric: partFabrics[part.id] ?? fabric,
          active: activePart === part.id,
          choose: () => setActivePart(part.id),
        }));

  /* opening a row closes the one open before it, and points a close-up at what it is about */
  const toggleRow = (row: RowSpec) => {
    const opening = openRow[tab] !== row.id;
    setOpenRow((o) => ({ ...o, [tab]: opening ? row.id : undefined }));
    if (opening && row.region && cuttingEntry && regionsOf(cuttingEntry.garment, cuttingEntry.worn).includes(row.region)) {
      setCutting({ garmentId: cuttingEntry.garment.id, region: row.region });
    }
  };
  const rowsOf = (rows: RowSpec[]) =>
    rows.map((row) => (
      <PanelRow key={row.id} id={row.id} label={row.label} value={row.value} open={openRow[tab] === row.id} onToggle={() => toggleRow(row)}>
        {row.body}
      </PanelRow>
    ));

  /* which garment the cut and extras are for, when more than one is worn */
  const editing = subject === "wardrobe" && worn.length > 1 && (
    <div>
      <RowHeading>{t("viz.editing")}</RowHeading>
      <div className="mt-2 flex flex-wrap gap-2">
        {worn.map(({ garment }) => (
          <button
            key={garment.id}
            onClick={() => setCutting({ garmentId: garment.id, region: garment.fabricRegions[0] })}
            aria-pressed={cutting.garmentId === garment.id}
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
  );

  /* the fabrics: a row per part, the swatches under the one open */
  const fabricsList = (
    <>
      {fabricRows.map((row) => (
        <PanelRow
          key={row.key}
          id={`fabric-${row.key}`}
          label={row.label}
          value={pick(row.fabric.name)}
          lead={
            <span
              className="h-7 w-7 shrink-0 rounded-full border border-border"
              style={fabricBackground(row.fabric, { viewCm: 4, elementPx: 28, fitRepeat: true })}
            />
          }
          open={row.active && fabricsOpen}
          onToggle={() => {
            if (row.active) setFabricsOpen((o) => !o);
            else {
              row.choose();
              setFabricsOpen(true);
            }
          }}
        >
          <div className="grid grid-cols-6 gap-2">
            {fabrics.map((f) => (
              <button
                key={f.id}
                onClick={() => cutRegion(f)}
                aria-label={pick(f.name)}
                aria-pressed={f.id === activeFabric.id}
                title={`${pick(f.name)} · ${fabricRepeatCm(f).toFixed(1)} cm`}
                className={cn(
                  "aspect-square rounded-lg border transition-all",
                  f.id === activeFabric.id ? "border-apricot-500 ring-2 ring-apricot-500/30" : "border-border hover:border-apricot-400"
                )}
                style={fabricBackground(f, { viewCm: 6, elementPx: 44, fitRepeat: true })}
              />
            ))}
          </div>
          <RowHint>
            {t("card.sample")} · {t("viz.repeat")}:{" "}
            <span className="font-semibold text-foreground">
              {fabricRepeatCm(activeFabric).toFixed(1)} {t("unit.cm")}
            </span>
          </RowHint>
        </PanelRow>
      ))}
      {/*
        Which way the pattern is laid, for a pattern that has a way:
        lengthwise, across or on the bias. A plain cloth or a print that looks
        the same any way round is not asked — the choice would change nothing
        on the figure.
      */}
      {fabricHasDirection(activeFabric) && (
        <div className="flex flex-col gap-2 pt-1">
          <RowHeading>{t("viz.rotation")}</RowHeading>
          <div role="group" aria-label={t("viz.rotation")} className="flex gap-2">
            {GRAIN_PRESETS.map((d) => (
              <Choice key={d} active={direction === d} onClick={() => setDirection(d)}>
                {t(GRAIN_LABELS[d])}
              </Choice>
            ))}
          </div>
        </div>
      )}
    </>
  );

  const TABS: { id: PanelTab; label: string }[] = [
    { id: "cut", label: t("viz.tabCut") },
    { id: "extras", label: t("viz.tabExtras") },
    { id: "fabrics", label: t("viz.tabFabrics") },
  ];

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
        {/* header: what this is; then undo, redo, share and close */}
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-7 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-apricot-500/15 text-apricot-600 sm:inline-flex">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="heading-display truncate text-lg leading-none">{t("viz.title")}</h2>
              <p className="mt-1 hidden text-xs text-muted-foreground sm:block">{t("viz.subtitle")}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              onClick={undo}
              disabled={!canUndo}
              aria-label={t("viz.undo")}
              title={t("viz.undo")}
              className="btn-focus inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-muted disabled:opacity-35 disabled:hover:bg-transparent"
            >
              <Undo2 className="h-[18px] w-[18px] rtl:-scale-x-100" />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              aria-label={t("viz.redo")}
              title={t("viz.redo")}
              className="btn-focus inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-muted disabled:opacity-35 disabled:hover:bg-transparent"
            >
              <Redo2 className="h-[18px] w-[18px] rtl:-scale-x-100" />
            </button>
            <button
              onClick={share}
              disabled={exporting}
              aria-label={t("viz.share")}
              className="btn-focus inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-border px-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-60 sm:px-4"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
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

            {/* which mannequin, behind a small button in the stage's corner */}
            {subject === "wardrobe" && (
              <div className="absolute start-3 top-3 z-30">
                <BodyButton
                  label={t("viz.body")}
                  bodies={bodyTypes.map((b) => ({ id: b.id, label: pick(b.label) }))}
                  active={outfit.bodyType}
                  onPick={setBody}
                />
              </div>
            )}

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
              Under the figure: the skin it is worn on, then the close-up. Laid
              over the stage, and measured, so a zoomed-out figure stands clear
              of it and a close-up runs on underneath.
            */}
            <div
              ref={setDockEl}
              className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 px-2 pb-3 sm:px-4 sm:pb-4"
            >
              {/* the skin tone stays out under the figure: the fabric on your own skin is the point */}
              {subject === "wardrobe" && (
                <div className="pointer-events-auto flex max-w-full flex-col items-center gap-1.5 rounded-2xl border border-border/60 bg-card/85 px-3 py-2 shadow-soft backdrop-blur sm:px-4 sm:py-2.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("viz.skinTone")}
                    <span className="ms-1.5 font-medium normal-case tracking-normal text-foreground/80">
                      {pick(skinToneById(outfit.skinTone).label)}
                    </span>
                  </span>
                  <div role="group" aria-label={t("viz.skinTone")} className="flex items-center gap-1.5 py-1 sm:gap-2">
                    {skinTones.map((s) => (
                      <SkinSwatch
                        key={s.id}
                        label={pick(s.label)}
                        color={s.color}
                        active={outfit.skinTone === s.id}
                        onClick={() => setOutfit((o) => ({ ...o, skinTone: s.id }))}
                      />
                    ))}
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
                <span className="w-8 shrink-0 text-xs tabular-nums text-muted-foreground">{zoom}×</span>
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
                    <span className="truncate sm:hidden">{t("viz.trueScaleShort")}</span>
                    <span className="hidden truncate sm:inline">{t("viz.trueScale")}</span>
                  </>
                )}
              </span>
            </div>
          </div>

          {/* controls */}
          <aside className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto border-t border-border bg-card/40 lg:w-[380px] lg:flex-none lg:border-s lg:border-t-0">
            {/* the three groups, kept in view while the panel scrolls */}
            {subject === "wardrobe" && (
              <div className="sticky top-0 z-10 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur sm:px-7">
                <PanelTabs label={t("viz.title")} tabs={TABS} active={tab} onPick={setTab} />
              </div>
            )}

            <div
              role={subject === "wardrobe" ? "tabpanel" : undefined}
              id={subject === "wardrobe" ? `viz-panel-${tab}` : undefined}
              aria-labelledby={subject === "wardrobe" ? `viz-tab-${tab}` : undefined}
              className="flex flex-col gap-4 p-4 sm:p-7"
            >
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
                        subject === key ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {icon}
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {subject === "home" ? (
                <>
                  <div>
                    <RowHeading>{t("viz.chooseProduct")}</RowHeading>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {productTemplates.map((p) => (
                        <Chip
                          key={p.kind}
                          label={pick(p.label)}
                          active={design.productId === p.kind}
                          onClick={() => {
                            setDesign((d) => ({ ...newDesign(p.kind, fabric), direction: d.direction, stitch: d.stitch }));
                            setActivePart(productByKind(p.kind).parts[0].id);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  {fabricsList}
                </>
              ) : tab === "cut" ? (
                <>
                  {/* what she is wearing */}
                  <div>
                    <RowHeading>{t("viz.wear")}</RowHeading>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {wardrobe.map((g) => {
                        const on = isWearing(outfit.worn, g.id);
                        return (
                          <button
                            key={g.id}
                            onClick={() => toggleGarment(g.id)}
                            aria-pressed={on}
                            className={cn(
                              "btn-focus rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all",
                              on ? "border-apricot-500 bg-apricot-500 text-white shadow-soft" : "border-border bg-card text-foreground hover:border-apricot-400"
                            )}
                          >
                            {pick(g.name)}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">{t("viz.layersHint")}</p>
                  </div>
                  {editing}
                  {rowsOf(cutRows)}
                </>
              ) : tab === "extras" ? (
                <>
                  {editing}
                  {extraRows.length > 0 ? rowsOf(extraRows) : <RowHint>{t("viz.noExtras")}</RowHint>}
                </>
              ) : (
                fabricsList
              )}

              <div className="mt-2 flex flex-col gap-4 border-t border-border/60 pt-4">
                <button
                  onClick={reset}
                  className="btn-focus inline-flex items-center gap-1.5 self-start text-sm font-medium text-muted-foreground transition-colors hover:text-apricot-600"
                >
                  <RotateCcw className="h-4 w-4" />
                  {t("viz.reset")}
                </button>
                <Button variant="primary" className="w-full" onClick={share}>
                  <Download className="h-4 w-4" />
                  {t("viz.share")}
                </Button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
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

