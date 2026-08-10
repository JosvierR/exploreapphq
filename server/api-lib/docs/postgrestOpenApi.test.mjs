import assert from "node:assert/strict";
import test from "node:test";
import { convertSwagger2LiteToOpenApi31 } from "./convertSwagger2Lite.mjs";
import {
  buildPostgrestSecretAuthAttempts,
  clearPostgrestOpenApiCache,
  convertSwaggerToOpenApi31,
  fetchLivePostgrestOpenApi,
  fitOpenApiForServerless,
  getPostgrestSecretKey,
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
    },
  },
};

test("convertSwaggerToOpenApi31 yields openapi 3.1 with paths", async () => {
  const { spec, converter } = await convertSwaggerToOpenApi31(SAMPLE_SWAGGER);
  assert.equal(spec.openapi, "3.1.0");
  assert.equal(typeof converter, "string");
  assert.ok(Object.keys(/** @type {object} */ (spec.paths)).length > 0);
});

test("lite converter rewrites definition refs", () => {
  const spec = convertSwagger2LiteToOpenApi31(SAMPLE_SWAGGER);
  assert.equal(spec.openapi, "3.1.0");
  const getSchema =
    /** @type {any} */ (spec).paths["/profiles"].get.responses["200"].content["application/json"].schema;
  assert.equal(getSchema.items.$ref, "#/components/schemas/profiles");
});

test("sanitizeSupabaseEnvValue strips quotes and Bearer prefix", () => {
  assert.equal(sanitizeSupabaseEnvValue('  "eyJabc.def"  '), "eyJabc.def");
  assert.equal(sanitizeSupabaseEnvValue("Bearer eyJabc.def"), "eyJabc.def");
});

test("secret auth attempts match boardAdminProvision for JWT service_role", () => {
  const attempts = buildPostgrestSecretAuthAttempts("eyJservice");
  assert.equal(attempts[0].apikey, "eyJservice");
  assert.equal(attempts[0].Authorization, "Bearer eyJservice");
});

test("secret auth attempts keep sb_secret off JWT-first Bearer mismatch", () => {
  const attempts = buildPostgrestSecretAuthAttempts("sb_secret_abc");
  assert.equal(attempts[0].apikey, "sb_secret_abc");
  assert.equal(attempts[0].Authorization, undefined);
});

test("fetchLivePostgrestOpenApi uses SUPABASE_SECRET_KEY like analytics", async () => {
  clearPostgrestOpenApiCache();
  const prevUrl = process.env.SUPABASE_URL;
  const prevSecret = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "eyJservice-role";

  const fetchImpl = async (_url, init) => {
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("apikey"), "eyJservice-role");
    assert.equal(headers.get("Authorization"), "Bearer eyJservice-role");
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
  };

  try {
    assert.equal(getPostgrestSecretKey(), "eyJservice-role");
    const result = await fetchLivePostgrestOpenApi({ fetchImpl, now: () => 1_000 });
    assert.equal(result.spec.openapi, "3.1.0");
    assert.match(result.json, /"openapi":"3\.1\.0"/);
  } finally {
    clearPostgrestOpenApiCache();
    if (prevUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = prevUrl;
    if (prevSecret === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = prevSecret;
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
        responses: { 200: { description: huge } },
      },
    };
  }
  spec.paths = paths;
  const fitted = fitOpenApiForServerless(spec);
  assert.ok(fitted.json.length < JSON.stringify(spec).length);
});
