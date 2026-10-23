"use client";

import { useState, useTransition, useId } from "react";
import { useDialogFocus } from "@/components/useDialogFocus";
import Link from "next/link";
import {
  Flag,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X,
  LogIn,
  ShieldAlert,
} from "lucide-react";
import { submitReportAction } from "@/app/reports/actions";

interface ReportButtonProps {
  targetType: "user" | "resource";
  targetId: string;
  targetTitle: string;
  isAuthenticated?: boolean;
  isCurrentUser?: boolean;
  variant?: "button" | "subtle" | "icon";
  className?: string;
}

const REPORT_REASONS = [
  { value: "inappropriate", label: "Inappropriate or offensive content" },
  { value: "spam", label: "Spam or promotional advertising" },
  { value: "harassment", label: "Harassment, hate speech, or abuse" },
  { value: "copyright", label: "Copyright or intellectual property issue" },
  { value: "misleading", label: "Misleading or fraudulent academic information" },
  { value: "broken_link", label: "Broken, unsafe, or dead link" },
  { value: "other", label: "Other community guideline violation" },
];

export function ReportButton({
  targetType,
  targetId,
  targetTitle,
  isAuthenticated = false,
  isCurrentUser = false,
  variant = "subtle",
  className = "",
}: ReportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("inappropriate");
  const [explanation, setExplanation] = useState("");
  const [isPending, startTransition] = useTransition();

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSuccess, setIsSuccess] = useState(false);


  const titleId = useId();
  const dialogRef = useDialogFocus(isOpen, () => { if (!isPending) setIsOpen(false); });

  // Users cannot report themselves
  if (isCurrentUser) {
    return null;
  }

  const handleOpen = () => {
    setErrorMsg(null);
    setFieldErrors({});
    setIsSuccess(false);
    setReason("inappropriate");
    setExplanation("");
    setIsOpen(true);
  };

  const handleClose = () => {
    if (!isPending) {
      setIsOpen(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFieldErrors({});

    if (explanation.trim().length < 10) {
      setFieldErrors({ explanation: "Explanation must be at least 10 characters." });
      return;
    }

    startTransition(async () => {
      try {
        const result = await submitReportAction({
          targetType,
          targetId,
          reason,
          explanation: explanation.trim(),
        });

        if (result.success) {
          setIsSuccess(true);
        } else {
          setErrorMsg(result.message || "Failed to submit report. Please try again.");
          if (result.errors) {
            setFieldErrors(result.errors);
          }
        }
      } catch (err) {
        console.error("[ReportButton] Submit error:", err);
        setErrorMsg("An unexpected error occurred. Please try again.");
      }
    });
  };

  return (
    <>
      {variant === "button" && (
        <button
          type="button"
          onClick={handleOpen}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line hover:border-danger/25 hover:bg-danger/10 text-muted hover:text-danger text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 cursor-pointer ${className}`}
          aria-label={`Report ${targetType === "user" ? "peer profile" : "study resource"}`}
        >
          <Flag className="w-3.5 h-3.5 text-faint group-hover:text-danger" aria-hidden="true" />
          <span>Report</span>
        </button>
      )}

      {variant === "subtle" && (
        <button
          type="button"
          onClick={handleOpen}
          className={`inline-flex items-center gap-1 text-[11px] text-faint hover:text-danger transition-colors focus-visible:outline-none focus-visible:underline cursor-pointer ${className}`}
          aria-label={`Report ${targetType === "user" ? "peer profile" : "study resource"}`}
        >
          <Flag className="w-3 h-3" aria-hidden="true" />
          <span>Report</span>
        </button>
      )}

      {variant === "icon" && (
        <button
          type="button"
          onClick={handleOpen}
          className={`p-1.5 rounded-lg text-faint hover:text-danger hover:bg-danger/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 cursor-pointer ${className}`}
          title={`Report ${targetType === "user" ? "peer profile" : "study resource"}`}
          aria-label={`Report ${targetType === "user" ? "peer profile" : "study resource"}`}
        >
          <Flag className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      )}

      {/* Modal Dialog */}
      {isOpen && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 space-y-5 shadow-xl animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-danger/15 text-danger flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 id={titleId} className="text-sm font-bold text-ink">
                    Report {targetType === "user" ? "Peer Profile" : "Study Resource"}
                  </h2>
                  <p className="text-xs text-muted truncate max-w-[280px] sm:max-w-[340px]">
                    &ldquo;{targetTitle}&rdquo;
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={isPending}
                onClick={handleClose}
                className="p-1 rounded-lg text-faint hover:text-body hover:bg-raised transition-colors"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* If user is NOT authenticated, display sign-in prompt */}
            {!isAuthenticated ? (
              <div className="space-y-4 py-2">
                <div className="rounded-xl border border-warning/25 bg-warning/10 p-4 text-xs text-warning space-y-1.5">
                  <p className="font-semibold text-warning flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-warning" aria-hidden="true" />
                    Sign-in Required to Report Content
                  </p>
                  <p className="leading-relaxed text-warning">
                    To maintain community safety and prevent automated abuse, only authenticated students can submit reports for review by platform moderators.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 rounded-xl border border-edge hover:bg-panel text-body text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-action hover:bg-action-hover text-white text-xs font-semibold transition-colors"
                  >
                    <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Sign In</span>
                  </Link>
                </div>
              </div>
            ) : isSuccess ? (
              /* Success confirmation state */
              <div className="space-y-4 py-2 text-center">
                <div className="w-12 h-12 rounded-full bg-accent/15 text-accent flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-ink">
                    Report Submitted
                  </h3>
                  <p className="text-xs text-muted max-w-sm mx-auto leading-relaxed">
                    Thank you for helping keep our peer community safe. Platform administrators will review this report and take appropriate moderation action.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-5 py-2 rounded-xl bg-canvas hover:bg-canvas text-white text-xs font-semibold transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              /* Report submission form */
              <form onSubmit={handleSubmit} className="space-y-4">
                {errorMsg && (
                  <div
                    role="alert"
                    className="rounded-xl border border-danger/25 bg-danger/10 p-3 text-xs text-danger flex items-start gap-2"
                  >
                    <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" aria-hidden="true" />
                    <p className="leading-relaxed">{errorMsg}</p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="report-reason" className="block text-xs font-semibold text-body">
                    Reason for Report <span className="text-danger">*</span>
                  </label>
                  <select
                    id="report-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full text-xs rounded-xl border border-edge p-2.5 bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-red-500"
                    disabled={isPending}
                  >
                    {REPORT_REASONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="report-explanation" className="block text-xs font-semibold text-body">
                    Explanation / Evidence <span className="text-danger">*</span>
                  </label>
                  <textarea
                    id="report-explanation"
                    rows={4}
                    required
                    minLength={10}
                    maxLength={1000}
                    value={explanation}
                    onChange={(e) => setExplanation(e.target.value)}
                    placeholder="Please describe why this content violates community guidelines (minimum 10 characters)..."
                    className="w-full text-xs rounded-xl border border-edge p-2.5 text-ink focus:outline-none focus:ring-2 focus:ring-red-500"
                    disabled={isPending}
                  />
                  <div className="flex justify-between items-center text-[11px] text-faint">
                    <span>{explanation.length} / 1000 characters (min. 10)</span>
                    {fieldErrors.explanation && (
                      <span className="text-danger">{fieldErrors.explanation}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handleClose}
                    className="px-4 py-2 rounded-xl border border-edge hover:bg-panel text-body text-xs font-semibold transition-colors min-h-[40px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending || explanation.trim().length < 10}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors disabled:opacity-50 min-h-[40px] cursor-pointer"
                  >
                    {isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Flag className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                    <span>Submit Report</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default ReportButton;
