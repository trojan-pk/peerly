"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDialogFocus } from "@/components/useDialogFocus";
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Clock,
  User as UserIcon,
  BookOpen,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { AdminReportsResult } from "@/lib/reports";
import {
  resolveReportAction,
  toggleTargetModerationAction,
} from "@/app/reports/actions";

interface AdminReportsViewProps {
  initialResult: AdminReportsResult;
  currentStatus: string;
}

export default function AdminReportsView({
  initialResult,
  currentStatus,
}: AdminReportsViewProps) {
  const router = useRouter();
  const reports = initialResult.reports;
  const counts = initialResult.counts;
  const [isPending, startTransition] = useTransition();

  // Action states
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Resolution modal state
  const [resolvingReportId, setResolvingReportId] = useState<string | null>(null);
  const [resolveAction, setResolveAction] = useState<"RESOLVE" | "DISMISS">("RESOLVE");
  const [moderatorNotes, setModeratorNotes] = useState("");

  // Target moderation reason state
  const [moderatingTarget, setModeratingTarget] = useState<{
    type: "user" | "resource";
    id: string;
    action: "HIDE" | "RESTORE";
    title: string;
  } | null>(null);
  const [moderationReason, setModerationReason] = useState("");

  const activeTab = currentStatus.toUpperCase() || "ALL";

  const dialogRef = useDialogFocus(Boolean(resolvingReportId || moderatingTarget), () => {
    if (!isPending) { setResolvingReportId(null); setModeratingTarget(null); }
  });

  const handleOpenResolve = (reportId: string, action: "RESOLVE" | "DISMISS") => {
    setActionError(null);
    setActionSuccess(null);
    setResolvingReportId(reportId);
    setResolveAction(action);
    setModeratorNotes("");
  };

  const handleConfirmResolve = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingReportId) return;

    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      try {
        const result = await resolveReportAction({
          reportId: resolvingReportId,
          action: resolveAction,
          moderatorNotes: moderatorNotes.trim() || undefined,
        });

        if (result.success) {
          setActionSuccess(result.message || "Report decision recorded successfully.");
          setResolvingReportId(null);

          // Refresh server component data in the background
          router.refresh();
        } else {
          setActionError(result.message || "Failed to resolve report.");
        }
      } catch (err) {
        console.error("[AdminReportsView] Resolve error:", err);
        setActionError("An unexpected error occurred. Please try again.");
      }
    });
  };

  const handleOpenModerateTarget = (
    type: "user" | "resource",
    id: string,
    action: "HIDE" | "RESTORE",
    title: string
  ) => {
    setActionError(null);
    setActionSuccess(null);
    setModeratingTarget({ type, id, action, title });
    setModerationReason(
      action === "HIDE"
        ? "Violated community conduct guidelines"
        : "Content reviewed and approved"
    );
  };

  const handleConfirmModerateTarget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!moderatingTarget) return;

    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      try {
        const result = await toggleTargetModerationAction({
          targetType: moderatingTarget.type,
          targetId: moderatingTarget.id,
          action: moderatingTarget.action,
          reason: moderationReason.trim() || undefined,
        });

        if (result.success) {
          setActionSuccess(result.message || "Target visibility updated successfully.");
          setModeratingTarget(null);

          // Refresh server data
          router.refresh();
        } else {
          setActionError(result.message || "Failed to update target moderation.");
        }
      } catch (err) {
        console.error("[AdminReportsView] Moderation error:", err);
        setActionError("An unexpected error occurred. Please try again.");
      }
    });
  };

  const buildFilterUrl = (status: string, page = 1) => {
    const params = new URLSearchParams();
    if (status !== "ALL") params.set("status", status.toLowerCase());
    if (page > 1) params.set("page", String(page));
    const str = params.toString();
    return `/admin/reports${str ? `?${str}` : ""}`;
  };

  return (
    <div className="space-y-6">
      {/* Alert Notices */}
      {actionSuccess && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50/90 p-4 text-xs text-emerald-900 flex items-center justify-between gap-3 shadow-xs"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
            <p className="font-medium">{actionSuccess}</p>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50/90 p-4 text-xs text-red-900 flex items-center justify-between gap-3 shadow-xs"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
            <p className="font-medium">{actionError}</p>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-red-700 hover:text-red-900 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs / Status Navigation */}
      <div className="flex items-center gap-2 border-b border-stone-200/90 pb-px overflow-x-auto">
        <Link
          href={buildFilterUrl("ALL")}
          className={`px-4 py-2.5 rounded-t-xl text-xs font-semibold transition-colors flex items-center gap-2 shrink-0 ${
            activeTab === "ALL"
              ? "border-b-2 border-stone-900 text-stone-900 bg-stone-100/70"
              : "text-stone-500 hover:text-stone-800 hover:bg-stone-50"
          }`}
        >
          <span>All Reports</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-stone-200 text-stone-700">
            {counts.all}
          </span>
        </Link>

        <Link
          href={buildFilterUrl("OPEN")}
          className={`px-4 py-2.5 rounded-t-xl text-xs font-semibold transition-colors flex items-center gap-2 shrink-0 ${
            activeTab === "OPEN"
              ? "border-b-2 border-red-600 text-red-700 bg-red-50/60"
              : "text-stone-500 hover:text-stone-800 hover:bg-stone-50"
          }`}
        >
          <span>Open</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] ${
              counts.open > 0 ? "bg-red-100 text-red-800 font-bold" : "bg-stone-200 text-stone-700"
            }`}
          >
            {counts.open}
          </span>
        </Link>

        <Link
          href={buildFilterUrl("RESOLVED")}
          className={`px-4 py-2.5 rounded-t-xl text-xs font-semibold transition-colors flex items-center gap-2 shrink-0 ${
            activeTab === "RESOLVED"
              ? "border-b-2 border-emerald-600 text-emerald-800 bg-emerald-50/60"
              : "text-stone-500 hover:text-stone-800 hover:bg-stone-50"
          }`}
        >
          <span>Resolved</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-stone-200 text-stone-700">
            {counts.resolved}
          </span>
        </Link>

        <Link
          href={buildFilterUrl("DISMISSED")}
          className={`px-4 py-2.5 rounded-t-xl text-xs font-semibold transition-colors flex items-center gap-2 shrink-0 ${
            activeTab === "DISMISSED"
              ? "border-b-2 border-stone-600 text-stone-800 bg-stone-100/70"
              : "text-stone-500 hover:text-stone-800 hover:bg-stone-50"
          }`}
        >
          <span>Dismissed</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-stone-200 text-stone-700">
            {counts.dismissed}
          </span>
        </Link>
      </div>

      {/* Reports Listing */}
      {reports.length > 0 ? (
        <div className="space-y-4">
          {reports.map((report) => (
            <article
              key={report.id}
              className={`rounded-2xl border bg-white p-5 space-y-4 shadow-xs transition-colors ${
                report.status === "OPEN" ? "border-amber-200" : "border-stone-200"
              }`}
            >
              {/* Header: Target & Status Badge */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-stone-100 pb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider ${
                        report.targetType === "user"
                          ? "bg-blue-50 text-blue-800 border border-blue-200"
                          : "bg-purple-50 text-purple-800 border border-purple-200"
                      }`}
                    >
                      {report.targetType === "user" ? (
                        <UserIcon className="w-3 h-3" aria-hidden="true" />
                      ) : (
                        <BookOpen className="w-3 h-3" aria-hidden="true" />
                      )}
                      <span>{report.targetType === "user" ? "Peer Profile" : "Study Resource"}</span>
                    </span>

                    {/* Target Moderation Status */}
                    {report.target.isHidden ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-red-100 text-red-800 border border-red-200">
                        <EyeOff className="w-3 h-3" aria-hidden="true" />
                        <span>Hidden From Public</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <Eye className="w-3 h-3" aria-hidden="true" />
                        <span>Publicly Visible</span>
                      </span>
                    )}

                    {/* Moderation Audit Trail Badge (Both Hide and Restore) */}
                    {report.target.moderationAction && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-stone-100 text-stone-600 border border-stone-200">
                        <span>
                          Last: {report.target.moderationAction === "HIDE" ? "Hidden" : "Restored"}
                        </span>
                        {report.target.moderatedBy && (
                          <span>by {report.target.moderatedBy.name}</span>
                        )}
                        {report.target.moderationDate && (
                          <span>on {new Date(report.target.moderationDate).toLocaleDateString()}</span>
                        )}
                      </span>
                    )}

                    {report.target.isDeleted && (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-stone-100 text-stone-500">
                        Item Deleted from Database
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-bold text-stone-900">
                      {report.target.title}
                    </h2>
                    {report.target.link && !report.target.isDeleted && (
                      <a
                        href={report.target.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800 hover:underline font-medium"
                      >
                        <span>View item</span>
                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      </a>
                    )}
                  </div>

                  {report.target.subtitle && (
                    <p className="text-xs text-stone-500">{report.target.subtitle}</p>
                  )}

                  {report.target.moderationReason && (
                    <p className="text-[11px] text-stone-500 italic">
                      Moderation note: &ldquo;{report.target.moderationReason}&rdquo;
                    </p>
                  )}
                </div>

                {/* Report Status */}
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      report.status === "OPEN"
                        ? "bg-red-100 text-red-800 border border-red-300"
                        : report.status === "RESOLVED"
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : "bg-stone-100 text-stone-700 border border-stone-300"
                    }`}
                  >
                    {report.status}
                  </span>
                </div>
              </div>

              {/* Body: Reason, Explanation & Reporter info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {/* Reason & Explanation */}
                <div className="md:col-span-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-stone-500">Reason:</span>
                    <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-800 font-semibold">
                      {report.reason}
                    </span>
                  </div>
                  <div className="rounded-xl border border-stone-200/80 bg-stone-50/70 p-3 space-y-1">
                    <span className="font-semibold text-stone-600 block">Reported Explanation:</span>
                    <p className="text-stone-800 leading-relaxed whitespace-pre-line">
                      {report.explanation}
                    </p>
                  </div>
                </div>

                {/* Reporter Identity (Admin Only) */}
                <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-3 space-y-1.5 self-start">
                  <span className="font-semibold text-stone-500 block">Reporter (Admin View)</span>
                  <p className="font-bold text-stone-900">{report.reporter.name}</p>
                  <p className="text-[11px] text-stone-600 font-mono break-all">
                    {report.reporter.email}
                  </p>
                  <div className="flex items-center gap-1 text-[11px] text-stone-400 pt-1 border-t border-stone-200/60">
                    <Clock className="w-3 h-3" aria-hidden="true" />
                    <span>Submitted {new Date(report.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Resolution Details if not OPEN */}
              {report.status !== "OPEN" && (
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs space-y-1.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-bold text-stone-800">
                      Moderation Decision ({report.status})
                    </span>
                    {report.resolvedAt && (
                      <span className="text-stone-500 text-[11px]">
                        {new Date(report.resolvedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  {report.resolvedBy && (
                    <p className="text-stone-600">
                      Moderator: <span className="font-semibold">{report.resolvedBy.name}</span> ({report.resolvedBy.email})
                    </p>
                  )}
                  {report.moderatorNotes && (
                    <p className="text-stone-700 italic">
                      &ldquo;{report.moderatorNotes}&rdquo;
                    </p>
                  )}
                </div>
              )}

              {/* Admin Actions Bar */}
              <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3">
                {/* Target Moderation: Reversible Hide / Restore */}
                {!report.target.isDeleted && (
                  <div className="flex items-center gap-2">
                    {report.target.isHidden ? (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          handleOpenModerateTarget(
                            report.targetType,
                            report.targetId,
                            "RESTORE",
                            report.target.title
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-stone-500" aria-hidden="true" />
                        <span>Restore to Public</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          handleOpenModerateTarget(
                            report.targetType,
                            report.targetId,
                            "HIDE",
                            report.target.title
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-700 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <EyeOff className="w-3.5 h-3.5 text-red-600" aria-hidden="true" />
                        <span>Hide From Public</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Report Resolution: Resolve or Dismiss */}
                {report.status === "OPEN" && (
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleOpenResolve(report.id, "DISMISS")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-100 text-stone-700 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5 text-stone-500" aria-hidden="true" />
                      <span>Dismiss Report</span>
                    </button>

                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleOpenResolve(report.id, "RESOLVE")}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Resolve Report</span>
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center space-y-2">
          <ShieldAlert className="w-10 h-10 text-stone-300 mx-auto" aria-hidden="true" />
          <h3 className="text-sm font-bold text-stone-900">No Reports Found</h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            {activeTab === "OPEN"
              ? "All clear! There are currently no pending open reports awaiting moderator review."
              : `No reports matching status "${activeTab}".`}
          </p>
        </div>
      )}

      {/* Pagination */}
      {initialResult.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4 border-t border-stone-200">
          {initialResult.pagination.hasPrev ? (
            <Link
              href={buildFilterUrl(activeTab, initialResult.pagination.page - 1)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Previous</span>
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-200 bg-stone-50 text-xs font-semibold text-stone-400 cursor-not-allowed">
              <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Previous</span>
            </span>
          )}

          <span className="text-xs text-stone-600 font-medium">
            Page {initialResult.pagination.page} of {initialResult.pagination.totalPages}
          </span>

          {initialResult.pagination.hasNext ? (
            <Link
              href={buildFilterUrl(activeTab, initialResult.pagination.page + 1)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-200 bg-stone-50 text-xs font-semibold text-stone-400 cursor-not-allowed">
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
          )}
        </div>
      )}

      {/* Modal: Resolve / Dismiss Report */}
      {resolvingReportId && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="resolve-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <h3 id="resolve-dialog-title" className="text-sm font-bold text-stone-900">
              {resolveAction === "RESOLVE" ? "Resolve Report" : "Dismiss Report"}
            </h3>
            <p className="text-xs text-stone-600">
              {resolveAction === "RESOLVE"
                ? "Mark this report as resolved. Your moderator identity and timestamp will be atomically recorded."
                : "Dismiss this report if no community guideline violation occurred."}
            </p>

            <form onSubmit={handleConfirmResolve} className="space-y-3">
              <div className="space-y-1">
                <label
                  htmlFor="moderator-notes"
                  className="block text-xs font-semibold text-stone-700"
                >
                  Decision Note (Optional)
                </label>
                <textarea
                  id="moderator-notes"
                  rows={3}
                  maxLength={1000}
                  value={moderatorNotes}
                  onChange={(e) => setModeratorNotes(e.target.value)}
                  placeholder="Provide context or decision rationale for platform audit logs..."
                  className="w-full text-xs rounded-xl border border-stone-300 p-2.5 text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setResolvingReportId(null)}
                  className="px-4 py-2 rounded-xl border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-semibold transition-colors ${
                    resolveAction === "RESOLVE"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-stone-800 hover:bg-stone-900"
                  }`}
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                  <span>Confirm {resolveAction === "RESOLVE" ? "Resolution" : "Dismissal"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reversible Target Moderation (Hide / Restore) */}
      {moderatingTarget && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="mod-target-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <h3 id="mod-target-title" className="text-sm font-bold text-stone-900">
              {moderatingTarget.action === "HIDE"
                ? `Hide ${moderatingTarget.type === "user" ? "Peer Profile" : "Study Resource"}`
                : `Restore ${moderatingTarget.type === "user" ? "Peer Profile" : "Study Resource"}`}
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              {moderatingTarget.action === "HIDE"
                ? `Hiding will remove "${moderatingTarget.title}" from all public discovery pages, detail views, and filter chips. This action is completely reversible.`
                : `Restoring will immediately return "${moderatingTarget.title}" to public search and discovery.`}
            </p>

            <form onSubmit={handleConfirmModerateTarget} className="space-y-3">
              <div className="space-y-1">
                <label
                  htmlFor="mod-reason"
                  className="block text-xs font-semibold text-stone-700"
                >
                  Moderation Reason
                </label>
                <input
                  id="mod-reason"
                  type="text"
                  maxLength={500}
                  value={moderationReason}
                  onChange={(e) => setModerationReason(e.target.value)}
                  placeholder={
                    moderatingTarget.action === "HIDE"
                      ? "e.g. Inappropriate content, academic policy violation..."
                      : "e.g. Content reviewed and compliant, appeal accepted..."
                  }
                  className="w-full text-xs rounded-xl border border-stone-300 p-2.5 text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setModeratingTarget(null)}
                  className="px-4 py-2 rounded-xl border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-semibold transition-colors ${
                    moderatingTarget.action === "HIDE"
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                  <span>
                    {moderatingTarget.action === "HIDE" ? "Hide from Public" : "Restore Visibility"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
