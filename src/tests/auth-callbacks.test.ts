import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  authSignInCallback,
  authJwtCallback,
  authSessionCallback,
} from "@/lib/auth-callbacks";
import { User } from "@/models/User";
import * as dbModule from "@/lib/db";

describe("Authentication Callbacks, Identity Safety & Session Issuance", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(dbModule, "connectToDatabase").mockResolvedValue({} as any);
    vi.spyOn(dbModule, "isDatabaseConfigured").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("signIn callback", () => {
    it("rejects non-Google providers", async () => {
      const allowed = await authSignInCallback({
        user: { email: "test@uni.edu" },
        account: { provider: "github", providerAccountId: "123" } as any,
        profile: { email_verified: true },
      });
      expect(allowed).toBe(false);
    });

    it("rejects accounts with unverified Google email", async () => {
      const allowed = await authSignInCallback({
        user: { email: "unverified@uni.edu" },
        account: { provider: "google", providerAccountId: "gid-123" } as any,
        profile: { email_verified: false },
      });
      expect(allowed).toBe(false);
    });

    it("rejects sign-in when database is not configured", async () => {
      vi.spyOn(dbModule, "isDatabaseConfigured").mockReturnValue(false);

      const allowed = await authSignInCallback({
        user: { email: "student@uni.edu" },
        account: { provider: "google", providerAccountId: "gid-123" } as any,
        profile: { email_verified: true },
      });
      expect(allowed).toBe(false);
    });

    it("IDENTITY CONFLICT A: rejects if Google ID is already linked to a different email address", async () => {
      const existingUser = {
        _id: "user-1",
        googleId: "gid-abc",
        email: "original@uni.edu",
      };

      vi.spyOn(User, "findOne").mockImplementation((query: any) => {
        return {
          select: vi.fn().mockImplementation(() => {
            if (query.googleId === "gid-abc") {
              return Promise.resolve(existingUser);
            }
            return Promise.resolve(null);
          }),
        } as any;
      });

      const allowed = await authSignInCallback({
        user: { email: "intruder@uni.edu" },
        account: { provider: "google", providerAccountId: "gid-abc" } as any,
        profile: { email_verified: true },
      });

      expect(allowed).toBe(false);
    });

    it("IDENTITY CONFLICT B: rejects if email is already linked to a different Google account ID", async () => {
      const existingUser = {
        _id: "user-2",
        googleId: "gid-original",
        email: "registered@uni.edu",
      };

      vi.spyOn(User, "findOne").mockImplementation((query: any) => {
        return {
          select: vi.fn().mockImplementation(() => {
            if (query.email === "registered@uni.edu") {
              return Promise.resolve(existingUser);
            }
            return Promise.resolve(null);
          }),
        } as any;
      });

      const allowed = await authSignInCallback({
        user: { email: "registered@uni.edu" },
        account: { provider: "google", providerAccountId: "gid-attacker" } as any,
        profile: { email_verified: true },
      });

      expect(allowed).toBe(false);
    });

    it("safely syncs existing user when googleId and email match", async () => {
      const existingUser = {
        _id: "user-valid",
        googleId: "gid-valid",
        email: "valid@uni.edu",
        name: "",
        image: "",
        role: "student",
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(User, "findOne").mockImplementation((query: any) => {
        return {
          select: vi.fn().mockImplementation(() => {
            if (query.googleId === "gid-valid") return Promise.resolve(existingUser);
            if (query.email === "valid@uni.edu") return Promise.resolve(existingUser);
            return Promise.resolve(null);
          }),
        } as any;
      });

      const allowed = await authSignInCallback({
        user: { email: "valid@uni.edu", name: "New Name", image: "https://photo.url" },
        account: { provider: "google", providerAccountId: "gid-valid" } as any,
        profile: { email_verified: true },
      });

      expect(allowed).toBe(true);
      expect(existingUser.save).toHaveBeenCalled();
      expect(existingUser.name).toBe("New Name");
      expect(existingUser.image).toBe("https://photo.url");
    });

    it("preserves an edited name and explicitly removed photo on the next Google sign-in", async () => {
      const existing = { _id: "existing", googleId: "gid-edited", email: "edited@uni.edu", name: "Edited Name", image: "", avatarUpdated: true, role: "student", save: vi.fn().mockResolvedValue(true) };
      vi.spyOn(User, "findOne").mockReturnValue({ select: vi.fn().mockResolvedValue(existing) } as any);
      expect(await authSignInCallback({ user: { email: "edited@uni.edu", name: "Google Name", image: "https://photo.url" }, account: { provider: "google", providerAccountId: "gid-edited" } as any, profile: { email_verified: true } })).toBe(true);
      expect(existing.name).toBe("Edited Name"); expect(existing.image).toBe("");
    });

    it("creates a new user when no matching record exists", async () => {
      vi.spyOn(User, "findOne").mockImplementation(() => {
        return {
          select: vi.fn().mockResolvedValue(null),
        } as any;
      });

      const createSpy = vi.spyOn(User, "create").mockResolvedValue({} as any);

      const allowed = await authSignInCallback({
        user: { email: "newstudent@uni.edu", name: "First Year" },
        account: { provider: "google", providerAccountId: "gid-new" } as any,
        profile: { email_verified: true },
      });

      expect(allowed).toBe(true);
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "newstudent@uni.edu",
          googleId: "gid-new",
          name: "First Year",
          role: "student",
        })
      );
    });
  });

  describe("jwt callback", () => {
    it("fails closed (returns empty token) if persisted user cannot be found in database", async () => {
      vi.spyOn(User, "findOne").mockResolvedValue(null);

      const token = await authJwtCallback({
        token: {},
        user: { email: "ghost@uni.edu" },
        account: { providerAccountId: "gid-ghost" } as any,
      });

      expect(token?.userId).toBeUndefined();
      expect(Object.keys(token || {})).toHaveLength(0);
    });

    it("attaches verified database userId to JWT token", async () => {
      const mockDbUser = {
        _id: "mongodb-object-id-12345",
        email: "verified@uni.edu",
        role: "student",
        isProfileComplete: false,
      };

      vi.spyOn(User, "findOne").mockResolvedValue(mockDbUser as any);

      const token = await authJwtCallback({
        token: {},
        user: { email: "verified@uni.edu" },
        account: { providerAccountId: "gid-123" } as any,
      });

      expect(token?.userId).toBe("mongodb-object-id-12345");
      expect(token?.role).toBe("student");
    });

    it("invalidates subsequent token calls if userId is missing", async () => {
      const token = await authJwtCallback({
        token: { someOtherData: "value" },
      });

      expect(token?.userId).toBeUndefined();
      expect(Object.keys(token || {})).toHaveLength(0);
    });
  });

  describe("session callback", () => {
    it("never issues a usable session without a valid database user ID", async () => {
      const invalidToken = {}; // Missing userId

      const session = await authSessionCallback({
        session: { user: { name: "Fake" } as any, expires: new Date("2099-01-01").toISOString() as any },
        token: invalidToken,
      });

      expect(session.user).toBeUndefined();
    });

    it("populates session user from token with resolved database userId", async () => {
      const validToken = {
        userId: "db-user-id-555",
        role: "student" as const,
        isProfileComplete: true,
      };

      const session = await authSessionCallback({
        session: { user: {} as any, expires: new Date("2099-01-01").toISOString() as any },
        token: validToken,
      });

      expect(session.user?.id).toBe("db-user-id-555");
      expect(session.user?.role).toBe("student");
      expect(session.user?.isProfileComplete).toBe(true);
    });
  });
});
