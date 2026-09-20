import { Suspense, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { T } from "@/components/ui/T";
import {
  fetchPublicRoutePreview,
  peekCachedRoutePreview,
} from "@/features/share/api/fetchPublicRoutePreview";
import { RouteShareMap } from "@/features/share/components/RouteShareMap";
import {
  budgetLevelSymbol,
  buildDirectionsUrl,
  buildMapsUrl,
  estimateDurationFromDistanceM,
  formatDifficulty,
  formatDistanceMeters,
  formatElevationMeters,
  formatEstimatedDuration,
  formatLatLng,
  formatRating,
  resolveDisplayDistanceM,
} from "@/features/share/lib/formatRoutePreview";
import { buildShortRoutePath, resolveRouteUuid } from "@/features/share/lib/routeShortCode";
import type { PublicRoutePreview, PublicRoutePreviewResult, PublicRouteStop } from "@/features/share/types";
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

function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="route-share-copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        } catch {
          /* ignore */
        }
      }}
    >
      {copied ? <T k="routeShare.link.copied" /> : <T k="routeShare.link.copy" />}
    </button>
  );
}

function HighlightChips({ preview }: { preview: PublicRoutePreview }) {
  const distanceM = resolveDisplayDistanceM(preview.distanceM, preview.stops);
  const chips = [
    { labelKey: "routeShare.stat.distance" as const, value: formatDistanceMeters(distanceM) },
    {
      labelKey: "routeShare.stat.duration" as const,
      value:
        formatEstimatedDuration(preview.estimatedDuration) || estimateDurationFromDistanceM(distanceM),
    },
    { labelKey: "routeShare.stat.budget" as const, value: budgetLevelSymbol(preview.budgetLevel) },
    { labelKey: "routeShare.stat.difficulty" as const, value: formatDifficulty(preview.difficulty) },
    { labelKey: "routeShare.stat.stops" as const, value: String(preview.stops.length) },
    { labelKey: "routeShare.stat.elevation" as const, value: formatElevationMeters(preview.elevationGain) },
    {
      labelKey: "routeShare.stat.rating" as const,
      value: formatRating(preview.averageRating, preview.totalRatings),
    },
    {
      labelKey: "routeShare.stat.category" as const,
      value: preview.category ? preview.category.replace(/_/g, " ") : null,
    },
  ].filter((chip) => Boolean(chip.value));

  return (
    <ul className="route-share-highlights" aria-label="Route highlights">
      {chips.map((chip) => (
        <li key={chip.labelKey}>
          <span>
            <T k={chip.labelKey} />
          </span>
          <strong
            className={
              chip.labelKey === "routeShare.stat.category" || chip.labelKey === "routeShare.stat.difficulty"
                ? "route-share-stat-cap"
                : undefined
            }
          >
            {chip.value}
          </strong>
        </li>
      ))}
    </ul>
  );
}

function StopCard({ stop, index }: { stop: PublicRouteStop; index: number }) {
  const hasGeo = stop.lat != null && stop.lng != null;
  const mapsHref = hasGeo ? buildMapsUrl(stop.lat!, stop.lng!, stop.name) : null;
  const directionsHref = hasGeo ? buildDirectionsUrl(stop.lat!, stop.lng!) : null;

  return (
    <li className="route-share-stop-card">
      <div className="route-share-stop-card__media">
        {stop.photoUrl ? <img src={stop.photoUrl} alt="" loading="lazy" /> : <div className="route-share-stop-card__placeholder" />}
        <span className="route-share-stop-num" aria-hidden="true">
          {index + 1}
        </span>
      </div>

      <div className="route-share-stop-card__body">
        <div className="route-share-stop-card__head">
          <strong>{stop.name}</strong>
          {stop.category ? <small className="route-share-stat-cap">{stop.category.replace(/_/g, " ")}</small> : null}
        </div>

        {hasGeo ? (
          <div className="route-share-stop-card__location">
            <p className="route-share-stop-card__coords">{formatLatLng(stop.lat!, stop.lng!)}</p>
            <div className="route-share-stop-card__actions">
              <a href={mapsHref!} target="_blank" rel="noopener noreferrer" className="route-share-loc-btn">
                <T k="routeShare.stop.maps" />
              </a>
              <a href={directionsHref!} target="_blank" rel="noopener noreferrer" className="route-share-loc-btn route-share-loc-btn--ghost">
                <T k="routeShare.stop.directions" />
              </a>
            </div>
          </div>
        ) : (
          <p className="route-share-stop-card__no-geo">
            <T k="routeShare.stop.noLocation" />
          </p>
        )}
      </div>
    </li>
  );
}

