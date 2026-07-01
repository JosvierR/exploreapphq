const CANONICAL_EXPLORE_WEB_URL = "https://www.exploreapphq.com";

/** Public share links always use the production web domain, not preview deploy origins. */
export function getExploreWebUrl(): string {
  return (import.meta.env.VITE_EXPLORE_WEB_URL || CANONICAL_EXPLORE_WEB_URL).replace(/\/$/, "");
}

export function buildExploreShareUrl(pathname: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${getExploreWebUrl()}${path}`;
}
