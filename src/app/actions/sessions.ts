"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, UnauthorizedError } from "@/lib/auth-guards";
import { isDatabaseConfigured } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { chooseSessionTime, getOrCreateMeetingRoom, proposeSessionTimes } from "@/lib/sessions";

export interface SessionActionResult<T = undefined> { success: boolean; message?: string; data?: T }

async function run<T>(key: string, limit: number, work: (user: Awaited<ReturnType<typeof requireAuth>>["user"]) => Promise<{ ok: boolean; message: string; value?: T }>): Promise<SessionActionResult<T>> {
  if (!isDatabaseConfigured()) return { success: false, message: "Sessions are unavailable because the database is not configured." };
  try {
    const { user } = await requireAuth();
    const limited = await checkRateLimit(`${key}:${user._id}`, limit, 60_000);
    if (!limited.allowed) return { success: false, message: "Please wait a moment and try again." };
    const result = await work(user);
    if (result.ok) { try { revalidatePath("/dashboard"); } catch { /* outside a request */ } }
    return { success: result.ok, message: result.message, data: result.value };
  } catch (error) {
    if (error instanceof UnauthorizedError) return { success: false, message: "Sign in to manage sessions." };
    console.error("[sessions] action failed:", error instanceof Error ? error.message : "unknown");
    return { success: false, message: "Something went wrong. Please try again." };
  }
}

export async function proposeSessionTimesAction(input: unknown) {
  const body = (input ?? {}) as Record<string, unknown>;
  return run<{ slots: string[] }>("session_propose", 10, (user) => proposeSessionTimes(user, { requestId: body.requestId, slots: body.slots, durationMinutes: body.durationMinutes }));
}

export async function chooseSessionTimeAction(input: unknown) {
  const body = (input ?? {}) as Record<string, unknown>;
  return run<{ scheduledAt: string }>("session_choose", 10, (user) => chooseSessionTime(user, { requestId: body.requestId, slot: body.slot }));
}

export async function getMeetingLinkAction(requestId: unknown) {
  return run<{ url: string }>("session_meeting", 20, (user) => getOrCreateMeetingRoom(user, requestId));
}
