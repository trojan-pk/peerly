import mongoose from "mongoose";
import { connectToDatabase, isDatabaseConfigured } from "@/lib/db";
import { StudyRequest } from "@/models/StudyRequest";
import { PeerResponseStatsDTO } from "@/types/user";

export const FAST_REPLY_MIN_SAMPLES = 3;
export const FAST_REPLY_MAX_AVG_MS = 2 * 60 * 60 * 1000; // 2 hours = 7,200,000 ms

/**
 * Batched derivation of peer response statistics and fast-reply badge eligibility
 * directly from authoritative persisted StudyRequest documents.
 *
 * Rules:
 * - Response time = respondedAt - createdAt
 * - Badge requires at least 3 valid responses (sampleCount >= 3)
 * - Badge requires average response time <= 2 hours (<= 7,200,000 ms)
 * - Excludes learner cancellations (respondedAt is null)
 * - Excludes legacy requests without respondedAt (never infers from updatedAt)
 * - Single batched aggregation query across all requested peer IDs
 */
export async function getPeerResponseStatsBatch(
  peerIds: (string | mongoose.Types.ObjectId)[]
): Promise<Map<string, PeerResponseStatsDTO>> {
  const statsMap = new Map<string, PeerResponseStatsDTO>();

  const validObjectIds = peerIds
    .map((id) =>
      typeof id === "string"
        ? mongoose.Types.ObjectId.isValid(id)
          ? new mongoose.Types.ObjectId(id)
          : null
        : id
    )
    .filter((id): id is mongoose.Types.ObjectId => Boolean(id));

  if (validObjectIds.length === 0 || !isDatabaseConfigured()) {
    return statsMap;
  }

  await connectToDatabase();

  const results = await StudyRequest.aggregate([
    {
      $match: {
        peer: { $in: validObjectIds },
        status: { $in: ["ACCEPTED", "REJECTED", "COMPLETED", "REVIEWED"] },
        respondedAt: { $ne: null, $type: "date" },
        createdAt: { $ne: null, $type: "date" },
      },
    },
    {
      $project: {
        peer: 1,
        responseTimeMs: { $subtract: ["$respondedAt", "$createdAt"] },
      },
    },
    {
      $match: {
        responseTimeMs: { $gte: 0 },
      },
    },
    {
      $group: {
        _id: "$peer",
        sampleCount: { $sum: 1 },
        avgResponseTimeMs: { $avg: "$responseTimeMs" },
      },
    },
  ]);

  for (const row of results) {
    const sampleCount = typeof row.sampleCount === "number" ? row.sampleCount : 0;
    const avgResponseTimeMs =
      typeof row.avgResponseTimeMs === "number" ? Math.round(row.avgResponseTimeMs) : null;
    const hasFastReplyBadge =
      sampleCount >= FAST_REPLY_MIN_SAMPLES &&
      avgResponseTimeMs !== null &&
      avgResponseTimeMs <= FAST_REPLY_MAX_AVG_MS;

    statsMap.set(row._id.toString(), {
      sampleCount,
      avgResponseTimeMs,
      hasFastReplyBadge,
    });
  }

  return statsMap;
}

/**
 * Public service to retrieve response statistics for a single peer.
 */
export async function getPeerResponseStats(
  peerId: string | mongoose.Types.ObjectId
): Promise<PeerResponseStatsDTO> {
  const map = await getPeerResponseStatsBatch([peerId]);
  return (
    map.get(peerId.toString()) || {
      sampleCount: 0,
      avgResponseTimeMs: null,
      hasFastReplyBadge: false,
    }
  );
}

/**
 * Formats response time in milliseconds into human-readable text.
 */
export function formatResponseTime(ms: number | null): string {
  if (ms === null || ms === undefined || ms < 0) return "N/A";
  const minutes = Math.round(ms / (60 * 1000));
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"}`;
  const hours = (ms / (3600 * 1000)).toFixed(1);
  if (parseFloat(hours) === 1.0) return "1 hr";
  if (parseFloat(hours) < 24) return `${hours.replace(/\.0$/, "")} hrs`;
  const days = (ms / (24 * 3600 * 1000)).toFixed(1);
  return `${days.replace(/\.0$/, "")} days`;
}
