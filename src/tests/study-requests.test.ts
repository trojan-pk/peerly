import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { StudyRequest, type RequestStatus } from "@/models/StudyRequest";
import { User } from "@/models/User";
import {
  archiveStudyRequest,
  createStudyRequest,
  transitionStudyRequest,
  confirmStudyRequestCompletion,
  submitStudyRequestReview,
} from "@/app/dashboard/actions";
import {
  getPeerRatingStats,
  getPeerRatingStatsBatch,
} from "@/lib/peer-reviews";
import {
  getAuthorizedRequestContact,
  getDashboardRequests,
  getPublicPeerReviews,
} from "@/lib/study-requests";
import { buildSafeUnlockedContact } from "@/lib/contact-unlock";
import * as authGuards from "@/lib/auth-guards";
import {
  resetRateLimitsForTesting,
  checkRateLimit,
  RateLimit,
} from "@/lib/rate-limit";
import { ensureDatabaseIndexes } from "@/lib/db";
import * as dbModule from "@/lib/db";

describe("Study Requests, Atomic Completion, Reviews & Rate Limiter (MongoDB Integration)", () => {
  let mongoServer: MongoMemoryServer;
  let learnerUser: any;
  let peerUser: any;
  let thirdPartyUser: any;

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

    // Seed test users
    learnerUser = await User.create({
      googleId: "learner_google_id_1",
      email: "learner@university.edu",
      name: "Leo Learner",
      role: "student",
      university: "Central University",
      isProfileComplete: true,
      topics: ["Physics"],
      subjects: ["Science"],
      mode: "both",
      availability: "Afternoons",
      contact: {
        whatsapp: "+1111111111",
        meetingLink: "https://meet.google.com/learner-room",
        preferredMethod: "whatsapp",
      },
    });

    peerUser = await User.create({
      googleId: "peer_google_id_2",
      email: "peer@university.edu",
      name: "Patricia Peer",
      role: "student",
      university: "Central University",
      isProfileComplete: true,
      topics: ["Calculus", "Linear Algebra"],
      subjects: ["Mathematics"],
      mode: "both",
      availability: "Evenings",
      reviewCount: 0,
      averageRating: 0,
      contact: {
        whatsapp: "+1 (555) 234-5678",
        meetingLink: "https://meet.google.com/patricia-room",
        preferredMethod: "whatsapp",
      },
    });

    thirdPartyUser = await User.create({
      googleId: "third_party_google_id_3",
      email: "unrelated@university.edu",
      name: "Uma Unrelated",
      role: "student",
      university: "Other University",
      isProfileComplete: true,
      topics: ["Biology"],
      subjects: ["Science"],
      mode: "online",
      availability: "Mornings",
    });
  });

  describe("Personal request history", () => {
    async function record(status: RequestStatus = "CANCELLED", topic = "history") {
      return StudyRequest.create({ learner: learnerUser._id, peer: peerUser._id, topic, normalizedTopic: topic, problemDescription: "A sufficiently detailed question about calculus.", mode: "online", status });
    }
    function asActor(user: any) { vi.spyOn(authGuards, "requireAuth").mockResolvedValue({ user, session: {} as any, isAdmin: false }); }
    it("archives and restores only the caller's view while retaining the other participant's record", async () => {
      const item = await record(); asActor(learnerUser);
      expect((await archiveStudyRequest({ requestId: String(item._id), archive: true })).success).toBe(true);
      expect((await getDashboardRequests()).outgoing.total).toBe(0);
      expect((await getDashboardRequests(1,1,10,{ archived: true })).outgoing.total).toBe(1);
      asActor(peerUser); expect((await getDashboardRequests()).incoming.total).toBe(1);
      expect((await archiveStudyRequest({ requestId: String(item._id), archive: true })).success).toBe(true);
      asActor(learnerUser);
      expect((await archiveStudyRequest({ requestId: String(item._id), archive: false })).success).toBe(true);
      expect((await getDashboardRequests()).outgoing.total).toBe(1);
      asActor(peerUser); expect((await getDashboardRequests()).incoming.total).toBe(0);
      expect(await StudyRequest.countDocuments()).toBe(1);
    });
    it("rejects an unrelated user's archive and restore attempts", async () => {
      const item = await record(); asActor(thirdPartyUser);
      for (const archive of [true,false]) expect((await archiveStudyRequest({ requestId: String(item._id), archive })).success).toBe(false);
      expect((await StudyRequest.findById(item._id).select("+archivedBy"))!.archivedBy).toHaveLength(0);
    });
    it("keeps ongoing pending/accepted requests visible and rejects invalid IDs", async () => {
      asActor(learnerUser);
      for (const status of ["PENDING","ACCEPTED"] as const) { const item = await record(status,status); expect((await archiveStudyRequest({ requestId: String(item._id), archive: true })).success).toBe(false); }
      expect((await archiveStudyRequest({ requestId: "not-an-id", archive: true })).success).toBe(false);
      expect((await getDashboardRequests()).outgoing.total).toBe(2);
    });
    it("filters status on the server before pagination and counting", async () => {
      asActor(learnerUser); await record("PENDING","first"); await record("PENDING","second"); await record("REJECTED","third");
      const result = await getDashboardRequests(1,1,1,{ status: "PENDING" });
      expect(result.outgoing.total).toBe(2); expect(result.outgoing.totalPages).toBe(2); expect(result.outgoing.items[0].status).toBe("PENDING");
    });
  });

  describe("Self-Request Prevention", () => {
    it("rejects attempt by user to request help from themselves", async () => {
      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: peerUser,
        session: { user: { id: peerUser._id.toString() } } as any,
        isAdmin: false,
      });

      const res = await createStudyRequest({
        peerId: peerUser._id.toString(),
        topic: "Calculus",
        problemDescription: "Need help solving differential equations.",
        mode: "online",
      });

      expect(res.success).toBe(false);
      expect(res.message).toContain("cannot send a study request to yourself");
    });
  });

  describe("Database-Enforced Duplicate Constraints & Race Safety", () => {
    it("enforces database constraint preventing duplicate active requests for same topic", async () => {
      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: learnerUser,
        session: { user: { id: learnerUser._id.toString() } } as any,
        isAdmin: false,
      });

      // 1. Initial request succeeds
      const firstRes = await createStudyRequest({
        peerId: peerUser._id.toString(),
        topic: "Calculus",
        problemDescription: "First request for calculus optimization.",
        mode: "online",
      });
      expect(firstRes.success).toBe(true);

      // 2. Second request with different casing should hit normalized unique constraint
      const secondRes = await createStudyRequest({
        peerId: peerUser._id.toString(),
        topic: "  calculus  ",
        problemDescription: "Second request for same topic while first is pending.",
        mode: "online",
      });

      expect(secondRes.success).toBe(false);
      expect(secondRes.conflict).toBe(true);
      expect(secondRes.message).toContain("already have an active study request");
    });

    it("handles concurrent creation race condition safely via MongoDB partial unique index", async () => {
      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: learnerUser,
        session: { user: { id: learnerUser._id.toString() } } as any,
        isAdmin: false,
      });

      // Execute two simultaneous identical requests concurrently
      const results = await Promise.all([
        createStudyRequest({
          peerId: peerUser._id.toString(),
          topic: "Linear Algebra",
          problemDescription: "Concurrent request A: eigenvalues.",
          mode: "online",
        }),
        createStudyRequest({
          peerId: peerUser._id.toString(),
          topic: "Linear Algebra",
          problemDescription: "Concurrent request B: eigenvalues.",
          mode: "online",
        }),
      ]);

      const successCount = results.filter((r) => r.success).length;
      const conflictCount = results.filter((r) => r.conflict).length;

      // Exactly ONE must succeed and the other must be caught by duplicate key constraint
      expect(successCount).toBe(1);
      expect(conflictCount).toBe(1);

      // Verify only 1 record exists in MongoDB
      const totalDocs = await StudyRequest.countDocuments({
        learner: learnerUser._id,
        peer: peerUser._id,
        normalizedTopic: "linear algebra",
      });
      expect(totalDocs).toBe(1);
    });

    it("allows a new request after an earlier request was CANCELLED", async () => {
      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: learnerUser,
        session: { user: { id: learnerUser._id.toString() } } as any,
        isAdmin: false,
      });

      // 1. Create request
      const firstRes = await createStudyRequest({
        peerId: peerUser._id.toString(),
        topic: "Calculus",
        problemDescription: "First calculus question.",
        mode: "online",
      });

      // 2. Cancel it
      await transitionStudyRequest({
        requestId: firstRes.requestId,
        action: "cancel",
      });

      // 3. New request for same topic should now succeed because status is CANCELLED (not active)
      const secondRes = await createStudyRequest({
        peerId: peerUser._id.toString(),
        topic: "Calculus",
        problemDescription: "New follow-up calculus question.",
        mode: "online",
      });

      expect(secondRes.success).toBe(true);
    });
  });

  describe("State Transitions & Race-Safe Concurrency", () => {
    it("allows peer to accept a PENDING request", async () => {
      const reqDoc = await StudyRequest.create({
        learner: learnerUser._id,
        peer: peerUser._id,
        topic: "Calculus",
        normalizedTopic: "calculus",
        problemDescription: "Understanding limits.",
        mode: "online",
        status: "PENDING",
      });

      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: peerUser,
        session: { user: { id: peerUser._id.toString() } } as any,
        isAdmin: false,
      });

      const res = await transitionStudyRequest({
        requestId: reqDoc._id.toString(),
        action: "accept",
      });

      expect(res.success).toBe(true);
      const updated = await StudyRequest.findById(reqDoc._id);
      expect(updated?.status).toBe("ACCEPTED");
    });

    it("rejects attempt by learner to accept their own request", async () => {
      const reqDoc = await StudyRequest.create({
        learner: learnerUser._id,
        peer: peerUser._id,
        topic: "Calculus",
        normalizedTopic: "calculus",
        problemDescription: "Understanding limits.",
        mode: "online",
        status: "PENDING",
      });

      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: learnerUser,
        session: { user: { id: learnerUser._id.toString() } } as any,
        isAdmin: false,
      });

      const res = await transitionStudyRequest({
        requestId: reqDoc._id.toString(),
        action: "accept",
      });

      expect(res.success).toBe(false);
      expect(res.conflict).toBe(true);

      const unchanged = await StudyRequest.findById(reqDoc._id);
      expect(unchanged?.status).toBe("PENDING");
    });

    it("allows learner to cancel a PENDING request", async () => {
      const reqDoc = await StudyRequest.create({
        learner: learnerUser._id,
        peer: peerUser._id,
        topic: "Calculus",
        normalizedTopic: "calculus",
        problemDescription: "Understanding limits.",
        mode: "online",
        status: "PENDING",
      });

      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: learnerUser,
        session: { user: { id: learnerUser._id.toString() } } as any,
        isAdmin: false,
      });

      const res = await transitionStudyRequest({
        requestId: reqDoc._id.toString(),
        action: "cancel",
      });

      expect(res.success).toBe(true);
      const updated = await StudyRequest.findById(reqDoc._id);
      expect(updated?.status).toBe("CANCELLED");
    });

    it("handles simultaneous accept and cancel race condition atomically", async () => {
      const reqDoc = await StudyRequest.create({
        learner: learnerUser._id,
        peer: peerUser._id,
        topic: "Calculus",
        normalizedTopic: "calculus",
        problemDescription: "Understanding limits.",
        mode: "online",
        status: "PENDING",
      });

      // Peer tries to accept while learner tries to cancel at the exact same moment
      const acceptPromise = (async () => {
        vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
          user: peerUser,
          session: { user: { id: peerUser._id.toString() } } as any,
          isAdmin: false,
        });
        return transitionStudyRequest({
          requestId: reqDoc._id.toString(),
          action: "accept",
        });
      })();

      const cancelPromise = (async () => {
        vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
          user: learnerUser,
          session: { user: { id: learnerUser._id.toString() } } as any,
          isAdmin: false,
        });
        return transitionStudyRequest({
          requestId: reqDoc._id.toString(),
          action: "cancel",
        });
      })();

      const [res1, res2] = await Promise.all([acceptPromise, cancelPromise]);

      const successCount = [res1, res2].filter((r) => r.success).length;
      const conflictCount = [res1, res2].filter((r) => r.conflict).length;

      // Exactly ONE action must succeed, and the other must be rejected due to atomic status check
      expect(successCount).toBe(1);
      expect(conflictCount).toBe(1);

      const finalState = await StudyRequest.findById(reqDoc._id);
      expect(["ACCEPTED", "CANCELLED"]).toContain(finalState?.status);
    });
  });

  describe("Session Completion (Single Atomic MongoDB Pipeline & Recovery)", () => {
    it("handles one confirmation keeping ACCEPTED and waiting for other participant", async () => {
      const reqDoc = await StudyRequest.create({
        learner: learnerUser._id,
        peer: peerUser._id,
        topic: "Calculus",
        normalizedTopic: "calculus",
        problemDescription: "Completion test.",
        mode: "online",
        status: "ACCEPTED",
      });

      // Learner confirms completion first
      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: learnerUser,
        session: { user: { id: learnerUser._id.toString() } } as any,
        isAdmin: false,
      });

      const res = await confirmStudyRequestCompletion({
        requestId: reqDoc._id.toString(),
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain("Waiting for the other participant");

      const intermediate = await StudyRequest.findById(reqDoc._id);
      expect(intermediate?.status).toBe("ACCEPTED");
      expect(intermediate?.learnerConfirmedAt).toBeInstanceOf(Date);
      expect(intermediate?.peerConfirmedAt).toBeNull();
    });

    it("transitions atomically to COMPLETED in a single write when both participants confirm", async () => {
      const reqDoc = await StudyRequest.create({
        learner: learnerUser._id,
        peer: peerUser._id,
        topic: "Calculus",
        normalizedTopic: "calculus",
        problemDescription: "Dual confirmation test.",
        mode: "online",
        status: "ACCEPTED",
      });

      // 1. Learner confirms
      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: learnerUser,
        session: { user: { id: learnerUser._id.toString() } } as any,
        isAdmin: false,
      });
      await confirmStudyRequestCompletion({ requestId: reqDoc._id.toString() });

      // 2. Peer confirms
      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: peerUser,
        session: { user: { id: peerUser._id.toString() } } as any,
        isAdmin: false,
      });
      const peerRes = await confirmStudyRequestCompletion({ requestId: reqDoc._id.toString() });

      expect(peerRes.success).toBe(true);
      expect(peerRes.message).toContain("Both participants have confirmed");

      const completedDoc = await StudyRequest.findById(reqDoc._id);
      expect(completedDoc?.status).toBe("COMPLETED");
      expect(completedDoc?.learnerConfirmedAt).toBeInstanceOf(Date);
      expect(completedDoc?.peerConfirmedAt).toBeInstanceOf(Date);
    });

    it("handles simultaneous concurrent confirmations safely preserving both timestamps", async () => {
      const reqDoc = await StudyRequest.create({
        learner: learnerUser._id,
        peer: peerUser._id,
        topic: "Calculus",
        normalizedTopic: "calculus",
        problemDescription: "Concurrent completion test.",
        mode: "online",
        status: "ACCEPTED",
      });

      // Learner and Peer confirm concurrently
      const learnerConfirm = (async () => {
        vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
          user: learnerUser,
          session: { user: { id: learnerUser._id.toString() } } as any,
          isAdmin: false,
        });
        return confirmStudyRequestCompletion({ requestId: reqDoc._id.toString() });
      })();

      const peerConfirm = (async () => {
        vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
          user: peerUser,
          session: { user: { id: peerUser._id.toString() } } as any,
          isAdmin: false,
        });
        return confirmStudyRequestCompletion({ requestId: reqDoc._id.toString() });
      })();

      const [resLearner, resPeer] = await Promise.all([learnerConfirm, peerConfirm]);

      expect(resLearner.success).toBe(true);
      expect(resPeer.success).toBe(true);

      const finalDoc = await StudyRequest.findById(reqDoc._id);
      expect(finalDoc?.status).toBe("COMPLETED");
      expect(finalDoc?.learnerConfirmedAt).toBeInstanceOf(Date);
      expect(finalDoc?.peerConfirmedAt).toBeInstanceOf(Date);
    });

    it("atomically recovers and completes a request already containing both confirmation timestamps", async () => {
      // Simulate an interrupted write where both confirmations exist but status was left as ACCEPTED
      const learnerTs = new Date(Date.now() - 60000);
      const peerTs = new Date(Date.now() - 30000);

      const interruptedReq = await StudyRequest.create({
        learner: learnerUser._id,
        peer: peerUser._id,
        topic: "Calculus",
        normalizedTopic: "calculus",
        problemDescription: "Interrupted session test.",
        mode: "online",
        status: "ACCEPTED",
        learnerConfirmedAt: learnerTs,
        peerConfirmedAt: peerTs,
      });

      // Learner retries confirmation
      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: learnerUser,
        session: { user: { id: learnerUser._id.toString() } } as any,
        isAdmin: false,
      });

      const res = await confirmStudyRequestCompletion({
        requestId: interruptedReq._id.toString(),
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain("Both participants have confirmed");

      const repaired = await StudyRequest.findById(interruptedReq._id);
      expect(repaired?.status).toBe("COMPLETED");
      // Must preserve original confirmation timestamps without overwriting
      expect(repaired?.learnerConfirmedAt?.getTime()).toBe(learnerTs.getTime());
      expect(repaired?.peerConfirmedAt?.getTime()).toBe(peerTs.getTime());
    });

    it("ensures repeated confirmation is idempotent and does not overwrite timestamps", async () => {
      const reqDoc = await StudyRequest.create({
        learner: learnerUser._id,
        peer: peerUser._id,
        topic: "Calculus",
        normalizedTopic: "calculus",
        problemDescription: "Idempotent completion test.",
        mode: "online",
        status: "ACCEPTED",
      });

      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: learnerUser,
        session: { user: { id: learnerUser._id.toString() } } as any,
        isAdmin: false,
      });

      const firstConfirm = await confirmStudyRequestCompletion({ requestId: reqDoc._id.toString() });
      expect(firstConfirm.success).toBe(true);

      const afterFirst = await StudyRequest.findById(reqDoc._id);
      const originalTimestamp = afterFirst?.learnerConfirmedAt?.getTime();
      expect(originalTimestamp).toBeDefined();

      // Wait a moment and confirm again
      await new Promise((resolve) => setTimeout(resolve, 50));
      const repeatedConfirm = await confirmStudyRequestCompletion({ requestId: reqDoc._id.toString() });
      expect(repeatedConfirm.success).toBe(true);
      expect(repeatedConfirm.message).toContain("already confirmed");

      const afterRepeated = await StudyRequest.findById(reqDoc._id);
      expect(afterRepeated?.learnerConfirmedAt?.getTime()).toBe(originalTimestamp);
    });

    it("rejects completion confirmation on non-ACCEPTED requests (PENDING, REJECTED, CANCELLED)", async () => {
      const pendingReq = await StudyRequest.create({
        learner: learnerUser._id,
        peer: peerUser._id,
        topic: "Physics",
        normalizedTopic: "physics",
        problemDescription: "Testing invalid completion status.",
        mode: "online",
        status: "PENDING",
      });

      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: learnerUser,
        session: { user: { id: learnerUser._id.toString() } } as any,
        isAdmin: false,
      });

      const res = await confirmStudyRequestCompletion({ requestId: pendingReq._id.toString() });
      expect(res.success).toBe(false);
      expect(res.message).toContain("Only accepted sessions can be confirmed");
    });

    it("rejects completion confirmation by unrelated third parties", async () => {
      const reqDoc = await StudyRequest.create({
        learner: learnerUser._id,
        peer: peerUser._id,
        topic: "Calculus",
        normalizedTopic: "calculus",
        problemDescription: "Testing third-party completion rejection.",
        mode: "online",
        status: "ACCEPTED",
      });

      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: thirdPartyUser,
        session: { user: { id: thirdPartyUser._id.toString() } } as any,
        isAdmin: false,
      });

      const res = await confirmStudyRequestCompletion({ requestId: reqDoc._id.toString() });
      expect(res.success).toBe(false);
      expect(res.message).toContain("not authorized");
    });
  });

  describe("Learner Reviews & Authoritative Aggregates", () => {
    it("handles concurrent reviews on different sessions for the same peer without overwriting stats", async () => {
      // Session 1: learnerUser -> peerUser
      const session1 = await StudyRequest.create({
        learner: learnerUser._id,
        peer: peerUser._id,
        topic: "Calculus 1",
        normalizedTopic: "calculus 1",
        problemDescription: "First session problem description.",
        mode: "online",
        status: "COMPLETED",
        learnerConfirmedAt: new Date(),
        peerConfirmedAt: new Date(),
      });

      // Session 2: thirdPartyUser -> peerUser
      const session2 = await StudyRequest.create({
        learner: thirdPartyUser._id,
        peer: peerUser._id,
        topic: "Calculus 2",
        normalizedTopic: "calculus 2",
        problemDescription: "Second session problem description.",
        mode: "online",
        status: "COMPLETED",
        learnerConfirmedAt: new Date(),
        peerConfirmedAt: new Date(),
      });

      // Submit reviews concurrently from two different learners
      const reviewSession1 = (async () => {
        vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
          user: learnerUser,
          session: { user: { id: learnerUser._id.toString() } } as any,
          isAdmin: false,
        });
        return submitStudyRequestReview({
          requestId: session1._id.toString(),
          rating: 5,
          comment: "Five stars for Session 1",
        });
      })();

      const reviewSession2 = (async () => {
        vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
          user: thirdPartyUser,
          session: { user: { id: thirdPartyUser._id.toString() } } as any,
          isAdmin: false,
        });
        return submitStudyRequestReview({
          requestId: session2._id.toString(),
          rating: 3,
          comment: "Three stars for Session 2",
        });
      })();

      const [res1, res2] = await Promise.all([reviewSession1, reviewSession2]);
      expect(res1.success).toBe(true);
      expect(res2.success).toBe(true);

      // Verify authoritative rating derived directly from persisted reviews
      const stats = await getPeerRatingStats(peerUser._id);
      expect(stats.reviewCount).toBe(2);
      expect(stats.averageRating).toBe(4.0); // (5 + 3) / 2 = 4.0
    });

    it("ensures a committed review remains successful even if secondary cache update fails", async () => {
      const completedReq = await StudyRequest.create({
        learner: learnerUser._id,
        peer: peerUser._id,
        topic: "Physics",
        normalizedTopic: "physics",
        problemDescription: "Testing secondary failure resilience.",
        mode: "online",
        status: "COMPLETED",
        learnerConfirmedAt: new Date(),
        peerConfirmedAt: new Date(),
      });

      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: learnerUser,
        session: { user: { id: learnerUser._id.toString() } } as any,
        isAdmin: false,
      });

      // Mock secondary operation (User.findByIdAndUpdate) to throw
      vi.spyOn(User, "findByIdAndUpdate").mockRejectedValueOnce(
        new Error("Secondary cache update database outage")
      );

      const res = await submitStudyRequestReview({
        requestId: completedReq._id.toString(),
        rating: 5,
        comment: "Great session despite secondary cache failure",
      });

      // The action must NOT report failure to the learner!
      expect(res.success).toBe(true);
      expect(res.message).toContain("Your review has been published");

      // Verify the review is committed in MongoDB
      const saved = await StudyRequest.findById(completedReq._id);
      expect(saved?.status).toBe("REVIEWED");
      expect(saved?.review?.rating).toBe(5);

      // Authoritative rating derived directly from persisted review
      const stats = await getPeerRatingStats(peerUser._id);
      expect(stats.reviewCount).toBe(1);
      expect(stats.averageRating).toBe(5.0);
    });

    it("computes accurate aggregate rating across multiple reviews", async () => {
      // Create first reviewed session (rating 5)
      await StudyRequest.create({
        learner: learnerUser._id,
        peer: peerUser._id,
        topic: "Calculus 1",
        normalizedTopic: "calculus 1",
        problemDescription: "Help with limits and continuity problems.",
        mode: "online",
        status: "REVIEWED",
        review: { rating: 5, comment: "Awesome", createdAt: new Date() },
      });

      // Create second reviewed session (rating 4)
      await StudyRequest.create({
        learner: thirdPartyUser._id,
        peer: peerUser._id,
        topic: "Calculus 2",
        normalizedTopic: "calculus 2",
        problemDescription: "Help with integration by parts.",
        mode: "online",
        status: "REVIEWED",
        review: { rating: 4, comment: "Very good", createdAt: new Date() },
      });

      const stats = await getPeerRatingStats(peerUser._id);
      expect(stats.reviewCount).toBe(2);
      expect(stats.averageRating).toBe(4.5);

      // Also verify batched lookup
      const batchStats = await getPeerRatingStatsBatch([peerUser._id]);
      expect(batchStats.get(peerUser._id.toString())?.reviewCount).toBe(2);
      expect(batchStats.get(peerUser._id.toString())?.averageRating).toBe(4.5);
    });

    it("rejects review submission by peer helper (self-review prevention)", async () => {
      const completedReq = await StudyRequest.create({
        learner: learnerUser._id,
        peer: peerUser._id,
        topic: "Calculus",
        normalizedTopic: "calculus",
        problemDescription: "Self-review prevention.",
        mode: "online",
        status: "COMPLETED",
      });

      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: peerUser,
        session: { user: { id: peerUser._id.toString() } } as any,
        isAdmin: false,
      });

      const res = await submitStudyRequestReview({
        requestId: completedReq._id.toString(),
        rating: 5,
        comment: "Reviewing myself.",
      });

      expect(res.success).toBe(false);
      expect(res.message).toContain("cannot review their own study sessions");
    });

    it("rejects review submission by third parties", async () => {
      const completedReq = await StudyRequest.create({
        learner: learnerUser._id,
        peer: peerUser._id,
        topic: "Calculus",
        normalizedTopic: "calculus",
        problemDescription: "Third-party review test.",
        mode: "online",
        status: "COMPLETED",
      });

      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: thirdPartyUser,
        session: { user: { id: thirdPartyUser._id.toString() } } as any,
        isAdmin: false,
      });

      const res = await submitStudyRequestReview({
        requestId: completedReq._id.toString(),
        rating: 5,
      });

      expect(res.success).toBe(false);
      expect(res.message).toContain("Only the student learner who requested this session");
    });

    it("rejects premature review attempts on ACCEPTED or PENDING sessions", async () => {
      const acceptedReq = await StudyRequest.create({
        learner: learnerUser._id,
        peer: peerUser._id,
        topic: "Calculus",
        normalizedTopic: "calculus",
        problemDescription: "Premature review test.",
        mode: "online",
        status: "ACCEPTED",
      });

      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: learnerUser,
        session: { user: { id: learnerUser._id.toString() } } as any,
        isAdmin: false,
      });

      const res = await submitStudyRequestReview({
        requestId: acceptedReq._id.toString(),
        rating: 5,
      });

      expect(res.success).toBe(false);
      expect(res.message).toContain("only be submitted after both participants have confirmed");
    });

    it("strictly rejects invalid ratings (floating points, 0, 6, non-numbers)", async () => {
      const completedReq = await StudyRequest.create({
        learner: learnerUser._id,
        peer: peerUser._id,
        topic: "Calculus",
        normalizedTopic: "calculus",
        problemDescription: "Validation test.",
        mode: "online",
        status: "COMPLETED",
      });

      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: learnerUser,
        session: { user: { id: learnerUser._id.toString() } } as any,
        isAdmin: false,
      });

      // Float rating (4.5)
      const floatRes = await submitStudyRequestReview({
        requestId: completedReq._id.toString(),
        rating: 4.5,
      });
      expect(floatRes.success).toBe(false);

      // Out of bounds: 0
      const zeroRes = await submitStudyRequestReview({
        requestId: completedReq._id.toString(),
        rating: 0,
      });
      expect(zeroRes.success).toBe(false);

      // Out of bounds: 6
      const sixRes = await submitStudyRequestReview({
        requestId: completedReq._id.toString(),
        rating: 6,
      });
      expect(sixRes.success).toBe(false);
    });

    it("handles simultaneous duplicate review attempts race-safely via atomic update", async () => {
      const completedReq = await StudyRequest.create({
        learner: learnerUser._id,
        peer: peerUser._id,
        topic: "Calculus",
        normalizedTopic: "calculus",
        problemDescription: "Duplicate review race test.",
        mode: "online",
        status: "COMPLETED",
      });

      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: learnerUser,
        session: { user: { id: learnerUser._id.toString() } } as any,
        isAdmin: false,
      });

      const [res1, res2] = await Promise.all([
        submitStudyRequestReview({
          requestId: completedReq._id.toString(),
          rating: 5,
          comment: "First concurrent review attempt.",
        }),
        submitStudyRequestReview({
          requestId: completedReq._id.toString(),
          rating: 4,
          comment: "Second concurrent review attempt.",
        }),
      ]);

      const successCount = [res1, res2].filter((r) => r.success).length;
      const conflictCount = [res1, res2].filter((r) => r.conflict).length;

      // Exactly ONE review must succeed atomically
      expect(successCount).toBe(1);
      expect(conflictCount).toBe(1);

      const finalReq = await StudyRequest.findById(completedReq._id);
      expect(finalReq?.status).toBe("REVIEWED");
      expect(finalReq?.review).not.toBeNull();
    });
  });

  describe("Public Peer Reviews Query & Safe DTO", () => {
    it("returns paginated safe public reviews without exposing private emails or IDs", async () => {
      await StudyRequest.create({
        learner: learnerUser._id,
        peer: peerUser._id,
        topic: "Calculus",
        normalizedTopic: "calculus",
        problemDescription: "Secret problem description that must not leak.",
        mode: "online",
        status: "REVIEWED",
        review: {
          rating: 5,
          comment: "Super helpful calculus tutor!",
          createdAt: new Date(),
        },
      });

      const result = await getPublicPeerReviews(peerUser._id.toString(), 1, 5);
      expect(result.total).toBe(1);
      expect(result.reviews.length).toBe(1);

      const review = result.reviews[0];
      expect(review.rating).toBe(5);
      expect(review.comment).toBe("Super helpful calculus tutor!");
      expect(review.learnerName).toBe("Leo L."); // Safe formatted name
      // Must NOT contain sensitive learner email or raw problem details
      expect((review as any).learnerEmail).toBeUndefined();
      expect((review as any).problemDescription).toBeUndefined();
    });
  });

  describe("Contact Unlocking & Privacy Enforcements", () => {
    it("locks contact details for PENDING, REJECTED, and CANCELLED requests", async () => {
      const statuses: Array<"PENDING" | "REJECTED" | "CANCELLED"> = [
        "PENDING",
        "REJECTED",
        "CANCELLED",
      ];

      for (const status of statuses) {
        const reqDoc = await StudyRequest.create({
          learner: learnerUser._id,
          peer: peerUser._id,
          topic: `Topic ${status}`,
          normalizedTopic: `topic ${status}`.toLowerCase(),
          problemDescription: "Testing locked status.",
          mode: "online",
          status,
        });

        vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
          user: learnerUser,
          session: { user: { id: learnerUser._id.toString() } } as any,
          isAdmin: false,
        });

        const contact = await getAuthorizedRequestContact(reqDoc._id.toString());
        expect(contact).toBeNull();
      }
    });

    it("strictly blocks third-party (unrelated) users from viewing contact on ACCEPTED requests", async () => {
      const reqDoc = await StudyRequest.create({
        learner: learnerUser._id,
        peer: peerUser._id,
        topic: "Calculus",
        normalizedTopic: "calculus",
        problemDescription: "Testing third-party lockout.",
        mode: "online",
        status: "ACCEPTED",
      });

      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: thirdPartyUser,
        session: { user: { id: thirdPartyUser._id.toString() } } as any,
        isAdmin: false,
      });

      const contact = await getAuthorizedRequestContact(reqDoc._id.toString());
      expect(contact).toBeNull();
    });

    it("unlocks peer contact to learner for ACCEPTED, COMPLETED, and REVIEWED requests", async () => {
      const unlockedStatuses: Array<"ACCEPTED" | "COMPLETED" | "REVIEWED"> = [
        "ACCEPTED",
        "COMPLETED",
        "REVIEWED",
      ];

      for (const status of unlockedStatuses) {
        const reqDoc = await StudyRequest.create({
          learner: learnerUser._id,
          peer: peerUser._id,
          topic: `Topic ${status}`,
          normalizedTopic: `topic ${status}`.toLowerCase(),
          problemDescription: "Testing unlocked status.",
          mode: "online",
          status,
        });

        vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
          user: learnerUser,
          session: { user: { id: learnerUser._id.toString() } } as any,
          isAdmin: false,
        });

        const contact = await getAuthorizedRequestContact(reqDoc._id.toString());
        expect(contact).not.toBeNull();
        expect(contact?.whatsapp).toBe("+1 (555) 234-5678");
        expect(contact?.whatsappUrl).toBe("https://wa.me/15552345678");
        expect(contact?.meetingLink).toBe("https://meet.google.com/patricia-room");
        // Preferred method was whatsapp, email not exposed
        expect(contact?.email).toBeUndefined();
      }
    });

    it("exposes peer email ONLY if email was explicitly chosen as preferred method", () => {
      const peerWithEmailChosen = {
        email: "tutor@university.edu",
        contact: {
          whatsapp: "",
          meetingLink: "",
          preferredMethod: "email",
        },
      };

      const unlocked = buildSafeUnlockedContact(peerWithEmailChosen);
      expect(unlocked.email).toBe("tutor@university.edu");

      const peerWithWhatsappChosen = {
        email: "tutor@university.edu",
        contact: {
          whatsapp: "+1234567890",
          meetingLink: "",
          preferredMethod: "whatsapp",
        },
      };

      const unlockedWa = buildSafeUnlockedContact(peerWithWhatsappChosen);
      expect(unlockedWa.email).toBeUndefined();
    });

    it("returns honest unavailable state when peer has no contact configured", () => {
      const peerEmptyContact = {
        email: "tutor@university.edu",
        contact: {
          whatsapp: "",
          meetingLink: "",
          preferredMethod: "unspecified",
        },
      };

      const unlocked = buildSafeUnlockedContact(peerEmptyContact);
      expect(unlocked.unavailable).toBe(true);
      expect(unlocked.message).toContain("not yet configured");
    });
  });

  describe("MongoDB-Backed Atomic Rate Limiter Hardening", () => {
    it("throttles excessive requests per user key", async () => {
      const userId = "test_rate_limit_user";
      for (let i = 0; i < 5; i++) {
        const check = await checkRateLimit(`req_create:${userId}`, 5, 60000);
        expect(check.allowed).toBe(true);
      }

      // 6th attempt should be blocked
      const blocked = await checkRateLimit(`req_create:${userId}`, 5, 60000);
      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    });

    it("fails closed and rejects writes when database configuration is absent", async () => {
      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: learnerUser,
        session: { user: { id: learnerUser._id.toString() } } as any,
        isAdmin: false,
      });

      // Mock DB config absent
      const dbConfigSpy = vi.spyOn(dbModule, "isDatabaseConfigured").mockReturnValue(false);

      // checkRateLimit directly throws RateLimiterError
      await expect(checkRateLimit("test_no_db", 5, 60000)).rejects.toThrow("requires database configuration");

      // createStudyRequest handles it and returns service unavailable error (does not silently allow write)
      const res = await createStudyRequest({
        peerId: peerUser._id.toString(),
        topic: "Calculus",
        problemDescription: "Trying to write without db config.",
        mode: "online",
      });

      expect(res.success).toBe(false);
      expect(res.message).toContain("Service temporarily unavailable");

      dbConfigSpy.mockRestore();
    });

    it("bounds stored timestamps under repeated blocked attempts to prevent unbounded storage", async () => {
      const key = "bounded_storage_test_key";
      const limit = 5;

      // Send 30 requests in a row
      for (let i = 0; i < 30; i++) {
        await checkRateLimit(key, limit, 60000);
      }

      const doc = await RateLimit.findOne({ key }).lean();
      expect(doc).not.toBeNull();
      // Must be strictly bounded to at most (limit + 1) = 6 timestamps
      expect(doc!.timestamps.length).toBeLessThanOrEqual(limit + 1);
    });

    it("safely handles cold-start contention across concurrent requests", async () => {
      await resetRateLimitsForTesting();
      const key = "cold_start_contention_key";

      // 10 concurrent requests at cold start
      const results = await Promise.all(
        Array.from({ length: 10 }).map(() => checkRateLimit(key, 5, 60000))
      );

      const allowed = results.filter((r) => r.allowed).length;
      const blocked = results.filter((r) => !r.allowed).length;

      expect(allowed).toBe(5);
      expect(blocked).toBe(5);

      const doc = await RateLimit.findOne({ key }).lean();
      expect(doc!.timestamps.length).toBeLessThanOrEqual(6);
    });


    it("blocked attempts do not consume slots or extend the advertised wait", async () => {
      const key = "retry_window_stability";
      for (let i = 0; i < 5; i++) await checkRateLimit(key, 5, 60000);
      const before = await RateLimit.findOne({ key }).lean();
      for (let i = 0; i < 10; i++) expect((await checkRateLimit(key, 5, 60000)).allowed).toBe(false);
      const after = await RateLimit.findOne({ key }).lean();
      expect(after?.timestamps).toEqual(before?.timestamps);
      await RateLimit.updateOne({ key }, { $set: { timestamps: Array.from({ length: 5 }, () => new Date(Date.now() - 61000)) } });
      expect((await checkRateLimit(key, 5, 60000)).allowed).toBe(true);
      expect((await RateLimit.findOne({ key }).lean())?.timestamps).toHaveLength(1);
    });

    it("verifies TTL index configuration on RateLimit model", async () => {
      const indexes = await RateLimit.collection.indexes();
      const ttlIndex = indexes.find((idx: any) => idx.expireAfterSeconds !== undefined);
      expect(ttlIndex).toBeDefined();
    });
  });

  describe("Authentication on Every Exported Mutation", () => {
    it("ensures recalculatePeerAggregates is NOT exported from server actions module", async () => {
      const actions = await import("@/app/dashboard/actions");
      expect((actions as any).recalculatePeerAggregates).toBeUndefined();
    });

    it("strictly rejects unauthenticated calls to all exported server actions", async () => {
      // Mock requireAuth throwing UnauthorizedError
      vi.spyOn(authGuards, "requireAuth").mockRejectedValue(new authGuards.UnauthorizedError());

      const createRes = await createStudyRequest({
        peerId: peerUser._id.toString(),
        topic: "Calculus",
        problemDescription: "Need help solving limits.",
        mode: "online",
      });
      expect(createRes.success).toBe(false);
      expect(createRes.message).toContain("signed in");

      const transitionRes = await transitionStudyRequest({
        requestId: new mongoose.Types.ObjectId().toString(),
        action: "accept",
      });
      expect(transitionRes.success).toBe(false);
      expect(transitionRes.message).toContain("signed in");

      const confirmRes = await confirmStudyRequestCompletion({
        requestId: new mongoose.Types.ObjectId().toString(),
      });
      expect(confirmRes.success).toBe(false);
      expect(confirmRes.message).toContain("signed in");

      const reviewRes = await submitStudyRequestReview({
        requestId: new mongoose.Types.ObjectId().toString(),
        rating: 5,
      });
      expect(reviewRes.success).toBe(false);
      expect(reviewRes.message).toContain("signed in");
    });
  });

  describe("Dashboard Requests Listing & Pagination", () => {
    it("retrieves incoming and outgoing lists with pagination and contact unlocking", async () => {
      await StudyRequest.create({
        learner: learnerUser._id,
        peer: peerUser._id,
        topic: "Calculus",
        normalizedTopic: "calculus",
        problemDescription: "Help with limits and derivatives.",
        mode: "online",
        status: "ACCEPTED",
      });

      // Peer's dashboard: incoming has 1 item, outgoing has 0
      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: peerUser,
        session: { user: { id: peerUser._id.toString() } } as any,
        isAdmin: false,
      });

      const peerDashboard = await getDashboardRequests(1, 1);
      expect(peerDashboard.incoming.total).toBe(1);
      expect(peerDashboard.incoming.items[0].topic).toBe("Calculus");
      expect(peerDashboard.incoming.items[0].unlockedContact).toBeNull();
      expect(peerDashboard.outgoing.total).toBe(0);

      // Learner's dashboard: outgoing has 1 item with unlockedContact
      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: learnerUser,
        session: { user: { id: learnerUser._id.toString() } } as any,
        isAdmin: false,
      });

      const learnerDashboard = await getDashboardRequests(1, 1);
      expect(learnerDashboard.outgoing.total).toBe(1);
      expect(learnerDashboard.outgoing.items[0].topic).toBe("Calculus");
      expect(learnerDashboard.outgoing.items[0].unlockedContact?.whatsappUrl).toBe("https://wa.me/15552345678");
      expect(learnerDashboard.incoming.total).toBe(0);
    });
  });

  describe("Honest public reviews and batched dashboard contact", () => {
    function asActor(user: any) { vi.spyOn(authGuards, "requireAuth").mockResolvedValue({ user, session: {} as any, isAdmin: false }); }
    const base = { problemDescription: "A sufficiently detailed question about calculus.", mode: "online" as const };

    it("excludes reviewed records without a genuine rating instead of inventing five stars", async () => {
      await StudyRequest.create({ ...base, learner: learnerUser._id, peer: peerUser._id, topic: "a", normalizedTopic: "a", status: "REVIEWED", review: { rating: 3, comment: "ok" } });
      // A malformed legacy record written around schema validation.
      await StudyRequest.collection.insertOne({ ...base, learner: learnerUser._id, peer: peerUser._id, topic: "b", normalizedTopic: "b", status: "REVIEWED", review: { comment: "no rating" }, createdAt: new Date(), updatedAt: new Date() });
      const result = await getPublicPeerReviews(String(peerUser._id));
      expect(result.total).toBe(1);
      expect(result.reviews.map(r => r.rating)).toEqual([3]);
    });

    it("uses a neutral fallback name that does not claim verification", async () => {
      const nameless = await User.collection.insertOne({ googleId: "nameless", email: "nameless@x.edu", name: "", isProfileComplete: true });
      await StudyRequest.create({ ...base, learner: nameless.insertedId, peer: peerUser._id, topic: "c", normalizedTopic: "c", status: "REVIEWED", review: { rating: 4, comment: "" } });
      const [review] = (await getPublicPeerReviews(String(peerUser._id))).reviews;
      expect(review.learnerName).toBe("Student");
    });

    it("batches contacts for unlocked outgoing requests and matches the single-request resolver", async () => {
      const statuses: RequestStatus[] = ["PENDING", "ACCEPTED", "COMPLETED", "REVIEWED", "REJECTED", "CANCELLED"];
      const created = [];
      for (const [i, status] of statuses.entries()) {
        created.push(await StudyRequest.create({ ...base, learner: learnerUser._id, peer: peerUser._id, topic: `t${i}`, normalizedTopic: `t${i}`, status, ...(status === "REVIEWED" ? { review: { rating: 5, comment: "" } } : {}) }));
      }
      asActor(learnerUser);
      const findSpy = vi.spyOn(User, "find");
      const findByIdSpy = vi.spyOn(User, "findById");
      const dashboard = await getDashboardRequests(1, 1, 10);
      // Previously each unlocked row issued findById lookups (N+1). Now: the populate
      // query plus one batched contact lookup, regardless of how many rows unlock.
      expect(findByIdSpy).not.toHaveBeenCalled();
      expect(findSpy).toHaveBeenCalledTimes(2);
      findByIdSpy.mockRestore();
      for (const item of dashboard.outgoing.items) {
        const expected = await getAuthorizedRequestContact(item.id);
        expect(item.unlockedContact ?? null).toEqual(expected);
        expect(Boolean(item.unlockedContact)).toBe(["ACCEPTED", "COMPLETED", "REVIEWED"].includes(item.status));
      }
      expect(created).toHaveLength(6);
    });

    it("never gives an unrelated user any contact through the dashboard", async () => {
      await StudyRequest.create({ ...base, learner: learnerUser._id, peer: peerUser._id, topic: "x", normalizedTopic: "x", status: "ACCEPTED" });
      asActor(thirdPartyUser);
      const dashboard = await getDashboardRequests();
      expect(dashboard.outgoing.total).toBe(0);
      expect(dashboard.incoming.total).toBe(0);
      expect(JSON.stringify(dashboard)).not.toContain("5552345678");
    });
  });
});
