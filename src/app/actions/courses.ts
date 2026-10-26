"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/auth-guards";
import { isDatabaseConfigured } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  addCourse, adminCreateUniversity, adminMergeCourses, adminSetCourseHidden, adminUpdateUniversity,
  confirmUniversityEmailVerification, listCourses, removeUniversityEmail, setMyCourses, startUniversityEmailVerification,
  type CourseDTO, type ServiceResult,
} from "@/lib/courses";

export interface CourseActionResult<T = undefined> {
  success: boolean;
  message?: string;
  errors?: Record<string, string>;
  data?: T;
}

function toResult<T>(result: ServiceResult<T>): CourseActionResult<T> {
  if (result.ok) return { success: true, message: result.message, data: result.value };
  return { success: false, message: result.message, errors: result.field ? { [result.field]: result.message } : undefined };
}

function refresh(...paths: string[]) {
  for (const path of paths) { try { revalidatePath(path); } catch { /* outside a request */ } }
}

async function member() {
  if (!isDatabaseConfigured()) throw new Error("unconfigured");
  return requireAuth();
}

async function guarded<T>(run: () => Promise<CourseActionResult<T>>, signedOut = "Sign in to continue."): Promise<CourseActionResult<T>> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof UnauthorizedError) return { success: false, message: signedOut };
    if (error instanceof ForbiddenError) return { success: false, message: "Administrator access is required." };
    console.error("[courses] action failed:", error instanceof Error ? error.message : "unknown");
    return { success: false, message: "Something went wrong. Please try again." };
  }
}

/** Visible courses for a university (signed-in members only). */
export async function getCoursesForUniversity(universityId: unknown): Promise<CourseActionResult<CourseDTO[]>> {
  return guarded(async () => {
    const context = await member();
    const limit = await checkRateLimit(`course_list:${context.user._id}`, 60, 60_000);
    if (!limit.allowed) return { success: false, message: "Please slow down." };
    return { success: true, data: await listCourses(universityId) };
  });
}

export async function addCourseAction(input: unknown): Promise<CourseActionResult<CourseDTO>> {
  return guarded(async () => {
    const context = await member();
    const body = (input ?? {}) as Record<string, unknown>;
    return toResult(await addCourse(context.user, { universityId: body.universityId, code: body.code, title: body.title }));
  });
}

export async function saveMyCoursesAction(input: unknown): Promise<CourseActionResult<{ courseCodes: string[] }>> {
  return guarded(async () => {
    const context = await member();
    const limit = await checkRateLimit(`course_save:${context.user._id}`, 10, 60_000);
    if (!limit.allowed) return { success: false, message: "Please wait a moment before saving again." };
    const body = (input ?? {}) as Record<string, unknown>;
    const result = toResult(await setMyCourses(context.user, { universityId: body.universityId, courseIds: body.courseIds }));
    if (result.success) refresh("/settings", "/peers", `/peers/${context.user._id}`);
    return result;
  });
}

export async function sendVerificationCodeAction(email: unknown): Promise<CourseActionResult<{ email: string; expiresAt: string }>> {
  return guarded(async () => {
    const context = await member();
    return toResult(await startUniversityEmailVerification(context.user, email));
  });
}

export async function confirmVerificationCodeAction(code: unknown): Promise<CourseActionResult<{ universityName: string }>> {
  return guarded(async () => {
    const context = await member();
    const result = toResult(await confirmUniversityEmailVerification(context.user, code));
    if (result.success) refresh("/settings", `/peers/${context.user._id}`, "/peers");
    return result;
  });
}

export async function removeUniversityEmailAction(): Promise<CourseActionResult> {
  return guarded(async () => {
    const context = await member();
    const result = toResult(await removeUniversityEmail(context.user));
    refresh("/settings", `/peers/${context.user._id}`);
    return result;
  });
}

// ---------- Admin (ADMIN_EMAILS checked on every call) ----------

async function admin() {
  if (!isDatabaseConfigured()) throw new Error("unconfigured");
  const context = await requireAdmin();
  const limit = await checkRateLimit(`admin_catalog:${context.user._id}`, 60, 60_000);
  if (!limit.allowed) throw new Error("rate limited");
  return context;
}

export async function adminCreateUniversityAction(input: unknown) {
  return guarded(async () => {
    const context = await admin();
    const body = (input ?? {}) as Record<string, unknown>;
    const result = toResult(await adminCreateUniversity(context.user, { name: body.name, domains: body.domains }));
    if (result.success) refresh("/admin/universities");
    return result;
  });
}

export async function adminUpdateUniversityAction(input: unknown) {
  return guarded(async () => {
    await admin();
    const body = (input ?? {}) as Record<string, unknown>;
    const result = toResult(await adminUpdateUniversity({ universityId: body.universityId, domains: body.domains, isHidden: body.isHidden }));
    if (result.success) refresh("/admin/universities");
    return result;
  });
}

export async function adminSetCourseHiddenAction(input: unknown) {
  return guarded(async () => {
    await admin();
    const body = (input ?? {}) as Record<string, unknown>;
    const result = toResult(await adminSetCourseHidden({ courseId: body.courseId, isHidden: body.isHidden }));
    if (result.success) refresh("/admin/universities", "/peers");
    return result;
  });
}

export async function adminMergeCoursesAction(input: unknown) {
  return guarded(async () => {
    await admin();
    const body = (input ?? {}) as Record<string, unknown>;
    const result = toResult(await adminMergeCourses({ sourceId: body.sourceId, targetId: body.targetId }));
    if (result.success) refresh("/admin/universities", "/peers");
    return result;
  });
}
