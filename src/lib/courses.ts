import mongoose from "mongoose";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { connectToDatabase, ensureDatabaseIndexes } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { Course, EmailVerification, University } from "@/models/Course";
import { User, type IUserDocument } from "@/models/User";
import { StudyRequest } from "@/models/StudyRequest";
import { Resource } from "@/models/Resource";
import { emailMatchesDomains, normalizeCourseCode, normalizeDomain, normalizeEmail, slugify } from "@/lib/course-rules";
import { escapeHtml, isEmailConfigured, sendEmail } from "@/lib/email";

export type ServiceResult<T = undefined> = { ok: true; value: T; message?: string } | { ok: false; message: string; field?: string };
const fail = (message: string, field?: string): ServiceResult<never> => ({ ok: false, message, field });

export const MAX_USER_COURSES = 12;
export const VERIFICATION_TTL_MS = 10 * 60 * 1000;
export const MAX_VERIFICATION_ATTEMPTS = 5;

export interface UniversityDTO { id: string; name: string; domains: string[]; isHidden: boolean; courseCount?: number }
export interface CourseDTO { id: string; universityId: string; code: string; title: string; isHidden: boolean; helperCount?: number }

const oid = (v: unknown) => (typeof v === "string" && mongoose.Types.ObjectId.isValid(v) ? new mongoose.Types.ObjectId(v) : null);

function toUniversityDTO(u: { _id: unknown; name: string; domains?: string[]; isHidden?: boolean }): UniversityDTO {
  return { id: String(u._id), name: u.name, domains: u.domains ?? [], isHidden: Boolean(u.isHidden) };
}
function toCourseDTO(c: { _id: unknown; university: unknown; code: string; title?: string; isHidden?: boolean }): CourseDTO {
  return { id: String(c._id), universityId: String(c.university), code: c.code, title: c.title ?? "", isHidden: Boolean(c.isHidden) };
}

// ---------- Catalogue reads ----------

export async function listUniversities(options: { includeHidden?: boolean } = {}): Promise<UniversityDTO[]> {
  await connectToDatabase();
  const rows = await University.find(options.includeHidden ? {} : { isHidden: false }).sort({ name: 1 }).lean();
  if (!options.includeHidden) return rows.map(toUniversityDTO);
  const counts = await Course.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([{ $match: { mergedInto: null } }, { $group: { _id: "$university", n: { $sum: 1 } } }]);
  const byId = new Map(counts.map((c) => [String(c._id), c.n]));
  return rows.map((u) => ({ ...toUniversityDTO(u), courseCount: byId.get(String(u._id)) ?? 0 }));
}

export async function listCourses(universityId: unknown, options: { includeHidden?: boolean } = {}): Promise<CourseDTO[]> {
  const id = oid(universityId);
  if (!id) return [];
  await connectToDatabase();
  const filter: Record<string, unknown> = { university: id, mergedInto: null };
  if (!options.includeHidden) filter.isHidden = false;
  const rows = await Course.find(filter).sort({ code: 1 }).limit(500).lean();
  if (!options.includeHidden) return rows.map(toCourseDTO);
  const counts = await User.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([
    { $match: { courses: { $in: rows.map((r) => r._id) } } }, { $unwind: "$courses" }, { $group: { _id: "$courses", n: { $sum: 1 } } },
  ]);
  const byId = new Map(counts.map((c) => [String(c._id), c.n]));
  return rows.map((c) => ({ ...toCourseDTO(c), helperCount: byId.get(String(c._id)) ?? 0 }));
}

