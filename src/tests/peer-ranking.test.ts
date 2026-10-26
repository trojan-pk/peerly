import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { User, toPublicProfile } from "@/models/User";
import { StudyRequest } from "@/models/StudyRequest";
import { queryPeers, type PeerSearchParams } from "@/lib/peers";
import { calculatePeerMatchScore } from "@/lib/peer-matching";
import { getPeerRatingStatsBatch } from "@/lib/peer-reviews";
import { getPeerResponseStatsBatch } from "@/lib/peer-responses";
import { ensureDatabaseIndexes } from "@/lib/db";

/** Deterministic pseudo-random generator so failures are reproducible. */
function rng(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) % 2 ** 32; return seed / 2 ** 32; };
}

/**
 * Reference implementation: the previous in-memory ranking (load every candidate, score
 * with calculatePeerMatchScore, sort with the documented tie-breakers).
 */
async function expectedOrder(params: PeerSearchParams): Promise<string[]> {
  const result = await queryPeers({ ...params, page: 1 });
  if (result.state !== "success") return [];
  const all: string[] = [];
  for (let page = 1; page <= result.pagination.totalPages; page++) {
    const r = await queryPeers({ ...params, page });
    if (r.state === "success") all.push(...r.peers.map((p) => p.id));
  }
  void all;
  // Build the oracle independently of queryPeers' ranking.
  const users = await User.find({ isProfileComplete: true, "moderation.isHidden": { $ne: true }, _id: { $in: all.map((id) => new mongoose.Types.ObjectId(id)) } }).lean();
  const ids = users.map((u) => u._id);
  const [ratings, responses] = await Promise.all([getPeerRatingStatsBatch(ids), getPeerResponseStatsBatch(ids)]);
  const scored = users.map((u) => {
    const profile = toPublicProfile(u);
    const rating = ratings.get(String(u._id)) ?? { reviewCount: 0, averageRating: 0 };
    const response = responses.get(String(u._id)) ?? { hasFastReplyBadge: false };
    const { totalScore } = calculatePeerMatchScore(
      { topics: profile.topics, subjects: profile.subjects, mode: profile.mode, averageRating: rating.averageRating, reviewCount: rating.reviewCount, hasFastReplyBadge: response.hasFastReplyBadge, courses: (u.courses ?? []).map(String), courseCodes: profile.courseCodes },
      { q: params.q, topic: params.topic, subject: params.subject, mode: params.mode, course: params.course }
    );
    return { id: String(u._id), score: totalScore, rating: rating.averageRating, reviews: rating.reviewCount, created: new Date(u.createdAt).getTime() };
  });
  scored.sort((a, b) => b.score - a.score || b.rating - a.rating || b.reviews - a.reviews || b.created - a.created || b.id.localeCompare(a.id));
  return scored.map((s) => s.id);
}

async function rankedOrder(params: PeerSearchParams): Promise<string[]> {
  const first = await queryPeers({ ...params, page: 1 });
  if (first.state !== "success") return [];
  const ids = first.peers.map((p) => p.id);
  for (let page = 2; page <= first.pagination.totalPages; page++) {
    const r = await queryPeers({ ...params, page });
    if (r.state === "success") ids.push(...r.peers.map((p) => p.id));
  }
  return ids;
}

