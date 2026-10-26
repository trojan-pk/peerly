import type { PipelineStage } from "mongoose";
import mongoose from "mongoose";
import { normalizeCourseCode } from "@/lib/course-rules";
import { escapeRegex } from "@/lib/validations/user";
import { FAST_REPLY_MAX_AVG_MS, FAST_REPLY_MIN_SAMPLES } from "@/lib/peer-responses";

export interface RankingOptions {
  q?: string;
  topic?: string;
  subject?: string;
  mode?: string;
  course?: string;
}

/** Math.round for non-negative numbers ($round would use banker's rounding). */
const roundHalfUp = (expr: unknown) => ({ $floor: { $add: [expr, 0.5] } });

/**
 * Case-insensitive "equals after normalisation" test matching normalizeMatchTag():
 * trimmed, lower-cased, internal whitespace collapsed. Implemented with $regexMatch so it
 * runs on every MongoDB tier (no server-side JavaScript).
 */
function normalisedEqualsPattern(target: string): string {
  const tokens = target.trim().toLowerCase().split(/\s+/).filter(Boolean).map(escapeRegex);
  return `^\\s*${tokens.join("\\s+")}\\s*$`;
}

function anyElementMatches(field: string, targets: string[]) {
  if (targets.length === 0) return false;
  return {
    $anyElementTrue: [{
      $map: {
        input: { $ifNull: [field, []] },
        as: "tag",
        in: { $or: targets.map((t) => ({ $regexMatch: { input: { $toString: "$$tag" }, regex: normalisedEqualsPattern(t), options: "i" } })) },
      },
    }],
  };
}

/**
 * Aggregation stages that compute the same match score as calculatePeerMatchScore(),
 * using authoritative review and response data, then sort with the same tie-breakers:
 * score ↓, rating ↓, review count ↓, createdAt ↓, _id ↓. Pagination is applied in the
 * database, so only one page of users is ever loaded into application memory.
 */
export function rankingStages(options: RankingOptions): PipelineStage[] {
  const targets = [options.topic, options.q, options.subject].filter((t): t is string => Boolean(t && t.trim()));
  const queryCode = options.q ? normalizeCourseCode(options.q) : null;
  const courseConditions: unknown[] = [];
  if (options.course && mongoose.Types.ObjectId.isValid(options.course)) courseConditions.push({ $in: [new mongoose.Types.ObjectId(options.course), { $ifNull: ["$courses", []] }] });
  if (queryCode) courseConditions.push({ $in: [queryCode, { $ifNull: ["$courseCodes", []] }] });

  const mode = options.mode?.trim().toLowerCase();
  const modePoints =
    mode === "online" ? { $cond: [{ $in: ["$mode", ["online", "both"]] }, 20, 0] }
    : mode === "campus" ? { $cond: [{ $in: ["$mode", ["campus", "both"]] }, 20, 0] }
    : mode === "both" ? { $cond: [{ $in: ["$mode", ["online", "campus", "both"]] }, 20, 0] }
    : 0;

  return [
    { $lookup: {
      from: "studyrequests",
      let: { peerId: "$_id" },
      pipeline: [
        { $match: { $expr: { $eq: ["$peer", "$$peerId"] }, status: { $in: ["ACCEPTED", "REJECTED", "COMPLETED", "REVIEWED"] } } },
        { $project: { status: 1, rating: "$review.rating", responseMs: { $cond: [
          { $and: [{ $eq: [{ $type: "$respondedAt" }, "date"] }, { $eq: [{ $type: "$createdAt" }, "date"] }] },
          { $subtract: ["$respondedAt", "$createdAt"] }, null,
        ] } } },
        { $group: {
          _id: null,
          reviewCount: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "REVIEWED"] }, { $ne: [{ $ifNull: ["$rating", null] }, null] }] }, 1, 0] } },
          ratingSum: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "REVIEWED"] }, { $ne: [{ $ifNull: ["$rating", null] }, null] }] }, "$rating", 0] } },
          responseCount: { $sum: { $cond: [{ $gte: [{ $ifNull: ["$responseMs", -1] }, 0] }, 1, 0] } },
          responseSum: { $sum: { $cond: [{ $gte: [{ $ifNull: ["$responseMs", -1] }, 0] }, "$responseMs", 0] } },
        } },
      ],
      as: "stats",
    } },
    { $set: { stats: { $ifNull: [{ $first: "$stats" }, { reviewCount: 0, ratingSum: 0, responseCount: 0, responseSum: 0 }] } } },
    { $set: {
      rankRating: { $cond: [{ $gt: ["$stats.reviewCount", 0] }, { $divide: [roundHalfUp({ $multiply: [{ $divide: ["$stats.ratingSum", "$stats.reviewCount"] }, 10] }), 10] }, 0] },
      rankReviews: "$stats.reviewCount",
      rankFast: { $and: [
        { $gte: ["$stats.responseCount", FAST_REPLY_MIN_SAMPLES] },
        { $lte: [roundHalfUp({ $divide: ["$stats.responseSum", { $max: ["$stats.responseCount", 1] }] }), FAST_REPLY_MAX_AVG_MS] },
      ] },
    } },
    { $set: {
      rankScore: { $min: [100, { $add: [
        { $cond: [
          courseConditions.length ? { $or: courseConditions } : false, 50,
          { $cond: [anyElementMatches("$topics", targets), 50, { $cond: [anyElementMatches("$subjects", targets), 25, 0] }] },
        ] },
        modePoints,
        { $cond: [{ $gt: ["$rankRating", 0] }, roundHalfUp({ $multiply: [{ $divide: [{ $min: ["$rankRating", 5] }, 5] }, 20] }), 0] },
        { $cond: ["$rankFast", 10, 0] },
      ] }] },
    } },
    { $sort: { rankScore: -1, rankRating: -1, rankReviews: -1, createdAt: -1, _id: -1 } },
  ];
}
