"use server";

import mongoose from "mongoose";
import { revalidatePath } from "next/cache";
import { requireAuth, UnauthorizedError } from "@/lib/auth-guards";
import { ensureDatabaseIndexes } from "@/lib/db";
import { StudyRequest } from "@/models/StudyRequest";
import { User } from "@/models/User";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  CreateStudyRequestSchema,
  TransitionStudyRequestSchema,
  ConfirmCompletionSchema,
  SubmitReviewSchema,
} from "@/lib/validations/request";
import { computeExpiresAt } from "@/lib/request-rules";
import { expireAndNotify, expiredPendingFilter, stillOpenFilter } from "@/lib/request-expiry";
import { notify } from "@/lib/notifications";
import { Course } from "@/models/Course";

export interface RequestActionResult {
  success: boolean;
  message?: string;
  requestId?: string;
  conflict?: boolean;
  rateLimited?: boolean;
  errors?: Record<string, string>;
}

/**
 * Server action to create a new study session request.
 * - Enforces requireAuth() to identify the learner.
 * - Rate-limits creation requests per user with multi-instance MongoDB limiter.
 * - Guarantees unique index existence before accepting writes.
 * - Rejects self-requests and incompatible study modes.
 * - Enforces database-level duplicate prevention for active requests.
 */
export async function createStudyRequest(rawInput: unknown): Promise<RequestActionResult> {
  // 1. Authenticate learner
  let authContext;
  try {
    authContext = await requireAuth();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return {
        success: false,
        message: "You must be signed in to send a study request.",
      };
    }
    return {
      success: false,
      message: "Authentication service error. Please try again.",
    };
  }

  const learnerId = authContext.user._id.toString();

  // 2. Per-user write rate limiting (5 requests per 60 seconds) backed by MongoDB
  let rateLimitResult;
  try {
    rateLimitResult = await checkRateLimit(`req_create:${learnerId}`, 5, 60000);
  } catch (limiterErr) {
    console.error("[createStudyRequest] Rate limiter failure:", limiterErr);
    return {
      success: false,
      message: "Service temporarily unavailable. Please try again shortly.",
    };
  }

  if (!rateLimitResult.allowed) {
    return {
      success: false,
      rateLimited: true,
      message: `Too many requests sent. Please wait ${rateLimitResult.retryAfterSeconds} seconds before trying again.`,
    };
  }

  // 3. Validate input
  const parseResult = CreateStudyRequestSchema.safeParse(rawInput);
  if (!parseResult.success) {
    const errors: Record<string, string> = {};
    for (const issue of parseResult.error.issues) {
      errors[issue.path.join(".")] = issue.message;
    }
    return {
      success: false,
      message: "Please correct the form errors.",
      errors,
    };
  }

  const data = parseResult.data;

  // 4. Reject self-requests
  if (data.peerId === learnerId) {
    return {
      success: false,
      message: "You cannot send a study request to yourself.",
    };
  }

  // 5. Validate peer target
  if (!mongoose.Types.ObjectId.isValid(data.peerId)) {
    return {
      success: false,
      message: "Invalid peer specified.",
    };
  }

  try {
    await ensureDatabaseIndexes();
    const peerUser = await User.findById(data.peerId).lean();

    if (!peerUser || !peerUser.isProfileComplete || peerUser.moderation?.isHidden) {
      return {
        success: false,
        message: "This peer helper profile is currently unavailable.",
      };
    }

    // Verify mode compatibility
    if (peerUser.mode === "online" && data.mode !== "online") {
      return {
        success: false,
        message: "This peer helper only offers online study sessions.",
      };
    }
    if (peerUser.mode === "campus" && data.mode !== "campus") {
      return {
        success: false,
        message: "This peer helper only offers in-person campus sessions.",
      };
    }

    const normalizedTopic = data.topic.toLowerCase().trim();

    let courseCode = "";
    if (data.course) {
      const helperCourses = ((peerUser as { courses?: unknown[] }).courses ?? []).map(String);
      const course = helperCourses.includes(data.course) ? await Course.findOne({ _id: data.course, isHidden: false, mergedInto: null }).lean() : null;
      if (!course) return { success: false, message: "Choose one of this helper's courses, or leave the course empty.", errors: { course: "Not one of this helper's courses" } };
      courseCode = course.code;
    }

    // An overdue pending request to this helper must not block a fresh one.
    await expireAndNotify({ learner: authContext.user._id, peer: peerUser._id });

    // 6. Persist request into MongoDB with partial unique constraint
    const createdAt = new Date();
    const newRequest = await StudyRequest.create({
      learner: authContext.user._id,
      peer: peerUser._id,
      topic: data.topic.trim(),
      normalizedTopic,
      problemDescription: data.problemDescription.trim(),
      mode: data.mode,
      status: "PENDING",
      urgency: data.urgency,
      course: data.course,
      courseCode,
      neededBy: data.neededBy,
      expiresAt: computeExpiresAt(createdAt, data.urgency, data.neededBy),
      createdAt,
    });

    await notify([{
      type: "REQUEST_RECEIVED",
      recipientId: peerUser._id,
      requestId: newRequest._id,
      actorName: authContext.user.name,
      topic: newRequest.topic,
      urgent: data.urgency === "urgent",
      neededBy: data.neededBy,
    }]);

    try {
      revalidatePath("/dashboard");
      revalidatePath(`/peers/${data.peerId}`);
    } catch {
      // no-op in tests
    }

    return {
      success: true,
      message: "Study request sent successfully!",
      requestId: newRequest._id.toString(),
    };
  } catch (err: unknown) {
    // MongoDB duplicate key error code 11000
    if ((err as { code?: number })?.code === 11000) {
      return {
        success: false,
        conflict: true,
        message: "You already have an active study request with this peer for this topic.",
      };
    }
    console.error("[createStudyRequest] Database error:", err);
    return {
      success: false,
      message: "A database error occurred while creating your request. Please try again.",
    };
  }
}

