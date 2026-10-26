"use server";

import { Course } from "@/models/Course";
import { setResourceVote } from "@/lib/resource-votes";

import mongoose from "mongoose";
import { revalidatePath } from "next/cache";
import { requireAuth, UnauthorizedError } from "@/lib/auth-guards";
import { ensureDatabaseIndexes } from "@/lib/db";
import { Resource } from "@/models/Resource";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  CreateResourceSchema,
  UpdateResourceSchema,
  DeleteResourceSchema,
  validateSafeUrl,
} from "@/lib/validations/resource";

export interface ResourceActionResult {
  success: boolean;
  message?: string;
  resourceId?: string;
  conflict?: boolean;
  rateLimited?: boolean;
  errors?: Record<string, string>;
}

/** Resolves an optional course id that must be one of the caller's own catalogue courses. */
async function resolveOwnCourse(user: { courses?: unknown[] }, courseId: string | null): Promise<{ ok: true; course: mongoose.Types.ObjectId | null; code: string } | { ok: false }> {
  if (!courseId) return { ok: true, course: null, code: "" };
  if (!(user.courses ?? []).map(String).includes(courseId)) return { ok: false };
  const course = await Course.findOne({ _id: courseId, isHidden: false, mergedInto: null }).select("code").lean();
  return course ? { ok: true, course: course._id as mongoose.Types.ObjectId, code: course.code } : { ok: false };
}

/**
 * Server action to create a new academic resource link.
 * - Resolves owner strictly through requireAuth(), never client input.
 * - Rate limits writes per user key.
 * - Rejects non-HTTP/HTTPS and malformed URLs.
 * - Prevents privileged-field injection via strict schema validation.
 */
export async function createResource(rawInput: unknown): Promise<ResourceActionResult> {
  let authContext;
  try {
    authContext = await requireAuth();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return {
        success: false,
        message: "You must be signed in to publish a resource.",
      };
    }
    return {
      success: false,
      message: "Authentication service error. Please try again.",
    };
  }

  const userId = authContext.user._id.toString();

  // Rate limiting (10 resource creations per 60 seconds)
  let rateLimitResult;
  try {
    rateLimitResult = await checkRateLimit(`res_create:${userId}`, 10, 60000);
  } catch (limiterErr) {
    console.error("[createResource] Rate limiter failure:", limiterErr);
    return {
      success: false,
      message: "Service temporarily unavailable. Please try again shortly.",
    };
  }

  if (!rateLimitResult.allowed) {
    return {
      success: false,
      rateLimited: true,
      message: `Too many resource submissions. Please wait ${rateLimitResult.retryAfterSeconds} seconds before trying again.`,
    };
  }

  // Validate input schema
  const parseResult = CreateResourceSchema.safeParse(rawInput);
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

  // Normalized safe URL
  const urlCheck = validateSafeUrl(data.url);
  if (!urlCheck.valid || !urlCheck.normalizedUrl) {
    return {
      success: false,
      message: urlCheck.error || "Invalid resource URL.",
      errors: { url: urlCheck.error || "Invalid URL" },
    };
  }

  try {
    await ensureDatabaseIndexes();

    const normalizedTopic = data.topic.trim().toLowerCase();
    const course = await resolveOwnCourse(authContext.user, data.course);
    if (!course.ok) return { success: false, message: "Choose one of your own courses, or leave the course empty.", errors: { course: "Not one of your courses" } };

    const newDoc = await Resource.create({
      course: course.course,
      courseCode: course.code,
      owner: authContext.user._id,
      title: data.title.trim(),
      description: data.description.trim(),
      topic: data.topic.trim(),
      normalizedTopic,
      url: urlCheck.normalizedUrl,
    });

    try {
      revalidatePath("/resources");
      revalidatePath("/resources/manage");
      revalidatePath(`/peers/${userId}`);
    } catch {
      // no-op in tests
    }

    return {
      success: true,
      message: "Resource published successfully!",
      resourceId: newDoc._id.toString(),
    };
  } catch (err) {
    console.error("[createResource] Database error:", err);
    return {
      success: false,
      message: "A database error occurred while publishing the resource. Please try again.",
    };
  }
}

/**
 * Server action to update an existing academic resource.
 * - Resolves owner strictly through requireAuth().
 * - Enforces atomic ownership inside the update query (owner must match).
 * - Rejects unauthorized updates or non-existent resources.
 */
