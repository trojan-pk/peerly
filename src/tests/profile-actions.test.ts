import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateProfile } from "@/app/profile/actions";
import * as authGuards from "@/lib/auth-guards";
import * as authModule from "@/auth";
import * as dbModule from "@/lib/db";
import { User } from "@/models/User";
import * as rateLimitModule from "@/lib/rate-limit";
import {
  calculateProfileCompletion,
  normalizeTags,
} from "@/lib/validations/user";

describe("Profile Server Actions & Security Enforcements", () => {
  const mockSavedUser: Record<string, any> = {
    _id: "user_12345",
    email: "student@university.edu",
    role: "student",
    googleId: "google_12345",
    isProfileComplete: false,
    reviewCount: 0,
    averageRating: 0,
    save: vi.fn().mockResolvedValue(true),
  };

  it("does not write when profile updates are throttled", async () => {
    vi.spyOn(authGuards, "requireAuth").mockResolvedValue({ user: mockSavedUser, session: {}, isAdmin: false } as any);
    vi.spyOn(rateLimitModule, "checkRateLimit").mockResolvedValue({ allowed: false, retryAfterSeconds: 30 });
    const result = await updateProfile({ name: "Student" });
    expect(result.success).toBe(false);
    expect(result.message).toContain("30 seconds");
    expect(mockSavedUser.save).not.toHaveBeenCalled();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(rateLimitModule, "checkRateLimit").mockResolvedValue({ allowed: true });
    mockSavedUser.save.mockClear();
  });

  describe("Unauthorized Profile Writes", () => {
    it("fails closed when unauthenticated user invokes updateProfile", async () => {
      vi.spyOn(authGuards, "requireAuth").mockRejectedValue(
        new authGuards.UnauthorizedError()
      );

      const result = await updateProfile({
        name: "Test Student",
        university: "Tech Institute",
        topics: ["Physics"],
        subjects: ["Science"],
        mode: "both",
        availability: "Anytime",
        pricingPreference: "free",
        contact: {
          whatsapp: "",
          meetingLink: "",
          preferredMethod: "unspecified",
        },
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("You must be signed in");
      expect(mockSavedUser.save).not.toHaveBeenCalled();
    });
  });

  describe("Privileged-Field Injection Rejection", () => {
    it("strictly rejects attempts to inject role: admin via server action", async () => {
      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: mockSavedUser as any,
        session: { user: { id: "user_12345" } } as any,
        isAdmin: false,
      });

      const maliciousPayload = {
        name: "Test Student",
        university: "Tech Institute",
        topics: ["Math"],
        subjects: ["STEM"],
        mode: "both",
        availability: "Evenings",
        pricingPreference: "free",
        contact: {
          whatsapp: "",
          meetingLink: "",
          preferredMethod: "unspecified",
        },
        role: "admin", // Privileged field injection attempt
      };

      const result = await updateProfile(maliciousPayload);

      expect(result.success).toBe(false);
      expect(result.message).toContain("Please correct the errors");
      expect(mockSavedUser.save).not.toHaveBeenCalled();
      expect(mockSavedUser.role).toBe("student");
    });

    it("strictly rejects attempts to manipulate completion status or review metrics directly", async () => {
      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: mockSavedUser as any,
        session: { user: { id: "user_12345" } } as any,
        isAdmin: false,
      });

      const privilegedAttempts = [
        { isProfileComplete: true },
        { reviewCount: 50 },
        { averageRating: 5.0 },
        { googleId: "injected_google_id" },
        { email: "hacked@university.edu" },
      ];

      for (const attempt of privilegedAttempts) {
        const payload = {
          name: "Test Student",
          university: "Tech Institute",
          topics: ["Math"],
          subjects: ["STEM"],
          mode: "both",
          availability: "Evenings",
          pricingPreference: "free",
          contact: {
            whatsapp: "",
            meetingLink: "",
            preferredMethod: "unspecified",
          },
          ...attempt,
        };

        const result = await updateProfile(payload);
        expect(result.success).toBe(false);
        expect(mockSavedUser.save).not.toHaveBeenCalled();
      }
    });
  });

  describe("Ownership Enforcement", () => {
    it("determines user strictly from requireAuth() and ignores any submitted ID", async () => {
      const realUser: Record<string, any> = {
        ...mockSavedUser,
        _id: "legitimate_session_user_id",
        name: "Original Name",
        bio: "Original Bio",
        university: "Original University",
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(authGuards, "requireAuth").mockResolvedValue({
        user: realUser as any,
        session: { user: { id: "legitimate_session_user_id" } } as any,
        isAdmin: false,
      });

      const validPayload = {
        name: "Updated Name",
        bio: "Updated Bio",
        university: "MIT",
        campus: "Cambridge",
        topics: ["Algorithms"],
        subjects: ["CS"],
        mode: "online" as const,
        availability: "Weekends",
        pricingPreference: "free" as const,
        contact: {
          whatsapp: "",
          meetingLink: "https://meet.google.com/test-room",
          preferredMethod: "meeting_link" as const,
        },
      };

      const result = await updateProfile(validPayload);

      expect(result.success).toBe(true);
      expect(realUser.name).toBe("Updated Name");
      expect(realUser.bio).toBe("Updated Bio");
      expect(realUser.university).toBe("MIT");
      expect(realUser.save).toHaveBeenCalled();
    });
  });

  describe("Server-Side Profile Completion Calculation", () => {
    it("marks profile complete when name, university, topics/subjects, and availability are provided", () => {
      const isComplete = calculateProfileCompletion({
        name: "Alice Scholar",
        university: "UC Berkeley",
        topics: ["Calculus", "Linear Algebra"],
        subjects: ["Mathematics"],
        availability: "Tuesdays 2-4 PM",
      });

      expect(isComplete).toBe(true);
    });

    it("marks profile incomplete if university is missing", () => {
      const isComplete = calculateProfileCompletion({
        name: "Alice Scholar",
        university: "",
        topics: ["Calculus"],
        subjects: [],
        availability: "Tuesdays 2-4 PM",
      });

      expect(isComplete).toBe(false);
    });

    it("marks profile incomplete if both topics and subjects are empty", () => {
      const isComplete = calculateProfileCompletion({
        name: "Alice Scholar",
        university: "UC Berkeley",
        topics: [],
        subjects: [],
        availability: "Tuesdays 2-4 PM",
      });

      expect(isComplete).toBe(false);
    });

    it("marks profile incomplete if availability is empty", () => {
      const isComplete = calculateProfileCompletion({
        name: "Alice Scholar",
        university: "UC Berkeley",
        topics: ["Calculus"],
        subjects: ["Math"],
        availability: "   ",
      });

      expect(isComplete).toBe(false);
    });

    it("marks profile incomplete if name is under 2 characters", () => {
      const isComplete = calculateProfileCompletion({
        name: "A",
        university: "UC Berkeley",
        topics: ["Calculus"],
        subjects: ["Math"],
        availability: "Anytime",
      });

      expect(isComplete).toBe(false);
    });
  });

  describe("Tag Normalization & Deduplication", () => {
    it("trims whitespace and deduplicates topics case-insensitively", () => {
      const rawTopics = [
        "  Calculus  ",
        "calculus",
        "Linear Algebra",
        "LINEAR ALGEBRA",
        "",
        "   ",
        "Physics I",
      ];

      const normalized = normalizeTags(rawTopics);
      expect(normalized).toEqual(["Calculus", "Linear Algebra", "Physics I"]);
    });
  });

  describe("Profile Page Database Failure Safety", () => {
    it("renders safe error state and does not show an empty editable form if user lookup fails", async () => {
      vi.spyOn(authModule, "auth").mockResolvedValue({
        user: { id: "user_fail_test", email: "test@university.edu" },
      } as any);

      vi.spyOn(dbModule, "isDatabaseConfigured").mockReturnValue(true);
      vi.spyOn(dbModule, "connectToDatabase").mockResolvedValue({} as any);

      vi.spyOn(User, "findById").mockImplementation(() => {
        throw new Error("MongoDB query failure");
      });

      const ProfilePage = (await import("@/app/profile/page")).default;
      const res: any = await ProfilePage();

      function extractText(node: any): string {
        if (!node) return "";
        if (typeof node === "string" || typeof node === "number") return String(node);
        if (Array.isArray(node)) return node.map(extractText).join(" ");
        if (node.props?.children) return extractText(node.props.children);
        return "";
      }

      const text = extractText(res);
      expect(text).toContain("Unable to Load Profile");
      expect(text).toContain("To protect your existing data");
      expect(text).not.toContain("Academic Identity");
    });
  });
});
