import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const CHALLENGE_TARGETS = {
  places: 50,
  routes: 25,
  videos: 40,
};

const POINTS = {
  videos: 10,
  places: 8,
  routes: 12,
};

const CHALLENGE_DEEP_LINKS = {
  places: "explore://challenges/places",
  routes: "explore://challenges/routes",
  videos: "explore://challenges/videos",
};

function getSupabaseUrl() {
  return (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
}

function getSupabaseSecretKey() {
  return (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

function createServiceClient() {
  const url = getSupabaseUrl();
  const secretKey = getSupabaseSecretKey();
  if (!url || !secretKey) return null;

  return createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: WebSocket },
  });
}

function firstField(row, names) {
  if (!row) return undefined;
  for (const name of names) {
    const value = row[name];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function nullableString(value) {
  return value === undefined || value === null || value === "" ? null : String(value);
}

function publicMediaUrl(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return null;
}

function rangeSince(range = "7d") {
  const days = range === "30d" ? 30 : 7;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function isVisibleContent(row) {
  const moderation = nullableString(firstField(row, ["moderation_status"]));
  if (moderation && ["hidden", "removed"].includes(moderation)) return false;

  const state = nullableString(firstField(row, ["state", "status"]));
  if (!state) return true;
  return !["deleted", "removed", "hidden", "draft", "processing", "reported"].includes(state);
}

function creatorIdFromRow(row) {
  return nullableString(firstField(row, ["created_by", "creator_id", "owner_id", "user_id", "profile_id"]));
}

function createdAtFromRow(row) {
  return nullableString(firstField(row, ["created_at", "createdAt", "inserted_at"]));
}

function metricForVideo(row) {
  return Number(firstField(row, ["likes_count", "like_count", "views_count", "view_count"]) || 0);
}

function metricForPlace(row) {
  return Number(firstField(row, ["rating", "avg_rating", "average_rating", "likes_count", "like_count"]) || 0);
}

function metricForRoute(row) {
  return Number(firstField(row, ["stops_count", "places_count", "likes_count", "like_count"]) || 0);
}

async function fetchSince(supabase, table, since, limit = 800) {
  try {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []).filter(isVisibleContent);
  } catch {
    try {
      const { data, error } = await supabase.from(table).select("*").limit(limit);
      if (error) throw error;
      return (data || [])
        .filter(isVisibleContent)
        .filter((row) => {
          const createdAt = createdAtFromRow(row);
          return createdAt ? createdAt >= since : false;
        });
    } catch {
      return [];
    }
  }
}

async function fetchProfilesMap(supabase, ids) {
  const map = new Map();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return map;

  for (const table of ["profiles", "users"]) {
    try {
      const { data, error } = await supabase.from(table).select("*").in("id", unique.slice(0, 100));
      if (error) throw error;
      for (const row of data || []) {
        const id = nullableString(firstField(row, ["id", "user_id", "uid"]));
        if (!id || map.has(id)) continue;
        map.set(id, {
          id,
          displayName:
            nullableString(firstField(row, ["display_name", "full_name", "name", "username", "handle"])) ||
            `Pioneer ${id.slice(0, 6)}`,
          handle: nullableString(firstField(row, ["username", "handle"])) || null,
          avatarUrl: publicMediaUrl(firstField(row, ["avatar_url", "avatarUrl", "photo_url", "image_url"])),
        });
      }
      if (map.size > 0) return map;
    } catch {
      // try next table
    }
  }

  return map;
}

function serializeVideoItem(row, rank, profile) {
  const id = nullableString(firstField(row, ["id"])) || "";
  return {
    id,
    type: "video",
    title: nullableString(firstField(row, ["title", "caption", "description", "name"])) || `Video ${id.slice(0, 6)}`,
    subtitle: profile?.displayName || null,
    thumbnailUrl: publicMediaUrl(
      firstField(row, ["thumbnail_url", "thumbnailUrl", "thumbnail", "cover_url", "coverUrl", "poster_url"]),
    ),
    creatorId: creatorIdFromRow(row),
    creatorName: profile?.displayName || null,
    metric: metricForVideo(row),
    rank,
    href: `/v/${encodeURIComponent(id)}`,
  };
}

function serializePlaceItem(row, rank, profile) {
  const id = nullableString(firstField(row, ["id"])) || "";
  return {
    id,
    type: "place",
    title: nullableString(firstField(row, ["place_name", "name", "title"])) || `Place ${id.slice(0, 6)}`,
    subtitle: nullableString(firstField(row, ["category", "category_name", "type"])) || profile?.displayName || null,
    thumbnailUrl: publicMediaUrl(
      firstField(row, ["cover_url", "coverUrl", "image_url", "imageUrl", "photo_url", "thumbnail_url"]),
    ),
    creatorId: creatorIdFromRow(row),
    creatorName: profile?.displayName || null,
    metric: metricForPlace(row),
    rank,
    href: `/p/${encodeURIComponent(id)}`,
  };
}

function serializeRouteItem(row, rank, profile) {
  const id = nullableString(firstField(row, ["id"])) || "";
  return {
    id,
    type: "route",
    title: nullableString(firstField(row, ["name", "title"])) || `Route ${id.slice(0, 6)}`,
    subtitle: nullableString(firstField(row, ["category", "category_name", "type"])) || profile?.displayName || null,
    thumbnailUrl: publicMediaUrl(firstField(row, ["cover_url", "coverUrl", "image_url", "imageUrl", "thumbnail_url"])),
    creatorId: creatorIdFromRow(row),
    creatorName: profile?.displayName || null,
    metric: metricForRoute(row),
    rank,
    href: `/r/${encodeURIComponent(id)}`,
  };
}

function buildUserLeaderboard(videos, places, routes, profiles) {
  const totals = new Map();

  const bump = (creatorId, field) => {
    if (!creatorId) return;
    const current = totals.get(creatorId) || { videosCount: 0, placesCount: 0, routesCount: 0 };
    current[field] += 1;
    totals.set(creatorId, current);
  };

  for (const row of videos) bump(creatorIdFromRow(row), "videosCount");
  for (const row of places) bump(creatorIdFromRow(row), "placesCount");
  for (const row of routes) bump(creatorIdFromRow(row), "routesCount");

  return [...totals.entries()]
    .map(([id, counts]) => {
      const profile = profiles.get(id);
      const totalPoints =
        counts.videosCount * POINTS.videos +
        counts.placesCount * POINTS.places +
        counts.routesCount * POINTS.routes;
      const badges = [];
      if (counts.videosCount > 0) badges.push("badge-videos");
      if (counts.placesCount > 0) badges.push("badge-places");
      if (counts.routesCount > 0) badges.push("badge-routes");

      return {
        id,
        displayName: profile?.displayName || `Pioneer ${id.slice(0, 6)}`,
        handle: profile?.handle ? `@${profile.handle.replace(/^@/, "")}` : `@pioneer-${id.slice(0, 6)}`,
        avatarUrl: profile?.avatarUrl || null,
        rank: 0,
        totalPoints,
        videosCount: counts.videosCount,
        placesCount: counts.placesCount,
        routesCount: counts.routesCount,
        badges,
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function sortContentRows(rows, type) {
  const metric = type === "video" ? metricForVideo : type === "place" ? metricForPlace : metricForRoute;
  return [...rows].sort((a, b) => {
    const metricDiff = metric(b) - metric(a);
    if (metricDiff !== 0) return metricDiff;
    return (createdAtFromRow(b) || "").localeCompare(createdAtFromRow(a) || "");
  });
}

function buildChallenges(stats) {
  return [
    {
      id: "places",
      titleKey: "pioneer.challenge.places.title",
      descriptionKey: "pioneer.challenge.places.desc",
      microcopyKey: "pioneer.challenge.places.microcopy",
      badgeLabelKey: "pioneer.challenge.places.badge",
      iconLabel: "PIN",
      points: 150,
      badgeId: "badge-places",
      progressCurrent: Math.min(stats.placesThisWeek, CHALLENGE_TARGETS.places),
      progressTarget: CHALLENGE_TARGETS.places,
      appDeepLink: CHALLENGE_DEEP_LINKS.places,
      communityCount: stats.placesThisWeek,
    },
    {
      id: "routes",
      titleKey: "pioneer.challenge.routes.title",
      descriptionKey: "pioneer.challenge.routes.desc",
      microcopyKey: "pioneer.challenge.routes.microcopy",
      badgeLabelKey: "pioneer.challenge.routes.badge",
      iconLabel: "RTE",
      points: 200,
      badgeId: "badge-routes",
      progressCurrent: Math.min(stats.routesThisWeek, CHALLENGE_TARGETS.routes),
      progressTarget: CHALLENGE_TARGETS.routes,
      appDeepLink: CHALLENGE_DEEP_LINKS.routes,
      communityCount: stats.routesThisWeek,
    },
    {
      id: "videos",
      titleKey: "pioneer.challenge.videos.title",
      descriptionKey: "pioneer.challenge.videos.desc",
      microcopyKey: "pioneer.challenge.videos.microcopy",
      badgeLabelKey: "pioneer.challenge.videos.badge",
      iconLabel: "VID",
      points: 250,
      badgeId: "badge-videos",
      progressCurrent: Math.min(stats.videosThisWeek, CHALLENGE_TARGETS.videos),
      progressTarget: CHALLENGE_TARGETS.videos,
      appDeepLink: CHALLENGE_DEEP_LINKS.videos,
      communityCount: stats.videosThisWeek,
    },
  ];
}

export async function getPioneersLandingData({ range = "7d", category = "total" } = {}) {
  const warnings = [];
  const since = rangeSince(range);
  const supabase = createServiceClient();

  if (!supabase) {
    return { ok: false, reason: "supabase_not_configured", warnings };
  }

  const [videos, places, routes] = await Promise.all([
    fetchSince(supabase, "videos", since),
    fetchSince(supabase, "places", since),
    fetchSince(supabase, "routes", since),
  ]);

  if (videos.length === 0 && places.length === 0 && routes.length === 0) {
    warnings.push("No recent content rows found in Supabase for the selected range.");
  }

  const creatorIds = [
    ...videos.map(creatorIdFromRow),
    ...places.map(creatorIdFromRow),
    ...routes.map(creatorIdFromRow),
  ].filter(Boolean);

  const profiles = await fetchProfilesMap(supabase, creatorIds);
  const users = buildUserLeaderboard(videos, places, routes, profiles);

  const topVideos = sortContentRows(videos, "video")
    .slice(0, 5)
    .map((row, index) => serializeVideoItem(row, index + 1, profiles.get(creatorIdFromRow(row) || "")));

  const topPlaces = sortContentRows(places, "place")
    .slice(0, 5)
    .map((row, index) => serializePlaceItem(row, index + 1, profiles.get(creatorIdFromRow(row) || "")));

  const topRoutes = sortContentRows(routes, "route")
    .slice(0, 5)
    .map((row, index) => serializeRouteItem(row, index + 1, profiles.get(creatorIdFromRow(row) || "")));

  const stats = {
    placesThisWeek: places.length,
    routesThisWeek: routes.length,
    videosThisWeek: videos.length,
    activePioneers: users.length,
  };

  const sortField =
    category === "videos"
      ? "videosCount"
      : category === "routes"
        ? "routesCount"
        : category === "places"
          ? "placesCount"
          : "totalPoints";

  const leaderboardUsers = [...users]
    .sort((a, b) => b[sortField] - a[sortField])
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  return {
    ok: true,
    source: "api",
    updatedAt: new Date().toISOString(),
    range,
    stats,
    challenges: buildChallenges(stats),
    leaderboardUsers,
    topVideos,
    topPlaces,
    topRoutes,
    leaderboardTabs: ["total", "videos", "routes", "places"],
    warnings,
  };
}
