/**
 * Safe environment configuration validation.
 * Rejects empty values, weak secrets, and known template placeholders from .env.example.
 * Never prints or leaks raw secret values.
 */

const KNOWN_PLACEHOLDERS = new Set([
  "your_auth_secret_here_min_32_chars",
  "your_google_oauth_client_id.apps.googleusercontent.com",
  "your_google_oauth_client_secret",
]);

export function isValidSecret(val?: string | null): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  if (trimmed.length < 32) return false;
  if (KNOWN_PLACEHOLDERS.has(trimmed)) return false;
  const lower = trimmed.toLowerCase();
  if (
    lower.includes("placeholder") ||
    lower.includes("your_auth_secret") ||
    lower.includes("fallback-secret")
  ) {
    return false;
  }
  return true;
}

export function isValidGoogleId(val?: string | null): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  if (trimmed.length === 0) return false;
  if (KNOWN_PLACEHOLDERS.has(trimmed)) return false;
  const lower = trimmed.toLowerCase();
  if (
    lower.includes("your_google_oauth_client_id") ||
    lower.includes("placeholder")
  ) {
    return false;
  }
  return true;
}

export function isValidGoogleSecret(val?: string | null): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  if (trimmed.length === 0) return false;
  if (KNOWN_PLACEHOLDERS.has(trimmed)) return false;
  const lower = trimmed.toLowerCase();
  if (
    lower.includes("your_google_oauth_client_secret") ||
    lower.includes("placeholder")
  ) {
    return false;
  }
  return true;
}

export function isValidMongoUri(val?: string | null): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  if (!trimmed.startsWith("mongodb://") && !trimmed.startsWith("mongodb+srv://")) {
    return false;
  }
  if (trimmed.includes("<username>") || trimmed.includes("<password>")) {
    return false;
  }
  const lower = trimmed.toLowerCase();
  if (lower.includes("placeholder") || lower.includes("your_mongodb_uri")) {
    return false;
  }
  return true;
}

/**
 * Parses ADMIN_EMAILS into a clean, normalized Set of lowercase email addresses.
 */
export function getAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS || "";
  const list = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return new Set(list);
}

/**
 * Checks if a given email is actively listed in ADMIN_EMAILS.
 * ADMIN_EMAILS is the sole authority for administrative access.
 */
export function isEmailAdmin(email?: string | null): boolean {
  if (!email) return false;
  const adminSet = getAdminEmails();
  return adminSet.has(email.trim().toLowerCase());
}
