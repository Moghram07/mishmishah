"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, Ruler } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useVisualizer } from "@/components/providers/VisualizerProvider";
import { fabrics } from "@/lib/data/fabrics";
import { categories } from "@/lib/data/categories";
import { defaultGarment } from "@/lib/data/garments";
import { cutFrom } from "@/lib/garments/outfit";
import { MannequinStage } from "@/components/visualizer/MannequinStage";
import { FabricSwatchChip } from "@/components/fabric/FabricCard";
import { BrandMark } from "@/components/ui/Logo";
import { Button, ButtonLink } from "@/components/ui/Button";
import type { Outfit } from "@/types";
import { DEFAULT_SKIN_TONE, skinTones } from "@/lib/data/skinTones";
import { NECKLINE_IDS } from "@/lib/garments/necklines";

/** The hero always shows the female mannequin. */
const HERO_GARMENT = defaultGarment("female");

/** One dress on the mannequin — the shortest way to show what this does. */
const HERO_OUTFIT: Outfit = {
  bodyType: "female",
  skinTone: DEFAULT_SKIN_TONE,
  worn: [cutFrom(HERO_GARMENT, "")],
  direction: 0,
};

export function Hero() {
  const { t, pick, dir } = useI18n();
  const { open } = useVisualizer();
  const [heroFabric, setHeroFabric] = useState(fabrics[0]);
  const demoFabrics = fabrics.slice(0, 6);

  const dressed = useMemo(
    () => ({
      [HERO_GARMENT.id]: Object.fromEntries(
        HERO_GARMENT.fabricRegions.map((region) => [region, heroFabric])
      ),
    }),
    [heroFabric]
  );

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-apricot-radial" />
      <div className="container-wide relative grid items-center gap-12 py-14 lg:grid-cols-[1.05fr_1fr] lg:py-20">
        {/* copy */}
        <div className="animate-fade-up">
          <span className="eyebrow">
            <Sparkles className="h-3.5 w-3.5" />
            {t("hero.eyebrow")}
          </span>
          <h1 className="heading-display mt-5 text-balance text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
            {t("hero.title").split(" ").slice(0, -2).join(" ")}{" "}
            <span className="text-gradient">
              {t("hero.title").split(" ").slice(-2).join(" ")}
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-lg text-muted-foreground">
            {t("hero.subtitle")}
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Button size="lg" onClick={() => open()}>
              <Sparkles className="h-5 w-5" />
              {t("hero.cta.primary")}
            </Button>
            <ButtonLink size="lg" variant="outline" href="/discover">
              {t("hero.cta.secondary")}
              <ArrowRight className={`h-4 w-4 ${dir === "rtl" ? "rotate-180" : ""}`} />
            </ButtonLink>
          </div>

          {/* quick category chips */}
          <div className="mt-6 flex flex-wrap gap-2">
            {categories.slice(0, 6).map((c) => (
              <Link
                key={c.key}
                href={`/discover?category=${c.key}`}
                className="rounded-full border border-border bg-card/60 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-apricot-400 hover:text-foreground"
              >
                {pick(c.label)}
              </Link>
            ))}
          </div>

          {/* what the visualizer does, counted from what it has, so the numbers stay true */}
          <dl className="mt-9 flex gap-8 border-t border-border pt-6">
            {[
              { n: String(skinTones.length), l: t("hero.stat.skinTones") },
              { n: String(NECKLINE_IDS.length), l: t("hero.stat.necklines") },
              { n: null, l: t("hero.stat.trueSize") },
            ].map((s) => (
              <div key={s.l}>
                <dt className="font-display text-2xl font-bold text-foreground">
                  {s.n ?? <Ruler className="h-8 w-8 text-apricot-500" aria-hidden />}
                </dt>
                <dd className="text-sm text-muted-foreground">{s.l}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* live showcase */}
        <div className="animate-scale-in">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-charcoal to-[#2a1d16] p-6 shadow-lift">
            <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-apricot-500/25 blur-3xl" />

            {/* brand emblem — the real logo artwork */}
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur">
                <span className="h-2 w-2 animate-pulse rounded-full bg-apricot-400" />
                {t("viz.applied")}
              </span>
              <BrandMark variant="apricot" size={40} />
            </div>

            {/* product preview */}
            <div className="relative my-2 flex items-center justify-center py-2 text-white/90">
              <MannequinStage
                outfit={HERO_OUTFIT}
                fabrics={dressed}
                className="h-[320px] w-auto drop-shadow-[0_20px_40px_rgba(0,0,0,0.5)]"
              />
            </div>

            {/* live fabric switcher */}
            <div className="rounded-2xl bg-white/5 p-3 backdrop-blur">
              <p className="mb-2 px-1 text-xs text-white/70">
                {pick(heroFabric.name)}
              </p>
              <div className="grid grid-cols-6 gap-2">
                {demoFabrics.map((f) => (
                  <FabricSwatchChip
                    key={f.id}
                    fabric={f}
                    active={f.id === heroFabric.id}
                    onClick={() => setHeroFabric(f)}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={() => open(heroFabric)}
              className="btn-focus mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-apricot-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-apricot-600"
            >
              <Sparkles className="h-4 w-4" />
              {t("viz.openCta")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