/**
 * Server action to transition request status:
 * - accept: peer ONLY (PENDING -> ACCEPTED)
 * - reject: peer ONLY (PENDING -> REJECTED)
 * - cancel: learner ONLY (PENDING -> CANCELLED)
 * Enforces atomic findOneAndUpdate with status & participant filtering.
 */
export async function transitionStudyRequest(rawInput: unknown): Promise<RequestActionResult> {
  let authContext;
  try {
    authContext = await requireAuth();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return {
        success: false,
        message: "You must be signed in to perform this action.",
      };
    }
    return {
      success: false,
      message: "Authentication service error. Please try again.",
    };
  }

  const userId = authContext.user._id.toString();

  // Rate limiting for state transitions (10 transitions per 60 seconds)
  let rateLimitResult;
  try {
    rateLimitResult = await checkRateLimit(`req_transition:${userId}`, 10, 60000);
  } catch (limiterErr) {
    console.error("[transitionStudyRequest] Rate limiter failure:", limiterErr);
    return {
      success: false,
      message: "Service temporarily unavailable. Please try again shortly.",
    };
  }

  if (!rateLimitResult.allowed) {
    return {
      success: false,
      rateLimited: true,
      message: `Too many actions. Please wait ${rateLimitResult.retryAfterSeconds} seconds before trying again.`,
    };
  }

  const parseResult = TransitionStudyRequestSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      success: false,
      message: "Invalid action parameters.",
    };
  }

  const { requestId, action } = parseResult.data;

  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    return {
      success: false,
      message: "Invalid request ID.",
    };
  }

  try {
    await ensureDatabaseIndexes();
    const userObjectId = authContext.user._id;
    let updated = null;

    const now = new Date();
    if (action === "accept" || action === "reject") {
      // ONLY the peer can respond, and only while the request's response window is open.
      updated = await StudyRequest.findOneAndUpdate(
        { _id: requestId, peer: userObjectId, status: "PENDING", ...stillOpenFilter(now) },
        { $set: { status: action === "accept" ? "ACCEPTED" : "REJECTED", respondedAt: now, priority: 0 } },
        { returnDocument: "after" }
      );
      if (!updated) {
        // Distinguish an overdue request so the helper gets an honest message.
        const overdue = await StudyRequest.exists({ _id: requestId, peer: userObjectId, ...expiredPendingFilter(now) });
        if (overdue) {
          await expireAndNotify({ peer: userObjectId });
          try { revalidatePath("/dashboard"); } catch { /* no-op in tests */ }
          return { success: false, conflict: true, message: "This request expired before you responded, so it can no longer be accepted or declined." };
        }
      } else {
        await notify([{
          type: action === "accept" ? "REQUEST_ACCEPTED" : "REQUEST_DECLINED",
          recipientId: updated.learner,
          requestId: updated._id,
          actorName: authContext.user.name,
          topic: updated.topic,
        }]);
      }
    } else if (action === "cancel") {
      // ONLY the learner can cancel a PENDING request (does NOT set respondedAt)
      updated = await StudyRequest.findOneAndUpdate(
        { _id: requestId, learner: userObjectId, status: "PENDING" },
        { $set: { status: "CANCELLED", priority: 0 } },
        { returnDocument: "after" }
      );
    }

    if (!updated) {
      return {
        success: false,
        conflict: true,
        message: "This request could not be updated because its status has already changed or you are not authorized.",
      };
    }

    try {
      revalidatePath("/dashboard");
    } catch {
      // no-op in tests
    }

    const actionText = action === "accept" ? "accepted" : action === "reject" ? "declined" : "cancelled";
    return {
      success: true,
      message: `Study request successfully ${actionText}.`,
      requestId,
    };
  } catch (err) {
    console.error("[transitionStudyRequest] Database error:", err);
    return {
      success: false,
      message: "A database error occurred while updating the request. Please try again.",
    };
  }
}

