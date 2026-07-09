import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useI18n } from "@/features/i18n/I18nProvider";
import { useHeaderScroll } from "@/hooks/useHeaderScroll";
import { T } from "@/components/ui/T";
import { BrandLogo } from "@/components/brand/BrandLogo";
import type { Locale } from "@/locales/messages";

const PIONEERS_NAV = [
  { href: "#retos", key: "pioneer.nav.challenges" as const },
  { href: "#ranking", key: "pioneer.nav.leaderboard" as const },
  { href: "#recompensas", key: "pioneer.nav.rewards" as const },
  { href: "#unirme", key: "pioneer.nav.join" as const },
];

const DISCOVER_NAV = [
  { href: "#benefits", key: "nav.explore" as const },
  { href: "#how-it-works", key: "nav.how" as const },
  { href: "#nearby", key: "nav.nearby" as const },
  { href: "#creators", key: "nav.creators" as const },
  { href: "#contact", key: "nav.contact" as const },
];

function isPioneersHomePath(pathname: string) {
  return pathname === "/" || pathname === "/pioneros";
}

export function SiteHeader() {
  const scrolled = useHeaderScroll();
  const { locale, setLocale } = useI18n();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const pioneersHome = isPioneersHomePath(location.pathname);
  const navItems = pioneersHome ? PIONEERS_NAV : DISCOVER_NAV;
  const logoTo = "/";
  const ctaHref = pioneersHome ? "#unirme" : "#download";
  const ctaKey = pioneersHome ? "pioneer.hero.cta.primary" : "cta.start";

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
      <header
        className={`site-header${scrolled ? " is-scrolled" : ""}${pioneersHome ? " site-header--pioneers" : ""}`}
        role="banner"
      >
        <div className="container header-inner">
          <Link to={logoTo} className="brand" aria-label="Explore home" onClick={closeMobile}>
            <BrandLogo />
          </Link>
          <nav className="nav-desktop" aria-label="Main">
            {navItems.map((item) => (
              <a key={item.key} href={item.href}>
                <T k={item.key} />
              </a>
            ))}
            {pioneersHome ? (
              <Link to="/explorar" className="nav-link-muted">
                <T k="nav.discover" />
              </Link>
            ) : (
              <Link to="/" className="nav-link-muted">
                <T k="nav.pioneers" />
              </Link>
            )}
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
            <Link to="/admin" className="btn btn-ghost">
              Admin
            </Link>
            <a href={ctaHref} className="btn btn-primary">
              <T k={ctaKey} />
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
        {navItems.map((item) => (
          <a key={item.key} href={item.href} onClick={closeMobile}>
            <T k={item.key} />
          </a>
        ))}
        {pioneersHome ? (
          <Link to="/explorar" onClick={closeMobile}>
            <T k="nav.discover" />
          </Link>
        ) : (
          <Link to="/" onClick={closeMobile}>
            <T k="nav.pioneers" />
          </Link>
        )}
        <Link to="/admin" className="btn btn-ghost" onClick={closeMobile}>
          Admin
        </Link>
        <a href={ctaHref} className="btn btn-primary" onClick={closeMobile}>
          <T k={ctaKey} />
        </a>
      </nav>
    </>
  );
}
