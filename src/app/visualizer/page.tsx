"use client";

import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useVisualizer } from "@/components/providers/VisualizerProvider";
import { fabrics } from "@/lib/data/fabrics";
import { garmentById, garmentsFor, defaultGarment } from "@/lib/data/garments";
import { DEFAULT_SKIN_TONE, skinTones } from "@/lib/data/skinTones";
import { bodyTypes } from "@/lib/mannequin/bodies";
import {
  cutFrom,
  isWearing,
  regionsOf,
  stack,
  switchBody,
  takeOff,
  wear,
  wornOn,
} from "@/lib/garments/outfit";
import { MannequinStage } from "@/components/visualizer/MannequinStage";
import { FabricPicker } from "@/components/fabric/FabricPicker";
import { PublishDesign } from "@/components/feedback/Feedback";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import type { BodyType, Fabric, FabricRegionId, Outfit } from "@/types";

export default function VisualizerPage() {
  const { t, pick } = useI18n();
  const { open } = useVisualizer();
  const [fabric, setFabric] = useState<Fabric>(fabrics[0]);
  const [outfit, setOutfit] = useState<Outfit>(() => ({
    bodyType: "female",
    skinTone: DEFAULT_SKIN_TONE,
    worn: [cutFrom(defaultGarment("female"), fabrics[0].id)],
    direction: 0,
  }));

  const wardrobe = useMemo(
    () => garmentsFor(outfit.bodyType),
    [outfit.bodyType]
  );

  /** Everything worn on this body, re-cut in the fabric being previewed. */
  const dressed = useMemo(() => {
    const out: Record<string, Partial<Record<FabricRegionId, Fabric>>> = {};
    for (const entry of stack(wornOn(outfit.worn, outfit.bodyType))) {
      out[entry.garment.id] = Object.fromEntries(
        // The collar too — this page previews one cloth throughout, and a
        // region left unresolved would simply not be drawn.
        regionsOf(entry.garment, entry.worn).map((region) => [region, fabric])
      );
    }
    return out;
  }, [outfit.worn, outfit.bodyType, fabric]);

  const toggle = (id: string) => {
    const garment = garmentById(id);
    // Never wear something cut for the other mannequin.
    if (!garment || garment.gender !== outfit.bodyType) return;
    setOutfit((o) => ({
      ...o,
      worn: isWearing(o.worn, id)
        ? takeOff(o.worn, id)
        : wear(o.worn, cutFrom(garment, fabric.id)),
    }));
  };

  /** What is on the figure, for a feedback email: its garments, in the one fabric this page previews. */
  const designLine = `${t("feedback.design")}: ${stack(wornOn(outfit.worn, outfit.bodyType))
    .map((entry) => pick(entry.garment.name))
    .join(" + ")} — ${t("share.fabric")}: ${pick(fabric.name)}`;

  /** Switch mannequin. Each keeps its own wardrobe — see `switchBody`. */
  const setBody = (id: BodyType) =>
    setOutfit((o) => switchBody(o, id, fabric.id));

  return (
    <div className="relative overflow-hidden">
      <PublishDesign line={designLine} />
      <div className="pointer-events-none absolute inset-0 bg-apricot-radial" />
      <div className="container-wide relative py-14 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="eyebrow justify-center">
            <Sparkles className="h-3.5 w-3.5" />
            {t("viz.title")}
          </span>
          <h1 className="heading-display mt-4 text-4xl sm:text-5xl">
            {t("viz.subtitle")}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">{t("viz.magic")}</p>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl items-center gap-8 lg:grid-cols-2">
          <div className="relative flex items-center justify-center rounded-3xl border border-border bg-card p-8 shadow-lift">
            <MannequinStage
              outfit={outfit}
              fabrics={dressed}
              className="h-[440px] w-auto text-foreground drop-shadow-[0_24px_48px_rgba(27,23,20,0.2)]"
            />
          </div>

          <div className="flex flex-col gap-6">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("viz.wear")}
              </p>
              <div className="flex flex-wrap gap-2">
                {wardrobe.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => toggle(g.id)}
                    aria-pressed={isWearing(outfit.worn, g.id)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all",
                      isWearing(outfit.worn, g.id)
                        ? "border-apricot-500 bg-apricot-500 text-white"
                        : "border-border bg-card hover:border-apricot-400"
                    )}
                  >
                    {pick(g.name)}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {t("viz.layersHint")}
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-6">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("viz.body")}
                </p>
                <div className="flex gap-2">
                  {bodyTypes.map((b) => (
                    <button
                      key={b.id}
                      onClick={() =>
                        setBody(b.id)
                      }
                      aria-pressed={outfit.bodyType === b.id}
                      className={cn(
                        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all",
                        outfit.bodyType === b.id
                          ? "border-apricot-500 bg-apricot-500 text-white"
                          : "border-border bg-card hover:border-apricot-400"
                      )}
                    >
                      {pick(b.label)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("viz.skinTone")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {skinTones.map((s) => (
                    <button
                      key={s.id}
                      onClick={() =>
                        setOutfit((o) => ({ ...o, skinTone: s.id }))
                      }
                      aria-label={pick(s.label)}
                      title={pick(s.label)}
                      aria-pressed={outfit.skinTone === s.id}
                      className={cn(
                        "h-8 w-8 rounded-full border-2 transition-transform hover:scale-110",
                        outfit.skinTone === s.id
                          ? "border-apricot-500 ring-2 ring-apricot-500/30"
                          : "border-border"
                      )}
                      style={{ backgroundColor: s.color }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("viz.pickFabric")} — {pick(fabric.name)}
              </p>
              <FabricPicker fabrics={fabrics} activeId={fabric.id} onPick={setFabric} swatchPx={48} />
            </div>

            <Button size="lg" onClick={() => open(fabric)}>
              <Sparkles className="h-5 w-5" />
              {t("viz.openCta")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
