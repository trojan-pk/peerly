"use server";

import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth-guards";
import { checkRateLimit } from "@/lib/rate-limit";
import { deleteAccount } from "@/lib/account";
import { signOut } from "@/auth";

/**
 * Permanently deletes the signed-in account. The caller must type DELETE to confirm.
 * Only ever acts on the authenticated user; no id is accepted from the client.
 */
export async function deleteMyAccountAction(confirmation: unknown): Promise<{ success: boolean; message?: string }> {
  let context;
  try { context = await requireAuth(); } catch { return { success: false, message: "Sign in to delete your account." }; }
  if (confirmation !== "DELETE") return { success: false, message: "Type DELETE to confirm." };
  try {
    const limited = await checkRateLimit(`account_delete:${context.user._id}`, 3, 60 * 60 * 1000);
    if (!limited.allowed) return { success: false, message: "Please try again later." };
    const result = await deleteAccount(context.user._id as mongoose.Types.ObjectId);
    if (!result.deleted) return { success: false, message: "Account not found." };
  } catch (error) {
    console.error("[deleteMyAccount] failed:", error instanceof Error ? error.message : "unknown");
    return { success: false, message: "We couldn't delete your account. Nothing was removed; please try again." };
  }
  try {
    await signOut({ redirect: false });
  } catch {
    // The session cookie no longer maps to a user, so every guard already treats it as signed out.
  }
  return { success: true, message: "Your account has been deleted." };
}