/** Courses shown in peer filters: visible courses that at least one discoverable helper lists. */
export async function listCoursesWithHelpers(): Promise<Array<CourseDTO & { universityName: string }>> {
  await connectToDatabase();
  const ids: mongoose.Types.ObjectId[] = await User.distinct("courses", { isProfileComplete: true, "moderation.isHidden": { $ne: true } });
  if (ids.length === 0) return [];
  const rows = await Course.find({ _id: { $in: ids }, isHidden: false, mergedInto: null }).populate("university", "name isHidden").sort({ code: 1 }).limit(300).lean();
  return rows
    .filter((c) => !(c.university as unknown as { isHidden?: boolean })?.isHidden)
    .map((c) => ({ ...toCourseDTO({ ...c, university: (c.university as unknown as { _id: unknown })._id }), universityName: (c.university as unknown as { name: string }).name }));
}

// ---------- Member writes ----------

/** Adds a course to a university's catalogue, or returns the existing one with that code. */
export async function addCourse(user: IUserDocument, input: { universityId?: unknown; code?: unknown; title?: unknown }): Promise<ServiceResult<CourseDTO>> {
  const universityId = oid(input.universityId);
  if (!universityId) return fail("Choose a university first.", "universityId");
  const code = normalizeCourseCode(input.code);
  if (!code) return fail("Use a course code like CS-101 or MATH 202.", "code");
  const title = typeof input.title === "string" ? input.title.trim().slice(0, 120) : "";
  await ensureDatabaseIndexes();
  const university = await University.findOne({ _id: universityId, isHidden: false }).lean();
  if (!university) return fail("That university isn't available.", "universityId");
  const existing = await Course.findOne({ university: universityId, code }).lean();
  if (existing) {
    const target = existing.mergedInto ? await Course.findById(existing.mergedInto).lean() : existing;
    if (!target || target.isHidden) return fail("That course isn't available.", "code");
    return { ok: true, value: toCourseDTO(target), message: `${target.code} is already in the catalogue.` };
  }
  const limit = await checkRateLimit(`course_add:${user._id}`, 10, 60 * 60 * 1000);
  if (!limit.allowed) return fail("You've added several courses recently. Please try again later.");
  try {
    const created = await Course.create({ university: universityId, code, title, createdBy: user._id });
    return { ok: true, value: toCourseDTO(created), message: `${code} added.` };
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      const raced = await Course.findOne({ university: universityId, code }).lean();
      if (raced) return { ok: true, value: toCourseDTO(raced) };
    }
    throw error;
  }
}

/** Sets the caller's catalogue university and the courses they help with. */
export async function setMyCourses(user: IUserDocument, input: { universityId?: unknown; courseIds?: unknown }): Promise<ServiceResult<{ courseCodes: string[] }>> {
  const universityId = input.universityId === null || input.universityId === "" ? null : oid(input.universityId);
  if (input.universityId && !universityId) return fail("Invalid university.", "universityId");
  const rawIds = Array.isArray(input.courseIds) ? input.courseIds : [];
  if (rawIds.length > MAX_USER_COURSES) return fail(`Choose up to ${MAX_USER_COURSES} courses.`, "courseIds");
  const ids = [...new Set(rawIds.map((v) => oid(v)).filter((v): v is mongoose.Types.ObjectId => Boolean(v)).map(String))].map((v) => new mongoose.Types.ObjectId(v));
  if (ids.length !== rawIds.length) return fail("One of the selected courses is invalid.", "courseIds");
  await connectToDatabase();
  let universityName: string | null = null;
  if (universityId) {
    const university = await University.findOne({ _id: universityId, isHidden: false }).lean();
    if (!university) return fail("That university isn't available.", "universityId");
    universityName = university.name;
  }
  if (ids.length > 0 && !universityId) return fail("Choose your university before adding courses.", "universityId");
  const courses = ids.length ? await Course.find({ _id: { $in: ids }, university: universityId, isHidden: false, mergedInto: null }).sort({ code: 1 }).lean() : [];
  if (courses.length !== ids.length) return fail("Courses must belong to your university and be available.", "courseIds");
  const set: Record<string, unknown> = { universityRef: universityId, courses: courses.map((c) => c._id), courseCodes: courses.map((c) => c.code) };
  if (universityName) set.university = universityName;
  await User.updateOne({ _id: user._id }, { $set: set });
  return { ok: true, value: { courseCodes: courses.map((c) => c.code) }, message: "Courses saved." };
}

