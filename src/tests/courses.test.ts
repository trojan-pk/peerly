import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { User } from "@/models/User";
import { Course, EmailVerification, University } from "@/models/Course";
import { StudyRequest } from "@/models/StudyRequest";
import { Resource } from "@/models/Resource";
import { emailMatchesDomains, normalizeCourseCode, normalizeDomain, normalizeEmail } from "@/lib/course-rules";
import { calculatePeerMatchScore } from "@/lib/peer-matching";
import { queryPeers } from "@/lib/peers";
import { getPublicPeerReviews } from "@/lib/study-requests";
import {
  addCourseAction, adminCreateUniversityAction, adminMergeCoursesAction, adminSetCourseHiddenAction, adminUpdateUniversityAction,
  confirmVerificationCodeAction, saveMyCoursesAction, sendVerificationCodeAction, getCoursesForUniversity,
} from "@/app/actions/courses";
import { createStudyRequest } from "@/app/dashboard/actions";
import { createResource } from "@/app/resources/actions";
import { listCoursesWithHelpers, MAX_VERIFICATION_ATTEMPTS } from "@/lib/courses";
import * as authGuards from "@/lib/auth-guards";
import { ensureDatabaseIndexes } from "@/lib/db";
import { resetRateLimitsForTesting } from "@/lib/rate-limit";
import { toPublicProfile } from "@/models/User";

describe("course and domain rules (pure)", () => {
  it.each([["cs 101", "CS-101"], ["Cs-101", "CS-101"], ["cs_101", "CS-101"], ["math202l", "MATH-202L"], ["  EE 2301 ", "EE-2301"], ["phy.101", "PHY-101"]])("normalises %s → %s", (raw, code) => {
    expect(normalizeCourseCode(raw)).toBe(code);
  });
  it.each(["", "101", "C 101", "COMPUTING 101", "CS", "CS-1", "CS-12345", "CS-101; drop", 42])("rejects %s", (raw) => {
    expect(normalizeCourseCode(raw as string)).toBeNull();
  });
  it("validates domains and emails", () => {
    expect(normalizeDomain("@NU.edu.PK")).toBe("nu.edu.pk");
    expect(normalizeDomain("nu")).toBeNull();
    expect(normalizeDomain("nu..edu")).toBeNull();
    expect(normalizeEmail("Laila@Student.NU.edu.pk ")).toBe("laila@student.nu.edu.pk");
    expect(normalizeEmail("not an email")).toBeNull();
  });
  it("matches domains and subdomains but not look-alikes", () => {
    const allowed = ["nu.edu.pk"];
    expect(emailMatchesDomains("a@nu.edu.pk", allowed)).toBe(true);
    expect(emailMatchesDomains("a@lhr.nu.edu.pk", allowed)).toBe(true);
    expect(emailMatchesDomains("a@fakenu.edu.pk", allowed)).toBe(false);
    expect(emailMatchesDomains("a@nu.edu.pk.evil.com", allowed)).toBe(false);
    expect(emailMatchesDomains("a@gmail.com", allowed)).toBe(false);
  });
  it("scores a course match like an exact topic match and keeps legacy topic scoring", () => {
    const peer = { topics: ["Recursion"], subjects: ["CS"], mode: "both", averageRating: 0, reviewCount: 0, hasFastReplyBadge: false, courses: ["c1"], courseCodes: ["CS-101"] };
    expect(calculatePeerMatchScore(peer, { course: "c1" }).breakdown).toMatchObject({ topicPoints: 50, topicMatchReason: "Helps with this course", courseMatched: true });
    expect(calculatePeerMatchScore(peer, { q: "cs 101" }).breakdown.topicPoints).toBe(50);
    expect(calculatePeerMatchScore(peer, { course: "c2" }).breakdown).toMatchObject({ topicPoints: 0, courseMatched: false });
    const legacy = { topics: ["Recursion"], subjects: [], mode: "both", averageRating: 0, reviewCount: 0, hasFastReplyBadge: false };
    expect(calculatePeerMatchScore(legacy, { topic: "recursion" }).breakdown).toMatchObject({ topicPoints: 50, topicMatchReason: "Exact topic match" });
    expect(calculatePeerMatchScore(legacy, { course: "c1" }).breakdown.topicPoints).toBe(0);
  });
});

