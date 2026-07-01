import { Link, useLocation, useParams } from "react-router-dom";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { SITE, STORE_URLS } from "@/lib/constants";
import "@/styles/deeplink.css";

type DeepLinkKind = "video" | "place" | "route" | "profile" | "me";

type DeepLinkFallbackPageProps = {
  kind: DeepLinkKind;
  paramName?: string;
};

const contentConfig: Record<
  DeepLinkKind,
  {
    label: string;
    title: string;
    description: string;
    idLabel: string;
    schemePath: string;
  }
> = {
  video: {
    label: "Video",
    title: "Open this video in Explore",
    description: "This shared Explore video link is ready to open in the mobile app.",
    idLabel: "Video ID",
    schemePath: "v",
  },
  place: {
    label: "Place",
    title: "Open this place in Explore",
    description: "This shared Explore place link is ready to open in the mobile app.",
    idLabel: "Place ID",
    schemePath: "p",
  },
  route: {
    label: "Route",
    title: "Open this route in Explore",
    description: "This shared Explore route link is ready to open in the mobile app.",
    idLabel: "Route ID",
    schemePath: "r",
  },
  profile: {
    label: "Profile",
    title: "Open this profile in Explore",
    description: "This shared Explore profile link is ready to open in the mobile app.",
    idLabel: "Handle or user ID",
    schemePath: "u",
  },
  me: {
    label: "Profile",
    title: "Open your Explore profile",
    description: "Open Explore to continue to your profile in the mobile app.",
    idLabel: "Destination",
    schemePath: "me",
  },
};

export function DeepLinkFallbackPage({ kind, paramName }: DeepLinkFallbackPageProps) {
  const params = useParams();
  const location = useLocation();
  const config = contentConfig[kind];
  const rawValue = paramName ? params[paramName] : "me";
  const displayValue = rawValue || "Not provided";
  const canonicalUrl = `${SITE.url}${location.pathname}`;
  const appHref =
    kind === "me"
      ? "explore://me"
      : `explore://${config.schemePath}/${encodeURIComponent(displayValue)}`;

  return (
    <main className="deeplink-page">
      <section className="deeplink-shell" aria-labelledby="deeplink-title">
        <div className="deeplink-copy">
          <Link to="/" className="deeplink-brand" aria-label="Explore home">
            <BrandLogo size={42} />
          </Link>

          <span className="deeplink-badge">{config.label}</span>
          <h1 id="deeplink-title">{config.title}</h1>
          <p>{config.description} Public web previews are not available for this content yet.</p>

          <dl className="deeplink-meta" aria-label="Shared link details">
            <div>
              <dt>{config.idLabel}</dt>
              <dd>{displayValue}</dd>
            </div>
            <div>
              <dt>Shared link</dt>
              <dd>{canonicalUrl}</dd>
            </div>
          </dl>

          <div className="deeplink-actions">
            <a className="deeplink-open-btn" href={appHref}>
              Open in Explore
            </a>
            <a className="deeplink-store-link" href={STORE_URLS.apple} aria-label="Download Explore on the App Store">
              <img src="/appstore-badge.svg" alt="Download on the App Store" />
            </a>
            <a className="deeplink-store-link" href={STORE_URLS.play} aria-label="Get Explore on Google Play">
              <img src="/googleplay-badge.svg" alt="Get it on Google Play" />
            </a>
          </div>
        </div>

        <div className="deeplink-visual" aria-hidden="true">
          <img src="/ExplorePromo1.png" alt="" />
          <span>{config.label}</span>
        </div>
      </section>
    </main>
  );
}
