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

  const mock = getPioneerLandingSnapshot();
  const sampleUser = mock.leaderboardUsers[0];
  const secondUser = mock.leaderboardUsers[1];
  const samplePlace = mock.topPlaces[0];

  function apiSnapshot(overrides = {}) {
    return {
      ...mock,
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
    const merged = preferRicherSnapshot(mock, recoveredApi);

    assert.equal(merged, recoveredApi);
    assert.deepEqual(merged.topVideos, []);
  }

  {
    const previous = apiSnapshot({
      leaderboardUsers: [sampleUser],
      topPlaces: [samplePlace],
    });
    const merged = preferRicherSnapshot(previous, mock);

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
    assert.equal(fallback.source, "mock");
    assert.ok(fallback.warnings.includes("Using fallback mock data."));
  } finally {
    globalThis.fetch = originalFetch;
  }
} finally {
  await vite.close();
}
