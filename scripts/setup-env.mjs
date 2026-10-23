import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const existing = [".env.local", ".env"].find((file) => existsSync(file));
if (existing) {
  console.log(`${existing} already exists. Existing credentials were preserved.`);
} else {
  const template = readFileSync(".env.example", "utf8");
  writeFileSync(".env.local", template.replace(/^AUTH_SECRET=.*$/m, `AUTH_SECRET=${randomBytes(32).toString("base64url")}`), { mode: 0o600 });
  console.log("Created ignored .env.local with a random AUTH_SECRET. Secret values were not printed.");
  console.log("Fill MONGODB_URI, AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET locally, then run npm run check:env -- --connect.");
}
