import mongoose, { Schema, Document, Model } from "mongoose";
import { connectToDatabase, isDatabaseConfigured } from "./db";

export class RateLimiterError extends Error {
  constructor(message = "Rate limiter service error.") {
    super(message);
    this.name = "RateLimiterError";
  }
}

export interface IRateLimitDocument extends Document {
  key: string;
  timestamps: Date[];
  expiresAt: Date;
  lastAllowed: boolean;
}

const RateLimitSchema = new Schema<IRateLimitDocument>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    timestamps: {
      type: [Date],
      default: [],
    },
    lastAllowed: { type: Boolean, default: false },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // MongoDB TTL index: automatically deletes expired records
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

export const RateLimit: Model<IRateLimitDocument> =
  mongoose.models.RateLimit ||
  mongoose.model<IRateLimitDocument>("RateLimit", RateLimitSchema);

let limiterIndexPromise: Promise<void> | null = null;

/**
 * Ensures unique and TTL indexes exist on RateLimit before any writes occur,
 * safely handling cold-start concurrency by sharing an in-flight initialization promise.
 */
export async function ensureRateLimiterIndexes(): Promise<void> {
  if (!limiterIndexPromise) {
    limiterIndexPromise = (async () => {
      await connectToDatabase();
      await RateLimit.init();
    })().catch((err) => {
      limiterIndexPromise = null;
      throw err;
    });
  }
  await limiterIndexPromise;
}

/**
 * Atomic sliding-window rate limiter backed by MongoDB.
 * - Multi-instance safe: executes atomic aggregation updates in MongoDB.
 * - Fails closed: does not silently allow writes when database configuration is absent.
 * - Bounded storage: records at most limit admitted attempts per window.
 *   Blocked attempts neither consume slots nor extend the retry time.
 * - Concurrency safe: guarantees index existence prior to writes, including cold starts.
 * - Automated cleanup: includes MongoDB TTL document expiration on expiresAt.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  if (!isDatabaseConfigured()) {
    throw new RateLimiterError("Rate limiting requires database configuration.");
  }

  await ensureRateLimiterIndexes();

  if (!Number.isInteger(limit) || limit < 1 || !Number.isFinite(windowMs) || windowMs < 1) {
    throw new RateLimiterError("Invalid rate limit configuration.");
  }

  // Use the database clock for every instance. Only admitted attempts consume
  // slots; blocked traffic must not indefinitely postpone a user's retry time.
  const updated = await RateLimit.findOneAndUpdate(
    { key },
    [
      { $set: {
        timestamps: { $filter: {
          input: { $ifNull: ["$timestamps", []] }, as: "ts",
          cond: { $gt: ["$$ts", { $subtract: ["$$NOW", windowMs] }] },
        } },
      } },
      { $set: { lastAllowed: { $lt: [{ $size: "$timestamps" }, limit] } } },
      { $set: {
        timestamps: { $cond: ["$lastAllowed", { $concatArrays: ["$timestamps", ["$$NOW"]] }, "$timestamps"] },
        expiresAt: { $add: ["$$NOW", windowMs + 60000] },
      } },
    ],
    { upsert: true, returnDocument: "after", updatePipeline: true }
  );
  if (!updated) throw new RateLimiterError();
  if (updated.lastAllowed) return { allowed: true };
  const retryAt = (updated.timestamps[0]?.getTime() ?? Date.now()) + windowMs;
  return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((retryAt - Date.now()) / 1000)) };

}

/**
 * Resets rate limit records (for testing environments).
 */
export async function resetRateLimitsForTesting(): Promise<void> {
  limiterIndexPromise = null;
  if (isDatabaseConfigured()) {
    try {
      await connectToDatabase();
      await RateLimit.deleteMany({});
    } catch {
      // Ignored if DB not reachable
    }
  }
}
