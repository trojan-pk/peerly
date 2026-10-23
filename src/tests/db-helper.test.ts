import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  connectToDatabase,
  isDatabaseConfigured,
  DatabaseConfigurationError,
} from "@/lib/db";

describe("MongoDB Connection Helper", () => {
  const originalEnv = process.env.MONGODB_URI;

  beforeEach(() => {
    delete process.env.MONGODB_URI;
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.MONGODB_URI = originalEnv;
    } else {
      delete process.env.MONGODB_URI;
    }
  });

  it("reports unconfigured when MONGODB_URI is undefined or empty", () => {
    delete process.env.MONGODB_URI;
    expect(isDatabaseConfigured()).toBe(false);

    process.env.MONGODB_URI = "   ";
    expect(isDatabaseConfigured()).toBe(false);
  });

  it("reports configured when MONGODB_URI is provided", () => {
    process.env.MONGODB_URI = "mongodb://localhost:27017/test";
    expect(isDatabaseConfigured()).toBe(true);
  });

  it("throws DatabaseConfigurationError without leaking secrets when URI is missing", async () => {
    delete process.env.MONGODB_URI;

    await expect(connectToDatabase()).rejects.toThrow(DatabaseConfigurationError);
    await expect(connectToDatabase()).rejects.toThrow(
      "Database configuration is missing or invalid. MONGODB_URI is required."
    );
  });
});
