"use client";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createTranslator, type Locale, type TranslateFn } from "./index";

const I18nContext = createContext<{ locale: Locale; t: TranslateFn } | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(() => ({ locale, t: createTranslator(locale) }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}

export function useT(): TranslateFn {
  return useI18n().t;
}
