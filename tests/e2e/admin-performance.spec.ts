import { performance as nodePerformance } from "node:perf_hooks";
import { expect, test } from "@playwright/test";
import { installAdminFixtures, loginAsAdmin } from "./admin-fixtures";

type BrowserLabMetrics = {
  cls: number;
  longTasks: number[];
  navigation: { domContentLoadedMs: number; loadMs: number } | null;
  resources: number;
  jsHeapUsedBytes: number | null;
};

test("production preview records bounded admin lab performance without duplicate analytics requests", async ({ page }) => {
  test.setTimeout(60_000);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  await page.addInitScript(() => {
    const lab = { cls: 0, longTasks: [] as number[] };
    Object.defineProperty(window, "__exploreAdminLab", { value: lab, configurable: true });
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) lab.longTasks.push(entry.duration);
      }).observe({ type: "longtask", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
          if (!shift.hadRecentInput) lab.cls += shift.value || 0;
        }
      }).observe({ type: "layout-shift", buffered: true });
    } catch {
      // Older engines can omit one of these observer entry types.
    }
  });

  const analyticsRequests = new Map<string, number>();
  let unrelatedTileRequests = 0;
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/admin/analytics/business/")) {
      const key = `${url.pathname}?${url.searchParams.toString()}`;
      analyticsRequests.set(key, (analyticsRequests.get(key) || 0) + 1);
    }
    if (/tile\.openstreetmap\.org|api\.maptiler\.com/.test(url.hostname)) unrelatedTileRequests += 1;
  });

  await installAdminFixtures(page, { mode: "ready", authorized: true }, { freezeTime: false });
  const authStart = nodePerformance.now();
  await loginAsAdmin(page);
  const authenticatedUsableMs = nodePerformance.now() - authStart;

  analyticsRequests.clear();
  const routeStart = nodePerformance.now();
  await page.getByRole("link", { name: "Product Analytics", exact: true }).click();
  await expect(page.locator(".admin-kpi-card").first()).toContainText("7,210");
  const productRouteUsableMs = nodePerformance.now() - routeStart;

  const response = page.waitForResponse((candidate) => {
    const url = new URL(candidate.url());
    return url.pathname === "/api/admin/analytics/business/overview" && url.searchParams.get("range") === "30d";
  });
  const filterStart = nodePerformance.now();
  await page.getByRole("combobox", { name: "Range", exact: true }).selectOption("30d");
  await response;
  await expect(page.locator(".admin-kpi-card").first()).toContainText("8,300");
  const filterResponseMs = nodePerformance.now() - filterStart;

  const duplicateAnalyticsRequests = [...analyticsRequests.entries()]
    .filter(([, count]) => count > 1)
    .map(([url, count]) => ({ url, count }));

  const cdpMetrics = await cdp.send("Performance.getMetrics");
  const cdpByName = Object.fromEntries(cdpMetrics.metrics.map((metric) => [metric.name, metric.value]));
  const browser = await page.evaluate(() => {
    const lab = (window as Window & { __exploreAdminLab?: { cls: number; longTasks: number[] } }).__exploreAdminLab;
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const memory = performance as Performance & { memory?: { usedJSHeapSize: number } };
    return {
      cls: lab?.cls || 0,
      longTasks: lab?.longTasks || [],
      navigation: navigation
        ? { domContentLoadedMs: navigation.domContentLoadedEventEnd, loadMs: navigation.loadEventEnd }
        : null,
      resources: performance.getEntriesByType("resource").length,
      jsHeapUsedBytes: memory.memory?.usedJSHeapSize ?? null,
    } satisfies BrowserLabMetrics;
  });

  const result = {
    environment: "local production preview with sanitized deterministic API fixtures",
    browserEngine: "Playwright Chromium",
    authenticatedUsableMs: Math.round(authenticatedUsableMs),
    productRouteUsableMs: Math.round(productRouteUsableMs),
    filterResponseMs: Math.round(filterResponseMs),
    analyticsRequestCount: [...analyticsRequests.values()].reduce((sum, count) => sum + count, 0),
    duplicateAnalyticsRequests,
    unrelatedTileRequests,
    browserMetrics: browser,
    cdp: {
      taskDurationMs: Math.round((cdpByName.TaskDuration || 0) * 1_000),
      scriptDurationMs: Math.round((cdpByName.ScriptDuration || 0) * 1_000),
      layoutDurationMs: Math.round((cdpByName.LayoutDuration || 0) * 1_000),
      nodes: cdpByName.Nodes || null,
    },
  };
  console.log(`ADMIN_PERFORMANCE_LAB=${JSON.stringify(result)}`);
  await test.info().attach("admin-performance-lab.json", {
    body: Buffer.from(`${JSON.stringify(result, null, 2)}\n`),
    contentType: "application/json",
  });

  expect(authenticatedUsableMs).toBeLessThan(15_000);
  expect(productRouteUsableMs).toBeLessThan(10_000);
  expect(filterResponseMs).toBeLessThan(10_000);
  expect(duplicateAnalyticsRequests).toEqual([]);
  expect(unrelatedTileRequests).toBe(0);
  if (browser.jsHeapUsedBytes != null) expect(browser.jsHeapUsedBytes).toBeLessThan(300 * 1024 * 1024);
});
