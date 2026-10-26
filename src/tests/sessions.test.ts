import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { User } from "@/models/User";
import { StudyRequest } from "@/models/StudyRequest";
import { Resource } from "@/models/Resource";
import { ResourceVote } from "@/models/ResourceVote";
import { Notification } from "@/models/Notification";
import { buildIcs, escapeIcsText, foldLine, icsDate } from "@/lib/ics";
import { buildSessionCalendar } from "@/lib/sessions";
import { chooseSessionTimeAction, getMeetingLinkAction, proposeSessionTimesAction } from "@/app/actions/sessions";
import { setResourceUpvote } from "@/app/resources/actions";
import { queryResources } from "@/lib/resources";
import { getDashboardRequests } from "@/lib/study-requests";
import { getPublicHelperPage } from "@/lib/helper-page";
import { setPublicPageAction } from "@/app/actions/helper-page";
import { MEETING_ROOM_PATTERN } from "@/lib/session-rules";
import { GET as getIcs } from "@/app/api/requests/[id]/ics/route";
import * as authGuards from "@/lib/auth-guards";
import { ensureDatabaseIndexes } from "@/lib/db";
import { resetRateLimitsForTesting } from "@/lib/rate-limit";
import { flushBackgroundTasks } from "@/lib/background";

const HOUR = 3600_000;

describe("iCalendar output (pure)", () => {
  it("formats UTC times and escapes text", () => {
    expect(icsDate(new Date("2026-10-27T15:30:05.123Z"))).toBe("20261027T153005Z");
    expect(escapeIcsText("a;b,c\\d\nline")).toBe("a\\;b\\,c\\\\d\\nline");
  });
  it("folds long lines at 75 octets without splitting multi-byte characters", () => {
    const line = `DESCRIPTION:${"é".repeat(80)}`;
    const folded = foldLine(line).split("\r\n");
    for (const part of folded) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.slice(1).every((p) => p.startsWith(" "))).toBe(true);
    expect(folded.map((p, i) => (i ? p.slice(1) : p)).join("")).toBe(line);
  });
  it("produces a valid single-event calendar with CRLF lines", () => {
    const ics = buildIcs({ uid: "abc@peerly", sequence: 2, start: new Date("2026-11-02T09:00:00+05:00"), durationMinutes: 90, summary: "Peerly: Recursion, part 2", description: "Line one\nLine two", url: "https://peerly.app/x", stamp: new Date("2026-10-26T00:00:00Z") });
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/\n/);
    const lines = ics.split("\r\n");
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("VERSION:2.0");
    expect(lines).toContain("DTSTART:20261102T040000Z");
    expect(lines).toContain("DTEND:20261102T053000Z");
    expect(lines).toContain("SEQUENCE:2");
    expect(lines).toContain("SUMMARY:Peerly: Recursion\\, part 2");
    expect(lines).toContain("DESCRIPTION:Line one\\nLine two");
    expect(lines.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(1);
    expect(lines.at(-2)).toBe("END:VCALENDAR");
  });
});

