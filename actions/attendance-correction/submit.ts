"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/authorization/require-user";
import { ApplicationError } from "@/lib/errors/application-error";
import { submitAttendanceCorrectionSchema } from "@/schemas/attendance-correction.schema";
import { submitAttendanceCorrection } from "@/services/attendance-correction.service";
import type { ActionResult } from "@/types/action-result";

export async function submitAttendanceCorrectionAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    if (user.role !== "USER") throw new ApplicationError("FORBIDDEN", "Only employees with USER access may submit correction requests.");
    const input = submitAttendanceCorrectionSchema.parse(raw);
    const data = await submitAttendanceCorrection(user.id, input);
    revalidatePath("/attendance/requests");
    return { success: true, message: "Request submitted. Attendance remains unchanged until ADMIN approval.", data };
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false, message: "Please check the supplied information.", fieldErrors: z.flattenError(error).fieldErrors };
    return { success: false, message: error instanceof ApplicationError ? error.message : "Unable to submit your request. Please try again." };
  }
}
