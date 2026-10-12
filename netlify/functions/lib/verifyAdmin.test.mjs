import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { verifyAdminRequest } from "./verifyAdmin.mjs";

test("missing bearer token is rejected as unauthenticated", async () => {
  const result = await verifyAdminRequest(new Request("https://example.test/api/admin/waitlist"));

  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
});

test("legacy hardcoded admin token is rejected", async () => {
  const legacyToken = `hc_${Buffer.from("admin@example.com:Admin").toString("base64")}`;
  const result = await verifyAdminRequest(
    new Request("https://example.test/api/admin/waitlist", {
      headers: { authorization: `Bearer ${legacyToken}` },
    }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
});

test("authenticated Supabase user without an admin role is forbidden", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    EXPLORE_ADMIN_ALLOWED_EMAILS: process.env.EXPLORE_ADMIN_ALLOWED_EMAILS,
    VITE_ADMIN_EMAILS: process.env.VITE_ADMIN_EMAILS,
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
  };

  process.env.SUPABASE_URL = "https://admin-auth-test.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "test-service-key";
  delete process.env.EXPLORE_ADMIN_ALLOWED_EMAILS;
  delete process.env.VITE_ADMIN_EMAILS;
  delete process.env.ADMIN_EMAILS;

  globalThis.fetch = async (input) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes("/auth/v1/user")) {
      return new Response(JSON.stringify({ id: "viewer-1", email: "viewer@example.test" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("/rest/v1/admin_users")) {
      return new Response("[]", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    throw new Error(`Unexpected test request: ${url}`);
  };

  try {
    const result = await verifyAdminRequest(
      new Request("https://example.test/api/admin/waitlist", {
        headers: { authorization: "Bearer valid-viewer-token" },
      }),
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, 403);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("active admin auth sources contain no hardcoded bypass", async () => {
  const files = [
    new URL("../../../src/lib/adminApi.ts", import.meta.url),
    new URL("../../../server/adminAuth.ts", import.meta.url),
    new URL("./verifyAdmin.mjs", import.meta.url),
  ];
  const sources = await Promise.all(files.map((path) => readFile(path, "utf8")));
  const source = sources.join("\n");

  assert.doesNotMatch(source, /admin@example\.com|hardcodedAdmin|hc_\$\{/i);
});
