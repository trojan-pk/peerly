import { test as base, expect, type BrowserContext } from "@playwright/test";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, ObjectId } from "mongodb";
import { encode } from "next-auth/jwt";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";

const baseURL = "http://127.0.0.1:3101";
type Actor = "learner" | "helper" | "admin";
type App = {
  db: ReturnType<MongoClient["db"]>;
  ids: Record<Actor, string>;
  signIn: (context: BrowserContext, actor: Actor) => Promise<void>;
  /** Signs in as any user id already inserted into the test database. */
  signInUser: (context: BrowserContext, user: { id: string; email: string; name: string }) => Promise<void>;
};

// Test-only encrypted sessions exercise the real Auth.js session boundary and
// actual MongoDB writes. No login bypass or fixture data is added to the app.
export const test = base.extend<object, { app: App }>({
  app: [async ({}, runWithApp) => {
    const useConfiguredMongo = process.env.PEERLY_E2E_USE_CONFIGURED_MONGO === "1";
    if (useConfiguredMongo && !process.env.MONGODB_URI) {
      throw new Error("Configured MongoDB browser tests require MONGODB_URI.");
    }
    const mongo = useConfiguredMongo ? null : await MongoMemoryServer.create();
    const sourceUri = mongo?.getUri() ?? process.env.MONGODB_URI!;
    // Always use a fresh, unpredictable database. Never seed/drop the app database.
    const databaseName = `peerly_e2e_${randomBytes(12).toString("hex")}`;
    const testUri = sourceUri.replace(/^(mongodb(?:\+srv)?:\/\/[^/]+)(?:\/[^?]*)?/, `$1/${databaseName}`);
    const client = new MongoClient(testUri, { serverSelectionTimeoutMS: 10_000 });
    const db = client.db(databaseName);
    let child: ReturnType<typeof spawn> | undefined;
    try {
      await client.connect();
      const ids = { learner: new ObjectId().toHexString(), helper: new ObjectId().toHexString(), admin: new ObjectId().toHexString() };
      const names = { learner: "Laila Learner", helper: "Hamza Helper", admin: "Amina Admin" };
      const now = new Date();
      await db.collection("users").insertMany((Object.keys(ids) as Actor[]).map((actor) => ({
        _id: new ObjectId(ids[actor]), googleId: `e2e-${actor}`, email: `${actor}@peerly.example`,
        name: names[actor], role: actor === "admin" ? "admin" : "student",
        bio: "Student sharing useful coursework explanations.", university: "Test University", campus: "Main Library",
        topics: actor === "helper" ? ["C++ Sorting"] : ["Physics"], subjects: ["Computer Science"],
        mode: "both", pricingPreference: "free", availability: "Weekdays after 4 PM",
        isProfileComplete: true, image: "", reviewCount: 0, averageRating: 0,
        contact: { whatsapp: "+923001234567", meetingLink: "https://meet.google.com/test-room", preferredMethod: "whatsapp" },
        createdAt: now, updatedAt: now,
      })));
      const secret = randomBytes(32).toString("base64url");
      child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3101"], {
        env: { ...process.env, NODE_ENV: "production", MONGODB_URI: testUri, AUTH_SECRET: secret,
          AUTH_URL: baseURL, AUTH_TRUST_HOST: "true", AUTH_GOOGLE_ID: "e2e-client.apps.googleusercontent.com",
          AUTH_GOOGLE_SECRET: "e2e-private-client-value", ADMIN_EMAILS: "admin@peerly.example", PEERLY_UI_SHOWCASE: "1" },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let serverOutput = "";
      const capture = (chunk: Buffer) => { serverOutput = (serverOutput + chunk.toString()).slice(-12_000); };
      child.stdout!.on("data", capture);
      child.stderr!.on("data", capture);
      let ready = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if (child.exitCode !== null) throw new Error(`Test server exited: ${serverOutput}`);
        try { if ((await fetch(`${baseURL}/login`)).ok) { ready = true; break; } } catch { /* starting */ }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      if (!ready) throw new Error(`Test server failed to start: ${serverOutput}`);
      const issue = async (context: BrowserContext, claims: Record<string, unknown>) => {
        const token = await encode({ secret, salt: "authjs.session-token", token: claims });
        await context.addCookies([{ name: "authjs.session-token", value: token, url: baseURL, httpOnly: true, sameSite: "Lax" }]);
      };
      await runWithApp({ db, ids,
        signIn: (context, actor) => issue(context, {
          userId: ids[actor], sub: `e2e-${actor}`, email: `${actor}@peerly.example`, name: names[actor],
          role: actor === "admin" ? "admin" : "student", isProfileComplete: true,
        }),
        signInUser: (context, user) => issue(context, { userId: user.id, sub: `e2e-${user.id}`, email: user.email, name: user.name, role: "student", isProfileComplete: true }),
      });
    } finally {
      if (child && child.exitCode === null) {
        child.kill("SIGTERM");
        await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 5000))]);
        if (child.exitCode === null) child.kill("SIGKILL");
      }
      try {
        // databaseName is generated above, never supplied by an environment variable.
        await db.dropDatabase();
      } finally {
        await client.close();
        await mongo?.stop();
      }
    }
  }, { scope: "worker", auto: true, timeout: 120_000 }],
});
export { expect };
