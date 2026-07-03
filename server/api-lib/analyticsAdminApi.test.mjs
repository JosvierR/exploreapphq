import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const adminApiSource = readFileSync(fileURLToPath(new URL("./analyticsAdminApi.mjs", import.meta.url)), "utf8");
const routerSource = readFileSync(fileURLToPath(new URL("./apiRouter.mjs", import.meta.url)), "utf8");

assert.match(adminApiSource, /requireAdmin\(request\)/, "admin analytics handlers require admin auth");
assert.match(adminApiSource, /query_hash/, "search insights use query_hash only");
assert.doesNotMatch(adminApiSource, /top_query_hashes[\s\S]*query_text/, "search insights must not expose raw query text");
assert.match(adminApiSource, /sanitizeAdminJson/, "admin responses sanitize nested payloads");
assert.match(adminApiSource, /payload_summary/, "dead letters expose payload summary only");
assert.match(adminApiSource, /DATE_RE\.test\(day\)/, "aggregation validates date format");
assert.match(adminApiSource, /aggregate_analytics_events_for_day/, "aggregation uses RPC only");
assert.match(adminApiSource, /range\(offset, offset \+ limit - 1\)/, "event explorer paginates");
assert.match(routerSource, /dispatchAdminAnalyticsApi/, "api router dispatches admin analytics routes");
assert.doesNotMatch(routerSource, /api\/lib\//, "api router must not add api/lib serverless files");

console.log("analyticsAdminApi tests passed");
