import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Resource } from "@/models/Resource";
import { User } from "@/models/User";
import {
  createResource,
  updateResource,
  deleteResource,
} from "@/app/resources/actions";
import {
  queryResources,
  getPeerPublishedResources,
  getUserResources,
} from "@/lib/resources";
import { validateSafeUrl } from "@/lib/validations/resource";
import * as authGuards from "@/lib/auth-guards";
import { resetRateLimitsForTesting } from "@/lib/rate-limit";
import { ensureDatabaseIndexes } from "@/lib/db";

describe("Academic Resources Hub (MongoDB Integration & Security)", () => {
  let mongoServer: MongoMemoryServer;
  let userA: any;
  let userB: any;

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
    await Resource.deleteMany({});
    await User.deleteMany({});

    // Seed test users
    userA = await User.create({
      googleId: "google_res_user_a",
      email: "usera@university.edu",
      name: "Alice Author",
      role: "student",
      university: "Central University",
      isProfileComplete: true,
      topics: ["Calculus"],
      subjects: ["Mathematics"],
      mode: "online",
      contact: {
        whatsapp: "+1111111111",
        meetingLink: "https://meet.google.com/alice-room",
        preferredMethod: "whatsapp",
      },
    });

    userB = await User.create({
      googleId: "google_res_user_b",
      email: "userb@university.edu",
      name: "Bob Bystander",
      role: "student",
      university: "Other University",
      isProfileComplete: true,
      topics: ["Physics"],
      subjects: ["Science"],
      mode: "campus",
      contact: {
        whatsapp: "+2222222222",
        meetingLink: "https://meet.google.com/bob-room",
        preferredMethod: "whatsapp",
      },
    });
  });

  describe("URL Safety Validation", () => {
    it("accepts valid HTTP and HTTPS URLs with hostnames", () => {
      const validUrls = [
        "https://notion.so/my-study-guide",
        "https://docs.google.com/document/d/123",
        "http://ocw.mit.edu/courses/math-101",
        "https://github.com/student/notes",
        "https://subdomain.university.edu/courseware/syllabus.html",
      ];

      for (const url of validUrls) {
        const check = validateSafeUrl(url);
        expect(check.valid).toBe(true);
        expect(check.normalizedUrl).toBeDefined();
      }
    });

    it("rejects non-HTTP protocols (javascript:, ftp:, data:, file:)", () => {
      const unsafeProtocols = [
        "javascript:alert(document.cookie)",
        "ftp://files.example.com/notes.pdf",
        "data:text/html,<script>alert(1)</script>",
        "file:///etc/passwd",
        "gopher://example.com",
      ];

      for (const url of unsafeProtocols) {
        const check = validateSafeUrl(url);
        expect(check.valid).toBe(false);
        expect(check.error).toContain("HTTP or HTTPS");
      }
    });

    it("rejects URLs containing embedded username or password credentials", () => {
      const credentialUrls = [
        "https://admin:password@malicious.com/notes",
        "http://user:secret@notion.so/workspace",
        "https://alice:token123@docs.google.com",
      ];

      for (const url of credentialUrls) {
        const check = validateSafeUrl(url);
        expect(check.valid).toBe(false);
        expect(check.error).toContain("embedded usernames or passwords");
      }
    });

    it("rejects URLs without hostnames or invalid domains", () => {
      const invalidHostUrls = [
        "http://",
        "https://",
        "not_a_url",
        "http:///path/without/host",
        "https://nodotdomain",
      ];

      for (const url of invalidHostUrls) {
        const check = validateSafeUrl(url);
        expect(check.valid).toBe(false);
      }
    });
  });

  describe("Resource Creation & Persistence", () => {
    it("persists a valid resource with owner derived strictly from requireAuth()", async () => {
      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: userA,
        session: { user: { id: userA._id.toString() } } as any,
        isAdmin: false,
      });

      const res = await createResource({
        title: "Calculus Limits Cheatsheet",
        topic: "Calculus",
        url: "https://docs.google.com/document/d/limits-notes",
        description: "Comprehensive summary of limit laws, L'Hopital's rule, and practice problems.",
      });

      expect(res.success).toBe(true);
      expect(res.resourceId).toBeDefined();

      const saved = await Resource.findById(res.resourceId);
      expect(saved).not.toBeNull();
      expect(saved?.owner.toString()).toBe(userA._id.toString());
      expect(saved?.title).toBe("Calculus Limits Cheatsheet");
      expect(saved?.normalizedTopic).toBe("calculus");
      expect(saved?.url).toBe("https://docs.google.com/document/d/limits-notes");
    });

    it("rejects privileged-field injection via strict schema validation", async () => {
      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: userA,
        session: { user: { id: userA._id.toString() } } as any,
        isAdmin: false,
      });

      // Attempting to inject `owner` or `role` or `_id`
      const res = await createResource({
        title: "Injected Field Test",
        topic: "Physics",
        url: "https://example.com/physics",
        description: "Testing strict rejection of extra properties.",
        owner: userB._id.toString(), // Attacker tries to set owner as userB
        role: "admin",
      } as any);

      expect(res.success).toBe(false);
      expect(res.message).toContain("correct the form errors");

      // Verify no document was saved with userB as owner
      const count = await Resource.countDocuments({ title: "Injected Field Test" });
      expect(count).toBe(0);
    });

    it("rejects unauthenticated resource creation", async () => {
      vi.spyOn(authGuards, "requireAuth").mockRejectedValue(new authGuards.UnauthorizedError());

      const res = await createResource({
        title: "Unauthenticated Resource",
        topic: "Math",
        url: "https://example.com/notes",
        description: "This should fail closed without authentication.",
      });

      expect(res.success).toBe(false);
      expect(res.message).toContain("signed in");
    });
  });

  describe("Ownership Enforcement in Update & Delete", () => {
    let aliceResource: any;

    beforeEach(async () => {
      aliceResource = await Resource.create({
        owner: userA._id,
        title: "Alice's Calculus Guide",
        description: "Original guide to derivatives and integrals.",
        topic: "Calculus",
        normalizedTopic: "calculus",
        url: "https://notion.so/alice-calculus",
      });
    });

    it("allows the owner to update their own resource atomically", async () => {
      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: userA,
        session: { user: { id: userA._id.toString() } } as any,
        isAdmin: false,
      });

      const res = await updateResource({
        resourceId: aliceResource._id.toString(),
        title: "Alice's Updated Calculus Guide",
        topic: "Calculus II",
        url: "https://notion.so/alice-calculus-v2",
        description: "Updated with integration by parts and trigonometric substitution.",
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain("updated successfully");

      const updated = await Resource.findById(aliceResource._id);
      expect(updated?.title).toBe("Alice's Updated Calculus Guide");
      expect(updated?.normalizedTopic).toBe("calculus ii");
      expect(updated?.url).toBe("https://notion.so/alice-calculus-v2");
    });

    it("strictly blocks non-owners from editing someone else's resource", async () => {
      // Bob attempts to edit Alice's resource
      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: userB,
        session: { user: { id: userB._id.toString() } } as any,
        isAdmin: false,
      });

      const res = await updateResource({
        resourceId: aliceResource._id.toString(),
        title: "Bob's Malicious Overwrite",
        topic: "Hacking",
        url: "https://malicious.com/attack",
        description: "Bob trying to deface Alice's resource.",
      });

      expect(res.success).toBe(false);
      expect(res.conflict).toBe(true);
      expect(res.message).toContain("not authorized");

      // Verify Alice's resource is completely unchanged
      const unchanged = await Resource.findById(aliceResource._id);
      expect(unchanged?.title).toBe("Alice's Calculus Guide");
      expect(unchanged?.owner.toString()).toBe(userA._id.toString());
    });

    it("strictly blocks non-owners from deleting someone else's resource", async () => {
      // Bob attempts to delete Alice's resource
      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: userB,
        session: { user: { id: userB._id.toString() } } as any,
        isAdmin: false,
      });

      const res = await deleteResource({
        resourceId: aliceResource._id.toString(),
      });

      expect(res.success).toBe(false);
      expect(res.conflict).toBe(true);

      // Verify Alice's resource still exists in MongoDB
      const stillExists = await Resource.findById(aliceResource._id);
      expect(stillExists).not.toBeNull();
    });

    it("allows the owner to delete their own resource atomically", async () => {
      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: userA,
        session: { user: { id: userA._id.toString() } } as any,
        isAdmin: false,
      });

      const res = await deleteResource({
        resourceId: aliceResource._id.toString(),
      });

      expect(res.success).toBe(true);

      const deleted = await Resource.findById(aliceResource._id);
      expect(deleted).toBeNull();
    });
  });

  describe("Public Resource Listings, Search & Pagination", () => {
    beforeEach(async () => {
      // Seed 3 resources
      await Resource.create([
        {
          owner: userA._id,
          title: "Calculus I Study Guide",
          topic: "Calculus",
          normalizedTopic: "calculus",
          description: "Comprehensive notes for differential calculus.",
          url: "https://docs.google.com/calc1",
          createdAt: new Date(Date.now() - 3000),
        },
        {
          owner: userA._id,
          title: "Linear Algebra Vectors and Matrices",
          topic: "Linear Algebra",
          normalizedTopic: "linear algebra",
          description: "Summary of span, linear independence, and basis.",
          url: "https://docs.google.com/linalg",
          createdAt: new Date(Date.now() - 2000),
        },
        {
          owner: userB._id,
          title: "Physics Mechanics Overview",
          topic: "Physics",
          normalizedTopic: "physics",
          description: "Kinematics, Newton's laws, and conservation of energy.",
          url: "https://notion.so/physics-notes",
          createdAt: new Date(Date.now() - 1000),
        },
      ]);
    });

    it("returns database_empty when 0 resources exist in system", async () => {
      await Resource.deleteMany({});
      const res = await queryResources();
      expect(res.state).toBe("database_empty");
    });

    it("returns no_results when search query has 0 matches", async () => {
      const res = await queryResources({ q: "NonExistentSubject" });
      expect(res.state).toBe("no_results");
      if (res.state === "no_results") {
        expect(res.availableTopics).toContain("Calculus");
        expect(res.availableTopics).toContain("Physics");
      }
    });

    it("filters resources by keyword search across title, description, and topic", async () => {
      const res = await queryResources({ q: "vectors" });
      expect(res.state).toBe("success");
      if (res.state === "success") {
        expect(res.resources.length).toBe(1);
        expect(res.resources[0].title).toBe("Linear Algebra Vectors and Matrices");
      }
    });

    it("filters resources safely by topic with regex metacharacters", async () => {
      await Resource.create({
        owner: userA._id,
        title: "C++ Programming Guide",
        topic: "C++",
        normalizedTopic: "c++",
        description: "Pointers, memory management, and templates.",
        url: "https://example.com/cpp",
      });

      const res = await queryResources({ topic: "C++" });
      expect(res.state).toBe("success");
      if (res.state === "success") {
        expect(res.resources.some((r) => r.topic === "C++")).toBe(true);
      }
    });

    it("enforces stable sorting ({ createdAt: -1, _id: -1 }) and bounded pagination", async () => {
      const res = await queryResources();
      expect(res.state).toBe("success");
      if (res.state === "success") {
        expect(res.resources.length).toBe(3);
        // Newest resource first
        expect(res.resources[0].title).toBe("Physics Mechanics Overview");
        expect(res.pagination.totalCount).toBe(3);
        expect(res.pagination.totalPages).toBe(1);
      }
    });
  });

  describe("Public-Data Privacy Guarantee", () => {
    it("ensures public DTOs strictly exclude contributor email, Google ID, and private contact", async () => {
      await Resource.create({
        owner: userA._id,
        title: "Privacy Verification Resource",
        topic: "Computer Science",
        normalizedTopic: "computer science",
        description: "Checking that personal contact fields never leak to clients.",
        url: "https://notion.so/privacy",
      });

      // Query through getPeerPublishedResources
      const peerResourcesResult = await getPeerPublishedResources(userA._id.toString());
      expect(peerResourcesResult.state).toBe("success");
      expect(peerResourcesResult.resources.length).toBe(1);
      const res = peerResourcesResult.resources[0];

      // Contributor brief has name and university
      expect(res.contributor.name).toBe("Alice Author");
      expect(res.contributor.university).toBe("Central University");

      // MUST NOT contain sensitive fields
      expect((res.contributor as any).email).toBeUndefined();
      expect((res.contributor as any).googleId).toBeUndefined();
      expect((res.contributor as any).contact).toBeUndefined();
      expect((res.contributor as any).whatsapp).toBeUndefined();
      expect((res.contributor as any).meetingLink).toBeUndefined();
      expect((res as any).ownerEmail).toBeUndefined();
    });

    it("allows viewing peer's published resources without requiring an accepted study request", async () => {
      await Resource.create({
        owner: userA._id,
        title: "Open Access Calculus Notes",
        topic: "Calculus",
        normalizedTopic: "calculus",
        description: "Available to any student visiting Alice's profile.",
        url: "https://opennotes.edu/calc",
      });

      // Direct query by any visitor (no study request exists)
      const resResult = await getPeerPublishedResources(userA._id.toString());
      expect(resResult.state).toBe("success");
      expect(resResult.resources.length).toBe(1);
      expect(resResult.resources[0].title).toBe("Open Access Calculus Notes");
    });

    it("does not silently appear as empty list when database query fails", async () => {
      vi.spyOn(Resource, "find").mockImplementationOnce(() => {
        throw new Error("Simulated database failure");
      });

      const resResult = await getPeerPublishedResources(userA._id.toString());
      expect(resResult.state).toBe("error");
      expect(resResult.resources).toEqual([]);
      expect(resResult.message).toContain("temporarily unavailable");
    });
  });

  describe("Rate Limiting on Resource Mutations", () => {
    it("throttles excessive resource creation attempts per user", async () => {
      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: userA,
        session: { user: { id: userA._id.toString() } } as any,
        isAdmin: false,
      });

      // Send 10 allowed requests (limit is 10)
      for (let i = 0; i < 10; i++) {
        const res = await createResource({
          title: `Resource Number ${i}`,
          topic: "Topic",
          url: `https://example.com/res-${i}`,
          description: `Description for resource ${i} with sufficient length.`,
        });
        expect(res.success).toBe(true);
      }

      // 11th request must be throttled
      const throttledRes = await createResource({
        title: "Throttled Resource 11",
        topic: "Topic",
        url: "https://example.com/res-11",
        description: "This 11th creation attempt should be blocked by rate limit.",
      });

      expect(throttledRes.success).toBe(false);
      expect(throttledRes.rateLimited).toBe(true);
      expect(throttledRes.message).toContain("Too many resource submissions");
    });
  });

  describe("getUserResources Security & Pagination Safeguards", () => {
    it("resolves owner identity strictly via requireAuth and returns bounded pagination", async () => {
      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: userA,
        session: { user: { id: userA._id.toString() } } as any,
        isAdmin: false,
      });

      for (let i = 0; i < 10; i++) {
        await Resource.create({
          owner: userA._id,
          title: `Resource ${i}`,
          topic: "Topic",
          normalizedTopic: "topic",
          description: `Description ${i} with sufficient text length.`,
          url: `https://example.com/res-${i}`,
        });
      }

      // UserA has 10 resources
      const res = await getUserResources(1, 5);
      expect(res.state).toBe("success");
      expect(res.pagination.page).toBe(1);
      expect(res.pagination.totalCount).toBe(10);
      expect(res.resources.length).toBe(5);
      expect(res.pagination.hasNext).toBe(true);
    });

    it("returns error state on database failure instead of crashing", async () => {
      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: userA,
        session: { user: { id: userA._id.toString() } } as any,
        isAdmin: false,
      });

      vi.spyOn(Resource, "countDocuments").mockRejectedValueOnce(new Error("DB failure"));

      const res = await getUserResources(1, 10);
      expect(res.state).toBe("error");
      expect(res.resources).toEqual([]);
      expect(res.message).toContain("database error");
    });
  });
});
