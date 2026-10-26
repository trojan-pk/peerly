import { ObjectId } from "mongodb";
import { test, expect } from "./fixtures";

const PAGES = ["/", "/login", "/dashboard", "/peers", "/resources", "/settings", "/notifications"];

test("security headers and a nonce CSP are sent, and pages run without CSP violations", async ({ page, context, app, request }) => {
  const violations: string[] = [];
  page.on("console", (m) => { if (/Content Security Policy|Refused to (execute|load|apply)/i.test(m.text())) violations.push(m.text()); });
  page.on("pageerror", (e) => violations.push(e.message));
  await app.signIn(context, "learner");

  const nonces = new Set<string>();
  for (const path of PAGES) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBeLessThan(400);
    const headers = res!.headers();
    const csp = headers["content-security-policy"];
    expect(csp, path).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("unsafe-eval");
    nonces.add(csp.match(/'nonce-([^']+)'/)![1]);
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["x-powered-by"]).toBeUndefined();
    // The pre-paint theme script carries this response's nonce and actually ran.
    const scriptNonce = await page.locator("#peerly-theme-init").evaluate((el) => (el as HTMLScriptElement).nonce);
    expect(scriptNonce).toBe(csp.match(/'nonce-([^']+)'/)![1]);
    expect(await page.evaluate(() => document.documentElement.dataset.themePreference)).toBeTruthy();
    await expect(page.locator("main")).toBeVisible();
  }
  expect(nonces.size).toBe(PAGES.length);

  // Interactive client code still works under the CSP.
  await page.goto("/settings");
  await page.getByRole("main").getByRole("radio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "ink");
  expect(violations).toEqual([]);

  // Simulated stored XSS: a nonce-less inline script injected into the server HTML is blocked.
  await page.route("**/peers", async (route) => {
    const response = await route.fetch();
    const html = (await response.text()).replace("</body>", "<script>window.__injected = true</script></body>");
    await route.fulfill({ response, body: html });
  });
  const blockedViolations: string[] = [];
  page.on("console", (m) => { if (/Content Security Policy/i.test(m.text())) blockedViolations.push(m.text()); });
  await page.goto("/peers");
  await expect(page.locator("main")).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __injected?: boolean }).__injected ?? false)).toBe(false);
  expect(blockedViolations.length).toBeGreaterThan(0);
  await page.unroute("**/peers");

  // API responses keep the base security headers.
  const api = await request.get("/api/auth/session");
  expect(api.headers()["x-content-type-options"]).toBe("nosniff");
});

test("a member exports their data, deletes their account, and counterparts keep their history", async ({ browser, app }) => {
  const id = new ObjectId();
  const email = `leaving-${id.toHexString()}@peerly.example`;
  const now = new Date();
  await app.db.collection("users").insertOne({
    _id: id, googleId: `e2e-${id}`, email, name: "Leaving Learner", role: "student", isProfileComplete: true, university: "Test University",
    topics: ["Physics"], subjects: ["Science"], mode: "both", availability: "Any", pricingPreference: "free",
    contact: { whatsapp: "+923009990001", preferredMethod: "whatsapp" }, createdAt: now, updatedAt: now,
  });
  const topic = `Farewell ${id.toHexString().slice(-6)}`;
  await app.db.collection("studyrequests").insertOne({
    learner: id, peer: new ObjectId(app.ids.helper), topic, normalizedTopic: topic.toLowerCase(), problemDescription: "Private question from the leaving learner.",
    mode: "online", status: "REVIEWED", review: { rating: 5, comment: "Leaving learner's review comment", createdAt: now }, respondedAt: now, createdAt: now, updatedAt: now,
  });

  const ctx = await browser.newContext();
  await app.signInUser(ctx, { id: id.toHexString(), email, name: "Leaving Learner" });
  const page = await ctx.newPage();
  await page.goto("/settings");
  const data = page.getByRole("region", { name: "Your data" });

  const exported = await ctx.request.get("/api/account/export");
  expect(exported.status()).toBe(200);
  const json = await exported.json();
  expect(json.profile).toMatchObject({ email, contact: { whatsapp: "+923009990001" } });
  expect(json.requests[0]).toMatchObject({ topic, role: "learner", otherPerson: "Hamza" });
  expect(JSON.stringify(json)).not.toContain("+923001234567");
  await expect(data.getByRole("link", { name: "Download my data" })).toHaveAttribute("href", "/api/account/export");

  await data.getByRole("button", { name: "Delete account" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Delete your Peerly account?" });
  await expect(dialog.getByLabel("Type DELETE to confirm")).toBeFocused();
  const confirm = dialog.getByRole("button", { name: "Delete permanently" });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("Type DELETE to confirm").fill("DELETE");
  await confirm.click();
  await expect(page).toHaveURL(/\/$/);
  expect(await app.db.collection("users").findOne({ _id: id })).toBeNull();
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  expect((await ctx.request.get("/api/account/export")).status()).toBe(401);
  await ctx.close();

  // The helper still sees the session and the rating, attributed to "Deleted user".
  const helperCtx = await browser.newContext();
  await app.signIn(helperCtx, "helper");
  const helper = await helperCtx.newPage();
  await helper.goto("/dashboard?tab=incoming&status=REVIEWED");
  const card = helper.getByRole("article", { name: topic });
  await expect(card).toContainText("Deleted user");
  await expect(card).toContainText("5 / 5");
  await expect(card).not.toContainText("Leaving learner's review comment");
  await expect(card).not.toContainText("Private question from the leaving learner");
  await helperCtx.close();
});
