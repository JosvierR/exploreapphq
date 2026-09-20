import { Link } from "react-router-dom";
import { Reveal } from "@/components/ui/Reveal";
import { T } from "@/components/ui/T";
import { SITE, SOCIAL, STORE_URLS } from "@/lib/constants";

/** Single closing CTA: download the app + join the community. */
export function UnifiedFinalCTA() {
  return (
    <section className="section" id="download" aria-labelledby="final-cta-title">
      <div className="container" id="unirme">
        <Reveal>
          <div className="cta-band">
            <h2 id="final-cta-title">
              <T k="unified.final.title" />
            </h2>
            <p className="cta-band__lead">
              <T k="unified.final.lead" />
            </p>
            <div className="btn-group">
              <a href={STORE_URLS.apple} className="btn btn-primary" target="_blank" rel="noopener noreferrer">
                <T k="cta.download" />
              </a>
              <a className="btn btn-ghost" href={STORE_URLS.play} target="_blank" rel="noopener noreferrer">
                <T k="pioneer.finalCta.cta.play" />
              </a>
              <a className="btn btn-ghost" href={SOCIAL.instagram} target="_blank" rel="noopener noreferrer">
                <T k="cta.community" />
              </a>
              <Link to="/lab" className="btn btn-ghost">
                <T k="lab.nav" />
              </Link>
            </div>
            <p className="cta-email">
              <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
