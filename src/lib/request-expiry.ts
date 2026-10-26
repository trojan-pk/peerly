import mongoose from "mongoose";
import { StudyRequest } from "@/models/StudyRequest";
import { NORMAL_WINDOW_MS } from "@/lib/request-rules";
import { notify } from "@/lib/notifications";

/**
 * Pending-request expiry rules.
 *
 * A pending request stops accepting responses at
 *   expiresAt = min(neededBy, createdAt + (urgent ? 6h : 72h)).
 * Legacy records without expiresAt use the normal 72h window from createdAt.
 * Expiry is applied lazily and atomically (no background job): before dashboards
 * load, before a new request is created, and as a guard on accept/reject.
 */
export { URGENT_WINDOW_MS, NORMAL_WINDOW_MS, MAX_NEEDED_BY_MS, MIN_NEEDED_BY_LEAD_MS, computeExpiresAt } from "@/lib/request-rules";

/** Filter matching PENDING requests whose response window has closed. */
export function expiredPendingFilter(now: Date) {
  return {
    status: "PENDING" as const,
    $or: [
      { expiresAt: { $lte: now } },
      { expiresAt: null, createdAt: { $lte: new Date(now.getTime() - NORMAL_WINDOW_MS) } },
    ],
  };
}

/** Filter fragment that only matches requests still inside their response window. */
export function stillOpenFilter(now: Date) {
  return {
    $or: [
      { expiresAt: { $gt: now } },
      { expiresAt: null, createdAt: { $gt: new Date(now.getTime() - NORMAL_WINDOW_MS) } },
    ],
  };
}

export interface ExpiredRequestInfo {
  id: string;
  learner: string;
  peer: string;
  topic: string;
}

/**
 * Atomically moves overdue PENDING requests to EXPIRED for the given participant.
 * Each record transitions with its own conditional update, so a concurrent accept
 * and expiry can never both succeed, and each expiry is reported exactly once.
 * Returns only the records this call transitioned.
 */
export async function expireOverdueRequests(
  scope: { userId?: mongoose.Types.ObjectId | string; learner?: mongoose.Types.ObjectId | string; peer?: mongoose.Types.ObjectId | string } = {},
  limit = 100
): Promise<ExpiredRequestInfo[]> {
  const now = new Date();
  const base: Record<string, unknown> = expiredPendingFilter(now);
  const scoped: Record<string, unknown> = { ...base };
  if (scope.userId) {
    const id = new mongoose.Types.ObjectId(String(scope.userId));
    scoped.$and = [{ $or: [{ learner: id }, { peer: id }] }];
  }
  if (scope.learner) scoped.learner = new mongoose.Types.ObjectId(String(scope.learner));
  if (scope.peer) scoped.peer = new mongoose.Types.ObjectId(String(scope.peer));

  const candidates = await StudyRequest.find(scoped).select("_id").limit(limit).lean();
  const expired: ExpiredRequestInfo[] = [];
  for (const candidate of candidates) {
    const updated = await StudyRequest.findOneAndUpdate(
      { _id: candidate._id, ...expiredPendingFilter(now) },
      { $set: { status: "EXPIRED", priority: 0 } },
      { returnDocument: "after" }
    ).lean();
    if (updated) {
      expired.push({ id: String(updated._id), learner: String(updated.learner), peer: String(updated.peer), topic: updated.topic });
    }
  }
  return expired;
}

/** Legacy rows created before `priority` existed get the value they would have had. */
export async function backfillRequestPriority(userId: mongoose.Types.ObjectId | string): Promise<void> {
  const id = new mongoose.Types.ObjectId(String(userId));
  await StudyRequest.updateMany(
    { priority: { $exists: false }, $or: [{ learner: id }, { peer: id }] },
    [{ $set: { priority: { $cond: [{ $eq: ["$status", "PENDING"] }, { $cond: [{ $eq: ["$urgency", "urgent"] }, 2, 1] }, 0] } } }],
    { updatePipeline: true }
  );
}

/** Expires overdue requests in scope and tells each learner their request lapsed. */
export async function expireAndNotify(
  scope: Parameters<typeof expireOverdueRequests>[0] = {}
): Promise<ExpiredRequestInfo[]> {
  const expired = await expireOverdueRequests(scope);
  await notify(expired.map((r) => ({ type: "REQUEST_EXPIRED" as const, recipientId: r.learner, requestId: r.id, topic: r.topic })));
  return expired;
}