function RouteStopsList({ preview }: { preview: PublicRoutePreview }) {
  if (preview.stops.length === 0) {
    return (
      <p className="route-share-empty-stops">
        <T k="routeShare.stops.empty" />
      </p>
    );
  }

  return (
    <ol className="route-share-stops" id="route-preview">
      {preview.stops.map((stop, index) => (
        <StopCard key={`${stop.placeId}-${stop.position}`} stop={stop} index={index} />
      ))}
    </ol>
  );
}

function RouteShareSkeleton() {
  return (
    <div className="route-share-skeleton" aria-busy="true" aria-live="polite">
      <div className="route-share-skel route-share-skel--cover" />
      <div className="route-share-skel route-share-skel--badge" />
      <div className="route-share-skel route-share-skel--title" />
      <div className="route-share-skel route-share-skel--line" />
      <div className="route-share-skel route-share-skel--line route-share-skel--line-short" />
      <div className="route-share-skel-row">
        <div className="route-share-skel route-share-skel--chip" />
        <div className="route-share-skel route-share-skel--chip" />
        <div className="route-share-skel route-share-skel--chip" />
        <div className="route-share-skel route-share-skel--chip" />
      </div>
      <div className="route-share-skel route-share-skel--banner" />
      <div className="route-share-skel route-share-skel--card" />
      <div className="route-share-skel route-share-skel--card" />
    </div>
  );
}

/**
 * Public route share landing for Instagram / Universal Links.
 * Short `/r/{code}` URLs, web itinerary + live map, or open/download the app.
 */
