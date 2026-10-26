import { z } from "zod";

/**
 * Validates that a string is a safe, valid HTTP/HTTPS URL with a hostname.
 * Rejects:
 * - non-HTTP/HTTPS protocols (e.g. javascript:, ftp:, data:, file:)
 * - URLs without a valid hostname (e.g. http:// or empty hostname)
 * - embedded credentials (e.g. http://user:pass@example.com)
 */
export function validateSafeUrl(rawUrl: string): {
  valid: boolean;
  normalizedUrl?: string;
  error?: string;
} {
  const trimmed = rawUrl?.trim();
  if (!trimmed) {
    return { valid: false, error: "Resource URL is required." };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: "Please enter a valid URL." };
  }

  // Protocol check: HTTP or HTTPS only
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, error: "URL must use HTTP or HTTPS protocol." };
  }

  // Credentials check: username or password in URL
  if (parsed.username || parsed.password) {
    return {
      valid: false,
      error: "URLs containing embedded usernames or passwords are not allowed.",
    };
  }

  // Hostname check: must have a valid hostname
  if (!parsed.hostname || parsed.hostname.trim().length === 0) {
    return { valid: false, error: "URL must include a valid host domain." };
  }

  // Hostname must include at least one dot (domain name) or be localhost
  if (!parsed.hostname.includes(".")) {
    return { valid: false, error: "URL must include a valid domain name." };
  }

  return { valid: true, normalizedUrl: parsed.toString() };
}

export const CreateResourceSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, "Title must be at least 2 characters")
      .max(120, "Title cannot exceed 120 characters"),
    description: z
      .string()
      .trim()
      .min(10, "Description must be at least 10 characters")
      .max(1000, "Description cannot exceed 1000 characters"),
    topic: z
      .string()
      .trim()
      .min(2, "Topic must be at least 2 characters")
      .max(50, "Topic cannot exceed 50 characters"),
    /** Optional catalogue course id from the owner's own courses; "" clears it. */
    course: z.union([z.string().regex(/^[a-f\d]{24}$/i, "Invalid course"), z.literal(""), z.null()]).optional().transform((v) => v || null),
    url: z
      .string()
      .trim()
      .max(500, "URL cannot exceed 500 characters")
      .refine((val) => validateSafeUrl(val).valid, {
        message:
          "Please enter a valid HTTP or HTTPS URL with a valid hostname and no embedded credentials",
      }),
  })
  .strict();

export const UpdateResourceSchema = z
  .object({
    resourceId: z.string().trim().min(1, "Resource ID is required"),
    title: z
      .string()
      .trim()
      .min(2, "Title must be at least 2 characters")
      .max(120, "Title cannot exceed 120 characters"),
    description: z
      .string()
      .trim()
      .min(10, "Description must be at least 10 characters")
      .max(1000, "Description cannot exceed 1000 characters"),
    topic: z
      .string()
      .trim()
      .min(2, "Topic must be at least 2 characters")
      .max(50, "Topic cannot exceed 50 characters"),
    /** Optional catalogue course id from the owner's own courses; "" clears it. */
    course: z.union([z.string().regex(/^[a-f\d]{24}$/i, "Invalid course"), z.literal(""), z.null()]).optional().transform((v) => v || null),
    url: z
      .string()
      .trim()
      .max(500, "URL cannot exceed 500 characters")
      .refine((val) => validateSafeUrl(val).valid, {
        message:
          "Please enter a valid HTTP or HTTPS URL with a valid hostname and no embedded credentials",
      }),
  })
  .strict();

export const DeleteResourceSchema = z
  .object({
    resourceId: z.string().trim().min(1, "Resource ID is required"),
  })
  .strict();

export type CreateResourceInput = z.infer<typeof CreateResourceSchema>;
export type UpdateResourceInput = z.infer<typeof UpdateResourceSchema>;
export type DeleteResourceInput = z.infer<typeof DeleteResourceSchema>;
