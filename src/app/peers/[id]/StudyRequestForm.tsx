"use client";

import { safeAction } from "@/lib/client-action";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createStudyRequest, RequestActionResult } from "@/app/dashboard/actions";
import { Send, CheckCircle2, AlertCircle, Loader2, ArrowRight, UserCheck, Lock } from "lucide-react";
import type { RequestMode, RequestUrgency } from "@/models/StudyRequest";
import { MAX_NEEDED_BY_MS, MIN_NEEDED_BY_LEAD_MS } from "@/lib/request-rules";

/** Formats a Date as a value for <input type="datetime-local"> in local time. */
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface StudyRequestFormProps {
  peerId: string;
  peerName: string;
  peerTopics: string[];
  peerMode: "online" | "campus" | "both";
  isCurrentUser: boolean;
  isAuthenticated: boolean;
}

export default function StudyRequestForm({
  peerId,
  peerName,
  peerTopics,
  peerMode,
  isCurrentUser,
  isAuthenticated,
}: StudyRequestFormProps) {
  const initialMode: RequestMode = peerMode === "campus" ? "campus" : "online";

  const [topic, setTopic] = useState<string>(peerTopics[0] || "");
  const [mode, setMode] = useState<RequestMode>(initialMode);
  const [problemDescription, setProblemDescription] = useState<string>("");
  const [urgency, setUrgency] = useState<RequestUrgency>("normal");
  const [neededBy, setNeededBy] = useState<string>("");
  const [bounds, setBounds] = useState<{ min: string; max: string } | null>(null);
  const [result, setResult] = useState<RequestActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  // Case 1: Unauthenticated visitor
  if (!isAuthenticated) {
    return (
      <div className="rounded-2xl border border-line/90 bg-panel/70 p-6 sm:p-7 space-y-3 text-center">
        <div className="w-10 h-10 rounded-xl bg-accent/15 text-accent flex items-center justify-center mx-auto">
          <Lock className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="max-w-md mx-auto space-y-1">
          <h2 className="text-base font-bold text-ink">
            Sign In to Request Help
          </h2>
          <p className="text-xs text-muted leading-relaxed">
            Please sign in with your Google account to send a study session request to {peerName}.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-action hover:bg-action-hover text-white text-xs font-semibold transition-colors min-h-[44px] shadow-xs"
          >
            Sign In with Google
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    );
  }

  // Case 2: Viewing own profile
  if (isCurrentUser) {
    return (
      <div className="rounded-2xl border border-line/90 bg-panel/70 p-5 flex items-center gap-3 text-xs text-body">
        <UserCheck className="w-5 h-5 text-accent shrink-0" aria-hidden="true" />
        <div>
          <span className="font-semibold block text-ink">This is your public peer profile</span>
          <span>You cannot send study session requests to yourself.</span>
        </div>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResult(null);

    startTransition(async () => {
      // datetime-local is local wall time; send an unambiguous UTC instant.
      const deadline = neededBy ? new Date(neededBy) : null;
      const res = await safeAction(() => createStudyRequest({
        peerId,
        topic,
        problemDescription,
        mode,
        urgency,
        neededBy: deadline && !Number.isNaN(deadline.getTime()) ? deadline.toISOString() : null,
      }));

      setResult(res);
      if (res.success) {
        setProblemDescription("");
        setNeededBy("");
        setUrgency("normal");
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-line/90 bg-surface p-6 sm:p-7 space-y-6 shadow-xs"
      noValidate
    >
      <div className="space-y-1 border-b border-line pb-4">
        <h2 className="text-base font-bold text-ink">
          Request Study Assistance
        </h2>
        <p className="text-xs text-muted">
          Send a coursework problem or concept question directly to {peerName}.
        </p>
      </div>

      {/* Notifications */}
      {result && result.success && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-accent/25 bg-accent/10 p-4 space-y-2 text-xs text-accent"
        >
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-accent" aria-hidden="true" />
            <span>{result.message}</span>
          </div>
          <p className="text-accent">
            Once {peerName} accepts your request, their private contact details will unlock automatically in your dashboard.
          </p>
          <div className="pt-1">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-action-hover text-white font-medium hover:bg-action-hover transition-colors"
            >
              Go to Dashboard
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      )}

      {result && !result.success && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-xl border border-danger/25 bg-danger/10 p-4 space-y-1 text-xs text-danger"
        >
          <div className="flex items-center gap-2 font-semibold text-danger">
            <AlertCircle className="w-4 h-4 text-danger shrink-0" aria-hidden="true" />
            <span>{result.message}</span>
          </div>
          {result.errors && (
            <ul className="list-disc list-inside space-y-0.5 text-danger pt-1">
              {Object.entries(result.errors).map(([field, err]) => (
                <li key={field}>
                  <span className="font-medium capitalize">{field}</span>: {err}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Topic selection / input */}
      <div className="space-y-1.5">
        <label htmlFor="request-topic" className="block text-xs font-semibold text-ink">
          Study Topic <span className="text-accent">*</span>
        </label>
        <input
          type="text"
          id="request-topic"
          name="topic"
          required
          maxLength={100}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. Linear Algebra, Dynamic Programming, Organic Chemistry"
          className="w-full px-3.5 py-2.5 rounded-xl border border-edge text-sm text-ink bg-panel/50 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
        />
        {peerTopics.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] text-faint">Quick select:</span>
            {peerTopics.map((pt) => (
              <button
                type="button"
                key={pt}
                onClick={() => setTopic(pt)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  topic === pt
                    ? "bg-action text-white"
                    : "bg-raised text-body hover:bg-edge"
                }`}
              >
                {pt}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mode Selection */}
      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-ink">
          Preferred Session Mode <span className="text-accent">*</span>
        </legend>
        <div className="flex flex-wrap gap-4">
          {(peerMode === "online" || peerMode === "both") && (
            <label className="flex items-center gap-2 cursor-pointer text-xs text-ink">
              <input
                type="radio"
                name="mode"
                value="online"
                checked={mode === "online"}
                onChange={() => setMode("online")}
                className="text-accent focus:ring-accent"
              />
              <span>Online (Video / Call)</span>
            </label>
          )}

          {(peerMode === "campus" || peerMode === "both") && (
            <label className="flex items-center gap-2 cursor-pointer text-xs text-ink">
              <input
                type="radio"
                name="mode"
                value="campus"
                checked={mode === "campus"}
                onChange={() => setMode("campus")}
                className="text-accent focus:ring-accent"
              />
              <span>In-person on Campus</span>
            </label>
          )}
        </div>
      </fieldset>

      {/* Urgency and optional deadline */}
      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-ink">How soon do you need help?</legend>
        <div className="urgency-options">
          <label className={urgency === "normal" ? "is-selected" : ""}>
            <input type="radio" name="urgency" value="normal" checked={urgency === "normal"} onChange={() => setUrgency("normal")} />
            <span><strong>Normal</strong><small>{peerName.split(" ")[0]} has up to 3 days to respond.</small></span>
          </label>
          <label className={urgency === "urgent" ? "is-selected is-urgent" : ""}>
            <input type="radio" name="urgency" value="urgent" checked={urgency === "urgent"} onChange={() => setUrgency("urgent")} />
            <span><strong>Urgent</strong><small>Shown first. Closes after 6 hours if there&apos;s no response.</small></span>
          </label>
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <label htmlFor="request-needed-by" className="block text-xs font-semibold text-ink">
          Needed by <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          type="datetime-local"
          id="request-needed-by"
          name="neededBy"
          value={neededBy}
          min={bounds?.min}
          max={bounds?.max}
          onFocus={() => { const now = Date.now(); setBounds({ min: toLocalInput(new Date(now + MIN_NEEDED_BY_LEAD_MS)), max: toLocalInput(new Date(now + MAX_NEEDED_BY_MS)) }); }}
          onChange={(e) => setNeededBy(e.target.value)}
          aria-describedby="request-needed-by-hint"
          className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl border border-edge text-sm text-ink bg-panel/50 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
        />
        <p id="request-needed-by-hint" className="text-[11px] text-muted">Your deadline, e.g. when the assignment is due. The request closes at this time if nobody has responded.</p>
      </div>

      {/* Problem Description */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="problemDescription" className="block text-xs font-semibold text-ink">
            Problem or Question Description <span className="text-accent">*</span>
          </label>
          <span className="text-[11px] text-faint">
            {problemDescription.length} / 2000 chars (min 10)
          </span>
        </div>
        <textarea
          id="problemDescription"
          name="problemDescription"
          required
          rows={3}
          minLength={10}
          maxLength={2000}
          value={problemDescription}
          onChange={(e) => setProblemDescription(e.target.value)}
          placeholder="Briefly explain what coursework problem, proof, or exam topic you need guidance on..."
          className="w-full px-3.5 py-2.5 rounded-xl border border-edge text-sm text-ink bg-panel/50 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
        />
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={isPending || !topic.trim() || problemDescription.trim().length < 10}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-action hover:bg-action-hover text-white text-xs font-semibold transition-all shadow-xs min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              <span>Sending request...</span>
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Send Study Request</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
