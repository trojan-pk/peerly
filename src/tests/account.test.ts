import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { User } from "@/models/User";
import { StudyRequest } from "@/models/StudyRequest";
import { Resource } from "@/models/Resource";
import { ResourceVote } from "@/models/ResourceVote";
import { Notification } from "@/models/Notification";
import { Report } from "@/models/Report";
import { EmailVerification, University } from "@/models/Course";
import { deleteAccount, exportAccountData, DELETED_USER_NAME, REMOVED_PROBLEM_TEXT } from "@/lib/account";
import { deleteMyAccountAction } from "@/app/actions/account";
import { GET as exportRoute } from "@/app/api/account/export/route";
import { getDashboardRequests, getPublicPeerReviews } from "@/lib/study-requests";
import { getPeerRatingStats } from "@/lib/peer-reviews";
import { buildCsp } from "@/lib/csp";
import * as authGuards from "@/lib/auth-guards";
import { ensureDatabaseIndexes } from "@/lib/db";
import { resetRateLimitsForTesting } from "@/lib/rate-limit";

vi.mock("@/auth", async (orig) => ({ ...(await orig<typeof import("@/auth")>()), signOut: vi.fn().mockResolvedValue(undefined) }));

describe("content security policy", () => {
  it("allows only nonce-bearing inline scripts in production", () => {
    const csp = buildCsp("abc123");
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).not.toContain("unsafe-eval");
    for (const d of ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "default-src 'self'"]) expect(csp).toContain(d);
    expect(csp).not.toContain("upgrade-insecure-requests");
    expect(buildCsp("x", { https: true })).toContain("upgrade-insecure-requests");
    expect(buildCsp("x", { dev: true })).toContain("'unsafe-eval'");
  });
});

