import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { IModerationInfo } from "./User";

export interface IResourceDocument extends Document {
  owner: Types.ObjectId;
  title: string;
  description: string;
  topic: string;
  normalizedTopic: string;
  url: string;
  moderation?: IModerationInfo;
  createdAt: Date;
  updatedAt: Date;
}

const ResourceSchema = new Schema<IResourceDocument>(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Owner is required"],
      index: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      minlength: [2, "Title must be at least 2 characters"],
      maxlength: [120, "Title cannot exceed 120 characters"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      minlength: [10, "Description must be at least 10 characters"],
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    topic: {
      type: String,
      required: [true, "Topic is required"],
      trim: true,
      minlength: [2, "Topic must be at least 2 characters"],
      maxlength: [50, "Topic cannot exceed 50 characters"],
    },
    normalizedTopic: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    url: {
      type: String,
      required: [true, "URL is required"],
      trim: true,
      maxlength: [500, "URL cannot exceed 500 characters"],
    },
    moderation: {
      isHidden: {
        type: Boolean,
        default: false,
        index: true,
      },
      action: {
        type: String,
        enum: ["HIDE", "RESTORE"],
        default: null,
      },
      moderatedAt: {
        type: Date,
        default: null,
      },
      moderatedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      reason: {
        type: String,
        default: null,
        trim: true,
        maxlength: [500, "Moderation reason cannot exceed 500 characters"],
      },
      hiddenAt: {
        type: Date,
        default: null,
      },
      hiddenBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for bounded, sorted querying
ResourceSchema.index({ owner: 1, createdAt: -1 });
ResourceSchema.index({ normalizedTopic: 1, createdAt: -1 });
ResourceSchema.index({ createdAt: -1, _id: -1 });
ResourceSchema.index({ "moderation.isHidden": 1, createdAt: -1 });

export const Resource: Model<IResourceDocument> =
  mongoose.models.Resource ||
  mongoose.model<IResourceDocument>("Resource", ResourceSchema);

export default Resource;
