/**
 * Optional transactional email through Resend's REST API (no SDK dependency).
 *
 * Email is entirely optional: without RESEND_API_KEY and EMAIL_FROM every send is
 * skipped and the app behaves as before. Keys are never logged or returned.
 */
const RESEND_ENDPOINT = "https://api.resend.com/emails";
export const EMAIL_TIMEOUT_MS = 5000;

export function isValidResendKey(value?: string | null): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return /^re_[A-Za-z0-9_]{16,}$/.test(trimmed) && !trimmed.toLowerCase().includes("your_");
}

/** Accepts `name@domain.tld` or `Display Name <name@domain.tld>`. */
export function isValidEmailFrom(value?: string | null): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  const address = trimmed.match(/<([^<>\s]+)>$/)?.[1] ?? trimmed;
  return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(address) && !/example\.com$/i.test(address) && !/[\r\n]/.test(trimmed);
}

export function isEmailConfigured(): boolean {
  return isValidResendKey(process.env.RESEND_API_KEY) && isValidEmailFrom(process.env.EMAIL_FROM);
}

/** Escapes text for safe interpolation into HTML element content and attributes. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type EmailResult = { sent: true } | { sent: false; reason: "unconfigured" | "invalid_recipient" | "provider_error" | "timeout" };

/** Sends one email. Never throws; failures are reported without provider details. */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  if (!isEmailConfigured()) return { sent: false, reason: "unconfigured" };
  if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(message.to) || /[\r\n]/.test(message.subject)) {
    return { sent: false, reason: "invalid_recipient" };
  }
  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM!.trim(), to: [message.to], subject: message.subject, html: message.html, text: message.text }),
      signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error(`[email] Provider rejected the message (HTTP ${response.status}).`);
      return { sent: false, reason: "provider_error" };
    }
    return { sent: true };
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    console.error(`[email] ${timedOut ? "Timed out" : "Network error"} while sending.`);
    return { sent: false, reason: timedOut ? "timeout" : "provider_error" };
  }
}

/** Public origin for links in emails, from AUTH_URL (or NEXTAUTH_URL). */
export function appOrigin(): string {
  try {
    const url = new URL(process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000");
    if (url.protocol === "http:" || url.protocol === "https:") return url.origin;
  } catch {
    // fall through
  }
  return "http://localhost:3000";
}
