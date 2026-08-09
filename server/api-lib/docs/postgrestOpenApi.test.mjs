import assert from "node:assert/strict";
import test from "node:test";
import {
  clearPostgrestOpenApiCache,
  convertSwaggerToOpenApi31,
  fetchLivePostgrestOpenApi,
  getPostgrestAnonKey,
} from "./postgrestOpenApi.mjs";

const SAMPLE_SWAGGER = {
  swagger: "2.0",
  info: { title: "Sample PostgREST", version: "12.0.0" },
  host: "example.supabase.co",
  basePath: "/rest/v1",
  schemes: ["https"],
  paths: {
    "/profiles": {
      get: {
        summary: "List profiles",
        produces: ["application/json"],
        responses: {
          200: {
            description: "OK",
            schema: {
              type: "array",
              items: { type: "object" },
            },
          },
        },
      },
    },
  },
};

test("convertSwaggerToOpenApi31 yields openapi 3.1 with paths", async () => {
  const spec = await convertSwaggerToOpenApi31(SAMPLE_SWAGGER);
  assert.equal(spec.openapi, "3.1.0");
  assert.equal(typeof spec.info?.title, "string");
  assert.ok(spec.paths && typeof spec.paths === "object");
  assert.ok(Object.keys(/** @type {object} */ (spec.paths)).length > 0);
});

test("getPostgrestAnonKey never reads VITE_* env vars", () => {
  const prevAnon = process.env.SUPABASE_ANON_KEY;
  const prevPublishable = process.env.SUPABASE_PUBLISHABLE_KEY;
  const prevVite = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const prevViteAnon = process.env.VITE_SUPABASE_ANON_KEY;

  delete process.env.SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_PUBLISHABLE_KEY;
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "vite-should-not-be-used";
  process.env.VITE_SUPABASE_ANON_KEY = "vite-anon-should-not-be-used";

  try {
    assert.equal(getPostgrestAnonKey(), "");
  } finally {
    if (prevAnon === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = prevAnon;
    if (prevPublishable === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = prevPublishable;
    if (prevVite === undefined) delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    else process.env.VITE_SUPABASE_PUBLISHABLE_KEY = prevVite;
    if (prevViteAnon === undefined) delete process.env.VITE_SUPABASE_ANON_KEY;
    else process.env.VITE_SUPABASE_ANON_KEY = prevViteAnon;
  }
});

test("fetchLivePostgrestOpenApi caches converted spec briefly", async () => {
  clearPostgrestOpenApiCache();
  const prevUrl = process.env.SUPABASE_URL;
  const prevAnon = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "test-anon-key";

  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return {
      ok: true,
      async json() {
        return SAMPLE_SWAGGER;
      },
    };
  };

  let now = 1_000;
  try {
    const first = await fetchLivePostgrestOpenApi({ fetchImpl, now: () => now });
    const second = await fetchLivePostgrestOpenApi({ fetchImpl, now: () => now + 1_000 });
    assert.equal(first.cache, "miss");
    assert.equal(second.cache, "hit");
    assert.equal(calls, 1);
    assert.equal(first.spec.openapi, "3.1.0");
    assert.equal(second.spec.openapi, "3.1.0");
  } finally {
    clearPostgrestOpenApiCache();
    if (prevUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = prevUrl;
    if (prevAnon === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = prevAnon;
  }
});
