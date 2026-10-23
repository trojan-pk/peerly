import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { isValidMongoUri } from "../src/lib/env-config.ts";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
if (existsSync(".env")) process.loadEnvFile(".env");

if (!isValidMongoUri(process.env.MONGODB_URI)) {
  console.error("A valid MONGODB_URI is required. No credential values are printed.");
  process.exit(1);
}

console.log("Running browser workflows on the configured cluster in a fresh temporary database.");
console.log("The temporary database is removed afterwards; the app database is never seeded or dropped.");
const child = spawn(process.execPath, ["node_modules/@playwright/test/cli.js", "test", "e2e/product.spec.ts"], {
  env: { ...process.env, PEERLY_E2E_USE_CONFIGURED_MONGO: "1" },
  stdio: "inherit",
});
child.on("error", () => {
  console.error("Could not start the browser test runner.");
  process.exitCode = 1;
});
child.on("exit", (code) => { process.exitCode = code ?? 1; });
