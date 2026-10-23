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

    // 6. Persist request into MongoDB with partial unique constraint
    const newRequest = await StudyRequest.create({
      learner: authContext.user._id,
      peer: peerUser._id,
      topic: data.topic.trim(),
      normalizedTopic,
      problemDescription: data.problemDescription.trim(),
      mode: data.mode,
      status: "PENDING",
    });

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

    if (action === "accept") {
      // ONLY the peer can accept a PENDING request
      updated = await StudyRequest.findOneAndUpdate(
        { _id: requestId, peer: userObjectId, status: "PENDING" },
        { $set: { status: "ACCEPTED", respondedAt: new Date() } },
        { returnDocument: "after" }
      );
    } else if (action === "reject") {
      // ONLY the peer can reject a PENDING request
      updated = await StudyRequest.findOneAndUpdate(
        { _id: requestId, peer: userObjectId, status: "PENDING" },
        { $set: { status: "REJECTED", respondedAt: new Date() } },
        { returnDocument: "after" }
      );
    } else if (action === "cancel") {
      // ONLY the learner can cancel a PENDING request (does NOT set respondedAt)
      updated = await StudyRequest.findOneAndUpdate(
        { _id: requestId, learner: userObjectId, status: "PENDING" },
        { $set: { status: "CANCELLED" } },
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
