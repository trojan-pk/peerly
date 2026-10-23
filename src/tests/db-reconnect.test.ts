import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import mongoose from "mongoose";
import {
  connectToDatabase,
  isDatabaseConfigured,
  DatabaseConfigurationError,
} from "@/lib/db";

describe("Database Connection Helper & Disconnect Handling", () => {
  const originalEnv = process.env.MONGODB_URI;

  beforeEach(() => {
    delete process.env.MONGODB_URI;
    // Reset global cache
    if (global.mongooseCache) {
      global.mongooseCache.conn = null;
      global.mongooseCache.promise = null;
    }
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.MONGODB_URI = originalEnv;
    } else {
      delete process.env.MONGODB_URI;
    }
    vi.restoreAllMocks();
  });

  it("reports unconfigured when MONGODB_URI is undefined, empty, or placeholder", () => {
    expect(isDatabaseConfigured()).toBe(false);

    process.env.MONGODB_URI = "   ";
    expect(isDatabaseConfigured()).toBe(false);

    process.env.MONGODB_URI = "mongodb+srv://<username>:<password>@cluster0.mongodb.net/peerly";
    expect(isDatabaseConfigured()).toBe(false);
  });

  it("throws DatabaseConfigurationError without leaking secrets when URI is missing or placeholder", async () => {
    delete process.env.MONGODB_URI;
    await expect(connectToDatabase()).rejects.toThrow(DatabaseConfigurationError);

    process.env.MONGODB_URI = "mongodb+srv://<username>:<password>@cluster0.mongodb.net/peerly";
    await expect(connectToDatabase()).rejects.toThrow(DatabaseConfigurationError);
  });

  it("sets a bounded timeout and resets cached promise on connection error", async () => {
    process.env.MONGODB_URI = "mongodb://localhost:27017/peerly_test";

    // Spy on mongoose.connect to observe options and simulate failure
    let passedOptions: mongoose.ConnectOptions | undefined;
    const connectSpy = vi.spyOn(mongoose, "connect").mockImplementation(async (_uri, opts) => {
      passedOptions = opts;
      throw new Error("Simulated connection timeout");
    });

    await expect(connectToDatabase()).rejects.toThrow(
      "Could not establish database connection within the timeout period."
    );

    // Verify bounded timeout options
    expect(passedOptions?.serverSelectionTimeoutMS).toBe(5000);
    expect(passedOptions?.connectTimeoutMS).toBe(5000);
    expect(passedOptions?.bufferCommands).toBe(false);

    // Verify cache is cleared on failure so subsequent attempts can retry
    expect(global.mongooseCache?.conn).toBeNull();
    expect(global.mongooseCache?.promise).toBeNull();

    connectSpy.mockRestore();
  });

  it("resets stale cached promise if connection is in disconnected state (readyState === 0)", async () => {
    process.env.MONGODB_URI = "mongodb://localhost:27017/peerly_test";

    // Mock readyState as disconnected (0)
    vi.spyOn(mongoose.connection, "readyState", "get").mockReturnValue(0);

    let connectCallCount = 0;
    const connectSpy = vi.spyOn(mongoose, "connect").mockImplementation(async () => {
      connectCallCount++;
      return mongoose;
    });

    await connectToDatabase();
    expect(connectCallCount).toBe(1);

    // Simulate another request while readyState remains 0 (disconnected)
    await connectToDatabase();
    // Stale promise was not reused; fresh reconnect was attempted
    expect(connectCallCount).toBe(2);

    connectSpy.mockRestore();
  });
  it("shares a pending connection even before readyState changes", async () => {
    process.env.MONGODB_URI = "mongodb://localhost:27017/peerly_test";
    vi.spyOn(mongoose.connection, "readyState", "get").mockReturnValue(0);
    let resolveConnection!: (connection: typeof mongoose) => void;
    const pending = new Promise<typeof mongoose>((resolve) => { resolveConnection = resolve; });
    const connectSpy = vi.spyOn(mongoose, "connect").mockReturnValue(pending);
    const first = connectToDatabase();
    const second = connectToDatabase();
    expect(connectSpy).toHaveBeenCalledTimes(1);
    resolveConnection(mongoose);
    await Promise.all([first, second]);
    expect(global.mongooseCache?.promise).toBeNull();
  });

});
