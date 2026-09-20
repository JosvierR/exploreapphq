import { Link } from "react-router-dom";
import { T } from "@/components/ui/T";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { SITE, SOCIAL, STORE_URLS } from "@/lib/constants";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer" id="contact">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link to="/" className="brand">
              <BrandLogo />
            </Link>
            <p>
              <T k="footer.desc" />
            </p>
            <div className="social-links" style={{ marginTop: "1rem" }}>
              <a href={SOCIAL.instagram} target="_blank" rel="noopener noreferrer">
                Instagram
              </a>
              <a href={SOCIAL.tiktok} target="_blank" rel="noopener noreferrer">
                TikTok
              </a>
            </div>
          </div>
          <div className="footer-col">
            <h5>
              <T k="footer.home" />
            </h5>
            <a href="/#top">
              <T k="footer.home" />
            </a>
            <a href="/#how-it-works">
              <T k="footer.how" />
            </a>
            <a href="/#retos">
              <T k="pioneer.nav.challenges" />
            </a>
            <a href="/#ranking">
              <T k="pioneer.nav.leaderboard" />
            </a>
            <Link to="/lab">
              <T k="lab.nav" />
            </Link>
          </div>
          <div className="footer-col">
            <h5>
              <T k="footer.creators" />
            </h5>
            <a href="/#download">
              <T k="cta.download" />
            </a>
            <a href={STORE_URLS.apple} target="_blank" rel="noopener noreferrer">
              App Store
            </a>
            <a href={STORE_URLS.play} target="_blank" rel="noopener noreferrer">
              Google Play
            </a>
          </div>
          <div className="footer-col">
            <h5>
              <T k="footer.legal" />
            </h5>
            <Link to="/privacy">
              <T k="footer.privacy" />
            </Link>
            <Link to="/terms">
              <T k="footer.terms" />
            </Link>
            <Link to="/safety">
              <T k="nav.contact" />
            </Link>
            <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {year} Explore. <T k="footer.desc" />
          </span>
        </div>
      </div>
    </footer>
  );
}
