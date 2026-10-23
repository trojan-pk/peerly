/**
 * User types for Peerly
 * Separates public profile representations from private personal & contact data.
 */

export type LearningMode = "online" | "campus" | "both";
export type PricingPreference = "free" | "paid" | "both";
export type UserRole = "student" | "admin";
export type ContactMethod = "whatsapp" | "meeting_link" | "email" | "unspecified";

export interface PrivateContactInfo {
  whatsapp?: string;
  meetingLink?: string;
  preferredMethod?: ContactMethod;
}

export interface PeerResponseStatsDTO {
  sampleCount: number;
  avgResponseTimeMs: number | null;
  hasFastReplyBadge: boolean;
}

export interface MatchScoreBreakdown {
  totalScore: number;
  topicPoints: number;
  topicMatchReason: string;
  modePoints: number;
  modeMatchReason: string;
  ratingPoints: number;
  ratingReason: string;
  badgePoints: number;
  badgeReason: string;
}

/**
 * Public User Profile DTO
 * Safe for search, peer listings, and unauthenticated/unauthorized viewers.
 * MUST NOT contain email, googleId, or private contact details.
 */
export interface PublicUserProfile {
  id: string;
  name: string;
  image?: string;
  bio: string;
  university: string;
  campus: string;
  topics: string[];
  subjects: string[];
  mode: LearningMode;
  availability: string;
  pricingPreference: PricingPreference;
  isProfileComplete: boolean;
  reviewCount: number;
  averageRating: number;
  responseCount: number;
  averageResponseTimeHours: number | null;
  hasFastReplyBadge?: boolean;
  responseStats?: PeerResponseStatsDTO;
  matchScore?: number;
  matchBreakdown?: MatchScoreBreakdown;
  createdAt: string;
}

/**
 * Authorized Contact DTO
 * Only revealed to authorized participants after a session request is ACCEPTED/COMPLETED.
 */
export interface AuthorizedContact {
  peerId: string;
  peerName: string;
  email?: string;
  whatsapp?: string;
  meetingLink?: string;
  preferredMethod: ContactMethod;
}

/**
 * Full User Document representation (for internal authenticated operations)
 */
export interface IUser {
  _id: string;
  googleId: string;
  email: string;
  name: string;
  image: string;
  role: UserRole;
  bio: string;
  university: string;
  campus: string;
  topics: string[];
  subjects: string[];
  mode: LearningMode;
  availability: string;
  pricingPreference: PricingPreference;
  contact: PrivateContactInfo;
  isProfileComplete: boolean;
  reviewCount: number;
  averageRating: number;
  responseCount: number;
  averageResponseTimeHours: number | null;
  createdAt: Date;
  updatedAt: Date;
}
