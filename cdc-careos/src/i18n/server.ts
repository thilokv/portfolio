import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { createTranslator, DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./index";

/** Locale from the cookie (set by the language switcher / at sign-in). */
export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
});

export async function getT() {
  return createTranslator(await getLocale());
}
