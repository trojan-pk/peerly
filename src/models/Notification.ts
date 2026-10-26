import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export const NOTIFICATION_TYPES = [
  "REQUEST_RECEIVED",
  "REQUEST_ACCEPTED",
  "REQUEST_DECLINED",
  "COMPLETION_CONFIRMED",
  "SESSION_COMPLETED",
  "REVIEW_RECEIVED",
  "REQUEST_EXPIRED",
  "SESSION_PROPOSED",
  "SESSION_SCHEDULED",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Notifications are removed automatically after this many days. */
export const NOTIFICATION_RETENTION_DAYS = 90;

/**
 * In-app notification. Stores only what is needed to render a short line:
 * the actor's first name and the request topic. It never stores contact details,
 * email addresses or the learner's problem description.
 */
export interface INotificationDocument extends Document {
  recipient: Types.ObjectId;
  type: NotificationType;
  request: Types.ObjectId;
  actorFirstName: string;
  topic: string;
  urgent: boolean;
  /** Dashboard tab where the recipient sees the request. */
  tab?: "incoming" | "outgoing" | null;
  /** Identifies the event; unique per recipient so retries never duplicate it. */
  eventKey: string;
  readAt: Date | null;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotificationDocument>(
  {
    recipient: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    request: { type: Schema.Types.ObjectId, ref: "StudyRequest", required: true },
    actorFirstName: { type: String, default: "", trim: true, maxlength: 60 },
    topic: { type: String, required: true, trim: true, maxlength: 100 },
    urgent: { type: Boolean, default: false },
    tab: { type: String, enum: ["incoming", "outgoing", null], default: null },
    eventKey: { type: String, required: true, maxlength: 120 },
    readAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

NotificationSchema.index({ recipient: 1, eventKey: 1 }, { unique: true });
NotificationSchema.index({ recipient: 1, createdAt: -1, _id: -1 });
NotificationSchema.index({ recipient: 1, readAt: 1 });
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 });

export const Notification: Model<INotificationDocument> =
  mongoose.models.Notification || mongoose.model<INotificationDocument>("Notification", NotificationSchema);

export default Notification;