// ---------- Admin ----------

export async function adminCreateUniversity(admin: IUserDocument, input: { name?: unknown; domains?: unknown }): Promise<ServiceResult<UniversityDTO>> {
  const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
  if (name.length < 2 || name.length > 120) return fail("Enter the university's name (2–120 characters).", "name");
  const domains = parseDomains(input.domains);
  if (!domains.ok) return domains;
  const slug = slugify(name);
  if (!slug) return fail("Enter a name with letters or numbers.", "name");
  await ensureDatabaseIndexes();
  try {
    const created = await University.create({ name, slug, domains: domains.value, createdBy: admin._id });
    return { ok: true, value: toUniversityDTO(created), message: `${name} added.` };
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return fail("A university with this name already exists.", "name");
    throw error;
  }
}

export async function adminUpdateUniversity(input: { universityId?: unknown; domains?: unknown; isHidden?: unknown }): Promise<ServiceResult<UniversityDTO>> {
  const id = oid(input.universityId);
  if (!id) return fail("Invalid university.");
  const set: Record<string, unknown> = {};
  if (input.domains !== undefined) {
    const domains = parseDomains(input.domains);
    if (!domains.ok) return domains;
    set.domains = domains.value;
  }
  if (input.isHidden !== undefined) {
    if (typeof input.isHidden !== "boolean") return fail("Invalid visibility.");
    set.isHidden = input.isHidden;
  }
  await connectToDatabase();
  const updated = await University.findByIdAndUpdate(id, { $set: set }, { returnDocument: "after" }).lean();
  if (!updated) return fail("University not found.");
  return { ok: true, value: toUniversityDTO(updated), message: "University updated." };
}

function parseDomains(raw: unknown): ServiceResult<string[]> {
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[\s,]+/) : [];
  const cleaned = list.filter((d) => typeof d === "string" && d.trim()).map((d) => normalizeDomain(d));
  if (cleaned.some((d) => d === null)) return fail("Enter domains like nu.edu.pk, separated by commas.", "domains");
  const unique = [...new Set(cleaned as string[])];
  if (unique.length === 0) return fail("Add at least one email domain.", "domains");
  if (unique.length > 10) return fail("Add at most 10 domains.", "domains");
  return { ok: true, value: unique };
}

export async function adminSetCourseHidden(input: { courseId?: unknown; isHidden?: unknown }): Promise<ServiceResult<CourseDTO>> {
  const id = oid(input.courseId);
  if (!id || typeof input.isHidden !== "boolean") return fail("Invalid course.");
  await connectToDatabase();
  const updated = await Course.findByIdAndUpdate(id, { $set: { isHidden: input.isHidden } }, { returnDocument: "after" }).lean();
  if (!updated) return fail("Course not found.");
  return { ok: true, value: toCourseDTO(updated), message: input.isHidden ? `${updated.code} hidden.` : `${updated.code} restored.` };
}

/**
 * Merges a duplicate course into another course at the same university. Helpers,
 * requests and resources move to the target; the source stays as a redirect.
 */
