import { useReducedMotion } from "motion/react";
import { LiquidButton } from "@/components/animate-ui/components/buttons/liquid";
import { ShimmeringText } from "@/components/animate-ui/primitives/texts/shimmering";
import { SlidingNumber } from "@/components/animate-ui/primitives/texts/sliding-number";
import { T } from "@/components/ui/T";
import { useI18n } from "@/features/i18n/I18nProvider";
import { APP_SCREENS } from "@/lib/constants";
import type { PioneerStats } from "@/features/pioneers/types";
import type { TranslationKey } from "@/locales/messages";

type PioneerHeroProps = {
  stats: PioneerStats;
  loading?: boolean;
  source?: "mock" | "api";
};

const HERO_BADGES: TranslationKey[] = [
  "pioneer.hero.badge.videos",
  "pioneer.hero.badge.places",
  "pioneer.hero.badge.routes",
  "pioneer.hero.badge.badges",
];

function HeroStat({ value, label }: { value: number; label: TranslationKey }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="pioneer-hero-stat">
      <strong>
        +{reduceMotion ? value : <SlidingNumber number={value} inView />}
      </strong>
      <span>
        <T k={label} />
      </span>
    </div>
  );
}

export function PioneerHero({ stats, loading = false, source = "mock" }: PioneerHeroProps) {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();

  return (
    <section className="pioneer-hero" id="top" aria-labelledby="pioneer-hero-title">
      <div className="pioneer-hero__glow" aria-hidden="true" />
      <div className="container pioneer-hero__grid">
        <div className="pioneer-hero__copy pioneer-hero__copy--enter">
          <p className="pioneer-eyebrow">
            {reduceMotion ? (
              <T k="pioneer.hero.eyebrow" />
            ) : (
              <ShimmeringText
                text={t("pioneer.hero.eyebrow")}
                color="rgba(184, 194, 204, 0.72)"
                shimmeringColor="#ffffff"
                duration={1.4}
              />
            )}
          </p>
          <h1 id="pioneer-hero-title" className="pioneer-hero__title">
            <span className="pioneer-hero__title-lead">
              <T k="pioneer.hero.titleLead" />
            </span>
            <span className="pioneer-hero__title-accent">
              <T k="pioneer.hero.titleAccent" />
            </span>
          </h1>
          <p className="pioneer-hero__lead">
            <T k="pioneer.hero.subtitle" />
          </p>
          <div className="pioneer-hero__badges" aria-label={t("pioneer.hero.badges.label")}>
            {HERO_BADGES.map((key, index) => (
              <span
                key={key}
                className={`pioneer-badge${index === 0 ? " pioneer-badge--accent" : ""}`}
              >
                <T k={key} />
              </span>
            ))}
          </div>
          <div className="pioneer-hero__actions">
            <LiquidButton asChild className="pioneer-liquid-button" size="lg" hoverScale={1.02} tapScale={0.98}>
              <a href="#unirme">
                <T k="pioneer.hero.cta.primary" />
              </a>
            </LiquidButton>
            <a className="pioneer-secondary-button" href="#retos">
              <T k="pioneer.hero.cta.secondary" />
            </a>
          </div>
          <div className="pioneer-hero__flow" aria-hidden="true">
            <span>
              <T k="pioneer.hero.flow.video" />
            </span>
            <span className="pioneer-hero__flow-arrow">→</span>
            <span>
              <T k="pioneer.hero.flow.place" />
            </span>
            <span className="pioneer-hero__flow-arrow">→</span>
            <span>
              <T k="pioneer.hero.flow.route" />
            </span>
            <span className="pioneer-hero__flow-arrow">→</span>
            <span>
              <T k="pioneer.hero.flow.badge" />
            </span>
          </div>
          <div className="pioneer-hero__stats" aria-label={t("pioneer.hero.stats.label")}>
            {loading && source !== "api" ? (
              <p className="pioneer-hero__loading">
                <T k="pioneer.hero.loading" />
              </p>
            ) : (
              <>
                <HeroStat value={stats.placesThisWeek} label="pioneer.stats.places" />
                <HeroStat value={stats.routesThisWeek} label="pioneer.stats.routes" />
                <HeroStat value={stats.videosThisWeek} label="pioneer.stats.videos" />
              </>
            )}
          </div>
        </div>

        <div className="pioneer-hero__visual pioneer-hero__visual--enter" aria-label={t("pioneer.hero.visual.label")}>
          <div className="pioneer-map-card">
            <img src={APP_SCREENS.heroMap} alt="" loading="eager" />
            <div className="pioneer-map-card__overlay">
              <span className="pioneer-map-pin pioneer-map-pin--1" />
              <span className="pioneer-map-pin pioneer-map-pin--2" />
              <span className="pioneer-map-pin pioneer-map-pin--3" />
              <span className="pioneer-map-route" />
            </div>
          </div>
          <div className="pioneer-phone-stack">
            <img className="pioneer-phone pioneer-phone--side" src={APP_SCREENS.heroStack.left} alt="" loading="eager" />
            <img
              className="pioneer-phone pioneer-phone--main"
              src={APP_SCREENS.hero}
              alt={t("pioneer.hero.phone.alt")}
              loading="eager"
              fetchPriority="high"
            />
            <img className="pioneer-phone pioneer-phone--side" src={APP_SCREENS.heroStack.right} alt="" loading="eager" />
          </div>
          <div className="pioneer-float-card pioneer-float-card--video">
            <span className="pioneer-float-card__icon" aria-hidden="true">
              ▶
            </span>
            <span>
              <T k="pioneer.hero.float.video" />
            </span>
          </div>
          <div className="pioneer-float-card pioneer-float-card--route">
            <span className="pioneer-float-card__icon" aria-hidden="true">
              ↝
            </span>
            <span>
              <T k="pioneer.hero.float.route" />
            </span>
          </div>
          <div className="pioneer-float-card pioneer-float-card--badge">
            <span className="pioneer-float-card__icon" aria-hidden="true">
              ★
            </span>
            <span>
              <T k="pioneer.hero.float.badge" />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
