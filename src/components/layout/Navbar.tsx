"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Sparkles, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useVisualizer } from "@/components/providers/VisualizerProvider";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LocaleToggle } from "@/components/ui/LocaleToggle";
import { ButtonLink } from "@/components/ui/Button";

export function Navbar() {
  const { t } = useI18n();
  const { open } = useVisualizer();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Stores, tailors and sign-in return when they are real.
  const links = [{ key: "nav.discover", href: "/discover" }] as const;

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 glass">
      <nav className="container-wide flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Logo />
          <div className="hidden items-center gap-1 lg:flex">
            {links.map((l) => (
              <Link
                key={l.key}
                href={l.href}
                className="btn-focus rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {t(l.key)}
              </Link>
            ))}
            <button
              onClick={() => open()}
              className="btn-focus inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-apricot-600 transition-colors hover:bg-apricot-500/10 dark:text-apricot-400"
            >
              <Sparkles className="h-4 w-4" />
              {t("nav.visualizer")}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 md:flex">
            <LocaleToggle />
            <ThemeToggle />
          </div>
          <ButtonLink href="/#seller" variant="outline" size="sm" className="hidden sm:inline-flex">
            {t("nav.sell")}
          </ButtonLink>

          <button
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={t("nav.menu")}
            aria-expanded={mobileOpen}
            className="btn-focus inline-flex h-10 w-10 items-center justify-center rounded-full border border-border lg:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* mobile sheet */}
      {mobileOpen && (
        <div className="border-t border-border glass lg:hidden animate-fade-in">
          <div className="container-wide flex flex-col gap-1 py-4">
            {links.map((l) => (
              <Link
                key={l.key}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-xl px-3 py-3 text-base font-medium text-foreground transition-colors hover:bg-muted"
              >
                {t(l.key)}
              </Link>
            ))}
            <button
              onClick={() => {
                setMobileOpen(false);
                open();
              }}
              className="flex items-center gap-2 rounded-xl px-3 py-3 text-base font-medium text-apricot-600"
            >
              <Sparkles className="h-4 w-4" />
              {t("nav.visualizer")}
            </button>
            <div className="my-2 flex items-center gap-2">
              <LocaleToggle />
              <ThemeToggle />
            </div>
            <ButtonLink href="/#seller" variant="outline">
              {t("nav.sell")}
            </ButtonLink>
          </div>
        </div>
      )}
    </header>
  );
}
