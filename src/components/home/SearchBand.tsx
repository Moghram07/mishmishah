"use client";

import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { SearchBar } from "./SearchBar";

export function SearchBand() {
  const { t, pick } = useI18n();

  const popular = [
    { en: "Linen", ar: "كتّان", q: "linen" },
    { en: "Silk", ar: "حرير", q: "silk" },
    { en: "Velvet", ar: "مخمل", q: "velvet" },
    { en: "Floral", ar: "زهور", q: "floral" },
    { en: "Wedding", ar: "أعراس", q: "wedding" },
  ];

  return (
    <div className="border-y border-border bg-card/50">
      <div className="container-wide py-6">
        <div className="mx-auto max-w-3xl">
          <SearchBar />
          <div className="mt-3 flex flex-wrap items-center gap-2 px-1">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
            </span>
            {popular.map((p) => (
              <Link
                key={p.q}
                href={`/discover?q=${p.q}`}
                className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-apricot-500/10 hover:text-apricot-700 dark:hover:text-apricot-300"
              >
                {pick(p)}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
