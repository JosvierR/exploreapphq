import { expect, test } from "@playwright/test";

test("home presents Explore and opens the interactive app preview", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Conoce Explore", level: 1 })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navegación principal" })).toHaveCount(1);
  await page.getByRole("button", { name: "Conoce la app", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Conoce la app", exact: true })).toBeFocused();
});

test("mobile navigation reaches the routes section without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Rutas", exact: true }).click();
  await expect(page).toHaveURL(/#rutas$/);
  await expect(page.getByRole("button", { name: "Abrir menú" })).toHaveAttribute("aria-expanded", "false");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("legal pages retain the existing shared header and footer", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Conoce la app", exact: true })).toHaveCount(0);
});
