import mongoose from "mongoose";
import { connectToDatabase, ensureDatabaseIndexes } from "@/lib/db";
import { Resource } from "@/models/Resource";
import { ResourceVote } from "@/models/ResourceVote";

export type VoteResult = { ok: true; upvoted: boolean; count: number } | { ok: false; message: string };

/**
 * Adds or removes the caller's "helpful" vote. The unique (user, resource) index makes
 * the vote record the source of truth; the counter only moves when a vote row is
 * actually inserted or deleted, so concurrent clicks cannot double-count.
 */
export async function setResourceVote(userId: mongoose.Types.ObjectId, rawResourceId: unknown, upvote: boolean): Promise<VoteResult> {
  if (typeof rawResourceId !== "string" || !mongoose.Types.ObjectId.isValid(rawResourceId)) return { ok: false, message: "Invalid resource." };
  const resourceId = new mongoose.Types.ObjectId(rawResourceId);
  await ensureDatabaseIndexes();
  const resource = await Resource.findOne({ _id: resourceId, "moderation.isHidden": { $ne: true } }).select("owner").lean();
  if (!resource) return { ok: false, message: "This resource isn't available." };
  if (String(resource.owner) === String(userId)) return { ok: false, message: "You can't mark your own resource as helpful." };

  if (upvote) {
    try {
      await ResourceVote.create({ user: userId, resource: resourceId });
      await Resource.updateOne({ _id: resourceId }, { $inc: { upvoteCount: 1 } });
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error; // already voted
    }
  } else {
    const removed = await ResourceVote.deleteOne({ user: userId, resource: resourceId });
    if (removed.deletedCount === 1) await Resource.updateOne({ _id: resourceId, upvoteCount: { $gt: 0 } }, { $inc: { upvoteCount: -1 } });
  }
  const fresh = await Resource.findById(resourceId).select("upvoteCount").lean();
  return { ok: true, upvoted: upvote, count: fresh?.upvoteCount ?? 0 };
}

/** Which of these resources the viewer has marked helpful. */
export async function viewerVotes(userId: mongoose.Types.ObjectId | string, resourceIds: string[]): Promise<Set<string>> {
  if (resourceIds.length === 0) return new Set();
  await connectToDatabase();
  const rows = await ResourceVote.find({ user: userId, resource: { $in: resourceIds } }).select("resource").lean();
  return new Set(rows.map((r) => String(r.resource)));
}
