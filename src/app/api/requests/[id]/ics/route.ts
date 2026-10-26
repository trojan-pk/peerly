import { requireAuth, UnauthorizedError } from "@/lib/auth-guards";
import { isDatabaseConfigured } from "@/lib/db";
import { buildSessionCalendar } from "@/lib/sessions";
import type mongoose from "mongoose";

/** Calendar file for a scheduled session. Participants only; others get 404. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isDatabaseConfigured()) return new Response("Not found", { status: 404 });
  let userId: mongoose.Types.ObjectId;
  try {
    userId = (await requireAuth()).user._id as mongoose.Types.ObjectId;
  } catch (error) {
    if (error instanceof UnauthorizedError) return new Response("Sign in required", { status: 401, headers: { "Cache-Control": "no-store" } });
    return new Response("Unavailable", { status: 503 });
  }
  const file = await buildSessionCalendar(userId, id);
  if (!file) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(file.body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
