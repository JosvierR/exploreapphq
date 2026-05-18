import { Link } from "react-router-dom";
import { T } from "@/components/ui/T";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { SITE, SOCIAL } from "@/lib/constants";

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
            <a href="#top">
              <T k="footer.home" />
            </a>
            <a href="#benefits">
              <T k="footer.explore" />
            </a>
            <a href="#how-it-works">
              <T k="footer.how" />
            </a>
            <a href="#preview">
              <T k="preview.title" />
            </a>
          </div>
          <div className="footer-col">
            <h5>
              <T k="footer.creators" />
            </h5>
            <a href="#creators">
              <T k="footer.creators" />
            </a>
            <a href={`mailto:${SITE.email}`}>
              <T k="nav.contact" />
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
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {year} {SITE.legalName} · D-U-N-S {SITE.duns}
          </span>
          <span>{SITE.address}</span>
        </div>
      </div>
    </footer>
  );
}
