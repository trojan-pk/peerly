import { describe, it, expect } from "vitest";
import { ProfileUpdateSchema, ContactUpdateSchema } from "@/lib/validations/user";

describe("Profile Validation & Privileged Field Protection", () => {
  describe("Meeting link actual URL parsing", () => {
    it("accepts valid HTTP and HTTPS URLs", () => {
      const validUrls = [
        "https://meet.google.com/abc-defg-hij",
        "https://zoom.us/j/1234567890",
        "http://localhost:3000/test-room",
        "", // Optional
      ];

      for (const url of validUrls) {
        const result = ContactUpdateSchema.safeParse({ meetingLink: url });
        expect(result.success, `Failed on: ${url}`).toBe(true);
      }
    });

    it("rejects non-HTTP/HTTPS protocols and malicious URIs", () => {
      const invalidUrls = [
        "javascript:alert(document.cookie)",
        "data:text/html,<script>alert(1)</script>",
        "ftp://university.edu/meeting",
        "file:///etc/passwd",
        "chrome://settings",
      ];

      for (const url of invalidUrls) {
        const result = ContactUpdateSchema.safeParse({ meetingLink: url });
        expect(result.success, `Should reject: ${url}`).toBe(false);
      }
    });

    it("rejects malformed URLs lacking protocol or hostname", () => {
      const malformedUrls = [
        "meet.google.com/abc", // Missing protocol
        "https://", // Missing hostname
        "https:///", // Missing hostname
        "not-a-valid-url",
      ];

      for (const url of malformedUrls) {
        const result = ContactUpdateSchema.safeParse({ meetingLink: url });
        expect(result.success, `Should reject: ${url}`).toBe(false);
      }
    });
  });

  describe("Privileged field rejection", () => {
    const baseValidInput = {
      name: "Jordan Student",
      bio: "Calculus and Physics peer helper.",
      university: "Central University",
      campus: "Downtown",
      topics: ["Calculus I", "Mechanics"],
      subjects: ["Mathematics", "Physics"],
      mode: "both" as const,
      availability: "Mon/Wed evenings",
      pricingPreference: "free" as const,
      contact: {
        whatsapp: "+1234567890",
        meetingLink: "https://meet.google.com/xyz-room",
        preferredMethod: "whatsapp" as const,
      },
    };

    it("accepts legitimate student profile updates", () => {
      const result = ProfileUpdateSchema.safeParse(baseValidInput);
      expect(result.success).toBe(true);
    });

    it("strictly rejects attempts to modify the 'role' field", () => {
      const maliciousPayload = {
        ...baseValidInput,
        role: "admin",
      };

      const result = ProfileUpdateSchema.safeParse(maliciousPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const roleIssue = result.error.issues.find((i) => i.path.includes("role") || (i as any).keys?.includes("role"));
        expect(roleIssue).toBeDefined();
      }
    });

    it("strictly rejects attempts to manipulate isProfileComplete, reviews, or identity", () => {
      const privilegedAttempts = [
        { ...baseValidInput, isProfileComplete: true },
        { ...baseValidInput, reviewCount: 99 },
        { ...baseValidInput, averageRating: 5.0 },
        { ...baseValidInput, email: "attacker@university.edu" },
        { ...baseValidInput, googleId: "fake-google-id" },
        { ...baseValidInput, responseCount: 100 },
        { ...baseValidInput, averageResponseTimeHours: 0.1 },
      ];

      for (const payload of privilegedAttempts) {
        const result = ProfileUpdateSchema.safeParse(payload);
        expect(result.success).toBe(false);
      }
    });
  });
});