/**
 * Server action to confirm session completion:
 * - Uses ONE single atomic MongoDB update pipeline.
 * - Preserves existing confirmation timestamps using $ifNull.
 * - Records only the authenticated participant's confirmation.
 * - Computes COMPLETED from both confirmations in the exact same write.
 * - Fully idempotent on repeated confirmations.
 * - Atomically repairs any prior interrupted state where both confirmations are present.
 */
export async function confirmStudyRequestCompletion(rawInput: unknown): Promise<RequestActionResult> {
  let authContext;
  try {
    authContext = await requireAuth();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return {
        success: false,
        message: "You must be signed in to confirm session completion.",
      };
    }
    return {
      success: false,
      message: "Authentication service error. Please try again.",
    };
  }

  const userId = authContext.user._id.toString();
  const userObjectId = authContext.user._id;

  let rateLimitResult;
  try {
    rateLimitResult = await checkRateLimit(`req_confirm:${userId}`, 10, 60000);
  } catch (limiterErr) {
    console.error("[confirmStudyRequestCompletion] Rate limiter failure:", limiterErr);
    return {
      success: false,
      message: "Service temporarily unavailable. Please try again shortly.",
    };
  }

  if (!rateLimitResult.allowed) {
    return {
      success: false,
      rateLimited: true,
      message: `Too many actions. Please wait ${rateLimitResult.retryAfterSeconds} seconds before trying again.`,
    };
  }

  const parseResult = ConfirmCompletionSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      success: false,
      message: "Invalid completion confirmation request.",
    };
  }

  const { requestId } = parseResult.data;
  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    return {
      success: false,
      message: "Invalid request ID.",
    };
  }

  try {
    await ensureDatabaseIndexes();
    const reqDoc = await StudyRequest.findById(requestId).lean();
    if (!reqDoc) {
      return {
        success: false,
        message: "Study request not found.",
      };
    }

    const isLearner = reqDoc.learner.toString() === userId;
    const isPeer = reqDoc.peer.toString() === userId;

    if (!isLearner && !isPeer) {
      return {
        success: false,
        message: "You are not authorized to confirm completion for this study request.",
      };
    }

    if (reqDoc.status === "REVIEWED") {
      return {
        success: true,
        message: "This session has already been completed and reviewed.",
        requestId,
      };
    }

    if (reqDoc.status !== "ACCEPTED" && reqDoc.status !== "COMPLETED") {
      return {
        success: false,
        message: "Only accepted sessions can be confirmed for completion.",
      };
    }

    const now = new Date();
    let updatedDoc = null;

    // Single atomic MongoDB update pipeline:
    // Preserves existing timestamps, sets only current participant's confirmation if null,
    // and computes COMPLETED atomically if both confirmations exist.
    if (isLearner) {
      updatedDoc = await StudyRequest.findOneAndUpdate(
        {
          _id: requestId,
          learner: userObjectId,
          status: { $in: ["ACCEPTED", "COMPLETED"] },
        },
        [
          {
            $set: {
              learnerConfirmedAt: { $ifNull: ["$learnerConfirmedAt", now] },
              status: {
                $cond: {
                  if: {
                    $and: [
                      { $ne: [{ $ifNull: ["$learnerConfirmedAt", now] }, null] },
                      { $ne: ["$peerConfirmedAt", null] },
                    ],
                  },
                  then: "COMPLETED",
                  else: "$status",
                },
              },
            },
          },
        ],
        { returnDocument: "after", updatePipeline: true }
      );
    } else {
      updatedDoc = await StudyRequest.findOneAndUpdate(
        {
          _id: requestId,
          peer: userObjectId,
          status: { $in: ["ACCEPTED", "COMPLETED"] },
        },
        [
          {
            $set: {
              peerConfirmedAt: { $ifNull: ["$peerConfirmedAt", now] },
              status: {
                $cond: {
                  if: {
                    $and: [
                      { $ne: ["$learnerConfirmedAt", null] },
                      { $ne: [{ $ifNull: ["$peerConfirmedAt", now] }, null] },
                    ],
                  },
                  then: "COMPLETED",
                  else: "$status",
                },
              },
            },
          },
        ],
        { returnDocument: "after", updatePipeline: true }
      );
    }

    if (!updatedDoc) {
      return {
        success: false,
        conflict: true,
        message: "Could not update request status. Please refresh and try again.",
      };
    }

    try {
      revalidatePath("/dashboard");
    } catch {
      // no-op in tests
    }

    const isFullyCompleted = updatedDoc.status === "COMPLETED";
    const wasAlreadyConfirmed = isLearner
      ? Boolean(reqDoc.learnerConfirmedAt)
      : Boolean(reqDoc.peerConfirmedAt);

    if (!wasAlreadyConfirmed) {
      await notify([{
        type: isFullyCompleted ? "SESSION_COMPLETED" : "COMPLETION_CONFIRMED",
        recipientId: isLearner ? updatedDoc.peer : updatedDoc.learner,
        requestId: updatedDoc._id,
        actorName: authContext.user.name,
        topic: updatedDoc.topic,
      }]);
    }

    let responseMessage: string;
    if (isFullyCompleted) {
      responseMessage = wasAlreadyConfirmed
        ? "This session is completed. Both participants have confirmed."
        : "Session completed! Both participants have confirmed.";
    } else {
      responseMessage = wasAlreadyConfirmed
        ? "You have already confirmed completion. Waiting for the other participant to confirm."
        : "Completion confirmed. Waiting for the other participant to confirm.";
    }

    return {
      success: true,
      message: responseMessage,
      requestId,
    };
  } catch (err) {
    console.error("[confirmStudyRequestCompletion] Database error:", err);
    return {
      success: false,
      message: "A database error occurred while confirming completion. Please try again.",
    };
  }
}

