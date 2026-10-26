"use client";

import { useState, useTransition } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { setPublicPageAction } from "@/app/actions/helper-page";

/** Opt-in switch for the shareable /h/[slug] helper page. */
export function PublicPageSection({ initialEnabled, initialSlug, origin }: { initialEnabled: boolean; initialSlug: string | null; origin: string }) {
  const toast = useToast();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [slug, setSlug] = useState(initialSlug);
  const [pending, startTransition] = useTransition();
  const url = slug ? `${origin}/h/${slug}` : null;

  function toggle() {
    const next = !enabled;
    startTransition(async () => {
      const result = await setPublicPageAction(next);
      if (result.success) { setEnabled(Boolean(result.enabled)); setSlug(result.slug ?? slug); }
      toast.show({ tone: result.success ? "success" : "error", title: result.message ?? "Done." });
    });
  }

  return (
    <div className="space-y-3">
      <div className="email-alerts">
        <button type="button" role="switch" aria-checked={enabled} aria-labelledby="public-page-label" aria-describedby="public-page-hint" disabled={pending} onClick={toggle} className="ui-switch"><span aria-hidden="true" /></button>
        <div>
          <span id="public-page-label" className="font-semibold text-ink text-sm">Public helper page</span>
          <p id="public-page-hint" className="text-sm text-muted mt-1">Anyone with the link sees your name, university, courses, topics and real numbers: completed sessions, average rating, review count and response time. Never your email, contact details or messages. Search engines are asked not to index it.</p>
        </div>
      </div>
      {enabled && url && (
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink break-all" data-testid="public-page-url">{url}</code>
          <Button size="sm" variant="secondary" icon={<Copy size={14} aria-hidden="true" />} onClick={async () => { try { await navigator.clipboard.writeText(url); toast.show({ tone: "success", title: "Link copied." }); } catch { toast.show({ tone: "error", title: "Copy failed — select the link instead." }); } }}>Copy link</Button>
          <a className="ui-button is-ghost is-sm" href={`/h/${slug}`} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} aria-hidden="true" />Open</a>
        </div>
      )}
    </div>
  );
}
