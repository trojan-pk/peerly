import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";

const WORKSPACE = ["/dashboard", "/peers", "/resources", "/resources/manage", "/settings", "/admin/reports"];

async function theme(page: Page) {
  return page.evaluate(() => ({ theme: document.documentElement.dataset.theme, preference: document.documentElement.dataset.themePreference }));
}

test("theme toggle persists without a flash, follows the system and is keyboard operable", async ({ page, context, app }) => {
  await app.signIn(context, "learner");
  // Record the theme at the moment <body> is first inserted, i.e. before any paint.
  await page.addInitScript(() => {
    const record = () => { (window as unknown as { __firstTheme?: string }).__firstTheme = document.documentElement.dataset.theme; };
    if (document.body) { record(); return; }
    new MutationObserver((_, observer) => { if (document.body) { record(); observer.disconnect(); } }).observe(document, { childList: true, subtree: true });
  });

  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/settings");
  const group = page.getByRole("main").getByRole("radiogroup", { name: "Colour theme" });
  await expect(group.getByRole("radio", { name: "System" })).toHaveAttribute("aria-checked", "true");
  expect(await theme(page)).toEqual({ theme: "paper", preference: "system" });

  // System preference follows live OS changes.
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(async () => (await theme(page)).theme).toBe("ink");
  await page.emulateMedia({ colorScheme: "light" });
  await expect.poll(async () => (await theme(page)).theme).toBe("paper");

  // Explicit dark persists across reloads and is applied before first paint.
  await group.getByRole("radio", { name: "Dark" }).click();
  expect(await theme(page)).toEqual({ theme: "ink", preference: "dark" });
  await page.reload();
  expect(await page.evaluate(() => (window as unknown as { __firstTheme?: string }).__firstTheme)).toBe("ink");
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(background).toBe("rgb(14, 20, 32)");

  // Keyboard: one tab stop on the checked radio; arrows move selection.
  const dark = group.getByRole("radio", { name: "Dark" });
  await dark.focus();
  await page.keyboard.press("ArrowRight");
  await expect(group.getByRole("radio", { name: "System" })).toBeFocused();
  await expect(group.getByRole("radio", { name: "System" })).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Home");
  await expect(group.getByRole("radio", { name: "Light" })).toHaveAttribute("aria-checked", "true");
  expect((await theme(page)).theme).toBe("paper");
  await expect(group.getByRole("radio", { name: "Dark" })).toHaveAttribute("tabindex", "-1");

  // Header toggle shares the same preference.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("banner").getByRole("radio", { name: "Dark theme" }).click();
  expect((await theme(page)).theme).toBe("ink");
  await expect(group.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
});

test("workspace pages render in Paper and Ink without overflow; mobile has bottom navigation", async ({ page, context, app }) => {
  test.setTimeout(180_000);
  await app.signIn(context, "admin");
  for (const preference of ["light", "dark"] as const) {
    await context.addInitScript((p) => localStorage.setItem("peerly-theme", p), preference);
    for (const path of WORKSPACE) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(path);
      expect((await theme(page)).theme).toBe(preference === "dark" ? "ink" : "paper");
      await expect(page.getByRole("main")).toBeVisible();
      // Wait for streamed content, not the loading skeleton.
      await expect(page.locator("main h1").first()).toBeVisible();
      await page.screenshot({ path: `test-results/themes/${preference}${path.replaceAll("/", "_")}.png`, fullPage: true });
      for (const width of [320, 390, 768, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), { message: `${path} at ${width}px (${preference})` }).toBe(true);
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/peers");
  const bottom = page.getByRole("navigation", { name: "Workspace" });
  await expect(bottom).toBeVisible();
  await expect(bottom.locator('[aria-current="page"]')).toHaveText("Peers");
  await expect(bottom.getByRole("link", { name: "Peers" })).toHaveCount(0);
  await page.screenshot({ path: "test-results/themes/mobile_peers.png" });
  await bottom.getByRole("link", { name: "Resources" }).click();
  await expect(page).toHaveURL(/\/resources$/);
  await expect(bottom.locator('[aria-current="page"]')).toHaveText("Resources");
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(bottom).toBeHidden();
});

test("UI primitives: dialog traps focus and restores it, toasts are announced, reduced motion is honoured", async ({ page, context, app }) => {
  await app.signIn(context, "learner");
  await page.goto("/dev/ui");
  await expect(page.getByTestId("ui-showcase")).toBeVisible();

  const trigger = page.getByTestId("open-dialog");
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Accept this request?" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Accept" })).toBeFocused();
  // Tab wraps within the dialog in both directions.
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Close dialog" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Accept" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  await page.getByTestId("toast-success").click();
  await expect(page.getByRole("status", { name: "Notifications" })).toContainText("Request accepted");
  await page.getByTestId("toast-error").click();
  const errors = page.getByRole("alert", { name: "Errors" });
  await expect(errors).toContainText("Couldn’t accept");
  await errors.getByRole("button", { name: "Dismiss: Couldn’t accept" }).click();
  await expect(errors).not.toContainText("Couldn’t accept");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  const mark = page.locator(".highlight-mark").first();
  expect(await mark.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  expect(await mark.evaluate((el) => getComputedStyle(el).backgroundSize)).toBe("100% 100%");
  await page.screenshot({ path: "test-results/themes/dev-ui.png", fullPage: true });
});
