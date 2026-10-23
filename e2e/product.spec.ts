import { test, expect } from "./fixtures";

test("configured auth HTTP routes handle proxied requests and POST bodies", async ({ request }) => {
  const session = await request.get("/api/auth/session");
  expect(session.status()).toBe(200);
  expect(await session.json()).toBeNull();

  const providers = await request.get("/api/auth/providers");
  expect(providers.status()).toBe(200);
  expect((await providers.json()).google.id).toBe("google");

  const csrf = await request.get("/api/auth/csrf");
  expect(csrf.status()).toBe(200);
  const { csrfToken } = await csrf.json();
  expect(csrfToken).toEqual(expect.any(String));
  expect(csrfToken.length).toBeGreaterThan(20);
  const signOut = await request.post("/api/auth/signout", {
    form: { csrfToken, callbackUrl: "/login" },
    headers: { "X-Auth-Return-Redirect": "1" },
    maxRedirects: 0,
  });
  expect(signOut.status()).toBe(200);
  expect(new URL((await signOut.json()).url).pathname).toBe("/login");

  const canceled = await request.get("/api/auth/callback/google?error=access_denied", { maxRedirects: 0 });
  expect(canceled.status()).toBe(302);
  expect(new URL(canceled.headers().location).pathname).toBe("/login");
});

