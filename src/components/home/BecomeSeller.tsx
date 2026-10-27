"use client";

import { MessageCircle, Store } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { Section } from "@/components/ui/Section";
import { ButtonLink } from "@/components/ui/Button";
import { SHOP_CONTACT, whatsappLink } from "@/lib/contact";

export function BecomeSeller() {
  const { t } = useI18n();
  const { whatsapp, email } = SHOP_CONTACT;

  return (
    <Section id="seller">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-charcoal to-[#3a2418] p-8 shadow-lift sm:p-12">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-apricot-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-apricot-600/20 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-apricot-300">
            <Store className="h-3.5 w-3.5" />
            {t("seller.eyebrow")}
          </span>
          <h2 className="mt-4 font-display text-3xl font-semibold text-white sm:text-4xl">
            {t("seller.title")}
          </h2>
          <p className="mt-4 max-w-xl text-white/70">{t("seller.body")}</p>

          {/* each way in shows only once it is filled in (lib/contact.ts) */}
          {whatsapp && (
            <ButtonLink href={whatsappLink(whatsapp)} external size="lg" className="mt-8">
              <MessageCircle className="h-5 w-5" />
              {t("seller.contact")}
            </ButtonLink>
          )}
          {email && (
            <p className={`text-sm text-white/70 ${whatsapp ? "mt-4" : "mt-8"}`}>
              {t(whatsapp ? "seller.email" : "seller.emailOnly")}{" "}
              <a
                href={`mailto:${email}`}
                dir="ltr"
                className="font-medium text-apricot-300 underline-offset-4 hover:underline"
              >
                {email}
              </a>
            </p>
          )}
        </div>
      </div>
    </Section>
  );
}
