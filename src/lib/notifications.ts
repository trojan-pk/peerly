import mongoose from "mongoose";
import { connectToDatabase, isDatabaseConfigured } from "@/lib/db";
import { Notification, type NotificationType } from "@/models/Notification";
import { User } from "@/models/User";
import { checkRateLimit } from "@/lib/rate-limit";
import { appOrigin, escapeHtml, isEmailConfigured, sendEmail } from "@/lib/email";
import { runAfterResponse } from "@/lib/background";

/** Per-recipient email ceiling; in-app notifications are never throttled. */
export const EMAIL_LIMIT_PER_HOUR = 10;

/** Event types that may also send an email (when configured and allowed). */
const EMAIL_TYPES: ReadonlySet<NotificationType> = new Set(["REQUEST_RECEIVED", "REQUEST_ACCEPTED", "REQUEST_DECLINED"]);

export interface NotificationEvent {
  type: NotificationType;
  recipientId: string | mongoose.Types.ObjectId;
  requestId: string | mongoose.Types.ObjectId;
  /** Display name of the person who caused the event; only the first name is stored. */
  actorName?: string;
  topic: string;
  urgent?: boolean;
  /** Learner deadline, included in helper emails when present. */
  neededBy?: Date | null;
}

export function firstName(name?: string | null): string {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  return first.slice(0, 60);
}

/** Short user-facing copy for a notification. Pure, shared by inbox and email. */
export function notificationCopy(type: NotificationType, actorFirstName: string, topic: string, urgent = false): { title: string; body: string } {
  const who = actorFirstName || "A student";
  switch (type) {
    case "REQUEST_RECEIVED":
      return { title: `${urgent ? "Urgent request" : "New request"}: ${topic}`, body: `${who} is asking for your help.` };
    case "REQUEST_ACCEPTED":
      return { title: `Accepted: ${topic}`, body: `${who} accepted your request. Their contact details are now in your dashboard.` };
    case "REQUEST_DECLINED":
      return { title: `Declined: ${topic}`, body: `${who} can't help with this one. Try another helper for the same topic.` };
    case "COMPLETION_CONFIRMED":
      return { title: `Session confirmed: ${topic}`, body: `${who} confirmed the session took place. Confirm it too to finish.` };
    case "SESSION_COMPLETED":
      return { title: `Session complete: ${topic}`, body: "Both of you confirmed the session." };
    case "REVIEW_RECEIVED":
      return { title: `New review: ${topic}`, body: `${who} reviewed your session.` };
    case "REQUEST_EXPIRED":
      return { title: `No response in time: ${topic}`, body: "Your request expired before the helper responded. Try another helper." };
  }
}

/** Where a notification leads: the dashboard tab where the recipient sees the request. */
export function notificationHref(type: NotificationType, requestId: string): string {
  const helperSide: NotificationType[] = ["REQUEST_RECEIVED", "REVIEW_RECEIVED"];
  const tab = helperSide.includes(type) ? "incoming" : "outgoing";
  return `/dashboard?tab=${tab}#request-${requestId}`;
}

function eventKey(event: NotificationEvent): string {
  return `${event.type}:${String(event.requestId)}`;
}

/**
 * Records notifications for request events. Best-effort by design: a failure is
 * logged and never rolls back or fails the action that triggered it. Duplicate
 * events for the same recipient/request/type are ignored by a unique index.
 */
export async function notify(events: NotificationEvent[]): Promise<void> {
  if (events.length === 0 || !isDatabaseConfigured()) return;
  try {
    await connectToDatabase();
    const docs = events.map((event) => ({
      recipient: new mongoose.Types.ObjectId(String(event.recipientId)),
      type: event.type,
      request: new mongoose.Types.ObjectId(String(event.requestId)),
      actorFirstName: firstName(event.actorName),
      topic: event.topic.slice(0, 100),
      urgent: Boolean(event.urgent),
      eventKey: eventKey(event),
      readAt: null,
      createdAt: new Date(),
    }));
    const inserted = new Set<string>();
    try {
      const result = await Notification.insertMany(docs, { ordered: false });
      for (const doc of result) inserted.add(doc.eventKey + String(doc.recipient));
    } catch (error) {
      const bulk = error as { code?: number; insertedDocs?: Array<{ eventKey: string; recipient: unknown }>; writeErrors?: Array<{ code?: number; err?: { code?: number } }> };
      const onlyDuplicates = bulk.code === 11000 || (bulk.writeErrors ?? []).every((e) => (e.code ?? e.err?.code) === 11000);
      if (!onlyDuplicates) throw error;
      for (const doc of bulk.insertedDocs ?? []) inserted.add(doc.eventKey + String(doc.recipient));
    }
    const emailEvents = events.filter((e) => EMAIL_TYPES.has(e.type) && inserted.has(eventKey(e) + String(e.recipientId)));
    if (emailEvents.length > 0 && isEmailConfigured()) {
      runAfterResponse(() => deliverNotificationEmails(emailEvents));
    }
  } catch (error) {
    console.error("[notify] Could not record notifications:", error instanceof Error ? error.message : "unknown error");
  }
}

