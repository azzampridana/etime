"use server";

import { runAttendanceAction } from "@/actions/attendance/action-boundary";
import { prepareAttendanceLocation } from "@/services/attendance.service";

export async function prepareAttendanceLocationAction(raw: unknown) {
  return runAttendanceAction(userId => prepareAttendanceLocation(userId, raw), "Location ready.", false);
}
