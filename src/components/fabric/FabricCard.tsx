"use client";

import { useRef } from "react";
import { Sparkles } from "lucide-react";
import type { Fabric } from "@/types";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useVisualizer } from "@/components/providers/VisualizerProvider";
import { fabricAverageColor, fabricBackground } from "@/lib/fabrics/artwork";
import { suitsNames } from "@/lib/fabrics/suits";
import { useSeen } from "@/lib/utils/useSeen";
import { cn } from "@/lib/utils/cn";
import { Badge } from "@/components/ui/Badge";

export function FabricCard({ fabric }: { fabric: Fabric }) {
  const { t, pick, locale } = useI18n();
  const { open } = useVisualizer();
  // drawn as it nears the screen: sixty cards' tiles at once is slow on a phone
  const preview = useRef<HTMLDivElement>(null);
  const seen = useSeen(preview);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
      {/* fabric preview */}
      <div className="relative aspect-[4/5] w-full overflow-hidden">
        <div
          ref={preview}
          className="absolute inset-0 transition-transform duration-500 group-hover:scale-105"
          // a ~34 cm window of cloth, so the print reads at its true size
          style={seen ? fabricBackground(fabric, { viewCm: 34, elementPx: 250 }) : { backgroundColor: fabricAverageColor(fabric) }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal/25 via-transparent to-transparent" />

        <div className="absolute inset-x-0 top-0 flex items-start p-3">
          <Badge tone="neutral" className="bg-card/85 backdrop-blur">
            {pick(fabric.colorName)}
          </Badge>
        </div>

        {/* Try this fabric — the signature action */}
        <div className="absolute inset-x-0 bottom-0 translate-y-2 p-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <button
            onClick={() => open(fabric)}
            className="btn-focus flex w-full items-center justify-center gap-1.5 rounded-full bg-apricot-500 py-2.5 text-sm font-semibold text-white shadow-lift transition-colors hover:bg-apricot-600"
          >
            <Sparkles className="h-4 w-4" />
            {t("card.tryFabric")}
          </button>
        </div>
      </div>

      {/* meta */}
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="line-clamp-1 font-semibold text-foreground">
          {pick(fabric.name)}
        </h3>
        {/* one of our own samples, sold by no store yet: no store, price or rating */}
        <p className="text-sm text-muted-foreground">
          {t(`material.${fabric.material}`)} · {t("card.sample")}
        </p>
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {t("card.suits")}: {suitsNames(fabric).map(pick).join(locale === "ar" ? "، " : ", ")}
        </p>
      </div>
    </article>
  );
}

/** Small square swatch chip — used in strips and pickers. */
export function FabricSwatchChip({
  fabric,
  active,
  onClick,
  className,
}: {
  fabric: Fabric;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const { pick } = useI18n();
  return (
    <button
      onClick={onClick}
      aria-label={pick(fabric.name)}
      title={pick(fabric.name)}
      className={cn(
        "aspect-square rounded-xl border transition-all",
        active
          ? "border-apricot-500 ring-2 ring-apricot-500/30"
          : "border-border hover:border-apricot-400",
        className
      )}
      style={fabricBackground(fabric, { viewCm: 6, elementPx: 48, fitRepeat: true })}
    />
  );
}