describe("account export and deletion (MongoDB integration)", () => {
  let server: MongoMemoryServer;
  let me: any, helper: any, learner: any;

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
    await Promise.all([User, StudyRequest, Resource, ResourceVote, Notification, Report, EmailVerification, University].map((m) => (m as unknown as mongoose.Model<unknown>).deleteMany({})));
    const base = { role: "student" as const, isProfileComplete: true, mode: "both" as const, availability: "Evenings", university: "FAST", subjects: ["CS"], topics: ["Recursion"] };
    me = await User.create({ ...base, googleId: "me", email: "mina@uni.edu", name: "Mina Me", contact: { whatsapp: "+923007778889", preferredMethod: "whatsapp" }, universityEmail: "mina@nu.edu.pk", universityEmailVerifiedAt: new Date(), verifiedUniversityName: "FAST-NU" });
    helper = await User.create({ ...base, googleId: "h", email: "hamza@uni.edu", name: "Hamza Helper", contact: { whatsapp: "+923001112223", preferredMethod: "whatsapp" } });
    learner = await User.create({ ...base, googleId: "l", email: "laila@uni.edu", name: "Laila Learner" });
    const common = { mode: "online" as const, problemDescription: "My secret problem description text." };
    await StudyRequest.create([
      { ...common, learner: me._id, peer: helper._id, topic: "Reviewed", normalizedTopic: "reviewed", status: "REVIEWED" as const, review: { rating: 4, comment: "Mina's private comment" } },
      { ...common, learner: me._id, peer: helper._id, topic: "Pending", normalizedTopic: "pending", status: "PENDING" as const },
      { ...common, learner: learner._id, peer: me._id, topic: "Helping", normalizedTopic: "helping", status: "ACCEPTED" as const, problemDescription: "Laila's own question text." },
      { ...common, learner: learner._id, peer: helper._id, topic: "Unrelated", normalizedTopic: "unrelated", status: "REVIEWED" as const, review: { rating: 2, comment: "keep me" } },
    ]);
    const mine = await Resource.create({ owner: me._id, title: "Mina notes", description: "Notes written by Mina.", topic: "Recursion", normalizedTopic: "recursion", url: "https://example.org/m", upvoteCount: 1 });
    const theirs = await Resource.create({ owner: helper._id, title: "Hamza notes", description: "Notes written by Hamza.", topic: "Recursion", normalizedTopic: "recursion", url: "https://example.org/h", upvoteCount: 1 });
    await ResourceVote.create([{ user: learner._id, resource: mine._id }, { user: me._id, resource: theirs._id }]);
    await Notification.create({ recipient: me._id, type: "REQUEST_ACCEPTED", request: new mongoose.Types.ObjectId(), topic: "Reviewed", eventKey: "k1" });
    await Report.create({ targetType: "user", targetId: String(helper._id), reporter: me._id, reason: "spam", explanation: "Mina's report text here." }).catch(async () => {
      await Report.collection.insertOne({ targetType: "user", targetId: String(helper._id), reporter: me._id, reason: "spam", explanation: "Mina's report text here.", status: "OPEN", createdAt: new Date() });
    });
    await EmailVerification.create({ user: me._id, university: new mongoose.Types.ObjectId(), email: "mina@nu.edu.pk", codeHash: "a".repeat(64), salt: "b", expiresAt: new Date(Date.now() + 60_000) });
  });
  const as = (user: any) => vi.spyOn(authGuards, "requireAuth").mockResolvedValue({ user, session: {} as any, isAdmin: false });

  it("exports the caller's own data, including private fields, but not other people's", async () => {
    const data = (await exportAccountData(me._id))!;
    expect(data.profile).toMatchObject({ email: "mina@uni.edu", universityEmail: "mina@nu.edu.pk", contact: { whatsapp: "+923007778889" } });
    expect(data.requests.map((r) => [r.topic, r.role, r.otherPerson]).sort()).toEqual([["Helping", "helper", "Laila"], ["Pending", "learner", "Hamza"], ["Reviewed", "learner", "Hamza"]]);
    expect(data.resources.map((r) => r.title)).toEqual(["Mina notes"]);
    expect(data.helpfulVotes.map((v) => v.resource)).toEqual(["Hamza notes"]);
    expect(data.notifications).toHaveLength(1);
    expect(data.reportsFiled).toHaveLength(1);
    const text = JSON.stringify(data);
    for (const other of ["+923001112223", "hamza@uni.edu", "laila@uni.edu", "keep me", "Unrelated"]) expect(text).not.toContain(other);
  });

  it("serves the export only to the signed-in user, as a JSON download", async () => {
    vi.spyOn(authGuards, "requireAuth").mockRejectedValue(new authGuards.UnauthorizedError());
    expect((await exportRoute()).status).toBe(401);
    as(me);
    const res = await exportRoute();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toMatch(/attachment; filename="peerly-data-/);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect((await res.json()).profile.id).toBe(String(me._id));
  });

  it("requires a typed confirmation and only deletes the caller", async () => {
    as(me);
    expect((await deleteMyAccountAction("delete")).success).toBe(false);
    expect((await deleteMyAccountAction({ userId: String(helper._id) })).success).toBe(false);
    expect(await User.countDocuments()).toBe(3);
    expect(await deleteMyAccountAction("DELETE")).toMatchObject({ success: true });
    expect(await User.exists({ _id: me._id })).toBeNull();
    expect(await User.countDocuments({ _id: { $in: [helper._id, learner._id] } })).toBe(2);
    vi.spyOn(authGuards, "requireAuth").mockRejectedValue(new authGuards.UnauthorizedError());
    expect((await deleteMyAccountAction("DELETE")).success).toBe(false);
  });

  it("leaves no personal data behind", async () => {
    await deleteAccount(me._id);
    const id = me._id;
    expect(await Resource.countDocuments({ owner: id })).toBe(0);
    expect(await ResourceVote.countDocuments({ $or: [{ user: id }] })).toBe(0);
    expect(await Notification.countDocuments({ recipient: id })).toBe(0);
    expect(await Report.countDocuments({ reporter: id })).toBe(0);
    expect(await EmailVerification.countDocuments({ user: id })).toBe(0);
    const remaining = JSON.stringify(await Promise.all([StudyRequest.find({}).lean(), Resource.find({}).lean(), User.find({}).select("+contact +universityEmail").lean()]));
    for (const secret of ["mina@uni.edu", "mina@nu.edu.pk", "+923007778889", "Mina's private comment", "Mina notes", "Mina Me"]) expect(remaining).not.toContain(secret);
    expect(await StudyRequest.countDocuments({ learner: id, problemDescription: { $ne: REMOVED_PROBLEM_TEXT } })).toBe(0);
    // The vote Mina cast is removed from the other resource's count.
    expect((await Resource.findOne({ title: "Hamza notes" }).lean())?.upvoteCount).toBe(0);
  });

  it("keeps counterparts' history intact and their review aggregates unchanged", async () => {
    const before = await getPeerRatingStats(helper._id);
    await deleteAccount(me._id);
    expect(await getPeerRatingStats(helper._id)).toEqual(before);
    as(helper);
    const helperView = await getDashboardRequests(1, 1, 10);
    const reviewed = helperView.incoming.items.find((r) => r.topic === "Reviewed")!;
    expect(reviewed).toMatchObject({ status: "REVIEWED" as const, learner: { name: DELETED_USER_NAME }, review: { rating: 4, comment: "" } });
    expect(helperView.incoming.items.find((r) => r.topic === "Pending")?.status).toBe("CANCELLED");
    as(learner);
    const learnerView = await getDashboardRequests(1, 1, 10);
    const helping = learnerView.outgoing.items.find((r) => r.topic === "Helping")!;
    expect(helping).toMatchObject({ status: "CANCELLED", peer: { name: DELETED_USER_NAME }, problemDescription: "Laila's own question text.", unlockedContact: null });
    expect(learnerView.outgoing.items.find((r) => r.topic === "Unrelated")?.review?.comment).toBe("keep me");
    const reviews = await getPublicPeerReviews(String(helper._id));
    expect(reviews.reviews.map((r) => r.learnerName)).toContain(DELETED_USER_NAME);
  });

  it("is idempotent", async () => {
    expect(await deleteAccount(me._id)).toEqual({ deleted: true });
    expect(await deleteAccount(me._id)).toEqual({ deleted: false });
  });
});
