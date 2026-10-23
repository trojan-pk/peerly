import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:3101",
    headless: true,
    launchOptions: process.env.PEERLY_CHROME_PATH
      ? { executablePath: process.env.PEERLY_CHROME_PATH }
      : { channel: "chrome" },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
