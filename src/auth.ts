import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getAuthConfigStatus } from "@/lib/auth-config";
import { authCallbacks } from "@/lib/auth-callbacks";
import { NextRequest } from "next/server";

type NextAuthInstance = ReturnType<typeof NextAuth>;

let cachedInstance: NextAuthInstance | null = null;

/**
 * Lazily initializes the NextAuth instance ONLY after configuration passes validation.
 * When configuration is invalid or missing, returns null so all exported entry points
 * can fail closed without Auth.js initialization.
 */
function getAuthInstance(): NextAuthInstance | null {
  if (!getAuthConfigStatus().isConfigured) {
    cachedInstance = null;
    return null;
  }

  if (!cachedInstance) {
    cachedInstance = NextAuth({
      providers: [Google],
      session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60, // 30 days
      },
      pages: {
        signIn: "/login",
        error: "/login",
      },
      callbacks: authCallbacks,
    });
  }

  return cachedInstance;
}

/**
 * Helper to reset the cached Auth.js instance in testing environments.
 */
export function _resetAuthInstanceForTesting(): void {
  cachedInstance = null;
}

function toAuthRequest(req: NextRequest | Request): NextRequest {
  // App Router wraps requests in a Proxy. Passing that object to the Request
  // constructor can fail native private-field checks. Rebuild from public fields
  // so Auth.js receives a real, unproxied NextRequest (including POST bodies).
  return new NextRequest(req.url, {
    method: req.method,
    headers: new Headers(req.headers),
    body: req.method === "GET" || req.method === "HEAD" ? undefined : req.body,
    signal: req.signal,
  });
}

/**
 * Guarded route handlers.
 * Fail closed with HTTP 503 if configuration is invalid or unconfigured,
 * without initializing Auth.js.
 */
export const handlers = {
  GET: async (req: NextRequest | Request): Promise<Response> => {
    const instance = getAuthInstance();
    if (!instance) {
      return new Response(
        JSON.stringify({
          error: "Authentication service is unavailable: valid configuration is required.",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }
    return instance.handlers.GET(toAuthRequest(req));
  },
  POST: async (req: NextRequest | Request): Promise<Response> => {
    const instance = getAuthInstance();
    if (!instance) {
      return new Response(
        JSON.stringify({
          error: "Authentication service is unavailable: valid configuration is required.",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }
    return instance.handlers.POST(toAuthRequest(req));
  },
};

/**
 * Guarded auth function.
 * Fails closed and returns null if configuration is missing, invalid, or during build,
 * without initializing Auth.js.
 */
export const auth: NextAuthInstance["auth"] = ((
  ...args: Parameters<NextAuthInstance["auth"]>
) => {
  const instance = getAuthInstance();
  if (!instance) {
    return Promise.resolve(null);
  }
  try {
    const res = (instance.auth as (...a: unknown[]) => unknown)(...args);
    if (res instanceof Promise) {
      return res.catch(() => null);
    }
    return res;
  } catch {
    return Promise.resolve(null);
  }
}) as NextAuthInstance["auth"];

/**
 * Guarded signIn function.
 * Fails closed if configuration is missing or invalid.
 */
export const signIn: NextAuthInstance["signIn"] = (async (
  ...args: Parameters<NextAuthInstance["signIn"]>
) => {
  const instance = getAuthInstance();
  if (!instance) {
    throw new Error(
      "Authentication is not configured: valid environment credentials and database are required."
    );
  }
  return (instance.signIn as (...a: unknown[]) => unknown)(...args);
}) as NextAuthInstance["signIn"];

/**
 * Guarded signOut function.
 * Fails closed if configuration is missing or invalid.
 */
export const signOut: NextAuthInstance["signOut"] = (async (
  ...args: Parameters<NextAuthInstance["signOut"]>
) => {
  const instance = getAuthInstance();
  if (!instance) {
    throw new Error(
      "Authentication is not configured: valid environment credentials and database are required."
    );
  }
  return (instance.signOut as (...a: unknown[]) => unknown)(...args);
}) as NextAuthInstance["signOut"];
