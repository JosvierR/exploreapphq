import { Link, useLocation } from "react-router-dom";
import { T } from "@/components/ui/T";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { SITE, SOCIAL, STORE_URLS } from "@/lib/constants";
import { isPioneersHomePath } from "@/features/pioneers/lib/paths";

export function SiteFooter() {
  const year = new Date().getFullYear();
  const { pathname } = useLocation();
  const pioneersHome = isPioneersHomePath(pathname);

  return (
    <footer className="site-footer" id="contact">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link to="/" className="brand">
              <BrandLogo />
            </Link>
            <p>
              <T k={pioneersHome ? "footer.pioneers.desc" : "footer.desc"} />
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
              <T k={pioneersHome ? "footer.pioneers.program" : "footer.home"} />
            </h5>
            {pioneersHome ? (
              <>
                <a href="#top">
                  <T k="footer.home" />
                </a>
                <a href="#retos">
                  <T k="pioneer.nav.challenges" />
                </a>
                <a href="#ranking">
                  <T k="pioneer.nav.leaderboard" />
                </a>
                <a href="#recompensas">
                  <T k="pioneer.nav.rewards" />
                </a>
                <Link to="/explorar">
                  <T k="nav.discover" />
                </Link>
              </>
            ) : (
              <>
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
                <Link to="/">
                  <T k="nav.pioneers" />
                </Link>
              </>
            )}
          </div>
          <div className="footer-col">
            <h5>
              <T k="footer.creators" />
            </h5>
            {pioneersHome ? (
              <>
                <a href="#unirme">
                  <T k="pioneer.nav.join" />
                </a>
                <a href="#showcase">
                  <T k="pioneer.showcase.title" />
                </a>
              </>
            ) : (
              <a href="#creators">
                <T k="footer.creators" />
              </a>
            )}
            <a href={`mailto:${SITE.email}`}>
              <T k="nav.contact" />
            </a>
            <a href={`mailto:${SITE.email}?subject=Explore%20account%20or%20data%20deletion`}>
              Delete account/data
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
            <Link to="/safety">Safety</Link>
            <a href={STORE_URLS.apple} target="_blank" rel="noopener noreferrer">
              App Store
            </a>
            <a href={STORE_URLS.play} target="_blank" rel="noopener noreferrer">
              Google Play
            </a>
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
