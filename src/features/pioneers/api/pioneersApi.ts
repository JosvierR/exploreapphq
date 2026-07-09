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

async function fetchLandingFromApi(params: LeaderboardQuery = {}): Promise<PioneersLandingApiResponse | null> {
  const search = new URLSearchParams();
  if (params.range) search.set("range", params.range);
  if (params.category) search.set("category", params.category);

  try {
    const res = await fetch(apiUrl(`/api/pioneers/landing?${search.toString()}`));
    const data = (await res.json().catch(() => null)) as PioneersLandingApiResponse | null;
    if (!res.ok || !data?.ok) return null;
    return data;
  } catch {
    return null;
  }
}

export async function fetchPioneerLanding(params: LeaderboardQuery = {}): Promise<PioneerLandingSnapshot> {
  const apiData = await fetchLandingFromApi(params);
  if (!apiData) return mockSnapshot(params.category);

  return {
    challenges: apiData.challenges,
    leaderboardUsers: apiData.leaderboardUsers,
    topVideos: apiData.topVideos || [],
    topPlaces: apiData.topPlaces || [],
    topRoutes: apiData.topRoutes || [],
    rewards: apiData.rewards?.length ? apiData.rewards : PIONEER_REWARDS,
    stats: apiData.stats,
    videoCards: apiData.videoCards?.length ? apiData.videoCards : PIONEER_VIDEO_CARDS,
    leaderboardTabs: apiData.leaderboardTabs || LEADERBOARD_TABS,
    source: apiData.source === "api" ? "api" : "mock",
    updatedAt: apiData.updatedAt,
    warnings: apiData.warnings,
  };
}

export async function fetchLeaderboard(params: LeaderboardQuery): Promise<LeaderboardResponse> {
  const snapshot = await fetchPioneerLanding(params);
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
