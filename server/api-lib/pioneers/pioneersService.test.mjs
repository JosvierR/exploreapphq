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
      };
      return builder;
    },
  };
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
