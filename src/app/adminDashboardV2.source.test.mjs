import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (relativePath) => readFile(new URL(relativePath, import.meta.url), "utf8");

test("admin routes remain lazy and preserve the canonical route split", async () => {
  const router = await readSource("./router.tsx");

  for (const component of [
    "AdminLayout",
    "AdminDashboardPage",
    "AdminAnalyticsPage",
    "AdminBusinessInsightsPage",
    "AdminTourismBusinessPage",
    "ReportsAdminPage",
    "WaitlistAdminPage",
  ]) {
    assert.match(router, new RegExp(`const ${component} = lazy\\(`));
  }

  assert.match(router, /path: "\/admin\/analytics"/);
  assert.match(router, /path: "\/admin\/analytics\/data"/);
  assert.match(router, /path: "\/admin\/analytics\/business"/);
});

test("shareable analytics filters are URL-owned and requests are abortable", async () => {
  const [product, tourism, layout] = await Promise.all([
    readSource("../pages/admin/AdminBusinessInsightsPage.tsx"),
    readSource("../pages/admin/AdminTourismBusinessPage.tsx"),
    readSource("../components/layout/AdminLayout.tsx"),
  ]);

  for (const source of [product, tourism]) {
    assert.match(source, /useSearchParams\(\)/);
    assert.match(source, /new AbortController\(\)/);
    assert.match(source, /replace: true/);
    assert.doesNotMatch(source, /new URLSearchParams\(window\.location\.search\)/);
  }

  assert.doesNotMatch(layout, /key=\{`\$\{location\.pathname\}\$\{location\.search\}`\}/);
});

test("the command-center navigation exposes explicit domain labels", async () => {
  const layout = await readSource("../components/layout/AdminLayout.tsx");

  for (const label of [
    "Product Analytics",
    "Growth & Engagement",
    "Tourism Intelligence",
    "Markets & Demand",
    "Analytics Operations",
    "System Health",
    "Admin Management",
  ]) {
    assert.match(layout, new RegExp(label.replace(/[&]/g, "\\&")));
  }
});
