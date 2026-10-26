import { z } from "zod";
import { MAX_NEEDED_BY_MS, MIN_NEEDED_BY_LEAD_MS } from "@/lib/request-rules";

export const CreateStudyRequestSchema = z
  .object({
    peerId: z.string().trim().min(1, "Peer ID is required"),
    topic: z
      .string()
      .trim()
      .min(1, "Topic is required")
      .max(100, "Topic cannot exceed 100 characters"),
    problemDescription: z
      .string()
      .trim()
      .min(10, "Please describe the problem or topic in at least 10 characters")
      .max(2000, "Problem description cannot exceed 2000 characters"),
    mode: z.enum(["online", "campus"], {
      error: "Study mode must be online or campus",
    }),
    urgency: z.enum(["normal", "urgent"], { error: "Urgency must be normal or urgent" }).default("normal"),
    /** ISO-8601 instant. Must be at least 15 minutes ahead and within 14 days. */
    neededBy: z
      .union([z.iso.datetime({ offset: true, error: "Enter a valid date and time" }), z.literal(""), z.null()])
      .optional()
      .transform((value) => (value ? new Date(value) : null))
      .refine((date) => !date || date.getTime() >= Date.now() + MIN_NEEDED_BY_LEAD_MS, {
        error: "Choose a time at least 15 minutes from now",
      })
      .refine((date) => !date || date.getTime() <= Date.now() + MAX_NEEDED_BY_MS, {
        error: "Deadlines can be at most 14 days away",
      }),
  })
  .strict();

export const TransitionStudyRequestSchema = z
  .object({
    requestId: z.string().trim().min(1, "Request ID is required"),
    action: z.enum(["accept", "reject", "cancel"], {
      error: "Action must be accept, reject, or cancel",
    }),
  })
  .strict();

export const ConfirmCompletionSchema = z
  .object({
    requestId: z.string().trim().min(1, "Request ID is required"),
  })
  .strict();

export const SubmitReviewSchema = z
  .object({
    requestId: z.string().trim().min(1, "Request ID is required"),
    rating: z
      .number({
        error: "Rating must be a number between 1 and 5",
      })
      .int("Rating must be a whole integer")
      .min(1, "Rating must be between 1 and 5 stars")
      .max(5, "Rating must be between 1 and 5 stars"),
    comment: z
      .string()
      .trim()
      .max(1000, "Comment cannot exceed 1000 characters")
      .default(""),
  })
  .strict();

export type CreateStudyRequestInput = z.infer<typeof CreateStudyRequestSchema>;
export type TransitionStudyRequestInput = z.infer<typeof TransitionStudyRequestSchema>;
export type ConfirmCompletionInput = z.infer<typeof ConfirmCompletionSchema>;
export type SubmitReviewInput = z.infer<typeof SubmitReviewSchema>;
