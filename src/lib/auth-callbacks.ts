import { connectToDatabase, isDatabaseConfigured } from "@/lib/db";
import { User } from "@/models/User";
import { isEmailAdmin } from "@/lib/env-config";
import type { UserRole } from "@/types/user";
import type { Account, Profile, Session, User as AuthUser } from "next-auth";
import type { JWT } from "next-auth/jwt";

export interface SignInCallbackParams {
  user: AuthUser | { email?: string | null; name?: string | null; image?: string | null };
  account?: Account | null;
  profile?: Profile | { email_verified?: boolean | string | null; sub?: string };
}

export interface JwtCallbackParams {
  token: JWT;
  user?: AuthUser | { email?: string | null; name?: string | null; image?: string | null };
  account?: Account | null;
  profile?: Profile | { email_verified?: boolean | string | null; sub?: string };
  trigger?: "signIn" | "signUp" | "update";
  session?: unknown;
}

export interface SessionCallbackParams {
  session: Session;
  token: JWT;
}

export async function authSignInCallback({
  user,
  account,
  profile,
}: SignInCallbackParams): Promise<boolean> {
  // 1. Strictly enforce Google OAuth
  if (account?.provider !== "google") {
    console.warn("[Auth] Rejected sign-in: provider is not Google.");
    return false;
  }

  // 2. Require a verified Google email
  const rawVerified = (profile as Record<string, unknown> | undefined)?.email_verified;
  const isEmailVerified = Boolean(rawVerified === true || rawVerified === "true");
  if (!isEmailVerified || !user?.email) {
    console.warn("[Auth] Rejected sign-in: Google account email is unverified or missing.");
    return false;
  }

  // 3. Identify account by Google's immutable provider ID
  const googleId = account.providerAccountId || (profile?.sub as string);
  if (!googleId || typeof googleId !== "string" || googleId.trim().length === 0) {
    console.warn("[Auth] Rejected sign-in: Missing Google provider account ID.");
    return false;
  }

  // 4. Google sign-in requires database configuration
  if (!isDatabaseConfigured()) {
    console.error("[Auth] Rejected sign-in: Database is not configured.");
    return false;
  }

  try {
    await connectToDatabase();
    const normalizedEmail = user.email.toLowerCase().trim();

    // 5. Detect and reject conflicting identities safely.
    // Query both identities with +googleId since googleId is select: false by default
    const userByGoogleId = await User.findOne({ googleId }).select("+googleId");
    const userByEmail = await User.findOne({ email: normalizedEmail }).select("+googleId");

    // Identity conflict Case A: Google ID is already linked to a different email address
    if (userByGoogleId && userByGoogleId.email.toLowerCase() !== normalizedEmail) {
      console.error(
        "[Auth] Identity conflict: Google account ID is already registered to a different email."
      );
      return false;
    }

    // Identity conflict Case B: Email address is already linked to a different Google account ID
    if (userByEmail && userByEmail.googleId && userByEmail.googleId !== googleId) {
      console.error(
        "[Auth] Identity conflict: Email address is already linked to a different Google account."
      );
      return false;
    }

    const isAdmin = isEmailAdmin(normalizedEmail);

    if (userByGoogleId) {
      // Existing user identified by immutable googleId
      if (!userByGoogleId.name && user.name) {
        userByGoogleId.name = user.name.trim();
      }
      if (user.image && !userByGoogleId.image) {
        userByGoogleId.image = user.image;
      }
      userByGoogleId.role = isAdmin ? "admin" : "student";
      await userByGoogleId.save();
    } else if (userByEmail) {
      // User exists with same email and unlinked/matching googleId
      userByEmail.googleId = googleId;
      if (!userByEmail.name && user.name) {
        userByEmail.name = user.name.trim();
      }
      if (user.image && !userByEmail.image) {
        userByEmail.image = user.image;
      }
      userByEmail.role = isAdmin ? "admin" : "student";
      await userByEmail.save();
    } else {
      // Safe first-time user creation
      await User.create({
        googleId,
        email: normalizedEmail,
        name: (user.name || "Peerly Student").trim(),
        image: user.image || "",
        role: isAdmin ? "admin" : "student",
        isProfileComplete: false,
      });
    }

    return true;
  } catch (error) {
    console.error("[Auth] Persistence error during Google sign-in:", error);
    return false;
  }
}

export async function authJwtCallback({
  token,
  user,
  account,
  profile,
}: JwtCallbackParams): Promise<JWT> {
  if (user?.email) {
    try {
      if (!isDatabaseConfigured()) {
        return {};
      }

      await connectToDatabase();
      const normalizedEmail = user.email.toLowerCase().trim();
      const googleId = account?.providerAccountId || (profile?.sub as string);

      const dbUser = googleId
        ? await User.findOne({ googleId })
        : await User.findOne({ email: normalizedEmail });

      // Initial JWT creation must fail if the persisted user cannot be resolved
      if (!dbUser || !dbUser._id) {
        console.error("[Auth] Persisted user could not be resolved during JWT creation.");
        return {};
      }

      token.userId = dbUser._id.toString();
      token.role = isEmailAdmin(dbUser.email) ? "admin" : "student";
      token.isProfileComplete = dbUser.isProfileComplete;
    } catch (error) {
      console.error("[Auth] Error resolving user for JWT:", error);
      return {};
    }
  }

  // Invalidate if token does not carry a resolved database user ID
  if (!token.userId) {
    return {};
  }

  return token;
}

export async function authSessionCallback({
  session,
  token,
}: SessionCallbackParams): Promise<Session> {
  // Never issue a usable session without a valid database user ID
  if (!token?.userId) {
    return {
      ...session,
      user: undefined as unknown as Session["user"],
      expires: new Date(0).toISOString(),
    };
  }

  session.user.id = token.userId as string;
  session.user.role = (token.role as UserRole) || "student";
  session.user.isProfileComplete = Boolean(token.isProfileComplete);
  return session;
}

export const authCallbacks = {
  signIn: authSignInCallback,
  jwt: authJwtCallback,
  session: authSessionCallback,
};
