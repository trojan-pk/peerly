import { ObjectId } from "mongodb";
import { test, expect } from "./fixtures";

test("admin adds a university, a helper adds a course, learners find them by course code", async ({ browser, app }, testInfo) => {
  const suffix = Date.now().toString(36);
  const uniName = `Test Institute ${suffix}`;
  const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const helperCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const learnerCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await app.signIn(adminCtx, "admin");
  await app.signIn(helperCtx, "helper");
  await app.signIn(learnerCtx, "learner");
  const adminPage = await adminCtx.newPage();
  const helper = await helperCtx.newPage();
  const learner = await learnerCtx.newPage();
  try {
    // Non-admins cannot open the catalogue.
    await helper.goto("/admin/universities");
    await expect(helper.getByRole("heading", { name: "Administrator access required" })).toBeVisible();

    await adminPage.goto("/admin/universities");
    await adminPage.getByLabel("Name", { exact: true }).fill(uniName);
    await adminPage.getByLabel("Email domains").first().fill(`ti${suffix}.edu.pk`);
    await adminPage.getByRole("button", { name: "Add university" }).click();
    await expect(adminPage.getByRole("status", { name: "Notifications" })).toContainText(`${uniName} added`);

    // Helper picks the university and adds a course with a messy code.
    await helper.goto("/settings");
    const section = helper.getByRole("region", { name: "University and courses" });
    await section.getByLabel("Your university").selectOption({ label: uniName });
    await section.getByLabel("Add a missing course").fill("cs 101");
    await expect(section).toContainText("Will be saved as CS-101");
    await section.getByLabel("Course title (optional)").fill("Programming Fundamentals");
    await section.getByRole("button", { name: "Add course" }).click();
    await expect(section.getByRole("checkbox", { name: /CS-101/ })).toBeChecked();
    await section.getByRole("button", { name: "Save university and courses" }).click();
    await expect(helper.getByRole("status", { name: "Notifications" })).toContainText("Courses saved");
    await helper.screenshot({ path: testInfo.outputPath("settings-courses.png"), fullPage: true });
    const stored = await app.db.collection("users").findOne({ _id: new ObjectId(app.ids.helper) });
    expect(stored?.courseCodes).toEqual(["CS-101"]);
    expect(stored?.university).toBe(uniName);

    // Learner filters by course and sees the helper ranked with the course reason.
    await learner.goto("/peers");
    await learner.getByLabel("Course", { exact: true }).selectOption({ label: `CS-101 · Programming Fundamentals (${uniName})` });
    await expect(learner).toHaveURL(/course=[a-f0-9]{24}/);
    const card = learner.getByRole("main").locator("article, li, div").filter({ hasText: "Hamza Helper" }).filter({ hasText: "CS-101" }).first();
    await expect(card).toBeVisible();
    await expect(learner.getByRole("main")).not.toContainText("Laila Learner");
    await learner.goto("/peers?q=CS101");
    await expect(learner.getByRole("main")).toContainText("Hamza Helper");

    // Request form offers the helper's course.
    await learner.goto(`/peers/${app.ids.helper}`);
    await expect(learner.getByRole("region", { name: "Courses they help with" })).toContainText("CS-101");
    await learner.locator("#request-course:visible").selectOption({ label: "CS-101 · Programming Fundamentals" });
    await learner.locator("#problemDescription:visible").fill("Pointers keep confusing me in this week's lab.");
    await learner.locator("#request-topic:visible").fill(`Pointers ${suffix}`);
    await learner.getByRole("button", { name: /Send.*Request/ }).click();
    await expect(learner.getByRole("main").getByRole("status")).toContainText(/sent successfully/i);
    expect((await app.db.collection("studyrequests").findOne({ topic: `Pointers ${suffix}` }))?.courseCode).toBe("CS-101");

    // Admin sees the course with one helper and can hide it.
    await adminPage.goto("/admin/universities");
    const uniLink = adminPage.getByRole("navigation", { name: "Universities" }).getByRole("link", { name: new RegExp(uniName) });
    if (await uniLink.count()) await uniLink.click();
    await expect(adminPage.getByRole("heading", { name: uniName })).toBeVisible();
    const row = adminPage.getByRole("row", { name: /CS-101/ });
    await expect(row).toContainText("1");
    await adminPage.screenshot({ path: testInfo.outputPath("admin-catalogue.png"), fullPage: true });
    await row.getByRole("button", { name: "Hide CS-101" }).click();
    await expect(adminPage.getByRole("status", { name: "Notifications" })).toContainText("CS-101 hidden");
    await learner.goto("/peers");
    await expect(learner.getByLabel("Course", { exact: true })).toHaveCount(0);
  } finally {
    await adminCtx.close(); await helperCtx.close(); await learnerCtx.close();
  }
});

test("verified university badge is public, the address is not, and verification explains when email is off", async ({ page, context, app }) => {
  const now = new Date();
  await app.db.collection("users").updateOne({ _id: new ObjectId(app.ids.helper) }, { $set: { universityEmail: "hamza@student.test.edu", universityEmailVerifiedAt: now, verifiedUniversityName: "Test University" } });
  try {
    await app.signIn(context, "learner");
    await page.goto(`/peers/${app.ids.helper}`);
    await expect(page.getByRole("main").getByText("University email verified").first()).toBeVisible();
    await expect(page.getByRole("main")).not.toContainText("hamza@student.test.edu");
    await page.goto("/peers");
    await expect(page.getByRole("main")).toContainText("University email verified");
    await expect(page.getByRole("main")).not.toContainText("student.test.edu");

    await page.goto("/settings");
    const verify = page.getByRole("region", { name: "University email" });
    await expect(verify).toContainText("isn’t set up on this Peerly server");
  } finally {
    await app.db.collection("users").updateOne({ _id: new ObjectId(app.ids.helper) }, { $set: { universityEmail: null, universityEmailVerifiedAt: null, verifiedUniversityName: "" } });
  }
});