export async function adminMergeCourses(input: { sourceId?: unknown; targetId?: unknown }): Promise<ServiceResult<CourseDTO>> {
  const sourceId = oid(input.sourceId);
  const targetId = oid(input.targetId);
  if (!sourceId || !targetId || sourceId.equals(targetId)) return fail("Choose two different courses.");
  await connectToDatabase();
  const [source, target] = await Promise.all([Course.findById(sourceId).lean(), Course.findById(targetId).lean()]);
  if (!source || !target || source.mergedInto || target.mergedInto) return fail("Both courses must exist and not already be merged.");
  if (!source.university.equals(target.university)) return fail("Courses can only be merged within one university.");
  await User.updateMany({ courses: sourceId }, [
    { $set: {
      courses: { $setUnion: [{ $filter: { input: "$courses", cond: { $ne: ["$$this", sourceId] } } }, [targetId]] },
      courseCodes: { $setUnion: [{ $filter: { input: "$courseCodes", cond: { $ne: ["$$this", source.code] } } }, [target.code]] },
    } },
  ], { updatePipeline: true });
  await StudyRequest.updateMany({ course: sourceId }, { $set: { course: targetId, courseCode: target.code } });
  await Resource.updateMany({ course: sourceId }, { $set: { course: targetId, courseCode: target.code } });
  await Course.updateOne({ _id: sourceId }, { $set: { mergedInto: targetId, isHidden: true } });
  return { ok: true, value: toCourseDTO(target), message: `${source.code} merged into ${target.code}.` };
}

// ---------- University email verification ----------

function hashCode(code: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

export interface VerificationStatus {
  available: boolean;
  verified: { universityName: string; email: string; verifiedAt: string } | null;
  pending: { email: string; expiresAt: string } | null;
}

export async function getVerificationStatus(user: IUserDocument): Promise<VerificationStatus> {
  await connectToDatabase();
  const [me, pending] = await Promise.all([
    User.findById(user._id).select("+universityEmail universityEmailVerifiedAt verifiedUniversityName").lean(),
    EmailVerification.findOne({ user: user._id, expiresAt: { $gt: new Date() } }).lean(),
  ]);
  return {
    available: isEmailConfigured(),
    verified: me?.universityEmailVerifiedAt && me.universityEmail
      ? { universityName: me.verifiedUniversityName, email: me.universityEmail, verifiedAt: me.universityEmailVerifiedAt.toISOString() }
      : null,
    pending: pending ? { email: pending.email, expiresAt: pending.expiresAt.toISOString() } : null,
  };
}

/** Emails a 6-digit code to an address on an allowlisted university domain. */
export async function startUniversityEmailVerification(user: IUserDocument, rawEmail: unknown): Promise<ServiceResult<{ email: string; expiresAt: string }>> {
  if (!isEmailConfigured()) return fail("University email verification isn't available on this server yet.");
  const email = normalizeEmail(rawEmail);
  if (!email) return fail("Enter a valid email address.", "email");
  await ensureDatabaseIndexes();
  const host = email.slice(email.lastIndexOf("@") + 1);
  const candidates = await University.find({ isHidden: false, domains: { $in: host.split(".").map((_, i, parts) => parts.slice(i).join(".")) } }).lean();
  const university = candidates.find((u) => emailMatchesDomains(email, u.domains));
  if (!university) return fail("That address isn't on a university domain Peerly recognises. Ask an admin to add your university.", "email");
  const takenBy = await User.findOne({ universityEmail: email, _id: { $ne: user._id } }).select("_id").lean();
  if (takenBy) return fail("That address is already verified on another account.", "email");

  const perUser = await checkRateLimit(`uni_verify_send:${user._id}`, 3, 10 * 60 * 1000);
  const perAddress = await checkRateLimit(`uni_verify_addr:${email}`, 5, 60 * 60 * 1000);
  if (!perUser.allowed || !perAddress.allowed) return fail(`Too many codes requested. Try again in ${Math.ceil(Math.max(perUser.retryAfterSeconds ?? 0, perAddress.retryAfterSeconds ?? 0) / 60) || 1} min.`);

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const salt = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);
  await EmailVerification.findOneAndUpdate(
    { user: user._id },
    { $set: { university: university._id, email, codeHash: hashCode(code, salt), salt, attempts: 0, expiresAt, createdAt: new Date() } },
    { upsert: true }
  );
  const sent = await sendEmail({
    to: email,
    subject: `Your Peerly verification code: ${code}`,
    text: `Your code to verify ${email} for ${university.name} on Peerly is ${code}.\n\nIt expires in 10 minutes. If you didn't request this, you can ignore this email.`,
    html: `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#141b2d;background:#f7f4ec;padding:24px"><div style="max-width:480px;margin:auto;background:#fffdf8;border:1px solid #dcd5c5;border-radius:12px;padding:24px"><p style="margin:0 0 8px;color:#4c5366">Peerly</p><p style="margin:0 0 16px">Your code to verify <strong>${escapeHtml(email)}</strong> for ${escapeHtml(university.name)}:</p><p style="font-size:32px;letter-spacing:6px;font-weight:bold;margin:0 0 16px">${code}</p><p style="margin:0;color:#4c5366;font-size:13px">It expires in 10 minutes. If you didn't request this, ignore this email.</p></div></body></html>`,
  });
  if (!sent.sent) {
    await EmailVerification.deleteOne({ user: user._id });
    return fail("We couldn't send the code right now. Please try again shortly.");
  }
  return { ok: true, value: { email, expiresAt: expiresAt.toISOString() }, message: `We sent a 6-digit code to ${email}.` };
}

