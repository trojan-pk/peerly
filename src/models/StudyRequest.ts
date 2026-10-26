import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type RequestStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "CANCELLED"
  | "COMPLETED"
  | "REVIEWED"
  | "EXPIRED";

export const REQUEST_STATUSES: readonly RequestStatus[] = ["PENDING", "ACCEPTED", "REJECTED", "CANCELLED", "COMPLETED", "REVIEWED", "EXPIRED"];

export type RequestMode = "online" | "campus";
export type RequestUrgency = "normal" | "urgent";

/** Pending requests sort first on dashboards, urgent ones above normal ones. */
export function requestPriority(status: RequestStatus, urgency: RequestUrgency): number {
  if (status !== "PENDING") return 0;
  return urgency === "urgent" ? 2 : 1;
}

export interface IStudyRequestReview {
  rating: number;
  comment: string;
  createdAt: Date;
}

export interface IStudyRequestDocument extends Document {
  learner: Types.ObjectId;
  peer: Types.ObjectId;
  topic: string;
  normalizedTopic: string;
  problemDescription: string;
  mode: RequestMode;
  status: RequestStatus;
  urgency: RequestUrgency;
  course?: Types.ObjectId | null;
  courseCode?: string;
  /** Up to three proposed start times from one participant, awaiting the other's choice. */
  proposedSlots?: Date[];
  proposedBy?: Types.ObjectId | null;
  sessionDurationMinutes?: number;
  scheduledAt?: Date | null;
  /** Incremented on every schedule change so calendar apps update the same event. */
  scheduleSequence?: number;
  /** Unguessable Jitsi room name, created on demand for an accepted session. */
  meetingRoom?: string | null;
  /** Optional learner deadline; never later than expiresAt. */
  neededBy?: Date | null;
  /** When a PENDING request stops accepting responses. Legacy records may lack it. */
  expiresAt?: Date | null;
  /** Dashboard sort key: 2 urgent pending, 1 normal pending, 0 resolved. */
  priority?: number;
  respondedAt?: Date | null;
  learnerConfirmedAt?: Date | null;
  peerConfirmedAt?: Date | null;
  review?: IStudyRequestReview | null;
  archivedBy?: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IStudyRequestReview>(
  {
    rating: {
      type: Number,
      required: true,
      min: [1, "Rating must be at least 1 star"],
      max: [5, "Rating cannot exceed 5 stars"],
      validate: {
        validator: Number.isInteger,
        message: "Rating must be an integer between 1 and 5",
      },
    },
    comment: {
      type: String,
      default: "",
      trim: true,
      maxlength: [1000, "Review comment cannot exceed 1000 characters"],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const StudyRequestSchema = new Schema<IStudyRequestDocument>(
  {
    learner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    peer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    topic: {
      type: String,
      required: [true, "Topic is required"],
      trim: true,
      minlength: [1, "Topic cannot be empty"],
      maxlength: [100, "Topic cannot exceed 100 characters"],
    },
    normalizedTopic: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    problemDescription: {
      type: String,
      required: [true, "Problem description is required"],
      trim: true,
      minlength: [10, "Problem description must be at least 10 characters"],
      maxlength: [2000, "Problem description cannot exceed 2000 characters"],
    },
    mode: {
      type: String,
      enum: ["online", "campus"],
      required: true,
    },
    status: {
      type: String,
      enum: REQUEST_STATUSES,
      default: "PENDING",
      index: true,
    },
    urgency: { type: String, enum: ["normal", "urgent"], default: "normal" },
    course: { type: Schema.Types.ObjectId, ref: "Course", default: null },
    courseCode: { type: String, default: "", maxlength: 12 },
    proposedSlots: { type: [Date], default: [] },
    proposedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    sessionDurationMinutes: { type: Number, default: 60, min: 15, max: 240 },
    scheduledAt: { type: Date, default: null },
    scheduleSequence: { type: Number, default: 0 },
    meetingRoom: { type: String, default: null, select: false },
    neededBy: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    priority: {
      type: Number,
      default: function (this: { status?: RequestStatus; urgency?: RequestUrgency }) {
        return requestPriority(this.status ?? "PENDING", this.urgency ?? "normal");
      },
    },
    archivedBy: { type: [Schema.Types.ObjectId], ref: "User", default: [], select: false },
    respondedAt: {
      type: Date,
      default: null,
      index: true,
    },
    learnerConfirmedAt: {
      type: Date,
      default: null,
    },
    peerConfirmedAt: {
      type: Date,
      default: null,
    },
    review: {
      type: ReviewSchema,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Database-enforced partial unique compound index:
// Strictly prevents race conditions and duplicate active requests
// for the same learner, peer, and normalized topic!
StudyRequestSchema.index(
  { learner: 1, peer: 1, normalizedTopic: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["PENDING", "ACCEPTED"] },
    },
  }
);

// Expiry sweeps and dashboard ordering (urgent pending first).
StudyRequestSchema.index({ status: 1, expiresAt: 1 });
StudyRequestSchema.index({ peer: 1, priority: -1, createdAt: -1, _id: -1 });
StudyRequestSchema.index({ learner: 1, priority: -1, createdAt: -1, _id: -1 });

// Index for efficiently querying peer reviews & aggregates
StudyRequestSchema.index({ peer: 1, status: 1 });

// Index for efficiently querying peer response stats & fast-reply badges
StudyRequestSchema.index({ peer: 1, respondedAt: 1, createdAt: 1 });

export const StudyRequest: Model<IStudyRequestDocument> =
  mongoose.models.StudyRequest ||
  mongoose.model<IStudyRequestDocument>("StudyRequest", StudyRequestSchema);

export default StudyRequest;
