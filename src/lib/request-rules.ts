/**
 * Pure request timing rules shared by server validation, expiry and client UI.
 * Contains no database imports so client components can use it.
 */
export type Urgency = "normal" | "urgent";

export const URGENT_WINDOW_MS = 6 * 60 * 60 * 1000;
export const NORMAL_WINDOW_MS = 72 * 60 * 60 * 1000;
export const MAX_NEEDED_BY_MS = 14 * 24 * 60 * 60 * 1000;
/** A deadline must leave the helper a realistic chance to respond. */
export const MIN_NEEDED_BY_LEAD_MS = 15 * 60 * 1000;

/** expiresAt = min(neededBy, createdAt + (urgent ? 6h : 72h)). */
export function computeExpiresAt(createdAt: Date, urgency: Urgency, neededBy?: Date | null): Date {
  const window = createdAt.getTime() + (urgency === "urgent" ? URGENT_WINDOW_MS : NORMAL_WINDOW_MS);
  const deadline = neededBy ? neededBy.getTime() : Infinity;
  return new Date(Math.min(window, deadline));
}

/**
 * Compact remaining-time label for countdowns, e.g. "2h 58m left", "3d 4h left",
 * "12m left", "Less than a minute left". Returns null once time has run out.
 */
export function formatTimeLeft(msLeft: number): string | null {
  if (!Number.isFinite(msLeft) || msLeft <= 0) return null;
  const minutes = Math.floor(msLeft / 60_000);
  if (minutes < 1) return "Less than a minute left";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}
