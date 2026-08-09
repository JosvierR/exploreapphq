import assert from "node:assert/strict";
import test from "node:test";
import { convertSwagger2LiteToOpenApi31 } from "./convertSwagger2Lite.mjs";
import {
  clearPostgrestOpenApiCache,
  convertSwaggerToOpenApi31,
  fetchLivePostgrestOpenApi,
  fitOpenApiForServerless,
  getPostgrestAnonKey,
  getPostgrestAnonKeyCandidates,
  sanitizeSupabaseEnvValue,
} from "./postgrestOpenApi.mjs";

const SAMPLE_SWAGGER = {
  swagger: "2.0",
  info: { title: "Sample PostgREST", version: "12.0.0" },
  host: "example.supabase.co",
  basePath: "/rest/v1",
  schemes: ["https"],
  definitions: {
    profiles: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
      },
    },
  },
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
              items: { $ref: "#/definitions/profiles" },
            },
          },
        },
      },
      post: {
        parameters: [
          {
            name: "body",
            in: "body",
            required: true,
            schema: { $ref: "#/definitions/profiles" },
          },
        ],
        responses: {
          201: { description: "Created" },
        },
      },
    },
  },
};

test("convertSwaggerToOpenApi31 yields openapi 3.1 with paths", async () => {
  const { spec, converter } = await convertSwaggerToOpenApi31(SAMPLE_SWAGGER);
  assert.equal(spec.openapi, "3.1.0");
  assert.equal(typeof converter, "string");
  assert.equal(typeof spec.info?.title, "string");
  assert.ok(spec.paths && typeof spec.paths === "object");
  assert.ok(Object.keys(/** @type {object} */ (spec.paths)).length > 0);
});

test("lite converter rewrites definition refs and body params", () => {
  const spec = convertSwagger2LiteToOpenApi31(SAMPLE_SWAGGER);
  assert.equal(spec.openapi, "3.1.0");
  const getSchema =
    /** @type {any} */ (spec).paths["/profiles"].get.responses["200"].content["application/json"].schema;
  assert.equal(getSchema.items.$ref, "#/components/schemas/profiles");
  const postBody = /** @type {any} */ (spec).paths["/profiles"].post.requestBody;
  assert.equal(postBody.content["application/json"].schema.$ref, "#/components/schemas/profiles");
  assert.ok(/** @type {any} */ (spec).components.schemas.profiles);
});

test("already-OpenAPI documents are normalized to 3.1 without swagger fields", async () => {
  const { spec } = await convertSwaggerToOpenApi31({
    openapi: "3.0.3",
    info: { title: "Live", version: "1" },
    paths: { "/x": { get: { responses: { 200: { description: "ok" } } } } },
  });
  assert.equal(spec.openapi, "3.1.0");
  assert.equal(/** @type {any} */ (spec).paths["/x"].get.responses["200"].description, "ok");
});

test("sanitizeSupabaseEnvValue strips quotes and Bearer prefix", () => {
  assert.equal(sanitizeSupabaseEnvValue('  "eyJabc.def"  '), "eyJabc.def");
  assert.equal(sanitizeSupabaseEnvValue("Bearer eyJabc.def"), "eyJabc.def");
  assert.equal(sanitizeSupabaseEnvValue("sb_publishable_x"), "sb_publishable_x");
});

test("getPostgrestAnonKey never reads VITE_* as primary", () => {
  const prevAnon = process.env.SUPABASE_ANON_KEY;
  const prevPublishable = process.env.SUPABASE_PUBLISHABLE_KEY;
  const prevVite = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const prevViteAnon = process.env.VITE_SUPABASE_ANON_KEY;
  const prevSecret = process.env.SUPABASE_SECRET_KEY;
  const prevService = process.env.SUPABASE_SERVICE_ROLE_KEY;

  delete process.env.SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_PUBLISHABLE_KEY;
  delete process.env.SUPABASE_SECRET_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "vite-should-not-be-primary";
  process.env.VITE_SUPABASE_ANON_KEY = "vite-anon-should-not-be-primary";

  try {
    assert.equal(getPostgrestAnonKey(), "");
    assert.deepEqual(getPostgrestAnonKeyCandidates(), [
      "vite-should-not-be-primary",
      "vite-anon-should-not-be-primary",
    ]);
    assert.deepEqual(getPostgrestAnonKeyCandidates(["client-forwarded-key"]), [
      "vite-should-not-be-primary",
      "vite-anon-should-not-be-primary",
      "client-forwarded-key",
    ]);
  } finally {
    if (prevAnon === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = prevAnon;
    if (prevPublishable === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = prevPublishable;
    if (prevVite === undefined) delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    else process.env.VITE_SUPABASE_PUBLISHABLE_KEY = prevVite;
    if (prevViteAnon === undefined) delete process.env.VITE_SUPABASE_ANON_KEY;
    else process.env.VITE_SUPABASE_ANON_KEY = prevViteAnon;
    if (prevSecret === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = prevSecret;
    if (prevService === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = prevService;
  }
});

test("fetchLivePostgrestOpenApi falls back to next key candidate after 401", async () => {
  clearPostgrestOpenApiCache();
  const prevUrl = process.env.SUPABASE_URL;
  const prevAnon = process.env.SUPABASE_ANON_KEY;
  const prevVite = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "bad-key";
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "good-key";

  let calls = 0;
  const fetchImpl = async (_url, init) => {
    calls += 1;
    const headers = new Headers(init?.headers);
    const key = headers.get("apikey");
    if (key === "good-key") {
      return {
        ok: true,
        status: 200,
        async json() {
          return SAMPLE_SWAGGER;
        },
      };
    }
    return {
      ok: false,
      status: 401,
      async json() {
        return { message: "unauthorized" };
      },
    };
  };

  try {
    const result = await fetchLivePostgrestOpenApi({ fetchImpl, now: () => 1_000 });
    assert.equal(result.spec.openapi, "3.1.0");
    assert.ok(calls >= 2);
  } finally {
    clearPostgrestOpenApiCache();
    if (prevUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = prevUrl;
    if (prevAnon === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = prevAnon;
    if (prevVite === undefined) delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    else process.env.VITE_SUPABASE_PUBLISHABLE_KEY = prevVite;
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
    assert.match(first.json, /"openapi":"3\.1\.0"/);
  } finally {
    clearPostgrestOpenApiCache();
    if (prevUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = prevUrl;
    if (prevAnon === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = prevAnon;
  }
});

test("fitOpenApiForServerless prunes oversized descriptions", () => {
  const huge = "x".repeat(200_000);
  const spec = {
    openapi: "3.1.0",
    info: { title: "t", version: "1", description: huge },
    paths: {
      "/a": {
        get: {
          description: huge,
          responses: { 200: { description: huge } },
        },
      },
    },
  };
  // Force prune path by making JSON large enough — pad paths.
  /** @type {Record<string, unknown>} */
  const paths = {};
  for (let i = 0; i < 30; i += 1) {
    paths[`/p${i}`] = {
      get: {
        description: huge,
        responses: { 200: { description: huge, content: { "application/json": { schema: { type: "object" } } } } },
      },
    };
  }
  spec.paths = paths;
  const fitted = fitOpenApiForServerless(spec);
  assert.ok(fitted.json.length < JSON.stringify(spec).length);
  assert.equal(fitted.spec.openapi, "3.1.0");
  assert.equal(/** @type {any} */ (fitted.spec).info.description, undefined);
});
