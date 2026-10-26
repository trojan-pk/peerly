import { test, expect } from "./fixtures";
import { ObjectId } from "mongodb";

test("direct account settings persist a name and initials and request history supports filtering, cancellation and personal archiving", async ({ browser, app }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await app.signIn(context, "learner");
  const page = await context.newPage();
  const existingRequests = await app.db.collection("studyrequests").countDocuments({ learner: new ObjectId(app.ids.learner) });
  // Existing photo records must not override initials or trigger image requests.
  const legacyPhotoUrl = `/api/avatars/${app.ids.helper}`;
  await app.db.collection("users").updateOne({ _id: new ObjectId(app.ids.helper) }, { $set: { image: legacyPhotoUrl } });
  const photoRequests: string[] = [];
  page.on("request", request => { if (request.url().includes("/api/avatars/")) photoRequests.push(request.url()); });
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
    await expect(page.locator(".request-card .initials-avatar")).toHaveText(Array(existingRequests + requests.length).fill("HH"));
    await expect(page.locator(".request-card img")).toHaveCount(0);
    expect(photoRequests).toEqual([]);
    expect((await context.request.get(legacyPhotoUrl)).status()).toBe(404);
    await page.screenshot({ path: testInfo.outputPath("dashboard-after.png"), fullPage: true });
    await expect(page.getByRole("link", { name: "Open account settings", exact: true })).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toHaveCount(0);
    await expect(page.locator("header img")).toHaveCount(0);
    await page.getByRole("link", { name: "Open account settings", exact: true }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.locator("footer.site-footer")).toHaveCount(0);
    await page.locator("#name:visible").fill("Laila Updated");
    await page.getByRole("button", { name: /Save Profile/ }).click();
    await expect(page.getByRole("main").getByRole("status")).toContainText(/saved successfully/i);
    const avatar = page.getByRole("img", { name: "Laila Updated avatar", exact: true });
    await expect(avatar).toHaveText("LU");
    await page.reload();
    await expect(page.locator("#name:visible")).toHaveValue("Laila Updated");
    await expect(avatar).toHaveText("LU");
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
    await expect(page.locator('a[href="/settings"]')).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Your account activity" })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("settings-after.png"), fullPage: true });
    // The logo remains the route home after removing the redundant Dashboard label.
    await page.getByRole("link", { name: "Peerly dashboard", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/dashboard?tab=outgoing");
    await page.getByRole("combobox", { name: "Request status", exact: true }).selectOption("REJECTED");
    await expect(page.locator(".request-card")).toHaveCount(1);
    await page.getByRole("button", { name: "Archive request", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Declined calculus question", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Archived", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Declined calculus question", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Restore request", exact: true }).click();
    await page.getByRole("button", { name: "Current", exact: true }).click();
    await expect(page.getByRole("button", { name: "Current", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("heading", { name: "Declined calculus question", exact: true })).toBeVisible();
    await page.getByRole("combobox", { name: "Request status", exact: true }).selectOption("PENDING");
    await page.getByRole("button", { name: "Cancel Request", exact: true }).click();
    await expect(page.getByRole("main").getByRole("status")).toContainText(/cancelled/i);
    await page.getByRole("combobox", { name: "Request status", exact: true }).selectOption("CANCELLED");
    await expect(page.getByRole("heading", { name: "Pending calculus question", exact: true })).toBeVisible();
    expect(await app.db.collection("studyrequests").countDocuments({ learner: new ObjectId(app.ids.learner) })).toBe(existingRequests + requests.length);

    await page.goto("/resources/manage");
    await page.getByRole("button", { name: "New Resource", exact: true }).click();
    await page.locator("#create-title:visible").focus();
    await page.screenshot({ path: testInfo.outputPath("resources-focus-after.png"), fullPage: true });
    console.log("Resource focus boundary", await page.locator("#create-title:visible").evaluate(el => ({ outlineOffset: getComputedStyle(el).outlineOffset, boxShadow: getComputedStyle(el).boxShadow })));
    for (const width of [320,390,768,1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await expect(page.getByRole("button", { name: /Pause animations|Resume animations/ })).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Open account settings", exact: true }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(avatar).toHaveText("LU");
    await expect(page.locator('a[href="/settings"]')).toHaveCount(0);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: testInfo.outputPath("settings-mobile.png"), fullPage: true });
  } finally { await context.close(); }
});
