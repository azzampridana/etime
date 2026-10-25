"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/authorization/require-user";
import { ApplicationError } from "@/lib/errors/application-error";
import { approveAttendanceCorrectionSchema, rejectAttendanceCorrectionSchema } from "@/schemas/attendance-correction.schema";
import { decideAttendanceCorrection } from "@/services/attendance-correction-review.service";
import type { ActionResult } from "@/types/action-result";

type DecisionResult = { id: string; status: "APPROVED" | "REJECTED"; attendanceId: string | null };
async function decide(raw: unknown, decision: "APPROVED" | "REJECTED"): Promise<ActionResult<DecisionResult>> {
  let data: DecisionResult;
  try {
    const actor = await requireAdmin();
    const input = (decision === "APPROVED" ? approveAttendanceCorrectionSchema : rejectAttendanceCorrectionSchema).parse(raw);
    data = await decideAttendanceCorrection(actor.id, input);
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false, message: "Check the decision information.", fieldErrors: z.flattenError(error).fieldErrors };
    return { success: false, message: error instanceof ApplicationError ? error.message : "Unable to save the decision. Refresh the request before trying again." };
  }
  const message = decision === "APPROVED" ? "Correction approved and applied." : "Correction request rejected.";
  try {
    for (const path of ["/attendance", "/home", "/overtime", "/admin", "/admin/attendance", "/admin/reports", "/admin/attendance-requests"]) revalidatePath(path, "layout");
  } catch {
    return { success: true, message: `${message} The decision is saved, but cached views could not refresh. Reload to see the latest state.`, data };
  }
  return { success: true, message, data };
}
export async function approveAttendanceCorrectionAction(raw: unknown) { return decide(raw, "APPROVED"); }
export async function rejectAttendanceCorrectionAction(raw: unknown) { return decide(raw, "REJECTED"); }
