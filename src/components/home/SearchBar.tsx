"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function SearchBar({ autoFocus = false }: { autoFocus?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [query, setQuery] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/discover?q=${encodeURIComponent(q)}` : "/discover");
  };

  return (
    <form
      onSubmit={submit}
      className="flex w-full items-center gap-2 rounded-full border border-border bg-card p-1.5 shadow-lift"
    >
      <span className="ps-3 text-muted-foreground">
        <Search className="h-5 w-5" />
      </span>
      <input
        autoFocus={autoFocus}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("search.placeholder")}
        className="h-11 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
        aria-label={t("search.placeholder")}
      />
      <button
        type="submit"
        className="btn-focus inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-apricot-500 px-5 text-sm font-semibold text-white transition-colors hover:bg-apricot-600"
      >
        <Search className="h-4 w-4 sm:hidden" />
        <span className="hidden sm:inline">{t("search.button")}</span>
      </button>
    </form>
  );
}
