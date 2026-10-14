import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: "**/*performance.spec.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: [["list"], ["html", { open: "never" }]],
  outputDir: "test-results",
  snapshotPathTemplate: "{testDir}/../../docs/admin-v3.2/screenshots/{arg}{ext}",
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      // Local Windows Chromium vs GitHub windows-latest can differ slightly in
      // font AA / subpixel rasterization (~1–2%). Keep visual coverage without
      // false negatives on access-denied and other text-heavy states.
      maxDiffPixelRatio: 0.03,
    },
  },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4173",
    colorScheme: "light",
    locale: "en-US",
    timezoneId: "America/New_York",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --mode e2e --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173/admin",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_APP_ENV: "testing",
      VITE_MAPTILER_KEY: "e2e-map-key",
      VITE_SUPABASE_URL: "http://127.0.0.1:54321",
      VITE_SUPABASE_PUBLISHABLE_KEY: "e2e-public-key",
      VITE_SITE_URL: "http://127.0.0.1:4173",
    },
  },
});
