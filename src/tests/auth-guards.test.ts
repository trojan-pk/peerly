import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  requireAuth,
  requireAdmin,
  isEmailAdmin,
  UnauthorizedError,
  ForbiddenError,
} from "@/lib/auth-guards";
import * as authModule from "@/auth";
import { User } from "@/models/User";

vi.mock("@/lib/db", () => ({
  connectToDatabase: vi.fn().mockResolvedValue({}),
  isDatabaseConfigured: vi.fn().mockReturnValue(true),
}));

describe("Server Authorization Guards & Admin Revocation", () => {
  const originalAdminEmails = process.env.ADMIN_EMAILS;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalAdminEmails !== undefined) {
      process.env.ADMIN_EMAILS = originalAdminEmails;
    } else {
      delete process.env.ADMIN_EMAILS;
    }
  });

  describe("isEmailAdmin", () => {
    it("checks email against dynamic ADMIN_EMAILS environment variable", () => {
      process.env.ADMIN_EMAILS = "faculty@uni.edu,dean@uni.edu";
      expect(isEmailAdmin("faculty@uni.edu")).toBe(true);
      expect(isEmailAdmin("student@uni.edu")).toBe(false);
      expect(isEmailAdmin(undefined)).toBe(false);
    });
  });

  describe("requireAuth", () => {
    it("throws UnauthorizedError when session does not exist", async () => {
      vi.spyOn(authModule, "auth").mockResolvedValue(null as any);

      await expect(requireAuth()).rejects.toThrow(UnauthorizedError);
    });

    it("throws UnauthorizedError when user ID in session is not found in database", async () => {
      vi.spyOn(authModule, "auth").mockResolvedValue({
        user: { id: "deleted-user-id", email: "deleted@uni.edu" },
      } as any);

      vi.spyOn(User, "findById").mockResolvedValue(null);

      await expect(requireAuth()).rejects.toThrow(UnauthorizedError);
    });

    it("returns authenticated user and session when user is valid in database", async () => {
      vi.spyOn(authModule, "auth").mockResolvedValue({
        user: { id: "user-123", email: "active@uni.edu" },
      } as any);

      const mockDbUser = {
        _id: "user-123",
        email: "active@uni.edu",
        name: "Active Student",
        role: "student",
        save: vi.fn().mockResolvedValue(true),
      };
      vi.spyOn(User, "findById").mockResolvedValue(mockDbUser as any);

      const context = await requireAuth();
      expect(context.user.email).toBe("active@uni.edu");
      expect(context.isAdmin).toBe(false);
    });
  });

  describe("requireAdmin and Immediate Admin Revocation", () => {
    it("grants admin access when user email is present in ADMIN_EMAILS", async () => {
      process.env.ADMIN_EMAILS = "admin@uni.edu";

      vi.spyOn(authModule, "auth").mockResolvedValue({
        user: { id: "admin-1", email: "admin@uni.edu" },
      } as any);

      const mockDbUser = {
        _id: "admin-1",
        email: "admin@uni.edu",
        role: "student",
        save: vi.fn().mockResolvedValue(true),
      };
      vi.spyOn(User, "findById").mockResolvedValue(mockDbUser as any);

      const context = await requireAdmin();
      expect(context.isAdmin).toBe(true);
      // Synchronized database role to admin
      expect(mockDbUser.role).toBe("admin");
    });

    it("REVOCATION: removing email from ADMIN_EMAILS immediately revokes access for existing sessions", async () => {
      // Step 1: User is admin
      process.env.ADMIN_EMAILS = "former-admin@uni.edu,dean@uni.edu";

      vi.spyOn(authModule, "auth").mockResolvedValue({
        user: { id: "admin-1", email: "former-admin@uni.edu" },
      } as any);

      const mockDbUser = {
        _id: "admin-1",
        email: "former-admin@uni.edu",
        role: "admin",
        save: vi.fn().mockResolvedValue(true),
      };
      vi.spyOn(User, "findById").mockResolvedValue(mockDbUser as any);

      // Successfully passes while in ADMIN_EMAILS
      const activeContext = await requireAdmin();
      expect(activeContext.isAdmin).toBe(true);

      // Step 2: Administrator removes the email from ADMIN_EMAILS
      process.env.ADMIN_EMAILS = "dean@uni.edu";

      // Same user session now attempts an admin operation
      await expect(requireAdmin()).rejects.toThrow(ForbiddenError);
      // Verifies role demotion in DB
      expect(mockDbUser.role).toBe("student");
    });

    it("STALE JWT: user with token claiming admin is denied if not in ADMIN_EMAILS", async () => {
      delete process.env.ADMIN_EMAILS; // No admins configured

      // Stale or forged session token claiming role="admin"
      vi.spyOn(authModule, "auth").mockResolvedValue({
        user: { id: "user-999", email: "student@uni.edu", role: "admin" },
      } as any);

      const mockDbUser = {
        _id: "user-999",
        email: "student@uni.edu",
        role: "admin", // Even if DB record had old admin role
        save: vi.fn().mockResolvedValue(true),
      };
      vi.spyOn(User, "findById").mockResolvedValue(mockDbUser as any);

      // Denies admin access because ADMIN_EMAILS is the sole authority
      await expect(requireAdmin()).rejects.toThrow(ForbiddenError);
      expect(mockDbUser.role).toBe("student");
    });
  });
});
