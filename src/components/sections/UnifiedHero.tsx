import { HeroVisual } from "@/components/sections/HeroVisual";
import { T } from "@/components/ui/T";
import { STORE_URLS } from "@/lib/constants";

/** Product-first hero: promote Explore app, then invite into community proof below. */
export function UnifiedHero() {
  return (
    <section className="hero hero-enter unified-hero" id="top" aria-labelledby="hero-title">
      <div className="container hero-grid">
        <div className="hero-copy">
          <p className="hero-brand">
            <T k="unified.hero.brand" />
          </p>
          <h1 id="hero-title" className="hero-title">
            <T k="unified.hero.title" />
          </h1>
          <p className="hero-lead">
            <T k="unified.hero.lead" />
          </p>
          <div className="btn-group hero-enter-actions">
            <a href={STORE_URLS.apple} className="btn btn-primary" target="_blank" rel="noopener noreferrer">
              <T k="cta.download" />
            </a>
            <a href="#retos" className="btn btn-ghost">
              <T k="unified.hero.cta.community" />
            </a>
          </div>
        </div>
        <HeroVisual />
      </div>
    </section>
  );
}
