import { HeroVisualLegacy } from "@/components/sections/legacy/HeroVisualLegacy";
import { Reveal } from "@/components/ui/Reveal";
import { T } from "@/components/ui/T";
import { APP_SCREENS, SITE, SOCIAL, STORE_URLS } from "@/lib/constants";
import type { TranslationKey } from "@/locales/messages";

function SectionTitle({ title, lead }: { title: TranslationKey; lead?: TranslationKey }) {
  return (
    <>
      <h2 className="section-title">
        <T k={title} />
      </h2>
      {lead && (
        <p className="section-lead">
          <T k={lead} />
        </p>
      )}
    </>
  );
}

export function LandingSectionsLegacy() {
  const benefits = [1, 2, 3, 4].map((n) => ({
    title: `benefits.${n}t` as TranslationKey,
    desc: `benefits.${n}d` as TranslationKey,
    icon: ["▶", "★", "↝", "↑"][n - 1],
  }));

  const howSteps = [1, 2, 3, 4, 5, 6].map((n) => `how.${n}` as TranslationKey);

  const nearbyPins: TranslationKey[] = [
    "nearby.pin1",
    "nearby.pin2",
    "nearby.pin3",
    "nearby.pin4",
    "nearby.pin5",
  ];

  const sharePoints: TranslationKey[] = ["share.1", "share.2", "share.3"];

  const audience = [1, 2, 3, 4].map((n) => ({
    title: `audience.${n}t` as TranslationKey,
    desc: `audience.${n}d` as TranslationKey,
  }));

  const previewItems: { key: TranslationKey; img?: string }[] = [
    { key: "preview.feed", img: APP_SCREENS.gallery[0] },
    { key: "preview.place", img: APP_SCREENS.gallery[1] },
    { key: "preview.map", img: APP_SCREENS.gallery[2] },
    { key: "preview.route", img: APP_SCREENS.gallery[3] },
    { key: "preview.create", img: APP_SCREENS.gallery[4] },
    { key: "preview.upload", img: APP_SCREENS.gallery[5] },
    { key: "preview.profile", img: APP_SCREENS.gallery[6] },
  ];

  const routeSteps: TranslationKey[] = [
    "routes.step1",
    "routes.step2",
    "routes.step3",
    "routes.step4",
    "routes.step5",
  ];

  const videoSpots: TranslationKey[] = ["videos.spot1", "videos.spot2", "videos.spot3"];

  return (
    <>
      <section className="hero hero-enter" id="top" aria-labelledby="hero-title">
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="hero-tagline">
              <T k="hero.tagline" />
            </p>
            <h1 id="hero-title" className="hero-title">
              <T k="hero.title" />
            </h1>
            <p className="hero-lead">
              <T k="hero.lead" />
            </p>
            <div className="badges">
              <span className="badge badge--accent">
                <T k="badge.videos" />
              </span>
              <span className="badge">
                <T k="badge.nearby" />
              </span>
              <span className="badge">
                <T k="badge.routes" />
              </span>
              <span className="badge">
                <T k="badge.share" />
              </span>
            </div>
            <div className="btn-group hero-enter-actions">
              <a href="#download" className="btn btn-primary">
                <T k="cta.start" />
              </a>
              <a href="#how-it-works" className="btn btn-ghost">
                <T k="cta.how" />
              </a>
            </div>
            <div className="flow-strip hero-enter-flow" aria-hidden="true">
              <span>
                <T k="flow.video" />
              </span>
              <span className="flow-arrow">→</span>
              <span>
                <T k="flow.place" />
              </span>
              <span className="flow-arrow">→</span>
              <span>
                <T k="flow.route" />
              </span>
              <span className="flow-arrow">→</span>
              <span>
                <T k="flow.explore" />
              </span>
            </div>
          </div>

          <Reveal delay={0.15} variant="right">
            <div className="hero-visual-wrap">
              <HeroVisualLegacy />
              <div className="hero-float-card">
                <T k="hero.float" />
                <span>
                  <T k="hero.floatSub" />
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section" id="benefits">
        <div className="container">
          <Reveal>
            <SectionTitle title="benefits.title" />
          </Reveal>
          <div className="grid-4">
            {benefits.map((item, i) => (
              <Reveal key={item.title} delay={i * 0.06}>
                <article className="card explore-card">
                  <div className="card-icon" aria-hidden="true">
                    {item.icon}
                  </div>
                  <h3>
                    <T k={item.title} />
                  </h3>
                  <p>
                    <T k={item.desc} />
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--gradient" id="how-it-works">
        <div className="container">
          <Reveal>
            <SectionTitle title="how.title" lead="how.lead" />
          </Reveal>
          <div className="how-flow">
            {howSteps.map((key, i) => (
              <Reveal key={key} delay={i * 0.05}>
                <div className="how-flow__step">
                  <span className="how-flow__num">{i + 1}</span>
                  <p>
                    <T k={key} />
                  </p>
                </div>
                {i < howSteps.length - 1 && (
                  <span className="how-flow__connector" aria-hidden="true" />
                )}
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="nearby">
        <div className="container nearby-layout">
          <Reveal>
            <SectionTitle title="nearby.title" lead="nearby.lead" />
          </Reveal>
          <Reveal delay={0.1}>
            <div className="nearby-map" aria-hidden="true">
              <div className="nearby-map__surface">
                {nearbyPins.map((key, i) => (
                  <div key={key} className={`nearby-chip nearby-chip--${i + 1}`}>
                    <span className="nearby-chip__dot" />
                    <T k={key} />
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section section--navy" id="videos">
        <div className="container videos-layout">
          <Reveal>
            <SectionTitle title="videos.title" lead="videos.lead" />
            <div className="btn-group videos-ctas">
              <span className="btn btn-ghost btn-sm">
                <T k="videos.ctaPlace" />
              </span>
              <span className="btn btn-ghost btn-sm">
                <T k="videos.ctaRoute" />
              </span>
            </div>
          </Reveal>
          <Reveal delay={0.1} variant="left">
            <div className="video-feed-mock">
              {APP_SCREENS.videoFeed.map((src, n) => (
                <div key={src} className={`video-feed-mock__card video-feed-mock__card--${n + 1}`}>
                  <div className="video-feed-mock__thumb">
                    <img src={src} alt="" loading="lazy" />
                  </div>
                  <div className="video-feed-mock__meta">
                    <span className="video-feed-mock__place">
                      <T k={videoSpots[n]} />
                    </span>
                    <span className="video-feed-mock__pin" />
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section" id="routes">
        <div className="container routes-layout">
          <Reveal>
            <SectionTitle title="routes.title" lead="routes.lead" />
          </Reveal>
          <Reveal delay={0.1} variant="scale">
            <div className="route-visual">
              <div className="route-visual__map">
                <img src={APP_SCREENS.routeMap} alt="" loading="lazy" />
                <div className="route-visual__map-layer" aria-hidden="true">
                  <span className="route-visual__path" />
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span key={n} className={`route-visual__point route-visual__point--${n}`} />
                  ))}
                </div>
              </div>
              <ol className="route-steps">
                {routeSteps.map((key) => (
                  <li key={key}>
                    <T k={key} />
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section section--gradient" id="share">
        <div className="container">
          <Reveal>
            <SectionTitle title="share.title" lead="share.lead" />
            <ul className="share-list">
              {sharePoints.map((key) => (
                <li key={key}>
                  <T k={key} />
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <section className="section" id="creators">
        <div className="container">
          <Reveal>
            <SectionTitle title="audience.title" />
          </Reveal>
          <div className="grid-4">
            {audience.map((item, i) => (
              <Reveal key={item.title} delay={i * 0.06}>
                <article className="card explore-card">
                  <h3>
                    <T k={item.title} />
                  </h3>
                  <p>
                    <T k={item.desc} />
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--navy" id="different">
        <div className="container">
          <Reveal>
            <SectionTitle title="diff.title" />
          </Reveal>
          <div className="diff-grid">
            <Reveal>
              <article className="diff-card">
                <h3>
                  <T k="diff.tiktok" />
                </h3>
                <p>
                  <T k="diff.tiktok.d" />
                </p>
              </article>
            </Reveal>
            <Reveal delay={0.06}>
              <article className="diff-card">
                <h3>
                  <T k="diff.maps" />
                </h3>
                <p>
                  <T k="diff.maps.d" />
                </p>
              </article>
            </Reveal>
            <Reveal delay={0.12}>
              <article className="diff-card diff-card--explore">
                <h3>
                  <T k="diff.explore" />
                </h3>
                <p className="diff-card__highlight">
                  <T k="diff.explore.d" />
                </p>
              </article>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="section" id="preview">
        <div className="container">
          <Reveal>
            <SectionTitle title="preview.title" />
          </Reveal>
          <div className="mockup-grid mockup-grid--7">
            {previewItems.map((item, i) => (
              <Reveal key={item.key} delay={i * 0.04}>
                <figure className="mockup-tile explore-mockup">
                  {item.img ? (
                    <img src={item.img} alt="" loading="lazy" />
                  ) : (
                    <div className="mockup-placeholder" />
                  )}
                  <figcaption className="label">
                    <T k={item.key} />
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="download">
        <div className="container">
          <Reveal>
            <div className="cta-band">
              <h2>
                <T k="cta.title" />
              </h2>
              <p className="cta-band__lead">
                <T k="cta.lead" />
              </p>
              <div className="btn-group">
                <a href={STORE_URLS.apple} className="btn btn-primary" target="_blank" rel="noopener noreferrer">
                  <T k="cta.download" />
                </a>
                <a href="#top" className="btn btn-ghost">
                  <T k="cta.start" />
                </a>
                <a href={SOCIAL.instagram} className="btn btn-ghost" target="_blank" rel="noopener noreferrer">
                  <T k="cta.community" />
                </a>
              </div>
              <p className="cta-email">
                <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
              </p>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
