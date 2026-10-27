"use client";

import { Languages } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function LocaleToggle() {
  const { t, toggleLocale } = useI18n();
  return (
    <button
      type="button"
      onClick={toggleLocale}
      className="btn-focus inline-flex h-10 items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 text-sm font-semibold text-foreground transition-colors hover:border-apricot-400 hover:text-apricot-600"
    >
      <Languages className="h-[18px] w-[18px]" />
      {t("nav.language")}
    </button>
  );
}
