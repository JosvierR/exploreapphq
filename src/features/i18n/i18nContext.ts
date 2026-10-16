import { createContext } from "react";
import type { Locale } from "@/features/i18n/locales";
import type { TranslationKey } from "@/locales/messages";

export type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
};

/** Stable module — keep context here so Vite HMR of the provider doesn't orphan consumers. */
export const I18nContext = createContext<I18nContextValue | null>(null);