describe("database-side peer ranking", () => {
  let server: MongoMemoryServer;
  const TOPICS = ["Recursion", "Graphs", "Linear Algebra", "Organic  Chemistry", "recursion", "Data Structures"];
  const SUBJECTS = ["Computer Science", "Mathematics", "Chemistry"];

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    process.env.MONGODB_URI = server.getUri();
    await mongoose.connect(server.getUri());
    await ensureDatabaseIndexes();
    const rand = rng(42);
    const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)];
    const course = new mongoose.Types.ObjectId();
    const base = Date.UTC(2026, 0, 1);
    const users = Array.from({ length: 150 }, (_, i) => ({
      googleId: `g${i}`, email: `u${i}@uni.edu`, name: `User ${i}`, role: "student", isProfileComplete: i % 17 !== 0,
      availability: "Any", university: "FAST", mode: pick(["online", "campus", "both"]), pricingPreference: "free",
      topics: [pick(TOPICS), ...(rand() < 0.4 ? [pick(TOPICS)] : [])], subjects: [pick(SUBJECTS)],
      courses: rand() < 0.2 ? [course] : [], courseCodes: rand() < 0.25 ? ["CS-101"] : [],
      // Several users share timestamps to exercise the _id tie-breaker.
      createdAt: new Date(base + Math.floor(i / 3) * 3600_000), updatedAt: new Date(base),
      moderation: { isHidden: i % 23 === 0 },
    }));
    const inserted = await User.collection.insertMany(users);
    const ids = Object.values(inserted.insertedIds);
    const requests = [];
    const learner = new mongoose.Types.ObjectId();
    for (const peer of ids) {
      const n = Math.floor(rand() * 6);
      for (let k = 0; k < n; k++) {
        const created = new Date(base + Math.floor(rand() * 1000) * 60_000);
        const status = pick(["REVIEWED", "REVIEWED", "COMPLETED", "ACCEPTED", "REJECTED", "CANCELLED", "PENDING", "EXPIRED"]);
        const responded = ["CANCELLED", "PENDING", "EXPIRED"].includes(status) ? null : new Date(created.getTime() + Math.floor(rand() * 5 * 3600_000));
        requests.push({
          learner, peer, topic: `t${k}`, normalizedTopic: `t${k}-${String(peer)}`, problemDescription: "A sufficiently long problem description.", mode: "online",
          status, respondedAt: responded, createdAt: created, updatedAt: created,
          ...(status === "REVIEWED" ? { review: { rating: 1 + Math.floor(rand() * 5), comment: "" } } : {}),
        });
      }
    }
    // Ratings that land exactly on .x5 boundaries test rounding parity.
    requests.push({ learner, peer: ids[1], topic: "r1", normalizedTopic: "r1", problemDescription: "A sufficiently long problem description.", mode: "online", status: "REVIEWED", review: { rating: 4 }, createdAt: new Date(base), updatedAt: new Date(base) });
    await StudyRequest.collection.insertMany(requests);
    (globalThis as { __course?: string }).__course = String(course);
  }, 120_000);
  afterAll(async () => { await mongoose.disconnect(); await server.stop(); });

  const cases: PeerSearchParams[] = [
    { topic: "recursion" },
    { q: "recursion" },
    { q: "organic  CHEMISTRY " },
    { subject: "Mathematics" },
    { q: "cs 101" },
    { topic: "Graphs", mode: "online" },
    { q: "user", mode: "campus" },
    { q: "user", mode: "both" },
  ];

  it.each(cases)("matches the in-memory reference ranking for %o", async (params) => {
    const actual = await rankedOrder(params);
    expect(actual.length).toBeGreaterThan(0);
    expect(actual).toEqual(await expectedOrder(params));
  });

  it("matches the reference ranking for a course filter", async () => {
    const course = (globalThis as { __course?: string }).__course!;
    const actual = await rankedOrder({ course, q: "user" });
    expect(actual.length).toBeGreaterThan(0);
    expect(actual).toEqual(await expectedOrder({ course, q: "user" }));
  });

  it("returns consistent, non-overlapping pages", async () => {
    const ids = await rankedOrder({ q: "user" });
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("ranking memory stays bounded", () => {
  let server: MongoMemoryServer;
  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    process.env.MONGODB_URI = server.getUri();
    await mongoose.connect(server.getUri());
    await ensureDatabaseIndexes();
    const base = Date.UTC(2026, 0, 1);
    await User.collection.insertMany(Array.from({ length: 5000 }, (_, i) => ({
      googleId: `b${i}`, email: `b${i}@uni.edu`, name: `Bulk ${i}`, role: "student", isProfileComplete: true, availability: "Any",
      university: "FAST", mode: "both", pricingPreference: "free", topics: [i % 2 ? "Recursion" : "Graphs"], subjects: ["CS"],
      createdAt: new Date(base + i * 1000), updatedAt: new Date(base), moderation: { isHidden: false },
    })));
  }, 120_000);
  afterAll(async () => { await mongoose.disconnect(); await server.stop(); });

  it("loads only one page of users into the application for 5,000 candidates", async () => {
    const findSpy = vi.spyOn(User, "find");
    const started = Date.now();
    const result = await queryPeers({ q: "recursion", page: 7 });
    const elapsed = Date.now() - started;
    expect(result.state).toBe("success");
    if (result.state !== "success") return;
    expect(result.pagination.totalCount).toBe(2500);
    expect(result.peers).toHaveLength(12);
    // The only User.find loads the page's ids; no full-candidate fetch.
    expect(findSpy).toHaveBeenCalledTimes(1);
    const filter = findSpy.mock.calls[0][0] as unknown as { _id: { $in: unknown[] } };
    expect(filter._id.$in).toHaveLength(12);
    console.log(`Ranked 2,500 of 5,000 candidates in ${elapsed} ms`);
    expect(elapsed).toBeLessThan(10_000);
  }, 60_000);
});