test("learner and helper complete a private request and publish one review", async ({ browser, app }, testInfo) => {
  const learner = await browser.newContext();
  const helper = await browser.newContext();
  await app.signIn(learner, "learner");
  await app.signIn(helper, "helper");
  const studentPage = await learner.newPage();
  const helperPage = await helper.newPage();
  try {
    await studentPage.goto("/profile");
    await studentPage.screenshot({ path: testInfo.outputPath("profile-dark.png"), fullPage: true });
    await studentPage.getByLabel("Short Bio", { exact: false }).count().then(async (count) => {
      if (count) await studentPage.getByLabel("Short Bio", { exact: false }).fill("I enjoy learning algorithms with classmates.");
      else await studentPage.locator("#bio").fill("I enjoy learning algorithms with classmates.");
    });
    await studentPage.getByRole("button", { name: /Save Profile/ }).click();
    await expect(studentPage.getByRole("status")).toContainText(/saved successfully/i);
    await studentPage.goto(`/peers/${app.ids.helper}`);
    await expect(studentPage.locator("main")).not.toContainText("+923001234567");
    await studentPage.locator("#problemDescription").fill("Please explain quicksort partitioning before my algorithms quiz.");
    await studentPage.getByRole("button", { name: /Send.*Request/ }).click();
    await expect(studentPage.getByRole("status")).toContainText(/sent successfully/i);
    await helperPage.goto("/dashboard?tab=incoming");
    await helperPage.getByRole("button", { name: "Accept Request", exact: true }).click();
    await expect(helperPage.getByRole("status")).toContainText(/accepted/i);
    await studentPage.goto("/dashboard?tab=outgoing");
    await expect(studentPage.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("href", "https://wa.me/923001234567");
    await studentPage.screenshot({ path: testInfo.outputPath("dashboard-dark.png"), fullPage: true });
    await studentPage.getByRole("button", { name: "Confirm Session Completed", exact: true }).click();
    await expect(studentPage.getByRole("status")).toContainText(/Waiting for the other participant/i);
    await helperPage.reload();
    await helperPage.getByRole("button", { name: "Confirm Session Completed", exact: true }).click();
    await expect(helperPage.getByRole("status")).toContainText(/Both participants have confirmed/i);
    await studentPage.reload();
    await studentPage.getByRole("button", { name: /Write.*Review|Leave.*Review/ }).click();
    await studentPage.getByRole("button", { name: /5 star/i }).click();
    await studentPage.locator('textarea[id^="review-comment-"]').fill("Clear explanations and helpful examples of partitioning.");
    await studentPage.getByRole("button", { name: "Submit Review", exact: true }).click();
    await expect(studentPage.getByRole("status")).toContainText(/published/i);
    await expect(studentPage.getByRole("button", { name: "Submit Review", exact: true })).toHaveCount(0);
    await studentPage.goto(`/peers/${app.ids.helper}`);
    await expect(studentPage.locator("main")).toContainText("Clear explanations and helpful examples");
    await expect(studentPage.locator("main")).not.toContainText("+923001234567");
  } finally { await learner.close(); await helper.close(); }
});

test("resources, modal keyboard focus and admin hide/restore/resolve work through the UI", async ({ browser, app }, testInfo) => {
  const owner = await browser.newContext();
  const reporter = await browser.newContext();
  const moderator = await browser.newContext();
  await app.signIn(owner, "helper"); await app.signIn(reporter, "learner"); await app.signIn(moderator, "admin");
  const ownerPage = await owner.newPage(); const reportPage = await reporter.newPage(); const adminPage = await moderator.newPage();
  try {
    await ownerPage.goto("/resources/manage");
    await ownerPage.getByRole("button", { name: "New Resource", exact: true }).click();
    await ownerPage.locator("#create-title").fill("Sorting revision notes");
    await ownerPage.locator("#create-topic").fill("C++ Sorting");
    await ownerPage.locator("#create-url").fill("https://example.com/sorting-notes");
    await ownerPage.locator("#create-desc").fill("My own revision notes about sorting algorithms and complexity.");
    await ownerPage.screenshot({ path: testInfo.outputPath("resource-form-dark.png"), fullPage: true });
    await ownerPage.getByRole("button", { name: "Publish Resource", exact: true }).click();
    await expect(ownerPage.getByRole("heading", { name: "Sorting revision notes", exact: true })).toBeVisible();
    await ownerPage.getByRole("button", { name: "Edit", exact: true }).click();
    await ownerPage.locator("#edit-desc").fill("Updated personal sorting notes with a worked quicksort example.");
    await ownerPage.getByRole("button", { name: "Save Changes", exact: true }).click();
    await expect(ownerPage.getByRole("status")).toContainText(/updated successfully/i);
    await expect(ownerPage.locator("#edit-desc")).toHaveCount(0);
    await expect(ownerPage.locator("main")).toContainText("Updated personal sorting notes");
    expect((await app.db.collection("resources").findOne({ title: "Sorting revision notes" }))?.description).toContain("Updated personal sorting notes");
    await reportPage.goto("/resources?q=Sorting");
    const trigger = reportPage.getByRole("button", { name: "Report study resource" }).first();
    await trigger.click();
    const dialog = reportPage.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await reportPage.keyboard.press("Shift+Tab");
    await expect.poll(() => dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    await reportPage.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await reportPage.locator("#report-reason").selectOption("broken_link");
    await reportPage.locator("#report-explanation").fill("Please review this resource link for our class.");
    await dialog.getByRole("button", { name: "Submit Report", exact: true }).click();
    await expect(dialog).toContainText(/submitted/i);
    await reportPage.keyboard.press("Escape");
    await adminPage.goto("/admin/reports?status=OPEN");
    await expect(adminPage.locator("main")).toContainText("Sorting revision notes");
    await adminPage.screenshot({ path: testInfo.outputPath("admin-dark.png"), fullPage: true });
    await adminPage.getByRole("button", { name: /Hide.*Public/ }).click();
    await adminPage.getByRole("dialog").getByRole("button", { name: /Hide from Public/ }).click();
    await expect(adminPage.getByRole("status")).toContainText(/hidden/i);
    await reportPage.goto("/resources?q=Sorting");
    await expect(reportPage.getByRole("heading", { name: "Sorting revision notes", exact: true })).toHaveCount(0);
    await ownerPage.reload();
    await expect(ownerPage.locator("main")).toContainText("Hidden from Public View");
    await adminPage.getByRole("button", { name: /Restore.*Public/ }).click();
    await adminPage.getByRole("dialog").getByRole("button", { name: /Restore Visibility/ }).click();
    await expect(adminPage.getByRole("status")).toContainText(/restored/i);
    await adminPage.getByRole("button", { name: "Resolve Report", exact: true }).click();
    await adminPage.getByRole("dialog").getByRole("button", { name: "Confirm Resolution", exact: true }).click();
    await expect(adminPage.getByRole("heading", { name: "Sorting revision notes", exact: true })).toHaveCount(0);
    await adminPage.getByRole("link", { name: /Resolved/ }).click();
    await expect(adminPage.getByRole("heading", { name: "Sorting revision notes", exact: true })).toBeVisible();
    for (const width of [375, 768, 1024, 1280]) {
      await adminPage.setViewportSize({ width, height: 900 });
      expect(await adminPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    await ownerPage.getByRole("button", { name: "Delete", exact: true }).click();
    await ownerPage.getByRole("alertdialog").getByRole("button", { name: "Yes, Delete Resource", exact: true }).click();
    await expect(ownerPage.getByRole("heading", { name: "Sorting revision notes", exact: true })).toHaveCount(0);
  } finally { await owner.close(); await reporter.close(); await moderator.close(); }
});

test("public mobile routes stay usable and signed-out visitors cannot open private areas", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 375, height: 812 });
  for (const route of ["/", "/peers", "/resources", "/login", "/dashboard", "/profile", "/resources/manage", "/admin/reports"]) {
    const response = await page.goto(route);
    expect(response?.status()).toBeLessThan(400);
    if (!["/", "/login"].includes(route)) await expect(page).toHaveURL(/\/login/);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth).catch(() => false)).toBe(true);
  }
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation menu" }).click();
  await expect(page.getByRole("navigation", { name: "Mobile Navigation" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("one-page landing keeps sections together and gates the workspace behind login", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main Navigation", exact: true });
  for (const [label, hash] of [["Features", "features"], ["How it works", "how-it-works"], ["Resources", "resources"]]) {
    await expect(nav.getByRole("link", { name: label, exact: true })).toHaveAttribute("href", `/#${hash}`);
  }
  await nav.getByRole("link", { name: "Resources", exact: true }).click();
  await expect(page).toHaveURL(/\/#resources$/);
  await expect(page.locator("#resources")).toBeVisible();
  await page.locator(".deck-switcher").getByRole("button", { name: "Practice", exact: true }).click();
  await expect(page.locator(".deck-practice")).toHaveClass(/is-front/);
  await page.getByRole("tab", { name: "Mathematics", exact: true }).click();
  await expect(page.locator("#subject-panel")).toContainText("Linear algebra");
  const connect = page.getByRole("tab", { name: /03 Connect on your terms/ });
  await connect.click();
  await expect(page.locator("#workflow-panel")).toContainText("Contact unlocks privately");
  await connect.press("ArrowDown");
  await expect(page.getByRole("tab", { name: /04 Learn/ })).toBeFocused();
  await expect(page.locator("#workflow-panel")).toContainText("Feedback opens after both confirmations");
  const question = page.locator("summary", { hasText: "When are contact details shared?" });
  await question.click();
  await expect(question.locator("..")).toHaveAttribute("open", "");
  await page.getByRole("button", { name: "Pause animations", exact: true }).click();
  await expect(page.locator(".landing-v2")).toHaveAttribute("data-motion", "paused");
  expect(await page.locator(".aurora-field > i").first().evaluate(el => getComputedStyle(el).animationPlayState)).toBe("paused");
  await expect(page.locator('main a[href="/peers"], main a[href="/resources"]')).toHaveCount(0);
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  expect(await page.locator(".aurora-field > i").first().evaluate(el => getComputedStyle(el).animationName)).toBe("none");
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole("link", { name: "Find your study circle", exact: true }).first().click();
  await expect(page).toHaveURL(/\/login$/);
});
