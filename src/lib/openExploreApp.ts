import { STORE_URLS } from "@/lib/constants";

/** Custom-scheme URL that opens a published route in the Explore app. */
export function buildRouteAppScheme(routeId: string): string {
  // Match DeepLinkFallbackPage + short Universal Link path `/r/:id`.
  return `explore://r/${encodeURIComponent(routeId.trim())}`;
}

export function preferredStoreUrl(): string {
  if (typeof navigator === "undefined") return STORE_URLS.apple;
  return /android/i.test(navigator.userAgent) ? STORE_URLS.play : STORE_URLS.apple;
}

type TryOpenOptions = {
  /** If the app does not claim the page within ~2.2s, go to the store. */
  storeFallback?: boolean;
};

/**
 * Try opening the native app from a user gesture (or short delayed handoff).
 * HTTPS Universal Links often stay in the browser when the user is already on
 * www.exploreapphq.com — custom `explore://` schemes open the installed app.
 */
export function tryOpenExploreApp(schemeUrl: string, options: TryOpenOptions = {}): void {
  if (typeof window === "undefined") return;

  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = schemeUrl;
  document.body.appendChild(iframe);

  window.setTimeout(() => {
    iframe.remove();
  }, 1500);

  window.location.href = schemeUrl;

  if (!options.storeFallback) return;

  window.setTimeout(() => {
    if (document.visibilityState === "visible") {
      window.location.href = preferredStoreUrl();
    }
  }, 2200);
}
