import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { User } from "@/models/User";
import { Resource } from "@/models/Resource";
import { Report } from "@/models/Report";
import { StudyRequest } from "@/models/StudyRequest";
import { ensureDatabaseIndexes } from "@/lib/db";
import * as authModule from "@/auth";
import * as authGuards from "@/lib/auth-guards";
import { UnauthorizedError, ForbiddenError } from "@/lib/auth-guards";
import { resetRateLimitsForTesting } from "@/lib/rate-limit";
import {
  getAdminReports,
  submitReport,
  resolveReport,
  toggleTargetModeration,
} from "@/lib/reports";
import {
  submitReportAction,
  resolveReportAction,
  toggleTargetModerationAction,
} from "@/app/reports/actions";
import { queryPeers } from "@/lib/peers";
import {
  queryResources,
  getPeerPublishedResources,
  getUserResources,
} from "@/lib/resources";
import { createStudyRequest } from "@/app/dashboard/actions";
import { updateProfile } from "@/app/profile/actions";
import { updateResource } from "@/app/resources/actions";
import {
  getDashboardRequests,
  getAuthorizedRequestContact,
} from "@/lib/study-requests";

describe("Stage 2F: User Reporting, Admin Moderation & Public Surface Safety", () => {
  let mongoServer: MongoMemoryServer;
  const originalAdminEmails = process.env.ADMIN_EMAILS;

  let adminUser: any;
  let studentUser: any;
  let peerUser: any;
  let testResource: any;

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

    await Report.deleteMany({});
    await StudyRequest.deleteMany({});
    await Resource.deleteMany({});
    await User.deleteMany({});

    process.env.ADMIN_EMAILS = "admin@platform.edu";

    // 1. Seed Admin User
    adminUser = await User.create({
      googleId: "google_admin_id",
      email: "admin@platform.edu",
      name: "Admin Moderator",
      role: "admin",
      university: "Central University",
      isProfileComplete: true,
    });

    // 2. Seed Student User (Reporter)
    studentUser = await User.create({
      googleId: "google_student_id",
      email: "student@platform.edu",
      name: "Student Reporter",
      role: "student",
      university: "Central University",
      isProfileComplete: true,
      mode: "online",
    });

    // 3. Seed Peer User (Target)
    peerUser = await User.create({
      googleId: "google_peer_id",
      email: "peer@platform.edu",
      name: "Peer Target",
      role: "student",
      university: "Central University",
      campus: "North Campus",
      bio: "Experienced biology and chemistry tutor.",
      topics: ["Genetics", "Organic Chemistry"],
      subjects: ["Biology", "Chemistry"],
      mode: "both",
      pricingPreference: "free",
      isProfileComplete: true,
      contact: {
        whatsapp: "+1234567890",
        meetingLink: "https://meet.google.com/peer-room",
        preferredMethod: "whatsapp",
      },
    });

    // 4. Seed Resource (Target)
    testResource = await Resource.create({
      owner: peerUser._id,
      title: "Comprehensive Genetics Notes",
      description: "Detailed notes on Mendelian genetics and gene linkage.",
      topic: "Genetics",
      normalizedTopic: "genetics",
      url: "https://docs.google.com/document/d/genetics-101",
    });
  });

  afterEach(() => {
    if (originalAdminEmails !== undefined) {
      process.env.ADMIN_EMAILS = originalAdminEmails;
    } else {
      delete process.env.ADMIN_EMAILS;
    }
  });

  describe("1. Unauthorized Admin Access & RBAC Boundary", () => {
    it("rejects unauthenticated requests to getAdminReports", async () => {
      vi.spyOn(authGuards, "requireAdmin").mockRejectedValue(new UnauthorizedError());
      await expect(getAdminReports()).rejects.toThrow(UnauthorizedError);
    });

    it("rejects non-admin students from calling getAdminReports with ForbiddenError", async () => {
      vi.spyOn(authGuards, "requireAdmin").mockRejectedValue(new ForbiddenError());
      await expect(getAdminReports()).rejects.toThrow(ForbiddenError);
    });

    it("rejects unauthenticated and non-admin calls to resolveReport", async () => {
      vi.spyOn(authGuards, "requireAdmin").mockRejectedValue(new ForbiddenError());
      await expect(
        resolveReport({
          reportId: new mongoose.Types.ObjectId().toString(),
          action: "RESOLVE",
        })
      ).resolves.toMatchObject({ success: false, message: expect.stringContaining("Administrative privileges") });
    });

    it("rejects unauthenticated and non-admin calls to toggleTargetModeration", async () => {
      vi.spyOn(authGuards, "requireAdmin").mockRejectedValue(new ForbiddenError());
      await expect(
        toggleTargetModeration({
          targetType: "user",
          targetId: peerUser._id.toString(),
          action: "HIDE",
        })
      ).resolves.toMatchObject({ success: false, message: expect.stringContaining("Administrative privileges") });
    });
  });

  describe("2. Dynamic Admin Revocation", () => {
    it("immediately revokes admin privileges when email is removed from ADMIN_EMAILS", async () => {
      process.env.ADMIN_EMAILS = "admin@platform.edu";

      vi.spyOn(authModule, "auth").mockResolvedValue({
        user: { id: adminUser._id.toString(), email: adminUser.email },
      } as any);

      // Admin access succeeds initially
      const auth1 = await authGuards.requireAdmin();
      expect(auth1.isAdmin).toBe(true);

      // Environment variable changes dynamically (e.g. admin revoked)
      process.env.ADMIN_EMAILS = "other.admin@platform.edu";

      // Immediate revocation: next call throws ForbiddenError even with same session/user
      await expect(authGuards.requireAdmin()).rejects.toThrow(ForbiddenError);
    });
  });

  describe("3. Privileged Field Injection Prevention & Report Submission", () => {
    beforeEach(() => {
      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: studentUser,
        session: { user: { id: studentUser._id.toString() } } as any,
        isAdmin: false,
      });
    });

    it("rejects injected fields (reporter, status, resolvedBy, notes) due to strict schema", async () => {
      const maliciousPayload = {
        targetType: "user",
        targetId: peerUser._id.toString(),
        reason: "spam",
        explanation: "This user sends unsolicited marketing messages during study sessions.",
        reporter: adminUser._id.toString(), // Privileged injection attempt
        status: "RESOLVED", // Privileged injection attempt
        resolvedBy: adminUser._id.toString(),
        moderatorNotes: "Auto-approved",
      };

      const res = await submitReport(maliciousPayload);
      expect(res.success).toBe(false);
      expect(res.message).toContain("form errors");

      // Verify no report was inserted
      const count = await Report.countDocuments();
      expect(count).toBe(0);
    });

    it("derives reporter identity strictly from server auth context, ignoring submitted ID", async () => {
      const res = await submitReport({
        targetType: "user",
        targetId: peerUser._id.toString(),
        reason: "inappropriate",
        explanation: "Inappropriate comments made on the profile description.",
      });

      expect(res.success).toBe(true);
      expect(res.reportId).toBeDefined();

      const savedReport = await Report.findById(res.reportId);
      expect(savedReport).not.toBeNull();
      expect(savedReport?.reporter.toString()).toBe(studentUser._id.toString());
      expect(savedReport?.status).toBe("OPEN");
    });

    it("rejects self-reporting for peer profiles and own resources", async () => {
      // 1. Peer attempts to report themselves
      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: peerUser,
        session: { user: { id: peerUser._id.toString() } } as any,
        isAdmin: false,
      });

      const userSelfReport = await submitReport({
        targetType: "user",
        targetId: peerUser._id.toString(),
        reason: "spam",
        explanation: "Reporting myself for testing self-report prevention.",
      });
      expect(userSelfReport.success).toBe(false);
      expect(userSelfReport.message).toContain("cannot report your own profile");

      // 2. Peer attempts to report their own resource
      const resourceSelfReport = await submitReport({
        targetType: "resource",
        targetId: testResource._id.toString(),
        reason: "spam",
        explanation: "Reporting my own resource for testing self-report prevention.",
      });
      expect(resourceSelfReport.success).toBe(false);
      expect(resourceSelfReport.message).toContain("cannot report your own published resource");
    });

    it("rejects reports targeting non-existent users or resources", async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();

      const userRes = await submitReport({
        targetType: "user",
        targetId: fakeId,
        reason: "spam",
        explanation: "Target peer does not exist in the database.",
      });
      expect(userRes.success).toBe(false);
      expect(userRes.message).toContain("could not be found");

      const resourceRes = await submitReport({
        targetType: "resource",
        targetId: fakeId,
        reason: "broken_link",
        explanation: "Target resource does not exist in the database.",
      });
      expect(resourceRes.success).toBe(false);
      expect(resourceRes.message).toContain("could not be found");
    });
  });

  describe("4. Duplicate Report Races & Partial Unique Constraint", () => {
    beforeEach(() => {
      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: studentUser,
        session: { user: { id: studentUser._id.toString() } } as any,
        isAdmin: false,
      });
    });

    it("prevents duplicate OPEN reports per reporter and target", async () => {
      // First submission succeeds
      const first = await submitReport({
        targetType: "user",
        targetId: peerUser._id.toString(),
        reason: "harassment",
        explanation: "Persistent harassing messages sent during study requests.",
      });
      expect(first.success).toBe(true);

      // Second submission for the same target while first is OPEN fails with conflict
      const second = await submitReport({
        targetType: "user",
        targetId: peerUser._id.toString(),
        reason: "harassment",
        explanation: "Submitting another report while the first is still open.",
      });
      expect(second.success).toBe(false);
      expect(second.conflict).toBe(true);
      expect(second.message).toContain("already have an open report pending review");
    });

    it("handles concurrent report submission races atomically via MongoDB unique constraint", async () => {
      // Race 2 concurrent submissions
      const [res1, res2] = await Promise.all([
        submitReport({
          targetType: "resource",
          targetId: testResource._id.toString(),
          reason: "copyright",
          explanation: "Copyrighted textbook solution material uploaded without permission.",
        }),
        submitReport({
          targetType: "resource",
          targetId: testResource._id.toString(),
          reason: "copyright",
          explanation: "Copyrighted textbook solution material uploaded without permission.",
        }),
      ]);

      const successes = [res1, res2].filter((r) => r.success);
      const conflicts = [res1, res2].filter((r) => r.conflict);

      expect(successes.length).toBe(1);
      expect(conflicts.length).toBe(1);

      // Exactly 1 report in DB
      const dbCount = await Report.countDocuments({
        reporter: studentUser._id,
        targetId: testResource._id,
      });
      expect(dbCount).toBe(1);
    });

    it("allows a new report after previous report was RESOLVED or DISMISSED", async () => {
      // 1. Submit first report
      const rep1 = await submitReport({
        targetType: "user",
        targetId: peerUser._id.toString(),
        reason: "misleading",
        explanation: "First report for misleading tutoring credentials.",
      });
      expect(rep1.success).toBe(true);

      // 2. Admin dismisses the first report
      vi.spyOn(authGuards, "requireAdmin").mockResolvedValue({
        user: adminUser,
        session: { user: { id: adminUser._id.toString() } } as any,
        isAdmin: true,
      });

      const dismissal = await resolveReport({
        reportId: rep1.reportId!,
        action: "DISMISS",
        moderatorNotes: "No violation found on initial review.",
      });
      expect(dismissal.success).toBe(true);

      // 3. Student can now submit a new report because status is no longer OPEN
      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: studentUser,
        session: { user: { id: studentUser._id.toString() } } as any,
        isAdmin: false,
      });

      const rep2 = await submitReport({
        targetType: "user",
        targetId: peerUser._id.toString(),
        reason: "misleading",
        explanation: "Second report with new evidence of misleading credentials.",
      });
      expect(rep2.success).toBe(true);
      expect(rep2.reportId).not.toBe(rep1.reportId);
    });
  });

  describe("5. Conflicting Decisions & Report Resolution", () => {
    let openReport: any;

    beforeEach(async () => {
      openReport = await Report.create({
        targetType: "user",
        targetId: peerUser._id,
        reporter: studentUser._id,
        reason: "spam",
        explanation: "Spamming promotional links in chat.",
        status: "OPEN",
      });

      vi.spyOn(authGuards, "requireAdmin").mockResolvedValue({
        user: adminUser,
        session: { user: { id: adminUser._id.toString() } } as any,
        isAdmin: true,
      });
    });

    it("resolves an open report atomically and records moderator identity and timestamp", async () => {
      const res = await resolveReport({
        reportId: openReport._id.toString(),
        action: "RESOLVE",
        moderatorNotes: "Warning issued to student.",
      });

      expect(res.success).toBe(true);

      const updated = await Report.findById(openReport._id);
      expect(updated?.status).toBe("RESOLVED");
      expect(updated?.moderatorNotes).toBe("Warning issued to student.");
      expect(updated?.resolvedBy?.toString()).toBe(adminUser._id.toString());
      expect(updated?.resolvedAt).toBeInstanceOf(Date);
    });

    it("rejects resolution if report was already resolved or dismissed (atomic transition)", async () => {
      // First resolution
      const first = await resolveReport({
        reportId: openReport._id.toString(),
        action: "RESOLVE",
        moderatorNotes: "First decision.",
      });
      expect(first.success).toBe(true);

      // Conflicting second resolution attempt
      const second = await resolveReport({
        reportId: openReport._id.toString(),
        action: "DISMISS",
        moderatorNotes: "Conflicting second decision.",
      });

      expect(second.success).toBe(false);
      expect(second.conflict).toBe(true);
      expect(second.message).toContain("already been resolved or does not exist");
    });

    it("handles concurrent admin resolution races atomically", async () => {
      const [res1, res2] = await Promise.all([
        resolveReport({
          reportId: openReport._id.toString(),
          action: "RESOLVE",
          moderatorNotes: "Admin A resolved",
        }),
        resolveReport({
          reportId: openReport._id.toString(),
          action: "DISMISS",
          moderatorNotes: "Admin B dismissed",
        }),
      ]);

      const successes = [res1, res2].filter((r) => r.success);
      const conflicts = [res1, res2].filter((r) => r.conflict);

      expect(successes.length).toBe(1);
      expect(conflicts.length).toBe(1);
    });
  });

  describe("6. Hide and Restore Across All Public Surfaces", () => {
    beforeEach(() => {
      vi.spyOn(authGuards, "requireAdmin").mockResolvedValue({
        user: adminUser,
        session: { user: { id: adminUser._id.toString() } } as any,
        isAdmin: true,
      });
    });

    it("Peer Moderation: Hiding removes peer from queryPeers, counts, topic chips, and rejects new requests", async () => {
      // 1. Initial public visibility check
      const initialPeers = await queryPeers();
      expect(initialPeers.state).toBe("success");
      if (initialPeers.state === "success") {
        expect(initialPeers.peers.some((p) => p.id === peerUser._id.toString())).toBe(true);
        expect(initialPeers.availableTopics).toContain("Genetics");
      }

      // 2. Admin hides the peer
      const hideResult = await toggleTargetModeration({
        targetType: "user",
        targetId: peerUser._id.toString(),
        action: "HIDE",
        reason: "Academic misconduct investigation",
      });
      expect(hideResult.success).toBe(true);

      // Verify DB record
      const hiddenDbUser = await User.findById(peerUser._id);
      expect(hiddenDbUser?.moderation?.isHidden).toBe(true);
      expect(hiddenDbUser?.moderation?.reason).toBe("Academic misconduct investigation");

      // 3. queryPeers() must now exclude the hidden peer and their unique topics
      const postHidePeers = await queryPeers();
      expect(postHidePeers.state).toBe("success");
      if (postHidePeers.state === "success") {
        expect(postHidePeers.peers.some((p) => p.id === peerUser._id.toString())).toBe(false);
        expect(postHidePeers.availableTopics).not.toContain("Genetics");
      }

      // 4. New study requests to hidden peer must be rejected
      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: studentUser,
        session: { user: { id: studentUser._id.toString() } } as any,
        isAdmin: false,
      });

      const reqRes = await createStudyRequest({
        peerId: peerUser._id.toString(),
        topic: "Genetics",
        problemDescription: "Need help reviewing Mendelian problem sets.",
        mode: "online",
      });
      expect(reqRes.success).toBe(false);
      expect(reqRes.message).toContain("currently unavailable");

      // 5. Admin restores the peer
      vi.spyOn(authGuards, "requireAdmin").mockResolvedValue({
        user: adminUser,
        session: { user: { id: adminUser._id.toString() } } as any,
        isAdmin: true,
      });

      const restoreResult = await toggleTargetModeration({
        targetType: "user",
        targetId: peerUser._id.toString(),
        action: "RESTORE",
      });
      expect(restoreResult.success).toBe(true);

      // 6. queryPeers() and study requests work again
      const restoredPeers = await queryPeers();
      expect(restoredPeers.state).toBe("success");
      if (restoredPeers.state === "success") {
        expect(restoredPeers.peers.some((p) => p.id === peerUser._id.toString())).toBe(true);
      }
    });

    it("Resource Moderation: Hiding removes resource from queryResources and peer page, but remains in owner management", async () => {
      // 1. Initial public visibility
      const initialResources = await queryResources();
      expect(initialResources.state).toBe("success");
      if (initialResources.state === "success") {
        expect(initialResources.resources.some((r) => r.id === testResource._id.toString())).toBe(true);
      }

      const initialPeerResources = await getPeerPublishedResources(peerUser._id.toString());
      expect(initialPeerResources.resources.length).toBe(1);

      // 2. Admin hides the resource
      const hideResult = await toggleTargetModeration({
        targetType: "resource",
        targetId: testResource._id.toString(),
        action: "HIDE",
        reason: "DMCA copyright takedown request",
      });
      expect(hideResult.success).toBe(true);

      // 3. Public queryResources() must exclude the hidden resource
      const postHideResources = await queryResources();
      expect(postHideResources.state === "database_empty" || (postHideResources.state === "success" && postHideResources.resources.length === 0)).toBe(true);

      // 4. Peer profile resource list must exclude hidden resource
      const postHidePeerResources = await getPeerPublishedResources(peerUser._id.toString());
      expect(postHidePeerResources.resources.length).toBe(0);

      // 5. Owner management screen STILL returns the resource with moderation notice
      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: peerUser,
        session: { user: { id: peerUser._id.toString() } } as any,
        isAdmin: false,
      });

      const ownerResources = await getUserResources();
      expect(ownerResources.state).toBe("success");
      expect(ownerResources.resources.length).toBe(1);
      const ownerDoc = ownerResources.resources[0];
      expect(ownerDoc.id).toBe(testResource._id.toString());
      expect(ownerDoc.moderation?.isHidden).toBe(true);
      expect(ownerDoc.moderation?.reason).toBe("DMCA copyright takedown request");

      // 6. Admin restores the resource
      vi.spyOn(authGuards, "requireAdmin").mockResolvedValue({
        user: adminUser,
        session: { user: { id: adminUser._id.toString() } } as any,
        isAdmin: true,
      });

      const restoreResult = await toggleTargetModeration({
        targetType: "resource",
        targetId: testResource._id.toString(),
        action: "RESTORE",
      });
      expect(restoreResult.success).toBe(true);

      const restoredPublicResources = await queryResources();
      expect(restoredPublicResources.state).toBe("success");
      if (restoredPublicResources.state === "success") {
        expect(restoredPublicResources.resources.some((r) => r.id === testResource._id.toString())).toBe(true);
      }
    });
  });

  describe("7. Owner Unhide Prevention", () => {
    it("prevents an owner from unhiding their own moderated profile via updateProfile", async () => {
      // 1. Peer profile is hidden by moderator
      peerUser.moderation = {
        isHidden: true,
        hiddenAt: new Date(),
        reason: "Violation of conduct code",
      };
      await peerUser.save();

      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: peerUser,
        session: { user: { id: peerUser._id.toString() } } as any,
        isAdmin: false,
      });

      // 2. Peer updates their profile bio
      const updateRes = await updateProfile({
        name: "Peer Target",
        university: "Central University",
        campus: "North Campus",
        bio: "Updated bio after moderation.",
        topics: ["Genetics"],
        subjects: ["Biology"],
        mode: "both",
        availability: "Evenings",
        pricingPreference: "free",
        contact: {
          whatsapp: "+1234567890",
          meetingLink: "https://meet.google.com/peer-room",
          preferredMethod: "whatsapp",
        },
      });
      expect(updateRes.success).toBe(true);

      // 3. Verify profile is STILL hidden!
      const updatedUser = await User.findById(peerUser._id);
      expect(updatedUser?.moderation?.isHidden).toBe(true);
      expect(updatedUser?.moderation?.reason).toBe("Violation of conduct code");

      // 4. Attempting to explicitly pass moderation field fails validation
      const injectionAttempt = await updateProfile({
        name: "Peer Target",
        university: "Central University",
        topics: ["Genetics"],
        subjects: ["Biology"],
        moderation: { isHidden: false }, // Malicious injection attempt
      } as any);
      expect(injectionAttempt.success).toBe(false);
    });

    it("prevents an owner from unhiding their own moderated resource via updateResource", async () => {
      // 1. Resource is hidden by moderator
      testResource.moderation = {
        isHidden: true,
        hiddenAt: new Date(),
        reason: "Copyright violation",
      };
      await testResource.save();

      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: peerUser,
        session: { user: { id: peerUser._id.toString() } } as any,
        isAdmin: false,
      });

      // 2. Owner edits the resource title & description
      const updateRes = await updateResource({
        resourceId: testResource._id.toString(),
        title: "Updated Genetics Notes",
        topic: "Genetics",
        description: "Re-written notes completely compliant with guidelines.",
        url: "https://docs.google.com/document/d/genetics-102",
      });
      expect(updateRes.success).toBe(true);

      // 3. Verify resource is STILL hidden!
      const updatedDoc = await Resource.findById(testResource._id);
      expect(updatedDoc?.moderation?.isHidden).toBe(true);
      expect(updatedDoc?.moderation?.reason).toBe("Copyright violation");

      // 4. Attempting to pass moderation field fails validation
      const injectionAttempt = await updateResource({
        resourceId: testResource._id.toString(),
        title: "Updated Genetics Notes",
        topic: "Genetics",
        description: "Re-written notes.",
        url: "https://docs.google.com/document/d/genetics-102",
        moderation: { isHidden: false },
      } as any);
      expect(injectionAttempt.success).toBe(false);
    });
  });

  describe("8. Preserved Participant Privacy & Historical Sessions", () => {
    it("retains historical study requests and unlocked contact for participants even after peer is moderated", async () => {
      // 1. Create and accept study session between learner and peer
      const studyReq = await StudyRequest.create({
        learner: studentUser._id,
        peer: peerUser._id,
        topic: "Genetics",
        normalizedTopic: "genetics",
        problemDescription: "Need help before exam.",
        mode: "online",
        status: "ACCEPTED",
        respondedAt: new Date(),
      });

      // 2. Peer is subsequently moderated and hidden by admin
      peerUser.moderation = {
        isHidden: true,
        hiddenAt: new Date(),
        reason: "Unrelated guideline infraction",
      };
      await peerUser.save();

      // 3. Learner views their dashboard: study request remains accessible
      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: studentUser,
        session: { user: { id: studentUser._id.toString() } } as any,
        isAdmin: false,
      });

      const dashboard = await getDashboardRequests();
      expect(dashboard.outgoing.items.length).toBe(1);
      const reqDto = dashboard.outgoing.items[0];
      expect(reqDto.id).toBe(studyReq._id.toString());
      expect(reqDto.status).toBe("ACCEPTED");
      expect(reqDto.unlockedContact).not.toBeNull();
      expect(reqDto.unlockedContact?.whatsapp).toBe("+1234567890");

      // 4. Learner can also directly fetch authorized contact
      const contact = await getAuthorizedRequestContact(studyReq._id.toString());
      expect(contact).not.toBeNull();
      expect(contact?.whatsapp).toBe("+1234567890");
    });

    it("never exposes reporter email or moderator identities in public DTOs", async () => {
      // 1. Submit report
      await Report.create({
        targetType: "user",
        targetId: peerUser._id,
        reporter: studentUser._id,
        reason: "spam",
        explanation: "Public safety test.",
        status: "RESOLVED",
        resolvedBy: adminUser._id,
        resolvedAt: new Date(),
      });

      // 2. Admin read includes reporter email and moderator details
      vi.spyOn(authGuards, "requireAdmin").mockResolvedValue({
        user: adminUser,
        session: { user: { id: adminUser._id.toString() } } as any,
        isAdmin: true,
      });

      const adminReports = await getAdminReports();
      expect(adminReports.reports.length).toBe(1);
      expect(adminReports.reports[0].reporter.email).toBe(studentUser.email);
      expect(adminReports.reports[0].resolvedBy?.email).toBe(adminUser.email);

      // 3. Public queries NEVER expose reporter email or private details
      const publicPeers = await queryPeers();
      if (publicPeers.state === "success") {
        for (const p of publicPeers.peers) {
          expect((p as any).email).toBeUndefined();
          expect((p as any).googleId).toBeUndefined();
          expect((p as any).contact).toBeUndefined();
        }
      }
    });
  });

  describe("9. Server Action Handlers & Revalidation", () => {
    it("executes submitReportAction, resolveReportAction, and toggleTargetModerationAction", async () => {
      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: studentUser,
        session: { user: { id: studentUser._id.toString() } } as any,
        isAdmin: false,
      });

      const res = await submitReportAction({
        targetType: "user",
        targetId: peerUser._id.toString(),
        reason: "spam",
        explanation: "Testing server action wrapper for submit report.",
      });
      expect(res.success).toBe(true);
      expect(res.reportId).toBeDefined();

      vi.spyOn(authGuards, "requireAdmin").mockResolvedValue({
        user: adminUser,
        session: { user: { id: adminUser._id.toString() } } as any,
        isAdmin: true,
      });

      const resolveRes = await resolveReportAction({
        reportId: res.reportId!,
        action: "RESOLVE",
        moderatorNotes: "Resolved via server action.",
      });
      expect(resolveRes.success).toBe(true);

      const modRes = await toggleTargetModerationAction({
        targetType: "user",
        targetId: peerUser._id.toString(),
        action: "HIDE",
        reason: "Hidden via server action.",
      });
      expect(modRes.success).toBe(true);
    });
  });
});