describe("sessions, upvotes and public helper pages (MongoDB integration)", () => {
  let server: MongoMemoryServer;
  let learner: any, helper: any, stranger: any;
  let requestId: string;

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    process.env.MONGODB_URI = server.getUri();
    await mongoose.connect(server.getUri());
    await ensureDatabaseIndexes();
  });
  afterAll(async () => { await mongoose.disconnect(); await server.stop(); });
  beforeEach(async () => {
    vi.restoreAllMocks();
    await resetRateLimitsForTesting();
    await Promise.all([User.deleteMany({}), StudyRequest.deleteMany({}), Resource.deleteMany({}), ResourceVote.deleteMany({}), Notification.deleteMany({})]);
    const base = { role: "student" as const, isProfileComplete: true, mode: "both" as const, availability: "Evenings", university: "FAST", subjects: ["CS"], topics: ["Recursion"] };
    learner = await User.create({ ...base, googleId: "l", email: "laila@uni.edu", name: "Laila Learner" });
    helper = await User.create({ ...base, googleId: "h", email: "hamza@uni.edu", name: "Hamza Helper", courseCodes: ["CS-101"], contact: { whatsapp: "+923004445556", preferredMethod: "whatsapp" } });
    stranger = await User.create({ ...base, googleId: "s", email: "omar@uni.edu", name: "Omar" });
    const req = await StudyRequest.create({ learner: learner._id, peer: helper._id, topic: "Recursion", normalizedTopic: "recursion", problemDescription: "Base case keeps getting skipped somehow.", mode: "online", status: "ACCEPTED", respondedAt: new Date() });
    requestId = String(req._id);
  });
  const as = (user: any) => vi.spyOn(authGuards, "requireAuth").mockResolvedValue({ user, session: {} as any, isAdmin: false });
  const signedOut = () => vi.spyOn(authGuards, "requireAuth").mockRejectedValue(new authGuards.UnauthorizedError());
  const inHours = (h: number) => new Date(Date.now() + h * HOUR).toISOString();

  describe("scheduling", () => {
    it("lets one participant propose and the other choose; notifies each side", async () => {
      as(learner);
      const slots = [inHours(30), inHours(5), inHours(50)];
      const proposed = await proposeSessionTimesAction({ requestId, slots, durationMinutes: 90 });
      expect(proposed.success).toBe(true);
      expect(proposed.data?.slots).toEqual([...slots].sort());
      // The proposer cannot pick their own suggestion.
      expect((await chooseSessionTimeAction({ requestId, slot: slots[1] })).success).toBe(false);
      as(helper);
      expect((await chooseSessionTimeAction({ requestId, slot: inHours(7) })).success).toBe(false);
      const chosen = await chooseSessionTimeAction({ requestId, slot: slots[1] });
      expect(chosen).toMatchObject({ success: true, data: { scheduledAt: new Date(slots[1]).toISOString() } });
      expect((await chooseSessionTimeAction({ requestId, slot: slots[0] })).success).toBe(false);
      const doc = await StudyRequest.findById(requestId).lean();
      expect(doc).toMatchObject({ sessionDurationMinutes: 90, scheduleSequence: 1, proposedSlots: [] });
      await flushBackgroundTasks();
      const notes = await Notification.find({}).sort({ createdAt: 1 }).lean();
      expect(notes.map((n) => [n.type, String(n.recipient) === String(helper._id) ? "helper" : "learner", n.tab])).toEqual([
        ["SESSION_PROPOSED", "helper", "incoming"],
        ["SESSION_SCHEDULED", "learner", "outgoing"],
      ]);
    });

    it("validates proposals", async () => {
      as(learner);
      for (const bad of [[], [inHours(1), inHours(2), inHours(3), inHours(4)], [new Date(Date.now() - HOUR).toISOString()], [inHours(24 * 70)], ["tomorrow"], [inHours(3), inHours(3)], ["2026-12-01T10:00"]]) {
        expect((await proposeSessionTimesAction({ requestId, slots: bad, durationMinutes: 60 })).success).toBe(false);
      }
      expect((await proposeSessionTimesAction({ requestId, slots: [inHours(3)], durationMinutes: 17 })).success).toBe(false);
    });

    it("blocks non-participants and non-accepted requests", async () => {
      as(stranger);
      expect((await proposeSessionTimesAction({ requestId, slots: [inHours(3)] })).success).toBe(false);
      expect((await getMeetingLinkAction(requestId)).success).toBe(false);
      await StudyRequest.updateOne({ _id: requestId }, { $set: { status: "PENDING" } });
      as(learner);
      expect((await proposeSessionTimesAction({ requestId, slots: [inHours(3)] })).success).toBe(false);
      expect((await getMeetingLinkAction(requestId)).success).toBe(false);
      signedOut();
      expect((await proposeSessionTimesAction({ requestId, slots: [inHours(3)] })).success).toBe(false);
    });

    it("lets only one of two concurrent picks win", async () => {
      as(learner);
      const slots = [inHours(4), inHours(8)];
      await proposeSessionTimesAction({ requestId, slots });
      as(helper);
      const results = await Promise.all(slots.map((slot) => chooseSessionTimeAction({ requestId, slot })));
      expect(results.filter((r) => r.success)).toHaveLength(1);
      expect((await StudyRequest.findById(requestId).lean())?.scheduleSequence).toBe(1);
    });

    it("re-proposing clears the agreed time and bumps the calendar sequence on the next pick", async () => {
      as(learner); await proposeSessionTimesAction({ requestId, slots: [inHours(4)] });
      const first = (await StudyRequest.findById(requestId).lean())!.proposedSlots![0].toISOString();
      as(helper); await chooseSessionTimeAction({ requestId, slot: first });
      as(helper); await proposeSessionTimesAction({ requestId, slots: [inHours(9)] });
      expect((await StudyRequest.findById(requestId).lean())?.scheduledAt).toBeNull();
      as(learner);
      const slot = (await StudyRequest.findById(requestId).lean())!.proposedSlots![0].toISOString();
      await chooseSessionTimeAction({ requestId, slot });
      expect((await StudyRequest.findById(requestId).lean())?.scheduleSequence).toBe(2);
    });
  });

  describe("calendar file", () => {
    async function schedule() {
      as(learner); await proposeSessionTimesAction({ requestId, slots: [inHours(26)], durationMinutes: 45 });
      const slot = (await StudyRequest.findById(requestId).lean())!.proposedSlots![0].toISOString();
      as(helper); await chooseSessionTimeAction({ requestId, slot });
      return slot;
    }
    const call = (id: string) => getIcs(new Request(`http://localhost/api/requests/${id}/ics`), { params: Promise.resolve({ id }) });

    it("serves an RFC 5545 file to participants in UTC", async () => {
      const slot = await schedule();
      as(learner); await getMeetingLinkAction(requestId);
      const res = await call(requestId);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
      expect(res.headers.get("cache-control")).toContain("no-store");
      const body = await res.text();
      expect(body).toContain(`DTSTART:${icsDate(new Date(slot))}`);
      expect(body).toContain(`DTEND:${icsDate(new Date(new Date(slot).getTime() + 45 * 60_000))}`);
      expect(body).toContain(`UID:${requestId}@peerly`);
      expect(body).toContain("SEQUENCE:1");
      expect(body.replace(/\r\n /g, "")).toMatch(/meet\.jit\.si\/peerly-[a-f0-9]{32}/);
      for (const secret of ["+923004445556", "hamza@uni.edu", "laila@uni.edu", "Base case keeps"]) expect(body.replace(/\r\n /g, "")).not.toContain(secret);
    });

    it("returns 404 to non-participants and unscheduled requests, 401 when signed out", async () => {
      as(learner);
      expect((await call(requestId)).status).toBe(404);
      await schedule();
      as(stranger);
      expect((await call(requestId)).status).toBe(404);
      expect(await buildSessionCalendar(stranger._id, requestId)).toBeNull();
      expect((await call("not-an-id")).status).toBe(404);
      signedOut();
      expect((await call(requestId)).status).toBe(401);
    });
  });

  describe("video call link", () => {
    it("creates one unguessable room that both participants share", async () => {
      as(learner);
      const a = await getMeetingLinkAction(requestId);
      as(helper);
      const [b, c] = await Promise.all([getMeetingLinkAction(requestId), getMeetingLinkAction(requestId)]);
      expect(a.data?.url).toMatch(/^https:\/\/meet\.jit\.si\/peerly-[a-f0-9]{32}$/);
      expect(b.data?.url).toBe(a.data?.url);
      expect(c.data?.url).toBe(a.data?.url);
      const room = (await StudyRequest.findById(requestId).select("+meetingRoom").lean())?.meetingRoom;
      expect(room).toMatch(MEETING_ROOM_PATTERN);
      // Other requests get different rooms.
      const other = await StudyRequest.create({ learner: learner._id, peer: helper._id, topic: "Graphs", normalizedTopic: "graphs", problemDescription: "BFS vs DFS when exactly?", mode: "online", status: "ACCEPTED" });
      expect((await getMeetingLinkAction(String(other._id))).data?.url).not.toBe(a.data?.url);
    });

    it("shows the link only on the participants' dashboards", async () => {
      as(learner);
      const { data } = await getMeetingLinkAction(requestId);
      const learnerView = await getDashboardRequests();
      expect(learnerView.outgoing.items[0].session.meetingUrl).toBe(data?.url);
      as(stranger);
      expect(JSON.stringify(await getDashboardRequests())).not.toContain("meet.jit.si");
      // Not exposed anywhere public by default.
      expect(Object.keys((await StudyRequest.findById(requestId).lean())!)).not.toContain("meetingRoom");
    });
  });

  describe("resource upvotes", () => {
    let resourceId: string;
    beforeEach(async () => {
      const r = await Resource.create({ owner: helper._id, title: "Recursion notes", description: "Stack diagrams for recursion.", topic: "Recursion", normalizedTopic: "recursion", url: "https://example.org/a" });
      resourceId = String(r._id);
      await Resource.create({ owner: helper._id, title: "Newer but unvoted", description: "Graph traversal cheat sheet.", topic: "Graphs", normalizedTopic: "graphs", url: "https://example.org/b" });
    });

    it("counts one vote per member, never the owner's, and can be undone", async () => {
      as(learner);
      expect(await setResourceUpvote({ resourceId, upvote: true })).toMatchObject({ success: true, count: 1 });
      expect(await setResourceUpvote({ resourceId, upvote: true })).toMatchObject({ success: true, count: 1 });
      as(helper);
      expect((await setResourceUpvote({ resourceId, upvote: true })).success).toBe(false);
      as(stranger);
      expect((await setResourceUpvote({ resourceId, upvote: true })).count).toBe(2);
      expect((await setResourceUpvote({ resourceId, upvote: false })).count).toBe(1);
      expect((await setResourceUpvote({ resourceId, upvote: false })).count).toBe(1);
      signedOut();
      expect((await setResourceUpvote({ resourceId, upvote: true })).success).toBe(false);
    });

    it("stays consistent under concurrent votes", async () => {
      as(learner);
      await Promise.all(Array.from({ length: 6 }, () => setResourceUpvote({ resourceId, upvote: true })));
      as(stranger);
      await Promise.all(Array.from({ length: 6 }, (_, i) => setResourceUpvote({ resourceId, upvote: i % 2 === 0 })));
      const votes = await ResourceVote.countDocuments({ resource: resourceId });
      expect((await Resource.findById(resourceId).lean())?.upvoteCount).toBe(votes);
    });

    it("refuses votes on hidden resources and sorts by most helpful", async () => {
      as(learner);
      await setResourceUpvote({ resourceId, upvote: true });
      const helpful = await queryResources({ sort: "helpful", viewerId: String(learner._id) });
      if (helpful.state !== "success") throw new Error(helpful.state);
      expect(helpful.resources.map((r) => [r.title, r.upvoteCount, r.viewerUpvoted])).toEqual([["Recursion notes", 1, true], ["Newer but unvoted", 0, false]]);
      const newest = await queryResources({});
      if (newest.state !== "success") throw new Error(newest.state);
      expect(newest.resources[0].title).toBe("Newer but unvoted");
      await Resource.updateOne({ _id: resourceId }, { $set: { "moderation.isHidden": true } });
      as(stranger);
      expect((await setResourceUpvote({ resourceId, upvote: true })).success).toBe(false);
    });
  });

  describe("public helper page", () => {
    it("is off by default and 404s until enabled", async () => {
      expect((await User.findById(helper._id).lean())?.publicPageEnabled).toBe(false);
      as(helper);
      const on = await setPublicPageAction(true);
      expect(on.success).toBe(true);
      expect(on.slug).toMatch(/^hamza-helper-[a-f0-9]{6}$/);
      expect(await getPublicHelperPage(on.slug)).not.toBeNull();
      const off = await setPublicPageAction(false);
      expect(off.slug).toBe(on.slug);
      expect(await getPublicHelperPage(on.slug)).toBeNull();
      expect((await setPublicPageAction(true)).slug).toBe(on.slug);
      await User.updateOne({ _id: helper._id }, { $set: { "moderation.isHidden": true } });
      expect(await getPublicHelperPage(on.slug)).toBeNull();
      expect(await getPublicHelperPage("../etc")).toBeNull();
    });

    it("shows only real, derived stats and never contact details", async () => {
      await StudyRequest.create([
        { learner: learner._id, peer: helper._id, topic: "A", normalizedTopic: "a", problemDescription: "Secret problem text alpha.", mode: "online", status: "REVIEWED", review: { rating: 4, comment: "Private-ish comment" } },
        { learner: stranger._id, peer: helper._id, topic: "B", normalizedTopic: "b", problemDescription: "Secret problem text beta.", mode: "online", status: "COMPLETED" },
        { learner: stranger._id, peer: helper._id, topic: "C", normalizedTopic: "c", problemDescription: "Secret problem text gamma.", mode: "online", status: "REJECTED" },
      ]);
      await User.updateOne({ _id: helper._id }, { $set: { universityEmail: "hamza@nu.edu.pk", universityEmailVerifiedAt: new Date(), verifiedUniversityName: "FAST-NU", reviewCount: 99, averageRating: 5 } });
      as(helper);
      const { slug } = await setPublicPageAction(true);
      const page = await getPublicHelperPage(slug);
      expect(page).toMatchObject({ name: "Hamza Helper", completedSessions: 2, reviewCount: 1, averageRating: 4, verifiedUniversityName: "FAST-NU", courseCodes: ["CS-101"] });
      const text = JSON.stringify(page);
      for (const secret of ["+923004445556", "hamza@uni.edu", "hamza@nu.edu.pk", "Secret problem", "Private-ish", "whatsapp"]) expect(text).not.toContain(secret);
    });

    it("requires a complete profile and sign-in", async () => {
      await User.updateOne({ _id: stranger._id }, { $set: { isProfileComplete: false } });
      as(await User.findById(stranger._id));
      expect((await setPublicPageAction(true)).success).toBe(false);
      signedOut();
      expect((await setPublicPageAction(true)).success).toBe(false);
    });
  });
});
