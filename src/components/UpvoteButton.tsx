"use client";

import { useOptimistic, useTransition } from "react";
import { ThumbsUp } from "lucide-react";
import { setResourceUpvote } from "@/app/resources/actions";
import { useToast } from "@/components/ui/Toast";

/** "Helpful" toggle with an optimistic count; the owner sees the count only. */
export function UpvoteButton({ resourceId, title, count, upvoted, isOwner }: { resourceId: string; title: string; count: number; upvoted: boolean; isOwner: boolean }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [state, setOptimistic] = useOptimistic({ count, upvoted }, (_current, next: { count: number; upvoted: boolean }) => next);
  const label = `${state.count} ${state.count === 1 ? "person" : "people"} found this helpful`;

  if (isOwner) {
    return <span className="upvote-button" title="Your resource" aria-label={label}><ThumbsUp size={14} aria-hidden="true" /><span className="tabular">{state.count}</span></span>;
  }

  function toggle() {
    const next = !state.upvoted;
    startTransition(async () => {
      setOptimistic({ upvoted: next, count: Math.max(0, state.count + (next ? 1 : -1)) });
      let result: Awaited<ReturnType<typeof setResourceUpvote>>;
      try { result = await setResourceUpvote({ resourceId, upvote: next }); } catch { result = { success: false, message: "We couldn't reach the server." }; }
      if (!result.success) toast.show({ tone: "error", title: result.message ?? "Couldn't save your vote." });
    });
  }

  return (
    <button type="button" className="upvote-button" aria-pressed={state.upvoted} onClick={toggle} disabled={pending} aria-label={`Mark “${title}” as helpful. ${label}.`}>
      <ThumbsUp size={14} aria-hidden="true" className={state.upvoted ? "fill-current" : undefined} />
      <span className="tabular" aria-hidden="true">{state.count}</span>
      <span aria-hidden="true">Helpful</span>
    </button>
  );
}
