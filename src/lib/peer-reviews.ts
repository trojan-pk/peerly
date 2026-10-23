import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { StudyRequest } from "@/models/StudyRequest";
import { User } from "@/models/User";

export interface PeerRatingStats {
  reviewCount: number;
  averageRating: number;
}

/**
 * Derives authoritative peer rating and review count directly from persisted StudyRequest reviews.
 * Shared service for peer detail pages and individual lookups.
 */
export async function getPeerRatingStats(
  peerId: string | mongoose.Types.ObjectId
): Promise<PeerRatingStats> {
  if (!mongoose.Types.ObjectId.isValid(peerId)) {
    return { reviewCount: 0, averageRating: 0 };
  }

  await connectToDatabase();
  const peerObjectId = typeof peerId === "string" ? new mongoose.Types.ObjectId(peerId) : peerId;

  const stats = await StudyRequest.aggregate([
    {
      $match: {
        peer: peerObjectId,
        status: "REVIEWED",
        "review.rating": { $exists: true, $ne: null },
      },
    },
    {
      $group: {
        _id: "$peer",
        reviewCount: { $sum: 1 },
        averageRating: { $avg: "$review.rating" },
      },
    },
  ]);

  const reviewCount = stats[0]?.reviewCount || 0;
  const averageRating = stats[0]?.averageRating
    ? Math.round(stats[0].averageRating * 10) / 10
    : 0;

  return { reviewCount, averageRating };
}

/**
 * Batched authoritative rating lookup for multiple peers in a single bounded MongoDB aggregation.
 * Used by peer directory listings to prevent stale cached stats without N+1 queries.
 */
export async function getPeerRatingStatsBatch(
  peerIds: (string | mongoose.Types.ObjectId)[]
): Promise<Map<string, PeerRatingStats>> {
  const statsMap = new Map<string, PeerRatingStats>();
  if (!peerIds || peerIds.length === 0) {
    return statsMap;
  }

  await connectToDatabase();
  const peerObjectIds = peerIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => (typeof id === "string" ? new mongoose.Types.ObjectId(id) : id));

  if (peerObjectIds.length === 0) {
    return statsMap;
  }

  const stats = await StudyRequest.aggregate([
    {
      $match: {
        peer: { $in: peerObjectIds },
        status: "REVIEWED",
        "review.rating": { $exists: true, $ne: null },
      },
    },
    {
      $group: {
        _id: "$peer",
        reviewCount: { $sum: 1 },
        averageRating: { $avg: "$review.rating" },
      },
    },
  ]);

  for (const item of stats) {
    statsMap.set(item._id.toString(), {
      reviewCount: item.reviewCount || 0,
      averageRating: item.averageRating ? Math.round(item.averageRating * 10) / 10 : 0,
    });
  }

  return statsMap;
}

/**
 * Internal server-only helper to update the User document cache.
 * Note: Public interfaces derive ratings directly from authoritative persisted reviews.
 */
export async function updateCachedPeerAggregates(
  peerId: string | mongoose.Types.ObjectId
): Promise<PeerRatingStats> {
  const stats = await getPeerRatingStats(peerId);
  const peerObjectId = typeof peerId === "string" ? new mongoose.Types.ObjectId(peerId) : peerId;

  await User.findByIdAndUpdate(peerObjectId, {
    $set: {
      reviewCount: stats.reviewCount,
      averageRating: stats.averageRating,
    },
  });

  return stats;
}
