/** Locale utilities shared by server and client. */
import en, { type Messages } from "./en";
import te from "./te";

export const LOCALES = ["en", "te"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "careos_locale";

export const dictionaries: Record<Locale, Messages> = { en, te };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

function lookup(messages: unknown, key: string): string | undefined {
  let node: unknown = messages;
  for (const part of key.split(".")) {
    if (node && typeof node === "object" && part in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof node === "string" ? node : undefined;
}

/**
 * Creates a translate function. Falls back to English, then to the key itself
 * (so untranslated validation keys remain visible to developers).
 */
export function createTranslator(locale: Locale): TranslateFn {
  const messages = dictionaries[locale];
  return (key, vars) => {
    const template = lookup(messages, key) ?? lookup(en, key) ?? key;
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (_, name: string) => (name in vars ? String(vars[name]) : `{${name}}`));
  };
}

/** Collects all dotted keys in a message tree (used by tests). */
export function flattenKeys(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => flattenKeys(v, prefix ? `${prefix}.${k}` : k));
}

export type { Messages };
