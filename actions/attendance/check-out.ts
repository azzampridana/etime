"use server";

import { runAttendanceAction } from "@/actions/attendance/action-boundary";
import { checkOutSchema } from "@/schemas/attendance.schema";
import { checkOut } from "@/services/attendance.service";

export async function checkOutAction(raw: unknown) {
  return runAttendanceAction((userId) => {
    checkOutSchema.parse(raw);
    return checkOut(userId, raw);
  }, "Checked out successfully.");
}
