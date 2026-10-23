import mongoose, { Schema, Document, Model, Types } from "mongoose";
import {
  LearningMode,
  PricingPreference,
  UserRole,
  PublicUserProfile,
  AuthorizedContact,
  PrivateContactInfo,
} from "@/types/user";

export interface IModerationInfo {
  isHidden: boolean;
  action?: "HIDE" | "RESTORE" | null;
  moderatedAt?: Date | null;
  moderatedBy?: Types.ObjectId | null;
  reason?: string | null;
  hiddenAt?: Date | null;
  hiddenBy?: Types.ObjectId | null;
}

export interface IUserDocument extends Document {
  googleId: string;
  email: string;
  name: string;
  image: string;
  avatarData?: Buffer | null;
  avatarUpdated?: boolean;
  role: UserRole;
  bio: string;
  university: string;
  campus: string;
  topics: string[];
  subjects: string[];
  mode: LearningMode;
  availability: string;
  pricingPreference: PricingPreference;
  contact: PrivateContactInfo;
  isProfileComplete: boolean;
  reviewCount: number;
  averageRating: number;
  responseCount: number;
  averageResponseTimeHours: number | null;
  moderation?: IModerationInfo;
  createdAt: Date;
  updatedAt: Date;
}

const ContactSchema = new Schema<PrivateContactInfo>(
  {
    whatsapp: {
      type: String,
      default: "",
      trim: true,
      maxlength: [30, "WhatsApp number cannot exceed 30 characters"],
    },
    meetingLink: {
      type: String,
      default: "",
      trim: true,
      maxlength: [200, "Meeting link cannot exceed 200 characters"],
    },
    preferredMethod: {
      type: String,
      enum: ["whatsapp", "meeting_link", "email", "unspecified"],
      default: "unspecified",
    },
  },
  { _id: false }
);

const UserSchema = new Schema<IUserDocument>(
  {
    googleId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      select: false, // Hidden by default from queries
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    image: {
      type: String,
      default: "",
    },
    avatarData: { type: Buffer, default: null, select: false },
    avatarUpdated: { type: Boolean, default: false },
    role: {
      type: String,
      enum: ["student", "admin"],
      default: "student",
      // Never allow regular users to self-assign admin
    },
    bio: {
      type: String,
      default: "",
      trim: true,
      maxlength: [1000, "Bio cannot exceed 1000 characters"],
    },
    university: {
      type: String,
      default: "",
      trim: true,
      maxlength: [200, "University cannot exceed 200 characters"],
      index: true,
    },
    campus: {
      type: String,
      default: "",
      trim: true,
      maxlength: [200, "Campus cannot exceed 200 characters"],
    },
    topics: {
      type: [String],
      default: [],
      index: true,
    },
    subjects: {
      type: [String],
      default: [],
      index: true,
    },
    mode: {
      type: String,
      enum: ["online", "campus", "both"],
      default: "both",
      index: true,
    },
    availability: {
      type: String,
      default: "",
      trim: true,
      maxlength: [500, "Availability description cannot exceed 500 characters"],
    },
    pricingPreference: {
      type: String,
      enum: ["free", "paid", "both"],
      default: "free",
      index: true,
    },
    // Contact information MUST NEVER be exposed in public payloads.
    // select: false ensures Mongoose queries will NOT fetch contact unless explicitly requested.
    contact: {
      type: ContactSchema,
      default: () => ({
        whatsapp: "",
        meetingLink: "",
        preferredMethod: "unspecified",
      }),
      select: false,
    },
    isProfileComplete: {
      type: Boolean,
      default: false,
      index: true,
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    responseCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    averageResponseTimeHours: {
      type: Number,
      default: null,
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

UserSchema.index({ "moderation.isHidden": 1, isProfileComplete: 1 });

/**
 * Strict DTO transformer for public profiles.
 * Strips away email, googleId, and private contact info.
 */
export function toPublicProfile(user: IUserDocument | Record<string, unknown>): PublicUserProfile {
  const rawId = (user as { _id?: unknown; id?: unknown })._id || (user as { id?: unknown }).id;
  const idStr = rawId ? String(rawId) : "";

  return {
    id: idStr,
    name: typeof user.name === "string" ? user.name : "",
    image: typeof user.image === "string" ? user.image : undefined,
    bio: typeof user.bio === "string" ? user.bio : "",
    university: typeof user.university === "string" ? user.university : "",
    campus: typeof user.campus === "string" ? user.campus : "",
    topics: Array.isArray(user.topics) ? (user.topics as string[]) : [],
    subjects: Array.isArray(user.subjects) ? (user.subjects as string[]) : [],
    mode: (user.mode as LearningMode) || "both",
    availability: typeof user.availability === "string" ? user.availability : "",
    pricingPreference: (user.pricingPreference as PricingPreference) || "free",
    isProfileComplete: Boolean(user.isProfileComplete),
    reviewCount: typeof user.reviewCount === "number" ? user.reviewCount : 0,
    averageRating: typeof user.averageRating === "number" ? user.averageRating : 0,
    responseCount: typeof user.responseCount === "number" ? user.responseCount : 0,
    averageResponseTimeHours:
      typeof user.averageResponseTimeHours === "number" ? user.averageResponseTimeHours : null,
    createdAt:
      user.createdAt instanceof Date
        ? user.createdAt.toISOString()
        : typeof user.createdAt === "string"
        ? user.createdAt
        : new Date().toISOString(),
  };
}

/**
 * Authorized contact transformer.
 * ONLY call this when verifying accepted/completed session participant authorization.
 */
export function toAuthorizedContact(
  user: IUserDocument | (Record<string, unknown> & { contact?: PrivateContactInfo; email?: string })
): AuthorizedContact {
  const rawId = (user as { _id?: unknown; id?: unknown })._id || (user as { id?: unknown }).id;
  const contact = user.contact || {};

  return {
    peerId: rawId ? String(rawId) : "",
    peerName: typeof user.name === "string" ? user.name : "Peer",
    email: typeof user.email === "string" ? user.email : undefined,
    whatsapp: contact.whatsapp || undefined,
    meetingLink: contact.meetingLink || undefined,
    preferredMethod: contact.preferredMethod || "unspecified",
  };
}

export const User: Model<IUserDocument> =
  mongoose.models.User || mongoose.model<IUserDocument>("User", UserSchema);

export default User;
