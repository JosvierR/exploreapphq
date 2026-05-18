import { APP_SCREENS } from "@/lib/constants";

const phones = APP_SCREENS.heroStack;

export function HeroVisual() {
  return (
    <div className="hero-visual hero-visual--animated">
      <div className="hero-visual__glow" aria-hidden="true" />

      <div className="hero-map-panel">
        <img
          src={APP_SCREENS.heroMap}
          alt=""
          className="hero-map-panel__screenshot"
          loading="eager"
        />
        <div className="hero-map-panel__overlay" aria-hidden="true">
          <div className="hero-map-panel__grid" />
          <span className="map-pin map-pin--1" />
          <span className="map-pin map-pin--2" />
          <span className="map-pin map-pin--3" />
          <span className="map-route-line" />
        </div>
      </div>

      <div className="hero-phones">
        <div className="hero-phone-wrap hero-phone-wrap--back hero-phone-wrap--left">
          <img
            src={phones.left}
            alt=""
            className="hero-phone hero-phone--secondary"
            width={200}
            height={430}
            loading="eager"
          />
        </div>
        <div className="hero-phone-wrap hero-phone-wrap--main">
          <img
            src={APP_SCREENS.hero}
            alt="Explore app — video feed of real places near you"
            className="hero-phone hero-phone--main"
            width={300}
            height={650}
            loading="eager"
            fetchPriority="high"
          />
        </div>
        <div className="hero-phone-wrap hero-phone-wrap--back hero-phone-wrap--right">
          <img
            src={phones.right}
            alt=""
            className="hero-phone hero-phone--secondary"
            width={200}
            height={430}
            loading="eager"
          />
        </div>
      </div>

      <div className="hero-connector" aria-hidden="true">
        <span className="hero-connector__dot hero-connector__dot--video" />
        <span className="hero-connector__line" />
        <span className="hero-connector__dot hero-connector__dot--place" />
        <span className="hero-connector__line" />
        <span className="hero-connector__dot hero-connector__dot--route" />
      </div>
    </div>
  );
}
