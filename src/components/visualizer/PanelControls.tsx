"use client";

import { useState } from "react";
import { ChevronDown, PersonStanding } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * The visualizer panel's small parts: the three tabs, a row that opens in
 * place, and the choices inside a row.
 */

/** The panel's three groups — what is cut, what is added to it, and what it is cut from. */
export type PanelTab = "cut" | "extras" | "fabrics";

/** The three groups, side by side in one pill, kept in view while the panel scrolls. */
export function PanelTabs({
  tabs,
  active,
  onPick,
  label,
}: {
  tabs: { id: PanelTab; label: string }[];
  active: PanelTab;
  onPick: (id: PanelTab) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="grid grid-cols-3 gap-1 rounded-full bg-muted/70 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          id={`viz-tab-${tab.id}`}
          aria-selected={active === tab.id}
          aria-controls={`viz-panel-${tab.id}`}
          onClick={() => onPick(tab.id)}
          className={cn(
            "btn-focus rounded-full px-3 py-2 text-sm font-semibold transition-all",
            active === tab.id ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/**
 * One choice in the panel, closed to a line that says what is chosen —
 * «الأكمام — قصير · عادي» — and open in place to change it. One row is open
 * at a time, so a group stays a short list on a phone.
 */
export function PanelRow({
  id,
  label,
  value,
  lead,
  open,
  onToggle,
  children,
}: {
  id: string;
  label: string;
  value?: string;
  /** Something before the label: a part's fabric swatch. */
  lead?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const panel = `viz-row-${id}`;
  return (
    <div className={cn("rounded-2xl border bg-card transition-colors", open ? "border-apricot-500/50" : "border-border")}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panel}
        className="btn-focus flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-start"
      >
        {lead}
        <span className="shrink-0 text-sm font-semibold text-foreground">{label}</span>
        <span className="ms-auto min-w-0 truncate text-sm text-muted-foreground">{value}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div id={panel} className="flex flex-col gap-3 border-t border-border px-3 pb-4 pt-3 sm:px-4">
          {children}
        </div>
      )}
    </div>
  );
}

/** A heading inside an open row, over one of its choices. */
export function RowHeading({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</p>;
}

/** A hint under a row's choices. */
export function RowHint({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-muted-foreground">{children}</p>;
}

/** A row of a few choices sharing one pill, one of them pressed — lengths, waists, buttons, stripes, tie. */
export function Segmented<T extends string>({
  label,
  choices,
  active,
  onPick,
}: {
  label: string;
  choices: { id: T; label: string }[];
  active: T;
  onPick: (id: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="grid gap-1 rounded-full bg-muted/60 p-1"
      style={{ gridTemplateColumns: `repeat(${choices.length}, minmax(0, 1fr))` }}
    >
      {choices.map((c) => (
        <button
          key={c.id}
          onClick={() => onPick(c.id)}
          aria-pressed={active === c.id}
          className={cn(
            /* one line each: four choices share a row inside a row, «ثلاثة شرائط» among them */
            "btn-focus whitespace-nowrap rounded-full px-1 py-2 text-xs font-semibold transition-all",
            active === c.id ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

/** One of many choices, as a small chip — necklines, collars, sleeves, belts. */
export function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
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

/** A choice that fills its share of a row — the pattern direction. */
export function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "btn-focus flex-1 rounded-full border px-3 py-1.5 text-sm font-medium transition-all",
        active ? "border-apricot-500 bg-apricot-500 text-white" : "border-border bg-card text-foreground hover:border-apricot-400"
      )}
    >
      {children}
    </button>
  );
}

/**
 * One skin tone, in its own colour and nothing else. It once had a painted-on
 * highlight, which turned the deepest tones grey: the swatch has to be the
 * colour the body is drawn in.
 */
export function SkinSwatch({ label, color, active, onClick }: { label: string; color: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        "btn-focus h-6 w-6 shrink-0 rounded-full transition-transform hover:scale-110 sm:h-7 sm:w-7",
        active ? "scale-110 ring-2 ring-apricot-500 ring-offset-2 ring-offset-card" : "ring-1 ring-black/10 dark:ring-white/15"
      )}
      style={{ backgroundColor: color }}
    />
  );
}

/**
 * Which mannequin is on the stage, behind one small button in its corner. The
 * skin tone stays out under the figure — it is the visualizer's own promise,
 * the fabric on your skin — but the body is chosen once and left, so it does
 * not need a row of its own on a phone.
 */
export function BodyButton<T extends string>({
  label,
  bodies,
  active,
  onPick,
  large = false,
}: {
  label: string;
  bodies: { id: T; label: string }[];
  active: T;
  onPick: (id: T) => void;
  /** A finger's size, 44 px — the phone's stage. */
  large?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = bodies.find((b) => b.id === active);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label}: ${current?.label ?? ""}`}
        className={cn(
          "btn-focus inline-flex items-center gap-1.5 rounded-full border border-border/60 font-semibold text-foreground shadow-soft transition-colors hover:bg-card",
          large ? "h-11 bg-card/90 px-3.5 text-sm" : "h-9 bg-card/85 px-3 text-xs backdrop-blur"
        )}
      >
        <PersonStanding className="h-4 w-4 text-apricot-500" />
        {current?.label}
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <>
          {/* anywhere else closes it */}
          <button aria-hidden tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div role="menu" aria-label={label} className="absolute start-0 top-full z-20 mt-1.5 min-w-[9rem] rounded-2xl border border-border bg-card p-1 shadow-lift">
            {bodies.map((b) => (
              <button
                key={b.id}
                role="menuitemradio"
                aria-checked={b.id === active}
                onClick={() => {
                  onPick(b.id);
                  setOpen(false);
                }}
                className={cn(
                  "btn-focus flex w-full items-center rounded-xl px-3 text-start text-sm font-semibold transition-colors",
                  large ? "h-11" : "py-2",
                  b.id === active ? "bg-apricot-500/10 text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {b.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
