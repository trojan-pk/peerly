"use server";

import mongoose from "mongoose";
import { revalidatePath } from "next/cache";
import { requireAuth, UnauthorizedError } from "@/lib/auth-guards";
import { connectToDatabase, isDatabaseConfigured } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { countUnreadFor } from "@/lib/notifications";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";

export interface NotificationActionResult {
  success: boolean;
  message?: string;
}

/**
 * Unread count for the header bell. Signed-out callers and unconfigured databases
 * get 0 rather than an error, so polling is harmless on public pages.
 */
export async function getUnreadNotificationCount(): Promise<{ count: number }> {
  if (!isDatabaseConfigured()) return { count: 0 };
  try {
    const context = await requireAuth();
    return { count: await countUnreadFor(context.user._id as mongoose.Types.ObjectId) };
  } catch (error) {
    if (!(error instanceof UnauthorizedError)) console.error("[getUnreadNotificationCount] failed");
    return { count: 0 };
  }
}

async function authed() {
  try {
    return await requireAuth();
  } catch {
    return null;
  }
}

/** Marks one of the caller's own notifications as read. Other users' IDs are ignored. */
export async function markNotificationRead(notificationId: unknown): Promise<NotificationActionResult> {
  const context = await authed();
  if (!context) return { success: false, message: "Sign in to manage notifications." };
  if (typeof notificationId !== "string" || !mongoose.Types.ObjectId.isValid(notificationId)) {
    return { success: false, message: "Invalid notification." };
  }
  try {
    const limit = await checkRateLimit(`notif_read:${context.user._id}`, 120, 60_000);
    if (!limit.allowed) return { success: false, message: "Please slow down and try again shortly." };
    await connectToDatabase();
    const result = await Notification.updateOne(
      { _id: notificationId, recipient: context.user._id, readAt: null },
      { $set: { readAt: new Date() } }
    );
    try { revalidatePath("/notifications"); } catch { /* outside a request */ }
    return { success: result.matchedCount === 1 || (await Notification.exists({ _id: notificationId, recipient: context.user._id })) !== null };
  } catch {
    return { success: false, message: "We couldn't update that notification." };
  }
}

export async function markAllNotificationsRead(): Promise<NotificationActionResult> {
  const context = await authed();
  if (!context) return { success: false, message: "Sign in to manage notifications." };
  try {
    const limit = await checkRateLimit(`notif_read_all:${context.user._id}`, 20, 60_000);
    if (!limit.allowed) return { success: false, message: "Please slow down and try again shortly." };
    await connectToDatabase();
    await Notification.updateMany({ recipient: context.user._id, readAt: null }, { $set: { readAt: new Date() } });
    try { revalidatePath("/notifications"); } catch { /* outside a request */ }
    return { success: true, message: "All notifications marked as read." };
  } catch {
    return { success: false, message: "We couldn't update your notifications." };
  }
}

/** Turns request email alerts on or off for the signed-in user. */
export async function setEmailAlerts(enabled: unknown): Promise<NotificationActionResult> {
  const context = await authed();
  if (!context) return { success: false, message: "Sign in to change notification settings." };
  if (typeof enabled !== "boolean") return { success: false, message: "Invalid setting." };
  try {
    const limit = await checkRateLimit(`email_pref:${context.user._id}`, 10, 60_000);
    if (!limit.allowed) return { success: false, message: "Please wait a moment before changing this again." };
    await connectToDatabase();
    await User.updateOne({ _id: context.user._id }, { $set: { emailAlerts: enabled } });
    try { revalidatePath("/settings"); } catch { /* outside a request */ }
    return { success: true, message: enabled ? "Email alerts turned on." : "Email alerts turned off." };
  } catch {
    return { success: false, message: "We couldn't save that setting." };
  }
}
