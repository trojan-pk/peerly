import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { StudyRequest } from "@/models/StudyRequest";
import { Resource } from "@/models/Resource";
import { ResourceVote } from "@/models/ResourceVote";
import { Notification } from "@/models/Notification";
import { Report } from "@/models/Report";
import { Course, EmailVerification, University } from "@/models/Course";
import { updateCachedPeerAggregates } from "@/lib/peer-reviews";

export const DELETED_USER_NAME = "Deleted user";
export const REMOVED_PROBLEM_TEXT = "[Removed when the learner deleted their account]";

const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : d ? new Date(d as string).toISOString() : null);

/**
 * Everything Peerly stores about the caller, as plain JSON. Includes their own private
 * fields (email, contact, verified university address) but never other people's private
 * data — counterparts appear by first name only.
 */
export async function exportAccountData(userId: mongoose.Types.ObjectId) {
  await connectToDatabase();
  const user = await User.findById(userId).select("+contact +universityEmail -avatarData").lean();
  if (!user) return null;
  const [requests, resources, votes, notifications, reports] = await Promise.all([
    StudyRequest.find({ $or: [{ learner: userId }, { peer: userId }] }).select("+meetingRoom").populate("learner", "name").populate("peer", "name").sort({ createdAt: 1 }).lean(),
    Resource.find({ owner: userId }).sort({ createdAt: 1 }).lean(),
    ResourceVote.find({ user: userId }).populate("resource", "title").lean(),
    Notification.find({ recipient: userId }).sort({ createdAt: 1 }).lean(),
    Report.find({ reporter: userId }).sort({ createdAt: 1 }).lean(),
  ]);
  const first = (p: unknown) => ((p as { name?: string } | null)?.name ?? DELETED_USER_NAME).split(/\s+/)[0];
  return {
    exportedAt: new Date().toISOString(),
    format: "peerly-account-export/1",
    profile: {
      id: String(user._id), name: user.name, email: user.email, role: user.role,
      university: user.university, campus: user.campus, bio: user.bio, topics: user.topics, subjects: user.subjects,
      courseCodes: user.courseCodes, mode: user.mode, availability: user.availability, pricingPreference: user.pricingPreference,
      contact: user.contact, emailAlerts: user.emailAlerts,
      universityEmail: user.universityEmail ?? null, universityEmailVerifiedAt: iso(user.universityEmailVerifiedAt), verifiedUniversityName: user.verifiedUniversityName || null,
      publicPageEnabled: user.publicPageEnabled, publicSlug: user.publicSlug ?? null,
      createdAt: iso(user.createdAt), updatedAt: iso(user.updatedAt),
    },
    requests: requests.map((r) => {
      const asLearner = String((r.learner as unknown as { _id?: unknown })?._id ?? r.learner) === String(userId);
      return {
        id: String(r._id), role: asLearner ? "learner" : "helper", otherPerson: first(asLearner ? r.peer : r.learner),
        topic: r.topic, courseCode: r.courseCode || null, problemDescription: r.problemDescription, mode: r.mode, status: r.status,
        urgency: r.urgency, neededBy: iso(r.neededBy), createdAt: iso(r.createdAt), respondedAt: iso(r.respondedAt),
        scheduledAt: iso(r.scheduledAt), learnerConfirmedAt: iso(r.learnerConfirmedAt), peerConfirmedAt: iso(r.peerConfirmedAt),
        review: r.review ? { rating: r.review.rating, comment: r.review.comment, createdAt: iso(r.review.createdAt) } : null,
      };
    }),
    resources: resources.map((r) => ({ id: String(r._id), title: r.title, description: r.description, topic: r.topic, courseCode: r.courseCode || null, url: r.url, helpfulVotes: r.upvoteCount ?? 0, createdAt: iso(r.createdAt) })),
    helpfulVotes: votes.map((v) => ({ resource: (v.resource as unknown as { title?: string } | null)?.title ?? "(removed resource)", createdAt: iso(v.createdAt) })),
    notifications: notifications.map((n) => ({ type: n.type, topic: n.topic, from: n.actorFirstName || null, read: Boolean(n.readAt), createdAt: iso(n.createdAt) })),
    reportsFiled: reports.map((r) => ({ targetType: r.targetType, reason: r.reason, explanation: r.explanation, status: r.status, createdAt: iso((r as { createdAt?: Date }).createdAt) })),
  };
}

/**
 * Permanently deletes the caller's account and personal data while keeping other
 * members' histories intact:
 * - profile, resources (and votes on them), their own votes, notifications, reports they
 *   filed and any pending university-email code are deleted;
 * - requests stay for the other participant, shown with "Deleted user"; the problem text
 *   and review comment the deleted person wrote are removed, the star rating stays so the
 *   helper's average does not change;
 * - pending or accepted requests are cancelled so nobody waits on a deleted account.
 */
export async function deleteAccount(userId: mongoose.Types.ObjectId): Promise<{ deleted: boolean }> {
  await connectToDatabase();
  const user = await User.findById(userId).select("_id").lean();
  if (!user) return { deleted: false };

  // Votes the user cast: remove and keep counters consistent.
  const myVotes = await ResourceVote.find({ user: userId }).select("resource").lean();
  for (const vote of myVotes) {
    const removed = await ResourceVote.deleteOne({ _id: vote._id });
    if (removed.deletedCount === 1) await Resource.updateOne({ _id: vote.resource, upvoteCount: { $gt: 0 } }, { $inc: { upvoteCount: -1 } });
  }
  // Resources the user owns, and votes on them.
  const ownResources = await Resource.find({ owner: userId }).select("_id").lean();
  const resourceIds = ownResources.map((r) => r._id);
  await ResourceVote.deleteMany({ resource: { $in: resourceIds } });
  await Resource.deleteMany({ owner: userId });

  // Requests: close open ones, redact what the deleted person wrote, keep the rest.
  await StudyRequest.updateMany({ $or: [{ learner: userId }, { peer: userId }], status: { $in: ["PENDING", "ACCEPTED"] } }, { $set: { status: "CANCELLED", priority: 0, proposedSlots: [], scheduledAt: null } });
  await StudyRequest.updateMany({ learner: userId }, { $set: { problemDescription: REMOVED_PROBLEM_TEXT } });
  await StudyRequest.updateMany({ learner: userId, "review.comment": { $nin: ["", null] } }, { $set: { "review.comment": "" } });
  const helpedBy = await StudyRequest.distinct("peer", { learner: userId, status: "REVIEWED" });

  await Promise.all([
    Notification.deleteMany({ recipient: userId }),
    Report.deleteMany({ reporter: userId }),
    EmailVerification.deleteMany({ user: userId }),
    Course.updateMany({ createdBy: userId }, { $set: { createdBy: null } }),
    University.updateMany({ createdBy: userId }, { $set: { createdBy: null } }),
  ]);
  await User.deleteOne({ _id: userId });
  // Helper aggregates are derived from reviews (which remain); refresh cached copies.
  await Promise.all(helpedBy.map((peer) => updateCachedPeerAggregates(peer).catch(() => undefined)));
  return { deleted: true };
}
