import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { T } from "@/components/ui/T";
import { useI18n } from "@/features/i18n/I18nProvider";
import { CHALLENGE_MISSION_META } from "@/features/pioneers/lib/challengeConfig";
import {
  challengeAppScheme,
  challengeWebPath,
  isChallengeType,
  tryOpenExploreApp,
} from "@/features/pioneers/lib/exploreAppLink";
import { STORE_URLS } from "@/lib/constants";
import "@/styles/deeplink.css";

export function ChallengeMissionPage() {
  const { type: rawType } = useParams();
  const { t } = useI18n();
  const type = rawType && isChallengeType(rawType) ? rawType : null;
  const config = type ? CHALLENGE_MISSION_META[type] : null;
  const schemeUrl = type ? challengeAppScheme(type) : null;

  useEffect(() => {
    if (!schemeUrl) return;
    const timer = window.setTimeout(() => tryOpenExploreApp(schemeUrl), 400);
    return () => window.clearTimeout(timer);
  }, [schemeUrl]);

  if (!type || !config || !schemeUrl) {
    return (
      <main className="deeplink-page">
        <section className="deeplink-shell">
          <div className="deeplink-copy">
            <Link to="/" className="deeplink-brand" aria-label="Explore home">
              <BrandLogo size={42} />
            </Link>
            <h1>Mission not found</h1>
            <p>
              <Link to="/#retos">
                <T k="pioneer.challenge.backToMissions" />
              </Link>
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="deeplink-page">
      <section className="deeplink-shell challenge-mission-shell" aria-labelledby="challenge-mission-title">
        <div className="deeplink-copy">
          <Link to="/" className="deeplink-brand" aria-label="Explore home">
            <BrandLogo size={42} />
          </Link>

          <span className="deeplink-badge">
            <T k="pioneer.challenges.eyebrow" />
          </span>
          <h1 id="challenge-mission-title">
            <T k={config.titleKey} />
          </h1>
          <p>
            <T k={config.descriptionKey} />
          </p>
          <p>{t("pioneer.challenge.openAppHint")}</p>

          <div className="deeplink-actions">
            <button type="button" className="deeplink-open-btn" onClick={() => tryOpenExploreApp(schemeUrl)}>
              <T k="pioneer.challenge.openApp" />
            </button>
            <a className="deeplink-store-link" href={STORE_URLS.apple} aria-label="Download Explore on the App Store">
              <img src="/appstore-badge.svg" alt="Download on the App Store" />
            </a>
            <a className="deeplink-store-link" href={STORE_URLS.play} aria-label="Get Explore on Google Play">
              <img src="/googleplay-badge.svg" alt="Get it on Google Play" />
            </a>
          </div>

          <p className="challenge-mission-back">
            <Link to="/#retos">
              <T k="pioneer.challenge.backToMissions" />
            </Link>
          </p>
        </div>

        <div className="deeplink-visual challenge-mission-visual" aria-hidden="true">
          <img src={config.image} alt="" />
          <span>{challengeWebPath(type)}</span>
        </div>
      </section>
    </main>
  );
}
