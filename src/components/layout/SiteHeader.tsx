import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { useI18n } from "@/features/i18n/I18nProvider";
import { useHeaderScroll } from "@/hooks/useHeaderScroll";
import { T } from "@/components/ui/T";
import { BrandLogo } from "@/components/brand/BrandLogo";
import type { Locale } from "@/locales/messages";

const NAV = [
  { href: "#benefits", key: "nav.explore" as const },
  { href: "#how-it-works", key: "nav.how" as const },
  { href: "#nearby", key: "nav.nearby" as const },
  { href: "#creators", key: "nav.creators" as const },
  { href: "#contact", key: "nav.contact" as const },
];

export function SiteHeader() {
  const scrolled = useHeaderScroll();
  const { locale, setLocale } = useI18n();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  function handleLogout() {
    logout();
    closeMobile();
    navigate("/access");
  }

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
            {NAV.map((item) => (
              <a key={item.key} href={item.href}>
                <T k={item.key} />
              </a>
            ))}
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
            <a href="#download" className="btn btn-primary">
              <T k="cta.start" />
            </a>
            <button type="button" className="btn btn-ghost btn-logout" onClick={handleLogout}>
              Log out
            </button>
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
        {NAV.map((item) => (
          <a key={item.key} href={item.href} onClick={closeMobile}>
            <T k={item.key} />
          </a>
        ))}
        <a href="#download" className="btn btn-primary" onClick={closeMobile}>
          <T k="cta.start" />
        </a>
        <button type="button" className="btn btn-ghost" onClick={handleLogout}>
          Log out
        </button>
      </nav>
    </>
  );
}
