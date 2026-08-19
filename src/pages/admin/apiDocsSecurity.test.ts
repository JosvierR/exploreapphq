import assert from "node:assert/strict";
import {
  authorizeApiDocsRequest,
  buildAuthorizedApiDocsRequest,
  buildTryItOutRules,
  prepareApiDocsSource,
  scalarAuthentication,
  type ApiDocsSource,
} from "./apiDocsSecurity";

const rawSources: ApiDocsSource[] = [
  {
    title: "PostgREST",
    slug: "postgrest",
    content: {
      openapi: "3.1.0",
      info: { title: "PostgREST", version: "1" },
      servers: [{ url: "https://project.supabase.co/rest/v1" }],
      paths: {
        "/places": {
          get: { operationId: "getPlaces", responses: { "200": { description: "OK" } } },
          delete: { operationId: "deletePlaces", responses: { "204": { description: "Deleted" } } },
        },
      },
    },
  },
  {
    title: "Edge",
    slug: "edge",
    content: {
      openapi: "3.1.0",
      info: { title: "Edge", version: "1" },
      paths: {
        "/generate-upload-url": { post: { operationId: "postGenerateUploadUrl" } },
        "/cloudflare-stream-webhook": { post: { operationId: "postCloudflareStreamWebhook" } },
      },
    },
  },
  {
    title: "Admin",
    slug: "admin",
    content: {
      openapi: "3.1.0",
      info: { title: "Admin", version: "1" },
      paths: {
        "/api/admin/reports": { get: { operationId: "getAdminReports", security: [{ bearerAuth: [] }] } },
        "/api/admin/admins": {
          delete: { operationId: "deleteAdminRoster", security: [{ bearerAuth: [] }] },
        },
        "/api/metrics": { get: { operationId: "getTokenMetrics", security: [{ metricsTokenAuth: [] }] } },
      },
    },
  },
];

const sources = rawSources.map(prepareApiDocsSource);
const rules = buildTryItOutRules(sources, {
  appOrigin: "https://exploreapphq.com",
  supabaseUrl: "https://project.supabase.co",
});

function builder() {
  return { headers: new Headers() };
}

function authorize(url: string, method: string) {
  const requestBuilder = builder();
  authorizeApiDocsRequest({
    request: new Request(url, { method }),
    requestBuilder,
    accessToken: "admin.jwt",
    publishableKey: "sb_publishable_public",
    rules,
  });
  return requestBuilder.headers;
}

assert.equal(sources[0].content.paths && (sources[0].content.paths as any)["/places"].delete["x-explore-try-it-out-disabled"], true);
assert.match((sources[0].content.paths as any)["/places"].delete.description, /Try it out disabled/);
assert.deepEqual((sources[0].content.components as any).securitySchemes.bearerAuth.scheme, "bearer");

const postgrestHeaders = authorize("https://project.supabase.co/rest/v1/places?select=id", "GET");
assert.equal(postgrestHeaders.get("Authorization"), "Bearer admin.jwt");
assert.equal(postgrestHeaders.get("apikey"), "sb_publishable_public");

const adminHeaders = authorize("https://exploreapphq.com/api/admin/reports", "GET");
assert.equal(adminHeaders.get("Authorization"), "Bearer admin.jwt");
assert.equal(adminHeaders.get("apikey"), null);

assert.throws(
  () => authorize("https://project.supabase.co/rest/v1/places?id=eq.1", "DELETE"),
  /disabled/,
);
assert.throws(() => authorize("https://exploreapphq.com/api/admin/admins", "DELETE"), /disabled/);
assert.throws(() => authorize("https://exploreapphq.com/api/metrics", "GET"), /disabled/);
assert.throws(
  () => authorize("https://project.supabase.co/functions/v1/cloudflare-stream-webhook", "POST"),
  /disabled/,
);
assert.throws(() => authorize("https://evil.example/api/admin/reports", "GET"), /allowlist/);
assert.throws(
  () =>
    authorizeApiDocsRequest({
      request: new Request("https://exploreapphq.com/api/admin/reports"),
      requestBuilder: builder(),
      accessToken: "",
      publishableKey: "sb_publishable_public",
      rules,
    }),
  /active admin session/,
);

const finalRequest = buildAuthorizedApiDocsRequest({
  request: new Request("https://project.supabase.co/functions/v1/generate-upload-url", { method: "POST" }),
  accessToken: "refreshed.jwt",
  publishableKey: "sb_publishable_public",
  rules,
});
assert.equal(finalRequest.headers.get("Authorization"), "Bearer refreshed.jwt");
assert.equal(finalRequest.headers.get("apikey"), "sb_publishable_public");
assert.throws(
  () =>
    buildAuthorizedApiDocsRequest({
      request: new Request("https://evil.example/steal", { method: "GET" }),
      accessToken: "admin.jwt",
      publishableKey: "sb_publishable_public",
      rules,
    }),
  /allowlist/,
);

assert.deepEqual(scalarAuthentication("new.jwt", "sb_publishable_public"), {
  preferredSecurityScheme: "bearerAuth",
  securitySchemes: {
    bearerAuth: { token: "new.jwt" },
    supabasePublishableKey: { name: "apikey", in: "header", value: "sb_publishable_public" },
  },
});
