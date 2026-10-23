import { test, expect } from "./fixtures";
import { ObjectId } from "mongodb";
import sharp from "sharp";

test("account settings persist a name/photo and request history supports filtering, cancellation and personal archiving", async ({ browser, app, request }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await app.signIn(context, "learner");
  const page = await context.newPage();
  const now = new Date();
  const requests = [
    { status: "PENDING", topic: "Pending calculus question" },
    { status: "REJECTED", topic: "Declined calculus question" },
    { status: "ACCEPTED", topic: "Accepted calculus question" },
  ];
  await app.db.collection("studyrequests").insertMany(requests.map(item => ({ ...item, learner: new ObjectId(app.ids.learner), peer: new ObjectId(app.ids.helper), normalizedTopic: item.topic.toLowerCase(), problemDescription: "Could we work through a calculus example together?", mode: "online", createdAt: now, updatedAt: now, respondedAt: item.status !== "PENDING" ? now : null })));
  try {
    await page.goto("/dashboard?tab=outgoing");
    await expect(page.locator("main")).not.toContainText("Signed in as");
    await expect(page.locator("main")).not.toContainText("learner@peerly.example");
    await expect(page.locator("main")).not.toContainText("Role:");
    await page.screenshot({ path: testInfo.outputPath("dashboard-after.png"), fullPage: true });
    await page.getByRole("button", { name: "Open account settings", exact: true }).click();
    await page.getByRole("navigation", { name: "Account settings", exact: true }).getByRole("link", { name: "Profile & settings", exact: true }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.locator("footer.site-footer")).toHaveCount(0);
    await page.locator("#name").fill("Laila Updated");
    await page.getByRole("button", { name: /Save Profile/ }).click();
    await expect(page.getByRole("status")).toContainText(/saved successfully/i);
    await page.getByRole("button", { name: "Open account settings", exact: true }).click();
    await expect(page.locator(".account-panel-heading")).toContainText("Laila Updated");
    await page.keyboard.press("Escape");
    const photo = await sharp({ create: { width: 500, height: 350, channels: 3, background: "#6654f0" } }).png().toBuffer();
    await page.getByLabel("Upload profile photo").setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: photo });
    await expect(page.getByRole("status").filter({ hasText: "Profile photo updated" })).toBeVisible();
    const avatar = page.getByRole("img", { name: "Laila Updated profile photo", exact: true });
    await expect(avatar).toHaveAttribute("src", /\/api\/avatars\//);
    const photoUrl = (await avatar.getAttribute("src"))!;
    const imageResponse = await context.request.get(photoUrl);
    expect(imageResponse.status()).toBe(200);
    expect((await sharp(await imageResponse.body()).metadata()).width).toBe(256);
    expect((await request.get(photoUrl)).status()).toBe(401);
    await page.locator("h1").click();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({ path: testInfo.outputPath("settings-after.png"), fullPage: true });
    await page.getByRole("button", { name: "Remove photo", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Profile photo removed" })).toBeVisible();
    await expect(avatar).toHaveCount(0);
    expect((await context.request.get(photoUrl)).status()).toBe(404);

    await page.goto("/dashboard?tab=outgoing");
    await page.getByRole("combobox", { name: "Request status", exact: true }).selectOption("REJECTED");
    await expect(page.locator(".request-card")).toHaveCount(1);
    await page.getByRole("button", { name: "Archive request", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Declined calculus question", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Archived", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Declined calculus question", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Restore request", exact: true }).click();
    await page.getByRole("button", { name: "Current", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Declined calculus question", exact: true })).toBeVisible();
    await page.getByRole("combobox", { name: "Request status", exact: true }).selectOption("PENDING");
    await page.getByRole("button", { name: "Cancel Request", exact: true }).click();
    await expect(page.getByRole("status")).toContainText(/cancelled/i);
    await page.getByRole("combobox", { name: "Request status", exact: true }).selectOption("CANCELLED");
    await expect(page.getByRole("heading", { name: "Pending calculus question", exact: true })).toBeVisible();
    expect(await app.db.collection("studyrequests").countDocuments({ learner: new ObjectId(app.ids.learner) })).toBe(3);

    await page.goto("/resources/manage");
    await page.getByRole("button", { name: "New Resource", exact: true }).click();
    await page.locator("#create-title").focus();
    await page.screenshot({ path: testInfo.outputPath("resources-focus-after.png"), fullPage: true });
    console.log("Resource focus boundary", await page.locator("#create-title").evaluate(el => ({ outlineOffset: getComputedStyle(el).outlineOffset, boxShadow: getComputedStyle(el).boxShadow })));
    for (const width of [320,390,768,1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await expect(page.getByRole("button", { name: /Pause animations|Resume animations/ })).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Open account settings", exact: true }).click();
    await expect(page.getByRole("navigation", { name: "Account settings", exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("account-menu-mobile.png") });
  } finally { await context.close(); }
});
