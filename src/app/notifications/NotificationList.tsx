"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCheck, Clock, Inbox, Send, Star, XCircle, CheckCircle2 } from "lucide-react";
import type { NotificationDTO } from "@/lib/notifications";
import type { NotificationType } from "@/models/Notification";
import { Badge, Button } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { markAllNotificationsRead, markNotificationRead } from "./actions";
import { safeAction } from "@/lib/client-action";

const ICONS: Record<NotificationType, typeof Inbox> = {
  REQUEST_RECEIVED: Inbox,
  REQUEST_ACCEPTED: CheckCircle2,
  REQUEST_DECLINED: XCircle,
  COMPLETION_CONFIRMED: Send,
  SESSION_COMPLETED: CheckCheck,
  REVIEW_RECEIVED: Star,
  REQUEST_EXPIRED: Clock,
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationList({ items, unread }: { items: NotificationDTO[]; unread: number }) {
  const router = useRouter();
  const toast = useToast();
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  function open(item: NotificationDTO) {
    setReadIds((ids) => new Set(ids).add(item.id));
    startTransition(async () => {
      if (!item.read) await safeAction(() => markNotificationRead(item.id));
      router.push(item.href);
    });
  }

  function markAll() {
    startTransition(async () => {
      const result = await safeAction(() => markAllNotificationsRead());
      if (result.success) {
        setReadIds(new Set(items.map((i) => i.id)));
        toast.show({ tone: "success", title: result.message ?? "Marked as read." });
        router.refresh();
      } else toast.show({ tone: "error", title: result.message ?? "Couldn't update notifications." });
    });
  }

  const remaining = Math.max(0, unread - items.filter((i) => !i.read && readIds.has(i.id)).length);

  return (
    <section aria-labelledby="notification-list-title" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="notification-list-title" className="text-sm font-semibold text-muted"><span className="tabular">{remaining}</span> unread</h2>
        <Button variant="ghost" size="sm" onClick={markAll} disabled={pending || remaining === 0} icon={<CheckCheck size={15} aria-hidden="true" />}>Mark all as read</Button>
      </div>
      <ul className="notification-list">
        {items.map((item) => {
          const Icon = item.urgent && item.type === "REQUEST_RECEIVED" ? AlertTriangle : ICONS[item.type];
          const read = item.read || readIds.has(item.id);
          return (
            <li key={item.id}>
              <button type="button" onClick={() => open(item)} disabled={pending} className={`notification-item ${read ? "" : "is-unread"}`} aria-describedby={`${item.id}-meta`}>
                <span className={`notification-icon ${item.urgent ? "is-urgent" : ""}`} aria-hidden="true"><Icon size={17} /></span>
                <span className="notification-copy">
                  <strong>{item.title}</strong>
                  <span>{item.body}</span>
                  <small id={`${item.id}-meta`}>{read ? "" : "Unread · "}{relativeTime(item.createdAt)}</small>
                </span>
                {item.urgent && item.type === "REQUEST_RECEIVED" && <Badge tone="danger">Urgent</Badge>}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
