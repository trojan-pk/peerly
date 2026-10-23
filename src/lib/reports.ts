import mongoose from "mongoose";
import { connectToDatabase, isDatabaseConfigured, ensureDatabaseIndexes } from "@/lib/db";
import { Report, ReportStatus, ReportTargetType } from "@/models/Report";
import { User } from "@/models/User";
import { Resource } from "@/models/Resource";
import { requireAuth, requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/auth-guards";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  CreateReportSchema,
  ResolveReportSchema,
  ModerateTargetSchema,
} from "@/lib/validations/report";

export interface TargetSummaryDTO {
  id: string;
  type: ReportTargetType;
  title: string;
  subtitle?: string;
  link?: string;
  isDeleted: boolean;
  isHidden: boolean;
  moderationAction?: "HIDE" | "RESTORE" | null;
  moderationReason?: string | null;
  moderationDate?: string | null;
  moderatedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface AdminReportDTO {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  target: TargetSummaryDTO;
  reporter: {
    id: string;
    name: string;
    email: string;
  };
  reason: string;
  explanation: string;
  status: ReportStatus;
  moderatorNotes?: string;
  resolvedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminReportsResult {
  state: "success" | "unconfigured" | "error";
  reports: AdminReportDTO[];
  pagination: {
    page: number;
    totalPages: number;
    totalCount: number;
    hasPrev: boolean;
    hasNext: boolean;
  };
  counts: {
    all: number;
    open: number;
    resolved: number;
    dismissed: number;
  };
  message?: string;
}

export interface ReportActionResult {
  success: boolean;
  message?: string;
  reportId?: string;
  conflict?: boolean;
  rateLimited?: boolean;
  errors?: Record<string, string>;
}

interface LeanModeratorRef {
  _id?: mongoose.Types.ObjectId | string;
  name?: string;
  email?: string;
}

interface LeanUserTarget {
  _id: mongoose.Types.ObjectId | string;
  name?: string;
  email?: string;
  university?: string;
  campus?: string;
  image?: string;
  moderation?: {
    isHidden?: boolean;
    action?: "HIDE" | "RESTORE" | null;
    moderatedAt?: Date | string | null;
    moderatedBy?: LeanModeratorRef | mongoose.Types.ObjectId | string | null;
    reason?: string | null;
    hiddenAt?: Date | string | null;
    hiddenBy?: LeanModeratorRef | mongoose.Types.ObjectId | string | null;
  };
}

interface LeanResourceTarget {
  _id: mongoose.Types.ObjectId | string;
  title?: string;
  topic?: string;
  url?: string;
  owner?: mongoose.Types.ObjectId | string;
  moderation?: {
    isHidden?: boolean;
    action?: "HIDE" | "RESTORE" | null;
    moderatedAt?: Date | string | null;
    moderatedBy?: LeanModeratorRef | mongoose.Types.ObjectId | string | null;
    reason?: string | null;
    hiddenAt?: Date | string | null;
    hiddenBy?: LeanModeratorRef | mongoose.Types.ObjectId | string | null;
  };
}

interface LeanReportDoc {
  _id: mongoose.Types.ObjectId | string;
  targetType: ReportTargetType;
  targetId: mongoose.Types.ObjectId | string;
  reporter?: {
    _id?: mongoose.Types.ObjectId | string;
    name?: string;
    email?: string;
  };
  reason: string;
  explanation: string;
  status: ReportStatus;
  moderatorNotes?: string;
  resolvedBy?: {
    _id?: mongoose.Types.ObjectId | string;
    name?: string;
    email?: string;
  } | null;
  resolvedAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Retrieves paginated reports for administrators.
 * Strictly enforces requireAdmin() inside the read operation.
 * Keeps reporter email and moderator details confined to authorized admin responses.
 */
export async function getAdminReports(
  statusFilter: string = "ALL",
  rawPage: string | number = 1,
  pageSize: number = 10
): Promise<AdminReportsResult> {
  // 1. Strict server-side authorization check against active ADMIN_EMAILS
  await requireAdmin();

  if (!isDatabaseConfigured()) {
    return {
      state: "unconfigured",
      reports: [],
      pagination: { page: 1, totalPages: 1, totalCount: 0, hasPrev: false, hasNext: false },
      counts: { all: 0, open: 0, resolved: 0, dismissed: 0 },
    };
  }

  try {
    await connectToDatabase();
    await ensureDatabaseIndexes();

    const boundedPageSize = Math.max(1, Math.min(pageSize, 50));
    const parsedPage = typeof rawPage === "number" ? rawPage : parseInt(String(rawPage || "1"), 10);
    const safePage = Math.max(1, Math.min(isNaN(parsedPage) ? 1 : parsedPage, 10000));

    // Status filter
    const query: Record<string, unknown> = {};
    const upperFilter = statusFilter.toUpperCase();
    if (upperFilter === "OPEN" || upperFilter === "RESOLVED" || upperFilter === "DISMISSED") {
      query.status = upperFilter;
    }

    // Counts for tabs
    const [allCount, openCount, resolvedCount, dismissedCount, totalFiltered] = await Promise.all([
      Report.countDocuments({}),
      Report.countDocuments({ status: "OPEN" }),
      Report.countDocuments({ status: "RESOLVED" }),
      Report.countDocuments({ status: "DISMISSED" }),
      Report.countDocuments(query),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalFiltered / boundedPageSize));
    const validPage = Math.min(safePage, totalPages);
    const skip = (validPage - 1) * boundedPageSize;

    const rawReports = await Report.find(query)
      .populate("reporter", "name email")
      .populate("resolvedBy", "name email")
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(boundedPageSize)
      .lean();

    // Batch resolve targets
    const userIdsToFetch: mongoose.Types.ObjectId[] = [];
    const resourceIdsToFetch: mongoose.Types.ObjectId[] = [];

    for (const r of rawReports) {
      if (r.targetType === "user" && mongoose.Types.ObjectId.isValid(r.targetId)) {
        userIdsToFetch.push(new mongoose.Types.ObjectId(r.targetId));
      } else if (r.targetType === "resource" && mongoose.Types.ObjectId.isValid(r.targetId)) {
        resourceIdsToFetch.push(new mongoose.Types.ObjectId(r.targetId));
      }
    }

    const [usersFound, resourcesFound] = await Promise.all([
      userIdsToFetch.length > 0
        ? User.find({ _id: { $in: userIdsToFetch } })
            .select("name email university campus image moderation")
            .populate("moderation.moderatedBy", "name email")
            .lean()
        : [],
      resourceIdsToFetch.length > 0
        ? Resource.find({ _id: { $in: resourceIdsToFetch } })
            .select("title topic url owner moderation")
            .populate("moderation.moderatedBy", "name email")
            .lean()
        : [],
    ]);

    const usersMap = new Map<string, LeanUserTarget>(
      (usersFound as unknown as LeanUserTarget[]).map((u) => [u._id.toString(), u])
    );
    const resourcesMap = new Map<string, LeanResourceTarget>(
      (resourcesFound as unknown as LeanResourceTarget[]).map((res) => [res._id.toString(), res])
    );

    const reports: AdminReportDTO[] = (rawReports as unknown as LeanReportDoc[]).map((r) => {
      const targetIdStr = r.targetId.toString();
      let targetSummary: TargetSummaryDTO;

      if (r.targetType === "user") {
        const u = usersMap.get(targetIdStr);
        if (u) {
          const modBy = u.moderation?.moderatedBy as LeanModeratorRef | undefined;
          targetSummary = {
            id: targetIdStr,
            type: "user",
            title: u.name || "Student Peer",
            subtitle: u.university || u.email,
            link: `/peers/${targetIdStr}`,
            isDeleted: false,
            isHidden: Boolean(u.moderation?.isHidden),
            moderationAction: u.moderation?.action || (u.moderation?.isHidden ? "HIDE" : null),
            moderationReason: u.moderation?.reason || null,
            moderationDate: u.moderation?.moderatedAt
              ? new Date(u.moderation.moderatedAt).toISOString()
              : u.moderation?.hiddenAt
              ? new Date(u.moderation.hiddenAt).toISOString()
              : null,
            moderatedBy: modBy && typeof modBy === "object" && modBy.name
              ? {
                  id: modBy._id ? modBy._id.toString() : "",
                  name: modBy.name,
                  email: modBy.email || "",
                }
              : null,
          };
        } else {
          targetSummary = {
            id: targetIdStr,
            type: "user",
            title: "[Deleted Peer Profile]",
            isDeleted: true,
            isHidden: false,
          };
        }
      } else {
        const res = resourcesMap.get(targetIdStr);
        if (res) {
          const modBy = res.moderation?.moderatedBy as LeanModeratorRef | undefined;
          targetSummary = {
            id: targetIdStr,
            type: "resource",
            title: res.title || "Study Resource",
            subtitle: res.topic ? `Topic: ${res.topic}` : undefined,
            link: res.url,
            isDeleted: false,
            isHidden: Boolean(res.moderation?.isHidden),
            moderationAction: res.moderation?.action || (res.moderation?.isHidden ? "HIDE" : null),
            moderationReason: res.moderation?.reason || null,
            moderationDate: res.moderation?.moderatedAt
              ? new Date(res.moderation.moderatedAt).toISOString()
              : res.moderation?.hiddenAt
              ? new Date(res.moderation.hiddenAt).toISOString()
              : null,
            moderatedBy: modBy && typeof modBy === "object" && modBy.name
              ? {
                  id: modBy._id ? modBy._id.toString() : "",
                  name: modBy.name,
                  email: modBy.email || "",
                }
              : null,
          };
        } else {
          targetSummary = {
            id: targetIdStr,
            type: "resource",
            title: "[Deleted Study Resource]",
            isDeleted: true,
            isHidden: false,
          };
        }
      }

      return {
        id: r._id.toString(),
        targetType: r.targetType,
        targetId: targetIdStr,
        target: targetSummary,
        reporter: {
          id: r.reporter?._id ? r.reporter._id.toString() : "",
          name: r.reporter?.name || "Anonymous Student",
          email: r.reporter?.email || "",
        },
        reason: r.reason,
        explanation: r.explanation,
        status: r.status,
        moderatorNotes: r.moderatorNotes || "",
        resolvedBy: r.resolvedBy
          ? {
              id: r.resolvedBy._id ? r.resolvedBy._id.toString() : "",
              name: r.resolvedBy.name || "Admin",
              email: r.resolvedBy.email || "",
            }
          : null,
        resolvedAt: r.resolvedAt ? new Date(r.resolvedAt).toISOString() : null,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
      };
    });

    return {
      state: "success",
      reports,
      pagination: {
        page: validPage,
        totalPages,
        totalCount: totalFiltered,
        hasPrev: validPage > 1,
        hasNext: validPage < totalPages,
      },
      counts: {
        all: allCount,
        open: openCount,
        resolved: resolvedCount,
        dismissed: dismissedCount,
      },
    };
  } catch (error) {
    console.error("[getAdminReports] Error:", error);
    return {
      state: "error",
      reports: [],
      pagination: { page: 1, totalPages: 1, totalCount: 0, hasPrev: false, hasNext: false },
      counts: { all: 0, open: 0, resolved: 0, dismissed: 0 },
      message: "Unable to load reports due to a database error.",
    };
  }
}

/**
 * Creates a new report for a peer or resource.
 * - Resolves reporter identity strictly via requireAuth().
 * - Validates target existence and rejects self-reports.
 * - Rate-limits creation requests per user.
 * - Enforces database-level unique constraint preventing duplicate OPEN reports.
 * - Returns consistent safe failure states without throwing unhandled exceptions.
 */
export async function submitReport(rawInput: unknown): Promise<ReportActionResult> {
  let authContext;
  try {
    authContext = await requireAuth();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return {
        success: false,
        message: "You must be signed in to submit a report.",
      };
    }
    return {
      success: false,
      message: "Authentication service error. Please try again.",
    };
  }

  const reporterId = authContext.user._id.toString();

  // Rate limiting (5 report submissions per 60 seconds)
  let rateLimitResult;
  try {
    rateLimitResult = await checkRateLimit(`report_submit:${reporterId}`, 5, 60000);
  } catch (limiterErr) {
    console.error("[submitReport] Rate limiter failure:", limiterErr);
    return {
      success: false,
      message: "Service temporarily unavailable. Please try again shortly.",
    };
  }

  if (!rateLimitResult.allowed) {
    return {
      success: false,
      rateLimited: true,
      message: `Too many reports submitted. Please wait ${rateLimitResult.retryAfterSeconds} seconds before trying again.`,
    };
  }

  // Validate input
  const parseResult = CreateReportSchema.safeParse(rawInput);
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

  if (!mongoose.Types.ObjectId.isValid(data.targetId)) {
    return {
      success: false,
      message: "Invalid target identifier.",
    };
  }

  if (!isDatabaseConfigured()) {
    return {
      success: false,
      message: "Database service is not configured.",
    };
  }

  try {
    await connectToDatabase();
    await ensureDatabaseIndexes();

    // Validate target existence and self-reporting
    if (data.targetType === "user") {
      if (data.targetId === reporterId) {
        return {
          success: false,
          message: "You cannot report your own profile.",
        };
      }

      const targetUser = await User.findById(data.targetId).lean();
      if (!targetUser) {
        return {
          success: false,
          message: "The peer you are trying to report could not be found.",
        };
      }
    } else if (data.targetType === "resource") {
      const targetResource = await Resource.findById(data.targetId).lean();
      if (!targetResource) {
        return {
          success: false,
          message: "The study resource you are trying to report could not be found.",
        };
      }

      if (targetResource.owner.toString() === reporterId) {
        return {
          success: false,
          message: "You cannot report your own published resource.",
        };
      }
    }

    const newReport = await Report.create({
      targetType: data.targetType,
      targetId: new mongoose.Types.ObjectId(data.targetId),
      reporter: authContext.user._id,
      reason: data.reason,
      explanation: data.explanation.trim(),
      status: "OPEN",
    });

    return {
      success: true,
      message: "Thank you. Your report has been submitted for moderation review.",
      reportId: newReport._id.toString(),
    };
  } catch (err: unknown) {
    // Duplicate OPEN report constraint (MongoDB error 11000)
    if ((err as { code?: number })?.code === 11000) {
      return {
        success: false,
        conflict: true,
        message: "You already have an open report pending review for this item.",
      };
    }

    console.error("[submitReport] Error:", err);
    return {
      success: false,
      message: "A database error occurred while submitting your report. Please try again.",
    };
  }
}

/**
 * Resolves or dismisses an open report with moderator notes.
 * Strictly enforces requireAdmin() and atomic state transition.
 * Returns consistent safe failure states without throwing unhandled exceptions.
 */
export async function resolveReport(rawInput: unknown): Promise<ReportActionResult> {
  let authContext;
  try {
    authContext = await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return {
        success: false,
        message: "You must be signed in to resolve reports.",
      };
    }
    if (err instanceof ForbiddenError) {
      return {
        success: false,
        message: "Administrative privileges are required to resolve reports.",
      };
    }
    return {
      success: false,
      message: "Authentication service error. Please try again.",
    };
  }

  const parseResult = ResolveReportSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      success: false,
      message: "Invalid resolution parameters.",
    };
  }

  const { reportId, action, moderatorNotes } = parseResult.data;

  if (!mongoose.Types.ObjectId.isValid(reportId)) {
    return {
      success: false,
      message: "Invalid report ID.",
    };
  }

  if (!isDatabaseConfigured()) {
    return {
      success: false,
      message: "Database service is not configured.",
    };
  }

  try {
    await connectToDatabase();
    await ensureDatabaseIndexes();

    const newStatus: ReportStatus = action === "RESOLVE" ? "RESOLVED" : "DISMISSED";

    // Atomic transition: only updates if current status is "OPEN"
    const updated = await Report.findOneAndUpdate(
      { _id: reportId, status: "OPEN" },
      {
        $set: {
          status: newStatus,
          moderatorNotes: moderatorNotes ? moderatorNotes.trim() : "",
          resolvedBy: authContext.user._id,
          resolvedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );

    if (!updated) {
      return {
        success: false,
        conflict: true,
        message: "This report could not be updated. It may have already been resolved or does not exist.",
      };
    }

    return {
      success: true,
      message: `Report ${action === "RESOLVE" ? "resolved" : "dismissed"} successfully.`,
      reportId,
    };
  } catch (err) {
    console.error("[resolveReport] Error:", err);
    return {
      success: false,
      message: "A database error occurred while updating the report. Please try again.",
    };
  }
}

/**
 * Hides or restores a reported target (peer profile or resource).
 * Reversible moderation action strictly restricted to verified administrators.
 * Records the last moderation action, actor, timestamp, and reason for BOTH hide and restore.
 * Returns consistent safe failure states without throwing unhandled exceptions.
 */
export async function toggleTargetModeration(rawInput: unknown): Promise<ReportActionResult> {
  let authContext;
  try {
    authContext = await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return {
        success: false,
        message: "You must be signed in to moderate content.",
      };
    }
    if (err instanceof ForbiddenError) {
      return {
        success: false,
        message: "Administrative privileges are required to moderate content.",
      };
    }
    return {
      success: false,
      message: "Authentication service error. Please try again.",
    };
  }

  const parseResult = ModerateTargetSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      success: false,
      message: "Invalid moderation parameters.",
    };
  }

  const { targetType, targetId, action, reason } = parseResult.data;

  if (!mongoose.Types.ObjectId.isValid(targetId)) {
    return {
      success: false,
      message: "Invalid target ID.",
    };
  }

  if (!isDatabaseConfigured()) {
    return {
      success: false,
      message: "Database service is not configured.",
    };
  }

  try {
    await connectToDatabase();
    await ensureDatabaseIndexes();

    const isHidden = action === "HIDE";
    const moderatedAt = new Date();
    const moderatedBy = authContext.user._id;
    const moderationReason =
      reason?.trim() ||
      (isHidden ? "Violated community guidelines" : "Restored by moderator");

    const updateSet: Record<string, unknown> = {
      "moderation.isHidden": isHidden,
      "moderation.action": action,
      "moderation.moderatedAt": moderatedAt,
      "moderation.moderatedBy": moderatedBy,
      "moderation.reason": moderationReason,
    };

    if (isHidden) {
      updateSet["moderation.hiddenAt"] = moderatedAt;
      updateSet["moderation.hiddenBy"] = moderatedBy;
    }

    if (targetType === "user") {
      const updated = await User.findByIdAndUpdate(
        targetId,
        { $set: updateSet },
        { returnDocument: "after" }
      );

      if (!updated) {
        return {
          success: false,
          message: "Peer profile could not be found.",
        };
      }
    } else if (targetType === "resource") {
      const updated = await Resource.findByIdAndUpdate(
        targetId,
        { $set: updateSet },
        { returnDocument: "after" }
      );

      if (!updated) {
        return {
          success: false,
          message: "Study resource could not be found.",
        };
      }
    }

    return {
      success: true,
      message: `${targetType === "user" ? "Peer profile" : "Resource"} ${
        isHidden ? "hidden from public view" : "restored to public view"
      } successfully.`,
    };
  } catch (err) {
    console.error("[toggleTargetModeration] Error:", err);
    return {
      success: false,
      message: "A database error occurred while updating moderation status. Please try again.",
    };
  }
}
