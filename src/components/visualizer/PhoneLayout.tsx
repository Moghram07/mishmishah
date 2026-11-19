"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Maximize2,
  MessageCircle,
  Move,
  Palette,
  Redo2,
  RotateCcw,
  Ruler,
  Scissors,
  Sparkles,
  Undo2,
  X,
  ZoomIn,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { FeedbackEmail, FeedbackLink } from "@/components/feedback/Feedback";
import { cn } from "@/lib/utils/cn";
import { BodyButton, type PanelTab } from "./PanelControls";

/**
 * The visualizer on a phone, and on a tablet held upright — anything under
 * 1024 px wide; desktop keeps its own layout untouched.
 *
 * The figure stays in view at the top, over half the screen, with its
 * controls floating on it. Under it, one choice at a time: a row of
 * categories, one row of picture cards for the category chosen — tap one and
 * the figure changes — and the three groups as tabs at the bottom, where a
 * thumb is. Nothing in the panel scrolls up and down; a row of cards scrolls
 * sideways, from the right in Arabic. Every target is at least 44 px.
 */

export interface PhoneCard {
  id: string;
  label: string;
  active: boolean;
  onPick: () => void;
  /** A still of the option, or a drawing of it; without one the card shows its name alone. */
  picture?: { src: string } | { node: React.ReactNode };
}

export interface PhoneChoices {
  label: string;
  choices: { id: string; label: string }[];
  /** One pressed, or — for choices that each go on or off, the stripes' edges — any. */
  active: string | string[];
  onPick: (id: string) => void;
}

export interface PhoneCategory {
  /** The part it is about: what the stage zooms to (`stageView.ts`). */
  id: string;
  label: string;
  /** Picture cards — or, for two to four words, `main` instead. */
  cards?: PhoneCard[];
  main?: PhoneChoices;
  /** The second choice that goes with it: a sleeve's length, where a bow is tied. */
  follow?: PhoneChoices;
  /** Said under the cards when there is no second choice. */
  hint?: string;
  /**
   * Starting again, as the row's first card: easy to find, and hard to do by
   * mistake — a tap asks for a second, «تأكيد», before anything is cleared.
   */
  reset?: { label: string; confirm: string; cancel: string; onConfirm: () => void };
}

interface Props {
  title: string;
  /** The stage: the figure, and what it is measured and moved by. */
  stage: React.ReactNode;
  setStageEl: (el: HTMLDivElement | null) => void;
  gestures: {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void;
  };
  zoom: number;
  /** A stage too narrow for the way back to sit between the round buttons: it goes above them. */
  narrow: boolean;
  onZoom: () => void;
  onWhole: () => void;
  note: "trueScale" | "zoomToSee" | "drag";
  body: { label: string; bodies: { id: string; label: string }[]; active: string; onPick: (id: string) => void } | null;
  skin: { label: string; tones: { id: string; label: string; color: string }[]; active: string; onPick: (id: string) => void } | null;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Saves a picture of the design: the figure, and each part's fabric. */
  share: () => void;
  exporting: boolean;
  close: () => void;
  /** The panel. */
  tabs: { id: PanelTab; label: string }[];
  tab: PanelTab;
  onTab: (tab: PanelTab) => void;
  categories: PhoneCategory[];
  category: string | undefined;
  onCategory: (id: string) => void;
  /** Which garment the categories are for, when more than one is worn. */
  editing: PhoneChoices | null;
  next: { label: string; go: () => void } | null;
  /** Said when the group has nothing to offer the garment. */
  empty?: string;
  /** The fabrics group: `PhoneFabrics`. */
  fabrics: React.ReactNode;
}

const TAB_ICONS: Record<PanelTab, React.ReactNode> = {
  cut: <Scissors className="h-5 w-5" />,
  extras: <Sparkles className="h-5 w-5" />,
  fabrics: <Palette className="h-5 w-5" />,
};

/** A round button floating on the stage, a finger's size. */
const FLOAT =
  "btn-focus pointer-events-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border/60 bg-card/90 text-foreground shadow-soft hover:bg-card disabled:text-foreground/25";

/** Seen once: a visitor's first visit shows the skin tones open, so they find them. */
const SKIN_SEEN = "mishmishah:skin-tones-seen";

