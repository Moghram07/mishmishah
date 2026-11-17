"use client";

import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { BETA_BANNER_KEY, BETA_CLOSED_ATTR } from "@/lib/beta";
import { FeedbackLink } from "@/components/feedback/Feedback";

/**
 * A short notice above everything: Mishmishah is in testing, its fabrics are
 * samples, ordering is not open — with the way to send feedback. It sits in
 * the page, not over it, so on a phone it pushes the page down and never
 * covers the mannequin; the visualizer opens over it. Closed, it stays closed
 * (`lib/beta.ts`); the badge by the logo stays.
 */
export function BetaBanner() {
  const { t } = useI18n();
  const close = () => {
    try {
      localStorage.setItem(BETA_BANNER_KEY, "closed");
    } catch {
      // private browsing: closed for this visit only
    }
    document.documentElement.setAttribute(BETA_CLOSED_ATTR, "");
  };

  return (
    <div
      role="region"
      aria-label={t("common.beta")}
      className="beta-banner border-b border-apricot-500/25 bg-apricot-50 text-apricot-950 dark:bg-apricot-950/70 dark:text-apricot-100"
    >
      <div className="container-wide flex items-start gap-2 py-2 sm:items-center sm:gap-3">
        <p className="min-w-0 flex-1 text-xs leading-relaxed sm:text-sm">
          {t("beta.banner")}{" "}
          <FeedbackLink className="whitespace-nowrap font-semibold text-apricot-700 underline underline-offset-4 hover:text-apricot-800 dark:text-apricot-300 dark:hover:text-apricot-200" />
        </p>
        <button
          type="button"
          onClick={close}
          aria-label={t("beta.close")}
          title={t("beta.close")}
          className="btn-focus -my-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-apricot-900/70 transition-colors hover:bg-apricot-500/15 hover:text-apricot-950 dark:text-apricot-100/70 dark:hover:text-apricot-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
