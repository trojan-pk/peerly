"use client";

import { safeAction } from "@/lib/client-action";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
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
import {
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
  initialTab?: "incoming" | "outgoing";
  incomingPage?: number;
  outgoingPage?: number;
}

export default function DashboardView({
  incoming,
  outgoing,
  initialTab = "incoming",
  incomingPage = 1,
  outgoingPage = 1,
}: DashboardViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"incoming" | "outgoing">(initialTab);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // State for in-progress review form: key is requestId
  const [reviewRatings, setReviewRatings] = useState<Record<string, number>>({});
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const handleTabChange = (newTab: "incoming" | "outgoing") => {
    setActiveTab(newTab);
    setActionError(null);
    setActionSuccess(null);
    router.push(`/dashboard?tab=${newTab}&incomingPage=${incomingPage}&outgoingPage=${outgoingPage}`);
  };

  const handleTransitionAction = (requestId: string, action: "accept" | "reject" | "cancel") => {
    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      const res: RequestActionResult = await safeAction(() => transitionStudyRequest({
        requestId,
        action,
      }));

      if (!res.success) {
        setActionError(res.message || "Failed to update request status.");
      } else {
        setActionSuccess(res.message || "Request updated successfully.");
      }
    });
  };

  const handleConfirmCompletion = (requestId: string) => {
    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      const res: RequestActionResult = await safeAction(() => confirmStudyRequestCompletion({
        requestId,
      }));

      if (!res.success) {
        setActionError(res.message || "Failed to confirm session completion.");
      } else {
        setActionSuccess(res.message || "Completion confirmed successfully.");
      }
    });
  };

  const handleSubmitReview = (requestId: string) => {
    setActionError(null);
    setActionSuccess(null);

    const rating = reviewRatings[requestId];
    const comment = reviewComments[requestId] || "";

    if (!rating || rating < 1 || rating > 5) {
      setActionError("Please select a rating from 1 to 5 stars before submitting.");
      return;
    }

    startTransition(async () => {
      const res: RequestActionResult = await safeAction(() => submitStudyRequestReview({
        requestId,
        rating,
        comment,
      }));

      if (!res.success) {
        setActionError(res.message || "Failed to submit review.");
      } else {
        setActionSuccess(res.message || "Thank you! Your review has been submitted.");
        setReviewingId(null);
      }
    });
  };

  const currentList = activeTab === "incoming" ? incoming : outgoing;

  return (
    <div className="space-y-6">
      {/* Global Action Notifications */}
      {actionSuccess && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-accent/25 bg-accent/10 p-4 flex items-center justify-between text-xs text-accent shadow-xs"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-accent hover:text-accent text-xs font-semibold focus-visible:outline-none"
          >
            Dismiss
          </button>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-xl border border-danger/25 bg-danger/10 p-4 flex items-center justify-between text-xs text-danger shadow-xs"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-danger shrink-0" aria-hidden="true" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-danger hover:text-danger text-xs font-semibold focus-visible:outline-none"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-line" role="tablist" aria-label="Dashboard views">
        <button
          type="button"
          role="tab"
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

      {/* Request Cards List */}
      {currentList.items.length > 0 ? (
        <div className="space-y-4">
          {currentList.items.map((req) => {
            const isPeer = activeTab === "incoming";
            const participant = isPeer ? req.learner : req.peer;

            return (
              <article
                key={req.id}
                className="rounded-2xl border border-line/90 bg-surface p-5 sm:p-6 space-y-4 shadow-xs"
              >
                {/* Header: Participant & Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
                  <div className="flex items-center gap-3">
                    {participant.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={participant.image}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover border border-line"
                        aria-hidden="true"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-accent/15 text-accent flex items-center justify-center font-bold text-sm">
                        {participant.name[0]?.toUpperCase() || "S"}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-ink">
                          {participant.name}
                        </span>
                        <span className="text-[11px] text-faint">
                          {isPeer ? "(Learner)" : "(Peer Helper)"}
                        </span>
                      </div>
                      <p className="text-xs text-muted">
                        {participant.university || "University Student"}
                      </p>
                    </div>
                  </div>

                  {/* Status & Mode badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-raised text-body capitalize">
                      {req.mode === "online" ? "Online" : "Campus in-person"}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
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
                      {req.status}
                    </span>
                  </div>
                </div>

                {/* Body: Topic & Problem Description */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted">Topic:</span>
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-accent/10 text-accent">
                      {req.topic}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-muted">Problem Description:</span>
                    <p className="text-xs text-body leading-relaxed whitespace-pre-line bg-panel/70 p-3 rounded-xl border border-line">
                      {req.problemDescription}
                    </p>
                  </div>
                </div>

                {/* Unlocked Contact Box: preserved for ACCEPTED, COMPLETED, and REVIEWED for learner */}
                {!isPeer &&
                  (req.status === "ACCEPTED" ||
                    req.status === "COMPLETED" ||
                    req.status === "REVIEWED") &&
                  req.unlockedContact && (
                    <div className="rounded-xl border border-accent/25 bg-accent/10 p-4 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-accent">
                        <CheckCircle2 className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
                        <span>Peer Helper Contact Details</span>
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
                          Rate &amp; Review Your Study Session
                        </h3>
                        <p className="text-[11px] text-muted">
                          Share your honest feedback. Ratings directly update peer helper aggregates.
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
                        onClick={() => handleConfirmCompletion(req.id)}
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
                        onClick={() => handleConfirmCompletion(req.id)}
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
          })}

          {/* Pagination Controls */}
          {currentList.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-4">
              {currentList.page > 1 ? (
                <Link
                  href={`/dashboard?tab=${activeTab}&incomingPage=${
                    activeTab === "incoming" ? currentList.page - 1 : incomingPage
                  }&outgoingPage=${activeTab === "outgoing" ? currentList.page - 1 : outgoingPage}`}
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
                  }&outgoingPage=${activeTab === "outgoing" ? currentList.page + 1 : outgoingPage}`}
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
              {activeTab === "incoming"
                ? "No incoming study requests yet"
                : "You haven't sent any study requests yet"}
            </h2>
            <p className="text-xs text-muted leading-relaxed">
              {activeTab === "incoming"
                ? "When classmates and peers need assistance with your listed subjects, their requests will appear here."
                : "Browse the peer directory to find students offering coursework help in your courses."}
            </p>
          </div>
          {activeTab === "outgoing" && (
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
