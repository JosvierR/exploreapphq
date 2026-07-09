import {
  LEADERBOARD_TABS,
  LEADERBOARD_USERS,
  PIONEER_CHALLENGES,
  PIONEER_REWARDS,
  PIONEER_STATS,
  PIONEER_VIDEO_CARDS,
} from "@/features/pioneers/data/pioneerMock";
import type {
  LeaderboardQuery,
  LeaderboardResponse,
  PioneerLandingSnapshot,
} from "@/features/pioneers/types";

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

// TODO(DATA-PIONEROS-API): connect when endpoints exist.
// GET /api/pioneers/leaderboard?range=7d&category=total
// GET /api/pioneers/challenges/active
export async function fetchLeaderboard(params: LeaderboardQuery): Promise<LeaderboardResponse> {
  return {
    entries: sortByCategory(params.category),
    source: "mock",
    updatedAt: new Date().toISOString(),
  };
}

export function getPioneerLandingSnapshot(): PioneerLandingSnapshot {
  return {
    challenges: PIONEER_CHALLENGES,
    leaderboardUsers: sortByCategory("total"),
    rewards: PIONEER_REWARDS,
    stats: PIONEER_STATS,
    videoCards: PIONEER_VIDEO_CARDS,
    leaderboardTabs: LEADERBOARD_TABS,
    source: "mock",
    updatedAt: new Date().toISOString(),
  };
}
