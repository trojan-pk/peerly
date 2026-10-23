"use client";

import { safeAction } from "@/lib/client-action";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createStudyRequest, RequestActionResult } from "@/app/dashboard/actions";
import { Send, CheckCircle2, AlertCircle, Loader2, ArrowRight, UserCheck, Lock } from "lucide-react";
import { RequestMode } from "@/models/StudyRequest";

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
  const [result, setResult] = useState<RequestActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  // Case 1: Unauthenticated visitor
  if (!isAuthenticated) {
    return (
      <div className="rounded-2xl border border-stone-200/90 bg-stone-50/70 p-6 sm:p-7 space-y-3 text-center">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
          <Lock className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="max-w-md mx-auto space-y-1">
          <h2 className="text-base font-bold text-stone-900">
            Sign In to Request Help
          </h2>
          <p className="text-xs text-stone-600 leading-relaxed">
            Please sign in with your Google account to send a study session request to {peerName}.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors min-h-[44px] shadow-xs"
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
      <div className="rounded-2xl border border-stone-200/90 bg-stone-50/70 p-5 flex items-center gap-3 text-xs text-stone-700">
        <UserCheck className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />
        <div>
          <span className="font-semibold block text-stone-900">This is your public peer profile</span>
          <span>You cannot send study session requests to yourself.</span>
        </div>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResult(null);

    startTransition(async () => {
      const res = await safeAction(() => createStudyRequest({
        peerId,
        topic,
        problemDescription,
        mode,
      }));

      setResult(res);
      if (res.success) {
        setProblemDescription("");
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-stone-200/90 bg-white p-6 sm:p-7 space-y-6 shadow-xs"
      noValidate
    >
      <div className="space-y-1 border-b border-stone-100 pb-4">
        <h2 className="text-base font-bold text-stone-900">
          Request Study Assistance
        </h2>
        <p className="text-xs text-stone-500">
          Send a coursework problem or concept question directly to {peerName}.
        </p>
      </div>

      {/* Notifications */}
      {result && result.success && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-emerald-200 bg-emerald-50/90 p-4 space-y-2 text-xs text-emerald-950"
        >
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />
            <span>{result.message}</span>
          </div>
          <p className="text-emerald-800">
            Once {peerName} accepts your request, their private contact details will unlock automatically in your dashboard.
          </p>
          <div className="pt-1">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-700 text-white font-medium hover:bg-emerald-800 transition-colors"
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
          className="rounded-xl border border-red-200 bg-red-50/90 p-4 space-y-1 text-xs text-red-950"
        >
          <div className="flex items-center gap-2 font-semibold text-red-900">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
            <span>{result.message}</span>
          </div>
          {result.errors && (
            <ul className="list-disc list-inside space-y-0.5 text-red-700 pt-1">
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
        <label htmlFor="request-topic" className="block text-xs font-semibold text-stone-800">
          Study Topic <span className="text-emerald-700">*</span>
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
          className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm text-stone-900 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 transition-colors"
        />
        {peerTopics.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] text-stone-400">Quick select:</span>
            {peerTopics.map((pt) => (
              <button
                type="button"
                key={pt}
                onClick={() => setTopic(pt)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  topic === pt
                    ? "bg-emerald-600 text-white"
                    : "bg-stone-100 text-stone-700 hover:bg-stone-200"
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
        <legend className="text-xs font-semibold text-stone-800">
          Preferred Session Mode <span className="text-emerald-700">*</span>
        </legend>
        <div className="flex flex-wrap gap-4">
          {(peerMode === "online" || peerMode === "both") && (
            <label className="flex items-center gap-2 cursor-pointer text-xs text-stone-800">
              <input
                type="radio"
                name="mode"
                value="online"
                checked={mode === "online"}
                onChange={() => setMode("online")}
                className="text-emerald-600 focus:ring-emerald-600"
              />
              <span>Online (Video / Call)</span>
            </label>
          )}

          {(peerMode === "campus" || peerMode === "both") && (
            <label className="flex items-center gap-2 cursor-pointer text-xs text-stone-800">
              <input
                type="radio"
                name="mode"
                value="campus"
                checked={mode === "campus"}
                onChange={() => setMode("campus")}
                className="text-emerald-600 focus:ring-emerald-600"
              />
              <span>In-person on Campus</span>
            </label>
          )}
        </div>
      </fieldset>

      {/* Problem Description */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="problemDescription" className="block text-xs font-semibold text-stone-800">
            Problem or Question Description <span className="text-emerald-700">*</span>
          </label>
          <span className="text-[11px] text-stone-400">
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
          className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm text-stone-900 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 transition-colors"
        />
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={isPending || !topic.trim() || problemDescription.trim().length < 10}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-all shadow-xs min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
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
