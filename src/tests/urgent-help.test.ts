import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { StudyRequest } from "@/models/StudyRequest";
import { User } from "@/models/User";
import { Notification } from "@/models/Notification";
import { createStudyRequest, transitionStudyRequest, confirmStudyRequestCompletion, submitStudyRequestReview } from "@/app/dashboard/actions";
import { getUnreadNotificationCount, markNotificationRead, markAllNotificationsRead, setEmailAlerts } from "@/app/notifications/actions";
import { getDashboardRequests } from "@/lib/study-requests";
import { getPeerResponseStats } from "@/lib/peer-responses";
import { expireAndNotify, expireOverdueRequests } from "@/lib/request-expiry";
import { computeExpiresAt, formatTimeLeft, NORMAL_WINDOW_MS, URGENT_WINDOW_MS } from "@/lib/request-rules";
import { CreateStudyRequestSchema } from "@/lib/validations/request";
import { listNotificationsFor, notify, notificationCopy, EMAIL_LIMIT_PER_HOUR } from "@/lib/notifications";
import { escapeHtml, isValidEmailFrom, isValidResendKey, sendEmail } from "@/lib/email";
import { flushBackgroundTasks } from "@/lib/background";
import * as authGuards from "@/lib/auth-guards";
import { resetRateLimitsForTesting } from "@/lib/rate-limit";
import { ensureDatabaseIndexes } from "@/lib/db";

const HOUR = 60 * 60 * 1000;
const PROBLEM = "My recursive merge sort overflows the stack on large inputs.";
const WHATSAPP = "+923001234567";

describe("request timing rules (pure)", () => {
  it("expires urgent requests after 6h and normal after 72h, capped by the learner's deadline", () => {
    const t = new Date("2026-10-26T10:00:00Z");
    expect(computeExpiresAt(t, "urgent").getTime() - t.getTime()).toBe(URGENT_WINDOW_MS);
    expect(computeExpiresAt(t, "normal").getTime() - t.getTime()).toBe(NORMAL_WINDOW_MS);
    const soon = new Date(t.getTime() + 2 * HOUR);
    expect(computeExpiresAt(t, "urgent", soon)).toEqual(soon);
    expect(computeExpiresAt(t, "urgent", new Date(t.getTime() + 30 * HOUR)).getTime() - t.getTime()).toBe(URGENT_WINDOW_MS);
  });

  it("formats compact countdowns and stops at zero", () => {
    expect(formatTimeLeft(2 * HOUR + 58 * 60_000 + 5_000)).toBe("2h 58m left");
    expect(formatTimeLeft(12 * 60_000)).toBe("12m left");
    expect(formatTimeLeft(30_000)).toBe("Less than a minute left");
    expect(formatTimeLeft(3 * 24 * HOUR + 4 * HOUR)).toBe("3d 4h left");
    expect(formatTimeLeft(0)).toBeNull();
    expect(formatTimeLeft(-5)).toBeNull();
  });
});

describe("request validation: urgency and deadline", () => {
  const base = { peerId: "x", topic: "Recursion", problemDescription: PROBLEM, mode: "online" };
  it("defaults to normal with no deadline", () => {
    const parsed = CreateStudyRequestSchema.parse(base);
    expect(parsed.urgency).toBe("normal");
    expect(parsed.neededBy).toBeNull();
    expect(CreateStudyRequestSchema.parse({ ...base, neededBy: "" }).neededBy).toBeNull();
  });
  it("accepts a deadline between 15 minutes and 14 days away", () => {
    const at = new Date(Date.now() + 3 * HOUR).toISOString();
    expect(CreateStudyRequestSchema.parse({ ...base, urgency: "urgent", neededBy: at }).neededBy?.toISOString()).toBe(at);
  });
  it.each([
    ["in the past", new Date(Date.now() - HOUR).toISOString()],
    ["too soon", new Date(Date.now() + 5 * 60_000).toISOString()],
    ["over 14 days away", new Date(Date.now() + 15 * 24 * HOUR).toISOString()],
    ["not a date", "tomorrow evening"],
    ["without a timezone", "2026-10-27T10:00"],
  ])("rejects a deadline %s", (_label, neededBy) => {
    expect(CreateStudyRequestSchema.safeParse({ ...base, neededBy }).success).toBe(false);
  });
  it("rejects unknown urgency values", () => {
    expect(CreateStudyRequestSchema.safeParse({ ...base, urgency: "asap" }).success).toBe(false);
  });
});

