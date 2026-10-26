"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { getUnreadNotificationCount } from "@/app/notifications/actions";

export const NOTIFICATION_POLL_MS = 60_000;

/**
 * Header bell with an accessible unread count.
 * Polls every 60s only while the tab is visible, and immediately when the tab
 * becomes visible again. When the count rises, the current page refreshes so
 * dashboards show the new request without a manual reload.
 */
export function NotificationBell({ initialCount, current = false }: { initialCount: number; current?: boolean }) {
  const router = useRouter();
  const [count, setCount] = useState(initialCount);
  const [seenInitial, setSeenInitial] = useState(initialCount);
  const last = useRef(initialCount);

  // A server refresh brings a fresh count: adopt it (render-time derived state).
  if (initialCount !== seenInitial) {
    setSeenInitial(initialCount);
    setCount(initialCount);
  }
  useEffect(() => { last.current = count; }, [count]);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    async function poll() {
      if (inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        const { count: next } = await getUnreadNotificationCount();
        if (cancelled) return;
        const rose = next > last.current;
        last.current = next;
        setCount(next);
        if (rose) router.refresh();
      } catch {
        // Network hiccup: keep the last known count and try on the next tick.
      } finally {
        inFlight = false;
      }
    }
    const timer = window.setInterval(poll, NOTIFICATION_POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void poll(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { cancelled = true; window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [router]);

  const label = count === 0 ? "Notifications, none unread" : `Notifications, ${count} unread`;
  const shown = count > 99 ? "99+" : String(count);
  const content = (
    <>
      <Bell size={19} aria-hidden="true" />
      {count > 0 && <span className="bell-count tabular" aria-hidden="true">{shown}</span>}
    </>
  );
  if (current) return <span className="settings-link bell-link is-current" aria-current="page" role="img" aria-label={label}>{content}</span>;
  return <Link href="/notifications" className="settings-link bell-link" aria-label={label} title="Notifications" data-unread={count}>{content}</Link>;
}
