"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";
import { offeredFabrics } from "@/lib/data/fabrics";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { FabricCard } from "@/components/fabric/FabricCard";

export function FeaturedFabrics() {
  const { t } = useI18n();
  return (
    <Section id="fabrics">
      <SectionHeader
        eyebrow={t("section.featuredFabrics.eyebrow")}
        title={t("section.featuredFabrics.title")}
        subtitle={t("section.featuredFabrics.subtitle")}
        href="/discover"
      />
      <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
        {offeredFabrics.slice(0, 8).map((f) => (
          <FabricCard key={f.id} fabric={f} />
        ))}
      </div>
    </Section>
  );
}
