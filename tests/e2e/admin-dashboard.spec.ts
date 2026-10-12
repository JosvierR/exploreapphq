import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
  installAdminFixtures,
  loginAsAdmin,
  settleVisuals,
  type FixtureState,
} from "./admin-fixtures";

const principalViews = [
  { slug: "executive", url: "/admin", title: "Executive Dashboard" },
  { slug: "analytics-ops", url: "/admin/analytics", title: "Analytics Operations" },
  { slug: "product-analytics", url: "/admin/analytics/data", title: "Product Analytics" },
  { slug: "tourism-intelligence", url: "/admin/analytics/business", title: "Tourism Intelligence" },
  { slug: "users", url: "/admin?section=users", title: "Users" },
  { slug: "content", url: "/admin?section=content", title: "Content" },
  { slug: "reports", url: "/admin/reports", title: "Reports" },
  { slug: "system", url: "/admin?section=system", title: "System Health" },
] as const;

const viewports = [
  { slug: "mobile-375x812", width: 375, height: 812 },
  { slug: "tablet-768x1024", width: 768, height: 1024 },
  { slug: "laptop-1024x768", width: 1024, height: 768 },
  { slug: "desktop-1440x900", width: 1440, height: 900 },
  { slug: "large-1920x1080", width: 1920, height: 1080 },
] as const;

