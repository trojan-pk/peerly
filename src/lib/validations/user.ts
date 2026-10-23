import { z } from "zod";

function isValidHttpUrl(val: string): boolean {
  if (!val || val.trim() === "") return true;
  try {
    const url = new URL(val);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }
    // Hostname must be present and non-empty
    return Boolean(url.hostname && !url.username && !url.password);
  } catch {
    return false;
  }
}

/**
 * Escapes characters for safe inclusion in regular expressions,
 * preventing regex injection or ReDoS from user inputs.
 */
export function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

/**
 * Normalizes an array of tags (topics or subjects):
 * Trims whitespace, removes empty strings, and deduplicates case-insensitively.
 */
export function normalizeTags(tags: string[]): string[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const tag of tags) {
    if (typeof tag !== "string") continue;
    const trimmed = tag.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(trimmed);
    }
  }

  return result;
}

/**
 * Calculates whether a student profile is complete enough for peer discovery.
 * Requirements:
 * - Valid name (>= 2 chars)
 * - University specified
 * - At least one topic or subject
 * - Availability described
 */
export function calculateProfileCompletion(profile: {
  name?: string;
  university?: string;
  topics?: string[];
  subjects?: string[];
  availability?: string;
}): boolean {
  const hasName = Boolean(profile.name && profile.name.trim().length >= 2);
  const hasUniversity = Boolean(profile.university && profile.university.trim().length > 0);
  const normalizedTopics = normalizeTags(profile.topics || []);
  const normalizedSubjects = normalizeTags(profile.subjects || []);
  const hasTopicsOrSubjects = normalizedTopics.length > 0 || normalizedSubjects.length > 0;
  const hasAvailability = Boolean(profile.availability && profile.availability.trim().length > 0);

  return Boolean(hasName && hasUniversity && hasTopicsOrSubjects && hasAvailability);
}

export const ContactUpdateSchema = z
  .object({
    whatsapp: z
      .string()
      .trim()
      .max(30, "WhatsApp number cannot exceed 30 characters")
      .default(""),
    meetingLink: z
      .string()
      .trim()
      .max(200, "Meeting link cannot exceed 200 characters")
      .refine(isValidHttpUrl, {
        message: "Meeting link must be a valid HTTP or HTTPS URL.",
      })
      .default(""),
    preferredMethod: z
      .enum(["whatsapp", "meeting_link", "email", "unspecified"])
      .default("unspecified"),
  })
  .strict();

export const ProfileUpdateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name cannot exceed 100 characters"),
    bio: z
      .string()
      .trim()
      .max(1000, "Bio cannot exceed 1000 characters")
      .default(""),
    university: z
      .string()
      .trim()
      .max(200, "University cannot exceed 200 characters")
      .default(""),
    campus: z
      .string()
      .trim()
      .max(200, "Campus cannot exceed 200 characters")
      .default(""),
    topics: z
      .array(
        z.string().trim().min(1, "Topic cannot be empty").max(50, "Topic too long")
      )
      .max(20, "Maximum 20 topics allowed")
      .default([]),
    subjects: z
      .array(
        z.string().trim().min(1, "Subject cannot be empty").max(50, "Subject too long")
      )
      .max(20, "Maximum 20 subjects allowed")
      .default([]),
    mode: z
      .enum(["online", "campus", "both"], {
        error: "Mode must be online, campus, or both",
      })
      .default("both"),
    availability: z
      .string()
      .trim()
      .max(500, "Availability description cannot exceed 500 characters")
      .default(""),
    pricingPreference: z
      .enum(["free", "paid", "both"], {
        error: "Pricing preference must be free, paid, or both",
      })
      .default("free"),
    contact: ContactUpdateSchema.default({
      whatsapp: "",
      meetingLink: "",
      preferredMethod: "unspecified",
    }),
  })
  // .strict() ensures any attempt to pass privileged fields (role, googleId, email, isProfileComplete, stats) is rejected
  .strict();

export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;
export type ContactUpdateInput = z.infer<typeof ContactUpdateSchema>;
