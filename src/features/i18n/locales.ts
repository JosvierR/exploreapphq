/** Supported public locales for Explore web (Web Summit–ready). */
export const LOCALES = ["en", "es", "pt", "fr", "de"] as const;

export type Locale = (typeof LOCALES)[number];

export type LocaleMeta = {
  code: Locale;
  /** ISO flag emoji — keeps the existing pill switcher, no layout redesign. */
  flag: string;
  /** Short label for accessibility / title tooltips. */
  label: string;
  /** Native name. */
  nativeLabel: string;
};

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  en: { code: "en", flag: "🇬🇧", label: "English", nativeLabel: "English" },
  es: { code: "es", flag: "🇪🇸", label: "Spanish", nativeLabel: "Español" },
  pt: { code: "pt", flag: "🇵🇹", label: "Portuguese", nativeLabel: "Português" },
  fr: { code: "fr", flag: "🇫🇷", label: "French", nativeLabel: "Français" },
  de: { code: "de", flag: "🇩🇪", label: "German", nativeLabel: "Deutsch" },
};

export function isLocale(value: string | null | undefined): value is Locale {
  return Boolean(value && (LOCALES as readonly string[]).includes(value));
}
