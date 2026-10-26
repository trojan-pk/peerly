import { ObjectId } from "mongodb";
import { test, expect } from "./fixtures";

test("participants schedule a session, download the calendar file and share one video link", async ({ browser, app }, testInfo) => {
  const topic = `Scheduling ${Date.now().toString(36)}`;
  const now = new Date();
  const { insertedId } = await app.db.collection("studyrequests").insertOne({
    learner: new ObjectId(app.ids.learner), peer: new ObjectId(app.ids.helper), topic, normalizedTopic: topic.toLowerCase(),
    problemDescription: "Can we go through the recursion homework together?", mode: "online", status: "ACCEPTED", urgency: "normal", priority: 0,
    respondedAt: now, createdAt: now, updatedAt: now,
  });
  const learnerCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const helperCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await app.signIn(learnerCtx, "learner");
  await app.signIn(helperCtx, "helper");
  const learner = await learnerCtx.newPage();
  const helper = await helperCtx.newPage();
  try {
    await learner.goto("/dashboard?tab=outgoing");
    const card = learner.getByRole("article", { name: topic });
    await card.getByRole("button", { name: "Suggest times" }).click();
    const slot = await learner.evaluate(() => {
      const d = new Date(Date.now() + 26 * 3600_000); d.setMinutes(0, 0, 0);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
    });
    await card.getByLabel("Option 1").fill(slot);
    await card.getByRole("button", { name: "Send times" }).click();
    await expect(learner.getByRole("status", { name: "Notifications" })).toContainText("Times sent");
    await expect(card).toContainText("Waiting for Hamza to pick");

    await helper.goto("/dashboard?tab=incoming");
    const helperCard = helper.getByRole("article", { name: topic });
    await expect(helperCard).toContainText("Laila suggested these times");
    await helperCard.getByRole("button", { name: /\d{1,2}:00/ }).click();
    await expect(helper.getByRole("status", { name: "Notifications" })).toContainText("Session scheduled");
    await expect(helperCard).toContainText("Scheduled:");

    // Video link: created once, the same for both people.
    await helperCard.getByRole("button", { name: "Create video call link" }).click();
    await expect(helperCard.getByRole("link", { name: "Join video call" })).toHaveAttribute("href", /^https:\/\/meet\.jit\.si\/peerly-[a-f0-9]{32}$/);
    const helperUrl = await helperCard.getByRole("link", { name: "Join video call" }).getAttribute("href");
    await learner.reload();
    await expect(learner.getByRole("article", { name: topic }).getByRole("link", { name: "Join video call" })).toHaveAttribute("href", helperUrl!);
    await helper.screenshot({ path: testInfo.outputPath("scheduled-card.png"), fullPage: true });

    // Calendar file for participants only.
    const download = await learnerCtx.request.get(`/api/requests/${insertedId}/ics`);
    expect(download.status()).toBe(200);
    expect(download.headers()["content-type"]).toContain("text/calendar");
    const ics = (await download.text()).replace(/\r\n /g, "");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain(helperUrl!);
    expect(ics).not.toContain("+923001234567");
    const adminCtx = await browser.newContext();
    await app.signIn(adminCtx, "admin");
    expect((await adminCtx.request.get(`/api/requests/${insertedId}/ics`)).status()).toBe(404);
    await adminCtx.close();
    expect((await browser.newContext().then((c) => c.request.get(`/api/requests/${insertedId}/ics`))).status()).toBe(401);
  } finally {
    await learnerCtx.close(); await helperCtx.close();
  }
});

test("members mark resources helpful and sort by most helpful", async ({ page, context, app }) => {
  const suffix = Date.now().toString(36);
  const now = new Date();
  await app.db.collection("resources").insertMany([
    { owner: new ObjectId(app.ids.helper), title: `Voted notes ${suffix}`, description: "Recursion stack diagrams and traces.", topic: "Recursion", normalizedTopic: "recursion", url: "https://example.org/voted", upvoteCount: 0, createdAt: new Date(now.getTime() - 60_000), updatedAt: now },
    { owner: new ObjectId(app.ids.helper), title: `Fresh notes ${suffix}`, description: "Newest upload without votes yet.", topic: "Recursion", normalizedTopic: "recursion", url: "https://example.org/fresh", upvoteCount: 0, createdAt: now, updatedAt: now },
  ]);
  await app.signIn(context, "learner");
  await page.goto(`/resources?q=${suffix}`);
  const voted = page.getByRole("article").filter({ hasText: `Voted notes ${suffix}` });
  const button = voted.getByRole("button", { name: /as helpful/ });
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(button).toContainText("1");
  await expect.poll(async () => (await app.db.collection("resources").findOne({ title: `Voted notes ${suffix}` }))?.upvoteCount).toBe(1);
  await page.getByRole("group", { name: "Sort resources" }).getByRole("button", { name: "Most helpful" }).click();
  await expect(page).toHaveURL(/sort=helpful/);
  await expect(page.getByRole("article").first()).toContainText(`Voted notes ${suffix}`);
  await page.reload();
  await expect(page.getByRole("article").filter({ hasText: `Voted notes ${suffix}` }).getByRole("button", { name: /as helpful/ })).toHaveAttribute("aria-pressed", "true");
  await app.db.collection("resources").deleteMany({ title: { $in: [`Voted notes ${suffix}`, `Fresh notes ${suffix}`] } });
});

test("public helper page is opt-in, public, and shows no contact details", async ({ browser, page, context, app }, testInfo) => {
  await app.signIn(context, "helper");
  await page.goto("/settings");
  const toggle = page.getByRole("switch", { name: "Public helper page" });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(page.getByRole("status", { name: "Notifications" })).toContainText("public page is live");
  const url = await page.getByTestId("public-page-url").textContent();
  const path = new URL(url!).pathname;
  expect(path).toMatch(/^\/h\/hamza-helper-[a-f0-9]{6}$/);

  const visitor = await browser.newContext();
  const publicPage = await visitor.newPage();
  const res = await publicPage.goto(path);
  expect(res?.status()).toBe(200);
  await expect(publicPage.getByRole("heading", { level: 1, name: "Hamza Helper" })).toBeVisible();
  await expect(publicPage.getByRole("main")).toContainText("Completed sessions");
  await expect(publicPage.getByRole("main")).not.toContainText("+923001234567");
  await expect(publicPage.getByRole("main")).not.toContainText("helper@peerly.example");
  await expect(publicPage.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  const og = await publicPage.locator('meta[property="og:image"]').getAttribute("content");
  expect(og).toBeTruthy();
  const image = await visitor.request.get(new URL(og!).pathname + new URL(og!).search);
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/png");
  await publicPage.screenshot({ path: testInfo.outputPath("public-helper.png"), fullPage: true });

  await toggle.click();
  await expect(page.getByRole("status", { name: "Notifications" })).toContainText("now hidden");
  expect((await publicPage.goto(path))?.status()).toBe(404);
  await visitor.close();
});
