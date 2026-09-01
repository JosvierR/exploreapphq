import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { messages, type Locale, type TranslationKey } from "@/locales/messages";
import { I18nContext, type I18nContextValue } from "./i18nContext";

const STORAGE_KEY = "explore-lang";

function translate(locale: Locale, key: TranslationKey): string {
  return messages[locale][key] ?? messages.en[key] ?? key;
}

function readStoredLocale(): Locale {
  try {
    return localStorage.getItem(STORAGE_KEY) === "es" ? "es" : "en";
  } catch {
    return "en";
  }
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

  // Fallback if a consumer remounts outside the provider (Vite HMR) — prefer EN.
  return {
    locale: "en",
    setLocale: () => {},
    t: (key) => translate("en", key),
  };
}
