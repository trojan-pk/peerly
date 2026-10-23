import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";

const origin = "http://127.0.0.1:3102";
let server: ChildProcess;
test.beforeAll(async () => {
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", "3102"], {
    env: { ...process.env, NODE_ENV: "production", AUTH_URL: origin,
      AUTH_SECRET: "", NEXTAUTH_SECRET: "", AUTH_GOOGLE_ID: "", AUTH_GOOGLE_SECRET: "", MONGODB_URI: "", ADMIN_EMAILS: "" },
    stdio: "ignore",
  });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error("Unconfigured test server exited before becoming ready.");
    try { if ((await fetch(`${origin}/login`)).ok) return; } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Unconfigured test server did not become ready.");
});
test.afterAll(async () => {
  if (!server) return;
  server.kill("SIGTERM");
  await Promise.race([once(server, "exit"), new Promise((resolve) => setTimeout(resolve, 5000))]);
  if (server.exitCode === null) server.kill("SIGKILL");
});

test("missing credentials fail closed while public and mobile pages remain usable", async ({ page, request }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/login`);
  await expect(page.getByRole("button", { name: "Google Sign-In Unavailable" })).toBeDisabled();
  expect((await request.get(`${origin}/api/auth/session`)).status()).toBe(503);
  expect((await request.post(`${origin}/api/auth/signin/google`)).status()).toBe(503);
  await page.goto(`${origin}/peers`);
  await expect(page.getByRole("heading", { name: "Directory Setup Required" })).toBeVisible();
  await expect(page.locator("main")).not.toContainText("No registered peer helpers yet");
  const missing = await page.goto(`${origin}/peers/not-an-id`);
  // Next.js streamed not-found pages retain HTTP 200 and inject noindex.
  expect([200, 404]).toContain(missing?.status());
  await expect(page.getByRole("heading", { name: "We couldn't find that page" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", "noindex");
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    await page.goto(origin);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.screenshot({ path: "/tmp/peerly-home-desktop.png", fullPage: true });
  expect(errors).toEqual([]);
});
