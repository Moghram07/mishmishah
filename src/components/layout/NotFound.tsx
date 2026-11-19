"use client";

import { ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { ButtonLink } from "@/components/ui/Button";

/**
 * The site's own page for an address that is not there, in the visitor's
 * language and theme, under the same bar and footer as every page.
 */
export function NotFound() {
  const { t, dir } = useI18n();

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-apricot-radial" />
      <div className="container-wide relative flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
        {/* the number for the eye; the heading says it in words */}
        <p
          aria-hidden
          className="text-gradient font-display text-8xl font-bold leading-none tracking-tight sm:text-9xl"
        >
          404
        </p>
        <h1 className="heading-display mt-6 text-balance text-3xl sm:text-4xl">
          {t("notFound.title")}
        </h1>
        <p className="mt-3 max-w-md text-pretty text-lg text-muted-foreground">
          {t("notFound.body")}
        </p>
        {/* one above the other, the same width, on a phone; side by side above that */}
        <div className="mt-8 flex w-full max-w-xs flex-col gap-3 sm:w-auto sm:max-w-none sm:flex-row sm:justify-center">
          <ButtonLink href="/" size="lg">
            {t("notFound.home")}
          </ButtonLink>
          <ButtonLink href="/discover" size="lg" variant="outline">
            {t("hero.cta.secondary")}
            <ArrowRight className={`h-4 w-4 ${dir === "rtl" ? "rotate-180" : ""}`} />
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
