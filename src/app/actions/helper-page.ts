"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-guards";
import { checkRateLimit } from "@/lib/rate-limit";
import { setPublicPage } from "@/lib/helper-page";

export async function setPublicPageAction(enabled: unknown): Promise<{ success: boolean; message?: string; slug?: string | null; enabled?: boolean }> {
  let context;
  try { context = await requireAuth(); } catch { return { success: false, message: "Sign in to change your public page." }; }
  if (typeof enabled !== "boolean") return { success: false, message: "Invalid setting." };
  try {
    const limited = await checkRateLimit(`public_page:${context.user._id}`, 10, 60_000);
    if (!limited.allowed) return { success: false, message: "Please wait a moment before changing this again." };
    const result = await setPublicPage(context.user, enabled);
    if (!result.ok) return { success: false, message: result.message };
    try { revalidatePath("/settings"); if (result.slug) revalidatePath(`/h/${result.slug}`); } catch { /* outside a request */ }
    return { success: true, slug: result.slug, enabled: result.enabled, message: enabled ? "Your public page is live." : "Your public page is now hidden." };
  } catch {
    return { success: false, message: "We couldn't update your public page." };
  }
}
