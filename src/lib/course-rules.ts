/**
 * Pure course-code and university-domain rules (client-safe; no database imports).
 */

/** "cs 101", "Cs-101", "cs_101" → "CS-101"; "math202l" → "MATH-202L". Returns null if not a course code. */
export function normalizeCourseCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const compact = raw.trim().toUpperCase().replace(/[\s_.\-/]+/g, "");
  const match = compact.match(/^([A-Z]{2,6})(\d{2,4}[A-Z]?)$/);
  return match ? `${match[1]}-${match[2]}` : null;
}

/** Lower-cases and validates an email domain such as "nu.edu.pk". Returns null if invalid. */
export function normalizeDomain(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const domain = raw.trim().toLowerCase().replace(/^@/, "");
  if (domain.length > 100) return null;
  if (!/^(?=.{3,100}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(domain)) return null;
  return domain;
}

/** Normalises an email address; returns null if it is not a plausible address. */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (email.length > 254 || /[\s<>"]/.test(email)) return null;
  const at = email.lastIndexOf("@");
  if (at < 1 || !normalizeDomain(email.slice(at + 1))) return null;
  return email;
}

/**
 * True when the email's domain is one of the allowed domains or a subdomain of one
 * (student.nu.edu.pk matches nu.edu.pk). Look-alikes such as nu.edu.pk.evil.com and
 * fakenu.edu.pk never match.
 */
export function emailMatchesDomains(email: string, domains: readonly string[]): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  const host = normalized.slice(normalized.lastIndexOf("@") + 1);
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

/** URL-safe slug for a university name. */
export function slugify(name: string): string {
  return name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}
