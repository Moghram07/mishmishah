"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import type { Fabric } from "@/types";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { fabricAverageColor, fabricBackground } from "@/lib/fabrics/artwork";
import { colorFamilyById, filterChoices, filterFabrics, isFiltered, swatchOrder, type FabricFilter } from "@/lib/fabrics/filters";
import { useSeen } from "@/lib/utils/useSeen";
import { cn } from "@/lib/utils/cn";
import type { PhoneChoices } from "./PhoneLayout";

/**
 * The fabrics group on a phone: which part — the whole garment first,
 * «الفستان كله» — then three filter buttons, what the fabric on the part is,
 * and the swatches three to a row, each named. The swatches are the only
 * thing that scrolls; a filter's choices open over them, every one a
 * finger's size, each with how many fabrics it would show.
 */

export interface PhonePart {
  id: string;
  label: string;
  active: boolean;
  onPick: () => void;
}

interface Props {
  /** Which garment, when more than one is worn — the same switch as the other groups'. */
  editing: PhoneChoices | null;
  parts: PhonePart[];
  fabrics: readonly Fabric[];
  /** The fabric on the part chosen, ringed. */
  activeId?: string;
  onPick: (fabric: Fabric) => void;
  filter: FabricFilter;
  onFilter: (filter: FabricFilter) => void;
  /** What the fabric on the part is: its name, then its type, repeat and what it suits. */
  about: { name: string; detail: string; suits?: string };
  /** Which way its pattern is laid, for a pattern that has a way. */
  direction: PhoneChoices | null;
}

type Which = "color" | "material" | "pattern";

