"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Locale, Localized } from "@/types";
import { dictionaries, type TranslationKey } from "./dictionaries";

interface I18nValue {
  locale: Locale;
  dir: "ltr" | "rtl";
  setLocale: (l: Locale) => void;
  toggleLocale: () => void;
  /** Translate a UI key. */
  t: (key: TranslationKey) => string;
  /** Resolve a `Localized` value for the active locale. */
  pick: (value: Localized) => string;
}

const I18nContext = createContext<I18nValue | null>(null);
const STORAGE_KEY = "mishmishah:locale";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  // Restore saved locale on mount.
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (saved === "en" || saved === "ar") setLocaleState(saved);
  }, []);

  // Reflect locale onto the document for real RTL/LTR + a11y.
  useEffect(() => {
    const dir = locale === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
    window.localStorage.setItem(STORAGE_KEY, locale);
  }, [locale]);

  const setLocale = useCallback((l: Locale) => setLocaleState(l), []);
  const toggleLocale = useCallback(
    () => setLocaleState((prev) => (prev === "en" ? "ar" : "en")),
    []
  );

  const value = useMemo<I18nValue>(() => {
    const table = dictionaries[locale];
    return {
      locale,
      dir: locale === "ar" ? "rtl" : "ltr",
      setLocale,
      toggleLocale,
      t: (key) => table[key] ?? dictionaries.en[key] ?? key,
      pick: (v) => v[locale] ?? v.en,
    };
  }, [locale, setLocale, toggleLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
