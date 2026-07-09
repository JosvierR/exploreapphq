import { LiquidButton } from "@/components/animate-ui/components/buttons/liquid";
import { T } from "@/components/ui/T";
import { SOCIAL, STORE_URLS } from "@/lib/constants";

export function PioneerFinalCTA() {
  return (
    <section className="pioneer-section pioneer-final" id="unirme" aria-labelledby="pioneer-final-title">
      <div className="container">
        <div className="pioneer-final__band">
          <p className="pioneer-eyebrow">
            <T k="pioneer.finalCta.eyebrow" />
          </p>
          <h2 id="pioneer-final-title">
            <T k="pioneer.finalCta.title" />
          </h2>
          <p>
            <T k="pioneer.finalCta.lead" />
          </p>
          <div className="pioneer-final__actions">
            <LiquidButton asChild className="pioneer-liquid-button" size="lg" hoverScale={1.02} tapScale={0.98}>
              <a href={STORE_URLS.apple} target="_blank" rel="noopener noreferrer">
                <T k="pioneer.finalCta.cta.apple" />
              </a>
            </LiquidButton>
            <a className="pioneer-secondary-button" href={STORE_URLS.play} target="_blank" rel="noopener noreferrer">
              <T k="pioneer.finalCta.cta.play" />
            </a>
            <a className="pioneer-social-link" href={SOCIAL.instagram} target="_blank" rel="noopener noreferrer">
              <T k="pioneer.finalCta.social.instagram" />
            </a>
            <a className="pioneer-social-link" href={SOCIAL.tiktok} target="_blank" rel="noopener noreferrer">
              <T k="pioneer.finalCta.social.tiktok" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