/** Checks a code. Five wrong attempts or expiry invalidate it; a used code can't be reused. */
export async function confirmUniversityEmailVerification(user: IUserDocument, rawCode: unknown): Promise<ServiceResult<{ universityName: string }>> {
  const code = typeof rawCode === "string" ? rawCode.replace(/\s+/g, "") : "";
  if (!/^\d{6}$/.test(code)) return fail("Enter the 6-digit code from the email.", "code");
  await connectToDatabase();
  const limit = await checkRateLimit(`uni_verify_check:${user._id}`, 10, 10 * 60 * 1000);
  if (!limit.allowed) return fail("Too many attempts. Please wait a few minutes.");
  // Count the attempt atomically before comparing, so parallel guesses can't exceed the limit.
  const record = await EmailVerification.findOneAndUpdate(
    { user: user._id, expiresAt: { $gt: new Date() }, attempts: { $lt: MAX_VERIFICATION_ATTEMPTS } },
    { $inc: { attempts: 1 } },
    { returnDocument: "after" }
  ).select("+codeHash +salt").lean();
  if (!record) {
    const stale = await EmailVerification.exists({ user: user._id });
    return fail(stale ? "This code has expired or had too many wrong attempts. Request a new one." : "Request a code first.", "code");
  }
  const expected = Buffer.from(record.codeHash, "hex");
  const actual = Buffer.from(hashCode(code, record.salt), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    const left = MAX_VERIFICATION_ATTEMPTS - record.attempts;
    return fail(left > 0 ? `That code isn't right. ${left} ${left === 1 ? "attempt" : "attempts"} left.` : "Too many wrong attempts. Request a new code.", "code");
  }
  // Single use: only the request that deletes the record may apply the verification.
  const consumed = await EmailVerification.findOneAndDelete({ _id: record._id });
  if (!consumed) return fail("This code was already used. Request a new one.", "code");
  const university = await University.findById(record.university).lean();
  if (!university || university.isHidden || !emailMatchesDomains(record.email, university.domains)) return fail("That university is no longer available for verification.");
  try {
    await User.updateOne({ _id: user._id }, { $set: { universityEmail: record.email, universityEmailVerifiedAt: new Date(), verifiedUniversity: university._id, verifiedUniversityName: university.name } });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return fail("That address is already verified on another account.", "code");
    throw error;
  }
  return { ok: true, value: { universityName: university.name }, message: `University email verified for ${university.name}.` };
}

export async function removeUniversityEmail(user: IUserDocument): Promise<ServiceResult> {
  await connectToDatabase();
  await Promise.all([
    User.updateOne({ _id: user._id }, { $set: { universityEmail: null, universityEmailVerifiedAt: null, verifiedUniversity: null, verifiedUniversityName: "" } }),
    EmailVerification.deleteOne({ user: user._id }),
  ]);
  return { ok: true, value: undefined, message: "University email removed." };
}
