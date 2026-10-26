import { ObjectId } from "mongodb";
import { test, expect } from "./fixtures";

/**
 * End-to-end student journey across both themes: the learner uses Ink (dark), the
 * helper uses Paper (light). University email verification needs a real email provider,
 * so the verified state is seeded in the temporary database instead of sent.
 */
test("full journey: urgent request → bell → accept → schedule → video → complete → review → helpful vote → public page", async ({ browser, app }, testInfo) => {
  test.setTimeout(180_000);
  const suffix = Date.now().toString(36);
  const topic = `Journey ${suffix}`;
  const learnerCtx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "dark" });
  const helperCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "light" });
  await learnerCtx.addInitScript(() => localStorage.setItem("peerly-theme", "dark"));
  await helperCtx.addInitScript(() => localStorage.setItem("peerly-theme", "light"));
  await app.signIn(learnerCtx, "learner");
  await app.signIn(helperCtx, "helper");
  await app.db.collection("users").updateOne({ _id: new ObjectId(app.ids.helper) }, { $set: { universityEmailVerifiedAt: new Date(), verifiedUniversityName: "Test University", universityEmail: `hamza-${suffix}@test.edu` } });
  const learner = await learnerCtx.newPage();
  const helper = await helperCtx.newPage();
  const toast = (p: typeof learner) => p.getByRole("status", { name: "Notifications" });
  try {
    // 1. Urgent request.
    await learner.goto(`/peers/${app.ids.helper}`);
    await expect(learner.locator("html")).toHaveAttribute("data-theme", "ink");
    await expect(learner.getByRole("main").getByText("University email verified").first()).toBeVisible();
    await learner.locator("#request-topic:visible").fill(topic);
    await learner.getByRole("radio", { name: /^Urgent/ }).check();
    await learner.locator("#problemDescription:visible").fill("My linked list reversal loses the head node. Due at midnight.");
    await learner.getByRole("button", { name: /Send.*Request/ }).click();
    await expect(learner.getByRole("main").getByRole("status")).toContainText(/sent successfully/i);

    // 2. Helper (mobile, light) is notified and accepts from the inbox link.
    await helper.goto("/notifications");
    await expect(helper.locator("html")).toHaveAttribute("data-theme", "paper");
    await helper.getByRole("button", { name: new RegExp(`Urgent request: ${topic}`) }).click();
    const helperCard = helper.getByRole("article", { name: topic });
    await expect(helperCard.getByText("Urgent", { exact: true })).toBeVisible();
    await helperCard.getByRole("button", { name: "Accept Request" }).click();
    await expect(toast(helper)).toContainText(/accepted/i);

    // 3. Learner sees contact, suggests a time; helper picks it.
    await learner.goto("/dashboard?tab=outgoing");
    const learnerCard = learner.getByRole("article", { name: topic });
    await expect(learnerCard.getByRole("link", { name: /WhatsApp/ })).toBeVisible();
    await learnerCard.getByRole("button", { name: "Suggest times" }).click();
    const slot = await learner.evaluate(() => {
      const d = new Date(Date.now() + 3 * 3600_000); d.setMinutes(30, 0, 0);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:30`;
    });
    await learnerCard.getByLabel("Option 1").fill(slot);
    await learnerCard.getByRole("button", { name: "Send times" }).click();
    await expect(toast(learner)).toContainText("Times sent");
    await helper.goto("/dashboard?tab=incoming");
    await helper.getByRole("article", { name: topic }).getByRole("button", { name: /:30/ }).click();
    await expect(toast(helper)).toContainText("Session scheduled");

    // 4. Video link and calendar.
    await learner.reload();
    await learnerCard.getByRole("button", { name: "Create video call link" }).click();
    await expect(learnerCard.getByRole("link", { name: "Join video call" })).toHaveAttribute("href", /meet\.jit\.si\/peerly-[a-f0-9]{32}$/);
    const requestId = (await learnerCard.getAttribute("id"))!.replace("request-", "");
    expect((await learnerCtx.request.get(`/api/requests/${requestId}/ics`)).status()).toBe(200);
    await learner.screenshot({ path: testInfo.outputPath("journey-learner-ink.png"), fullPage: true });

    // 5. Both confirm, learner reviews.
    await learnerCard.getByRole("button", { name: "Confirm Session Completed" }).click();
    await expect(toast(learner)).toContainText(/Waiting for the other participant/i);
    await helper.reload();
    await helper.getByRole("article", { name: topic }).getByRole("button", { name: "Confirm Session Completed" }).click();
    await expect(toast(helper)).toContainText(/Both participants have confirmed/i);
    await learner.reload();
    await learnerCard.getByRole("button", { name: /Write.*Review/ }).click();
    await learnerCard.getByRole("button", { name: /5 star/i }).click();
    await learnerCard.locator('textarea[id^="review-comment-"]').fill("Drew the pointers on paper until it clicked.");
    await learnerCard.getByRole("button", { name: "Submit Review" }).click();
    await expect(toast(learner)).toContainText(/published/i);
    await helper.screenshot({ path: testInfo.outputPath("journey-helper-paper-mobile.png"), fullPage: true });

    // 6. Helper shares notes; learner marks them helpful.
    await app.db.collection("resources").insertOne({ owner: new ObjectId(app.ids.helper), title: `Linked lists ${suffix}`, description: "Diagrams for reversing a singly linked list.", topic: "Linked Lists", normalizedTopic: "linked lists", url: "https://example.org/ll", upvoteCount: 0, createdAt: new Date(), updatedAt: new Date() });
    await learner.goto(`/resources?q=${suffix}`);
    const upvote = learner.getByRole("article").filter({ hasText: `Linked lists ${suffix}` }).getByRole("button", { name: /as helpful/ });
    await upvote.click();
    await expect(upvote).toHaveAttribute("aria-pressed", "true");

    // 7. Helper publishes the public page; a visitor sees real numbers.
    await helper.goto("/settings");
    await helper.getByRole("switch", { name: "Public helper page" }).click();
    await expect(toast(helper)).toContainText("public page is live");
    const url = await helper.getByTestId("public-page-url").textContent();
    const visitor = await browser.newContext();
    const visitorPage = await visitor.newPage();
    await visitorPage.goto(new URL(url!).pathname);
    const completed = visitorPage.locator(".helper-stats div").filter({ hasText: "Completed sessions" }).locator("dd");
    await expect(completed).not.toHaveText("0");
    await expect(visitorPage.getByRole("main")).toContainText("University email verified · Test University");
    await expect(visitorPage.getByRole("main")).not.toContainText(`hamza-${suffix}@test.edu`);
    await expect(visitorPage.getByRole("main")).not.toContainText("+923001234567");
    await visitor.close();
    await helper.getByRole("switch", { name: "Public helper page" }).click();
    await expect(toast(helper)).toContainText("now hidden");
  } finally {
    // Suites share one temporary database; remove what this journey created.
    await app.db.collection("resources").deleteMany({ title: `Linked lists ${suffix}` });
    await app.db.collection("studyrequests").deleteMany({ topic });
    await app.db.collection("users").updateOne({ _id: new ObjectId(app.ids.helper) }, { $set: { publicPageEnabled: false } });
    await app.db.collection("users").updateOne({ _id: new ObjectId(app.ids.helper) }, { $set: { universityEmailVerifiedAt: null, verifiedUniversityName: "", universityEmail: null } });
    await learnerCtx.close();
    await helperCtx.close();
  }
});