test.describe("admin authentication and permissions", () => {
  test("rejects invalid credentials, accepts the sanitized admin, and signs out", async ({ page }) => {
    const state: FixtureState = { mode: "ready", authorized: true };
    await installAdminFixtures(page, state);
    await page.goto("/admin");

    await page.getByLabel("Work email").fill("invalid@example.test");
    await page.getByLabel("Password").fill("invalid-password");
    await page.getByRole("button", { name: "Sign in to console" }).click();
    await expect(page.getByRole("alert")).toContainText("Incorrect email or password");

    await page.getByLabel("Work email").fill(TEST_ADMIN_EMAIL);
    await page.getByLabel("Password").fill(TEST_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in to console" }).click();
    await expect(page.getByRole("heading", { name: "Executive Dashboard", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("shows access denied for an authenticated non-admin", async ({ page }) => {
    const state: FixtureState = { mode: "ready", authorized: false };
    await installAdminFixtures(page, state);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin");
    await page.getByLabel("Work email").fill(TEST_ADMIN_EMAIL);
    await page.getByLabel("Password").fill(TEST_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in to console" }).click();
    await expect(page.getByRole("heading", { name: "Not authorized" })).toBeVisible();
    await settleVisuals(page);
    await expect(page).toHaveScreenshot("states/access-denied--desktop-1440x900.png");
  });

  test("recovers from interrupted verification and rejects an expired session", async ({ page }) => {
    const state: FixtureState = { mode: "ready", authorized: true, adminMeFailure: "network" };
    await installAdminFixtures(page, state);
    await page.goto("/admin");
    await page.getByLabel("Work email").fill(TEST_ADMIN_EMAIL);
    await page.getByLabel("Password").fill(TEST_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in to console" }).click();
    await expect(page.getByRole("heading", { name: "Console API unreachable" })).toBeVisible();

    state.adminMeFailure = undefined;
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByRole("heading", { name: "Executive Dashboard", exact: true })).toBeVisible();

    state.adminMeFailure = "unauthenticated";
    await page.getByRole("button", { name: "Refresh admin data" }).click();
    await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  });

  test("keeps the authenticated session and a shared filtered URL across tabs", async ({ context, page }) => {
    await installAdminFixtures(page, { mode: "ready", authorized: true });
    await loginAsAdmin(page);

    const secondPage = await context.newPage();
    await installAdminFixtures(secondPage, { mode: "ready", authorized: true });
    await secondPage.goto("/admin/analytics/data?range=30d&platform=ios&source=mobile&content=place&tab=growth");
    await expect(secondPage.getByRole("heading", { name: "Product Analytics", exact: true })).toBeVisible();
    await expect(secondPage.getByRole("combobox", { name: "Range", exact: true })).toHaveValue("30d");
    await expect(secondPage.getByRole("combobox", { name: "Platform", exact: true })).toHaveValue("ios");
    await expect(secondPage.getByRole("combobox", { name: "Source", exact: true })).toHaveValue("mobile");
    await expect(secondPage.getByRole("combobox", { name: "Content", exact: true })).toHaveValue("place");
    await expect(secondPage.getByRole("button", { name: "Growth & engagement" })).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("admin workflows", () => {
  let state: FixtureState;

  test.beforeEach(async ({ page }) => {
    state = { mode: "ready", authorized: true };
    await installAdminFixtures(page, state);
    await loginAsAdmin(page);
  });

  test("sidebar navigation, collapse persistence, and mobile drawer work", async ({ page }) => {
    await page.getByRole("link", { name: "Product Analytics" }).click();
    await expect(page).toHaveURL(/\/admin\/analytics\/data$/);
    await expect(page.locator(".admin-console__page-title h1")).toHaveText("Product Analytics");

    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await expect(page.locator(".admin-console")).toHaveClass(/is-collapsed/);
    await page.reload();
    await expect(page.locator(".admin-console")).toHaveClass(/is-collapsed/);

    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByRole("button", { name: "Open admin navigation" }).click();
    await expect(page.getByRole("navigation", { name: "Admin sections" })).toBeVisible();
    await expect(page.locator(".admin-console")).toHaveClass(/is-nav-open/);
    await page.keyboard.press("Escape");
    await expect(page.locator(".admin-console")).not.toHaveClass(/is-nav-open/);
  });

  test("product filters own the URL, survive history navigation, and export CSV", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/admin/analytics/data");
    await expect(page.getByRole("heading", { name: "Product Analytics", exact: true })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.getByRole("combobox", { name: "Range", exact: true }).selectOption("30d");
    await expect(page).toHaveURL(/range=30d/);
    await page.waitForLoadState("networkidle");
    await page.getByRole("combobox", { name: "Platform", exact: true }).selectOption("ios");
    await expect(page).toHaveURL(/platform=ios/);
    await page.waitForLoadState("networkidle");
    await page.getByRole("combobox", { name: "Source", exact: true }).selectOption("mobile");
    await expect(page).toHaveURL(/source=mobile/);
    await page.waitForLoadState("networkidle");
    await page.getByRole("combobox", { name: "Content", exact: true }).selectOption("place");
    await expect(page).toHaveURL(/content=place/);

    await page.getByRole("button", { name: "Growth & engagement" }).click();
    await expect(page).toHaveURL(/tab=growth/);
    await page.goBack();
    await expect(page).not.toHaveURL(/tab=growth/);
    await page.goForward();
    await expect(page).toHaveURL(/tab=growth/);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export growth" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^explore-growth-30d\.csv$/);
  });

  test("product analytics stays usable when content data is partial", async ({ page }) => {
    state.partialBusinessContent = true;
    await page.goto("/admin/analytics/data?tab=content");

    await expect(page.getByRole("heading", { name: "Product Analytics", exact: true })).toBeVisible();
    await expect(page.getByText("Something went wrong in admin UI")).toHaveCount(0);
    await expect(page.getByText("No ranked videos yet")).toBeVisible();
  });

  test("rapid range changes cannot let a stale response replace the latest selection", async ({ page }) => {
    state.rangeDelays = { "90d": 800, "24h": 20 };
    await page.goto("/admin/analytics/data");

    const range = page.getByRole("combobox", { name: "Range", exact: true });
    await range.selectOption("90d");
    await range.selectOption("24h");
    await expect(page).toHaveURL(/range=24h/);
    await page.waitForTimeout(900);
    await expect(range).toHaveValue("24h");
    await expect(page.locator(".admin-kpi-card").first()).toContainText("2,400");
  });

  test("tourism filters, tabs, geography drilldown, and export work", async ({ page }) => {
    await page.goto("/admin/analytics/business");
    await expect(page.getByRole("heading", { name: "Tourism Intelligence", exact: true })).toBeVisible();
    await page.getByRole("combobox", { name: "Range", exact: true }).selectOption("90d");
    await page.getByRole("combobox", { name: "Compare to", exact: true }).selectOption("previous_year");
    await page.getByRole("combobox", { name: "Category", exact: true }).selectOption("Restaurants");
    await page.getByRole("combobox", { name: "Platform", exact: true }).selectOption("android");
    await page.getByRole("combobox", { name: "Source", exact: true }).selectOption("mobile");
    await expect(page).toHaveURL(/range=90d/);
    await expect(page).toHaveURL(/compare=previous_year/);
    await expect(page).toHaveURL(/category=Restaurants/);

    await page.getByRole("button", { name: "Geography", exact: true }).click();
    await expect(page).toHaveURL(/tab=geography/);
    await page.getByRole("button", { name: "Dominican Republic" }).last().click();
    await expect(page).toHaveURL(/country=do/);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^explore-business-90d-/);
  });

  test("secondary sidebar destinations resolve to the expected current route", async ({ page }) => {
    test.setTimeout(90_000);
    const destinations = [
      { link: "Growth & Engagement", title: "Product Analytics", url: /\/admin\/analytics\/data\?tab=growth/ },
      { link: "Markets & Demand", title: "Tourism Intelligence", url: /\/admin\/analytics\/business\?tab=demand/ },
      { link: "Places & Routes", title: "Content", url: /section=content.*content=places/ },
      { link: "Moderation", title: "Moderation", url: /section=moderation/ },
      { link: "Reports", title: "Reports", url: /\/admin\/reports/ },
      { link: "Waitlist", title: "Waitlist", url: /\/admin\/waitlist/ },
      { link: "Explore Lab", title: "Explore Lab", url: /\/admin\/lab/ },
      { link: "API Documentation", title: "API Documentation", url: /\/admin\/api-docs/ },
      { link: "Admin Management", title: "Admin Management", url: /section=admins/ },
    ] as const;

    for (const destination of destinations) {
      await page.getByRole("link", { name: destination.link, exact: true }).click();
      await expect(page).toHaveURL(destination.url);
      await expect(page.locator(".admin-console__page-title h1")).toHaveText(destination.title);
    }
  });
});

test("principal visual matrix has no horizontal document overflow", async ({ page }) => {
  test.setTimeout(240_000);
  await installAdminFixtures(page, { mode: "ready", authorized: true });
  await loginAsAdmin(page);

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const view of principalViews) {
      await page.goto(view.url);
      await expect(page.locator(".admin-console__page-title h1")).toHaveText(view.title);
      await settleVisuals(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${view.url} at ${viewport.width}x${viewport.height}`).toBeLessThanOrEqual(1);
      await expect(page).toHaveScreenshot(`principal/${view.slug}--${viewport.slug}.png`);
    }
  }
});

test("important loading, empty, error, navigation, collapse, and chart states are captured", async ({ page }) => {
  test.setTimeout(120_000);
  const state: FixtureState = { mode: "ready", authorized: true };
  await installAdminFixtures(page, state);
  await loginAsAdmin(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  state.rangeDelays = { "7d": 2_000 };
  await page.goto("/admin/analytics/data");
  await expect(page.getByRole("heading", { name: "Product Analytics", exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot("states/loading-product-analytics--desktop-1440x900.png");
  state.rangeDelays = undefined;

  state.mode = "empty";
  await page.goto("/admin/analytics/business");
  await settleVisuals(page);
  await expect(page).toHaveScreenshot("states/empty-tourism-intelligence--desktop-1440x900.png");

  state.mode = "error";
  await page.goto("/admin/analytics/data");
  await settleVisuals(page);
  await expect(page).toHaveScreenshot("states/api-error-product-analytics--desktop-1440x900.png");

  state.mode = "ready";
  await page.goto("/admin");
  await settleVisuals(page);
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(page).toHaveScreenshot("states/sidebar-collapsed--desktop-1440x900.png");

  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("button", { name: "Open admin navigation" }).click();
  await expect(page).toHaveScreenshot("states/mobile-navigation-open--mobile-375x812.png");
  await page.keyboard.press("Escape");

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin");
  await settleVisuals(page);
  const chart = page.locator(".recharts-wrapper").filter({ has: page.locator(".recharts-cartesian-grid") }).first();
  await chart.hover({ force: true });
  await expect(page).toHaveScreenshot("states/chart-hover--desktop-1440x900.png");
});

test("core pages have no critical or serious axe violations", async ({ page }) => {
  await installAdminFixtures(page, { mode: "ready", authorized: true });
  await loginAsAdmin(page);
  for (const url of ["/admin", "/admin/analytics/data", "/admin/analytics/business", "/admin/reports"]) {
    await page.goto(url);
    await settleVisuals(page);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const blocking = results.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious");
    expect(blocking, `${url}: ${blocking.map((item) => `${item.id} (${item.nodes.length})`).join(", ")}`).toEqual([]);
  }
});
