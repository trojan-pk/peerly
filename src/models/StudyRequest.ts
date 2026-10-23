import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type RequestStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "CANCELLED"
  | "COMPLETED"
  | "REVIEWED";

export type RequestMode = "online" | "campus";

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
      enum: ["PENDING", "ACCEPTED", "REJECTED", "CANCELLED", "COMPLETED", "REVIEWED"],
      default: "PENDING",
      index: true,
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

// Index for efficiently querying peer reviews & aggregates
StudyRequestSchema.index({ peer: 1, status: 1 });

// Index for efficiently querying peer response stats & fast-reply badges
StudyRequestSchema.index({ peer: 1, respondedAt: 1, createdAt: 1 });

export const StudyRequest: Model<IStudyRequestDocument> =
  mongoose.models.StudyRequest ||
  mongoose.model<IStudyRequestDocument>("StudyRequest", StudyRequestSchema);

export default StudyRequest;