export function PhoneFabrics({ editing, parts, fabrics, activeId, onPick, filter, onFilter, about, direction }: Props) {
  const { t, pick } = useI18n();
  const [open, setOpen] = useState<Which | null>(null);
  const ordered = useMemo(() => swatchOrder(fabrics), [fabrics]);
  const shown = useMemo(() => filterFabrics(ordered, filter), [ordered, filter]);
  const choices = useMemo(() => filterChoices(fabrics, filter), [fabrics, filter]);
  const grid = useRef<HTMLDivElement>(null);
  // a new part, or new filters, start the swatches at the top
  useEffect(() => {
    grid.current?.scrollTo({ top: 0 });
  }, [filter]);

  const label: Record<Which, string> = {
    color: t("search.filter.color"),
    material: t("search.filter.type"),
    pattern: t("search.filter.pattern"),
  };
  const valueOf = (which: Which): string | undefined =>
    which === "color" && filter.color
      ? pick(colorFamilyById(filter.color).name)
      : which === "material" && filter.material
        ? t(`material.${filter.material}`)
        : which === "pattern" && filter.pattern
          ? t(`motif.${filter.pattern}`)
          : undefined;
  const set = (which: Which, value: string | undefined) => {
    onFilter({ ...filter, [which]: value });
    setOpen(null);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* which part: the whole garment first */}
      <div className="no-scrollbar flex h-[56px] shrink-0 items-center gap-2 overflow-x-auto px-3">
        {editing && (
          <div role="group" aria-label={editing.label} className="flex shrink-0 gap-1 rounded-full bg-muted/70 p-1">
            {editing.choices.map((c) => (
              <button
                key={c.id}
                onClick={() => editing.onPick(c.id)}
                aria-pressed={editing.active === c.id}
                className={cn("btn-focus h-11 shrink-0 rounded-full px-3.5 text-sm font-semibold", editing.active === c.id ? "bg-card text-foreground shadow-soft" : "text-muted-foreground")}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
        {parts.map((p) => (
          <button
            key={p.id}
            onClick={p.onPick}
            aria-pressed={p.active}
            className={cn(
              "btn-focus h-11 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-semibold",
              p.active ? "border-apricot-500 bg-apricot-500 text-white shadow-soft" : "border-border bg-background text-foreground hover:border-apricot-400"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* three filters, and clearing them */}
      <div className="flex h-[52px] shrink-0 items-center gap-2 px-3">
        {(["color", "material", "pattern"] as const).map((which) => {
          const value = valueOf(which);
          return (
            <button
              key={which}
              onClick={() => setOpen((o) => (o === which ? null : which))}
              aria-expanded={open === which}
              aria-label={value ? `${label[which]}: ${value}` : label[which]}
              className={cn(
                "btn-focus inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full border px-2.5 text-[13px] font-semibold",
                value || open === which ? "border-apricot-500 bg-apricot-500/10 text-foreground" : "border-border bg-background text-foreground"
              )}
            >
              {which === "color" && filter.color && (
                <span className="h-4 w-4 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/20" style={{ backgroundColor: colorFamilyById(filter.color).hex }} />
              )}
              <span className="truncate">{value ?? label[which]}</span>
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground", open === which && "rotate-180")} />
            </button>
          );
        })}
        {isFiltered(filter) && (
          <button
            onClick={() => {
              onFilter({});
              setOpen(null);
            }}
            aria-label={t("search.clear")}
            title={t("search.clear")}
            className="btn-focus inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* the fabric on the part: what it is, and which way its pattern runs */}
      <div className="shrink-0 px-3 pb-2">
        {/* held sideways the panel is short: the swatch it names is ringed and named in the grid */}
        <p className="truncate text-[13px] leading-snug land:hidden">
          <span className="font-semibold text-foreground">{about.name}</span>
          <span className="text-muted-foreground"> · {about.detail}</span>
        </p>
        {about.suits && <p className="truncate text-[11.5px] leading-snug text-muted-foreground land:hidden">{about.suits}</p>}
        {direction && (
          <div role="group" aria-label={direction.label} className="mt-1.5 flex items-center gap-1.5">
            <span className="me-0.5 shrink-0 text-[11px] font-semibold text-muted-foreground">{direction.label}</span>
            {direction.choices.map((c) => (
              <button
                key={c.id}
                onClick={() => direction.onPick(c.id)}
                aria-pressed={direction.active === c.id}
                className={cn(
                  "btn-focus h-11 flex-1 whitespace-nowrap rounded-full border px-3 text-[13px] font-semibold",
                  direction.active === c.id ? "border-apricot-500 bg-apricot-500 text-white" : "border-border bg-background text-foreground"
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* the swatches, three to a row, named — the one thing that scrolls */}
      <div className="relative min-h-0 flex-1">
        <div ref={grid} className="h-full overflow-y-auto overscroll-contain px-3 pb-3">
          <div className="grid grid-cols-3 gap-2">
            {shown.map((f) => (
              <Swatch key={f.id} fabric={f} active={f.id === activeId} onPick={onPick} />
            ))}
          </div>
        </div>

        {/* a filter's choices, over the swatches: «الكل» first, then each, with how many it would show */}
        {open && (
          <div role="group" aria-label={label[open]} className="absolute inset-0 z-10 flex flex-col gap-2 overflow-y-auto overscroll-contain border-t border-border bg-card px-3 pb-3 pt-2">
            <div className="flex flex-wrap gap-1.5">
              <Option on={!filter[open]} onClick={() => set(open, undefined)}>
                {t("search.all")}
              </Option>
              {open === "color" &&
                choices.colors.map(({ id, count }) => (
                  <Option key={id} on={filter.color === id} disabled={!count} count={count} onClick={() => set("color", id)}>
                    <span className="h-4 w-4 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/20" style={{ backgroundColor: colorFamilyById(id).hex }} />
                    {pick(colorFamilyById(id).name)}
                  </Option>
                ))}
              {open === "material" &&
                choices.materials.map(({ id, count }) => (
                  <Option key={id} on={filter.material === id} disabled={!count} count={count} onClick={() => set("material", id)}>
                    {t(`material.${id}`)}
                  </Option>
                ))}
              {open === "pattern" &&
                choices.patterns.map(({ id, count }) => (
                  <Option key={id} on={filter.pattern === id} disabled={!count} count={count} onClick={() => set("pattern", id)}>
                    {t(`motif.${id}`)}
                  </Option>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** One choice of a filter: a finger's size; one that would show nothing is dimmed, never taken away. */
function Option({ on, disabled = false, count, onClick, children }: { on: boolean; disabled?: boolean; count?: number; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled && !on}
      aria-pressed={on}
      className={cn(
        "btn-focus inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-semibold disabled:opacity-35",
        on ? "border-apricot-500 bg-apricot-500 text-white" : "border-border bg-background text-foreground"
      )}
    >
      {children}
      {count !== undefined && <span className={cn("text-xs font-medium", on ? "text-white/80" : "text-muted-foreground")}>{count}</span>}
    </button>
  );
}

/** One swatch: a full repeat of the fabric once it nears the screen (its average colour until then), its name under it. */
function Swatch({ fabric, active, onPick }: { fabric: Fabric; active: boolean; onPick: (f: Fabric) => void }) {
  const { pick } = useI18n();
  const ref = useRef<HTMLButtonElement>(null);
  const seen = useSeen(ref);
  const name = pick(fabric.name);
  return (
    <button
      ref={ref}
      onClick={() => onPick(fabric)}
      aria-pressed={active}
      aria-label={name}
      className={cn(
        "btn-focus relative flex flex-col overflow-hidden rounded-2xl border-2 bg-background text-center",
        active ? "border-apricot-500" : "border-border hover:border-apricot-400"
      )}
    >
      <span
        className="block h-16 w-full"
        style={seen ? fabricBackground(fabric, { viewCm: 6, elementPx: 112, fitRepeat: true }) : { backgroundColor: fabricAverageColor(fabric) }}
      />
      {active && (
        <span className="absolute end-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-apricot-500 text-white shadow-soft">
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
      )}
      <span className={cn("line-clamp-2 flex min-h-[2.4rem] items-center justify-center px-1 py-1 text-[12px] font-semibold leading-tight", active ? "text-foreground" : "text-muted-foreground")}>
        {name}
      </span>
    </button>
  );
}
