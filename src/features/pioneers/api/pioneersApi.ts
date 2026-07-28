import type {
  LeaderboardQuery,
  LeaderboardResponse,
  PioneerLandingSnapshot,
} from "@/features/pioneers/types";
import {
  LEADERBOARD_TABS,
  LEADERBOARD_USERS,
  MOCK_TOP_PLACES,
  MOCK_TOP_ROUTES,
  MOCK_TOP_VIDEOS,
  PIONEER_CHALLENGES,
  PIONEER_REWARDS,
  PIONEER_STATS,
  PIONEER_VIDEO_CARDS,
} from "@/features/pioneers/mocks/pioneerMock";
import { apiUrl } from "@/lib/api";

const sortByCategory = (category: LeaderboardQuery["category"] = "total") => {
  const field =
    category === "videos"
      ? "videosCount"
      : category === "routes"
        ? "routesCount"
        : category === "places"
          ? "placesCount"
          : "totalPoints";

  return [...LEADERBOARD_USERS]
    .sort((a, b) => b[field] - a[field])
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
};

function mockSnapshot(category: LeaderboardQuery["category"] = "total"): PioneerLandingSnapshot {
  return {
    challenges: PIONEER_CHALLENGES,
    leaderboardUsers: sortByCategory(category),
    topVideos: MOCK_TOP_VIDEOS,
    topPlaces: MOCK_TOP_PLACES,
    topRoutes: MOCK_TOP_ROUTES,
    rewards: PIONEER_REWARDS,
    stats: PIONEER_STATS,
    videoCards: PIONEER_VIDEO_CARDS,
    leaderboardTabs: LEADERBOARD_TABS,
    source: "mock",
    updatedAt: new Date().toISOString(),
    warnings: ["Using fallback mock data."],
  };
}

type PioneersLandingApiResponse = PioneerLandingSnapshot & {
  ok?: boolean;
  request_id?: string;
};

const uniqueWarnings = (...warnings: Array<readonly string[] | undefined>) =>
  [...new Set(warnings.flatMap((entries) => entries ?? []))];

/**
 * Keeps a trustworthy ranking stable across refreshes without allowing mock
 * fallback data to contaminate a real API snapshot.
 */
export function preferRicherSnapshot(
  previous: PioneerLandingSnapshot | null,
  next: PioneerLandingSnapshot,
): PioneerLandingSnapshot {
  if (!previous) return next;

  // A recovered API response always replaces fallback data, including
  // legitimately empty boards such as topVideos.
  if (previous.source === "mock" && next.source === "api") return next;

  // A transient request failure must not replace already-rendered API rows
  // with fabricated fallback rankings.
  if (previous.source === "api" && next.source === "mock") {
    return {
      ...previous,
      warnings: uniqueWarnings(
        previous.warnings,
        next.warnings,
        ["Kept the last API ranking because the latest refresh used fallback data."],
      ),
    };
  }

  const keepUsers = previous.leaderboardUsers.length > 0 && next.leaderboardUsers.length === 0;
  const keepVideos = previous.topVideos.length > 0 && next.topVideos.length === 0;
  const keepPlaces = previous.topPlaces.length > 0 && next.topPlaces.length === 0;
  const keepRoutes = previous.topRoutes.length > 0 && next.topRoutes.length === 0;

  if (!keepUsers && !keepVideos && !keepPlaces && !keepRoutes) return next;

  return {
    ...next,
    leaderboardUsers: keepUsers ? previous.leaderboardUsers : next.leaderboardUsers,
    topVideos: keepVideos ? previous.topVideos : next.topVideos,
    topPlaces: keepPlaces ? previous.topPlaces : next.topPlaces,
    topRoutes: keepRoutes ? previous.topRoutes : next.topRoutes,
    stats: {
      ...next.stats,
      activePioneers: keepUsers
        ? Math.max(previous.stats.activePioneers, next.stats.activePioneers)
        : next.stats.activePioneers,
      videosThisWeek: keepVideos
        ? Math.max(previous.stats.videosThisWeek, next.stats.videosThisWeek)
        : next.stats.videosThisWeek,
      placesThisWeek: keepPlaces
        ? Math.max(previous.stats.placesThisWeek, next.stats.placesThisWeek)
        : next.stats.placesThisWeek,
      routesThisWeek: keepRoutes
        ? Math.max(previous.stats.routesThisWeek, next.stats.routesThisWeek)
        : next.stats.routesThisWeek,
    },
    warnings: uniqueWarnings(
      previous.warnings,
      next.warnings,
      ["Kept non-empty ranking lists from the previous snapshot."],
    ),
  };
}

async function fetchLandingFromApi(
  params: LeaderboardQuery = {},
  signal?: AbortSignal,
): Promise<PioneersLandingApiResponse | null> {
  const search = new URLSearchParams();
  if (params.range) search.set("range", params.range);
  if (params.category) search.set("category", params.category);

  try {
    const res = await fetch(apiUrl(`/api/pioneers/landing?${search.toString()}`), { signal });
    const data = (await res.json().catch(() => null)) as PioneersLandingApiResponse | null;
    if (!res.ok || !data?.ok) return null;
    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return null;
  }
}

export async function fetchPioneerLanding(
  params: LeaderboardQuery = {},
  signal?: AbortSignal,
): Promise<PioneerLandingSnapshot> {
  const apiData = await fetchLandingFromApi(params, signal);
  if (!apiData) return mockSnapshot(params.category);

  return {
    challenges: Array.isArray(apiData.challenges) ? apiData.challenges : PIONEER_CHALLENGES,
    leaderboardUsers: Array.isArray(apiData.leaderboardUsers) ? apiData.leaderboardUsers : [],
    topVideos: Array.isArray(apiData.topVideos) ? apiData.topVideos : [],
    topPlaces: Array.isArray(apiData.topPlaces) ? apiData.topPlaces : [],
    topRoutes: Array.isArray(apiData.topRoutes) ? apiData.topRoutes : [],
    rewards: apiData.rewards?.length ? apiData.rewards : PIONEER_REWARDS,
    stats: apiData.stats || {
      placesThisWeek: 0,
      routesThisWeek: 0,
      videosThisWeek: 0,
      activePioneers: 0,
    },
    videoCards: apiData.videoCards?.length ? apiData.videoCards : PIONEER_VIDEO_CARDS,
    leaderboardTabs: apiData.leaderboardTabs?.length ? apiData.leaderboardTabs : LEADERBOARD_TABS,
    source: apiData.source === "api" ? "api" : "mock",
    updatedAt: apiData.updatedAt || new Date().toISOString(),
    warnings: apiData.warnings,
  };
}

export async function fetchLeaderboard(
  params: LeaderboardQuery,
  signal?: AbortSignal,
): Promise<LeaderboardResponse> {
  const snapshot = await fetchPioneerLanding(params, signal);
  return {
    entries: snapshot.leaderboardUsers,
    topVideos: snapshot.topVideos,
    topPlaces: snapshot.topPlaces,
    topRoutes: snapshot.topRoutes,
    source: snapshot.source === "api" ? "api" : "mock",
    updatedAt: snapshot.updatedAt,
    warnings: snapshot.warnings,
  };
}

export function getPioneerLandingSnapshot(): PioneerLandingSnapshot {
  return mockSnapshot("total");
}
