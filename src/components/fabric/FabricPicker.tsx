"use client";

import { useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Fabric } from "@/types";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { fabricAverageColor, fabricBackground, fabricRepeatCm } from "@/lib/fabrics/artwork";
import {
  colorFamilyById,
  filterChoices,
  filterFabrics,
  isFiltered,
  swatchOrder,
  type FabricFilter,
} from "@/lib/fabrics/filters";
import { useSeen } from "@/lib/utils/useSeen";
import { cn } from "@/lib/utils/cn";

interface Props {
  fabrics: readonly Fabric[];
  /** The fabric on the part being cut, ringed. */
  activeId?: string;
  onPick: (fabric: Fabric) => void;
  /** The filters, when the caller keeps them — the visualizer does, so they hold from one part to the next. */
  filter?: FabricFilter;
  onFilter?: (filter: FabricFilter) => void;
  /** A swatch's width on screen, in CSS pixels: how much cloth its tile shows. */
  swatchPx?: number;
  className?: string;
}

/**
 * The fabric swatches, in a swatch book's order, under three filters —
 * colour, type, pattern. Each filter is one row that scrolls sideways, so the
 * three stay a few lines tall on a phone; a choice that would leave nothing
 * is dimmed, never taken away. A swatch draws its tile only as it nears the
 * screen (`useSeen`).
 */
export function FabricPicker({ fabrics, activeId, onPick, filter, onFilter, swatchPx = 44, className }: Props) {
  const { t, pick } = useI18n();
  const [own, setOwn] = useState<FabricFilter>({});
  const f = filter ?? own;
  const setF = onFilter ?? setOwn;

  const ordered = useMemo(() => swatchOrder(fabrics), [fabrics]);
  const shown = useMemo(() => filterFabrics(ordered, f), [ordered, f]);
  const choices = useMemo(() => filterChoices(fabrics, f), [fabrics, f]);
  const toggle = <K extends keyof FabricFilter>(key: K, value: FabricFilter[K]) =>
    setF({ ...f, [key]: f[key] === value ? undefined : value });

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <FilterRow label={t("search.filter.color")}>
        {choices.colors.map(({ id, count }) => {
          const c = colorFamilyById(id);
          const on = f.color === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => toggle("color", id)}
              disabled={!count && !on}
              aria-pressed={on}
              aria-label={pick(c.name)}
              title={pick(c.name)}
              className={cn(
                "btn-focus h-7 w-7 shrink-0 rounded-full border transition-all disabled:opacity-25",
                on
                  ? "border-apricot-500 ring-2 ring-apricot-500/50 ring-offset-1 ring-offset-background"
                  : "border-border hover:border-apricot-400"
              )}
              style={{ backgroundColor: c.hex }}
            />
          );
        })}
      </FilterRow>
      <FilterRow label={t("search.filter.type")}>
        {choices.materials.map(({ id, count }) => (
          <FilterChip key={id} on={f.material === id} disabled={!count} onClick={() => toggle("material", id)}>
            {t(`material.${id}`)}
          </FilterChip>
        ))}
      </FilterRow>
      <FilterRow label={t("search.filter.pattern")}>
        {choices.patterns.map(({ id, count }) => (
          <FilterChip key={id} on={f.pattern === id} disabled={!count} onClick={() => toggle("pattern", id)}>
            {t(`motif.${id}`)}
          </FilterChip>
        ))}
      </FilterRow>

      {isFiltered(f) && (
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{t("search.results").replace("{n}", String(shown.length))}</span>
          <button
            type="button"
            onClick={() => setF({})}
            className="btn-focus inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold text-apricot-600 dark:text-apricot-400"
          >
            <X className="h-3.5 w-3.5" />
            {t("search.clear")}
          </button>
        </div>
      )}

      <div className="grid grid-cols-6 gap-2">
        {shown.map((x) => (
          <Swatch key={x.id} fabric={x} active={x.id === activeId} onPick={onPick} px={swatchPx} />
        ))}
      </div>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-[11px] font-semibold leading-tight text-muted-foreground">{label}</span>
      {/* sideways, so the row stays one line tall on a phone */}
      <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-0.5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    </div>
  );
}

function FilterChip({
  on,
  disabled,
  onClick,
  children,
}: {
  on: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled && !on}
      aria-pressed={on}
      className={cn(
        "btn-focus shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium transition-all disabled:opacity-35",
        on
          ? "border-apricot-500 bg-apricot-500 text-white"
          : "border-border bg-card text-foreground hover:border-apricot-400"
      )}
    >
      {children}
    </button>
  );
}

/** One swatch: its fabric's average colour until it nears the screen, then one full repeat of it. */
function Swatch({ fabric, active, onPick, px }: { fabric: Fabric; active: boolean; onPick: (f: Fabric) => void; px: number }) {
  const { t, pick } = useI18n();
  const ref = useRef<HTMLButtonElement>(null);
  const seen = useSeen(ref);
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onPick(fabric)}
      aria-label={pick(fabric.name)}
      aria-pressed={active}
      title={`${pick(fabric.name)} · ${fabricRepeatCm(fabric).toFixed(1)} ${t("unit.cm")}`}
      className={cn(
        "aspect-square rounded-lg border transition-all",
        active ? "border-apricot-500 ring-2 ring-apricot-500/30" : "border-border hover:border-apricot-400"
      )}
      style={
        seen
          ? fabricBackground(fabric, { viewCm: 6, elementPx: px, fitRepeat: true })
          : { backgroundColor: fabricAverageColor(fabric) }
      }
    />
  );
}
