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

export { tryOpenExploreApp } from "@/lib/openExploreApp";
