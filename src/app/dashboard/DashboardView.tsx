"use client";

import { safeAction } from "@/lib/client-action";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { InitialsAvatar } from "@/components/InitialsAvatar";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  Inbox,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  MessageSquare,
  Video,
  Mail,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Star,
} from "lucide-react";
import { StudyRequestDTO } from "@/lib/study-requests";
import { Countdown } from "@/components/Countdown";
import { Badge } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import type { RequestStatus } from "@/models/StudyRequest";

type OptimisticPatch = { id: string; changes: Partial<Pick<StudyRequestDTO, "status" | "respondedAt" | "learnerConfirmedAt" | "peerConfirmedAt" | "review">> };
import {
  archiveStudyRequest,
  transitionStudyRequest,
  confirmStudyRequestCompletion,
  submitStudyRequestReview,
  RequestActionResult,
} from "./actions";

interface DashboardViewProps {
  incoming: {
    items: StudyRequestDTO[];
    total: number;
    page: number;
    totalPages: number;
  };
  outgoing: {
    items: StudyRequestDTO[];
    total: number;
    page: number;
    totalPages: number;
  };
  statusFilter?: string;
  archivedView?: boolean;
  initialTab?: "incoming" | "outgoing";
  incomingPage?: number;
  outgoingPage?: number;
}

