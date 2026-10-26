import mongoose from "mongoose";
import { isValidMongoUri } from "./env-config";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache || { conn: null, promise: null };

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

export class DatabaseConfigurationError extends Error {
  constructor(
    message = "Database configuration is missing or invalid. MONGODB_URI is required."
  ) {
    super(message);
    this.name = "DatabaseConfigurationError";
  }
}

export class DatabaseConnectionError extends Error {
  constructor(message = "Unable to establish a connection to the database.") {
    super(message);
    this.name = "DatabaseConnectionError";
  }
}

/**
 * Checks if a valid, non-placeholder MONGODB_URI is provided.
 */
export function isDatabaseConfigured(): boolean {
  return isValidMongoUri(process.env.MONGODB_URI);
}

/**
 * Returns a healthy Mongoose connection.
 * Correctly handles disconnected states, resets stale promises, and uses a bounded timeout.
 */
export async function connectToDatabase(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI?.trim();

  if (!isValidMongoUri(uri)) {
    throw new DatabaseConfigurationError();
  }

  if (cached.conn && mongoose.connection.readyState === 1) return cached.conn;
  // Only an in-flight connection is cached. Share it even while the driver still
  // reports disconnected; clearing it there races concurrent cold-start requests.
  if (cached.promise) return cached.promise;
  cached.conn = null;
  cached.promise = mongoose.connect(uri!, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  }).then((connection) => {
    cached.conn = connection;
    return connection;
  }).catch(() => {
    cached.conn = null;
    throw new DatabaseConnectionError("Could not establish database connection within the timeout period.");
  }).finally(() => {
    cached.promise = null;
  });
  return cached.promise;
}

let indexesEnsured = false;

/**
 * Ensures required unique and compound indexes are built and active in MongoDB
 * before performing application write operations.
 */
export async function ensureDatabaseIndexes(): Promise<void> {
  if (indexesEnsured) return;
  await connectToDatabase();

  const { User } = await import("@/models/User");
  const { StudyRequest } = await import("@/models/StudyRequest");
  const { RateLimit } = await import("@/lib/rate-limit");
  const { Resource } = await import("@/models/Resource");
  const { Report } = await import("@/models/Report");
  const { Notification } = await import("@/models/Notification");

  await Promise.all([
    User.init(),
    StudyRequest.init(),
    RateLimit.init(),
    Resource.init(),
    Report.init(),
    Notification.init(),
  ]);

  indexesEnsured = true;
}

export function resetIndexesStatusForTesting(): void {
  indexesEnsured = false;
}

export default connectToDatabase;
