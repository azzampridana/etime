import { z } from "zod";

// Up to 10,000 UTF-16 code units of plain multiline text.
export const DAILY_REPORT_MAX_LENGTH = 10_000;
export const dailyReportSchema = z.strictObject({
  content: z.string().trim().min(1, "Describe the work you completed.").max(DAILY_REPORT_MAX_LENGTH),
});
export const saveDailyReportSchema = dailyReportSchema.extend({ attendanceId: z.uuid() });
