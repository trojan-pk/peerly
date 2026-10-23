import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getAuthConfigStatus } from "@/lib/auth-config";

describe("Auth Configuration Inspector", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    delete process.env.AUTH_GOOGLE_ID;
    delete process.env.AUTH_GOOGLE_SECRET;
    delete process.env.MONGODB_URI;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("identifies all missing environment variables when unconfigured", () => {
    const status = getAuthConfigStatus();
    expect(status.isConfigured).toBe(false);
    expect(status.missing.some((m) => m.includes("AUTH_SECRET"))).toBe(true);
    expect(status.missing.some((m) => m.includes("AUTH_GOOGLE_ID"))).toBe(true);
    expect(status.missing.some((m) => m.includes("AUTH_GOOGLE_SECRET"))).toBe(true);
    expect(status.missing.some((m) => m.includes("MONGODB_URI"))).toBe(true);
  });

  it("reports configured when all credentials and database are set", () => {
    process.env.AUTH_SECRET = "super-secure-secret-key-at-least-32-chars";
    process.env.AUTH_GOOGLE_ID = "mock-google-client-id.apps.googleusercontent.com";
    process.env.AUTH_GOOGLE_SECRET = "mock-google-client-secret";
    process.env.MONGODB_URI = "mongodb://localhost:27017/peerly";

    const status = getAuthConfigStatus();
    expect(status.isConfigured).toBe(true);
    expect(status.missing).toHaveLength(0);
    expect(status.hasAuthSecret).toBe(true);
    expect(status.hasGoogleId).toBe(true);
    expect(status.hasGoogleSecret).toBe(true);
    expect(status.hasDatabase).toBe(true);
  });
});
