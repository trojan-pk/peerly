import { auth } from "@/auth";
import { connectToDatabase, isDatabaseConfigured } from "./db";
import { User, IUserDocument } from "@/models/User";
import { isEmailAdmin } from "./env-config";
import type { Session } from "next-auth";

export { isEmailAdmin } from "./env-config";

export class UnauthorizedError extends Error {
  constructor(message = "Authentication is required to perform this action.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Administrative privileges are required.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export interface AuthenticatedUserContext {
  user: IUserDocument;
  session: Session;
  isAdmin: boolean;
}

/**
 * Resolves the authenticated user from the database.
 * Does NOT trust stale JWT role claims.
 * Returns null if unauthenticated or if the user no longer exists in MongoDB.
 */
export async function getCurrentDbUser(): Promise<AuthenticatedUserContext | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  if (!isDatabaseConfigured()) {
    return null;
  }

  try {
    await connectToDatabase();
    const user = await User.findById(session.user.id);
    if (!user) {
      return null;
    }

    // Sole authority for admin privileges is the current ADMIN_EMAILS environment variable
    const isAdmin = isEmailAdmin(user.email);

    // Synchronize database role if it differs from current ADMIN_EMAILS configuration
    const expectedRole = isAdmin ? "admin" : "student";
    if (user.role !== expectedRole) {
      user.role = expectedRole;
      await user.save();
    }

    return {
      user,
      session,
      isAdmin,
    };
  } catch (error) {
    console.error("[getCurrentDbUser] Database error:", error);
    return null;
  }
}

/**
 * Guard that enforces an active, verified database user session.
 * Throws UnauthorizedError if unauthenticated.
 */
export async function requireAuth(): Promise<AuthenticatedUserContext> {
  const context = await getCurrentDbUser();
  if (!context) {
    throw new UnauthorizedError();
  }
  return context;
}

/**
 * Guard that enforces administrative access based on active ADMIN_EMAILS.
 * Removing an email from ADMIN_EMAILS immediately revokes access for all existing sessions.
 * Throws ForbiddenError if user is not an administrator.
 */
export async function requireAdmin(): Promise<AuthenticatedUserContext> {
  const context = await requireAuth();
  if (!context.isAdmin) {
    throw new ForbiddenError();
  }
  return context;
}