describe("universities, courses and university email verification (MongoDB integration)", () => {
  let server: MongoMemoryServer;
  let admin: any, sara: any, omar: any, laila: any;
  let uni: any;

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    process.env.MONGODB_URI = server.getUri();
    await mongoose.connect(server.getUri());
    await ensureDatabaseIndexes();
  });
  afterAll(async () => { await mongoose.disconnect(); await server.stop(); });
  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    await resetRateLimitsForTesting();
    await Promise.all([User.deleteMany({}), University.deleteMany({}), Course.deleteMany({}), EmailVerification.deleteMany({}), StudyRequest.deleteMany({}), Resource.deleteMany({})]);
    const base = { role: "student" as const, isProfileComplete: true, mode: "both" as const, availability: "Evenings", university: "FAST", subjects: ["Computer Science"] };
    admin = await User.create({ ...base, googleId: "a", email: "admin@uni.edu", name: "Amina Admin", topics: ["Admin"] });
    sara = await User.create({ ...base, googleId: "s", email: "sara@gmail.com", name: "Sara Khan", topics: ["Recursion"], contact: { whatsapp: "+923001112223", preferredMethod: "whatsapp" } });
    omar = await User.create({ ...base, googleId: "o", email: "omar@gmail.com", name: "Omar Ali", topics: ["Recursion"] });
    laila = await User.create({ ...base, googleId: "l", email: "laila@gmail.com", name: "Laila", topics: ["Physics"] });
    uni = await University.create({ name: "FAST-NU", slug: "fast-nu", domains: ["nu.edu.pk"] });
  });
  afterEach(() => vi.unstubAllEnvs());

  const as = (user: any, isAdmin = false) => {
    vi.spyOn(authGuards, "requireAuth").mockResolvedValue({ user, session: {} as any, isAdmin });
    vi.spyOn(authGuards, "requireAdmin").mockImplementation(async () => { if (!isAdmin) throw new authGuards.ForbiddenError(); return { user, session: {} as any, isAdmin }; });
  };
  const fresh = async (user: any) => User.findById(user._id);

  describe("catalogue", () => {
    it("normalises and de-duplicates student-added courses per university", async () => {
      as(sara);
      const first = await addCourseAction({ universityId: String(uni._id), code: "cs 101", title: "Programming Fundamentals" });
      expect(first).toMatchObject({ success: true, data: { code: "CS-101" } });
      const again = await addCourseAction({ universityId: String(uni._id), code: "CS-101" });
      expect(again.data?.id).toBe(first.data?.id);
      const other = await University.create({ name: "LUMS", slug: "lums", domains: ["lums.edu.pk"] });
      expect((await addCourseAction({ universityId: String(other._id), code: "CS101" })).data?.id).not.toBe(first.data?.id);
      expect(await Course.countDocuments()).toBe(2);
      expect((await addCourseAction({ universityId: String(uni._id), code: "hello" })).errors?.code).toBeTruthy();
      const [a, b] = await Promise.all([addCourseAction({ universityId: String(uni._id), code: "MATH 202" }), addCourseAction({ universityId: String(uni._id), code: "math-202" })]);
      expect(a.data?.id).toBe(b.data?.id);
    });

    it("rate-limits course creation", async () => {
      as(sara);
      for (let i = 0; i < 10; i++) expect((await addCourseAction({ universityId: String(uni._id), code: `CS ${100 + i}` })).success).toBe(true);
      expect((await addCourseAction({ universityId: String(uni._id), code: "CS 999" })).success).toBe(false);
    });

    it("saves courses only from the chosen university and mirrors its name", async () => {
      as(sara);
      const cs = (await addCourseAction({ universityId: String(uni._id), code: "CS-101" })).data!;
      const other = await University.create({ name: "LUMS", slug: "lums", domains: ["lums.edu.pk"] });
      const foreign = (await addCourseAction({ universityId: String(other._id), code: "EE-201" })).data!;
      expect((await saveMyCoursesAction({ universityId: String(uni._id), courseIds: [cs.id, foreign.id] })).success).toBe(false);
      expect((await saveMyCoursesAction({ universityId: null, courseIds: [cs.id] })).success).toBe(false);
      expect(await saveMyCoursesAction({ universityId: String(uni._id), courseIds: [cs.id] })).toMatchObject({ success: true, data: { courseCodes: ["CS-101"] } });
      const me = await fresh(sara);
      expect(me?.university).toBe("FAST-NU");
      expect(me?.courseCodes).toEqual(["CS-101"]);
      expect((await saveMyCoursesAction({ universityId: String(uni._id), courseIds: Array.from({ length: 13 }, () => cs.id) })).success).toBe(false);
    });

    it("restricts university and course management to admins", async () => {
      as(sara);
      expect((await adminCreateUniversityAction({ name: "Fake", domains: "fake.edu" })).success).toBe(false);
      expect((await adminUpdateUniversityAction({ universityId: String(uni._id), domains: "gmail.com" })).success).toBe(false);
      expect(await University.countDocuments()).toBe(1);
      expect((await University.findById(uni._id).lean())?.domains).toEqual(["nu.edu.pk"]);

      as(admin, true);
      expect((await adminCreateUniversityAction({ name: "LUMS", domains: "lums.edu.pk, @SBASSE.lums.edu.pk" })).data?.domains).toEqual(["lums.edu.pk", "sbasse.lums.edu.pk"]);
      expect((await adminCreateUniversityAction({ name: "LUMS", domains: "x.edu" })).errors?.name).toBeTruthy();
      expect((await adminCreateUniversityAction({ name: "Bad", domains: "not a domain" })).errors?.domains).toBeTruthy();
      expect((await adminUpdateUniversityAction({ universityId: String(uni._id), isHidden: true })).success).toBe(true);
      as(sara);
      expect((await getCoursesForUniversity(String(uni._id))).success).toBe(true);
      expect((await addCourseAction({ universityId: String(uni._id), code: "CS-101" })).success).toBe(false);
    });

    it("hides and merges duplicate courses, moving helpers, requests and resources", async () => {
      as(sara);
      const a = (await addCourseAction({ universityId: String(uni._id), code: "CS-101" })).data!;
      const b = (await addCourseAction({ universityId: String(uni._id), code: "CS-110", title: "Intro to Computing" })).data!;
      await saveMyCoursesAction({ universityId: String(uni._id), courseIds: [a.id, b.id] });
      as(omar);
      await saveMyCoursesAction({ universityId: String(uni._id), courseIds: [a.id] });
      await StudyRequest.create({ learner: laila._id, peer: omar._id, topic: "Loops", normalizedTopic: "loops", problemDescription: "How do nested loops work here?", mode: "online", course: a.id, courseCode: "CS-101" });
      await Resource.create({ owner: omar._id, title: "Loops", description: "Notes on loops and arrays.", topic: "Loops", normalizedTopic: "loops", url: "https://example.org/x", course: a.id, courseCode: "CS-101" });

      as(admin, true);
      expect((await adminMergeCoursesAction({ sourceId: a.id, targetId: a.id })).success).toBe(false);
      expect((await adminMergeCoursesAction({ sourceId: a.id, targetId: b.id })).success).toBe(true);
      expect((await fresh(sara))?.courseCodes.sort()).toEqual(["CS-110"]);
      expect((await fresh(sara))?.courses.map(String)).toEqual([b.id]);
      expect((await fresh(omar))?.courseCodes).toEqual(["CS-110"]);
      expect((await StudyRequest.findOne({}).lean())?.courseCode).toBe("CS-110");
      expect((await Resource.findOne({}).lean())?.courseCode).toBe("CS-110");
      expect((await Course.findById(a.id).lean())).toMatchObject({ isHidden: true, mergedInto: new mongoose.Types.ObjectId(b.id) });
      // A merged code now resolves to its target when added again.
      as(laila);
      expect((await addCourseAction({ universityId: String(uni._id), code: "cs101" })).data?.id).toBe(b.id);

      as(admin, true);
      expect((await adminSetCourseHiddenAction({ courseId: b.id, isHidden: true })).success).toBe(true);
      expect(await listCoursesWithHelpers()).toEqual([]);
    });
  });

  describe("course search and request/resource wiring", () => {
    async function setup() {
      as(sara);
      const cs = (await addCourseAction({ universityId: String(uni._id), code: "CS-101" })).data!;
      await saveMyCoursesAction({ universityId: String(uni._id), courseIds: [cs.id] });
      return cs;
    }

    it("ranks course helpers first and filters by course", async () => {
      const cs = await setup();
      const filtered = await queryPeers({ course: cs.id });
      expect(filtered.state).toBe("success");
      if (filtered.state === "success") {
        expect(filtered.peers.map((p) => p.name)).toEqual(["Sara Khan"]);
        expect(filtered.peers[0].matchBreakdown?.topicMatchReason).toBe("Helps with this course");
      }
      const byCode = await queryPeers({ q: "cs 101" });
      if (byCode.state !== "success") throw new Error(byCode.state);
      expect(byCode.peers[0].name).toBe("Sara Khan");
      expect(byCode.peers[0].courseCodes).toEqual(["CS-101"]);
      // Legacy free-text topics still match.
      const legacy = await queryPeers({ topic: "Recursion" });
      if (legacy.state !== "success") throw new Error(legacy.state);
      expect(legacy.peers.map((p) => p.name).sort()).toEqual(["Omar Ali", "Sara Khan"]);
      expect((await listCoursesWithHelpers()).map((c) => c.code)).toEqual(["CS-101"]);
    });

    it("only accepts a request course that the helper lists", async () => {
      const cs = await setup();
      as(laila);
      const other = (await addCourseAction({ universityId: String(uni._id), code: "EE-201" })).data!;
      const base = { peerId: String(sara._id), topic: "Recursion", problemDescription: "My recursion never reaches the base case.", mode: "online" };
      expect((await createStudyRequest({ ...base, course: other.id })).success).toBe(false);
      const ok = await createStudyRequest({ ...base, course: cs.id });
      expect(ok.success).toBe(true);
      expect((await StudyRequest.findById(ok.requestId).lean())?.courseCode).toBe("CS-101");
      expect((await createStudyRequest({ ...base, topic: "Other", course: "" })).success).toBe(true);
    });

    it("only lets owners tag resources with their own courses", async () => {
      const cs = await setup();
      const base = { title: "Recursion notes", description: "Stack diagrams for recursion problems.", topic: "Recursion", url: "https://example.org/notes" };
      as(laila);
      expect((await createResource({ ...base, course: cs.id })).success).toBe(false);
      as(await fresh(sara));
      const ok = await createResource({ ...base, course: cs.id });
      expect(ok.success).toBe(true);
      expect((await Resource.findById(ok.resourceId).lean())?.courseCode).toBe("CS-101");
    });
  });

  describe("university email verification", () => {
    function configureEmail() {
      vi.stubEnv("RESEND_API_KEY", "re_test_0123456789abcdefgh");
      vi.stubEnv("EMAIL_FROM", "Peerly <alerts@peerly.app>");
      return vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    }
    function sentCode(fetchSpy: ReturnType<typeof configureEmail>, index = -1): string {
      const body = JSON.parse(String((fetchSpy.mock.calls.at(index)![1] as RequestInit).body));
      return body.text.match(/is (\d{6})\./)[1];
    }

    it("is unavailable without email configuration", async () => {
      as(sara);
      expect((await sendVerificationCodeAction("sara@nu.edu.pk")).message).toMatch(/isn't available/);
    });

    it("rejects addresses outside allowlisted university domains", async () => {
      configureEmail();
      as(sara);
      for (const email of ["sara@gmail.com", "sara@fakenu.edu.pk", "sara@nu.edu.pk.evil.com", "nope"]) {
        expect((await sendVerificationCodeAction(email)).success).toBe(false);
      }
      expect(await EmailVerification.countDocuments()).toBe(0);
    });

    it("verifies with the emailed code, shows a public badge but never the address", async () => {
      const fetchSpy = configureEmail();
      as(sara);
      expect((await sendVerificationCodeAction("Sara@LHR.nu.edu.pk")).success).toBe(true);
      const stored = await EmailVerification.findOne({}).select("+codeHash +salt").lean();
      const code = sentCode(fetchSpy);
      expect(stored?.codeHash).toMatch(/^[a-f0-9]{64}$/);
      expect(JSON.stringify(stored)).not.toContain(code);
      expect((await EmailVerification.findOne({}).lean()) as unknown as Record<string, unknown>).not.toHaveProperty("codeHash");

      expect(await confirmVerificationCodeAction(code)).toMatchObject({ success: true, data: { universityName: "FAST-NU" } });
      const me = await User.findById(sara._id).select("+universityEmail").lean();
      expect(me).toMatchObject({ universityEmail: "sara@lhr.nu.edu.pk", verifiedUniversityName: "FAST-NU" });
      const publicProfile = toPublicProfile((await User.findById(sara._id).lean())!);
      expect(publicProfile.verifiedUniversityName).toBe("FAST-NU");
      expect(JSON.stringify(publicProfile)).not.toContain("sara@lhr.nu.edu.pk");
      const listed = await queryPeers({ topic: "Recursion" });
      expect(JSON.stringify(listed)).not.toContain("nu.edu.pk");
      expect(JSON.stringify(await getPublicPeerReviews(String(sara._id)))).not.toContain("nu.edu.pk");

      // Replay: the same code cannot be used again.
      expect((await confirmVerificationCodeAction(code)).success).toBe(false);
    });

    it("locks the code after five wrong attempts, even with parallel guesses", async () => {
      const fetchSpy = configureEmail();
      as(sara);
      await sendVerificationCodeAction("sara@nu.edu.pk");
      const code = sentCode(fetchSpy);
      const wrong = code === "000000" ? "111111" : "000000";
      const results = await Promise.all(Array.from({ length: 8 }, () => confirmVerificationCodeAction(wrong)));
      expect(results.every((r) => !r.success)).toBe(true);
      expect((await EmailVerification.findOne({}).lean())?.attempts).toBe(MAX_VERIFICATION_ATTEMPTS);
      expect((await confirmVerificationCodeAction(code)).message).toMatch(/too many|expired/i);
      expect((await User.findById(sara._id).lean())?.universityEmailVerifiedAt).toBeNull();
    });

    it("rejects expired codes", async () => {
      const fetchSpy = configureEmail();
      as(sara);
      await sendVerificationCodeAction("sara@nu.edu.pk");
      await EmailVerification.updateOne({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
      expect((await confirmVerificationCodeAction(sentCode(fetchSpy))).message).toMatch(/expired/);
    });

    it("allows one account per university address and rate-limits sending", async () => {
      const fetchSpy = configureEmail();
      as(sara);
      await sendVerificationCodeAction("shared@nu.edu.pk");
      await confirmVerificationCodeAction(sentCode(fetchSpy));
      as(omar);
      expect((await sendVerificationCodeAction("shared@nu.edu.pk")).message).toMatch(/another account/);
      for (let i = 0; i < 3; i++) expect((await sendVerificationCodeAction(`omar${i}@nu.edu.pk`)).success).toBe(true);
      expect((await sendVerificationCodeAction("omar9@nu.edu.pk")).message).toMatch(/Too many/);
    });

    it("does not log codes or hashes", async () => {
      const fetchSpy = configureEmail();
      const logs: string[] = [];
      for (const method of ["log", "error", "warn", "info"] as const) vi.spyOn(console, method).mockImplementation((...args: unknown[]) => { logs.push(args.map(String).join(" ")); });
      as(sara);
      await sendVerificationCodeAction("sara@nu.edu.pk");
      const code = sentCode(fetchSpy);
      await confirmVerificationCodeAction("999999");
      await confirmVerificationCodeAction(code);
      const stored = await EmailVerification.find({}).select("+codeHash").lean();
      expect(logs.join("\n")).not.toContain(code);
      for (const s of stored) expect(logs.join("\n")).not.toContain(s.codeHash);
    });
  });
});
