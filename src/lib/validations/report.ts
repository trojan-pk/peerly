import { z } from "zod";

export const ReportReasonEnum = z.enum([
  "inappropriate",
  "spam",
  "harassment",
  "copyright",
  "misleading",
  "broken_link",
  "other",
]);

export const CreateReportSchema = z
  .object({
    targetType: z.enum(["user", "resource"]),
    targetId: z.string().min(1, "Target ID is required"),
    reason: ReportReasonEnum,
    explanation: z
      .string()
      .trim()
      .min(10, "Explanation must be at least 10 characters")
      .max(1000, "Explanation cannot exceed 1000 characters"),
  })
  .strict();

export const ResolveReportSchema = z
  .object({
    reportId: z.string().min(1, "Report ID is required"),
    action: z.enum(["RESOLVE", "DISMISS"]),
    moderatorNotes: z
      .string()
      .trim()
      .max(1000, "Moderator notes cannot exceed 1000 characters")
      .optional(),
  })
  .strict();

export const ModerateTargetSchema = z
  .object({
    targetType: z.enum(["user", "resource"]),
    targetId: z.string().min(1, "Target ID is required"),
    action: z.enum(["HIDE", "RESTORE"]),
    reason: z
      .string()
      .trim()
      .max(500, "Reason cannot exceed 500 characters")
      .optional(),
  })
  .strict();

export type CreateReportInput = z.infer<typeof CreateReportSchema>;
export type ResolveReportInput = z.infer<typeof ResolveReportSchema>;
export type ModerateTargetInput = z.infer<typeof ModerateTargetSchema>;