/**
 * Server action to submit a learner review:
 * - Only the authenticated learner may review their own COMPLETED request.
 * - Strictly validates 1-5 integer rating and bounded comment.
 * - Atomically embeds review in StudyRequest and transitions COMPLETED -> REVIEWED.
 * - Exactly one review per session, safe against duplicate attempts.
 * - A successfully committed review remains successful even if secondary cache updating fails.
 */
export async function submitStudyRequestReview(rawInput: unknown): Promise<RequestActionResult> {
  let authContext;
  try {
    authContext = await requireAuth();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return {
        success: false,
        message: "You must be signed in to submit a review.",
      };
    }
    return {
      success: false,
      message: "Authentication service error. Please try again.",
    };
  }

  const learnerId = authContext.user._id.toString();
  const learnerObjectId = authContext.user._id;

  let rateLimitResult;
  try {
    rateLimitResult = await checkRateLimit(`req_review:${learnerId}`, 10, 60000);
  } catch (limiterErr) {
    console.error("[submitStudyRequestReview] Rate limiter failure:", limiterErr);
    return {
      success: false,
      message: "Service temporarily unavailable. Please try again shortly.",
    };
  }

  if (!rateLimitResult.allowed) {
    return {
      success: false,
      rateLimited: true,
      message: `Too many actions. Please wait ${rateLimitResult.retryAfterSeconds} seconds before trying again.`,
    };
  }

  const parseResult = SubmitReviewSchema.safeParse(rawInput);
  if (!parseResult.success) {
    const errors: Record<string, string> = {};
    for (const issue of parseResult.error.issues) {
      errors[issue.path.join(".")] = issue.message;
    }
    return {
      success: false,
      message: "Please provide a valid rating between 1 and 5 stars.",
      errors,
    };
  }

  const { requestId, rating, comment } = parseResult.data;
  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    return {
      success: false,
      message: "Invalid request ID.",
    };
  }

  try {
    await ensureDatabaseIndexes();
    const existing = await StudyRequest.findById(requestId).lean();

    if (!existing) {
      return {
        success: false,
        message: "Study session request not found.",
      };
    }

    // Role checks
    if (existing.peer.toString() === learnerId) {
      return {
        success: false,
        message: "Peer helpers cannot review their own study sessions.",
      };
    }

    if (existing.learner.toString() !== learnerId) {
      return {
        success: false,
        message: "Only the student learner who requested this session can submit a review.",
      };
    }

    if (existing.status === "REVIEWED" || existing.review) {
      return {
        success: false,
        conflict: true,
        message: "A review has already been submitted for this study session.",
      };
    }

    if (existing.status !== "COMPLETED") {
      return {
        success: false,
        message: "Reviews can only be submitted after both participants have confirmed session completion.",
      };
    }

    // Atomic write: only update if status is COMPLETED and review is null
    const reviewData = {
      rating,
      comment: comment.trim(),
      createdAt: new Date(),
    };

    const updated = await StudyRequest.findOneAndUpdate(
      {
        _id: requestId,
        learner: learnerObjectId,
        status: "COMPLETED",
        review: null,
      },
      {
        $set: {
          status: "REVIEWED",
          review: reviewData,
        },
      },
      { returnDocument: "after" }
    );

    if (!updated) {
      return {
        success: false,
        conflict: true,
        message: "A review has already been submitted for this session or its status changed.",
      };
    }

    await notify([{ type: "REVIEW_RECEIVED", recipientId: updated.peer, requestId: updated._id, actorName: authContext.user.name, topic: updated.topic }]);

    // Secondary cache update (best-effort, non-fatal: committed review must not fail)
    try {
      const { updateCachedPeerAggregates } = await import("@/lib/peer-reviews");
      await updateCachedPeerAggregates(existing.peer);
    } catch (secondaryErr) {
      console.error("[submitStudyRequestReview] Non-fatal secondary cache update failure:", secondaryErr);
    }

    try {
      revalidatePath("/dashboard");
      revalidatePath(`/peers/${existing.peer.toString()}`);
    } catch {
      // no-op in tests
    }

    return {
      success: true,
      message: "Thank you for your feedback! Your review has been published.",
      requestId,
    };
  } catch (err) {
    console.error("[submitStudyRequestReview] Database error:", err);
    return {
      success: false,
      message: "A database error occurred while submitting your review. Please try again.",
    };
  }
}

