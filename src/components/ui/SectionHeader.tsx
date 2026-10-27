"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  href,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  href?: string;
}) {
  const { t, dir } = useI18n();
  return (
    <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2 className="heading-display mt-3 text-3xl leading-tight sm:text-4xl">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-3 text-base text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {href && (
        <Link
          href={href}
          className="group inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-apricot-600 transition-colors hover:text-apricot-700 dark:text-apricot-400"
        >
          {t("section.viewAll")}
          <ArrowRight
            className={`h-4 w-4 transition-transform group-hover:translate-x-0.5 ${
              dir === "rtl" ? "rotate-180 group-hover:-translate-x-0.5" : ""
            }`}
          />
        </Link>
      )}
    </div>
  );
}
