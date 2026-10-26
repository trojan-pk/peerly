import { ObjectId } from "mongodb";
import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";

async function bell(page: Page) {
  return page.getByRole("banner").getByRole("link", { name: /^Notifications,/ });
}
async function unread(page: Page): Promise<number> {
  return Number(await (await bell(page)).getAttribute("data-unread"));
}
/** Simulates returning to the tab, which triggers an immediate poll (instead of waiting 60s). */
async function returnToTab(page: Page) {
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
}

test("urgent request with a deadline reaches the helper's bell, inbox and top of the dashboard", async ({ browser, app }, testInfo) => {
  const suffix = Date.now().toString(36);
  const topic = `Pointer arithmetic ${suffix}`;
  const learnerContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const helperContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await app.signIn(learnerContext, "learner");
  await app.signIn(helperContext, "helper");
  const learner = await learnerContext.newPage();
  const helper = await helperContext.newPage();
  try {
    await helper.goto("/dashboard?tab=incoming");
    const helperBefore = await unread(helper);

    await learner.goto(`/peers/${app.ids.helper}`);
    await learner.locator("#request-topic").fill(topic);
    await learner.getByRole("radio", { name: /^Urgent/ }).check();
    const deadline = await learner.evaluate(() => {
      const d = new Date(Date.now() + 3 * 60 * 60 * 1000);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    });
    await learner.getByLabel(/Needed by/).fill(deadline);
    await learner.locator("#problemDescription").fill("My pointer loop segfaults on the last element. Assignment due tonight.");
    await learner.getByRole("button", { name: /Send.*Request/ }).click();
    await expect(learner.getByRole("main").getByRole("status")).toContainText(/sent successfully/i);

    // The helper's bell updates without a manual reload, and the dashboard refreshes itself.
    await returnToTab(helper);
    await expect.poll(() => unread(helper)).toBe(helperBefore + 1);
    await expect(await bell(helper)).toHaveAttribute("aria-label", `Notifications, ${helperBefore + 1} unread`);
    const card = helper.locator(".request-card").first();
    await expect(card.getByRole("heading", { name: topic })).toBeVisible();
    await expect(card.getByText("Urgent", { exact: true })).toBeVisible();
    await expect(card.locator(".countdown")).toContainText(/^\s*2h 5\dm|3h 0m/);
    await expect(card).toContainText("Needed by");
    await helper.screenshot({ path: testInfo.outputPath("helper-urgent-dashboard.png"), fullPage: true });

    // Inbox: notification text, then click through to the request.
    await (await bell(helper)).click();
    await expect(helper).toHaveURL(/\/notifications$/);
    const item = helper.getByRole("button", { name: new RegExp(`Urgent request: ${topic}`) });
    await expect(item).toBeVisible();
    await expect(helper.getByRole("main")).not.toContainText("segfaults");
    await helper.screenshot({ path: testInfo.outputPath("helper-notifications.png"), fullPage: true });
    await item.click();
    await expect(helper).toHaveURL(/\/dashboard\?tab=incoming#request-[a-f0-9]{24}$/);
    await expect.poll(() => unread(helper)).toBe(helperBefore);

    // Helper accepts; the learner is notified.
    const learnerBefore = await (async () => { await learner.goto("/dashboard?tab=outgoing"); return unread(learner); })();
    await helper.locator(".request-card").filter({ hasText: topic }).getByRole("button", { name: "Accept Request" }).click();
    await expect(helper.getByRole("main").getByRole("status")).toContainText(/accepted/i);
    await returnToTab(learner);
    await expect.poll(() => unread(learner)).toBe(learnerBefore + 1);
    await learner.goto("/notifications");
    await expect(learner.getByRole("button", { name: new RegExp(`Accepted: ${topic}`) })).toBeVisible();
  } finally {
    await learnerContext.close();
    await helperContext.close();
  }
});

test("an overdue request expires: the helper cannot accept it and the learner is offered another helper", async ({ browser, app }) => {
  const topic = `Dynamic programming ${Date.now().toString(36)}`;
  const learnerContext = await browser.newContext();
  const helperContext = await browser.newContext();
  await app.signIn(learnerContext, "learner");
  await app.signIn(helperContext, "helper");
  const learner = await learnerContext.newPage();
  const helper = await helperContext.newPage();
  try {
    await learner.goto(`/peers/${app.ids.helper}`);
    await learner.locator("#request-topic").fill(topic);
    await learner.locator("#problemDescription").fill("How do I pick the state for the knapsack recurrence?");
    await learner.getByRole("button", { name: /Send.*Request/ }).click();
    await expect(learner.getByRole("main").getByRole("status")).toContainText(/sent successfully/i);

    // Test-only clock change in the temporary database; the app has no bypass.
    await app.db.collection("studyrequests").updateOne({ topic, learner: new ObjectId(app.ids.learner) }, { $set: { expiresAt: new Date(Date.now() - 60_000) } });

    await helper.goto("/dashboard?tab=incoming&status=EXPIRED");
    const helperCard = helper.locator(".request-card").filter({ hasText: topic });
    await expect(helperCard).toHaveAttribute("data-status", "EXPIRED");
    await expect(helperCard.getByRole("button", { name: "Accept Request" })).toHaveCount(0);
    await expect(helperCard).toContainText("no longer counts toward your response time");

    await learner.goto("/dashboard?tab=outgoing&status=EXPIRED");
    const learnerCard = learner.locator(".request-card").filter({ hasText: topic });
    await expect(learnerCard.getByText("Expired", { exact: true })).toBeVisible();
    await expect(learnerCard.getByRole("link", { name: "Try another helper" })).toHaveAttribute("href", `/peers?topic=${encodeURIComponent(topic)}`);
    await learner.goto("/notifications");
    await expect(learner.getByRole("button", { name: new RegExp(`No response in time: ${topic}`) })).toBeVisible();
  } finally {
    await learnerContext.close();
    await helperContext.close();
  }
});

test("email alert preference persists from settings", async ({ page, context, app }) => {
  await app.signIn(context, "learner");
  await page.goto("/settings");
  const toggle = page.getByRole("switch", { name: "Email me about requests" });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("main")).toContainText("isn’t set up on this Peerly server");
  await toggle.click();
  await expect(page.getByRole("status", { name: "Notifications" })).toContainText("Email alerts turned off");
  await page.reload();
  await expect(page.getByRole("switch", { name: "Email me about requests" })).toHaveAttribute("aria-checked", "false");
  await page.getByRole("switch", { name: "Email me about requests" }).click();
  await expect(page.getByRole("status", { name: "Notifications" })).toContainText("Email alerts turned on");
});
