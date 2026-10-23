import { existsSync } from "node:fs";
import { MongoClient } from "mongodb";
import { isValidGoogleId, isValidGoogleSecret, isValidMongoUri, isValidSecret } from "../src/lib/env-config.ts";

// Match Next.js precedence without ever printing file contents.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
if (existsSync(".env")) process.loadEnvFile(".env");
const checks = {
  MONGODB_URI: isValidMongoUri(process.env.MONGODB_URI),
  AUTH_SECRET: isValidSecret(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET),
  AUTH_GOOGLE_ID: isValidGoogleId(process.env.AUTH_GOOGLE_ID),
  AUTH_GOOGLE_SECRET: isValidGoogleSecret(process.env.AUTH_GOOGLE_SECRET),
  AUTH_URL: (() => { try { return ["http:", "https:"].includes(new URL(process.env.AUTH_URL).protocol); } catch { return false; } })(),
};
for (const [name, valid] of Object.entries(checks)) console.log(`${name}: ${valid ? "set" : "missing or invalid"}`);
console.log("Values are never printed. Google credentials still require a real browser sign-in to verify.");
if (Object.values(checks).some((valid) => !valid)) process.exitCode = 1;
if (process.argv.includes("--connect") && checks.MONGODB_URI) {
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
  try {
    await client.connect();
    await client.db().command({ ping: 1 });
    console.log("MongoDB: connection and ping passed.");
  } catch {
    console.error("MongoDB: connection failed. Check database user/password, network access, URI and internet connection.");
    process.exitCode = 1;
  } finally { await client.close(); }
}