describe("email helpers (pure)", () => {
  it("escapes HTML special characters", () => {
    expect(escapeHtml(`<script>alert("x")</script> & 'y'`)).toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;");
  });
  it("validates provider configuration without exposing values", () => {
    expect(isValidResendKey("re_1234567890abcdefXYZ")).toBe(true);
    expect(isValidResendKey("re_your_api_key_here_abcdef")).toBe(false);
    expect(isValidResendKey("sk_live_123")).toBe(false);
    expect(isValidEmailFrom("Peerly <alerts@peerly.app>")).toBe(true);
    expect(isValidEmailFrom("alerts@example.com")).toBe(false);
    expect(isValidEmailFrom("a@b.co\r\nBcc: x@y.z")).toBe(false);
  });
  it("skips sending when unconfigured", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    vi.stubEnv("RESEND_API_KEY", "");
    expect(await sendEmail({ to: "a@b.co", subject: "s", html: "h", text: "t" })).toEqual({ sent: false, reason: "unconfigured" });
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
    fetchSpy.mockRestore();
  });
  it("produces copy for every notification type without placeholders", () => {
    for (const type of ["REQUEST_RECEIVED", "REQUEST_ACCEPTED", "REQUEST_DECLINED", "COMPLETION_CONFIRMED", "SESSION_COMPLETED", "REVIEW_RECEIVED", "REQUEST_EXPIRED"] as const) {
      const copy = notificationCopy(type, "Hamza", "Recursion");
      expect(copy.title).toContain("Recursion");
      expect(copy.title + copy.body).not.toMatch(/undefined|null/);
    }
    expect(notificationCopy("REQUEST_RECEIVED", "", "Graphs", true).title).toBe("Urgent request: Graphs");
  });
});