export async function updateResource(rawInput: unknown): Promise<ResourceActionResult> {
  let authContext;
  try {
    authContext = await requireAuth();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return {
        success: false,
        message: "You must be signed in to edit a resource.",
      };
    }
    return {
      success: false,
      message: "Authentication service error. Please try again.",
    };
  }

  const userId = authContext.user._id.toString();

  // Rate limiting (15 updates per 60 seconds)
  let rateLimitResult;
  try {
    rateLimitResult = await checkRateLimit(`res_update:${userId}`, 15, 60000);
  } catch (limiterErr) {
    console.error("[updateResource] Rate limiter failure:", limiterErr);
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

  const parseResult = UpdateResourceSchema.safeParse(rawInput);
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

  if (!mongoose.Types.ObjectId.isValid(data.resourceId)) {
    return {
      success: false,
      message: "Invalid resource ID.",
    };
  }

  const urlCheck = validateSafeUrl(data.url);
  if (!urlCheck.valid || !urlCheck.normalizedUrl) {
    return {
      success: false,
      message: urlCheck.error || "Invalid resource URL.",
      errors: { url: urlCheck.error || "Invalid URL" },
    };
  }

  try {
    await ensureDatabaseIndexes();

    const normalizedTopic = data.topic.trim().toLowerCase();
    const course = await resolveOwnCourse(authContext.user, data.course);
    if (!course.ok) return { success: false, message: "Choose one of your own courses, or leave the course empty.", errors: { course: "Not one of your courses" } };

    // Atomic update strictly filtering by resource ID AND authenticated owner!
    const updated = await Resource.findOneAndUpdate(
      {
        _id: data.resourceId,
        owner: authContext.user._id,
      },
      {
        $set: {
          title: data.title.trim(),
          description: data.description.trim(),
          topic: data.topic.trim(),
          normalizedTopic,
          course: course.course,
          courseCode: course.code,
          url: urlCheck.normalizedUrl,
        },
      },
      { returnDocument: "after" }
    );

    if (!updated) {
      return {
        success: false,
        conflict: true,
        message: "Resource could not be updated. It may not exist or you are not authorized to edit it.",
      };
    }

    try {
      revalidatePath("/resources");
      revalidatePath("/resources/manage");
      revalidatePath(`/peers/${userId}`);
    } catch {
      // no-op in tests
    }

    return {
      success: true,
      message: "Resource updated successfully!",
      resourceId: data.resourceId,
    };
  } catch (err) {
    console.error("[updateResource] Database error:", err);
    return {
      success: false,
      message: "A database error occurred while updating the resource. Please try again.",
    };
  }
}

/**
 * Server action to delete an academic resource.
 * - Resolves owner strictly through requireAuth().
 * - Enforces atomic ownership inside the delete query (owner must match).
 */
export async function deleteResource(rawInput: unknown): Promise<ResourceActionResult> {
  let authContext;
  try {
    authContext = await requireAuth();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return {
        success: false,
        message: "You must be signed in to delete a resource.",
      };
    }
    return {
      success: false,
      message: "Authentication service error. Please try again.",
    };
  }

  const userId = authContext.user._id.toString();

  // Rate limiting (15 deletes per 60 seconds)
  let rateLimitResult;
  try {
    rateLimitResult = await checkRateLimit(`res_delete:${userId}`, 15, 60000);
  } catch (limiterErr) {
    console.error("[deleteResource] Rate limiter failure:", limiterErr);
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

  const parseResult = DeleteResourceSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      success: false,
      message: "Invalid resource deletion request.",
    };
  }

  const { resourceId } = parseResult.data;

  if (!mongoose.Types.ObjectId.isValid(resourceId)) {
    return {
      success: false,
      message: "Invalid resource ID.",
    };
  }

  try {
    await ensureDatabaseIndexes();

    // Atomic delete strictly filtering by resource ID AND authenticated owner!
    const deleted = await Resource.findOneAndDelete({
      _id: resourceId,
      owner: authContext.user._id,
    });

    if (!deleted) {
      return {
        success: false,
        conflict: true,
        message: "Resource could not be deleted. It may not exist or you are not authorized to delete it.",
      };
    }

    try {
      revalidatePath("/resources");
      revalidatePath("/resources/manage");
      revalidatePath(`/peers/${userId}`);
    } catch {
      // no-op in tests
    }

    return {
      success: true,
      message: "Resource deleted successfully.",
      resourceId,
    };
  } catch (err) {
    console.error("[deleteResource] Database error:", err);
    return {
      success: false,
      message: "A database error occurred while deleting the resource. Please try again.",
    };
  }
}

/** Marks a resource as helpful (or removes the mark). Signed-in members only; not your own. */
export async function setResourceUpvote(rawInput: unknown): Promise<{ success: boolean; message?: string; upvoted?: boolean; count?: number }> {
  let authContext;
  try {
    authContext = await requireAuth();
  } catch {
    return { success: false, message: "Sign in to mark resources as helpful." };
  }
  const body = (rawInput ?? {}) as Record<string, unknown>;
  if (typeof body.upvote !== "boolean") return { success: false, message: "Invalid request." };
  try {
    const limited = await checkRateLimit(`resource_vote:${authContext.user._id}`, 30, 60_000);
    if (!limited.allowed) return { success: false, message: "Please wait a moment before voting again." };
    const result = await setResourceVote(authContext.user._id as mongoose.Types.ObjectId, body.resourceId, body.upvote);
    if (!result.ok) return { success: false, message: result.message };
    try { revalidatePath("/resources"); } catch { /* outside a request */ }
    return { success: true, upvoted: result.upvoted, count: result.count };
  } catch (error) {
    console.error("[setResourceUpvote] failed:", error instanceof Error ? error.message : "unknown");
    return { success: false, message: "We couldn't save your vote. Please try again." };
  }
}
