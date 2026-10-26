import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

/** Admin-managed university with the email domains its students use. */
export interface IUniversityDocument extends Document {
  name: string;
  slug: string;
  domains: string[];
  isHidden: boolean;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const UniversitySchema = new Schema<IUniversityDocument>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 80 },
    domains: { type: [String], default: [], validate: { validator: (v: string[]) => v.length <= 10, message: "At most 10 domains" } },
    isHidden: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);
UniversitySchema.index({ slug: 1 }, { unique: true });
UniversitySchema.index({ domains: 1 });

export const University: Model<IUniversityDocument> =
  mongoose.models.University || mongoose.model<IUniversityDocument>("University", UniversitySchema);

/** A course at one university, identified by its normalised code (e.g. CS-101). */
export interface ICourseDocument extends Document {
  university: Types.ObjectId;
  code: string;
  title: string;
  isHidden: boolean;
  mergedInto: Types.ObjectId | null;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const CourseSchema = new Schema<ICourseDocument>(
  {
    university: { type: Schema.Types.ObjectId, ref: "University", required: true },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 12 },
    title: { type: String, default: "", trim: true, maxlength: 120 },
    isHidden: { type: Boolean, default: false },
    mergedInto: { type: Schema.Types.ObjectId, ref: "Course", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);
CourseSchema.index({ university: 1, code: 1 }, { unique: true });
CourseSchema.index({ university: 1, isHidden: 1, code: 1 });

export const Course: Model<ICourseDocument> =
  mongoose.models.Course || mongoose.model<ICourseDocument>("Course", CourseSchema);

/**
 * One pending university-email verification per user. Stores only a salted
 * SHA-256 hash of the 6-digit code; records expire automatically.
 */
export interface IEmailVerificationDocument extends Document {
  user: Types.ObjectId;
  university: Types.ObjectId;
  email: string;
  codeHash: string;
  salt: string;
  attempts: number;
  expiresAt: Date;
  createdAt: Date;
}

const EmailVerificationSchema = new Schema<IEmailVerificationDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    university: { type: Schema.Types.ObjectId, ref: "University", required: true },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    codeHash: { type: String, required: true, select: false },
    salt: { type: String, required: true, select: false },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);
EmailVerificationSchema.index({ user: 1 }, { unique: true });
// Keep a record briefly after expiry so the user sees "expired" rather than "no code"; then delete.
EmailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 });

export const EmailVerification: Model<IEmailVerificationDocument> =
  mongoose.models.EmailVerification || mongoose.model<IEmailVerificationDocument>("EmailVerification", EmailVerificationSchema);
