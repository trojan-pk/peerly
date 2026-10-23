import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { handlers, auth, signIn, signOut, _resetAuthInstanceForTesting } from "@/auth";
import * as authConfigModule from "@/lib/auth-config";
import * as envConfigModule from "@/lib/env-config";
import * as authGuardsModule from "@/lib/auth-guards";
import * as authCallbacksModule from "@/lib/auth-callbacks";

describe("Application Auth Boundary & Rejected Secret Protection", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    _resetAuthInstanceForTesting();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    _resetAuthInstanceForTesting();
    vi.restoreAllMocks();
  });

  describe("Circular Import Verification", () => {
    it("ensures all modules across the auth boundary initialize cleanly without circular dependency bugs", () => {
      // If circular dependency existed, imported exports would be undefined during module evaluation
      expect(typeof handlers.GET).toBe("function");
      expect(typeof handlers.POST).toBe("function");
      expect(typeof auth).toBe("function");
      expect(typeof signIn).toBe("function");
      expect(typeof signOut).toBe("function");
      expect(typeof authGuardsModule.requireAuth).toBe("function");
      expect(typeof authGuardsModule.requireAdmin).toBe("function");
      expect(typeof authGuardsModule.isEmailAdmin).toBe("function");
      expect(typeof authCallbacksModule.authSignInCallback).toBe("function");
      expect(typeof authCallbacksModule.authJwtCallback).toBe("function");
      expect(typeof authCallbacksModule.authSessionCallback).toBe("function");
      expect(typeof envConfigModule.isValidSecret).toBe("function");
      expect(typeof envConfigModule.isEmailAdmin).toBe("function");
    });
  });

  describe("Auth Entry Points Protected Against Invalid Configuration", () => {
    it("handlers.GET fails closed with 503 when AUTH_SECRET is missing", async () => {
      delete process.env.AUTH_SECRET;
      delete process.env.NEXTAUTH_SECRET;

      const req = new Request("http://localhost:3000/api/auth/session");
      const res = await handlers.GET(req as any);

      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.error).toContain("Authentication service is unavailable");
    });

    it("handlers.GET fails closed with 503 when AUTH_SECRET is the .env.example placeholder", async () => {
      process.env.AUTH_SECRET = "your_auth_secret_here_min_32_chars";
      process.env.AUTH_GOOGLE_ID = "valid-google-id.apps.googleusercontent.com";
      process.env.AUTH_GOOGLE_SECRET = "valid-google-secret";
      process.env.MONGODB_URI = "mongodb://localhost:27017/peerly";

      const req = new Request("http://localhost:3000/api/auth/session");
      const res = await handlers.GET(req as any);

      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.error).toContain("Authentication service is unavailable");
    });

    it("handlers.POST fails closed with 503 when database is not configured", async () => {
      process.env.AUTH_SECRET = "a".repeat(32);
      process.env.AUTH_GOOGLE_ID = "valid-google-id.apps.googleusercontent.com";
      process.env.AUTH_GOOGLE_SECRET = "valid-google-secret";
      delete process.env.MONGODB_URI;

      const req = new Request("http://localhost:3000/api/auth/signin/google", { method: "POST" });
      const res = await handlers.POST(req as any);

      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.error).toContain("Authentication service is unavailable");
    });

    it("handlers.GET fails closed with 503 when Google credentials are placeholders", async () => {
      process.env.AUTH_SECRET = "a".repeat(32);
      process.env.AUTH_GOOGLE_ID = "your_google_oauth_client_id.apps.googleusercontent.com";
      process.env.AUTH_GOOGLE_SECRET = "your_google_oauth_client_secret";
      process.env.MONGODB_URI = "mongodb://localhost:27017/peerly";

      const req = new Request("http://localhost:3000/api/auth/providers");
      const res = await handlers.GET(req as any);

      expect(res.status).toBe(503);
    });

    it("auth() fails closed and returns null when configuration is missing or placeholder", async () => {
      process.env.AUTH_SECRET = "your_auth_secret_here_min_32_chars"; // Placeholder
      delete process.env.MONGODB_URI;

      const session = await auth();
      expect(session).toBeNull();
    });

    it("signIn() throws Error and fails closed when configuration is missing or placeholder", async () => {
      delete process.env.AUTH_SECRET;

      await expect(signIn("google")).rejects.toThrow(
        "Authentication is not configured: valid environment credentials and database are required."
      );
    });

    it("signOut() throws Error and fails closed when configuration is missing or placeholder", async () => {
      delete process.env.AUTH_SECRET;

      await expect(signOut()).rejects.toThrow(
        "Authentication is not configured: valid environment credentials and database are required."
      );
    });
  });

  describe("Valid Configuration Delegation and Auth.js Environment Inference", () => {
    it("lazily initializes Auth.js and delegates handlers with inferred environment credentials", async () => {
      process.env.AUTH_SECRET = "valid_secret_with_more_than_32_characters_here";
      process.env.AUTH_GOOGLE_ID = "test-client-id-12345.apps.googleusercontent.com";
      process.env.AUTH_GOOGLE_SECRET = "test-client-secret-12345";
      process.env.MONGODB_URI = "mongodb://localhost:27017/peerly";
      process.env.AUTH_URL = "http://localhost:3000/api/auth";

      // With valid config, handlers.GET delegating to Auth.js on /api/auth/providers should return 200
      const req = new Request("http://localhost:3000/api/auth/providers");
      const res = await handlers.GET(req as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty("google");
      expect(data.google.id).toBe("google");
      expect(data.google.name).toBe("Google");
      expect(data.google.signinUrl).toContain("/api/auth/signin/google");
    });

    it("delegates auth() call cleanly when valid configuration is present", async () => {
      process.env.AUTH_SECRET = "valid_secret_with_more_than_32_characters_here";
      process.env.AUTH_GOOGLE_ID = "test-client-id-12345.apps.googleusercontent.com";
      process.env.AUTH_GOOGLE_SECRET = "test-client-secret-12345";
      process.env.MONGODB_URI = "mongodb://localhost:27017/peerly";
      process.env.AUTH_URL = "http://localhost:3000/api/auth";

      // When valid config is present and no session cookie, auth() resolves to null without error
      const session = await auth();
      expect(session).toBeNull();
    });
  });

  describe("Auth Configuration Detection", () => {
    it("ensures getAuthConfigStatus correctly identifies placeholder secrets as invalid", () => {
      process.env.AUTH_SECRET = "your_auth_secret_here_min_32_chars";
      const status = authConfigModule.getAuthConfigStatus();
      expect(status.hasAuthSecret).toBe(false);
      expect(status.isConfigured).toBe(false);
      expect(status.missing.some((m) => m.includes("AUTH_SECRET"))).toBe(true);
    });

    it("ensures getAuthConfigStatus correctly rejects weak secrets under 32 characters", () => {
      process.env.AUTH_SECRET = "short-secret";
      const status = authConfigModule.getAuthConfigStatus();
      expect(status.hasAuthSecret).toBe(false);
      expect(status.isConfigured).toBe(false);
    });
  });
});
