import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../../..");

/** Express-only local waitlist/auth helpers — not on Vercel router.mjs. */
export const EXPRESS_ONLY_API_PATHS = Object.freeze(["/api/access", "/api/me"]);

/**
 * @param {string} relativeFromRoot
 */
export function readRepoFile(relativeFromRoot) {
  return readFileSync(join(repoRoot, relativeFromRoot), "utf8");
}

/**
 * Routes dispatched by `server/api-lib/router.mjs` (canonical production surface).
 * @returns {string[]} OpenAPI-style paths (`/api/...`)
 */
export function extractRouterApiPaths() {
  const router = readRepoFile("server/api-lib/router.mjs");
  const moderation = readRepoFile("server/api-lib/moderation/moderationRouter.mjs");
  const analytics = readRepoFile("server/api-lib/analytics/analyticsAdminApi.mjs");
  const docs = readRepoFile("server/api-lib/docs/docsRouter.mjs");

  /** @type {Set<string>} */
  const routes = new Set();

  for (const source of [router, moderation]) {
    for (const match of source.matchAll(/route === ["']([^"']+)["']/g)) {
      routes.add(match[1]);
    }
  }

  // Parameterized moderation report detail (`/^admin\/reports\/([^/]+)$/`).
  if (moderation.includes("handleAdminReportById") || /admin\\\/reports\\\//.test(moderation)) {
    routes.add("admin/reports/{id}");
  }

  // Analytics handler map keys (exact route strings only).
  for (const match of analytics.matchAll(/^\s*"((?:admin\/analytics\/)[^"]+)"\s*:/gm)) {
    const key = match[1];
    if (key.includes(":") || key.endsWith("/")) continue;
    routes.add(key);
  }
  if (analytics.includes('route.startsWith("admin/analytics/events/")')) {
    routes.add("admin/analytics/events/{eventId}");
  }

  // OpenAPI surfaces (docs router + OPENAPI_SURFACES).
  if (docs.includes("isOpenApiDocsRoute") || router.includes("isOpenApiDocsRoute")) {
    const surfacesSource = readRepoFile("server/api-lib/docs/minimalSpecs.mjs");
    for (const match of surfacesSource.matchAll(/"((?:postgrest|edge|admin))"/g)) {
      routes.add(`admin/openapi/${match[1]}`);
    }
  }

  // Explicit router branches that use helpers rather than `route ===`.
  if (router.includes('route === "events"') || router.includes('route === "events"')) {
    routes.add("events");
  }
  if (router.includes("cron/analytics/aggregate")) routes.add("cron/analytics/aggregate");
  if (router.includes("admin/system/health")) routes.add("admin/system/health");
  if (router.includes("admin/system/metrics")) routes.add("admin/system/metrics");
  if (router.includes("admin/system/bootstrap-board")) routes.add("admin/system/bootstrap-board");
  if (router.includes('route === "metrics"')) routes.add("metrics");
  if (router.includes("waitlist/signup")) routes.add("waitlist/signup");
  if (router.includes("admin/waitlist/notify-launch")) routes.add("admin/waitlist/notify-launch");
  if (router.includes('route === "admin/waitlist"')) routes.add("admin/waitlist");
  if (router.includes("admin/broadcast")) routes.add("admin/broadcast");
  if (router.includes("pioneers/landing")) routes.add("pioneers/landing");
  if (router.includes("feedback/submit")) routes.add("feedback/submit");
  if (router.includes("admin/analytics/")) {
    // Prefix catch-all is expanded via analyticsAdminApi map above.
  }

  return [...routes].map(toApiPath).sort();
}

/**
 * Paths mounted on local Express (`server/index.ts`).
 * @returns {string[]}
 */
export function extractExpressApiPaths() {
  const source = readRepoFile("server/index.ts");
  /** @type {Set<string>} */
  const paths = new Set();

  for (const match of source.matchAll(/app\.(?:all|get|post|put|patch|delete)\(\s*[`'"](\/api\/[^`'"]+)[`'"]/g)) {
    const raw = match[1];
    // Skip template-literal stubs like `/api/admin/analytics/${segment}`.
    if (raw.includes("${")) continue;
    paths.add(normalizeExpressPath(raw));
  }

  // Segment loops.
  const analyticsSegments = extractStringArray(source, "analyticsRouteSegments");
  for (const segment of analyticsSegments) {
    paths.add(`/api/admin/analytics/${segment}`);
  }
  const businessSegments = extractStringArray(source, "businessAnalyticsSegments");
  for (const segment of businessSegments) {
    paths.add(`/api/admin/analytics/business/${segment}`);
  }
  const openApiSurfaces = extractStringArray(source, "openApiSurfaces");
  for (const surface of openApiSurfaces) {
    paths.add(`/api/admin/openapi/${surface}`);
  }

  // Template literals with ${segment} already handled; catch parameterized routes.
  if (source.includes("/api/admin/analytics/events/:eventId")) {
    paths.add("/api/admin/analytics/events/{eventId}");
  }
  if (source.includes("/api/admin/reports/:id")) {
    paths.add("/api/admin/reports/{id}");
  }

  return [...paths].sort();
}

/**
 * @param {Record<string, unknown>} openApiDoc
 * @returns {string[]}
 */
export function extractOpenApiPaths(openApiDoc) {
  const paths = openApiDoc?.paths;
  if (!paths || typeof paths !== "object") return [];
  return Object.keys(/** @type {object} */ (paths)).sort();
}

/**
 * @param {string} route
 */
function toApiPath(route) {
  if (route.startsWith("/api/")) return route;
  return `/api/${route.replace(/^\//, "")}`;
}

/**
 * @param {string} path
 */
function normalizeExpressPath(path) {
  return path.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, "{$1}");
}

/**
 * @param {string} source
 * @param {string} constName
 * @returns {string[]}
 */
function extractStringArray(source, constName) {
  const re = new RegExp(`const\\s+${constName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as\\s+const`, "m");
  const match = source.match(re);
  if (!match) return [];
  return [...match[1].matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);
}

export function getRepoRoot() {
  return repoRoot;
}

export function getOpenApiAdminYamlPath() {
  return join(here, "openapi.admin.yaml");
}
