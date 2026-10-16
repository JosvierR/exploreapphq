import { LOCALES, LOCALE_META, type Locale } from "@/features/i18n/locales";
import { useI18n } from "@/features/i18n/I18nProvider";

type LanguageSwitcherProps = {
  /** Extra class for landing vs marketing shells — keeps existing pill layout. */
  className?: string;
};

/** Flag-based locale switcher for Web Summit–ready public pages. */
export function LanguageSwitcher({ className = "" }: LanguageSwitcherProps) {
  const { locale, setLocale } = useI18n();

  return (
    <div className={`lang-switch${className ? ` ${className}` : ""}`} role="group" aria-label="Language">
      {LOCALES.map((code) => {
        const meta = LOCALE_META[code];
        return (
          <button
            key={code}
            type="button"
            className={locale === code ? "is-active" : ""}
            onClick={() => setLocale(code as Locale)}
            title={meta.nativeLabel}
            aria-label={meta.nativeLabel}
            aria-pressed={locale === code}
          >
            <span className="lang-switch__flag" aria-hidden="true">
              {meta.flag}
            </span>
            <span className="lang-switch__code">{code.toUpperCase()}</span>
          </button>
        );
      })}
    </div>
  );
}
