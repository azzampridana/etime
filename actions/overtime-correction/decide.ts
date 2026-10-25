"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/authorization/require-user";
import { ApplicationError } from "@/lib/errors/application-error";
import { decideOvertimeCorrectionSchema } from "@/schemas/overtime-correction.schema";
import { decideOvertimeCorrection } from "@/services/overtime-correction-review.service";
import type { ActionResult } from "@/types/action-result";

type DecisionResult = Awaited<ReturnType<typeof decideOvertimeCorrection>>;
async function decide(raw: unknown, decision: "APPROVED" | "REJECTED"): Promise<ActionResult<DecisionResult>> {
  let data: DecisionResult;
  try {
    await requireAdmin();
    const input = decideOvertimeCorrectionSchema.parse(raw);
    if (input.decision !== decision) throw new ApplicationError("INVALID_DECISION", "Decision does not match the selected action.");
    data = await decideOvertimeCorrection(input);
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false, message: "Check the decision information.", fieldErrors: z.flattenError(error).fieldErrors };
    return { success: false, message: error instanceof ApplicationError ? error.message : "Decision outcome could not be confirmed. Reload the request before any further action." };
  }
  const message = decision === "APPROVED" ? "Correction approved and official Checkout recorded." : "Correction rejected. Official overtime is unchanged.";
  try {
    for (const path of ["/overtime", "/home", "/admin", "/admin/overtime", "/admin/overtime-requests", "/admin/reports"]) revalidatePath(path, "layout");
  } catch {
    return { success: true, data, message: `${message} The decision is saved; reload to refresh cached views.` };
  }
  return { success: true, data, message };
}
export async function approveOvertimeCorrectionAction(raw: unknown) { return decide(raw, "APPROVED"); }
export async function rejectOvertimeCorrectionAction(raw: unknown) { return decide(raw, "REJECTED"); }
