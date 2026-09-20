import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { T } from "@/components/ui/T";
import { fetchPublicRoutePreview } from "@/features/share/api/fetchPublicRoutePreview";
import {
  formatDifficulty,
  formatDistanceMeters,
  formatEstimatedDuration,
} from "@/features/share/lib/formatRoutePreview";
import type { PublicRoutePreview, PublicRoutePreviewResult } from "@/features/share/types";
import { useI18n } from "@/features/i18n/I18nProvider";
import { usePageMeta } from "@/hooks/usePageMeta";
import { STORE_URLS } from "@/lib/constants";
import { buildExploreShareUrl } from "@/lib/exploreWebUrl";
import "@/styles/deeplink.css";
import "@/styles/route-share.css";

function StoreBadges() {
  return (
    <>
      <a className="deeplink-store-link" href={STORE_URLS.apple} aria-label="Download Explore on the App Store">
        <img src="/appstore-badge.svg" alt="Download on the App Store" />
      </a>
      <a className="deeplink-store-link" href={STORE_URLS.play} aria-label="Get Explore on Google Play">
        <img src="/googleplay-badge.svg" alt="Get it on Google Play" />
      </a>
    </>
  );
}

function RoutePreviewBody({ preview }: { preview: PublicRoutePreview }) {
  const distance = formatDistanceMeters(preview.distanceM);
  const duration = formatEstimatedDuration(preview.estimatedDuration);
  const difficulty = formatDifficulty(preview.difficulty);
  const cover = preview.coverUrl || "/ExplorePromo1.png";

  return (
    <div className="route-share-preview" id="route-preview">
      <div className="route-share-cover">
        <img src={cover} alt="" />
      </div>

      <ul className="route-share-stats" aria-label="Route stats">
        {distance ? (
          <li>
            <span>
              <T k="routeShare.stat.distance" />
            </span>
            <strong>{distance}</strong>
          </li>
        ) : null}
        {duration ? (
          <li>
            <span>
              <T k="routeShare.stat.duration" />
            </span>
            <strong>{duration}</strong>
          </li>
        ) : null}
        {difficulty ? (
          <li>
            <span>
              <T k="routeShare.stat.difficulty" />
            </span>
            <strong className="route-share-stat-cap">{difficulty}</strong>
          </li>
        ) : null}
        {preview.category ? (
          <li>
            <span>
              <T k="routeShare.stat.category" />
            </span>
            <strong className="route-share-stat-cap">{preview.category.replace(/_/g, " ")}</strong>
          </li>
        ) : null}
        {preview.stops.length > 0 ? (
          <li>
            <span>
              <T k="routeShare.stat.stops" />
            </span>
            <strong>{preview.stops.length}</strong>
          </li>
        ) : null}
      </ul>

      {preview.description ? <p className="route-share-desc">{preview.description}</p> : null}

      {preview.stops.length > 0 ? (
        <ol className="route-share-stops">
          {preview.stops.map((stop) => (
            <li key={`${stop.placeId}-${stop.position}`}>
              <span className="route-share-stop-num" aria-hidden="true">
                {stop.position + 1}
              </span>
              <div className="route-share-stop-body">
                <strong>{stop.name}</strong>
                {stop.category ? <small className="route-share-stat-cap">{stop.category.replace(/_/g, " ")}</small> : null}
              </div>
              {stop.photoUrl ? (
                <img className="route-share-stop-thumb" src={stop.photoUrl} alt="" loading="lazy" />
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="route-share-empty-stops">
          <T k="routeShare.stops.empty" />
        </p>
      )}

      <p className="route-share-web-note">
        <T k="routeShare.web.note" />
      </p>
    </div>
  );
}

/**
 * Public route share landing for Instagram / Universal Links.
 * Web preview when published+public; always offers open-in-app + download.
 */
export function RouteSharePage() {
  const { routeId: rawId } = useParams<{ routeId: string }>();
  const routeId = rawId?.trim() ?? "";
  const { t } = useI18n();
  const [result, setResult] = useState<PublicRoutePreviewResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    void fetchPublicRoutePreview(routeId).then((next) => {
      if (!cancelled) setResult(next);
    });
    return () => {
      cancelled = true;
    };
  }, [routeId]);

  const preview = result?.status === "ok" ? result.preview : null;
  const loading = result === null;
  const sharePath = `/r/${encodeURIComponent(routeId || "unknown")}`;
  const canonicalUrl = buildExploreShareUrl(sharePath);
  const appHref = `explore://r/${encodeURIComponent(routeId)}`;

  usePageMeta({
    title: preview ? `${preview.name} — Explore` : t("routeShare.meta.title"),
    description: preview?.description?.trim() || t("routeShare.meta.description"),
    path: sharePath,
    imagePath: preview?.coverUrl || "/ExplorePromo1.png",
  });

  return (
    <main className="deeplink-page route-share-page">
      <section className="deeplink-shell route-share-shell" aria-labelledby="route-share-title">
        <div className="deeplink-copy">
          <Link to="/" className="deeplink-brand" aria-label="Explore home">
            <BrandLogo size={42} />
          </Link>

          <span className="deeplink-badge">
            <T k="routeShare.badge" />
          </span>

          <h1 id="route-share-title">{preview ? preview.name : <T k="routeShare.title.fallback" />}</h1>

          {loading ? (
            <p aria-busy="true">
              <T k="routeShare.loading" />
            </p>
          ) : null}

          {!loading && result?.status === "ok" ? (
            <p>
              <T k="routeShare.lead.preview" />
            </p>
          ) : null}

          {!loading && result?.status === "not_found" ? (
            <p>
              <T k="routeShare.lead.missing" />
            </p>
          ) : null}

          {!loading && result?.status === "unconfigured" ? (
            <p>
              <T k="routeShare.lead.unconfigured" />
            </p>
          ) : null}

          {!loading && result?.status === "error" ? (
            <p>
              <T k="routeShare.lead.error" />
            </p>
          ) : null}

          <div className="route-share-choice" role="group" aria-label={t("routeShare.choice.label")}>
            {preview ? (
              <a className="deeplink-open-btn deeplink-open-btn--ghost" href="#route-preview">
                <T k="routeShare.cta.web" />
              </a>
            ) : null}
            <a className="deeplink-open-btn" href={appHref}>
              <T k="routeShare.cta.app" />
            </a>
          </div>

          <div className="deeplink-actions route-share-stores">
            <p className="route-share-download-label">
              <T k="routeShare.cta.download" />
            </p>
            <StoreBadges />
          </div>

          {preview ? <RoutePreviewBody preview={preview} /> : null}

          {!preview && !loading ? (
            <dl className="deeplink-meta" aria-label="Shared link details">
              <div>
                <dt>
                  <T k="routeShare.meta.routeId" />
                </dt>
                <dd>{routeId || "—"}</dd>
              </div>
              <div>
                <dt>
                  <T k="routeShare.meta.link" />
                </dt>
                <dd>{canonicalUrl}</dd>
              </div>
            </dl>
          ) : null}
        </div>

        {!preview ? (
          <div className="deeplink-visual" aria-hidden="true">
            <img src="/ExplorePromo1.png" alt="" />
            <span>
              <T k="routeShare.badge" />
            </span>
          </div>
        ) : null}
      </section>
    </main>
  );
}

export default RouteSharePage;