export default function DashboardView({
  incoming,
  outgoing,
  statusFilter = "all",
  archivedView = false,
  initialTab = "incoming",
  incomingPage = 1,
  outgoingPage = 1,
}: DashboardViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"incoming" | "outgoing">(initialTab);
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  // State for in-progress review form: key is requestId
  const [reviewRatings, setReviewRatings] = useState<Record<string, number>>({});
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  /** Request currently being written by an action; disables only that card's controls. */
  const [busyId, setBusyId] = useState<string | null>(null);

  const baseItems = activeTab === "incoming" ? incoming.items : outgoing.items;
  // Optimistic view: the card changes as soon as the user acts. If the server rejects
  // the change, the transition ends without new props and the card reverts.
  const [visibleItems, applyOptimistic] = useOptimistic(baseItems, (items: StudyRequestDTO[], patch: OptimisticPatch) =>
    items.map((item) => (item.id === patch.id ? { ...item, ...patch.changes } : item))
  );

  function report(result: RequestActionResult, fallbackError: string, fallbackSuccess: string) {
    if (result.success) toast.show({ tone: "success", title: result.message || fallbackSuccess });
    else toast.show({ tone: "error", title: result.message || fallbackError });
  }

  const handleTabChange = (newTab: "incoming" | "outgoing") => {
    setActiveTab(newTab);
    startTransition(() => router.push(`/dashboard?tab=${newTab}&incomingPage=${incomingPage}&outgoingPage=${outgoingPage}&status=${statusFilter}${archivedView ? "&view=archived" : ""}`));
  };

  const handleTransitionAction = (requestId: string, action: "accept" | "reject" | "cancel") => {
    const nextStatus: RequestStatus = action === "accept" ? "ACCEPTED" : action === "reject" ? "REJECTED" : "CANCELLED";
    setBusyId(requestId);
    startTransition(async () => {
      applyOptimistic({ id: requestId, changes: { status: nextStatus, ...(action !== "cancel" ? { respondedAt: new Date().toISOString() } : {}) } });
      const res: RequestActionResult = await safeAction(() => transitionStudyRequest({ requestId, action }));
      report(res, "Failed to update request status.", "Request updated.");
      setBusyId(null);
    });
  };

  const handleConfirmCompletion = (req: StudyRequestDTO, asPeer: boolean) => {
    const now = new Date().toISOString();
    const otherConfirmed = asPeer ? Boolean(req.learnerConfirmedAt) : Boolean(req.peerConfirmedAt);
    setBusyId(req.id);
    startTransition(async () => {
      applyOptimistic({ id: req.id, changes: { ...(asPeer ? { peerConfirmedAt: now } : { learnerConfirmedAt: now }), ...(otherConfirmed ? { status: "COMPLETED" as const } : {}) } });
      const res: RequestActionResult = await safeAction(() => confirmStudyRequestCompletion({ requestId: req.id }));
      report(res, "Failed to confirm session completion.", "Completion confirmed.");
      setBusyId(null);
    });
  };

  const handleSubmitReview = (requestId: string) => {
    const rating = reviewRatings[requestId];
    const comment = reviewComments[requestId] || "";

    if (!rating || rating < 1 || rating > 5) {
      toast.show({ tone: "error", title: "Please select a rating from 1 to 5 stars before submitting." });
      return;
    }

    setBusyId(requestId);
    startTransition(async () => {
      applyOptimistic({ id: requestId, changes: { status: "REVIEWED", review: { rating, comment: comment.trim(), createdAt: new Date().toISOString() } } });
      const res: RequestActionResult = await safeAction(() => submitStudyRequestReview({ requestId, rating, comment }));
      report(res, "Failed to submit review.", "Thank you! Your review has been published.");
      if (res.success) setReviewingId(null);
      setBusyId(null);
    });
  };

  /** A/R on a focused pending card accepts/declines it. Ignored while typing or with modifiers. */
  function onCardKeyDown(event: React.KeyboardEvent<HTMLElement>, req: StudyRequestDTO, isPeer: boolean) {
    if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey) return;
    if (!isPeer || req.status !== "PENDING" || isPending) return;
    const key = event.key.toLowerCase();
    if (key === "a") { event.preventDefault(); handleTransitionAction(req.id, "accept"); }
    else if (key === "r") { event.preventDefault(); handleTransitionAction(req.id, "reject"); }
  }

  const currentList = activeTab === "incoming" ? incoming : outgoing;
  const showSections = !archivedView && statusFilter === "all";
  const grouped = showSections ? [
    { key: "respond", title: activeTab === "incoming" ? "Needs your response" : "Waiting for a reply", items: visibleItems.filter((r) => r.status === "PENDING") },
    { key: "active", title: "Active sessions", items: visibleItems.filter((r) => r.status === "ACCEPTED" || r.status === "COMPLETED") },
    { key: "history", title: "History", items: visibleItems.filter((r) => !["PENDING", "ACCEPTED", "COMPLETED"].includes(r.status)) },
  ] : null;
  const filterSuffix = `&status=${statusFilter}${archivedView ? "&view=archived" : ""}`;
  function changeFilter(key: string, value: string) {
    const params = new URLSearchParams({ tab: activeTab, status: statusFilter });
    if (archivedView) params.set("view", "archived");
    if (value) params.set(key, value); else params.delete(key);
    startTransition(() => router.push(`/dashboard?${params.toString()}`));
  }
  function handleArchive(requestId: string) {
    setBusyId(requestId);
    startTransition(async () => {
      const result = await safeAction(() => archiveStudyRequest({ requestId, archive: !archivedView }));
      report(result, "History could not be updated.", "History updated.");
      setBusyId(null);
    });
  }

  function renderCard(req: StudyRequestDTO) {
    const isPeer = activeTab === "incoming";
    const participant = isPeer ? req.learner : req.peer;

    return (
      <article
        key={req.id}
        id={`request-${req.id}`}
        data-status={req.status}
        data-urgency={req.urgency}
        tabIndex={0}
        aria-labelledby={`request-${req.id}-title`}
        aria-keyshortcuts={isPeer && req.status === "PENDING" ? "A R" : undefined}
        aria-busy={busyId === req.id || undefined}
        onKeyDown={(event) => onCardKeyDown(event, req, isPeer)}
        className="request-card rounded-2xl border border-line/90 bg-surface p-5 sm:p-6 space-y-4 shadow-xs"
      >
        {/* Header: Participant & Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
          <div className="flex items-center gap-3">
            <InitialsAvatar name={participant.name} className="w-10 h-10 rounded-full text-sm" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-ink">
                  {participant.name}
                </span>
                <span className="text-[11px] text-faint">
                  {isPeer ? "Asking for help" : "Helping you"}
                </span>
              </div>
              <p className="text-xs text-muted">
                {participant.university || "University Student"}
              </p>
            </div>
          </div>

          {/* Status & Mode badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {req.status === "PENDING" && req.urgency === "urgent" && <Badge tone="danger" icon={<AlertCircle aria-hidden="true" />}>Urgent</Badge>}
            {req.status === "PENDING" && req.expiresAt && <Countdown until={req.expiresAt} label={isPeer ? "left to respond" : "until this request expires"} />}
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-raised text-body capitalize">
              {req.mode === "online" ? "Online" : "Campus in-person"}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                req.status === "PENDING"
                  ? "bg-warning/15 text-warning border border-warning/25"
                  : req.status === "ACCEPTED"
                  ? "bg-accent/15 text-accent border border-accent/25"
                  : req.status === "COMPLETED"
                  ? "bg-info/15 text-info border border-info/25"
                  : req.status === "REVIEWED"
                  ? "bg-accent/10 text-accent border border-accent/25"
                  : "bg-raised text-body"
              }`}
            >
              {({ PENDING: "Pending", ACCEPTED: "Accepted", REJECTED: "Declined", CANCELLED: "Cancelled", COMPLETED: "Completed", REVIEWED: "Reviewed", EXPIRED: "Expired" })[req.status]}
            </span>
          </div>
        </div>

        <div className="request-body">{req.courseCode && <ul className="course-chips mb-2" aria-label="Course"><li className="tabular">{req.courseCode}</li></ul>}<h3 id={`request-${req.id}-title`}>{req.topic}</h3>{req.neededBy && req.status === "PENDING" && <p className="request-deadline">Needed by <time dateTime={req.neededBy}>{new Date(req.neededBy).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit", month: "short", day: "numeric" })}</time></p>}<p className="request-description">{req.problemDescription}</p>{req.respondedAt && <span className="workspace-caption">{req.status === "REJECTED" ? "Declined" : "Accepted"} on {new Date(req.respondedAt).toLocaleDateString()}</span>}</div>

        {req.status === "EXPIRED" && (
          <div className="request-expired" role="note">
            <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
            <p>{isPeer ? "This request expired before you responded. It no longer counts toward your response time." : `${participant.name} didn't respond in time. Your request was closed so you can ask someone else.`}</p>
            {!isPeer && <Link className="ui-button is-primary is-sm" href={`/peers?topic=${encodeURIComponent(req.topic)}`}>Try another helper</Link>}
          </div>
        )}

        {/* Unlocked Contact Box: preserved for ACCEPTED, COMPLETED, and REVIEWED for learner */}
        {!isPeer &&
          (req.status === "ACCEPTED" ||
            req.status === "COMPLETED" ||
            req.status === "REVIEWED") &&
          req.unlockedContact && (
            <div className="rounded-xl border border-accent/25 bg-accent/10 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-accent">
                <CheckCircle2 className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
                <span>Your helper’s contact</span>
              </div>

              {req.unlockedContact.unavailable ? (
                <p className="text-xs text-muted">
                  {req.unlockedContact.message || "No contact methods are currently configured."}
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {req.unlockedContact.whatsappUrl && (
                    <a
                      href={req.unlockedContact.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-action hover:bg-action-hover text-white text-xs font-semibold transition-colors shadow-xs"
                    >
                      <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>WhatsApp ({req.unlockedContact.whatsapp})</span>
                      <ExternalLink className="w-3 h-3 opacity-80" aria-hidden="true" />
                    </a>
                  )}

                  {req.unlockedContact.meetingLink && (
                    <a
                      href={req.unlockedContact.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface border border-edge hover:bg-panel text-ink text-xs font-semibold transition-colors shadow-xs"
                    >
                      <Video className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
                      <span>Open Meeting Room</span>
                      <ExternalLink className="w-3 h-3 opacity-80" aria-hidden="true" />
                    </a>
                  )}

                  {req.unlockedContact.email && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-raised text-ink text-xs font-medium">
                      <Mail className="w-3.5 h-3.5 text-muted" aria-hidden="true" />
                      <span>{req.unlockedContact.email}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        {/* Completion Confirmation Notice (when ACCEPTED) */}
        {req.status === "ACCEPTED" && (
          <div className="rounded-xl border border-line bg-panel/70 p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-semibold text-ink">
                Session Completion Status
              </span>
              <p className="text-[11px] text-muted">
                Completion is confirmed by both participants once the study session has taken place.
              </p>
            </div>

            <div className="text-xs space-y-1">
              {isPeer ? (
                req.peerConfirmedAt ? (
                  <div className="flex items-center gap-2 text-warning bg-warning/10 p-2 rounded-lg border border-warning/25">
                    <Clock className="w-3.5 h-3.5 text-warning shrink-0" aria-hidden="true" />
                    <span>
                      You confirmed completion on{" "}
                      {new Date(req.peerConfirmedAt).toLocaleDateString()}. Waiting for the student learner to confirm.
                    </span>
                  </div>
                ) : req.learnerConfirmedAt ? (
                  <div className="flex items-center gap-2 text-accent bg-accent/10 p-2 rounded-lg border border-accent/25">
                    <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" aria-hidden="true" />
                    <span>
                      The learner confirmed session completion. Please confirm below to complete the session.
                    </span>
                  </div>
                ) : (
                  <p className="text-muted">
                    Neither participant has confirmed completion yet.
                  </p>
                )
              ) : req.learnerConfirmedAt ? (
                <div className="flex items-center gap-2 text-warning bg-warning/10 p-2 rounded-lg border border-warning/25">
                  <Clock className="w-3.5 h-3.5 text-warning shrink-0" aria-hidden="true" />
                  <span>
                    You confirmed completion on{" "}
                    {new Date(req.learnerConfirmedAt).toLocaleDateString()}. Waiting for the peer helper to confirm.
                  </span>
                </div>
              ) : req.peerConfirmedAt ? (
                <div className="flex items-center gap-2 text-accent bg-accent/10 p-2 rounded-lg border border-accent/25">
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" aria-hidden="true" />
                  <span>
                    Your peer helper confirmed session completion. Please confirm below to mark complete.
                  </span>
                </div>
              ) : (
                <p className="text-muted">
                  Neither participant has confirmed completion yet.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Session Completed Notice */}
        {req.status === "COMPLETED" && (
          <div className="rounded-xl border border-info/25 bg-info/10 p-3.5 space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-info">
              <CheckCircle2 className="w-4 h-4 text-info shrink-0" aria-hidden="true" />
              <span>Session Completed — Confirmed by Both Participants</span>
            </div>
            <p className="text-xs text-info leading-relaxed">
              Both learner and peer helper have confirmed that this study session concluded.
            </p>
          </div>
        )}

        {/* Learner Review Form for COMPLETED requests */}
        {!isPeer && req.status === "COMPLETED" && (
          <div className="rounded-xl border border-line bg-surface p-4 space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-line pb-2">
              <div>
                <h3 className="text-xs font-bold text-ink">
                  How was your session?
                </h3>
                <p className="text-[11px] text-muted">
                  Help other students understand what the session was like.
                </p>
              </div>
              {reviewingId !== req.id && (
                <button
                  type="button"
                  onClick={() => setReviewingId(req.id)}
                  className="px-3 py-1.5 rounded-lg bg-action hover:bg-action-hover text-white text-xs font-semibold transition-colors"
                >
                  Write Review
                </button>
              )}
            </div>

            {reviewingId === req.id && (
              <div className="space-y-3 pt-2">
                {/* Rating Stars */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-body">
                    Rating (1 to 5 stars)
                  </label>
                  <div className="flex items-center gap-2" role="group" aria-label="Rating selection">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const currentRating = reviewRatings[req.id] || 0;
                      return (
                        <button
                          key={star}
                          type="button"
                          onClick={() =>
                            setReviewRatings((prev) => ({ ...prev, [req.id]: star }))
                          }
                          className="p-1 text-faint hover:text-warning transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
                          aria-label={`${star} star${star > 1 ? "s" : ""}`}
                        >
                          <Star
                            className={`w-6 h-6 ${
                              star <= currentRating
                                ? "text-warning fill-amber-500"
                                : "text-faint"
                            }`}
                            aria-hidden="true"
                          />
                        </button>
                      );
                    })}
                    <span className="text-xs font-bold text-body ml-2">
                      {reviewRatings[req.id] ? `${reviewRatings[req.id]} / 5 stars` : "Select stars"}
                    </span>
                  </div>
                </div>

                {/* Comment Textarea */}
                <div className="space-y-1">
                  <label
                    htmlFor={`review-comment-${req.id}`}
                    className="block text-xs font-semibold text-body"
                  >
                    Feedback Comment (optional)
                  </label>
                  <textarea
                    id={`review-comment-${req.id}`}
                    rows={3}
                    maxLength={1000}
                    value={reviewComments[req.id] || ""}
                    onChange={(e) =>
                      setReviewComments((prev) => ({ ...prev, [req.id]: e.target.value }))
                    }
                    placeholder="What went well? How helpful was your peer helper?"
                    className="w-full text-xs rounded-xl border border-line p-3 text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <div className="text-right text-[10px] text-faint">
                    {(reviewComments[req.id] || "").length} / 1000 characters
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setReviewingId(null)}
                    className="px-3 py-1.5 rounded-lg border border-edge hover:bg-panel text-body text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isPending || !reviewRatings[req.id]}
                    onClick={() => handleSubmitReview(req.id)}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-action hover:bg-action-hover text-white text-xs font-semibold transition-colors disabled:opacity-50 min-h-[36px]"
                  >
                    {isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Star className="w-3.5 h-3.5 fill-white" aria-hidden="true" />
                    )}
                    <span>Submit Review</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Display Review for REVIEWED requests */}
        {req.status === "REVIEWED" && req.review && (
          <div className="rounded-xl border border-line bg-panel/80 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${
                      star <= req.review!.rating
                        ? "text-warning fill-amber-500"
                        : "text-faint"
                    }`}
                    aria-hidden="true"
                  />
                ))}
                <span className="text-xs font-bold text-ink ml-1.5">
                  {req.review.rating} / 5 Stars
                </span>
              </div>
              <span className="text-[11px] text-faint">
                {new Date(req.review.createdAt).toLocaleDateString()}
              </span>
            </div>
            {req.review.comment ? (
              <p className="text-xs text-body leading-relaxed italic">
                &ldquo;{req.review.comment}&rdquo;
              </p>
            ) : (
              <p className="text-xs text-faint italic">No written comment provided.</p>
            )}
          </div>
        )}

        {/* Footer: Date and Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs text-muted border-t border-line">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-faint" aria-hidden="true" />
            <span>Requested on {new Date(req.createdAt).toLocaleDateString()}</span>
          </div>

          {/* Permitted Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {["REJECTED","CANCELLED","COMPLETED","REVIEWED","EXPIRED"].includes(req.status) && <button type="button" disabled={isPending} onClick={() => handleArchive(req.id)} className="workspace-text-button">{archivedView ? <ArchiveRestore size={16} /> : <Archive size={16} />}{archivedView ? "Restore request" : "Archive request"}</button>}
            {/* Incoming Actions: Peer accepts or declines PENDING request */}
            {isPeer && req.status === "PENDING" && (
              <>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleTransitionAction(req.id, "accept")}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-action hover:bg-action-hover text-white font-semibold transition-colors disabled:opacity-50 min-h-[36px]"
                >
                  {isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>Accept Request</span>
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleTransitionAction(req.id, "reject")}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-edge hover:bg-panel text-body font-semibold transition-colors disabled:opacity-50 min-h-[36px]"
                >
                  <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Decline</span>
                </button>
              </>
            )}

            {/* Outgoing Action: Learner cancels PENDING request */}
            {!isPeer && req.status === "PENDING" && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleTransitionAction(req.id, "cancel")}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-edge hover:bg-panel text-body font-semibold transition-colors disabled:opacity-50 min-h-[36px]"
              >
                {isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>Cancel Request</span>
              </button>
            )}

            {/* Incoming Completion Confirmation: Peer confirms ACCEPTED request */}
            {isPeer && req.status === "ACCEPTED" && !req.peerConfirmedAt && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleConfirmCompletion(req, isPeer)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-action hover:bg-action-hover text-white font-semibold transition-colors disabled:opacity-50 min-h-[36px]"
              >
                {isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>Confirm Session Completed</span>
              </button>
            )}

            {/* Outgoing Completion Confirmation: Learner confirms ACCEPTED request */}
            {!isPeer && req.status === "ACCEPTED" && !req.learnerConfirmedAt && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleConfirmCompletion(req, isPeer)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-action hover:bg-action-hover text-white font-semibold transition-colors disabled:opacity-50 min-h-[36px]"
              >
                {isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>Confirm Session Completed</span>
              </button>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex border-b border-line" role="tablist" aria-label="Dashboard views">
        <button
          type="button"
          role="tab"
          disabled={isPending}
          aria-selected={activeTab === "incoming"}
          onClick={() => handleTabChange("incoming")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            activeTab === "incoming"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Inbox className="w-4 h-4" aria-hidden="true" />
          <span>Received Requests</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === "incoming"
                ? "bg-accent/15 text-accent"
                : "bg-raised text-muted"
            }`}
          >
            {incoming.total}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          disabled={isPending}
          aria-selected={activeTab === "outgoing"}
          onClick={() => handleTabChange("outgoing")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            activeTab === "outgoing"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Send className="w-4 h-4" aria-hidden="true" />
          <span>Sent Requests</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === "outgoing"
                ? "bg-accent/15 text-accent"
                : "bg-raised text-muted"
            }`}
          >
            {outgoing.total}
          </span>
        </button>
      </div>

      <div className="request-filter-bar" aria-busy={isPending}><label htmlFor="request-status">Request status<select id="request-status" disabled={isPending} value={statusFilter} onChange={event => changeFilter("status", event.target.value)}><option value="all">All statuses</option>{[["PENDING","Pending"],["ACCEPTED","Accepted"],["REJECTED","Declined"],["CANCELLED","Cancelled"],["COMPLETED","Completed"],["REVIEWED","Reviewed"],["EXPIRED","Expired"]].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><div className="history-toggle" aria-label="Request history view"><button type="button" disabled={isPending} aria-pressed={!archivedView} onClick={() => changeFilter("view", "")}>Current</button><button type="button" disabled={isPending} aria-pressed={archivedView} onClick={() => changeFilter("view", "archived")}><Archive size={15} />Archived</button></div></div>
      {archivedView && <p className="text-sm text-muted">Archived requests are hidden from your current list. You can restore them at any time.</p>}
      {/* Request Cards List */}
      {visibleItems.length > 0 ? (
        <div className="space-y-4">
          {grouped ? (
            grouped.map((group) => group.items.length > 0 && (
              <section key={group.key} aria-labelledby={`section-${group.key}`} className="request-section">
                <h2 id={`section-${group.key}`} className="request-section-title">{group.title}<span className="tabular">{group.items.length}</span></h2>
                <div className="space-y-4">{group.items.map(renderCard)}</div>
              </section>
            ))
          ) : (
            visibleItems.map(renderCard)
          )}

          {/* Pagination Controls */}
          {currentList.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-4">
              {currentList.page > 1 ? (
                <Link
                  href={`/dashboard?tab=${activeTab}&incomingPage=${
                    activeTab === "incoming" ? currentList.page - 1 : incomingPage
                  }&outgoingPage=${activeTab === "outgoing" ? currentList.page - 1 : outgoingPage}${filterSuffix}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-edge bg-surface text-xs font-semibold text-body hover:bg-panel transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  Previous
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-line bg-panel text-xs font-semibold text-faint cursor-not-allowed">
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  Previous
                </span>
              )}

              <span className="text-xs text-muted">
                Page {currentList.page} of {currentList.totalPages}
              </span>

              {currentList.page < currentList.totalPages ? (
                <Link
                  href={`/dashboard?tab=${activeTab}&incomingPage=${
                    activeTab === "incoming" ? currentList.page + 1 : incomingPage
                  }&outgoingPage=${activeTab === "outgoing" ? currentList.page + 1 : outgoingPage}${filterSuffix}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-edge bg-surface text-xs font-semibold text-body hover:bg-panel transition-colors"
                >
                  Next
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-line bg-panel text-xs font-semibold text-faint cursor-not-allowed">
                  Next
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </span>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Empty State */
        <div className="rounded-2xl border border-line/80 bg-surface p-8 sm:p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-raised text-muted flex items-center justify-center mx-auto">
            {activeTab === "incoming" ? (
              <Inbox className="w-6 h-6" aria-hidden="true" />
            ) : (
              <Send className="w-6 h-6" aria-hidden="true" />
            )}
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h2 className="text-base font-semibold text-ink">
              {archivedView ? "No archived requests" : statusFilter !== "all" ? "No requests with this status" : activeTab === "incoming"
                ? "No incoming study requests yet"
                : "You haven't sent any study requests yet"}
            </h2>
            <p className="text-xs text-muted leading-relaxed">
              {archivedView || statusFilter !== "all" ? "Choose another status or return to your current requests." : activeTab === "incoming"
                ? "When classmates and peers need assistance with your listed subjects, their requests will appear here."
                : "Browse the peer directory to find students offering coursework help in your courses."}
            </p>
          </div>
          {activeTab === "outgoing" && !archivedView && statusFilter === "all" && (
            <div className="pt-2">
              <Link
                href="/peers"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-action hover:bg-action-hover text-white text-xs font-semibold transition-colors min-h-[44px]"
              >
                Browse Peer Helpers
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
