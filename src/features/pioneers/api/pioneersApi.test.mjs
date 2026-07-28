import assert from "node:assert/strict";
import { createServer } from "vite";

const vite = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const {
    fetchPioneerLanding,
    getPioneerLandingSnapshot,
    preferRicherSnapshot,
  } = await vite.ssrLoadModule("/src/features/pioneers/api/pioneersApi.ts");

  const unavailable = getPioneerLandingSnapshot();
  const sampleUser = {
    id: "user-1",
    displayName: "Database User One",
    handle: "@db-user-one",
    rank: 1,
    totalPoints: 16,
    videosCount: 0,
    routesCount: 0,
    placesCount: 2,
    badges: ["badge-places"],
  };
  const secondUser = {
    ...sampleUser,
    id: "user-2",
    displayName: "Database User Two",
    handle: "@db-user-two",
    rank: 2,
    totalPoints: 12,
    routesCount: 1,
    placesCount: 0,
    badges: ["badge-routes"],
  };
  const samplePlace = {
    id: "place-1",
    type: "place",
    title: "Database Place",
    subtitle: "other",
    thumbnailUrl: null,
    creatorId: sampleUser.id,
    creatorName: sampleUser.displayName,
    metric: 0,
    rank: 1,
    href: "/p/place-1",
  };

  function apiSnapshot(overrides = {}) {
    return {
      ...unavailable,
      leaderboardUsers: [],
      topVideos: [],
      topPlaces: [],
      topRoutes: [],
      stats: {
        placesThisWeek: 0,
        routesThisWeek: 0,
        videosThisWeek: 0,
        activePioneers: 0,
      },
      source: "api",
      updatedAt: "2026-07-28T00:00:00.000Z",
      warnings: [],
      ...overrides,
    };
  }

  {
    const previous = apiSnapshot({
      leaderboardUsers: [sampleUser],
      topPlaces: [samplePlace],
      stats: {
        placesThisWeek: 1,
        routesThisWeek: 0,
        videosThisWeek: 0,
        activePioneers: 1,
      },
    });
    const next = apiSnapshot();
    const merged = preferRicherSnapshot(previous, next);

    assert.deepEqual(merged.leaderboardUsers, previous.leaderboardUsers);
    assert.deepEqual(merged.topPlaces, previous.topPlaces);
    assert.equal(merged.stats.activePioneers, 1);
    assert.equal(merged.stats.placesThisWeek, 1);
    assert.ok(merged.warnings.some((warning) => warning.includes("non-empty ranking lists")));
  }

  {
    const previous = apiSnapshot({
      topPlaces: [samplePlace],
      stats: {
        placesThisWeek: 1,
        routesThisWeek: 0,
        videosThisWeek: 0,
        activePioneers: 0,
      },
    });
    const next = apiSnapshot({
      leaderboardUsers: [secondUser],
      stats: {
        placesThisWeek: 0,
        routesThisWeek: 0,
        videosThisWeek: 0,
        activePioneers: 1,
      },
    });
    const merged = preferRicherSnapshot(previous, next);

    assert.deepEqual(merged.leaderboardUsers, next.leaderboardUsers);
    assert.deepEqual(merged.topPlaces, previous.topPlaces);
    assert.equal(merged.stats.activePioneers, 1);
    assert.equal(merged.stats.placesThisWeek, 1);
  }

  {
    const recoveredApi = apiSnapshot({ leaderboardUsers: [sampleUser] });
    const merged = preferRicherSnapshot(unavailable, recoveredApi);

    assert.equal(merged, recoveredApi);
    assert.deepEqual(merged.topVideos, []);
  }

  {
    const previous = apiSnapshot({
      leaderboardUsers: [sampleUser],
      topPlaces: [samplePlace],
    });
    const merged = preferRicherSnapshot(previous, unavailable);

    assert.equal(merged.source, "api");
    assert.deepEqual(merged.leaderboardUsers, previous.leaderboardUsers);
    assert.deepEqual(merged.topPlaces, previous.topPlaces);
    assert.ok(merged.warnings.some((warning) => warning.includes("fallback data")));
  }

  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ ok: true, ...apiSnapshot() }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const healthyEmpty = await fetchPioneerLanding({
      range: "7d",
      category: "total",
    });
    assert.equal(healthyEmpty.source, "api");
    assert.deepEqual(healthyEmpty.leaderboardUsers, []);
    assert.deepEqual(healthyEmpty.topPlaces, []);

    globalThis.fetch = async () =>
      new Response(JSON.stringify({ ok: false, error: "unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });

    const fallback = await fetchPioneerLanding({
      range: "7d",
      category: "total",
    });
    assert.equal(fallback.source, "unavailable");
    assert.deepEqual(fallback.leaderboardUsers, []);
    assert.deepEqual(fallback.topVideos, []);
    assert.deepEqual(fallback.topPlaces, []);
    assert.deepEqual(fallback.topRoutes, []);
    assert.deepEqual(fallback.stats, {
      placesThisWeek: 0,
      routesThisWeek: 0,
      videosThisWeek: 0,
      activePioneers: 0,
    });
    assert.ok(fallback.challenges.every((challenge) => challenge.progressCurrent === 0));
    assert.ok(fallback.challenges.every((challenge) => challenge.communityCount === 0));
    assert.ok(fallback.warnings.some((warning) => warning.includes("no fallback ranking data")));
  } finally {
    globalThis.fetch = originalFetch;
  }
} finally {
  await vite.close();
}
