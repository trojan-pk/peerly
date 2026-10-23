"use server";

import { revalidatePath } from "next/cache";
import {
  submitReport as submitReportLib,
  resolveReport as resolveReportLib,
  toggleTargetModeration as toggleTargetModerationLib,
  ReportActionResult,
} from "@/lib/reports";

/**
 * Server action for signed-in users to submit a moderation report.
 */
export async function submitReport(rawInput: unknown): Promise<ReportActionResult> {
  try {
    const result = await submitReportLib(rawInput);
    if (result.success) {
      try {
        revalidatePath("/admin/reports");
      } catch {
        // no-op in tests
      }
    }
    return result;
  } catch (err) {
    console.error("[submitReportAction] Unexpected action error:", err);
    return {
      success: false,
      message: "An unexpected error occurred while submitting your report. Please try again.",
    };
  }
}

export async function submitReportAction(rawInput: unknown): Promise<ReportActionResult> {
  return submitReport(rawInput);
}

/**
 * Server action for admins to resolve or dismiss an open report.
 */
export async function resolveReport(rawInput: unknown): Promise<ReportActionResult> {
  try {
    const result = await resolveReportLib(rawInput);
    if (result.success) {
      try {
        revalidatePath("/admin/reports");
      } catch {
        // no-op in tests
      }
    }
    return result;
  } catch (err) {
    console.error("[resolveReportAction] Unexpected action error:", err);
    return {
      success: false,
      message: "An unexpected error occurred while resolving the report. Please try again.",
    };
  }
}

export async function resolveReportAction(rawInput: unknown): Promise<ReportActionResult> {
  return resolveReport(rawInput);
}

/**
 * Server action for admins to hide or restore a peer profile or resource.
 */
export async function toggleTargetModeration(rawInput: unknown): Promise<ReportActionResult> {
  try {
    const result = await toggleTargetModerationLib(rawInput);
    if (result.success) {
      try {
        revalidatePath("/admin/reports");
        revalidatePath("/peers");
        revalidatePath("/resources");
        revalidatePath("/resources/manage");
        revalidatePath("/");
      } catch {
        // no-op in tests
      }
    }
    return result;
  } catch (err) {
    console.error("[toggleTargetModerationAction] Unexpected action error:", err);
    return {
      success: false,
      message: "An unexpected error occurred while updating moderation status. Please try again.",
    };
  }
}

export async function toggleTargetModerationAction(rawInput: unknown): Promise<ReportActionResult> {
  return toggleTargetModeration(rawInput);
}