describe("Urgent help, expiry and notifications (MongoDB integration)", () => {
  let mongoServer: MongoMemoryServer;
  let learner: any;
  let helper: any;
  let other: any;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
    await mongoose.connect(mongoServer.getUri());
    await ensureDatabaseIndexes();
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });
  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    await resetRateLimitsForTesting();
    await Promise.all([StudyRequest.deleteMany({}), User.deleteMany({}), Notification.deleteMany({})]);
    const profile = { role: "student" as const, university: "FAST", isProfileComplete: true, mode: "both" as const, availability: "Evenings", topics: ["Recursion"], subjects: ["CS"] };
    learner = await User.create({ ...profile, googleId: "g-l", email: "laila@uni.edu", name: "Laila Learner", contact: { whatsapp: "+923111111111", preferredMethod: "whatsapp" } });
    helper = await User.create({ ...profile, googleId: "g-h", email: "hamza@uni.edu", name: "Hamza Helper", contact: { whatsapp: WHATSAPP, meetingLink: "https://meet.example.org/hamza", preferredMethod: "whatsapp" } });
    other = await User.create({ ...profile, googleId: "g-o", email: "omar@uni.edu", name: "Omar Other" });
  });
  afterEach(async () => {
    await flushBackgroundTasks();
    vi.unstubAllEnvs();
  });

  function as(user: any) {
    vi.spyOn(authGuards, "requireAuth").mockResolvedValue({ user, session: {} as any, isAdmin: false });
  }
  async function send(extra: Record<string, unknown> = {}, topic = "Recursion") {
    as(learner);
    const result = await createStudyRequest({ peerId: String(helper._id), topic, problemDescription: PROBLEM, mode: "online", ...extra });
    expect(result.success).toBe(true);
    return result.requestId!;
  }
  async function makeOverdue(id: string) {
    await StudyRequest.updateOne({ _id: id }, { $set: { expiresAt: new Date(Date.now() - 60_000) } });
  }

  describe("urgency, deadline and ordering", () => {
    it("stores urgency and an expiry capped by the deadline", async () => {
      const neededBy = new Date(Date.now() + 2 * HOUR);
      const id = await send({ urgency: "urgent", neededBy: neededBy.toISOString() });
      const doc = await StudyRequest.findById(id).lean();
      expect(doc?.urgency).toBe("urgent");
      expect(doc?.neededBy?.toISOString()).toBe(neededBy.toISOString());
      expect(doc?.expiresAt?.toISOString()).toBe(neededBy.toISOString());
      expect(doc?.priority).toBe(2);
    });

    it("shows urgent pending requests first, then normal pending, then resolved", async () => {
      const resolved = await send({}, "Graphs");
      as(helper); await transitionStudyRequest({ requestId: resolved, action: "reject" });
      const normal = await send({}, "Trees");
      const urgent = await send({ urgency: "urgent" }, "Heaps");
      as(helper);
      const { incoming } = await getDashboardRequests();
      expect(incoming.items.map((r) => r.id)).toEqual([urgent, normal, resolved]);
      expect(incoming.items[0]).toMatchObject({ urgency: "urgent", status: "PENDING" });
      expect(incoming.items[0].expiresAt).not.toBeNull();
    });

    it("treats legacy records as normal with a 72h window and backfills their sort key", async () => {
      const createdAt = new Date(Date.now() - HOUR);
      const { insertedId } = await StudyRequest.collection.insertOne({ learner: learner._id, peer: helper._id, topic: "Legacy", normalizedTopic: "legacy", problemDescription: PROBLEM, mode: "online", status: "PENDING", createdAt, updatedAt: createdAt });
      as(helper);
      const [item] = (await getDashboardRequests()).incoming.items;
      expect(item).toMatchObject({ id: String(insertedId), urgency: "normal", neededBy: null, status: "PENDING" });
      expect(new Date(item.expiresAt!).getTime()).toBe(createdAt.getTime() + NORMAL_WINDOW_MS);
      expect((await StudyRequest.findById(insertedId).lean())?.priority).toBe(1);
    });
  });

  describe("expiry", () => {
    it("blocks accepting or declining after expiry and reports it honestly", async () => {
      const id = await send({ urgency: "urgent" });
      await makeOverdue(id);
      as(helper);
      const accept = await transitionStudyRequest({ requestId: id, action: "accept" });
      expect(accept).toMatchObject({ success: false, conflict: true });
      expect(accept.message).toMatch(/expired/i);
      expect((await transitionStudyRequest({ requestId: id, action: "reject" })).success).toBe(false);
      const doc = await StudyRequest.findById(id).lean();
      expect(doc?.status).toBe("EXPIRED");
      expect(doc?.respondedAt).toBeNull();
    });

    it("frees the same helper and topic for a new request", async () => {
      const first = await send();
      as(learner);
      expect((await createStudyRequest({ peerId: String(helper._id), topic: "Recursion", problemDescription: PROBLEM, mode: "online" })).conflict).toBe(true);
      await makeOverdue(first);
      const second = await send();
      expect(second).not.toBe(first);
      expect((await StudyRequest.findById(first).lean())?.status).toBe("EXPIRED");
    });

    it("expires legacy pending records after 72 hours", async () => {
      const old = new Date(Date.now() - NORMAL_WINDOW_MS - HOUR);
      const { insertedId } = await StudyRequest.collection.insertOne({ learner: learner._id, peer: helper._id, topic: "Old", normalizedTopic: "old", problemDescription: PROBLEM, mode: "online", status: "PENDING", createdAt: old, updatedAt: old });
      as(learner);
      const { outgoing } = await getDashboardRequests();
      expect(outgoing.items.find((r) => r.id === String(insertedId))?.status).toBe("EXPIRED");
    });

    it("does not count expired requests toward response-time badges", async () => {
      for (const topic of ["A", "B", "C"]) { const id = await send({}, topic); await makeOverdue(id); }
      await expireOverdueRequests({ peer: helper._id });
      expect(await StudyRequest.countDocuments({ status: "EXPIRED" })).toBe(3);
      expect(await getPeerResponseStats(String(helper._id))).toEqual({ sampleCount: 0, avgResponseTimeMs: null, hasFastReplyBadge: false });
    });

    it("lets exactly one of a concurrent accept and expiry win", async () => {
      // Open request: concurrent sweeps must not touch it; accept wins.
      const open = await send({}, "Open");
      as(helper);
      const [accepted] = await Promise.all([transitionStudyRequest({ requestId: open, action: "accept" }), expireOverdueRequests(), expireOverdueRequests()]);
      expect(accepted.success).toBe(true);
      expect((await StudyRequest.findById(open).lean())?.status).toBe("ACCEPTED");

      // Overdue request: expiry wins, accept fails, and the expiry is reported once.
      const overdue = await send({}, "Overdue");
      await makeOverdue(overdue);
      as(helper);
      const results = await Promise.all([transitionStudyRequest({ requestId: overdue, action: "accept" }), expireAndNotify(), expireAndNotify(), expireAndNotify()]);
      expect((results[0] as { success: boolean }).success).toBe(false);
      expect((await StudyRequest.findById(overdue).lean())?.status).toBe("EXPIRED");
      expect(await Notification.countDocuments({ type: "REQUEST_EXPIRED", request: overdue })).toBe(1);
    });
  });

  describe("notifications", () => {
    it("creates exactly one notification per event for the right person", async () => {
      const id = await send({ urgency: "urgent" });
      as(helper); await transitionStudyRequest({ requestId: id, action: "accept" });
      as(learner); await confirmStudyRequestCompletion({ requestId: id });
      as(learner); await confirmStudyRequestCompletion({ requestId: id }); // repeat: no new event
      as(helper); await confirmStudyRequestCompletion({ requestId: id });
      as(learner); await submitStudyRequestReview({ requestId: id, rating: 5, comment: "Clear explanation" });
      const declined = await send({}, "Graphs");
      as(helper); await transitionStudyRequest({ requestId: declined, action: "reject" });

      const rows = await Notification.find({}).sort({ createdAt: 1, _id: 1 }).lean();
      const summary = rows.map((r) => [r.type, String(r.recipient) === String(helper._id) ? "helper" : "learner"]);
      expect(summary).toEqual([
        ["REQUEST_RECEIVED", "helper"],
        ["REQUEST_ACCEPTED", "learner"],
        ["COMPLETION_CONFIRMED", "helper"],
        ["SESSION_COMPLETED", "learner"],
        ["REVIEW_RECEIVED", "helper"],
        ["REQUEST_RECEIVED", "helper"],
        ["REQUEST_DECLINED", "learner"],
      ]);
      expect(rows[0]).toMatchObject({ urgent: true, actorFirstName: "Laila", topic: "Recursion" });
    });

    it("ignores duplicate deliveries of the same event", async () => {
      const id = await send();
      const event = { type: "REQUEST_ACCEPTED" as const, recipientId: learner._id, requestId: id, actorName: "Hamza Helper", topic: "Recursion" };
      await Promise.all([notify([event]), notify([event]), notify([event, event])]);
      expect(await Notification.countDocuments({ type: "REQUEST_ACCEPTED" })).toBe(1);
    });

    it("never stores or returns contact details, emails or the problem text", async () => {
      const id = await send({ urgency: "urgent" });
      as(helper); await transitionStudyRequest({ requestId: id, action: "accept" });
      const stored = JSON.stringify(await Notification.find({}).lean());
      const listed = JSON.stringify([await listNotificationsFor(helper._id), await listNotificationsFor(learner._id)]);
      for (const text of [stored, listed]) {
        for (const secret of [WHATSAPP, "meet.example.org", "hamza@uni.edu", "laila@uni.edu", "merge sort", "+923111111111"]) expect(text).not.toContain(secret);
      }
    });

    it("lets only the recipient read or mark a notification", async () => {
      await send();
      const note = await Notification.findOne({ recipient: helper._id }).lean();
      as(other);
      expect((await getUnreadNotificationCount()).count).toBe(0);
      expect((await markNotificationRead(String(note!._id))).success).toBe(false);
      await markAllNotificationsRead();
      expect((await Notification.findById(note!._id).lean())?.readAt).toBeNull();
      expect((await listNotificationsFor(other._id)).total).toBe(0);

      as(helper);
      expect((await getUnreadNotificationCount()).count).toBe(1);
      expect((await markNotificationRead(String(note!._id))).success).toBe(true);
      expect((await getUnreadNotificationCount()).count).toBe(0);
    });

    it("returns zero unread for signed-out callers and rejects their writes", async () => {
      vi.spyOn(authGuards, "requireAuth").mockRejectedValue(new authGuards.UnauthorizedError());
      expect(await getUnreadNotificationCount()).toEqual({ count: 0 });
      expect((await markAllNotificationsRead()).success).toBe(false);
      expect((await setEmailAlerts(false)).success).toBe(false);
    });

    it("keeps the request action successful when notifications fail", async () => {
      vi.spyOn(Notification, "insertMany").mockRejectedValue(new Error("notification store down"));
      const id = await send();
      expect(await StudyRequest.exists({ _id: id })).not.toBeNull();
    });
  });

  describe("optional email alerts", () => {
    function configureEmail() {
      vi.stubEnv("RESEND_API_KEY", "re_test_0123456789abcdefgh");
      vi.stubEnv("EMAIL_FROM", "Peerly <alerts@peerly.app>");
      vi.stubEnv("AUTH_URL", "https://peerly.app");
      return vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    }
    function payloads(fetchSpy: ReturnType<typeof configureEmail>) {
      return fetchSpy.mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)));
    }

    it("does nothing without configuration", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      await send({ urgency: "urgent" });
      await flushBackgroundTasks();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("emails the helper a new request with topic, urgency, deadline and link only", async () => {
      const fetchSpy = configureEmail();
      const neededBy = new Date(Date.now() + 3 * HOUR);
      await send({ urgency: "urgent", neededBy: neededBy.toISOString() }, `Pointers <b>& "refs"`);
      await flushBackgroundTasks();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe("https://api.resend.com/emails");
      expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer re_test_0123456789abcdefgh" });
      const [mail] = payloads(fetchSpy);
      expect(mail.to).toEqual(["hamza@uni.edu"]);
      expect(mail.subject).toContain("Urgent request");
      expect(mail.html).toContain("Pointers &lt;b&gt;&amp; &quot;refs&quot;");
      expect(mail.html).not.toContain("<b>&");
      expect(mail.html).toContain("https://peerly.app/dashboard?tab=incoming#request-");
      expect(mail.text).toContain("Needed by");
      for (const body of [mail.html, mail.text]) {
        expect(body).not.toContain("merge sort");
        expect(body).not.toContain("+923111111111");
        expect(body).not.toContain("laila@uni.edu");
      }
    });

    it("emails the learner on accept and decline but not on other events", async () => {
      const fetchSpy = configureEmail();
      const id = await send();
      as(helper); await transitionStudyRequest({ requestId: id, action: "accept" });
      as(learner); await confirmStudyRequestCompletion({ requestId: id });
      await flushBackgroundTasks();
      expect(payloads(fetchSpy).map((m) => [m.to[0], m.subject.split(":")[0]])).toEqual([
        ["hamza@uni.edu", "Peerly — New request"],
        ["laila@uni.edu", "Peerly — Accepted"],
      ]);
      expect(payloads(fetchSpy)[1].html).not.toContain(WHATSAPP);
    });

    it("respects a recipient's opt-out", async () => {
      const fetchSpy = configureEmail();
      as(helper); expect((await setEmailAlerts(false)).success).toBe(true);
      await send();
      await flushBackgroundTasks();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(await Notification.countDocuments({ recipient: helper._id })).toBe(1);
    });

    it(`sends at most ${EMAIL_LIMIT_PER_HOUR} emails per recipient per hour`, async () => {
      const fetchSpy = configureEmail();
      for (let i = 0; i < EMAIL_LIMIT_PER_HOUR + 2; i++) {
        await notify([{ type: "REQUEST_RECEIVED", recipientId: helper._id, requestId: new mongoose.Types.ObjectId(), actorName: "Laila", topic: `Topic ${i}` }]);
      }
      await flushBackgroundTasks();
      expect(fetchSpy).toHaveBeenCalledTimes(EMAIL_LIMIT_PER_HOUR);
    });

    it("keeps the action successful when the provider fails or times out", async () => {
      configureEmail().mockRejectedValue(Object.assign(new Error("timeout"), { name: "TimeoutError" }));
      const id = await send();
      await flushBackgroundTasks();
      expect(await StudyRequest.exists({ _id: id })).not.toBeNull();
      expect(await sendEmail({ to: "a@b.co", subject: "s", html: "h", text: "t" })).toEqual({ sent: false, reason: "timeout" });
    });
  });
});
