import mongoose from "mongoose";
import { isDatabaseConfigured, connectToDatabase } from "@/lib/db";
import { normalizeCourseCode } from "@/lib/course-rules";
import { User, toPublicProfile } from "@/models/User";
import { PublicUserProfile } from "@/types/user";
import { escapeRegex, normalizeTags } from "@/lib/validations/user";
import { getPeerRatingStatsBatch } from "@/lib/peer-reviews";
import { getPeerResponseStatsBatch } from "@/lib/peer-responses";
import { calculatePeerMatchScore } from "@/lib/peer-matching";
import { rankingStages } from "@/lib/peer-ranking";

export interface PeerSearchParams {
  /** Catalogue course id. */
  course?: string;
  q?: string;
  topic?: string;
  subject?: string;
  mode?: string;
  pricing?: string;
  page?: string | number;
}

export type PeersQueryResult =
  | {
      state: "success";
      peers: PublicUserProfile[];
      pagination: {
        page: number;
        totalPages: number;
        totalCount: number;
        hasPrev: boolean;
        hasNext: boolean;
      };
      availableTopics: string[];
      availableSubjects: string[];
    }
  | { state: "no_results"; availableTopics: string[]; availableSubjects: string[] }
  | { state: "database_empty" }
  | { state: "unconfigured" }
  | { state: "error"; message: string };

const PAGE_SIZE = 12;

/**
 * Searches, filters, and deterministically ranks peers from MongoDB.
 *
 * Rules:
 * - Bounded input lengths and validated pagination.
 * - The entire candidate set is scored and ranked in MongoDB BEFORE pagination.
 * - Global deterministic tie-breakers (matchScore -> rating -> reviews -> createdAt -> _id).
 * - Topic-based match scores are calculated and displayed only when search/topic is supplied.
 * - Default discovery preserves recency ordering without search.
 * - Authoritative persisted reviews and response timestamps (never stale cached counters).
 */
