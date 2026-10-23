import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { User } from "@/models/User";
import { StudyRequest } from "@/models/StudyRequest";
import { ensureDatabaseIndexes } from "@/lib/db";
import {
  transitionStudyRequest,
  confirmStudyRequestCompletion,
  submitStudyRequestReview,
} from "@/app/dashboard/actions";
import * as authGuards from "@/lib/auth-guards";
import { resetRateLimitsForTesting } from "@/lib/rate-limit";
import {
  getPeerResponseStats,
  getPeerResponseStatsBatch,
} from "@/lib/peer-responses";
import { calculatePeerMatchScore } from "@/lib/peer-matching";
import { queryPeers } from "@/lib/peers";

describe("Stage 2E: Fast-Reply Badges, Deterministic Matching & Global Ranking", () => {
  let mongoServer: MongoMemoryServer;
  let peerA: any;
  let peerB: any;
  let learnerA: any;
  let learnerB: any;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    process.env.MONGODB_URI = uri;
    await mongoose.connect(uri);
    await ensureDatabaseIndexes();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    await resetRateLimitsForTesting();
    await StudyRequest.deleteMany({});
    await User.deleteMany({});

    peerA = await User.create({
      googleId: "google_peer_a_id",
      email: "peer.a@university.edu",
      name: "Peer Alice",
      university: "Tech Institute",
      campus: "Main Campus",
      bio: "Computer science tutor.",
      topics: ["Data Structures", "Algorithms"],
      subjects: ["Computer Science"],
      mode: "online",
      pricingPreference: "free",
      isProfileComplete: true,
      role: "student",
    });

    peerB = await User.create({
      googleId: "google_peer_b_id",
      email: "peer.b@university.edu",
      name: "Peer Bob",
      university: "State College",
      campus: "North Campus",
      bio: "Math and Physics mentor.",
      topics: ["Calculus", "Physics"],
      subjects: ["Mathematics", "Physics"],
      mode: "both",
      pricingPreference: "both",
      isProfileComplete: true,
      role: "student",
    });

    learnerA = await User.create({
      googleId: "google_learner_a_id",
      email: "learner.a@university.edu",
      name: "Learner Abby",
      university: "Tech Institute",
      campus: "Main Campus",
      isProfileComplete: true,
      role: "student",
    });

    learnerB = await User.create({
      googleId: "google_learner_b_id",
      email: "learner.b@university.edu",
      name: "Learner Ben",
      university: "State College",
      campus: "North Campus",
      isProfileComplete: true,
      role: "student",
    });
  });

  describe("Response Timestamp Immutability & Action Transitions", () => {
    it("records respondedAt atomically when peer accepts or rejects a PENDING request", async () => {
      const now = Date.now();
      const request = await StudyRequest.create({
        learner: learnerA._id,
        peer: peerA._id,
        topic: "Data Structures",
        normalizedTopic: "data structures",
        problemDescription: "Need help with balanced AVL trees and rotations.",
        mode: "online",
        status: "PENDING",
        createdAt: new Date(now - 1000 * 60 * 30), // created 30 mins ago
      });

      expect(request.respondedAt).toBeFalsy();

      // Peer accepts request
      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: peerA,
        session: { user: { id: peerA._id.toString() } } as any,
        isAdmin: false,
      });

      const acceptRes = await transitionStudyRequest({
        requestId: request._id.toString(),
        action: "accept",
      });

      expect(acceptRes.success).toBe(true);

      const acceptedReq = await StudyRequest.findById(request._id);
      expect(acceptedReq?.status).toBe("ACCEPTED");
      expect(acceptedReq?.respondedAt).toBeInstanceOf(Date);
      const initialRespondedAt = acceptedReq!.respondedAt!.getTime();

      // Repeated action must not modify respondedAt or transition status
      const repeatRes = await transitionStudyRequest({
        requestId: request._id.toString(),
        action: "accept",
      });
      expect(repeatRes.success).toBe(false);

      const unchangedReq = await StudyRequest.findById(request._id);
      expect(unchangedReq!.respondedAt!.getTime()).toBe(initialRespondedAt);
    });

    it("ensures completion confirmations and reviews NEVER alter respondedAt", async () => {
      const createdTime = new Date("2026-10-01T10:00:00.000Z");
      const respondedTime = new Date("2026-10-01T10:45:00.000Z");

      const request = await StudyRequest.create({
        learner: learnerA._id,
        peer: peerA._id,
        topic: "Algorithms",
        normalizedTopic: "algorithms",
        problemDescription: "Graph pathfinding algorithms practice.",
        mode: "online",
        status: "ACCEPTED",
        createdAt: createdTime,
        respondedAt: respondedTime,
      });

      // Peer confirms completion
      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: peerA,
        session: { user: { id: peerA._id.toString() } } as any,
        isAdmin: false,
      });

      await confirmStudyRequestCompletion({ requestId: request._id.toString() });

      const reqAfterPeerConfirm = await StudyRequest.findById(request._id);
      expect(reqAfterPeerConfirm!.respondedAt!.toISOString()).toBe(respondedTime.toISOString());

      // Learner confirms completion
      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: learnerA,
        session: { user: { id: learnerA._id.toString() } } as any,
        isAdmin: false,
      });

      await confirmStudyRequestCompletion({ requestId: request._id.toString() });

      const reqAfterBothConfirm = await StudyRequest.findById(request._id);
      expect(reqAfterBothConfirm!.status).toBe("COMPLETED");
      expect(reqAfterBothConfirm!.respondedAt!.toISOString()).toBe(respondedTime.toISOString());

      // Learner submits review
      await submitStudyRequestReview({
        requestId: request._id.toString(),
        rating: 5,
        comment: "Outstanding explanation!",
      });

      const reqAfterReview = await StudyRequest.findById(request._id);
      expect(reqAfterReview!.status).toBe("REVIEWED");
      expect(reqAfterReview!.respondedAt!.toISOString()).toBe(respondedTime.toISOString());
    });
  });

  describe("Cancellation Exclusion & Legacy Requests", () => {
    it("excludes learner cancellations from peer response stats", async () => {
      const request = await StudyRequest.create({
        learner: learnerA._id,
        peer: peerA._id,
        topic: "Data Structures",
        normalizedTopic: "data structures",
        problemDescription: "Need help before exam.",
        mode: "online",
        status: "PENDING",
      });

      // Learner cancels
      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: learnerA,
        session: { user: { id: learnerA._id.toString() } } as any,
        isAdmin: false,
      });

      const cancelRes = await transitionStudyRequest({
        requestId: request._id.toString(),
        action: "cancel",
      });
      expect(cancelRes.success).toBe(true);

      const cancelledReq = await StudyRequest.findById(request._id);
      expect(cancelledReq?.status).toBe("CANCELLED");
      expect(cancelledReq?.respondedAt).toBeFalsy();

      // Stats derivation must exclude this cancelled request
      const stats = await getPeerResponseStats(peerA._id.toString());
      expect(stats.sampleCount).toBe(0);
      expect(stats.avgResponseTimeMs).toBeNull();
      expect(stats.hasFastReplyBadge).toBe(false);
    });

    it("excludes legacy requests missing respondedAt and does not infer from updatedAt", async () => {
      // Legacy request from older stage where respondedAt was null
      await StudyRequest.create({
        learner: learnerA._id,
        peer: peerA._id,
        topic: "Legacy Topic",
        normalizedTopic: "legacy topic",
        problemDescription: "Session from previous platform version.",
        mode: "online",
        status: "ACCEPTED",
        createdAt: new Date("2026-09-01T10:00:00.000Z"),
        updatedAt: new Date("2026-09-01T10:15:00.000Z"),
        respondedAt: null,
      });

      const stats = await getPeerResponseStats(peerA._id.toString());
      expect(stats.sampleCount).toBe(0);
      expect(stats.hasFastReplyBadge).toBe(false);
    });
  });

  describe("Fast-Reply Badge Sample Count & Threshold Boundaries", () => {
    it("requires at least 3 valid responses (insufficient samples do not earn badge)", async () => {
      const base = Date.now();
      // Peer has 2 very fast responses (10 minutes each)
      await StudyRequest.create([
        {
          learner: learnerA._id,
          peer: peerA._id,
          topic: "Topic 1",
          normalizedTopic: "topic 1",
          problemDescription: "Desc 1 with at least ten characters.",
          mode: "online",
          status: "ACCEPTED",
          createdAt: new Date(base - 1000 * 60 * 60),
          respondedAt: new Date(base - 1000 * 60 * 50), // 10 mins
        },
        {
          learner: learnerB._id,
          peer: peerA._id,
          topic: "Topic 2",
          normalizedTopic: "topic 2",
          problemDescription: "Desc 2 with at least ten characters.",
          mode: "online",
          status: "REJECTED",
          createdAt: new Date(base - 1000 * 60 * 40),
          respondedAt: new Date(base - 1000 * 60 * 30), // 10 mins
        },
      ]);

      const stats = await getPeerResponseStats(peerA._id.toString());
      expect(stats.sampleCount).toBe(2);
      expect(stats.avgResponseTimeMs).toBe(10 * 60 * 1000);
      expect(stats.hasFastReplyBadge).toBe(false); // < 3 samples: must not earn badge
    });

    it("earns badge when 3+ responses average <= 2 hours (exact 2 hour boundary)", async () => {
      const base = Date.now();
      const twoHoursMs = 2 * 60 * 60 * 1000;

      // 3 responses exactly 2 hours each
      await StudyRequest.create([
        {
          learner: learnerA._id,
          peer: peerA._id,
          topic: "Topic 1",
          normalizedTopic: "topic 1",
          problemDescription: "Problem description 1.",
          mode: "online",
          status: "ACCEPTED",
          createdAt: new Date(base - twoHoursMs),
          respondedAt: new Date(base),
        },
        {
          learner: learnerB._id,
          peer: peerA._id,
          topic: "Topic 2",
          normalizedTopic: "topic 2",
          problemDescription: "Problem description 2.",
          mode: "online",
          status: "ACCEPTED",
          createdAt: new Date(base - twoHoursMs),
          respondedAt: new Date(base),
        },
        {
          learner: learnerA._id,
          peer: peerA._id,
          topic: "Topic 3",
          normalizedTopic: "topic 3",
          problemDescription: "Problem description 3.",
          mode: "online",
          status: "REJECTED",
          createdAt: new Date(base - twoHoursMs),
          respondedAt: new Date(base),
        },
      ]);

      const stats = await getPeerResponseStats(peerA._id.toString());
      expect(stats.sampleCount).toBe(3);
      expect(stats.avgResponseTimeMs).toBe(twoHoursMs);
      expect(stats.hasFastReplyBadge).toBe(true);
    });

    it("rejects badge when 3 responses average > 2 hours", async () => {
      const base = Date.now();
      const twoHoursAndTenMinsMs = (2 * 60 + 10) * 60 * 1000;

      await StudyRequest.create([
        {
          learner: learnerA._id,
          peer: peerA._id,
          topic: "Topic 1",
          normalizedTopic: "topic 1",
          problemDescription: "Problem description 1.",
          mode: "online",
          status: "ACCEPTED",
          createdAt: new Date(base - twoHoursAndTenMinsMs),
          respondedAt: new Date(base),
        },
        {
          learner: learnerB._id,
          peer: peerA._id,
          topic: "Topic 2",
          normalizedTopic: "topic 2",
          problemDescription: "Problem description 2.",
          mode: "online",
          status: "ACCEPTED",
          createdAt: new Date(base - twoHoursAndTenMinsMs),
          respondedAt: new Date(base),
        },
        {
          learner: learnerA._id,
          peer: peerA._id,
          topic: "Topic 3",
          normalizedTopic: "topic 3",
          problemDescription: "Problem description 3.",
          mode: "online",
          status: "ACCEPTED",
          createdAt: new Date(base - twoHoursAndTenMinsMs),
          respondedAt: new Date(base),
        },
      ]);

      const stats = await getPeerResponseStats(peerA._id.toString());
      expect(stats.sampleCount).toBe(3);
      expect(stats.avgResponseTimeMs).toBeGreaterThan(2 * 60 * 60 * 1000);
      expect(stats.hasFastReplyBadge).toBe(false);
    });

    it("batch-aggregates multiple peers in a single query", async () => {
      const base = Date.now();
      await StudyRequest.create([
        {
          learner: learnerA._id,
          peer: peerA._id,
          topic: "T1",
          normalizedTopic: "t1",
          problemDescription: "Desc for peer A request.",
          mode: "online",
          status: "ACCEPTED",
          createdAt: new Date(base - 1000 * 60 * 30),
          respondedAt: new Date(base),
        },
        {
          learner: learnerB._id,
          peer: peerB._id,
          topic: "T2",
          normalizedTopic: "t2",
          problemDescription: "Desc for peer B request.",
          mode: "campus",
          status: "ACCEPTED",
          createdAt: new Date(base - 1000 * 60 * 15),
          respondedAt: new Date(base),
        },
      ]);

      const batchMap = await getPeerResponseStatsBatch([peerA._id, peerB._id]);
      expect(batchMap.has(peerA._id.toString())).toBe(true);
      expect(batchMap.has(peerB._id.toString())).toBe(true);
      expect(batchMap.get(peerA._id.toString())?.avgResponseTimeMs).toBe(30 * 60 * 1000);
      expect(batchMap.get(peerB._id.toString())?.avgResponseTimeMs).toBe(15 * 60 * 1000);
    });
  });

  describe("Deterministic Match Scoring Rules & Breakdown", () => {
    it("calculates exact normalized topic match (50 pts)", () => {
      const result = calculatePeerMatchScore(
        {
          topics: ["Linear Algebra", "Vector Calculus"],
          subjects: ["Mathematics"],
          mode: "online",
          averageRating: 0,
          reviewCount: 0,
          hasFastReplyBadge: false,
        },
        { topic: "  linear   algebra  " }
      );

      expect(result.breakdown.topicPoints).toBe(50);
      expect(result.breakdown.topicMatchReason).toBe("Exact topic match");
      expect(result.totalScore).toBe(50);
    });

    it("calculates matching normalized subject (25 pts) when topic differs", () => {
      const result = calculatePeerMatchScore(
        {
          topics: ["Number Theory"],
          subjects: ["Pure Mathematics"],
          mode: "online",
          averageRating: 0,
          reviewCount: 0,
          hasFastReplyBadge: false,
        },
        { topic: "Pure Mathematics" }
      );

      expect(result.breakdown.topicPoints).toBe(25);
      expect(result.breakdown.topicMatchReason).toBe("Matching subject");
      expect(result.totalScore).toBe(25);
    });

    it("awards 20 pts for compatible explicitly selected learning mode (including both)", () => {
      // Peer offers "both", user selected "online"
      const resOnline = calculatePeerMatchScore(
        {
          topics: [],
          subjects: [],
          mode: "both",
          averageRating: 0,
          reviewCount: 0,
          hasFastReplyBadge: false,
        },
        { mode: "online" }
      );
      expect(resOnline.breakdown.modePoints).toBe(20);

      // Peer offers "campus", user selected "online" -> 0 pts
      const resIncompatible = calculatePeerMatchScore(
        {
          topics: [],
          subjects: [],
          mode: "campus",
          averageRating: 0,
          reviewCount: 0,
          hasFastReplyBadge: false,
        },
        { mode: "online" }
      );
      expect(resIncompatible.breakdown.modePoints).toBe(0);

      // User did not filter by mode -> 0 pts
      const resNoMode = calculatePeerMatchScore(
        {
          topics: [],
          subjects: [],
          mode: "online",
          averageRating: 0,
          reviewCount: 0,
          hasFastReplyBadge: false,
        },
        {}
      );
      expect(resNoMode.breakdown.modePoints).toBe(0);
    });

    it("awards rating points proportional to authoritative 5-star rating ((rating / 5) * 20)", () => {
      // 5.0 stars = 20 pts
      const res5 = calculatePeerMatchScore(
        {
          topics: [],
          subjects: [],
          mode: "online",
          averageRating: 5.0,
          reviewCount: 4,
          hasFastReplyBadge: false,
        },
        {}
      );
      expect(res5.breakdown.ratingPoints).toBe(20);

      // 4.0 stars = 16 pts
      const res4 = calculatePeerMatchScore(
        {
          topics: [],
          subjects: [],
          mode: "online",
          averageRating: 4.0,
          reviewCount: 3,
          hasFastReplyBadge: false,
        },
        {}
      );
      expect(res4.breakdown.ratingPoints).toBe(16);

      // 0 reviews = 0 pts
      const res0 = calculatePeerMatchScore(
        {
          topics: [],
          subjects: [],
          mode: "online",
          averageRating: 0,
          reviewCount: 0,
          hasFastReplyBadge: false,
        },
        {}
      );
      expect(res0.breakdown.ratingPoints).toBe(0);
    });

    it("awards 10 pts for earned fast-reply badge and calculates complete 100/100 score", () => {
      const fullScore = calculatePeerMatchScore(
        {
          topics: ["Quantum Computing"],
          subjects: ["Physics"],
          mode: "both",
          averageRating: 5.0,
          reviewCount: 8,
          hasFastReplyBadge: true,
        },
        {
          topic: "quantum computing",
          mode: "online",
        }
      );

      expect(fullScore.breakdown.topicPoints).toBe(50);
      expect(fullScore.breakdown.modePoints).toBe(20);
      expect(fullScore.breakdown.ratingPoints).toBe(20);
      expect(fullScore.breakdown.badgePoints).toBe(10);
      expect(fullScore.totalScore).toBe(100);
    });
  });

  describe("Global Candidate Ranking Across Multiple Pages & Recency Inversion", () => {
    it("ranks entire candidate set BEFORE pagination (highest-scoring peer appears #1 on page 1 even if created oldest)", async () => {
      // Clean slate for ranking test
      await User.deleteMany({});
      await StudyRequest.deleteMany({});

      const baseTime = Date.now();

      // Create 15 peers.
      // Peer 0 is created OLDEST (15 days ago). Under recency ordering (createdAt: -1), Peer 0 would be #15 (Page 2).
      // But Peer 0 has exact topic match ("Operating Systems"), compatible mode ("online"), 5.0 rating, and fast reply badge.
      const oldestBestPeer = await User.create({
        googleId: "google_best_peer",
        email: "best.peer@university.edu",
        name: "Zachary Best (Oldest)",
        university: "Tech Univ",
        topics: ["Operating Systems", "Kernels"],
        subjects: ["Computer Science"],
        mode: "online",
        pricingPreference: "free",
        isProfileComplete: true,
        createdAt: new Date(baseTime - 15 * 24 * 60 * 60 * 1000),
      });

      // Give oldestBestPeer 3 fast responses to earn the badge
      await StudyRequest.create([
        {
          learner: learnerA._id,
          peer: oldestBestPeer._id,
          topic: "Operating Systems",
          normalizedTopic: "operating systems",
          problemDescription: "Kernel locks and mutexes question.",
          mode: "online",
          status: "REVIEWED",
          respondedAt: new Date(baseTime - 1000 * 60 * 60),
          createdAt: new Date(baseTime - 1000 * 60 * 120),
          learnerConfirmedAt: new Date(baseTime),
          peerConfirmedAt: new Date(baseTime),
          review: { rating: 5, comment: "Top tier mentor", createdAt: new Date() },
        },
        {
          learner: learnerB._id,
          peer: oldestBestPeer._id,
          topic: "Kernels",
          normalizedTopic: "kernels",
          problemDescription: "Virtual memory paging question.",
          mode: "online",
          status: "ACCEPTED",
          respondedAt: new Date(baseTime - 1000 * 60 * 40),
          createdAt: new Date(baseTime - 1000 * 60 * 90),
        },
        {
          learner: learnerA._id,
          peer: oldestBestPeer._id,
          topic: "Operating Systems",
          normalizedTopic: "operating systems",
          problemDescription: "Deadlock prevention question.",
          mode: "online",
          status: "ACCEPTED",
          respondedAt: new Date(baseTime - 1000 * 60 * 10),
          createdAt: new Date(baseTime - 1000 * 60 * 70),
        },
      ]);

      // Create 14 more recent peers (created 1..14 days ago) with lower match scores (70 pts: 50 topic + 20 mode)
      for (let i = 1; i <= 14; i++) {
        await User.create({
          googleId: `google_recent_peer_${i}`,
          email: `recent.peer.${i}@university.edu`,
          name: `Recent Peer ${i}`,
          university: "Tech Univ",
          topics: ["Operating Systems"], // Has topic match (50 pts) + online mode (20 pts) = 70 pts, but 0 rating, no badge
          subjects: ["Computer Science"],
          mode: "online",
          pricingPreference: "free",
          isProfileComplete: true,
          createdAt: new Date(baseTime - (15 - i) * 24 * 60 * 60 * 1000), // more recent!
        });
      }

      // Query page 1 with search topic "Operating Systems" and mode "online"
      const page1Result = await queryPeers({
        topic: "Operating Systems",
        mode: "online",
        page: 1,
      });

      expect(page1Result.state).toBe("success");
      if (page1Result.state === "success") {
        expect(page1Result.pagination.totalCount).toBe(15);
        expect(page1Result.pagination.totalPages).toBe(2); // 12 on page 1, 3 on page 2
        expect(page1Result.peers.length).toBe(12);

        // Verification of Recency Inversion:
        // oldestBestPeer MUST be peer #1 on page 1, despite being the oldest candidate in database!
        const topPeer = page1Result.peers[0];
        expect(topPeer.id).toBe(oldestBestPeer._id.toString());
        expect(topPeer.name).toBe("Zachary Best (Oldest)");
        expect(topPeer.matchScore).toBe(100);
        expect(topPeer.hasFastReplyBadge).toBe(true);
        expect(topPeer.reviewCount).toBe(1);
        expect(topPeer.averageRating).toBe(5);

        // Verify other peers on page 1 have lower match scores (70 pts)
        expect(page1Result.peers[1].matchScore).toBe(70);
      }

      // Query page 2
      const page2Result = await queryPeers({
        topic: "Operating Systems",
        mode: "online",
        page: 2,
      });

      expect(page2Result.state).toBe("success");
      if (page2Result.state === "success") {
        expect(page2Result.peers.length).toBe(3); // Remaining 3 peers
        expect(page2Result.pagination.page).toBe(2);
      }
    });
  });
});
