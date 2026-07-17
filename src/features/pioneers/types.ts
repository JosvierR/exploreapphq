import type { TranslationKey } from "@/locales/messages";

export type LeaderboardTab = "total" | "videos" | "routes" | "places";

export type PioneerChallenge = {
  id: "places" | "routes" | "videos";
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  microcopyKey: TranslationKey;
  badgeLabelKey: TranslationKey;
  iconLabel: string;
  points: number;
  badgeId: string;
  progressCurrent: number;
  progressTarget: number;
  appDeepLink: string;
  communityCount?: number;
};

export type PioneerLeaderboardEntry = {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl?: string | null;
  rank: number;
  totalPoints: number;
  videosCount: number;
  routesCount: number;
  placesCount: number;
  badges: string[];
};

export type PioneerContentEntry = {
  id: string;
  type: "video" | "place" | "route";
  title: string;
  subtitle?: string | null;
  thumbnailUrl?: string | null;
  creatorId?: string | null;
  creatorName?: string | null;
  metric: number;
  rank: number;
  href: string;
};

export type PioneerReward = {
  id: string;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  icon: string;
  tagKey?: TranslationKey;
  featured?: boolean;
};

export type PioneerStats = {
  placesThisWeek: number;
  routesThisWeek: number;
  videosThisWeek: number;
  activePioneers: number;
};

export type PioneerVideoCard = {
  id: string;
  image: string;
  titleKey: TranslationKey;
  creator: string;
  typeKey: TranslationKey;
};

export type LeaderboardQuery = {
  range?: "7d" | "30d";
  category?: LeaderboardTab;
};

export type LeaderboardResponse = {
  entries: PioneerLeaderboardEntry[];
  topVideos: PioneerContentEntry[];
  topPlaces: PioneerContentEntry[];
  topRoutes: PioneerContentEntry[];
  source: "mock" | "api";
  updatedAt: string;
  warnings?: string[];
};

export type PioneerLandingSnapshot = {
  challenges: PioneerChallenge[];
  leaderboardUsers: PioneerLeaderboardEntry[];
  topVideos: PioneerContentEntry[];
  topPlaces: PioneerContentEntry[];
  topRoutes: PioneerContentEntry[];
  rewards: PioneerReward[];
  stats: PioneerStats;
  videoCards: PioneerVideoCard[];
  leaderboardTabs: readonly LeaderboardTab[];
  source: "mock" | "api";
  updatedAt: string;
  warnings?: string[];
};