export async function queryPeers(params: PeerSearchParams = {}): Promise<PeersQueryResult> {
  if (!isDatabaseConfigured()) {
    return { state: "unconfigured" };
  }

  try {
    await connectToDatabase();

    // 1. Check if there are any completed, unhidden profiles in the platform at all
    const totalComplete = await User.countDocuments({
      isProfileComplete: true,
      "moderation.isHidden": { $ne: true },
    });
    if (totalComplete === 0) {
      return { state: "database_empty" };
    }

    // 2. Validate and bound search strings
    const safeQ = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
    const safeTopic = typeof params.topic === "string" ? params.topic.trim().slice(0, 50) : "";
    const safeSubject = typeof params.subject === "string" ? params.subject.trim().slice(0, 50) : "";
    const safeMode = ["online", "campus", "both"].includes(params.mode || "") ? params.mode : undefined;
    const safePricing = ["free", "paid", "both"].includes(params.pricing || "") ? params.pricing : undefined;

    const rawPage = typeof params.page === "number" ? params.page : parseInt(String(params.page || "1"), 10);
    const parsedPage = isNaN(rawPage) ? 1 : rawPage;
    const currentPage = Math.max(1, Math.min(parsedPage, 10000));

    // Determine if topic-based match scoring is active
    const safeCourse = typeof params.course === "string" && /^[a-f\d]{24}$/i.test(params.course) ? params.course : "";
    const queryCode = safeQ ? normalizeCourseCode(safeQ) : null;
    const isSearchActive = Boolean(safeQ || safeTopic || safeSubject || safeCourse);

    // 3. Build the filter query
    const query: Record<string, unknown> = {
      isProfileComplete: true,
      "moderation.isHidden": { $ne: true },
    };

    // Keyword search (q)
    if (safeQ.length > 0) {
      const escaped = escapeRegex(safeQ);
      const regex = new RegExp(escaped, "i");
      query.$or = [
        { name: regex },
        { university: regex },
        { campus: regex },
        { bio: regex },
        { topics: regex },
        { subjects: regex },
        { courseCodes: regex },
        ...(queryCode ? [{ courseCodes: queryCode }] : []),
      ];
    }

    if (safeCourse) {
      query.courses = new mongoose.Types.ObjectId(safeCourse);
    }

    // Topic filter
    if (safeTopic.length > 0) {
      const escaped = escapeRegex(safeTopic);
      query.topics = new RegExp(`^${escaped}$`, "i");
    }

    // Subject filter
    if (safeSubject.length > 0) {
      const escaped = escapeRegex(safeSubject);
      query.subjects = new RegExp(`^${escaped}$`, "i");
    }

    // Learning mode filter:
    // If filtering by "online", include profiles with "online" or "both"
    // If filtering by "campus", include profiles with "campus" or "both"
    if (safeMode === "online") {
      query.mode = { $in: ["online", "both"] };
    } else if (safeMode === "campus") {
      query.mode = { $in: ["campus", "both"] };
    } else if (safeMode === "both") {
      query.mode = "both";
    }

    // Pricing preference filter:
    // If filtering by "free", include profiles with "free" or "both"
    // If filtering by "paid", include profiles with "paid" or "both"
    if (safePricing === "free") {
      query.pricingPreference = { $in: ["free", "both"] };
    } else if (safePricing === "paid") {
      query.pricingPreference = { $in: ["paid", "both"] };
    } else if (safePricing === "both") {
      query.pricingPreference = "both";
    }

    // 4. Retrieve unique topics and subjects for filter chips/options
    const [rawTopics, rawSubjects] = await Promise.all([
      User.distinct("topics", { isProfileComplete: true, "moderation.isHidden": { $ne: true } }),
      User.distinct("subjects", { isProfileComplete: true, "moderation.isHidden": { $ne: true } }),
    ]);
    const availableTopics = normalizeTags(rawTopics);
    const availableSubjects = normalizeTags(rawSubjects);

    const totalMatching = await User.countDocuments(query);
    if (totalMatching === 0) {
      return {
        state: "no_results",
        availableTopics,
        availableSubjects,
      };
    }

    const totalPages = Math.ceil(totalMatching / PAGE_SIZE);
    const validPage = Math.min(currentPage, totalPages);
    const skip = (validPage - 1) * PAGE_SIZE;

    // 5. Query candidate set
    if (isSearchActive) {
      // Rank the whole filtered set inside MongoDB, then load only this page's users.
      const ranked = await User.aggregate<{ _id: mongoose.Types.ObjectId }>([
        { $match: query },
        ...rankingStages({ q: safeQ, topic: safeTopic, subject: safeSubject, mode: safeMode, course: safeCourse }),
        { $skip: skip },
        { $limit: PAGE_SIZE },
        { $project: { _id: 1 } },
      ]);
      const candidateIds = ranked.map((r) => r._id);
      const order = new Map(candidateIds.map((id, i) => [String(id), i]));
      const rawCandidates = (await User.find({ _id: { $in: candidateIds } }).lean())
        .sort((a, b) => (order.get(String(a._id)) ?? 0) - (order.get(String(b._id)) ?? 0));

      // Batched authoritative queries for review aggregates and response stats
      const [statsMap, responseStatsMap] = await Promise.all([
        getPeerRatingStatsBatch(candidateIds),
        getPeerResponseStatsBatch(candidateIds),
      ]);

      const scoredCandidates: PublicUserProfile[] = rawCandidates.map((u) => {
        const profile = toPublicProfile(u);
        const stats = statsMap.get(u._id.toString()) || { reviewCount: 0, averageRating: 0 };
        const respStats = responseStatsMap.get(u._id.toString()) || {
          sampleCount: 0,
          avgResponseTimeMs: null,
          hasFastReplyBadge: false,
        };

        const { totalScore, breakdown } = calculatePeerMatchScore(
          {
            topics: profile.topics,
            subjects: profile.subjects,
            mode: profile.mode,
            averageRating: stats.averageRating,
            reviewCount: stats.reviewCount,
            hasFastReplyBadge: respStats.hasFastReplyBadge,
            courses: (u.courses ?? []).map(String),
            courseCodes: profile.courseCodes,
          },
          {
            course: safeCourse,
            q: safeQ,
            topic: safeTopic,
            subject: safeSubject,
            mode: safeMode,
          }
        );

        return {
          ...profile,
          reviewCount: stats.reviewCount,
          averageRating: stats.averageRating,
          responseCount: respStats.sampleCount,
          averageResponseTimeHours:
            respStats.avgResponseTimeMs !== null
              ? parseFloat((respStats.avgResponseTimeMs / (3600 * 1000)).toFixed(1))
              : null,
          hasFastReplyBadge: respStats.hasFastReplyBadge,
          responseStats: respStats,
          matchScore: totalScore,
          matchBreakdown: breakdown,
        };
      });

      // Already in database rank order and limited to this page.
      const peers = scoredCandidates;

      return {
        state: "success",
        peers,
        pagination: {
          page: validPage,
          totalPages,
          totalCount: totalMatching,
          hasPrev: validPage > 1,
          hasNext: validPage < totalPages,
        },
        availableTopics,
        availableSubjects,
      };
    } else {
      // Default discovery without search: preserve existing search/filter behavior & recency ordering
      const rawUsers = await User.find(query)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(PAGE_SIZE)
        .lean();

      const peerIds = rawUsers.map((u) => u._id);
      const [statsMap, responseStatsMap] = await Promise.all([
        getPeerRatingStatsBatch(peerIds),
        getPeerResponseStatsBatch(peerIds),
      ]);

      const peers = rawUsers.map((u) => {
        const profile = toPublicProfile(u);
        const stats = statsMap.get(u._id.toString()) || { reviewCount: 0, averageRating: 0 };
        const respStats = responseStatsMap.get(u._id.toString()) || {
          sampleCount: 0,
          avgResponseTimeMs: null,
          hasFastReplyBadge: false,
        };

        return {
          ...profile,
          reviewCount: stats.reviewCount,
          averageRating: stats.averageRating,
          responseCount: respStats.sampleCount,
          averageResponseTimeHours:
            respStats.avgResponseTimeMs !== null
              ? parseFloat((respStats.avgResponseTimeMs / (3600 * 1000)).toFixed(1))
              : null,
          hasFastReplyBadge: respStats.hasFastReplyBadge,
          responseStats: respStats,
        };
      });

      return {
        state: "success",
        peers,
        pagination: {
          page: validPage,
          totalPages,
          totalCount: totalMatching,
          hasPrev: validPage > 1,
          hasNext: validPage < totalPages,
        },
        availableTopics,
        availableSubjects,
      };
    }
  } catch (error) {
    console.error("[queryPeers] Database error:", error);
    return {
      state: "error",
      message: "The peer directory is temporarily unavailable. Please try again shortly.",
    };
  }
}
