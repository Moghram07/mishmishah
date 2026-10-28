"use client";

import { Wand2, Ruler, Shirt, Scissors } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { skinTones } from "@/lib/data/skinTones";
import { garments } from "@/lib/data/garments";
import { NECKLINE_IDS } from "@/lib/garments/necklines";

export function WhyMishmishah() {
  const { t } = useI18n();

  // counted from what the visualizer has, so the numbers stay true
  const range = t("why.range.title")
    .replace("{tones}", String(skinTones.length))
    .replace("{garments}", String(garments.length))
    .replace("{necklines}", String(NECKLINE_IDS.length));

  const features = [
    { icon: Wand2, title: t("why.visualize.title"), body: t("why.visualize.body") },
    { icon: Ruler, title: t("why.trueSize.title"), body: t("why.trueSize.body") },
    { icon: Shirt, title: range, body: t("why.range.body") },
    { icon: Scissors, title: t("why.clothes.title"), body: t("why.clothes.body") },
  ];

  return (
    <Section id="why" className="bg-muted/30">
      <SectionHeader
        eyebrow={t("section.why.eyebrow")}
        title={t("section.why.title")}
      />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border border-border bg-card p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
          >
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-apricot-500/12 text-apricot-600 dark:text-apricot-400">
              <f.icon className="h-6 w-6" />
            </span>
            <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
              {f.title}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </div>
      {/* not built yet, and says so */}
      <p className="mx-auto mt-6 w-fit max-w-full rounded-full border border-dashed border-border px-4 py-2 text-center text-sm text-muted-foreground">
        {t("why.ai")}
      </p>
    </Section>
  );
}
