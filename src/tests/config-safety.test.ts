import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isValidSecret,
  isValidGoogleId,
  isValidGoogleSecret,
  isValidMongoUri,
  getAdminEmails,
} from "@/lib/env-config";
import { getAuthConfigStatus } from "@/lib/auth-config";

describe("Configuration & Placeholder Rejection", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("isValidSecret", () => {
    it("rejects undefined, empty, or whitespace-only values", () => {
      expect(isValidSecret(undefined)).toBe(false);
      expect(isValidSecret("")).toBe(false);
      expect(isValidSecret("   ")).toBe(false);
    });

    it("rejects known .env.example placeholder", () => {
      expect(isValidSecret("your_auth_secret_here_min_32_chars")).toBe(false);
      expect(isValidSecret("placeholder-secret-value-longer-than-32-chars")).toBe(false);
      expect(isValidSecret("your_auth_secret_longer_than_thirty_two_chars")).toBe(false);
    });

    it("rejects secrets shorter than 32 characters", () => {
      expect(isValidSecret("too-short-secret")).toBe(false);
      expect(isValidSecret("1234567890123456789012345678901")).toBe(false); // 31 chars
    });

    it("accepts valid, strong 32+ character secrets", () => {
      expect(isValidSecret("a".repeat(32))).toBe(true);
      expect(isValidSecret("super-secret-random-token-generated-for-production-use-12345")).toBe(true);
    });
  });

  describe("isValidGoogleId & isValidGoogleSecret", () => {
    it("rejects placeholders and empty values", () => {
      expect(isValidGoogleId("")).toBe(false);
      expect(isValidGoogleId("your_google_oauth_client_id.apps.googleusercontent.com")).toBe(false);
      expect(isValidGoogleSecret("")).toBe(false);
      expect(isValidGoogleSecret("your_google_oauth_client_secret")).toBe(false);
    });

    it("accepts valid Google OAuth credentials", () => {
      expect(isValidGoogleId("1234567890-abcdef.apps.googleusercontent.com")).toBe(true);
      expect(isValidGoogleSecret("GOCSPX-validsecret1234567890")).toBe(true);
    });
  });

  describe("isValidMongoUri", () => {
    it("rejects empty, invalid schemes, and unreplaced template credentials", () => {
      expect(isValidMongoUri("")).toBe(false);
      expect(isValidMongoUri("postgres://localhost:5432/peerly")).toBe(false);
      expect(
        isValidMongoUri("mongodb+srv://<username>:<password>@cluster0.mongodb.net/peerly")
      ).toBe(false);
      expect(isValidMongoUri("your_mongodb_uri_here")).toBe(false);
    });

    it("accepts valid mongodb:// and mongodb+srv:// strings", () => {
      expect(isValidMongoUri("mongodb://localhost:27017/peerly")).toBe(true);
      expect(
        isValidMongoUri("mongodb+srv://dbuser:realpassword123@cluster0.mongodb.net/peerly?retryWrites=true")
      ).toBe(true);
    });
  });

  describe("Google Sign-in Requires Database Configuration", () => {
    it("marks auth as NOT configured if MONGODB_URI is missing or a placeholder", () => {
      process.env.AUTH_SECRET = "a".repeat(32);
      process.env.AUTH_GOOGLE_ID = "valid-google-id.apps.googleusercontent.com";
      process.env.AUTH_GOOGLE_SECRET = "valid-google-secret";
      delete process.env.MONGODB_URI;

      const status = getAuthConfigStatus();
      expect(status.hasGoogleId).toBe(true);
      expect(status.hasGoogleSecret).toBe(true);
      expect(status.hasAuthSecret).toBe(true);
      expect(status.hasDatabase).toBe(false);
      // Google sign-in requires DB persistence, so overall isConfigured must be false
      expect(status.isConfigured).toBe(false);
      expect(status.missing).toContain("MONGODB_URI (required for user persistence)");
    });

    it("marks auth as fully configured only when all credentials AND database are valid", () => {
      process.env.AUTH_SECRET = "a".repeat(32);
      process.env.AUTH_GOOGLE_ID = "valid-google-id.apps.googleusercontent.com";
      process.env.AUTH_GOOGLE_SECRET = "valid-google-secret";
      process.env.MONGODB_URI = "mongodb://localhost:27017/peerly";

      const status = getAuthConfigStatus();
      expect(status.isConfigured).toBe(true);
      expect(status.missing).toHaveLength(0);
    });
  });

  describe("ADMIN_EMAILS parsing", () => {
    it("normalizes, trims, and lowercases admin emails", () => {
      process.env.ADMIN_EMAILS = " Admin@Uni.edu , MOD@Campus.Edu, , ";
      const admins = getAdminEmails();
      expect(admins.has("admin@uni.edu")).toBe(true);
      expect(admins.has("mod@campus.edu")).toBe(true);
      expect(admins.size).toBe(2);
    });

    it("returns empty set when ADMIN_EMAILS is unset or empty", () => {
      delete process.env.ADMIN_EMAILS;
      expect(getAdminEmails().size).toBe(0);
    });
  });
});
