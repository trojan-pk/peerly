import { MatchScoreBreakdown } from "@/types/user";

export interface MatchScoringOptions {
  q?: string;
  topic?: string;
  subject?: string;
  mode?: string;
}

export function normalizeMatchTag(str: string): string {
  return str.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Deterministic peer match score calculator.
 * Strictly adheres to agreed rules:
 * - Exact normalized topic match: 50 points
 * - Otherwise matching normalized subject: 25 points
 * - Compatible explicitly selected learning mode: 20 points, including peers offering 'both'
 * - Authoritative average rating: (rating / 5) * 20 points; no reviews means 0
 * - Earned fast-reply badge: 10 points
 * - Normalize case and whitespace consistently
 * - Total score is labeled 'Match score: X/100'
 */
export function calculatePeerMatchScore(
  peer: {
    topics: string[];
    subjects: string[];
    mode: string;
    averageRating: number;
    reviewCount: number;
    hasFastReplyBadge: boolean;
  },
  options: MatchScoringOptions
): { totalScore: number; breakdown: MatchScoreBreakdown } {
  let topicPoints = 0;
  let topicMatchReason = "No topic match";

  const peerTopics = (peer.topics || []).map(normalizeMatchTag);
  const peerSubjects = (peer.subjects || []).map(normalizeMatchTag);

  // Search targets to evaluate:
  const searchTargets: string[] = [];
  if (options.topic && options.topic.trim().length > 0) {
    searchTargets.push(normalizeMatchTag(options.topic));
  }
  if (options.q && options.q.trim().length > 0) {
    searchTargets.push(normalizeMatchTag(options.q));
  }
  if (options.subject && options.subject.trim().length > 0) {
    searchTargets.push(normalizeMatchTag(options.subject));
  }

  // 1. Exact normalized topic match: 50 points
  const hasExactTopicMatch = searchTargets.some((target) =>
    peerTopics.some((t) => t === target)
  );

  if (hasExactTopicMatch) {
    topicPoints = 50;
    topicMatchReason = "Exact topic match";
  } else {
    // 2. Otherwise matching normalized subject: 25 points
    const hasSubjectMatch = searchTargets.some((target) =>
      peerSubjects.some((s) => s === target)
    );
    if (hasSubjectMatch) {
      topicPoints = 25;
      topicMatchReason = "Matching subject";
    }
  }

  // 3. Compatible explicitly selected learning mode: 20 points, including peers offering 'both'
  let modePoints = 0;
  let modeMatchReason = "No mode filter applied";

  if (options.mode) {
    const selectedMode = options.mode.trim().toLowerCase();
    if (selectedMode === "online") {
      if (peer.mode === "online" || peer.mode === "both") {
        modePoints = 20;
        modeMatchReason = "Compatible online mode";
      } else {
        modeMatchReason = "Incompatible mode (campus only)";
      }
    } else if (selectedMode === "campus") {
      if (peer.mode === "campus" || peer.mode === "both") {
        modePoints = 20;
        modeMatchReason = "Compatible campus mode";
      } else {
        modeMatchReason = "Incompatible mode (online only)";
      }
    } else if (selectedMode === "both") {
      if (peer.mode === "both" || peer.mode === "online" || peer.mode === "campus") {
        modePoints = 20;
        modeMatchReason = "Compatible mode";
      }
    }
  }

  // 4. Authoritative average rating: (rating / 5) * 20 points; no reviews means 0
  let ratingPoints = 0;
  let ratingReason = "New helper (no reviews yet)";

  if (peer.reviewCount > 0 && peer.averageRating > 0) {
    const boundedRating = Math.max(0, Math.min(peer.averageRating, 5));
    ratingPoints = Math.round((boundedRating / 5) * 20);
    ratingReason = `Authoritative rating (${peer.averageRating.toFixed(1)}★ across ${peer.reviewCount} ${
      peer.reviewCount === 1 ? "review" : "reviews"
    })`;
  }

  // 5. Earned fast-reply badge: 10 points
  let badgePoints = 0;
  let badgeReason = "No fast-reply badge earned";

  if (peer.hasFastReplyBadge) {
    badgePoints = 10;
    badgeReason = "Earned fast-reply badge";
  }

  const totalScore = Math.min(
    100,
    Math.max(0, topicPoints + modePoints + ratingPoints + badgePoints)
  );

  return {
    totalScore,
    breakdown: {
      totalScore,
      topicPoints,
      topicMatchReason,
      modePoints,
      modeMatchReason,
      ratingPoints,
      ratingReason,
      badgePoints,
      badgeReason,
    },
  };
}
