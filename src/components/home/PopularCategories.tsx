"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { categories } from "@/lib/data/categories";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";

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
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
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
