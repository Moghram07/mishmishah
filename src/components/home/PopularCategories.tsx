"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { categories } from "@/lib/data/categories";
import { cn } from "@/lib/utils/cn";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";

/** An even grid for however many categories are offered: three sit in one row, even on a phone. */
const GRID: Record<number, string> = {
  3: "grid-cols-3",
  5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
};

export function PopularCategories() {
  const { t, pick } = useI18n();
  return (
    <Section id="categories" className="bg-muted/30">
      <SectionHeader
        eyebrow={t("section.categories.eyebrow")}
        title={t("section.categories.title")}
        subtitle={t("section.categories.subtitle")}
        href="/discover"
      />
      <div className={cn("grid gap-4", GRID[categories.length] ?? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4")}>
        {categories.map((c) => (
          <Link
            key={c.key}
            href={`/discover?category=${c.key}`}
            className="group relative flex h-32 flex-col justify-end overflow-hidden rounded-2xl border border-border p-4 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
            style={{
              background: `linear-gradient(140deg, ${c.color}22, ${c.color}0a)`,
            }}
          >
            <span
              className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-30 blur-2xl transition-opacity group-hover:opacity-50"
              style={{ backgroundColor: c.color }}
            />
            <span
              className="mb-1 h-2 w-8 rounded-full"
              style={{ backgroundColor: c.color }}
            />
            <span className="font-display text-lg font-semibold text-foreground">
              {pick(c.label)}
            </span>
          </Link>
        ))}
      </div>
    </Section>
  );
}
