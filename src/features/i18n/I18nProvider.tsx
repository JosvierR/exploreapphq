import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { messages, type TranslationKey } from "@/locales/messages";
import { isLocale, type Locale } from "@/features/i18n/locales";
import { I18nContext, type I18nContextValue } from "./i18nContext";

const STORAGE_KEY = "explore-lang";

function translate(locale: Locale, key: TranslationKey): string {
  if (locale === "es") return messages.es[key] ?? messages.en[key] ?? key;
  return messages.en[key] ?? key;
}

function readStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    /* ignore */
  }
  if (typeof navigator !== "undefined") {
    const nav = navigator.language?.slice(0, 2).toLowerCase();
    if (isLocale(nav)) return nav;
  }
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  const t = useCallback((key: TranslationKey) => translate(locale, key), [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;

  return {
    locale: "en",
    setLocale: () => {},
    t: (key) => translate("en", key),
  };
}
