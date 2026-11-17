"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { offeredFabrics as fabrics } from "@/lib/data/fabrics";
import { categories } from "@/lib/data/categories";
import { cn } from "@/lib/utils/cn";
import { FabricCard } from "@/components/fabric/FabricCard";
import { COLOR_FAMILIES, MATERIALS, PATTERN_FAMILIES, colorFamilyById, patternOf, type PatternFamily } from "@/lib/fabrics/filters";
import type { CategoryKey, ColorFamily, FabricMaterial } from "@/types";

export function DiscoverClient() {
  const { t, pick } = useI18n();
  const params = useSearchParams();

  const [query, setQuery] = useState(() => params.get("q") ?? "");
  const [category, setCategory] = useState<CategoryKey | null>(
    () => (params.get("category") as CategoryKey) ?? null
  );
  const [material, setMaterial] = useState<FabricMaterial | null>(null);
  const [pattern, setPattern] = useState<PatternFamily | null>(null);
  const [color, setColor] = useState<ColorFamily | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  /* the picker's own vocabulary (lib/fabrics/filters.ts): only what the library has */
  const materials = useMemo(() => MATERIALS.filter((m) => fabrics.some((f) => f.material === m)), []);
  const patterns = useMemo(() => PATTERN_FAMILIES.filter((p) => fabrics.some((f) => patternOf(f) === p)), []);
  const colors = useMemo(() => COLOR_FAMILIES.filter((c) => fabrics.some((f) => f.colorFamily === c.id)), []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return fabrics.filter((f) => {
      // material, pattern and colour in both languages, so either finds them
      const family = patternOf(f);
      const labels = [
        `material.${f.material}` as const,
        ...(family ? [`motif.${family}` as const] : []),
      ];
      const shade = colorFamilyById(f.colorFamily).name;
      const haystack = [
        f.name.en,
        f.name.ar,
        f.colorName.en,
        f.colorName.ar,
        shade.en,
        shade.ar,
        ...labels.flatMap((key) => [dictionaries.en[key], dictionaries.ar[key]]),
      ]
        .join(" ")
        .toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (category && !f.categories.includes(category)) return false;
      if (material && f.material !== material) return false;
      if (pattern && patternOf(f) !== pattern) return false;
      if (color && f.colorFamily !== color) return false;
      return true;
    });
  }, [query, category, material, pattern, color]);

  const activeCount =
    (category ? 1 : 0) + (material ? 1 : 0) + (pattern ? 1 : 0) + (color ? 1 : 0);

  const clear = () => {
    setCategory(null);
    setMaterial(null);
    setPattern(null);
    setColor(null);
  };

  const [resultsBefore, resultsAfter = ""] = t("search.results").split("{n}");

  const toggle = <T,>(
    value: T,
    current: T | null,
    setter: (v: T | null) => void
  ) => setter(current === value ? null : value);

  const Group = ({
    label,
    children,
  }: {
    label: string;
    children: React.ReactNode;
  }) => (
    <div className="border-b border-border pb-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );

  const Chip = ({
    active,
    onClick,
    children,
  }: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }) => (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm transition-all",
        active
          ? "border-apricot-500 bg-apricot-500 text-white"
          : "border-border bg-card text-foreground hover:border-apricot-400"
      )}
    >
      {children}
    </button>
  );

  const Filters = (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-foreground">
          {t("search.filter.category")}
        </h2>
        {activeCount > 0 && (
          <button
            onClick={clear}
            className="inline-flex items-center gap-1 text-xs font-semibold text-apricot-600"
          >
            <X className="h-3.5 w-3.5" />
            {t("search.clear")}
          </button>
        )}
      </div>

      <Group label={t("search.filter.category")}>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <Chip
              key={c.key}
              active={category === c.key}
              onClick={() => toggle(c.key, category, setCategory)}
            >
              {pick(c.label)}
            </Chip>
          ))}
        </div>
      </Group>

      <Group label={t("search.filter.material")}>
        <div className="flex flex-wrap gap-2">
          {materials.map((m) => (
            <Chip
              key={m}
              active={material === m}
              onClick={() => toggle(m, material, setMaterial)}
            >
              {t(`material.${m}`)}
            </Chip>
          ))}
        </div>
      </Group>

      <Group label={t("search.filter.pattern")}>
        <div className="flex flex-wrap gap-2">
          {patterns.map((m) => (
            <Chip
              key={m}
              active={pattern === m}
              onClick={() => toggle(m, pattern, setPattern)}
            >
              {t(`motif.${m}`)}
            </Chip>
          ))}
        </div>
      </Group>

      <Group label={t("search.filter.color")}>
        <div className="flex flex-wrap gap-2.5">
          {colors.map((c) => {
            const active = color === c.id;
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id, color, setColor)}
                aria-label={pick(c.name)}
                aria-pressed={active}
                title={pick(c.name)}
                className={cn(
                  "h-8 w-8 rounded-full border-2 transition-transform hover:scale-110",
                  active
                    ? "border-apricot-500 ring-2 ring-apricot-500/30"
                    : "border-border"
                )}
                style={{ backgroundColor: c.hex }}
              />
            );
          })}
        </div>
      </Group>
    </div>
  );

  return (
    <div className="container-wide py-8 lg:py-12">
      {/* header + search */}
      <div className="mb-8">
        <h1 className="heading-display text-3xl sm:text-4xl">
          {t("nav.discover")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("discover.samples")}
        </p>
        <div className="mt-5 flex items-center gap-2 rounded-full border border-border bg-card p-1.5 shadow-soft">
          <span className="ps-3 text-muted-foreground">
            <Search className="h-5 w-5" />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search.placeholder")}
            className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className="btn-focus inline-flex h-11 items-center gap-1.5 rounded-full bg-muted px-4 text-sm font-semibold text-foreground lg:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {activeCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-apricot-500 px-1 text-xs text-white">
                {activeCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        {/* filters — sidebar on desktop, collapsible on mobile */}
        <aside
          className={cn(
            "lg:sticky lg:top-20 lg:block lg:h-fit",
            filtersOpen ? "block" : "hidden"
          )}
        >
          {Filters}
        </aside>

        {/* results */}
        <div>
          <p className="mb-5 text-sm text-muted-foreground">
            {resultsBefore}
            <span className="font-semibold text-foreground">
              {results.length}
            </span>
            {resultsAfter}
          </p>
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-20 text-center">
              <p className="text-muted-foreground">{t("search.empty")}</p>
              <button
                onClick={clear}
                className="mt-4 text-sm font-semibold text-apricot-600"
              >
                {t("search.clear")}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3">
              {results.map((f) => (
                <FabricCard key={f.id} fabric={f} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
