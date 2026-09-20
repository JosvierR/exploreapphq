import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { T } from "@/components/ui/T";
import { fetchPublicRoutePreview } from "@/features/share/api/fetchPublicRoutePreview";
import { buildShortRoutePath, resolveRouteUuid } from "@/features/share/lib/routeShortCode";
import type { PublicRoutePreview, PublicRoutePreviewResult } from "@/features/share/types";
import { useI18n } from "@/features/i18n/I18nProvider";
import { usePageMeta } from "@/hooks/usePageMeta";
import { STORE_URLS } from "@/lib/constants";
import { buildExploreShareUrl } from "@/lib/exploreWebUrl";
import "@/styles/deeplink.css";
import "@/styles/route-share.css";

const RouteShareMap = lazy(() =>
  import("@/features/share/components/RouteShareMap").then((m) => ({ default: m.RouteShareMap })),
);

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
        <li key={`${stop.placeId}-${stop.position}`}>
          <span className="route-share-stop-num" aria-hidden="true">
            {index + 1}
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
  const [result, setResult] = useState<PublicRoutePreviewResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    void fetchPublicRoutePreview(ref).then((next) => {
      if (!cancelled) setResult(next);
    });
    return () => {
      cancelled = true;
    };
  }, [ref]);

  const preview = result?.status === "ok" ? result.preview : null;
  const loading = result === null;
  const routeUuid = preview?.id ?? resolveRouteUuid(ref);
  const shortPath = preview
    ? buildShortRoutePath({ id: preview.id, name: preview.name })
    : ref
      ? `/r/${encodeURIComponent(ref)}`
      : "/r";
  const canonicalUrl = buildExploreShareUrl(shortPath);
  const appHref = routeUuid ? `explore://r/${encodeURIComponent(routeUuid)}` : "explore://";

  usePageMeta({
    title: preview ? `${preview.name} — Explore` : t("routeShare.meta.title"),
    description: preview?.description?.trim() || t("routeShare.meta.description"),
    path: shortPath,
    imagePath: preview?.coverUrl || "/ExplorePromo1.png",
  });

  return (
    <main className="deeplink-page route-share-page">
      <section className="route-share-layout" aria-labelledby="route-share-title">
        <div className="route-share-panel">
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
            <p className="route-share-lead">
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

          {preview?.description ? <p className="route-share-desc">{preview.description}</p> : null}

          <div className="route-share-link-row">
            <code className="route-share-link-url">{canonicalUrl.replace(/^https:\/\//, "")}</code>
            <CopyLinkButton url={canonicalUrl} />
          </div>

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

          {preview ? (
            <div className="route-share-itinerary">
              <h2>
                <T k="routeShare.itinerary.title" />
              </h2>
              <RouteStopsList preview={preview} />
              <p className="route-share-web-note">
                <T k="routeShare.web.note" />
              </p>
            </div>
          ) : null}
        </div>

        <div className="route-share-map-col">
          {preview ? (
            <Suspense fallback={<div className="route-share-map-loading" aria-busy="true" />}>
              <RouteShareMap preview={preview} />
            </Suspense>
          ) : (
            <div className="deeplink-visual route-share-fallback-visual" aria-hidden="true">
              <img src="/ExplorePromo1.png" alt="" />
              <span>
                <T k="routeShare.badge" />
              </span>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default RouteSharePage;
