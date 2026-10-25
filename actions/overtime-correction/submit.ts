"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/authorization/require-user";
import { ApplicationError } from "@/lib/errors/application-error";
import { submitOvertimeCorrectionSchema } from "@/schemas/overtime-correction.schema";
import { submitOvertimeCorrection } from "@/services/overtime-correction.service";
import type { ActionResult } from "@/types/action-result";

export async function submitOvertimeCorrectionAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  let data: { id: string };
  try {
    const user = await requireUser();
    if (user.role !== "USER") throw new ApplicationError("FORBIDDEN", "Only USER employees may submit correction requests.");
    data = await submitOvertimeCorrection(submitOvertimeCorrectionSchema.parse(raw));
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false, message: "Please check the supplied information.", fieldErrors: z.flattenError(error).fieldErrors };
    return { success: false, message: error instanceof ApplicationError ? error.message : "Submission could not be confirmed. Check request history before trying again." };
  }
  try {
    revalidatePath("/overtime/requests");
    revalidatePath("/overtime/history", "layout");
  } catch {
    return { success: true, data, message: "Request saved. Open request history or reload to see the latest status." };
  }
  return { success: true, data, message: "Request submitted. Official overtime remains unchanged pending review." };
}
