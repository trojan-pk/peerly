import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type ReportTargetType = "user" | "resource";
export type ReportStatus = "OPEN" | "RESOLVED" | "DISMISSED";

export interface IReportDocument extends Document {
  targetType: ReportTargetType;
  targetId: Types.ObjectId;
  reporter: Types.ObjectId;
  reason: string;
  explanation: string;
  status: ReportStatus;
  moderatorNotes?: string;
  resolvedBy?: Types.ObjectId | null;
  resolvedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ReportSchema = new Schema<IReportDocument>(
  {
    targetType: {
      type: String,
      enum: ["user", "resource"],
      required: true,
      index: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    reporter: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, "Reason cannot exceed 100 characters"],
    },
    explanation: {
      type: String,
      required: true,
      trim: true,
      minlength: [10, "Explanation must be at least 10 characters"],
      maxlength: [1000, "Explanation cannot exceed 1000 characters"],
    },
    status: {
      type: String,
      enum: ["OPEN", "RESOLVED", "DISMISSED"],
      default: "OPEN",
      index: true,
    },
    moderatorNotes: {
      type: String,
      default: "",
      trim: true,
      maxlength: [1000, "Moderator notes cannot exceed 1000 characters"],
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Database-enforced partial unique index:
// Strictly prevents duplicate OPEN reports per reporter and target!
ReportSchema.index(
  { reporter: 1, targetType: 1, targetId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "OPEN" },
  }
);

// Admin query index for status-filtered, paginated lists
ReportSchema.index({ status: 1, createdAt: -1, _id: -1 });

export const Report: Model<IReportDocument> =
  mongoose.models.Report ||
  mongoose.model<IReportDocument>("Report", ReportSchema);

export default Report;
