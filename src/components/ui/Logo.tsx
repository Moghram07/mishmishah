"use client";

import Link from "next/link";
import Image from "next/image";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils/cn";

/** Intrinsic aspect ratio of the extracted logo (width / height). */
const RATIO = 267 / 356;

type Variant = "auto" | "apricot" | "dark" | "light";

/**
 * The Mishmishah apricot mark — the user's actual logo, extracted to
 * transparent, anti-aliased PNGs. `auto` swaps charcoal/cream by theme;
 * fixed variants are for placement on colored surfaces.
 */
export function BrandMark({
  size = 32,
  variant = "auto",
  className,
}: {
  size?: number;
  variant?: Variant;
  className?: string;
}) {
  const w = Math.round(size * RATIO);
  const common = { width: w, height: size, priority: true } as const;

  if (variant === "auto") {
    return (
      <span
        className={cn("inline-block", className)}
        style={{ width: w, height: size }}
      >
        <Image
          {...common}
          src="/logo-dark.png"
          alt="Mishmishah"
          className="block dark:hidden"
        />
        <Image
          {...common}
          src="/logo-light.png"
          alt="Mishmishah"
          className="hidden dark:block"
        />
      </span>
    );
  }

  const src =
    variant === "apricot"
      ? "/logo-apricot.png"
      : variant === "light"
      ? "/logo-light.png"
      : "/logo-dark.png";

  return (
    <Image {...common} src={src} alt="Mishmishah" className={className} />
  );
}

export function Logo({
  className,
  wordmark = true,
  href = "/",
  size = 34,
}: {
  className?: string;
  wordmark?: boolean;
  href?: string | null;
  size?: number;
}) {
  const { t, locale } = useI18n();
  const content = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark size={size} variant="apricot" />
      {wordmark && (
        <span
          className={cn(
            "font-display text-xl font-bold tracking-tight text-foreground",
            locale === "ar" && "font-arabic"
          )}
        >
          {t("brand.name")}
        </span>
      )}
    </span>
  );

  if (href === null) return content;
  return (
    <Link
      href={href}
      aria-label={t("brand.name")}
      className="btn-focus rounded-lg"
    >
      {content}
    </Link>
  );
}
