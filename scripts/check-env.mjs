import { existsSync } from "node:fs";
import { MongoClient } from "mongodb";
import { isValidGoogleId, isValidGoogleSecret, isValidMongoUri, isValidSecret } from "../src/lib/env-config.ts";
import { isValidEmailFrom, isValidResendKey } from "../src/lib/email.ts";

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
// Optional: email alerts. Missing values simply disable email; they never fail the check.
const emailKey = Boolean(process.env.RESEND_API_KEY?.trim());
const emailFrom = Boolean(process.env.EMAIL_FROM?.trim());
if (!emailKey && !emailFrom) console.log("Email alerts (optional): not configured — in-app notifications only.");
else {
  console.log(`RESEND_API_KEY (optional): ${isValidResendKey(process.env.RESEND_API_KEY) ? "set" : "invalid — email disabled"}`);
  console.log(`EMAIL_FROM (optional): ${isValidEmailFrom(process.env.EMAIL_FROM) ? "set" : "invalid — email disabled"}`);
}
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