/** Archive only the caller's finished request view; preserve the other participant's record. */
export async function archiveStudyRequest(rawInput: unknown): Promise<RequestActionResult> {
  let context;
  try { context = await requireAuth(); }
  catch { return { success: false, message: "Sign in to manage your request history." }; }
  if (!rawInput || typeof rawInput !== "object") return { success: false, message: "Invalid request." };
  const { requestId, archive } = rawInput as Record<string, unknown>;
  if (typeof requestId !== "string" || !/^[a-f\d]{24}$/i.test(requestId) || typeof archive !== "boolean") return { success: false, message: "Invalid request." };
  try {
    const limited = await checkRateLimit(`request_archive:${context.user._id}`, 20, 60000);
    if (!limited.allowed) return { success: false, message: "Please wait a minute before changing your history again." };
    const updated = await StudyRequest.findOneAndUpdate({
      _id: requestId,
      $or: [{ learner: context.user._id }, { peer: context.user._id }],
      status: { $in: ["REJECTED", "CANCELLED", "COMPLETED", "REVIEWED", "EXPIRED"] },
    }, archive ? { $addToSet: { archivedBy: context.user._id } } : { $pull: { archivedBy: context.user._id } }, { returnDocument: "after" });
    if (!updated) return { success: false, message: "Only participants can archive finished requests. Cancel a pending request or complete the session first." };
    try { revalidatePath("/dashboard"); } catch { /* outside Next request */ }
    return { success: true, message: archive ? "Request archived from your list." : "Request restored to your list." };
  } catch { return { success: false, message: "We couldn’t update your history. Please try again." }; }
}
