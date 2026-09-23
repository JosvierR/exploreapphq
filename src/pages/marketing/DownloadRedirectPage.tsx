import { useEffect, useMemo } from "react";
import { track } from "@vercel/analytics";
import { STORE_URLS } from "@/lib/constants";

type DevicePlatform = "ios" | "android" | "desktop";

type Attribution = {
  source: string;
  medium: string;
  campaign: string;
  content: string;
  term: string;
};

function clean(value: string | null, fallback = "") {
  const normalized = (value || "").trim();
  return (normalized || fallback).slice(0, 120);
}

function detectPlatform(): DevicePlatform {
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const isIPadOS = platform === "MacIntel" && navigator.maxTouchPoints > 1;

  if (/android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua) || isIPadOS) return "ios";
  return "desktop";
}

function getAttribution(): Attribution {
  const params = new URLSearchParams(window.location.search);

  return {
    source: clean(params.get("utm_source") || params.get("source"), "direct"),
    medium: clean(params.get("utm_medium") || params.get("medium"), "smart_link"),
    campaign: clean(params.get("utm_campaign") || params.get("campaign"), "evergreen"),
    content: clean(params.get("utm_content") || params.get("content")),
    term: clean(params.get("utm_term") || params.get("term")),
  };
}

function getReferrerHost() {
  if (!document.referrer) return "none";

  try {
    return new URL(document.referrer).hostname.slice(0, 120);
  } catch {
    return "unknown";
  }
}

function buildPlayStoreUrl(attribution: Attribution) {
  const url = new URL(STORE_URLS.play);
  const referrer = new URLSearchParams();

  referrer.set("utm_source", attribution.source);
  referrer.set("utm_medium", attribution.medium);
  referrer.set("utm_campaign", attribution.campaign);
  if (attribution.content) referrer.set("utm_content", attribution.content);
  if (attribution.term) referrer.set("utm_term", attribution.term);

  // Google Play Install Referrer preserves campaign data for attribution
  // inside the Android app when the native client consumes it.
  url.searchParams.set("referrer", referrer.toString());

  return url.toString();
}

export function DownloadRedirectPage() {
  const attribution = useMemo(() => getAttribution(), []);
  const platform = useMemo(() => detectPlatform(), []);
  const playStoreUrl = useMemo(() => buildPlayStoreUrl(attribution), [attribution]);
  const destination = platform === "ios"
    ? STORE_URLS.apple
    : platform === "android"
      ? playStoreUrl
      : null;

  useEffect(() => {
    try {
      track("Download Smart Link Opened", {
        platform,
        source: attribution.source,
        medium: attribution.medium,
        campaign: attribution.campaign,
        content: attribution.content || "none",
        referrer_host: getReferrerHost(),
      });
    } catch {
      // Tracking must never block the store redirect.
    }

    if (!destination) return;

    try {
      track("Download Store Redirect", {
        platform,
        store: platform === "ios" ? "app_store" : "google_play",
        source: attribution.source,
        medium: attribution.medium,
        campaign: attribution.campaign,
        content: attribution.content || "none",
      });
    } catch {
      // Tracking must never block the store redirect.
    }

    // A very small delay gives browser analytics time to queue while keeping
    // the experience effectively one tap from Instagram/TikTok to the store.
    const timeout = window.setTimeout(() => {
      window.location.replace(destination);
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [attribution, destination, platform]);

  const trackDesktopStoreClick = (store: "app_store" | "google_play") => {
    try {
      track("Download Store Click", {
        platform: "desktop",
        store,
        source: attribution.source,
        medium: attribution.medium,
        campaign: attribution.campaign,
        content: attribution.content || "none",
      });
    } catch {
      // Navigation should still continue if analytics is unavailable.
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "32px 20px",
        background: "#07090d",
        color: "#fff",
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <section style={{ width: "100%", maxWidth: 520, textAlign: "center" }}>
        <div
          aria-hidden="true"
          style={{
            width: 64,
            height: 64,
            margin: "0 auto 20px",
            borderRadius: 18,
            display: "grid",
            placeItems: "center",
            background: "linear-gradient(145deg, #00a8ff, #0067ff)",
            fontSize: 34,
            fontWeight: 800,
          }}
        >
          E
        </div>

        <h1 style={{ margin: 0, fontSize: "clamp(32px, 7vw, 52px)", letterSpacing: "-0.04em" }}>
          Download Explore
        </h1>
        <p style={{ margin: "14px auto 26px", maxWidth: 420, color: "#b7bdc8", lineHeight: 1.55 }}>
          {destination
            ? "Opening the right app store for your device…"
            : "Choose your device and start exploring."}
        </p>

        {!destination && (
          <div style={{ display: "grid", gap: 12, justifyItems: "center" }}>
            <a
              href={STORE_URLS.apple}
              onClick={() => trackDesktopStoreClick("app_store")}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Download Explore on the App Store"
            >
              <img src="/appstore-badge.svg" alt="Download on the App Store" style={{ height: 54 }} />
            </a>

            <a
              href={playStoreUrl}
              onClick={() => trackDesktopStoreClick("google_play")}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Get Explore on Google Play"
            >
              <img src="/googleplay-badge.svg" alt="Get it on Google Play" style={{ height: 54 }} />
            </a>
          </div>
        )}
      </section>
    </main>
  );
}
