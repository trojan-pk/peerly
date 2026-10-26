import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";

const SECTIONS = ["how-it-works", "privacy", "resources", "questions"];

async function noOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
}

test("landing: sections, interactions and login entry in both themes", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Assignment due in three hours?");

  // Same-page navigation.
  const nav = page.getByRole("navigation", { name: "Main Navigation", exact: true });
  for (const hash of SECTIONS) {
    await expect(nav.locator(`a[href="/#${hash}"]`)).toHaveCount(1);
    await expect(page.locator(`#${hash}`)).toHaveCount(1);
  }
  await nav.getByRole("link", { name: "Privacy", exact: true }).click();
  await expect(page).toHaveURL(/\/#privacy$/);
  await expect(page.locator("#privacy")).toBeInViewport();

  // Hero signature sequence ends in the accepted/unlocked state and can replay.
  const scene = page.locator(".hero-scene");
  await expect(scene).toHaveAttribute("data-stage", "3");
  await expect(scene).toContainText("Contact unlocked");
  await expect(scene).toContainText("Illustrative example");
  await scene.getByRole("button", { name: "Replay the example" }).click();
  await expect(scene).not.toHaveAttribute("data-stage", "3");
  await expect(scene).toHaveAttribute("data-stage", "3");

  // Privacy reveal never contains a real-looking number before acceptance.
  const privacy = page.getByTestId("privacy-card");
  await expect(privacy).toContainText("Hidden from everyone");
  await expect(privacy).not.toContainText("+92");
  await page.getByRole("button", { name: "After they accept", exact: true }).click();
  await expect(privacy).toContainText("Visible to you only");
  await page.getByRole("button", { name: "Before they accept", exact: true }).click();
  await expect(privacy).toContainText("Hidden from everyone");

  // How it works: keyboard-selectable steps drive the sticky preview.
  const step3 = page.getByRole("button", { name: /^They accept/ });
  await step3.focus();
  await page.keyboard.press("Enter");
  await expect(step3).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#how-preview")).toHaveAttribute("data-active-step", "3");
  await expect(page.locator("#how-preview")).toContainText("Contact unlocked");

  // FAQ disclosures.
  const question = page.locator("summary", { hasText: "When are contact details shared?" });
  await question.click();
  await expect(question.locator("..")).toHaveAttribute("open", "");

  // No member data, no links into the private workspace, no infinite decorative loops.
  await expect(page.locator('main a[href="/peers"], main a[href="/resources"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.getAnimations().filter((a) => a.effect?.getTiming().iterations === Infinity).length)).toBe(0);

  for (const theme of ["light", "dark"] as const) {
    await page.evaluate((t) => localStorage.setItem("peerly-theme", t), theme);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme === "dark" ? "ink" : "paper");
    await page.screenshot({ path: testInfo.outputPath(`landing-${theme}.png`), fullPage: true });
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect.poll(() => noOverflow(page), { message: `${theme} ${width}px` }).toBe(true);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath("landing-mobile.png"), fullPage: true });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("link", { name: "Get help now" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in to Peerly" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => noOverflow(page)).toBe(true);
  }
  await page.screenshot({ path: testInfo.outputPath("login.png"), fullPage: true });
  expect(errors).toEqual([]);
});

test("landing: reduced motion shows the final state with no replay control", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const scene = page.locator(".hero-scene");
  await expect(scene).toHaveAttribute("data-stage", "3");
  await expect(scene.getByRole("button", { name: "Replay the example" })).toHaveCount(0);
  const mark = page.locator("h1 .highlight-mark");
  expect(await mark.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
});

test("landing: largest paint and layout stability stay within budget", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    const w = window as unknown as { __lcp: number; __cls: number; __shifts: string[] };
    w.__lcp = 0; w.__cls = 0; w.__shifts = [];
    new PerformanceObserver((list) => { for (const e of list.getEntries()) w.__lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => { for (const e of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean; sources?: Array<{ node?: Node; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }> }>) if (!e.hadRecentInput) { w.__cls += e.value; w.__shifts.push(`${Math.round(e.startTime)}ms ${e.value.toFixed(3)} ` + (e.sources ?? []).map((s) => `${(s.node as Element | undefined)?.className || s.node?.nodeName} ${Math.round(s.previousRect.y)}→${Math.round(s.currentRect.y)} h${Math.round(s.previousRect.height)}→${Math.round(s.currentRect.height)}`).join(" | ")); } }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForTimeout(4000); // let the hero sequence finish
  const { lcp, cls, shifts } = await page.evaluate(() => { const w = window as unknown as { __lcp: number; __cls: number; __shifts: string[] }; return { lcp: w.__lcp, cls: w.__cls, shifts: w.__shifts }; });
  console.log("Landing metrics", { lcp: Math.round(lcp), cls: Number(cls.toFixed(4)), shifts });
  expect(lcp).toBeGreaterThan(0);
  expect(lcp).toBeLessThan(2500);
  expect(cls).toBeLessThan(0.1);
});