export function RouteSharePage() {
  const { routeId: rawRef } = useParams<{ routeId: string }>();
  const ref = rawRef?.trim() ?? "";
  const { t } = useI18n();
  const [result, setResult] = useState<PublicRoutePreviewResult | null>(() => {
    const cached = peekCachedRoutePreview(ref);
    return cached ? { status: "ok", preview: cached } : null;
  });

  useEffect(() => {
    let cancelled = false;
    const cached = peekCachedRoutePreview(ref);
    setResult(cached ? { status: "ok", preview: cached } : null);
    void fetchPublicRoutePreview(ref).then((next) => {
      if (!cancelled) setResult(next);
    });
    return () => {
      cancelled = true;
    };
  }, [ref]);

  const preview = result?.status === "ok" ? result.preview : null;
  const loading = result === null;
  const failed = result != null && result.status !== "ok";
  const routeUuid = preview?.id ?? resolveRouteUuid(ref);
  const shortPath = preview
    ? buildShortRoutePath({ id: preview.id, name: preview.name })
    : ref
      ? `/r/${encodeURIComponent(ref)}`
      : "/r";
  const canonicalUrl = buildExploreShareUrl(shortPath);
  // Prefer https store / resolved deep link — never fire empty explore:// while loading.
  const appHref = routeUuid ? `explore://r/${encodeURIComponent(routeUuid)}` : STORE_URLS.apple;
  const cover = preview?.coverUrl || preview?.photoStrip[0] || null;

  usePageMeta({
    title: preview ? `${preview.name} — Explore` : t("routeShare.meta.title"),
    description: preview?.description?.trim() || t("routeShare.meta.description"),
    path: shortPath,
    imagePath: cover || "/ExplorePromo1.png",
  });

  return (
    <main className="deeplink-page route-share-page">
      <section className="route-share-layout" aria-labelledby="route-share-title">
        <div className="route-share-panel">
          <Link to="/" className="deeplink-brand" aria-label="Explore home">
            <BrandLogo size={42} />
          </Link>

          {loading ? <RouteShareSkeleton /> : null}

          {!loading && preview ? (
            <div className="route-share-ready">
              {cover ? (
                <div className="route-share-hero-cover">
                  <img src={cover} alt="" />
                  <div className="route-share-hero-cover__fade" />
                </div>
              ) : null}

              <div className="route-share-kicker">
                <span className="deeplink-badge">
                  <T k="routeShare.badge" />
                </span>
                <span className="route-share-kicker-note">
                  <T k="routeShare.kicker" />
                </span>
              </div>

              <h1 id="route-share-title">{preview.name}</h1>

              <p className="route-share-lead">
                <T k="routeShare.lead.preview" />
              </p>

              {preview.description ? <p className="route-share-desc">{preview.description}</p> : null}

              <HighlightChips preview={preview} />

              <div className="route-share-link-row">
                <code className="route-share-link-url">{canonicalUrl.replace(/^https:\/\//, "")}</code>
                <CopyLinkButton url={canonicalUrl} />
              </div>

              <div className="route-share-choice" role="group" aria-label={t("routeShare.choice.label")}>
                <a className="deeplink-open-btn" href={appHref}>
                  <T k="routeShare.cta.doIt" />
                </a>
                <a className="deeplink-open-btn deeplink-open-btn--ghost" href="#route-preview">
                  <T k="routeShare.cta.web" />
                </a>
              </div>

              <aside className="route-share-download-banner" aria-label={t("routeShare.download.banner.title")}>
                <div className="route-share-download-banner__copy">
                  <h2>
                    <T k="routeShare.download.banner.title" />
                  </h2>
                  <p>
                    <T k="routeShare.download.banner.lead" />
                  </p>
                </div>
                <div className="route-share-download-banner__actions">
                  <a className="deeplink-open-btn" href={appHref}>
                    <T k="routeShare.cta.app" />
                  </a>
                  <div className="route-share-download-banner__stores">
                    <StoreBadges />
                  </div>
                </div>
              </aside>

              <div className="route-share-itinerary">
                <div className="route-share-itinerary__head">
                  <h2>
                    <T k="routeShare.itinerary.title" />
                  </h2>
                  <p>
                    <T k="routeShare.itinerary.sub" />
                  </p>
                </div>
                <RouteStopsList preview={preview} />
                <div className="route-share-app-nudge">
                  <p>
                    <T k="routeShare.download.nudge" />
                  </p>
                  <a className="route-share-loc-btn" href={appHref}>
                    <T k="routeShare.cta.app" />
                  </a>
                </div>
              </div>
            </div>
          ) : null}

          {!loading && failed ? (
            <div className="route-share-ready">
              <span className="deeplink-badge">
                <T k="routeShare.badge" />
              </span>
              <h1 id="route-share-title">
                <T k="routeShare.title.unavailable" />
              </h1>
              <p>
                <T
                  k={
                    result?.status === "unconfigured"
                      ? "routeShare.lead.unconfigured"
                      : result?.status === "error"
                        ? "routeShare.lead.error"
                        : "routeShare.lead.missing"
                  }
                />
              </p>
              <div className="route-share-download-banner">
                <div className="route-share-download-banner__copy">
                  <h2>
                    <T k="routeShare.download.banner.title" />
                  </h2>
                  <p>
                    <T k="routeShare.download.banner.lead" />
                  </p>
                </div>
                <div className="route-share-download-banner__actions">
                  <div className="route-share-download-banner__stores">
                    <StoreBadges />
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="route-share-map-col">
          {loading ? <div className="route-share-map-loading" aria-busy="true" /> : null}
          {!loading && preview ? (
            <Suspense fallback={<div className="route-share-map-loading" aria-busy="true" />}>
              <RouteShareMap preview={preview} />
            </Suspense>
          ) : null}
          {!loading && failed ? (
            <div className="route-share-map route-share-map--empty" aria-hidden="true">
              <div className="route-share-map__empty">
                <p>
                  <T k="routeShare.map.empty" />
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export default RouteSharePage;
