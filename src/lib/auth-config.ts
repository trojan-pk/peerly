import {
  isValidSecret,
  isValidGoogleId,
  isValidGoogleSecret,
  isValidMongoUri,
} from "./env-config";

export interface AuthConfigurationStatus {
  isConfigured: boolean;
  hasGoogleId: boolean;
  hasGoogleSecret: boolean;
  hasAuthSecret: boolean;
  hasDatabase: boolean;
  missing: string[];
}

/**
 * Safely inspects auth and database configuration status without exposing any secret values.
 * Note: Google sign-in requires database configuration too, so isConfigured is only true
 * when all OAuth credentials, AUTH_SECRET, and MONGODB_URI are valid non-placeholder values.
 */
export function getAuthConfigStatus(): AuthConfigurationStatus {
  const hasGoogleId = isValidGoogleId(process.env.AUTH_GOOGLE_ID);
  const hasGoogleSecret = isValidGoogleSecret(process.env.AUTH_GOOGLE_SECRET);
  const rawSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  const hasAuthSecret = isValidSecret(rawSecret);
  const hasDatabase = isValidMongoUri(process.env.MONGODB_URI);

  const missing: string[] = [];
  if (!hasAuthSecret) missing.push("AUTH_SECRET (min 32 chars)");
  if (!hasGoogleId) missing.push("AUTH_GOOGLE_ID");
  if (!hasGoogleSecret) missing.push("AUTH_GOOGLE_SECRET");
  if (!hasDatabase) missing.push("MONGODB_URI (required for user persistence)");

  return {
    isConfigured: missing.length === 0,
    hasGoogleId,
    hasGoogleSecret,
    hasAuthSecret,
    hasDatabase,
    missing,
  };
}
