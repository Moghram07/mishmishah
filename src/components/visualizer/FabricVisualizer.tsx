"use client";

import { startTransition, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
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
import { stripeEdgesFor, stripesFor, tiePlacesFor, tiesFor } from "@/lib/data/collars";
import { necklinesForGarment } from "@/lib/data/necklines";
import { skirtLengthsFor, skirtShapesFor, waistsFor } from "@/lib/data/skirts";
import { legsFor } from "@/lib/data/legs";
import { frontsFor } from "@/lib/data/fronts";
import { beltsFor, bowPlacesFor, buttonRowsFor, buttonsFor } from "@/lib/data/closures";
import {
  sleeveCuffById,
  sleeveCuffsFor,
  sleeveLengthById,
  fallbackLength,
  sleeveLengthsFor,
  sleeveTypeName,
  sleeveTypesFor,
} from "@/lib/data/sleeves";
import { contrastingPlain, fabricById, offeredFabrics, tieStartOn } from "@/lib/data/fabrics";
import { DEFAULT_SKIN_TONE, skinToneById, skinTones } from "@/lib/data/skinTones";
import { regionLabel } from "@/lib/data/fabricRegions";
import { BODY_CANVAS, bodyTypes } from "@/lib/mannequin/bodies";
import { productByKind } from "@/lib/products/registry";
import { frameFor, panBy, type Viewport } from "@/lib/mannequin/frame";
import { PRODUCT_CANVAS } from "@/lib/products/registry";
import { zoomWouldShow } from "@/lib/fabrics/zoomHint";
import { focusOf } from "@/lib/garments/closeUp";
import {
  clothOf,
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
  setButtonRows,
  setButtons,
  buttonRowsOf,
  buttonRowsOffered,
  buttonsOf,
  setBelt,
  beltOf,
  bowAtOf,
  bowPlacesOf,
  setBowAt,
  setStripes,
  setTie,
  setTieAt,
  tieAtOf,
  tiePlacesOf,
  tiesOffered,
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
import type { FabricFilter } from "@/lib/fabrics/filters";
import { suitsNames } from "@/lib/fabrics/suits";
import { FabricPicker } from "@/components/fabric/FabricPicker";
import { PublishDesign } from "@/components/feedback/Feedback";
import { fabricHasDirection } from "@/lib/fabrics/patterns";
import { exportShareCard, type ShareEntry } from "@/lib/share/shareCard";
import { ProductTemplate, productPanBy } from "./ProductTemplate";
import { MannequinStage } from "./MannequinStage";
import { PhoneLayout, type PhoneCategory } from "./PhoneLayout";
import { PhoneFabrics } from "./PhoneFabrics";
import { looksFor, type Look } from "@/lib/data/looks";
import { offersWhole, wearWhole, WHOLE_NAMES } from "@/lib/visualizer/fabricParts";
import { pictureSrc, type PictureKind } from "@/lib/visualizer/optionPictures";
import {
  WHOLE_VIEW,
  frameOf,
  centreOf,
  cssTransform,
  movedView,
  nextZoom,
  partView,
  transformBetween,
  viewForPart,
  type Shown,
  type StageView,
} from "@/lib/visualizer/stageView";
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
  BowAtId,
  BodyType,
  ButtonRowsId,
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
  TieAtId,
  TieId,
} from "@/types";

/**
 * Room the whole figure keeps from the stage's edges, in pixels. Underneath it
 * there is also the height of the controls laid over the bottom of the stage.
 */
const STAGE_ROOM = 24;

/** The room the whole figure keeps from the phone stage's edges: its controls sit in the corners, beside it. */
const PHONE_ROOM = 10;

/** Where desktop's layout begins. Under it, the phone's. */
const DESKTOP = "(min-width: 1024px)";

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

/** The closest the close-up goes: the zoom slider's top. */
const MOST_ZOOM = 8;

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
  /* the swatches' filters, held from one part to the next */
  const [fabricFilter, setFabricFilter] = useState<FabricFilter>({});
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
    Under 1024 px the visualizer is laid out for a phone (`PhoneLayout`); at
    1024 and over, desktop's layout below, untouched. The design is the same
    state either way; only where you are looking is each layout's own.
  */
  const isDesktop = useIsDesktop();
  /*
    The figure on the whole screen, on a phone — see `PhoneLayout`'s `full`.
    Safari on an iPhone lets a page go truly full screen only for a video, so
    this is the visualizer's own: the panel and the controls put away and the
    stage grown into their place — drawn soft for a moment, then sharp, as any
    change of the stage's size is. Going in leaves a step in the browser's
    history, so the phone's back swipe returns to the editor rather than
    leaving the site; «رجوع» takes the same step back.
  */
  const [full, setFull] = useState(false);
  /** Whether the step going in left is still the history's last. */
  const fullStep = useRef(false);
  const enterFull = useCallback(() => {
    setFull(true);
    if (fullStep.current) return;
    window.history.pushState({ ...window.history.state, mishmishahFull: true }, "");
    fullStep.current = true;
  }, []);
  const leaveFull = useCallback(() => {
    // the step back comes round as a `popstate`, which leaves
    if (fullStep.current) window.history.back();
    else setFull(false);
  }, []);
  useEffect(() => {
    const onPop = () => {
      if (!fullStep.current) return;
      fullStep.current = false;
      setFull(false);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  /* closed, or turned wide enough for the desktop's layout: off the whole screen, and its step out of the history */
  useEffect(() => {
    if (full && (!isOpen || isDesktop)) leaveFull();
  }, [full, isOpen, isDesktop, leaveFull]);
  /** The phone's stage: the whole figure, or a close-up — following the category, or where the viewer put it. */
  const [view, setView] = useState<StageView>(WHOLE_VIEW);
  /**
   * What the phone's stage has drawn — its view on a stage of its size. The
   * requested `view` gets there in two steps: the picture already drawn is
   * moved and scaled by the GPU at once (soft for a moment), then the new one
   * is drawn sharp once — see `transformBetween`. A stage that changes size,
   * the fabrics panel rising, goes the same way. `box` is the stage it was
   * drawn for, to the fraction of a pixel: the box it is drawn in keeps that
   * size until the new one is drawn, so nothing is laid out again before.
   */
  const [shown, setShown] = useState<(Shown & { box: { width: number; height: number } }) | null>(null);
  /**
   * The phone's stage is drawn at 2× pixels: on a 3× screen at two thirds of
   * its size, scaled up by the GPU — under half the pixels of filters and
   * masks to draw. A change to the figure made while zoomed in (a neckline,
   * at 2×) is drawn first at half that, at once — soft for a moment — and
   * sharp right after, as a zoom is. `quickFor` is the figure drawn quick.
   */
  const sharpScale = typeof window === "undefined" ? 1 : Math.min(1, 2 / (window.devicePixelRatio || 1));
  const [quickFor, setQuickFor] = useState<object | null>(null);
  const renderScale = subject !== "wardrobe" ? 1 : quickFor ? sharpScale / 2 : sharpScale;
  /** The box the phone's stage is drawn in: what is moved and scaled. */
  const moverRef = useRef<HTMLDivElement | null>(null);
  /** A pinch or a drag under way: the stage follows the fingers, nothing else moves it. */
  const gestureOn = useRef(false);
  /** The phone panel's category open in each group. */
  const [phoneCat, setPhoneCat] = useState<Partial<Record<PanelTab, string>>>({});
  /** The part the phone's fabrics cut, by garment: «whole» — the whole garment — or one of its regions. */
  const [fabricPart, setFabricPart] = useState<Record<string, string>>({});

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
  // in whole pixels: a stage grown or shrunk by a fraction alone keeps its frame, and the figure drawn in it
  const [stageW, stageH, dockH] = [stageSize?.width, stageSize?.height, dockSize?.height];
  const viewport = useMemo<Viewport | null>(
    () =>
      stageW && stageH
        ? isDesktop
          ? {
              width: stageW,
              height: stageH,
              inset: [
                STAGE_ROOM,
                STAGE_ROOM,
                (dockH ?? 0) + STAGE_ROOM / 3,
                STAGE_ROOM,
              ],
            }
          : // the phone's controls float in the stage's corners, clear of the figure in its middle
            { width: stageW, height: stageH, inset: [PHONE_ROOM, PHONE_ROOM, PHONE_ROOM, PHONE_ROOM] }
        : null,
    [stageW, stageH, dockH, isDesktop]
  );
  /* the phone stage to the fraction of a pixel: the box the figure is drawn in is sized to it, as the stage itself was */
  const stageBox = stageSize?.exact ?? null;
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
  /* the ready-made look the mannequin is wearing, untouched since it was put on — its card ticked */
  const lookNow = useMemo(() => {
    const now = JSON.stringify(outfit.worn);
    return looksFor(outfit.bodyType).find((l) => JSON.stringify(l.worn()) === now)?.id;
  }, [outfit.worn, outfit.bodyType]);

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
      // the phone opens on the whole figure, at each group's first category
      setView(WHOLE_VIEW);
      setShown(null);
      setPhoneCat({});
    }
    wasOpen.current = isOpen;
  }, [isOpen, fabric, rebase]);

  // Close on Escape, undo and redo on their keys, and lock body scroll while open.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      /* on the whole screen, Escape comes back to the editor first */
      if (e.key === "Escape") return full ? leaveFull() : close();
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
  }, [isOpen, close, undo, redo, full, leaveFull]);

  /** Every worn garment's regions, resolved to fabrics. */
  const outfitFabrics = useMemo(() => {
    const out: Record<string, Partial<Record<FabricRegionId, Fabric>>> = {};
    for (const { garment, worn: w } of worn) {
      const regions: Partial<Record<FabricRegionId, Fabric>> = {};
      for (const region of regionsOf(garment, w)) {
        /* a part with no cloth of its own yet arrives in its garment's — see `clothOf` */
        regions[region] = fabricById(clothOf(w, region) ?? "") ?? fabric;
      }
      out[garment.id] = regions;
    }
    return out;
  }, [worn, fabric]);

  /*
    The figure draws the design a moment behind the panel: a tap paints the
    card it pressed first, then the figure — drawing it can take a while on a
    phone, and nothing should wait on it.
  */
  const stageOutfit = useDeferredValue(outfit);
  const stageFabrics = useDeferredValue(outfitFabrics);

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
   * Tie the garment being cut, or untie it. A new necktie or bow tie arrives
   * in plain black on a light shirt and plain white on a dark one, so it
   * always shows — see `tieStartOn`; any other tie in the stripes' cloth when
   * it wears stripes, otherwise in the cloth of what it is knotted on — see
   * `setTie` — and the picker moves to it, to cut it from another if wanted.
   */
  const chooseTie = (tie: TieId) => {
    if (!cuttingGarment || !cuttingEntry) return;
    const w = cuttingEntry.worn;
    const shirt = fabricById(w.fabrics.collar ?? w.fabrics[cuttingGarment.fabricRegions[0]] ?? "") ?? fabric;
    setOutfit((o) => ({ ...o, worn: setTie(o.worn, cuttingGarment.id, tie, tieStartOn(shirt).id) }));
    if (tie === "none") {
      if (cutting.region === "tie") setCutting({ garmentId: cuttingGarment.id, region: collarOf(cuttingEntry.worn) ? "collar" : cuttingGarment.fabricRegions[0] });
    } else setCutting({ garmentId: cuttingGarment.id, region: "tie" });
  };

  /** Knot the tie somewhere else — at the neck, or at the belt's front or side. */
  const chooseTieAt = (at: TieAtId) => {
    if (!cuttingGarment) return;
    setOutfit((o) => ({ ...o, worn: setTieAt(o.worn, cuttingGarment.id, at) }));
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
    // A wide band in the dress's own cloth barely shows, so its cloth is what
    // you almost always want next: the picker moves to it, as for the stripes
    // and the tie.
    if (next.cuff === "band" && cuttingGarment.partCloths?.includes("cuff"))
      setCutting({ garmentId: cuttingGarment.id, region: "cuff" });
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

  /** Button the dress being cut in one row or two — resolved when read, see `buttonRowsOf`. */
  const chooseButtonRows = (rows: ButtonRowsId) => {
    if (!cuttingGarment) return;
    setOutfit((o) => ({ ...o, worn: setButtonRows(o.worn, cuttingGarment.id, rows) }));
  };

  /** Belt the dress being cut — resolved when read, see `beltOf`. */
  const chooseBelt = (belt: BeltId) => {
    if (!cuttingGarment) return;
    setOutfit((o) => ({ ...o, worn: setBelt(o.worn, cuttingGarment.id, belt) }));
  };

  /** Tie the sash of the dress being cut somewhere else — at the front, or at her side. */
  const chooseBowAt = (at: BowAtId) => {
    if (!cuttingGarment) return;
    setOutfit((o) => ({ ...o, worn: setBowAt(o.worn, cuttingGarment.id, at) }));
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

  /**
   * Put on a ready-made look: the whole design, in its own cloths, as one
   * step undo takes back. The skin tone stays, and the other mannequin keeps
   * what it wore; the stage shows the whole figure, and the fabrics start at
   * the whole of each garment.
   */
  const wearLook = (look: Look) => {
    const lookWorn = look.worn();
    setOutfit((o) => ({ ...o, worn: lookWorn, direction: 0 }));
    const first = garmentById(lookWorn[0].garmentId)!;
    setCutting({ garmentId: first.id, region: first.fabricRegions[0] });
    setFabricPart({});
    setView(WHOLE_VIEW);
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
    setView(WHOLE_VIEW);
    setFabricPart({});
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
  const [measuredPx, setStagePx] = useState(0);
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setStagePx(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [subject, isOpen, isDesktop]);

  /*
    Whether zooming in would show something not showing now — see
    `zoomWouldShow`: a print too small to read where it is, or a surface's
    detail (a denim's streaks, a knit's columns, a wool's flecks) the closest
    view draws. Every print and surface is drawn at its true size whatever
    the zoom, softened where it is only a few pixels across (see
    `printScale.ts`), so when one in view is, and the closest zoom would bring
    it out, say so. Never over a plain cloth with nothing more to show, and
    never where even 8× would not show it — a knit's columns on a phone.
  */
  const smallPrint = useMemo(() => {
    // the phone's stage is drawn at a scale (see `renderScale`): its width on screen
    const stagePx = !isDesktop && shown ? shown.box.width : measuredPx;
    if (stagePx <= 0) return false;
    // what the stage showing frames: desktop's zoom, focus and drag, or the phone's view
    const [z, at, moved]: [number, readonly [number, number] | undefined, readonly [number, number]] = isDesktop
      ? [zoom, focus, pan]
      : [view.zoom, view.centre ?? undefined, [0, 0]];
    const [cmPerUnit, pxPerUnit, mostPxPerUnit, inView] =
      subject === "wardrobe"
        ? [
            BODY_CANVAS.cmPerUnit,
            stagePx / frameFor(z, at, moved, viewport).w,
            stagePx / frameFor(MOST_ZOOM, at, moved, viewport).w,
            Object.values(outfitFabrics).flatMap((regions) => Object.values(regions)),
          ]
        : [
            product.cmPerUnit,
            stagePx / (PRODUCT_CANVAS[0] / Math.max(1, zoom)),
            stagePx / (PRODUCT_CANVAS[0] / MOST_ZOOM),
            Object.values(partFabrics),
          ];
    return inView.some((f) => f !== undefined && zoomWouldShow(f, pxPerUnit / cmPerUnit, mostPxPerUnit / cmPerUnit));
  }, [measuredPx, shown, subject, zoom, focus, pan, viewport, outfitFabrics, product, partFabrics, isDesktop, view]);

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

  /*
    The phone's stage, moved by hand: one finger drags a close-up, two pinch.
    Either is shown as the GPU moving and scaling the picture already drawn —
    the box it is drawn in is a layer of its own — so it follows the fingers
    without a redraw; the stage is drawn again once, sharp, when they lift.
    Either is the viewer's own view, which the categories then leave alone
    (`stageView.ts`).
  */
  const fingers = useRef(new Map<number, [number, number]>());
  const pinch = useRef<{ d0: number; m0: [number, number]; m1: [number, number]; k: number } | null>(null);
  const slide = useRef<{ start: [number, number]; at: [number, number] } | null>(null);
  /** The view a gesture started from: what is drawn. */
  const gestureFrom = useRef<Shown | null>(null);
  const stagePoint = (e: React.PointerEvent<HTMLElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  /* the controls floating on the stage take their own taps */
  const onControl = (e: React.PointerEvent) => !!(e.target as Element).closest?.("button, a, input, [role=group], [role=menu]");
  /* the box moved and scaled — `t` as the picture on screen goes, the box's own drawing scale undone */
  const moveTo = (t: { k: number; tx: number; ty: number }) => {
    if (moverRef.current) moverRef.current.style.transform = cssTransform({ ...t, k: t.k / renderScale });
  };
  /* where the gesture leaves the view: drawn there sharp once — see the transition below */
  const gestureEnd = () => {
    const from = gestureFrom.current;
    const pz = pinch.current;
    const sl = slide.current;
    gestureOn.current = false;
    gestureFrom.current = null;
    pinch.current = null;
    slide.current = null;
    if (!from) return;
    const next = pz
      ? pz.k !== 1 || pz.m1[0] !== pz.m0[0] || pz.m1[1] !== pz.m0[1]
        ? movedView(from.view, from.viewport, pz.m0, pz.m1, pz.k)
        : null
      : sl && (sl.at[0] !== sl.start[0] || sl.at[1] !== sl.start[1])
        ? movedView(from.view, from.viewport, sl.start, sl.at, 1)
        : null;
    if (next) setView(next);
    else moveTo({ k: 1, tx: 0, ty: 0 });
  };

  const onTouchDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (onControl(e) || (e.pointerType === "mouse" && e.button !== 0)) return;
    // a pointer the browser does not know — a scripted one — has nothing to capture, and WebKit throws for it
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* nothing to capture */
    }
    fingers.current.set(e.pointerId, stagePoint(e));
    if (!shown) return;
    const base = viewport && stageBox ? { view, viewport, box: stageBox } : shown;
    if (fingers.current.size === 2) {
      const [a, b] = [...fingers.current.values()];
      const m: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      gestureOn.current = true;
      // a step to a new view still under way: the gesture starts from where it was going
      if (base.view !== shown.view || base.viewport !== shown.viewport) setShown(base);
      gestureFrom.current = base;
      pinch.current = { d0: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, m0: m, m1: m, k: 1 };
      slide.current = null;
    } else if (fingers.current.size === 1 && view.zoom > 1.001) {
      gestureOn.current = true;
      if (base.view !== shown.view || base.viewport !== shown.viewport) setShown(base);
      gestureFrom.current = base;
      const p = stagePoint(e);
      slide.current = { start: p, at: p };
    }
  };

  const onTouchMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!fingers.current.has(e.pointerId)) return;
    fingers.current.set(e.pointerId, stagePoint(e));
    const pz = pinch.current;
    const from = gestureFrom.current;
    if (pz && from && fingers.current.size >= 2) {
      const [a, b] = [...fingers.current.values()];
      const m: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      // no closer than the closest zoom, no further out than the whole figure
      const k = Math.min(MOST_ZOOM / from.view.zoom, Math.max(1 / from.view.zoom, Math.hypot(a[0] - b[0], a[1] - b[1]) / pz.d0));
      pz.m1 = m;
      pz.k = k;
      moveTo({ k, tx: m[0] - pz.m0[0] * k, ty: m[1] - pz.m0[1] * k });
      return;
    }
    const sl = slide.current;
    if (!sl) return;
    sl.at = stagePoint(e);
    moveTo({ k: 1, tx: sl.at[0] - sl.start[0], ty: sl.at[1] - sl.start[1] });
  };

  const onTouchEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    fingers.current.delete(e.pointerId);
    // a pinch ends when either finger lifts; the one still down starts nothing until it lifts too
    if (pinch.current && fingers.current.size < 2) gestureEnd();
    else if (slide.current && fingers.current.size === 0) gestureEnd();
  };

  /*
    The step to a new view — or to a new size of stage: the picture already
    drawn moved and scaled there at once by the GPU, and once that frame is on
    screen, the new view drawn sharp. Nothing waits on it: the panel answers
    first, then the soft picture, then the sharp one.
  */
  useLayoutEffect(() => {
    if (isDesktop || !isOpen || !viewport || !stageBox) return;
    if (!shown) {
      setShown({ view, viewport, box: stageBox });
      return;
    }
    if (gestureOn.current) return;
    if (shown.view === view && shown.viewport === viewport) {
      // where it should be: a stage a fraction of a pixel taller or shorter only resizes the box with it
      if (shown.box.width !== stageBox.width || shown.box.height !== stageBox.height) setShown({ ...shown, box: stageBox });
      return;
    }
    moveTo(transformBetween(shown, { view, viewport }));
    let live = true;
    requestAnimationFrame(() =>
      setTimeout(() => {
        if (live) startTransition(() => setShown({ view, viewport, box: stageBox }));
      }, 0)
    );
    return () => {
      live = false;
    };
  }, [isDesktop, isOpen, view, viewport, stageBox, shown]);

  /* the new view drawn, or the box drawn at another scale: back where it belongs — or, a step still under way, where its soft picture goes */
  useLayoutEffect(() => {
    if (gestureOn.current || !shown) return;
    moveTo(!viewport || (shown.view === view && shown.viewport === viewport) ? { k: 1, tx: 0, ty: 0 } : transformBetween(shown, { view, viewport }));
    // the drawn view and the scale it is drawn at; a step to a new view sets its own soft picture
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, renderScale]);

  /*
    A new figure while zoomed in: drawn quick, in the frame it arrives in —
    set before the browser paints — then sharp once that frame is on screen.
  */
  const lastFigure = useRef<{ outfit: unknown; fabrics: unknown } | null>(null);
  useLayoutEffect(() => {
    const was = lastFigure.current;
    lastFigure.current = { outfit: stageOutfit, fabrics: stageFabrics };
    if (!was || isDesktop || !shown || shown.view.zoom <= 1.001) return;
    if (was.outfit !== stageOutfit || was.fabrics !== stageFabrics) setQuickFor({});
    // only a new figure
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageOutfit, stageFabrics]);
  useEffect(() => {
    if (!quickFor) return;
    let live = true;
    requestAnimationFrame(() =>
      setTimeout(() => {
        if (live) startTransition(() => setQuickFor(null));
      }, 0)
    );
    return () => {
      live = false;
    };
  }, [quickFor]);

  /* Safari's own pinch would zoom the page under the stage */
  useEffect(() => {
    if (isDesktop || !stageEl) return;
    const stop = (e: Event) => e.preventDefault();
    stageEl.addEventListener("gesturestart", stop);
    return () => stageEl.removeEventListener("gesturestart", stop);
  }, [isDesktop, stageEl]);

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
  /* one row or two, buttoned to the waist on a cut that takes two */
  const rowChoices = cuttingEntry ? buttonRowsFor(buttonRowsOffered(cuttingEntry.worn)) : [];
  const wornRows = cuttingEntry ? buttonRowsOf(cuttingEntry.worn) : undefined;
  const beltChoices = cuttingGarment ? beltsFor(cuttingGarment, cutNow) : [];
  const wornBelt = cuttingEntry ? beltOf(cuttingEntry.worn) : undefined;
  const showBelt = beltChoices.length > 1 && wornBelt !== undefined;
  /* a sash's bow: where it is tied, on a cut that lets it be tied anywhere */
  const bowPlaces = cuttingEntry ? bowPlacesFor(bowPlacesOf(cuttingEntry.worn)) : [];
  const wornBowAt = cuttingEntry ? bowAtOf(cuttingEntry.worn) : undefined;

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
  const tieChoices = cuttingEntry && cuttingGarment ? tiesFor(tiesOffered(cuttingEntry.worn), cuttingGarment.gender) : [];
  const wornTie = cuttingEntry ? tieOf(cuttingEntry.worn) : undefined;
  const tiePlaces = cuttingEntry && wornTie && wornTie !== "none" ? tiePlacesFor(tiePlacesOf(cuttingEntry.worn, wornTie)) : [];
  const wornTieAt = cuttingEntry ? tieAtOf(cuttingEntry.worn) : undefined;

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
    /** Nothing added — no collar, no tie, no belt: left out of the feedback email's design line. */
    none?: boolean;
    body: React.ReactNode;
    /** The same choice on a phone: picture cards, or a few words, and what goes with it — see `PhoneLayout`. */
    phone?: Omit<PhoneCategory, "id" | "label">;
  }
  /* an option's picture on the garment being cut, when one has been made */
  const pic = (kind: PictureKind, id?: string): { src: string } | undefined => {
    const src = cuttingGarment ? pictureSrc(cuttingGarment.id, kind, id) : undefined;
    return src ? { src } : undefined;
  };
  /* a choice's words, for the phone's buttons */
  const words = <T extends string>(list: { id: T; name: { en: string; ar: string } }[]) => list.map((c) => ({ id: c.id as string, label: pick(c.name) }));
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
      phone: {
        cards: necklineChoices.map((n) => ({ id: n.id, label: pick(n.name), active: wornNecklineId === n.id, onPick: () => chooseNeckline(n.id), picture: pic("neckline", n.id) })),
        hint: t("viz.necklineHint"),
      },
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
      phone: {
        cards: sleeveChoices.map((id) => ({ id, label: pick(sleeveTypeName(cuttingGarment, id)), active: wornSleeve.type === id, onPick: () => chooseSleeve({ type: id }), picture: pic("sleeve", id) })),
        ...(sleeveLengths.length > 1
          ? {
              follow: {
                label: t("viz.sleeveLength"),
                choices: sleeveLengths.map((id) => ({ id: id as string, label: pick(sleeveLengthById(id)!.name) })),
                active: wornSleeve.length,
                onPick: (id: string) => chooseSleeve({ length: id as SleeveChoice["length"] }),
              },
            }
          : { hint: t("viz.sleeveHint") }),
      },
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
      phone: (() => {
        const lengths = { label: t("viz.length"), choices: words(skirtLengthChoices), active: wornSkirt.length as string, onPick: (length: string) => chooseSkirt({ length: length as SkirtChoice["length"] }) };
        if (!shapeIcons) return { main: lengths };
        return {
          cards: skirtShapeChoices.map((shape, i) => ({
            id: shape.id,
            label: pick(shape.name),
            active: wornSkirt.shape === shape.id,
            onPick: () => chooseSkirt({ shape: shape.id }),
            picture: { node: <Silhouette pieces={shapeIcons.pieces[i]} box={shapeIcons.box} className={cn("h-[68px] w-full", wornSkirt.shape === shape.id ? "text-apricot-500" : "text-muted-foreground")} /> },
          })),
          ...(skirtLengthChoices.length > 1 ? { follow: lengths } : {}),
        };
      })(),
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
      phone: { main: { label: t("viz.waist"), choices: words(waistChoices), active: (wornSkirt.waist ?? waistChoices[0].id) as string, onPick: (waist: string) => chooseSkirt({ waist: waist as SkirtChoice["waist"] }) } },
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
      phone: { main: { label: t("viz.front"), choices: words(frontChoices), active: wornFront, onPick: (f: string) => chooseFront(f as FrontId) } },
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
      phone: {
        cards: legChoices.map((leg, i) => ({
          id: leg.id,
          label: pick(leg.name),
          active: wornLeg === leg.id,
          onPick: () => chooseLeg(leg.id),
          picture: { node: <Silhouette pieces={legIcons.pieces[i]} box={legIcons.box} className={cn("h-[68px] w-full", wornLeg === leg.id ? "text-apricot-500" : "text-muted-foreground")} /> },
        })),
      },
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
      none: !wornCollar,
      region: wornCollar ? "collar" : "top",
      phone: {
        cards: [
          { id: "none", label: t("viz.noCollar"), active: !wornCollarId, onPick: () => chooseCollar(undefined), picture: pic("collar", "none") },
          ...collarChoices.map((c) => ({ id: c.id, label: pick(c.name), active: wornCollarId === c.id, onPick: () => chooseCollar(c.id), picture: pic("collar", c.id) })),
        ],
        hint: t("viz.collarHint"),
      },
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
      none: wornStripes === "none",
      region: wornStripesOn.length > 0 ? "trim" : undefined,
      phone: {
        main: { label: t("viz.stripes"), choices: words(stripeChoices), active: wornStripes, onPick: (n: string) => chooseStripes(n as StripesId) },
        ...(wornStripes !== "none"
          ? { follow: { label: t("viz.stripesAt"), choices: words(stripeEdges), active: wornStripesOn as string[], onPick: (edge: string) => toggleStripes(edge as StripeEdgeId) } }
          : {}),
      },
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
  /* a tie: which, and where it is knotted — at the neck, or on a fabric belt */
  if (subject === "wardrobe" && tieChoices.length > 1 && wornTie) {
    extraRows.push({
      id: "tie",
      label: t("viz.tie"),
      value: [named(tieChoices, wornTie), ...(tiePlaces.length > 1 && wornTieAt ? [named(tiePlaces, wornTieAt)] : [])].join(" · "),
      none: wornTie === "none",
      region: wornTie !== "none" ? "tie" : undefined,
      phone: {
        cards: tieChoices.map((c) => ({ id: c.id, label: pick(c.name), active: wornTie === c.id, onPick: () => chooseTie(c.id), picture: pic("tie", c.id) })),
        ...(tiePlaces.length > 1 && wornTieAt
          ? { follow: { label: t("viz.tieAt"), choices: words(tiePlaces), active: wornTieAt, onPick: (at: string) => chooseTieAt(at as TieAtId) } }
          : {}),
      },
      body: (
        <>
          <Segmented label={t("viz.tie")} choices={tieChoices.map((c) => ({ id: c.id, label: pick(c.name) }))} active={wornTie} onPick={chooseTie} />
          {tiePlaces.length > 1 && wornTieAt && (
            <>
              <RowHeading>{t("viz.tieAt")}</RowHeading>
              <Segmented label={t("viz.tieAt")} choices={tiePlaces.map((c) => ({ id: c.id, label: pick(c.name) }))} active={wornTieAt} onPick={chooseTieAt} />
            </>
          )}
        </>
      ),
    });
  }
  /* a dress's buttons down its front, on a cut with a straight centre front */
  if (showButtons && wornButtons) {
    extraRows.push({
      id: "buttons",
      label: t("viz.buttons"),
      value: [named(buttonChoices, wornButtons), ...(rowChoices.length > 1 && wornRows ? [named(rowChoices, wornRows)] : [])].join(" · "),
      none: wornButtons === "none",
      region: "top",
      phone: {
        main: { label: t("viz.buttons"), choices: words(buttonChoices), active: wornButtons, onPick: (b: string) => chooseButtons(b as ButtonsId) },
        ...(rowChoices.length > 1 && wornRows
          ? { follow: { label: t("viz.buttonRows"), choices: words(rowChoices), active: wornRows, onPick: (r: string) => chooseButtonRows(r as ButtonRowsId) } }
          : {}),
      },
      body: (
        <>
          <Segmented label={t("viz.buttons")} choices={buttonChoices.map((b) => ({ id: b.id, label: pick(b.name) }))} active={wornButtons} onPick={chooseButtons} />
          {rowChoices.length > 1 && wornRows && (
            <>
              <RowHeading>{t("viz.buttonRows")}</RowHeading>
              <Segmented label={t("viz.buttonRows")} choices={rowChoices.map((r) => ({ id: r.id, label: pick(r.name) }))} active={wornRows} onPick={chooseButtonRows} />
            </>
          )}
        </>
      ),
    });
  }
  /* a belt on its waist seam, a dress's: none, its own cloth, leather, or a sash — and where a sash is tied */
  if (subject === "wardrobe" && showBelt && wornBelt) {
    extraRows.push({
      id: "belt",
      label: t("viz.belt"),
      value: [named(beltChoices, wornBelt), ...(bowPlaces.length > 1 && wornBowAt ? [named(bowPlaces, wornBowAt)] : [])].join(" · "),
      none: wornBelt === "none",
      region: "bottom",
      phone: {
        cards: beltChoices.map((b) => ({ id: b.id, label: pick(b.name), active: wornBelt === b.id, onPick: () => chooseBelt(b.id), picture: pic("belt", b.id) })),
        ...(bowPlaces.length > 1 && wornBowAt
          ? { follow: { label: t("viz.bowAt"), choices: words(bowPlaces), active: wornBowAt, onPick: (at: string) => chooseBowAt(at as BowAtId) } }
          : {}),
      },
      body: (
        <>
          <div role="group" aria-label={t("viz.belt")} className="flex flex-wrap gap-2">
            {beltChoices.map((b) => (
              <Chip key={b.id} label={pick(b.name)} active={wornBelt === b.id} onClick={() => chooseBelt(b.id)} />
            ))}
          </div>
          {bowPlaces.length > 1 && wornBowAt && (
            <>
              <RowHeading>{t("viz.bowAt")}</RowHeading>
              <Segmented label={t("viz.bowAt")} choices={bowPlaces.map((c) => ({ id: c.id, label: pick(c.name) }))} active={wornBowAt} onPick={chooseBowAt} />
            </>
          )}
        </>
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
      none: !wornSleeve.cuff || wornSleeve.cuff === "none",
      region: "top",
      phone: {
        cards: cuffChoices.map((id) => ({ id, label: pick(sleeveCuffById(id)!.name), active: wornSleeve.cuff === id, onPick: () => chooseSleeve({ cuff: id }), picture: pic("cuff", id) })),
      },
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
          <FabricPicker
            fabrics={offeredFabrics}
            activeId={activeFabric.id}
            onPick={cutRegion}
            filter={fabricFilter}
            onFilter={setFabricFilter}
            swatchPx={44}
          />
          <RowHint>
            {t(`material.${activeFabric.material}`)} · {t("card.sample")} · {t("viz.repeat")}:{" "}
            <span className="font-semibold text-foreground">
              {fabricRepeatCm(activeFabric).toFixed(1)} {t("unit.cm")}
            </span>
            {activeFabric.suits.length > 0 && (
              <>
                <br />
                {t("card.suits")}: {suitsNames(activeFabric).map(pick).join(locale === "ar" ? "، " : ", ")}
              </>
            )}
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

  /*
    The line a feedback email opens with (lib/feedback.ts): what is on the
    figure — the garments, the main parts of the one being edited as its rows
    name them, and every part's fabric — so a tester's words come with what
    they were looking at.
  */
  const designLine = (() => {
    const [sep, comma] = locale === "ar" ? ["؛ ", "، "] : ["; ", ", "];
    const parts = [...cutRows, ...extraRows].filter((r) => r.value && !r.none).map((r) => `${r.label}: ${r.value}`);
    const what =
      subject === "wardrobe"
        ? worn
            .map(({ garment }) =>
              garment.id === cuttingGarment?.id && parts.length > 0 ? `${pick(garment.name)} (${parts.join(sep)})` : pick(garment.name)
            )
            .join(" + ")
        : pick(product.label);
    const cloths = fabricRows.map((r) => `${r.label}: ${pick(r.fabric.name)}`).join(comma);
    return `${t("feedback.design")}: ${what} — ${t("viz.tabFabrics")}: ${cloths}`;
  })();

  const TABS: { id: PanelTab; label: string }[] = [
    { id: "cut", label: t("viz.tabCut") },
    { id: "extras", label: t("viz.tabExtras") },
    { id: "fabrics", label: t("viz.tabFabrics") },
  ];

  /*
    The phone panel: each group's categories — the garments first, then the
    rows above, each as picture cards or a few words — the one open, and the
    way on from it, «التالي».
  */
  const piecesCat: PhoneCategory = {
    id: "pieces",
    label: t("viz.pieces"),
    cards: wardrobe.map((g) => ({
      id: g.id,
      label: pick(g.name),
      active: isWearing(outfit.worn, g.id),
      onPick: () => toggleGarment(g.id),
      picture: (() => {
        const src = pictureSrc(g.id, "garment");
        return src ? { src } : undefined;
      })(),
    })),
    hint: t("viz.layersHint"),
  };
  /* the ready-made looks for the mannequin on the stage — starting again as their first card */
  const looksCat: PhoneCategory = {
    id: "looks",
    label: t("viz.looks"),
    cards: looksFor(outfit.bodyType).map((look) => ({
      id: look.id,
      label: pick(look.name),
      active: lookNow === look.id,
      onPick: () => wearLook(look),
      picture: (() => {
        const src = pictureSrc(look.body, "look", look.id);
        return src ? { src } : undefined;
      })(),
    })),
    hint: t("viz.looksHint"),
    reset: { label: t("viz.reset"), confirm: t("viz.confirm"), cancel: t("viz.cancel"), onConfirm: reset },
  };
  const asCats = (rows: RowSpec[]): PhoneCategory[] => rows.flatMap((r) => (r.phone ? [{ id: r.id, label: r.label, ...r.phone }] : []));
  const phoneCats: Record<"cut" | "extras", PhoneCategory[]> = {
    cut: subject === "wardrobe" ? [looksCat, piecesCat, ...asCats(cutRows)] : [],
    extras: subject === "wardrobe" ? asCats(extraRows) : [],
  };
  const cats = tab === "fabrics" ? [] : phoneCats[tab];
  const catNow = cats.find((c) => c.id === phoneCat[tab])?.id ?? cats[0]?.id;
  /* a collar's close-up centres on the collar's own drawing */
  const ownFocus = catNow === "collar" && cuttingGarment && cuttingEntry && wornCollar ? focusOf(cuttingGarment, cuttingEntry.worn, "collar") : undefined;

  /* a category chosen — by a tap, by «التالي», or by another garment not having the last one — frames its part */
  useEffect(() => {
    if (isDesktop) return;
    setView((v) => viewForPart(v, tab === "fabrics" ? null : partView(catNow ?? "", outfit.bodyType, ownFocus)));
    // the category, not every recut: a new collar on the same category leaves the view where it is
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop, tab, catNow, cutting.garmentId, outfit.bodyType]);

  /* choosing a category also points the fabrics at what it is about, as opening a row does on desktop */
  const chooseCat = (id: string) => {
    setPhoneCat((c) => ({ ...c, [tab]: id }));
    const row = [...cutRows, ...extraRows].find((r) => r.id === id);
    if (row?.region && cuttingEntry && regionsOf(cuttingEntry.garment, cuttingEntry.worn).includes(row.region)) {
      setCutting({ garmentId: cuttingEntry.garment.id, region: row.region });
    }
  };
  const nextStep = (() => {
    if (tab === "fabrics") return null;
    const i = cats.findIndex((c) => c.id === catNow);
    if (i >= 0 && i < cats.length - 1) {
      const n = cats[i + 1];
      return { label: n.label, go: () => chooseCat(n.id) };
    }
    const after: PanelTab = tab === "cut" && phoneCats.extras.length > 0 ? "extras" : "fabrics";
    return { label: TABS.find((x) => x.id === after)!.label, go: () => setTab(after) };
  })();
  /* the zoom button: in a step, from where it is looking — from the whole figure, toward the part being chosen */
  const zoomStep = () =>
    setView((v) => {
      const z = nextZoom(v.zoom);
      if (z <= 1) return WHOLE_VIEW;
      const part = v.zoom <= 1.001 ? partView(catNow ?? "", outfit.bodyType, ownFocus) : null;
      const centre = part ? part.focus : viewport ? centreOf(frameOf(v, viewport)) : v.centre;
      return { zoom: z, centre, by: "viewer" };
    });

  /*
    The phone's fabrics: the garment being edited — the whole of it first,
    «الفستان كله», then each of its parts — and what the swatches cut.
  */
  const fabricsOn = cuttingEntry;
  const partsOn = fabricsOn ? regionsOf(fabricsOn.garment, fabricsOn.worn) : [];
  const wholeOn = fabricsOn ? offersWhole(fabricsOn.garment, fabricsOn.worn) : false;
  const partOn = (() => {
    if (!fabricsOn) return undefined;
    const want = fabricPart[fabricsOn.garment.id];
    if (want === "whole" && wholeOn) return "whole";
    if (want && partsOn.includes(want as FabricRegionId)) return want;
    return wholeOn ? "whole" : partsOn[0];
  })();
  const regionOn = (partOn === "whole" ? partsOn[0] : partOn) as FabricRegionId | undefined;
  const phoneFabric = (fabricsOn && regionOn && outfitFabrics[fabricsOn.garment.id]?.[regionOn]) || fabric;
  const choosePart = (id: string) => {
    if (!fabricsOn) return;
    setFabricPart((p) => ({ ...p, [fabricsOn.garment.id]: id }));
    setCutting({ garmentId: fabricsOn.garment.id, region: (id === "whole" ? partsOn[0] : id) as FabricRegionId });
  };
  const cutPart = (f: Fabric) => {
    if (!fabricsOn || !partOn) return;
    const g = fabricsOn.garment;
    setOutfit((o) => ({
      ...o,
      worn: o.worn.map((w) =>
        w.garmentId !== g.id ? w : partOn === "whole" ? wearWhole(w, g, f.id) : { ...w, fabrics: { ...w.fabrics, [partOn]: f.id } }
      ),
    }));
    setFabric(f);
  };
  const editingSwitch =
    subject === "wardrobe" && worn.length > 1
      ? {
          label: t("viz.editing"),
          choices: worn.map(({ garment }) => ({ id: garment.id, label: pick(garment.name) })),
          active: cutting.garmentId,
          onPick: (id: string) => {
            const g = garmentById(id);
            if (g) setCutting({ garmentId: g.id, region: g.fabricRegions[0] });
          },
        }
      : null;
  const phoneFabrics =
    subject === "wardrobe" && fabricsOn ? (
      <PhoneFabrics
        editing={editingSwitch}
        parts={[
          ...(wholeOn ? [{ id: "whole", label: pick(WHOLE_NAMES[fabricsOn.garment.id]), active: partOn === "whole", onPick: () => choosePart("whole") }] : []),
          ...partsOn.map((r) => ({
            id: r,
            label: partsOn.length > 1 ? pick(regionLabel(r)) : pick(fabricsOn.garment.name),
            active: partOn === r,
            onPick: () => choosePart(r),
          })),
        ]}
        fabrics={offeredFabrics}
        activeId={phoneFabric.id}
        onPick={cutPart}
        filter={fabricFilter}
        onFilter={setFabricFilter}
        about={{
          name: pick(phoneFabric.name),
          // its type, unless its name says it already — «ساتان شمبانيا» — then its repeat
          detail: [
            pick(phoneFabric.name).includes(t(`material.${phoneFabric.material}`)) ? null : t(`material.${phoneFabric.material}`),
            `${t("viz.repeat")} ${fabricRepeatCm(phoneFabric).toFixed(1)} ${t("unit.cm")}`,
          ]
            .filter(Boolean)
            .join(" · "),
          suits:
            phoneFabric.suits.length > 0
              ? `${t("card.suits")}: ${suitsNames(phoneFabric).map(pick).join(locale === "ar" ? "، " : ", ")}`
              : undefined,
        }}
        direction={
          fabricHasDirection(phoneFabric)
            ? {
                label: t("viz.rotation"),
                choices: GRAIN_PRESETS.map((d) => ({ id: String(d), label: t(GRAIN_LABELS[d]) })),
                active: String(direction),
                onPick: (id: string) => setDirection(Number(id)),
              }
            : null
        }
      />
    ) : (
      fabricsList
    );

  if (!isOpen) return null;

  if (!isDesktop) {
    return (
      <div role="dialog" aria-modal="true" aria-label={t("viz.title")} dir={dir} className="fixed inset-0 z-[100] h-[100dvh] animate-fade-in bg-background">
        <PublishDesign line={designLine} />
        <PhoneLayout
          title={t("viz.title")}
          stage={
            subject === "wardrobe" ? (
              <MannequinStage
                ref={stageRef}
                outfit={stageOutfit}
                fabrics={stageFabrics}
                zoom={shown?.view.zoom ?? 1}
                focus={shown?.view.centre ?? undefined}
                viewport={shown?.viewport ?? null}
                shownWidth={shown?.box.width}
                sharpWidth={shown ? shown.box.width * sharpScale : undefined}
                className={cn("absolute inset-0 z-10 h-full w-full text-foreground", !shown && "invisible")}
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
                className="absolute inset-0 z-10 m-auto h-full max-h-[440px] w-full max-w-[440px] text-foreground"
              />
            )
          }
          setStageEl={setStageEl}
          moverRef={moverRef}
          moverSize={shown ? shown.box : null}
          moverScale={renderScale}
          gestures={{ onPointerDown: onTouchDown, onPointerMove: onTouchMove, onPointerUp: onTouchEnd, onPointerCancel: onTouchEnd }}
          zoom={view.zoom}
          narrow={(stageSize?.width ?? 390) < 380}
          onZoom={zoomStep}
          onWhole={() => setView(WHOLE_VIEW)}
          note={smallPrint ? "zoomToSee" : view.zoom > 1.001 ? "drag" : "trueScale"}
          body={
            subject === "wardrobe"
              ? { label: t("viz.body"), bodies: bodyTypes.map((b) => ({ id: b.id, label: pick(b.label) })), active: outfit.bodyType, onPick: (id) => setBody(id as BodyType) }
              : null
          }
          skin={
            subject === "wardrobe"
              ? {
                  label: t("viz.skinTone"),
                  tones: skinTones.map((s) => ({ id: s.id, label: pick(s.label), color: s.color })),
                  active: outfit.skinTone,
                  onPick: (id) => setOutfit((o) => ({ ...o, skinTone: id as Outfit["skinTone"] })),
                }
              : null
          }
          undo={undo}
          redo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          share={share}
          exporting={exporting}
          close={close}
          full={full}
          onFull={enterFull}
          onBack={leaveFull}
          tabs={TABS}
          tab={tab}
          onTab={setTab}
          categories={cats}
          category={catNow}
          onCategory={chooseCat}
          editing={editingSwitch}
          next={nextStep}
          empty={t("viz.noExtras")}
          fabrics={phoneFabrics}
        />
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("viz.title")}
      dir={dir}
      className="fixed inset-0 z-[100] flex items-stretch justify-center animate-fade-in"
    >
      <PublishDesign line={designLine} />
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
              aria-label={t("viz.saveImage")}
              className="btn-focus inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-border px-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-60 sm:px-4"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              <span className="hidden sm:inline">{t("viz.saveImage")}</span>
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
                  max={MOST_ZOOM}
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
                  {t("viz.saveImage")}
                </Button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

/** Whether desktop's layout is showing: 1024 px wide or more. The server renders nothing here (the sheet is closed), so its answer never shows. */
function useIsDesktop() {
  return useSyncExternalStore(
    (changed) => {
      const m = window.matchMedia(DESKTOP);
      m.addEventListener("change", changed);
      return () => m.removeEventListener("change", changed);
    },
    () => window.matchMedia(DESKTOP).matches,
    () => true
  );
}

/**
 * An element's size in CSS pixels, once it has been laid out — `null` until
 * then. Takes the element itself, not a ref, so it notices an element that
 * mounts after the component does (the sheet renders nothing while closed).
 */
function useElementSize(el: HTMLElement | null) {
  const [size, setSize] = useState<{ width: number; height: number; exact: { width: number; height: number } } | null>(
    null
  );

  useEffect(() => {
    if (!el || typeof ResizeObserver === "undefined") {
      setSize(null);
      return;
    }
    const ro = new ResizeObserver(([entry]) => {
      // Padding included: what is drawn into it is positioned against that box.
      const width = el.clientWidth;
      const height = el.clientHeight;
      // and to the fraction of a pixel those round away — what a box filling it must match (its content box)
      const exact = { width: entry.contentRect.width, height: entry.contentRect.height };
      setSize((prev) =>
        prev && prev.width === width && prev.height === height && prev.exact.width === exact.width && prev.exact.height === exact.height
          ? prev
          : width > 0 && height > 0
            ? { width, height, exact }
            : null
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);

  return size;
}

