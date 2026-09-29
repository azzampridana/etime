"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/authorization/require-user";
import { ApplicationError } from "@/lib/errors/application-error";
import { userIdSchema } from "@/schemas/user.schema";
import { getAdminAttendance } from "@/services/attendance.service";
import type { ActionResult } from "@/types/action-result";
import type { AdminAttendanceDetailDto } from "@/types/admin-attendance";

export async function getAdminAttendanceAction(id: unknown): Promise<ActionResult<AdminAttendanceDetailDto>> {
  try {
    await requireAdmin();
    const data = await getAdminAttendance(userIdSchema.parse(id));
    return { success: true, message: "Attendance loaded.", data };
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false, message: "Invalid attendance ID." };
    return { success: false, message: error instanceof ApplicationError ? error.message : "Unable to load attendance. Please try again." };
  }
}
