export type ChallengeType = "places" | "routes" | "videos";

const CHALLENGE_TYPES = new Set<ChallengeType>(["places", "routes", "videos"]);

export function isChallengeType(value: string): value is ChallengeType {
  return CHALLENGE_TYPES.has(value as ChallengeType);
}

export function challengeWebPath(type: ChallengeType): string {
  return `/challenges/${type}`;
}

export function challengeAppScheme(type: ChallengeType): string {
  return `explore://challenges/${type}`;
}

/** Try opening the native app; safe to call from a user gesture or fallback page. */
export function tryOpenExploreApp(schemeUrl: string): void {
  if (typeof window === "undefined") return;

  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = schemeUrl;
  document.body.appendChild(iframe);

  window.setTimeout(() => {
    iframe.remove();
  }, 1500);

  window.location.href = schemeUrl;
}
