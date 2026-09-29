"use server";

import { runAttendanceAction } from "@/actions/attendance/action-boundary";
import { saveDailyReportSchema } from "@/schemas/daily-report.schema";
import { saveDailyReport } from "@/services/daily-report.service";

export async function saveDailyReportAction(raw: unknown) {
  return runAttendanceAction((userId) => {
    saveDailyReportSchema.parse(raw);
    return saveDailyReport(userId, raw);
  }, "Daily Report saved.");
}
