import type mongoose from "mongoose";
import { requireAuth, UnauthorizedError } from "@/lib/auth-guards";
import { isDatabaseConfigured } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { exportAccountData } from "@/lib/account";

/** Downloads everything Peerly stores about the signed-in user as JSON. */
export async function GET() {
  const noStore = { "Cache-Control": "private, no-store" };
  if (!isDatabaseConfigured()) return new Response("Unavailable", { status: 503, headers: noStore });
  let userId: mongoose.Types.ObjectId;
  try {
    userId = (await requireAuth()).user._id as mongoose.Types.ObjectId;
  } catch (error) {
    if (error instanceof UnauthorizedError) return new Response("Sign in required", { status: 401, headers: noStore });
    return new Response("Unavailable", { status: 503, headers: noStore });
  }
  const limited = await checkRateLimit(`account_export:${userId}`, 5, 60 * 60 * 1000);
  if (!limited.allowed) return new Response("Too many exports. Try again later.", { status: 429, headers: { ...noStore, "Retry-After": String(limited.retryAfterSeconds ?? 3600) } });
  const data = await exportAccountData(userId);
  if (!data) return new Response("Not found", { status: 404, headers: noStore });
  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers: { ...noStore, "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="peerly-data-${new Date().toISOString().slice(0, 10)}.json"`, "X-Content-Type-Options": "nosniff" },
  });
}
