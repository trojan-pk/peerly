import { ObjectId } from "mongodb";
import { test, expect } from "./fixtures";

async function seedPending(app: { db: import("mongodb").Db; ids: Record<string, string> }, topic: string, urgency = "normal") {
  const now = new Date();
  await app.db.collection("studyrequests").insertOne({
    learner: new ObjectId(app.ids.learner), peer: new ObjectId(app.ids.helper), topic, normalizedTopic: topic.toLowerCase(),
    problemDescription: "Could you walk me through this before tonight's deadline?", mode: "online", status: "PENDING",
    urgency, priority: urgency === "urgent" ? 2 : 1, expiresAt: new Date(now.getTime() + 3 * 3600_000), createdAt: now, updatedAt: now,
  });
}

test("dashboard groups requests, accepts with the keyboard and rolls back a failed optimistic update", async ({ page, context, app }, testInfo) => {
  const suffix = Date.now().toString(36);
  const keyboardTopic = `Keyboard topic ${suffix}`;
  const rollbackTopic = `Rollback topic ${suffix}`;
  await seedPending(app, keyboardTopic, "urgent");
  await seedPending(app, rollbackTopic);
  await app.signIn(context, "helper");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dashboard?tab=incoming");

  const respond = page.getByRole("region", { name: /^Needs your response/ });
  await expect(respond.getByRole("article", { name: keyboardTopic })).toBeVisible();
  await expect(respond.getByRole("article", { name: rollbackTopic })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("dashboard-sections.png"), fullPage: true });

  // Optimistic update shows immediately; a failed server call restores the card and explains why.
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/dashboard**", async (route) => {
    if (route.request().method() === "POST") { await held; await route.abort("failed"); } else await route.continue();
  });
  const rollbackCard = page.getByRole("article", { name: rollbackTopic });
  await rollbackCard.getByRole("button", { name: "Accept Request" }).click();
  await expect(rollbackCard).toHaveAttribute("data-status", "ACCEPTED");
  await expect(rollbackCard.getByText("Accepted", { exact: true })).toBeVisible();
  release();
  await expect(page.getByRole("alert", { name: "Errors" })).toContainText("couldn't reach the server");
  await expect(rollbackCard).toHaveAttribute("data-status", "PENDING");
  await expect(rollbackCard.getByRole("button", { name: "Accept Request" })).toBeVisible();
  await page.unroute("**/dashboard**");
  const stored = await app.db.collection("studyrequests").findOne({ topic: rollbackTopic });
  expect(stored?.status).toBe("PENDING");

  // Keyboard: focus the card and press A.
  const card = page.getByRole("article", { name: keyboardTopic });
  await expect(card).toHaveAttribute("aria-keyshortcuts", "A R");
  await card.focus();
  await page.keyboard.press("a");
  await expect(page.getByRole("status", { name: "Notifications" })).toContainText(/accepted/i);
  await expect(page.getByRole("region", { name: /^Active sessions/ }).getByRole("article", { name: keyboardTopic })).toBeVisible();
  await expect.poll(async () => (await app.db.collection("studyrequests").findOne({ topic: keyboardTopic }))?.status).toBe("ACCEPTED");
});

test("command palette searches with the keyboard and the shortcut help opens with ?", async ({ page, context, app }, testInfo) => {
  const topic = `Palette graphs ${Date.now().toString(36)}`;
  await seedPending(app, topic);
  await app.signIn(context, "learner");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/settings");
  await expect(page.locator("main h1")).toBeVisible();

  const dialog = page.getByRole("dialog", { name: "Search Peerly" });
  // The shortcut listener attaches on hydration; retry until it is live.
  await expect(async () => {
    await page.keyboard.press("Control+k");
    await expect(dialog).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  const input = dialog.getByRole("combobox", { name: /Search pages/ });
  await expect(input).toBeFocused();
  await input.fill("palette gr");
  const option = dialog.getByRole("option", { name: new RegExp(topic) });
  await expect(option).toBeVisible();
  await expect(option).toHaveAttribute("aria-selected", "true");
  await expect(input).toHaveAttribute("aria-activedescendant", (await option.getAttribute("id"))!);
  await expect(dialog).not.toContainText("+923001234567");
  await page.screenshot({ path: testInfo.outputPath("palette.png") });
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/dashboard\?tab=outgoing#request-[a-f0-9]{24}$/);
  await expect(dialog).toBeHidden();

  // Pages are searchable without a server round-trip; arrow keys move the selection.
  await page.keyboard.press("Control+k");
  await input.fill("res");
  await expect(dialog.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowDown");
  await expect(dialog.getByRole("option").nth(1)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // Header trigger and shortcut help.
  await page.getByRole("banner").getByRole("button", { name: "Search Peerly" }).first().click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await page.locator("body").press("?");
  const help = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect(help).toBeVisible();
  await expect(help).toContainText("Accept the focused request");
  await page.keyboard.press("Escape");
  await expect(help).toBeHidden();
  // Typing "?" in a field must not open help.
  await page.goto("/peers");
  await page.locator("#peer-search-input:visible").pressSequentially("why?");
  await expect(page.locator("#peer-search-input:visible")).toHaveValue("why?");
  await expect(help).toBeHidden();
});