export function PhoneLayout(p: Props) {
  const { t, dir } = useI18n();
  const Forward = dir === "rtl" ? ChevronLeft : ChevronRight;
  const zoomed = p.zoom > 1.001;

  return (
    <div className="flex h-full w-full flex-col bg-background land:flex-row">
      {/* the stage: the figure, always in view */}
      <div
        ref={p.setStageEl}
        {...p.gestures}
        className="relative min-h-0 flex-1 touch-none select-none overflow-hidden bg-gradient-to-b from-muted/40 to-background"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-apricot-radial" />
        {p.stage}

        <div className="pointer-events-none absolute inset-0 z-20">
          {/* top, at the start: which mannequin, and what the picture is */}
          <div className="absolute start-3 top-3 flex flex-col items-start gap-2">
            {p.body && (
              <div className="pointer-events-auto">
                <BodyButton large label={p.body.label} bodies={p.body.bodies} active={p.body.active} onPick={p.body.onPick} />
              </div>
            )}
            <span className="inline-flex h-7 max-w-[11rem] items-center gap-1.5 whitespace-nowrap rounded-full bg-card/85 px-2.5 text-[11px] font-medium text-muted-foreground shadow-soft">
              {p.note === "zoomToSee" ? (
                <ZoomIn className="h-3.5 w-3.5 shrink-0 text-apricot-500" />
              ) : p.note === "drag" ? (
                <Move className="h-3.5 w-3.5 shrink-0 text-apricot-500" />
              ) : (
                <Ruler className="h-3.5 w-3.5 shrink-0 text-apricot-500" />
              )}
              <span className="truncate">
                {t(p.note === "zoomToSee" ? "viz.zoomToSee" : p.note === "drag" ? "viz.drag" : "viz.trueScaleShort")}
              </span>
            </span>
          </div>

          {/* top, at the end: share and close, and the beta and its feedback */}
          <div className="absolute end-3 top-3 flex flex-col items-end gap-2">
            <div className="flex gap-2">
              {/* it saves a picture of the design to the phone — said in words, not left to an arrow */}
              <button
                onClick={p.share}
                disabled={p.exporting}
                className="btn-focus pointer-events-auto inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-card/90 px-3.5 text-sm font-semibold text-foreground shadow-soft hover:bg-card disabled:text-foreground/40"
              >
                {p.exporting ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Download className="h-[18px] w-[18px]" />}
                {t("viz.saveImage")}
              </button>
              <button onClick={p.close} aria-label={t("viz.close")} title={t("viz.close")} className={FLOAT}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <BetaButton />
          </div>

          {/* bottom, at the start: undo and redo */}
          <div className="absolute bottom-3 start-3 flex gap-2">
            <button onClick={p.undo} disabled={!p.canUndo} aria-label={t("viz.undo")} title={t("viz.undo")} className={FLOAT}>
              <Undo2 className="h-5 w-5 rtl:-scale-x-100" />
            </button>
            <button onClick={p.redo} disabled={!p.canRedo} aria-label={t("viz.redo")} title={t("viz.redo")} className={FLOAT}>
              <Redo2 className="h-5 w-5 rtl:-scale-x-100" />
            </button>
          </div>

          {/* bottom, in the middle: the way back to the whole figure, whenever it is not all in view */}
          {zoomed && (
            <div className={cn("absolute inset-x-0 flex justify-center", p.narrow ? "bottom-[64px]" : "bottom-3")}>
              <button
                onClick={p.onWhole}
                className="btn-focus pointer-events-auto inline-flex h-11 items-center gap-2 rounded-full bg-foreground/90 px-4 text-sm font-semibold text-background shadow-lift"
              >
                <Maximize2 className="h-4 w-4" />
                {t("viz.wholeFigure")}
              </button>
            </div>
          )}

          {/* bottom, at the end: the skin tone, and the close-up */}
          <div className="absolute bottom-3 end-3 flex gap-2">
            {p.skin && <SkinButton {...p.skin} />}
            <button onClick={p.onZoom} aria-label={`${t("viz.zoom")}: ${zoomLabel(p.zoom)}`} title={t("viz.zoom")} className={cn(FLOAT, "text-xs font-bold tabular-nums")}>
              {/* «2×», never «×2»: a number and its sign read left to right in Arabic too */}
              <span dir="ltr">{zoomLabel(p.zoom)}</span>
            </button>
          </div>
        </div>
      </div>

      {/* the panel: one choice at a time, the groups at the bottom */}
      <section
        aria-label={p.title}
        className={cn(
          "flex shrink-0 flex-col border-t border-border bg-card land:h-auto land:w-[56%] land:border-s land:border-t-0",
          // the fabrics rise to two-thirds of the screen; the figure stays in view above them
          p.tab === "fabrics" && "h-[66.7%]"
        )}
      >
        <div
          role="tabpanel"
          id={`viz-panel-${p.tab}`}
          aria-labelledby={`viz-tab-${p.tab}`}
          className={cn("flex flex-col land:min-h-0 land:flex-1", p.tab === "fabrics" ? "min-h-0 flex-1" : "h-[236px] shrink-0")}
        >
          {p.tab === "fabrics" ? (
            p.fabrics
          ) : (
            <>
              <CategoryRow {...p} />
              <CategoryBody category={p.categories.find((c) => c.id === p.category)} empty={p.empty} next={p.next} Forward={Forward} />
            </>
          )}
        </div>
        <nav
          role="tablist"
          aria-label={p.title}
          className="grid shrink-0 grid-cols-3 border-t border-border bg-background"
          style={{ height: "calc(58px + env(safe-area-inset-bottom, 0px))", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          {p.tabs.map((tab) => {
            const on = tab.id === p.tab;
            return (
              <button
                key={tab.id}
                role="tab"
                id={`viz-tab-${tab.id}`}
                aria-selected={on}
                aria-controls={`viz-panel-${tab.id}`}
                onClick={() => p.onTab(tab.id)}
                className={cn(
                  "btn-focus flex flex-col items-center justify-center gap-0.5 text-[12px] font-semibold",
                  on ? "text-apricot-600 dark:text-apricot-400" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className={cn("inline-flex h-7 w-12 items-center justify-center rounded-full", on && "bg-apricot-500/15")}>
                  {TAB_ICONS[tab.id]}
                </span>
                {tab.label}
              </button>
            );
          })}
        </nav>
      </section>
    </div>
  );
}

const zoomLabel = (zoom: number) => `${Math.round(zoom * 10) / 10}×`;

/** The categories: the garment being edited first, when there is a choice of one; then each part. */
function CategoryRow({ categories, category, onCategory, editing }: Props) {
  const row = useRef<HTMLDivElement>(null);
  // the chosen one in view: «التالي» can choose one off the edge
  useLayoutEffect(() => {
    const el = row.current?.querySelector<HTMLElement>('[data-on="true"]');
    if (el && row.current) centreIn(row.current, el, false);
  }, [category]);
  return (
    <div ref={row} className="no-scrollbar flex h-[60px] shrink-0 items-center gap-2 overflow-x-auto px-3">
      {editing && (
        <div role="group" aria-label={editing.label} className="flex shrink-0 gap-1 rounded-full bg-muted/70 p-1">
          {editing.choices.map((c) => (
            <button
              key={c.id}
              onClick={() => editing.onPick(c.id)}
              aria-pressed={editing.active === c.id}
              className={cn(
                "btn-focus h-11 shrink-0 rounded-full px-3.5 text-sm font-semibold",
                editing.active === c.id ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
      {categories.map((c) => {
        const on = c.id === category;
        return (
          <button
            key={c.id}
            data-on={on}
            onClick={() => onCategory(c.id)}
            aria-pressed={on}
            className={cn(
              "btn-focus h-11 shrink-0 rounded-full border px-4 text-sm font-semibold",
              on ? "border-apricot-500 bg-apricot-500 text-white shadow-soft" : "border-border bg-background text-foreground hover:border-apricot-400"
            )}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

/** One category's choices: its cards (or a few words), then what goes with it, and the way on to the next. */
function CategoryBody({
  category,
  empty,
  next,
  Forward,
}: {
  category: PhoneCategory | undefined;
  empty?: string;
  next: Props["next"];
  Forward: typeof ChevronLeft;
}) {
  const { t } = useI18n();
  const strip = useRef<HTMLDivElement>(null);
  // a new category opens on what is chosen in it, in the middle — from the start of the row when that is the first
  useLayoutEffect(() => {
    const el = strip.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (strip.current) {
      if (el) centreIn(strip.current, el, false);
      else strip.current.scrollTo({ left: 0 });
    }
  }, [category?.id]);

  const nextChip = next && (
    <button
      onClick={next.go}
      className="btn-focus inline-flex h-11 shrink-0 items-center gap-1 self-center whitespace-nowrap rounded-full border border-dashed border-apricot-400/70 px-4 text-sm font-semibold text-apricot-700 hover:bg-apricot-500/10 dark:text-apricot-300"
    >
      {t("viz.next")}: {next.label}
      <Forward className="h-4 w-4" />
    </button>
  );

  if (!category) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-start justify-center gap-3 px-4">
        {empty && <p className="text-sm text-muted-foreground">{empty}</p>}
        {nextChip}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 pb-2">
      <div ref={strip} role="group" aria-label={category.label} className="no-scrollbar flex h-[124px] shrink-0 items-stretch gap-2 overflow-x-auto px-3">
        {category.reset && <ResetCard {...category.reset} />}
        {category.cards
          ? category.cards.map((card) => <Card key={card.id} card={card} />)
          : category.main && <BigChoices choices={category.main} />}
        {nextChip}
      </div>
      <div className="no-scrollbar flex h-11 shrink-0 items-center gap-2 overflow-x-auto px-3">
        {category.follow ? (
          <SmallChoices choices={category.follow} />
        ) : (
          category.hint && <p className="line-clamp-3 text-xs leading-[1.2] text-muted-foreground">{category.hint}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Starting again: the first card of the looks, easy to find. One tap only
 * asks — «تأكيد» or «إلغاء» — so a stray tap clears nothing; a tap anywhere
 * else, or a few seconds, puts it back. Even confirmed, it is one step undo
 * takes back.
 */
function ResetCard({ label, confirm, cancel, onConfirm }: NonNullable<PhoneCategory["reset"]>) {
  const [asking, setAsking] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!asking) return;
    const away = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setAsking(false);
    };
    document.addEventListener("pointerdown", away, true);
    const id = setTimeout(() => setAsking(false), 6000);
    return () => {
      document.removeEventListener("pointerdown", away, true);
      clearTimeout(id);
    };
  }, [asking]);
  return (
    <div ref={box} className="flex w-24 shrink-0">
      {asking ? (
        <div role="group" aria-label={label} className="flex w-full flex-col justify-center gap-1.5 rounded-2xl border-2 border-apricot-500 bg-apricot-500/5 p-1.5">
          <button
            onClick={() => {
              setAsking(false);
              onConfirm();
            }}
            className="btn-focus inline-flex h-11 items-center justify-center gap-1 rounded-full bg-apricot-500 px-2 text-[13px] font-semibold text-white"
          >
            <RotateCcw className="h-4 w-4" />
            {confirm}
          </button>
          <button onClick={() => setAsking(false)} className="btn-focus h-11 rounded-full border border-border bg-background px-2 text-[13px] font-semibold text-foreground">
            {cancel}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAsking(true)}
          className="btn-focus flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border px-2 text-center text-[12.5px] font-semibold leading-tight text-muted-foreground hover:border-apricot-400 hover:text-foreground"
        >
          <RotateCcw className="h-5 w-5" />
          {label}
        </button>
      )}
    </div>
  );
}

/** A picture card: the option drawn, its name under it; the one chosen ringed and ticked. */
function Card({ card }: { card: PhoneCard }) {
  return (
    <button
      onClick={card.onPick}
      aria-pressed={card.active}
      className={cn(
        "btn-focus relative flex w-24 shrink-0 flex-col overflow-hidden rounded-2xl border-2 bg-background text-center",
        card.active ? "border-apricot-500" : "border-border hover:border-apricot-400"
      )}
    >
      <span className="relative flex h-20 w-full shrink-0 items-center justify-center bg-muted/50">
        {card.picture && "src" in card.picture ? (
          // a still, a few kilobytes, kept by the phone (see `optionPictures.ts`)
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.picture.src} alt="" width={96} height={80} loading="lazy" decoding="async" draggable={false} className="h-full w-full object-cover" />
        ) : card.picture ? (
          card.picture.node
        ) : null}
        {card.active && (
          <span className="absolute end-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-apricot-500 text-white shadow-soft">
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
        )}
      </span>
      <span className={cn("line-clamp-2 flex flex-1 items-center justify-center px-1 text-[12.5px] font-semibold leading-tight", card.active ? "text-foreground" : "text-muted-foreground")}>
        {card.label}
      </span>
    </button>
  );
}

const isOn = (c: PhoneChoices, id: string) => (Array.isArray(c.active) ? c.active.includes(id) : c.active === id);

/** Two to four words in place of cards: a waist, buttons, stripes — big, a finger's size. */
function BigChoices({ choices }: { choices: PhoneChoices }) {
  return (
    <div className="flex shrink-0 items-center gap-2 self-center">
      {choices.choices.map((c) => (
        <button
          key={c.id}
          onClick={() => choices.onPick(c.id)}
          aria-pressed={isOn(choices, c.id)}
          className={cn(
            "btn-focus h-12 min-w-[4.5rem] shrink-0 whitespace-nowrap rounded-2xl border-2 px-4 text-sm font-semibold",
            isOn(choices, c.id) ? "border-apricot-500 bg-apricot-500/10 text-foreground" : "border-border bg-background text-muted-foreground hover:border-apricot-400"
          )}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

/** The second choice, under the cards: its name, then its words. */
function SmallChoices({ choices }: { choices: PhoneChoices }) {
  return (
    <div role="group" aria-label={choices.label} className="flex shrink-0 items-center gap-1.5">
      <span className="me-0.5 max-w-[4.5rem] shrink-0 text-[11px] font-semibold leading-tight text-muted-foreground">{choices.label}</span>
      {choices.choices.map((c) => (
        <button
          key={c.id}
          onClick={() => choices.onPick(c.id)}
          aria-pressed={isOn(choices, c.id)}
          className={cn(
            "btn-focus h-11 shrink-0 whitespace-nowrap rounded-full border px-3 text-[13px] font-semibold",
            isOn(choices, c.id) ? "border-apricot-500 bg-apricot-500 text-white" : "border-border bg-background text-foreground hover:border-apricot-400"
          )}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

/**
 * The skin tone, behind one small button in its own colour; tapped, all ten.
 * Open on a visitor's first visit, so they find it; anywhere else closes it.
 */
function SkinButton({ label, tones, active, onPick }: NonNullable<Props["skin"]>) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const current = tones.find((s) => s.id === active) ?? tones[0];

  useEffect(() => {
    try {
      if (!localStorage.getItem(SKIN_SEEN)) setOpen(true);
    } catch {
      // private browsing: shown closed
    }
  }, []);
  const shut = () => {
    setOpen(false);
    try {
      localStorage.setItem(SKIN_SEEN, "1");
    } catch {
      // private browsing: it will open again next time
    }
  };
  // a tap anywhere else closes it — and still does what it was for
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) shut();
    };
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  }, [open]);

  return (
    <div ref={box} className="pointer-events-auto relative">
      <button
        onClick={() => (open ? shut() : setOpen(true))}
        aria-expanded={open}
        aria-label={`${label}: ${current.label}`}
        title={label}
        className={FLOAT}
      >
        <span className="h-7 w-7 rounded-full ring-1 ring-black/10 dark:ring-white/20" style={{ backgroundColor: current.color }} />
      </button>
      {open && (
        <div role="group" aria-label={label} className="absolute bottom-full end-0 mb-2 w-max rounded-2xl border border-border bg-card p-2 shadow-lift">
          <p className="mb-1 px-1.5 text-xs font-semibold text-muted-foreground">
            {label}: <span className="text-foreground">{current.label}</span>
          </p>
          <div className="grid grid-cols-5">
            {tones.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  onPick(s.id);
                  shut();
                }}
                aria-pressed={s.id === active}
                aria-label={s.label}
                title={s.label}
                className="btn-focus inline-flex h-11 w-11 items-center justify-center rounded-full"
              >
                <span
                  className={cn("h-8 w-8 rounded-full", s.id === active ? "ring-2 ring-apricot-500 ring-offset-2 ring-offset-card" : "ring-1 ring-black/10 dark:ring-white/15")}
                  style={{ backgroundColor: s.color }}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** «تجريبي», with the way to send feedback behind it — the site's bar is out of reach under the visualizer. */
function BetaButton() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  }, [open]);
  return (
    <div ref={box} className="pointer-events-auto relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="btn-focus inline-flex h-11 items-center gap-1.5 rounded-full px-1 text-xs font-semibold"
      >
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-apricot-500/30 bg-apricot-50 px-2.5 text-apricot-800 shadow-soft dark:bg-apricot-950/80 dark:text-apricot-200">
          <MessageCircle className="h-3.5 w-3.5" />
          {t("common.beta")}
        </span>
      </button>
      {open && (
        <div className="absolute end-0 top-full z-30 mt-1 w-[17rem] rounded-2xl border border-border bg-card p-3 text-start shadow-lift">
          <p className="text-xs leading-relaxed text-muted-foreground">{t("beta.banner")}</p>
          <FeedbackLink className="btn-focus mt-3 inline-flex h-11 w-full items-center justify-center rounded-full bg-apricot-500 px-4 text-sm font-semibold text-white hover:bg-apricot-600" />
          <FeedbackEmail className="mt-2.5" />
        </div>
      )}
    </div>
  );
}

/** Scroll `el` to the middle of the row it sits in — right to left as well as left to right. */
function centreIn(row: HTMLElement, el: HTMLElement, smooth: boolean) {
  const r = row.getBoundingClientRect();
  const e = el.getBoundingClientRect();
  const delta = e.left + e.width / 2 - (r.left + r.width / 2);
  if (Math.abs(delta) > 1) row.scrollBy({ left: delta, behavior: smooth ? "smooth" : "auto" });
}

