"use server";

import { runAttendanceAction } from "@/actions/attendance/action-boundary";
import { checkInSchema } from "@/schemas/attendance.schema";
import { checkIn } from "@/services/attendance.service";

export async function checkInAction(raw: unknown) {
  return runAttendanceAction((userId) => {
    checkInSchema.parse(raw);
    return checkIn(userId, raw);
  }, "Checked in successfully.");
}
