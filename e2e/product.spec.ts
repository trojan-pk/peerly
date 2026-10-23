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
  await expect(page.locator(".resource-sample")).toContainText("Binary tree traversal exercises");
  await expect(page.locator(".resource-sample")).toHaveCount(1);
  await page.getByRole("button", { name: "After acceptance", exact: true }).click();
  await expect(page.locator(".contact-boundary")).toContainText("Contact unlocks privately");
  await page.getByRole("button", { name: "Before acceptance", exact: true }).click();
  await expect(page.locator(".contact-boundary")).toContainText("Contact stays private");
  await page.getByRole("button", { name: "On campus", exact: true }).click();
  await expect(page.locator(".mode-description")).toContainText("public campus space");
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
  const feature = page.locator(".m-feature").first();
  await feature.scrollIntoViewIfNeeded();
  const icon = feature.locator(".m-feature-icon");
  await page.mouse.move(5, 100);
  const relativePosition = () => icon.evaluate(el => {
    const iconBox = el.getBoundingClientRect();
    const cardBox = el.closest(".m-feature")!.getBoundingClientRect();
    return { x: iconBox.x - cardBox.x, y: iconBox.y - cardBox.y };
  });
  const before = await relativePosition();
  await feature.hover({ position: { x: 45, y: 45 } });
  await expect(feature).toHaveAttribute("data-pointer", "active");
  await expect.poll(async () => {
    const after = await relativePosition();
    return Math.max(Math.abs(after.x - before.x), Math.abs(after.y - before.y));
  }).toBeLessThan(1);
  expect(await icon.evaluate(el => getComputedStyle(el).transform)).toBe("none");
  await expect(page.getByRole("button", { name: /Pause animations|Resume animations/ })).toHaveCount(0);
  await expect(page.locator('main a[href="/peers"], main a[href="/resources"]')).toHaveCount(0);
  // Default motion has no decorative infinite loops, including offscreen sections.
  expect(await page.evaluate(() => document.getAnimations().filter(animation => animation.effect?.getTiming().iterations === Infinity).length)).toBe(0);
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  expect(await page.locator(".aurora-field > i").first().evaluate(el => getComputedStyle(el).animationName)).toBe("none");
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // The preview logo must not force the adjacent title into a narrow column.
    const toolbar = await page.locator(".studio-toolbar").boundingBox();
    expect(toolbar!.height).toBeLessThan(80);
    const stepNumber = await page.locator(".step-number").first().boundingBox();
    expect(stepNumber!.height).toBeLessThanOrEqual(24);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: "Physics", exact: true }).click();
  const selectorBox = await page.locator(".studio-subjects").boundingBox();
  const resultBox = await page.locator(".studio-search").boundingBox();
  expect(selectorBox).not.toBeNull(); expect(resultBox).not.toBeNull();
  expect(resultBox!.y - (selectorBox!.y + selectorBox!.height)).toBeLessThan(30);
  await expect(page.locator("#subject-panel")).toContainText("Mechanics");
  await page.getByRole("link", { name: "Find your study circle", exact: true }).first().click();
  await expect(page).toHaveURL(/\/login$/);
});

test("workspace footer is absent and logout requires confirmation on desktop and mobile", async ({ browser, app }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await app.signIn(context, "helper");
  const page = await context.newPage();
  try {
    for (const route of ["/dashboard", "/profile", "/peers", "/resources", "/resources/manage"]) {
      await page.goto(route);
      await expect(page.locator("footer.site-footer")).toHaveCount(0);
    }
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Open account settings", exact: true }).click();
    await expect(page).toHaveURL(/\/settings$/);
    const trigger = page.getByRole("button", { name: "Log out", exact: true });
    await trigger.click();
    const confirmation = page.getByRole("alertdialog", { name: "Log out of Peerly?" });
    await expect(confirmation).toBeVisible();
    const cancel = confirmation.getByRole("button", { name: "Cancel", exact: true });
    await expect(cancel).toBeFocused();
    await cancel.press("Shift+Tab");
    await expect(confirmation.getByRole("button", { name: "Log out", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(cancel).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(confirmation).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await expect(page).toHaveURL(/\/settings$/);
    expect((await (await context.request.get("/api/auth/session")).json()).user).toBeTruthy();
    await trigger.click();
    await page.screenshot({ path: testInfo.outputPath("logout-desktop.png") });
    await confirmation.getByRole("button", { name: "Log out", exact: true }).click();
    await expect(page).toHaveURL("/");
    expect(await (await context.request.get("/api/auth/session")).json()).toBeNull();
    await expect(page.locator("footer.site-footer")).toBeVisible();
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);

    // The already-signed-in login screen uses the same confirmation boundary.
    await app.signIn(context, "helper");
    await page.goto("/login");
    await page.getByRole("button", { name: "Sign Out", exact: true }).click();
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(confirmation).not.toBeVisible();
    expect((await (await context.request.get("/api/auth/session")).json()).user).toBeTruthy();

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    const mobileTrigger = page.getByRole("navigation", { name: "Mobile Navigation" }).getByRole("button", { name: "Sign Out", exact: true });
    await mobileTrigger.click();
    await expect(confirmation).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("logout-mobile.png") });
    await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(mobileTrigger).toBeFocused();
    await expect(page).toHaveURL(/\/dashboard$/);
    await mobileTrigger.click();
    await confirmation.getByRole("button", { name: "Log out", exact: true }).click();
    await expect(page).toHaveURL("/");
    expect(await (await context.request.get("/api/auth/session")).json()).toBeNull();
    await expect(page.getByRole("navigation", { name: "Mobile Navigation" })).not.toBeVisible();
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
  } finally { await context.close(); }
});
