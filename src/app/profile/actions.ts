"use server";

import { requireAuth, UnauthorizedError } from "@/lib/auth-guards";
import {
  ProfileUpdateSchema,
  normalizeTags,
  calculateProfileCompletion,
} from "@/lib/validations/user";
import { revalidatePath } from "next/cache";
import { checkRateLimit } from "@/lib/rate-limit";

export interface ProfileActionState {
  success: boolean;
  message?: string;
  errors?: Record<string, string>;
  isComplete?: boolean;
}

/**
 * Server action to update user profile and contact details.
 * Determines the target user strictly from requireAuth(), never trusting user input.
 * Strictly allowlists editable fields and calculates profile completion on the server.
 */
export async function updateProfile(rawInput: unknown): Promise<ProfileActionState> {
  // 1. Authenticate user strictly using server session and database record
  let authContext;
  try {
    authContext = await requireAuth();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return {
        success: false,
        message: "You must be signed in to update your profile.",
      };
    }
    return {
      success: false,
      message: "Authentication service error. Please try again.",
    };
  }

  try {
    const result = await checkRateLimit(`profile_update:${authContext.user._id.toString()}`, 10, 60000);
    if (!result.allowed) return { success: false, message: `Please wait ${result.retryAfterSeconds} seconds before saving again.` };
  } catch {
    return { success: false, message: "Profile saving is temporarily unavailable. Please try again shortly." };
  }

  // 2. Validate input against strict schema (strictly rejects privileged fields)
  const parseResult = ProfileUpdateSchema.safeParse(rawInput);
  if (!parseResult.success) {
    const errors: Record<string, string> = {};
    for (const issue of parseResult.error.issues) {
      const path = issue.path.join(".");
      errors[path] = issue.message;
    }
    return {
      success: false,
      message: "Please correct the errors in the form.",
      errors,
    };
  }

  const data = parseResult.data;

  // 3. Normalize topics and subjects
  const normalizedTopics = normalizeTags(data.topics);
  const normalizedSubjects = normalizeTags(data.subjects);

  // 4. Calculate profile completion on server
  const isComplete = calculateProfileCompletion({
    name: data.name,
    university: data.university,
    topics: normalizedTopics,
    subjects: normalizedSubjects,
    availability: data.availability,
  });

  // 5. Update allowlisted fields directly on the verified user document
  try {
    const user = authContext.user;
    user.name = data.name;
    user.bio = data.bio;
    user.university = data.university;
    user.campus = data.campus;
    user.topics = normalizedTopics;
    user.subjects = normalizedSubjects;
    user.mode = data.mode;
    user.availability = data.availability;
    user.pricingPreference = data.pricingPreference;
    user.contact = {
      whatsapp: data.contact.whatsapp,
      meetingLink: data.contact.meetingLink,
      preferredMethod: data.contact.preferredMethod,
    };
    user.isProfileComplete = isComplete;

    await user.save();

    try {
      revalidatePath("/profile");
      revalidatePath("/settings");
      revalidatePath("/dashboard");
      revalidatePath("/peers");
      revalidatePath("/");
    } catch {
      // revalidatePath is a no-op outside active Next.js request context (e.g. in test suites)
    }

    return {
      success: true,
      message: "Profile saved successfully.",
      isComplete,
    };
  } catch (dbError) {
    console.error("[Profile Server Action] Error saving profile:", dbError);
    return {
      success: false,
      message: "A database error occurred while saving your profile. Please try again.",
    };
  }
}
