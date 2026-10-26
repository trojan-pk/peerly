import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

/** One "helpful" vote per member per resource. */
export interface IResourceVoteDocument extends Document {
  user: Types.ObjectId;
  resource: Types.ObjectId;
  createdAt: Date;
}

const ResourceVoteSchema = new Schema<IResourceVoteDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    resource: { type: Schema.Types.ObjectId, ref: "Resource", required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);
ResourceVoteSchema.index({ user: 1, resource: 1 }, { unique: true });
ResourceVoteSchema.index({ resource: 1 });

export const ResourceVote: Model<IResourceVoteDocument> =
  mongoose.models.ResourceVote || mongoose.model<IResourceVoteDocument>("ResourceVote", ResourceVoteSchema);
