import mongoose from "mongoose";
import { randomBytes } from "node:crypto";
import { connectToDatabase, ensureDatabaseIndexes } from "@/lib/db";
import { User, type IUserDocument } from "@/models/User";
import { StudyRequest } from "@/models/StudyRequest";
import { getPeerRatingStats } from "@/lib/peer-reviews";
import { formatResponseTime, getPeerResponseStats } from "@/lib/peer-responses";
import { slugify } from "@/lib/course-rules";

export const PUBLIC_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$/;

/**
 * Public, shareable helper summary. Every number is derived from stored sessions,
 * reviews and responses. It never contains email, contact details, reviews' text or
 * any request content.
 */
export interface PublicHelperPageDTO {
  slug: string;
  name: string;
  university: string;
  verifiedUniversityName: string | null;
  courseCodes: string[];
  topics: string[];
  completedSessions: number;
  reviewCount: number;
  averageRating: number;
  responseCount: number;
  averageResponse: string | null;
  hasFastReplyBadge: boolean;
  memberSince: string;
}

export async function getPublicHelperPage(rawSlug: unknown): Promise<PublicHelperPageDTO | null> {
  if (typeof rawSlug !== "string" || !PUBLIC_SLUG_PATTERN.test(rawSlug)) return null;
  await connectToDatabase();
  const user = await User.findOne({ publicSlug: rawSlug, publicPageEnabled: true, isProfileComplete: true, "moderation.isHidden": { $ne: true } })
    .select("name university topics courseCodes universityEmailVerifiedAt verifiedUniversityName createdAt publicSlug")
    .lean();
  if (!user) return null;
  const peerId = user._id as mongoose.Types.ObjectId;
  const [completedSessions, rating, responses] = await Promise.all([
    StudyRequest.countDocuments({ peer: peerId, status: { $in: ["COMPLETED", "REVIEWED"] } }),
    getPeerRatingStats(peerId),
    getPeerResponseStats(peerId),
  ]);
  return {
    slug: rawSlug,
    name: user.name,
    university: user.university ?? "",
    verifiedUniversityName: user.universityEmailVerifiedAt && user.verifiedUniversityName ? user.verifiedUniversityName : null,
    courseCodes: user.courseCodes ?? [],
    topics: (user.topics ?? []).slice(0, 12),
    completedSessions,
    reviewCount: rating.reviewCount,
    averageRating: rating.averageRating,
    responseCount: responses.sampleCount,
    averageResponse: responses.avgResponseTimeMs !== null ? formatResponseTime(responses.avgResponseTimeMs) : null,
    hasFastReplyBadge: responses.hasFastReplyBadge,
    memberSince: new Date(user.createdAt).toISOString(),
  };
}

/** Turns the caller's public page on or off. The link (slug) is kept so it stays stable. */
export async function setPublicPage(user: IUserDocument, enabled: boolean): Promise<{ ok: true; slug: string | null; enabled: boolean } | { ok: false; message: string }> {
  await ensureDatabaseIndexes();
  const me = await User.findById(user._id).select("publicSlug name isProfileComplete").lean();
  if (!me) return { ok: false, message: "Account not found." };
  if (enabled && !me.isProfileComplete) return { ok: false, message: "Complete your profile before publishing a public page." };
  let slug = me.publicSlug ?? null;
  if (enabled && !slug) {
    const base = slugify(me.name).slice(0, 40) || "helper";
    for (let attempt = 0; attempt < 5 && !slug; attempt++) {
      const candidate = `${base}-${randomBytes(3).toString("hex")}`;
      try {
        const res = await User.updateOne({ _id: user._id, publicSlug: null }, { $set: { publicSlug: candidate } });
        if (res.modifiedCount === 1) slug = candidate;
        else slug = (await User.findById(user._id).select("publicSlug").lean())?.publicSlug ?? null;
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
      }
    }
    if (!slug) return { ok: false, message: "We couldn't create your link. Please try again." };
  }
  await User.updateOne({ _id: user._id }, { $set: { publicPageEnabled: enabled } });
  return { ok: true, slug, enabled };
}
