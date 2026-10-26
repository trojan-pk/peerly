"use client";

import { useState, useTransition } from "react";
import { setEmailAlerts } from "@/app/notifications/actions";
import { safeAction } from "@/lib/client-action";
import { useToast } from "@/components/ui/Toast";

/** Switch for request email alerts. Explains honestly when email is not configured. */
export function EmailAlertsToggle({ initialEnabled, emailConfigured }: { initialEnabled: boolean; emailConfigured: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    startTransition(async () => {
      const result = await safeAction(() => setEmailAlerts(next));
      if (!result.success) {
        setEnabled(!next);
        toast.show({ tone: "error", title: result.message ?? "Couldn't save that setting." });
      } else toast.show({ tone: "success", title: result.message ?? "Saved." });
    });
  }

  return (
    <div className="email-alerts">
      <button type="button" role="switch" aria-checked={enabled} aria-labelledby="email-alerts-label" aria-describedby="email-alerts-hint" disabled={pending} onClick={toggle} className="ui-switch">
        <span aria-hidden="true" />
      </button>
      <div>
        <span id="email-alerts-label" className="font-semibold text-ink text-sm">Email me about requests</span>
        <p id="email-alerts-hint" className="text-sm text-muted mt-1">
          New requests for you, and when a helper accepts or declines yours. At most 10 emails an hour; topic and deadline only, never message text or contact details.
          {!emailConfigured && " Email delivery isn’t set up on this Peerly server yet, so for now you’ll see these in the notification bell only."}
        </p>
      </div>
    </div>
  );
}
