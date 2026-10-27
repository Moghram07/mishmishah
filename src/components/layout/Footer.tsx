"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { Logo } from "@/components/ui/Logo";

export function Footer() {
  const { t } = useI18n();

  // Only links that lead somewhere real. Privacy and terms return with accounts.
  const columns: { title: string; links: { label: string; href: string }[] }[] =
    [
      {
        title: t("footer.explore"),
        links: [
          { label: t("footer.discover"), href: "/discover" },
          { label: t("footer.visualizer"), href: "/visualizer" },
        ],
      },
      {
        title: t("footer.sell"),
        links: [{ label: t("footer.becomeSeller"), href: "/#seller" }],
      },
      {
        title: t("footer.company"),
        links: [{ label: t("footer.about"), href: "/#why" }],
      },
    ];

  return (
    <footer className="border-t border-border bg-muted/40">
      <div className="container-wide py-14">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-xs">
            <Logo href={null} />
            <p className="mt-4 text-sm text-muted-foreground">
              {t("footer.tagline")}
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="mb-4 text-sm font-semibold text-foreground">
                {col.title}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-apricot-600"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row">
          <p>
            © {new Date().getFullYear()} {t("brand.name")}. {t("footer.rights")}
          </p>
        </div>
      </div>
    </footer>
  );
}
