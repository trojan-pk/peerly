import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { User } from "@/models/User";
import { StudyRequest } from "@/models/StudyRequest";
import { searchWorkspace } from "@/app/actions/palette";
import * as authGuards from "@/lib/auth-guards";
import { ensureDatabaseIndexes } from "@/lib/db";
import { resetRateLimitsForTesting } from "@/lib/rate-limit";

describe("command palette search (MongoDB integration)", () => {
  let server: MongoMemoryServer;
  let me: any;
  let helper: any;
  let stranger: any;

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
    await Promise.all([User.deleteMany({}), StudyRequest.deleteMany({})]);
    const base = { role: "student" as const, isProfileComplete: true, mode: "both" as const, availability: "Evenings", subjects: ["Computer Science"] };
    me = await User.create({ ...base, googleId: "me", email: "me@uni.edu", name: "Mina Me", topics: ["Calculus"] });
    helper = await User.create({ ...base, googleId: "h", email: "sara@uni.edu", name: "Sara Khan", university: "FAST", topics: ["Recursion", "Graphs"], contact: { whatsapp: "+923009998887", preferredMethod: "whatsapp" } });
    stranger = await User.create({ ...base, googleId: "s", email: "omar@uni.edu", name: "Omar", topics: ["Recursion basics"] });
    await User.create({ ...base, googleId: "hidden", email: "x@uni.edu", name: "Hidden Recursion Fan", topics: ["Recursion"], moderation: { isHidden: true } });
    await StudyRequest.create({ learner: me._id, peer: helper._id, topic: "Recursion in C++", normalizedTopic: "recursion in c++", problemDescription: "Stack overflow in my merge sort implementation.", mode: "online", status: "ACCEPTED" });
    await StudyRequest.create({ learner: stranger._id, peer: helper._id, topic: "Recursion secrets", normalizedTopic: "recursion secrets", problemDescription: "Someone else's private recursion question.", mode: "online" });
  });
  const as = (user: any) => vi.spyOn(authGuards, "requireAuth").mockResolvedValue({ user, session: {} as any, isAdmin: false });

  it("returns nothing for signed-out callers or too-short queries", async () => {
    vi.spyOn(authGuards, "requireAuth").mockRejectedValue(new authGuards.UnauthorizedError());
    expect(await searchWorkspace("recursion")).toEqual({ peers: [], topics: [], requests: [] });
    as(me);
    expect(await searchWorkspace("r")).toEqual({ peers: [], topics: [], requests: [] });
    expect(await searchWorkspace({ $ne: 1 })).toEqual({ peers: [], topics: [], requests: [] });
  });

  it("finds discoverable peers, topics and only the caller's own requests", async () => {
    as(me);
    const results = await searchWorkspace("recur");
    expect(results.peers.map((p) => p.name).sort()).toEqual(["Omar", "Sara Khan"]);
    expect(results.topics).toEqual(["Recursion", "Recursion basics"]);
    expect(results.requests).toEqual([expect.objectContaining({ topic: "Recursion in C++", status: "ACCEPTED", tab: "outgoing", other: "Sara Khan" })]);
  });

  it("never returns contact details or emails", async () => {
    as(me);
    const text = JSON.stringify(await searchWorkspace("sara"));
    expect(text).toContain("Sara Khan");
    for (const secret of ["+923009998887", "sara@uni.edu", "whatsapp"]) expect(text).not.toContain(secret);
  });

  it("treats regex characters literally", async () => {
    as(me);
    expect(await searchWorkspace(".*")).toEqual({ peers: [], topics: [], requests: [] });
    const cpp = await searchWorkspace("c++");
    expect(cpp.requests.map((r) => r.topic)).toEqual(["Recursion in C++"]);
  });

  it("shows requests from the helper's side on the incoming tab", async () => {
    as(helper);
    const { requests } = await searchWorkspace("recursion");
    expect(requests.map((r) => [r.topic, r.tab]).sort()).toEqual([["Recursion in C++", "incoming"], ["Recursion secrets", "incoming"]]);
  });
});
