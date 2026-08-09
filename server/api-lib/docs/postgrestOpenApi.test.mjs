import assert from "node:assert/strict";
import test from "node:test";
import { convertSwagger2LiteToOpenApi31 } from "./convertSwagger2Lite.mjs";
import {
  buildPostgrestAuthHeaderAttempts,
  clearPostgrestOpenApiCache,
  convertSwaggerToOpenApi31,
  fetchLivePostgrestOpenApi,
  fitOpenApiForServerless,
  getPostgrestAnonKey,
  getPostgrestOpenApiKeyCandidates,
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

test("buildPostgrestAuthHeaderAttempts never puts sb_ keys in Authorization alone as JWT", () => {
  const attempts = buildPostgrestAuthHeaderAttempts("sb_publishable_abc", "user-jwt");
  assert.ok(attempts.every((h) => h.apikey === "sb_publishable_abc"));
  assert.ok(attempts.some((h) => h.Authorization === "Bearer user-jwt"));
  assert.ok(attempts.every((h) => h.Authorization !== "Bearer sb_publishable_abc"));
});

test("openapi key candidates prefer service role first", () => {
  const prev = {
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
  };
  process.env.SUPABASE_SECRET_KEY = "eyJsecret";
  process.env.SUPABASE_ANON_KEY = "eyJanon";
  delete process.env.SUPABASE_PUBLISHABLE_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  delete process.env.VITE_SUPABASE_ANON_KEY;
  try {
    assert.deepEqual(getPostgrestOpenApiKeyCandidates(), ["eyJsecret", "eyJanon"]);
    assert.equal(getPostgrestAnonKey(), "eyJanon");
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

test("fetchLivePostgrestOpenApi falls back after publishable 401 to secret key", async () => {
  clearPostgrestOpenApiCache();
  const prevUrl = process.env.SUPABASE_URL;
  const prevAnon = process.env.SUPABASE_ANON_KEY;
  const prevSecret = process.env.SUPABASE_SECRET_KEY;
  const prevVite = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "sb_publishable_bad";
  process.env.SUPABASE_SECRET_KEY = "eyJservice-role";
  delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const fetchImpl = async (_url, init) => {
    const headers = new Headers(init?.headers);
    const key = headers.get("apikey");
    if (key === "eyJservice-role") {
      return {
        ok: true,
        status: 200,
        async json() {
          return SAMPLE_SWAGGER;
        },
        clone() {
          return this;
        },
        async text() {
          return "";
        },
      };
    }
    return {
      ok: false,
      status: 401,
      async json() {
        return { message: "Secret API key required" };
      },
      clone() {
        return this;
      },
      async text() {
        return JSON.stringify({ message: "Secret API key required" });
      },
    };
  };

  try {
    const result = await fetchLivePostgrestOpenApi({ fetchImpl, now: () => 1_000 });
    assert.equal(result.spec.openapi, "3.1.0");
  } finally {
    clearPostgrestOpenApiCache();
    if (prevUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = prevUrl;
    if (prevAnon === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = prevAnon;
    if (prevSecret === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = prevSecret;
    if (prevVite === undefined) delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    else process.env.VITE_SUPABASE_PUBLISHABLE_KEY = prevVite;
  }
});

test("fitOpenApiForServerless prunes oversized descriptions", () => {
  const huge = "x".repeat(200_000);
  const spec = {
    openapi: "3.1.0",
    info: { title: "t", version: "1", description: huge },
    paths: {},
  };
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
});
