import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

test("admin roster API is wired through moderation router", () => {
  const router = readFileSync(join(here, "moderationRouter.mjs"), "utf8");
  assert.match(router, /route === "admin\/admins"/);
  assert.match(router, /handleAdminRoster/);
});

test("admin roster module exports handleAdminRoster", async () => {
  const mod = await import("./adminRosterApi.mjs");
  assert.equal(typeof mod.handleAdminRoster, "function");
});