function emailFor(event: NotificationEvent): { subject: string; html: string; text: string } {
  const { title, body } = notificationCopy(event.type, firstName(event.actorName), event.topic, event.urgent);
  const link = `${appOrigin()}${notificationHref(event.type, String(event.requestId))}`;
  const deadline = event.type === "REQUEST_RECEIVED" && event.neededBy
    ? `Needed by ${event.neededBy.toUTCString().replace(" GMT", " UTC")}.`
    : "";
  const lines = [body, deadline].filter(Boolean);
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f7f4ec;font-family:Arial,sans-serif;color:#141b2d">
<div style="max-width:520px;margin:auto;background:#fffdf8;border:1px solid #dcd5c5;border-radius:12px;padding:24px">
<p style="margin:0 0 6px;font-size:13px;color:#4c5366">Peerly</p>
<h1 style="margin:0 0 12px;font-size:20px;line-height:1.35">${escapeHtml(title)}</h1>
${lines.map((line) => `<p style="margin:0 0 10px;font-size:15px;line-height:1.6">${escapeHtml(line)}</p>`).join("")}
<p style="margin:20px 0 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#2c46b1;color:#ffffff;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:bold">Open your dashboard</a></p>
<p style="margin:20px 0 0;font-size:12px;color:#5d6371">You can turn these emails off in Settings.</p>
</div></body></html>`;
  const text = [title, "", ...lines, "", `Open your dashboard: ${link}`, "", "You can turn these emails off in Peerly Settings."].join("\n");
  return { subject: `Peerly — ${title}`, html, text };
}

/**
 * Sends emails for the given events, respecting each recipient's opt-out and an
 * hourly ceiling. Emails contain topic, urgency, deadline and a dashboard link only.
 */
export async function deliverNotificationEmails(events: NotificationEvent[]): Promise<void> {
  if (!isEmailConfigured() || !isDatabaseConfigured()) return;
  await connectToDatabase();
  const ids = [...new Set(events.map((e) => String(e.recipientId)))];
  const recipients = await User.find({ _id: { $in: ids } }).select("email emailAlerts moderation").lean();
  const byId = new Map(recipients.map((u) => [String(u._id), u]));
  for (const event of events) {
    const recipient = byId.get(String(event.recipientId));
    if (!recipient?.email || recipient.emailAlerts === false || recipient.moderation?.isHidden) continue;
    let allowed = false;
    try {
      allowed = (await checkRateLimit(`email:${String(recipient._id)}`, EMAIL_LIMIT_PER_HOUR, 60 * 60 * 1000)).allowed;
    } catch {
      allowed = false;
    }
    if (!allowed) continue;
    await sendEmail({ to: recipient.email, ...emailFor(event) });
  }
}

export interface NotificationDTO {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  href: string;
  urgent: boolean;
  read: boolean;
  createdAt: string;
}

export async function listNotificationsFor(userId: mongoose.Types.ObjectId, page = 1, pageSize = 20) {
  await connectToDatabase();
  const size = Math.max(1, Math.min(pageSize, 50));
  const total = await Notification.countDocuments({ recipient: userId });
  const totalPages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const rows = await Notification.find({ recipient: userId })
    .sort({ createdAt: -1, _id: -1 })
    .skip((current - 1) * size)
    .limit(size)
    .lean();
  const items: NotificationDTO[] = rows.map((row) => {
    const copy = notificationCopy(row.type, row.actorFirstName, row.topic, row.urgent);
    return { id: String(row._id), type: row.type, ...copy, href: notificationHref(row.type, String(row.request)), urgent: row.urgent, read: Boolean(row.readAt), createdAt: row.createdAt.toISOString() };
  });
  const unread = await Notification.countDocuments({ recipient: userId, readAt: null });
  return { items, total, unread, page: current, totalPages };
}

export async function countUnreadFor(userId: mongoose.Types.ObjectId): Promise<number> {
  await connectToDatabase();
  return Notification.countDocuments({ recipient: userId, readAt: null });
}
