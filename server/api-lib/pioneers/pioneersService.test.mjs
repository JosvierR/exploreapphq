import assert from "node:assert/strict";
import {
  fetchSince,
  getPioneersLandingData,
} from "./pioneersService.mjs";

function mockSupabase(handler) {
  return {
    from(table) {
      const state = {
        filtered: false,
        since: null,
      };
      const builder = {
        select() {
          return builder;
        },
        gte(_column, since) {
          state.filtered = true;
          state.since = since;
          return builder;
        },
        order() {
          return builder;
        },
        limit(limit) {
          return Promise.resolve(handler({
            table,
            filtered: state.filtered,
            since: state.since,
            limit,
          }));
        },
        in(column, values) {
          return Promise.resolve(handler({
            table,
            filtered: state.filtered,
            since: state.since,
            inColumn: column,
            inValues: values,
          }));
        },
      };
      return builder;
    },
  };
}

{
  const createdAt = new Date().toISOString();
  const supabase = mockSupabase((call) => {
    if (call.table === "videos") return { data: [], error: null };
    if (call.table === "places") {
      return {
        data: [
          {
            id: "place-db-1",
            place_name: "Exact Database Place",
            created_by: "user-db-1",
            created_at: createdAt,
            rating: 4.75,
          },
        ],
        error: null,
      };
    }
    if (call.table === "routes") {
      return {
        data: [
          {
            id: "route-db-1",
            name: "Exact Database Route",
            created_by: "user-db-2",
            created_at: createdAt,
            stops_count: 4,
          },
        ],
        error: null,
      };
    }
    if (call.table === "profiles") {
      return {
        data: [
          {
            id: "user-db-1",
            display_name: "Exact Database User",
            username: "exact-db-user",
          },
        ],
        error: null,
      };
    }
    throw new Error(`Unexpected table: ${call.table}`);
  });

  const result = await getPioneersLandingData({
    range: "7d",
    category: "total",
    supabaseClient: supabase,
  });

  assert.equal(result.ok, true);
  assert.equal(result.source, "api");
  assert.deepEqual(result.stats, {
    placesThisWeek: 1,
    routesThisWeek: 1,
    videosThisWeek: 0,
    activePioneers: 2,
  });
  assert.equal(result.topPlaces[0].title, "Exact Database Place");
  assert.equal(result.topPlaces[0].metric, 4.75);
  assert.equal(result.topRoutes[0].title, "Exact Database Route");
  assert.equal(result.topRoutes[0].metric, 4);

  const profiledUser = result.leaderboardUsers.find((entry) => entry.id === "user-db-1");
  assert.equal(profiledUser.displayName, "Exact Database User");
  assert.equal(profiledUser.handle, "@exact-db-user");

  const idOnlyUser = result.leaderboardUsers.find((entry) => entry.id === "user-db-2");
  assert.equal(idOnlyUser.displayName, "user-db-2");
  assert.equal(idOnlyUser.handle, "");
}

{
  const calls = [];
  const supabase = mockSupabase((call) => {
    calls.push(call);
    return { data: [], error: null };
  });

  const result = await getPioneersLandingData({
    range: "lifetime",
    category: "total",
    supabaseClient: supabase,
  });

  assert.equal(result.ok, true);
  assert.equal(result.range, "lifetime");
  // lifetime ranking (3) + weekly challenge window (3); no 30d widen retry
  assert.equal(calls.length, 6);
  for (const call of calls.slice(0, 3)) {
    assert.equal(call.filtered, false);
    assert.equal(call.since, null);
  }
  for (const call of calls.slice(3)) {
    assert.equal(call.filtered, true);
    assert.ok(call.since);
  }
  assert.ok(result.warnings.includes("No content rows found in Supabase for the lifetime ranking."));
}

{
  const createdAt = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const supabase = mockSupabase((call) => {
    if (call.table === "videos" && !call.filtered) {
      return {
        data: [
          {
            id: "video-old-1",
            title: "Lifetime Video",
            created_by: "user-db-1",
            created_at: createdAt,
            likes_count: 9,
          },
        ],
        error: null,
      };
    }
    if (call.table === "places" && !call.filtered) {
      return {
        data: [
          {
            id: "place-old-1",
            place_name: "Lifetime Place",
            created_by: "user-db-1",
            created_at: createdAt,
            rating: 5,
          },
        ],
        error: null,
      };
    }
    if (call.table === "routes") return { data: [], error: null };
    if (call.table === "profiles") {
      return {
        data: [
          {
            id: "user-db-1",
            display_name: "Lifetime User",
            username: "lifetime-user",
          },
        ],
        error: null,
      };
    }
    return { data: [], error: null };
  });

  const result = await getPioneersLandingData({
    range: "lifetime",
    category: "total",
    supabaseClient: supabase,
  });

  assert.equal(result.ok, true);
  assert.equal(result.topVideos[0].title, "Lifetime Video");
  assert.equal(result.topPlaces[0].title, "Lifetime Place");
  assert.equal(result.leaderboardUsers[0].displayName, "Lifetime User");
  // Challenge progress stays on the weekly window (empty in this fixture).
  assert.deepEqual(result.stats, {
    placesThisWeek: 0,
    routesThisWeek: 0,
    videosThisWeek: 0,
    activePioneers: 1,
  });
}

{
  const calls = [];
  const supabase = mockSupabase((call) => {
    calls.push(call);
    return { data: [], error: null };
  });

  const result = await getPioneersLandingData({
    range: "7d",
    category: "total",
    supabaseClient: supabase,
  });

  assert.equal(result.ok, true);
  assert.equal(calls.length, 6);
  for (const table of ["videos", "places", "routes"]) {
    const tableCalls = calls.filter((call) => call.table === table);
    assert.equal(tableCalls.length, 2);
    assert.notEqual(tableCalls[0].since, tableCalls[1].since);
  }
  assert.ok(result.warnings.includes("Primary range returned no rows; retrying with 30d."));
  assert.ok(result.warnings.includes("No recent content rows found in Supabase for the selected range."));
}

{
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args);
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const supabase = mockSupabase((call) => {
      if (call.filtered) return { data: null, error: new Error("primary failed") };
      return {
        data: [{ id: "place-1", created_at: new Date().toISOString() }],
        error: null,
      };
    });

    const result = await fetchSince(supabase, "places", since);
    assert.equal(result.failed, false);
    assert.equal(result.rows.length, 1);
    assert.ok(result.warnings[0].includes("fallback query"));
    assert.equal(warnings.length, 1);
  } finally {
    console.warn = originalWarn;
  }
}

{
  const calls = [];
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args);
  try {
    const supabase = mockSupabase((call) => {
      calls.push(call);
      return { data: null, error: new Error(`${call.table} unavailable`) };
    });

    const result = await getPioneersLandingData({
      range: "7d",
      category: "total",
      supabaseClient: supabase,
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, "supabase_query_failed");
    assert.equal(calls.length, 12);
    assert.equal(warnings.length, 6);
    assert.ok(result.warnings.some((warning) => warning.includes("videos could not be loaded")));
    assert.ok(result.warnings.some((warning) => warning.includes("Unable to verify an empty ranking")));
  } finally {
    console.warn = originalWarn;
  }
}
