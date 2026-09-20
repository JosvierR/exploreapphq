import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useI18n } from "@/features/i18n/I18nProvider";
import { useHeaderScroll } from "@/hooks/useHeaderScroll";
import { T } from "@/components/ui/T";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { isPioneersHomePath } from "@/features/pioneers/lib/paths";
import type { Locale } from "@/locales/messages";

const HOME_NAV = [
  { href: "#how-it-works", key: "nav.how" as const },
  { href: "#retos", key: "pioneer.nav.challenges" as const },
  { href: "#ranking", key: "pioneer.nav.leaderboard" as const },
  { href: "#recompensas", key: "pioneer.nav.rewards" as const },
];

const INNER_NAV = [
  { href: "/#how-it-works", key: "nav.how" as const },
  { href: "/#retos", key: "pioneer.nav.challenges" as const },
  { href: "/#ranking", key: "pioneer.nav.leaderboard" as const },
];

export function SiteHeader() {
  const scrolled = useHeaderScroll();
  const { locale, setLocale } = useI18n();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const onHome = isPioneersHomePath(location.pathname);
  const navItems = onHome ? HOME_NAV : INNER_NAV;

  const closeMobile = () => {
    setMobileOpen(false);
    document.body.style.overflow = "";
  };

  const toggleMobile = () => {
    setMobileOpen((o) => {
      document.body.style.overflow = o ? "" : "hidden";
      return !o;
    });
  };

  return (
    <>
      <header className={`site-header${scrolled ? " is-scrolled" : ""}`} role="banner">
        <div className="container header-inner">
          <Link to="/" className="brand" aria-label="Explore home" onClick={closeMobile}>
            <BrandLogo />
          </Link>
          <nav className="nav-desktop" aria-label="Main">
            {navItems.map((item) =>
              item.href.startsWith("/#") || item.href.startsWith("#") ? (
                item.href.startsWith("/#") ? (
                  <Link key={item.key} to={item.href}>
                    <T k={item.key} />
                  </Link>
                ) : (
                  <a key={item.key} href={item.href}>
                    <T k={item.key} />
                  </a>
                )
              ) : (
                <Link key={item.key} to={item.href}>
                  <T k={item.key} />
                </Link>
              ),
            )}
            <Link to="/lab" className="nav-link-muted">
              <T k="lab.nav" />
            </Link>
          </nav>
          <div className="header-actions">
            <div className="lang-switch" role="group" aria-label="Language">
              {(["en", "es"] as Locale[]).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  className={locale === lang ? "is-active" : ""}
                  onClick={() => setLocale(lang)}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>
            <a href={onHome ? "#download" : "/#download"} className="btn btn-primary">
              <T k="cta.download" />
            </a>
            <button
              type="button"
              className={`nav-toggle${mobileOpen ? " is-open" : ""}`}
              aria-label="Open menu"
              aria-expanded={mobileOpen}
              aria-controls="nav-mobile"
              onClick={toggleMobile}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      <nav id="nav-mobile" className={`nav-mobile${mobileOpen ? " is-open" : ""}`} aria-label="Mobile">
        {navItems.map((item) =>
          item.href.startsWith("/#") ? (
            <Link key={item.key} to={item.href} onClick={closeMobile}>
              <T k={item.key} />
            </Link>
          ) : (
            <a key={item.key} href={item.href} onClick={closeMobile}>
              <T k={item.key} />
            </a>
          ),
        )}
        <Link to="/lab" onClick={closeMobile}>
          <T k="lab.nav" />
        </Link>
        <a href={onHome ? "#download" : "/#download"} className="btn btn-primary" onClick={closeMobile}>
          <T k="cta.download" />
        </a>
      </nav>
    </>
  );
}
