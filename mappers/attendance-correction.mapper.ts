import { z } from "zod";
import type { CorrectionDetailRecord } from "@/repositories/attendance-correction.repository";
import type { CorrectionDetailDto } from "@/types/attendance-correction";

const originalDisplaySchema = z.object({
  checkInAt: z.string(), checkInTimezone: z.string(),
  dailyReport: z.object({ content: z.string() }).nullable(),
});
export function toCorrectionDetailDto(row: CorrectionDetailRecord, canResubmit: boolean): CorrectionDetailDto {
  const original = originalDisplaySchema.safeParse(row.originalAttendanceSnapshot);
  return {
    id: row.id, workDate: row.workDate.toISOString().slice(0, 10), type: row.type, status: row.status,
    createdAt: row.createdAt.toISOString(), attendanceId: row.attendanceId,
    requestedCheckInAt: row.requestedCheckInAt?.toISOString() ?? null, requestedCheckOutAt: row.requestedCheckOutAt.toISOString(),
    requestedCheckInTimezone: row.requestedCheckInTimezone, requestedCheckOutTimezone: row.requestedCheckOutTimezone,
    originalCheckInAt: original.success ? original.data.checkInAt : null,
    originalCheckInTimezone: original.success ? original.data.checkInTimezone : null,
    existingReportContent: original.success ? original.data.dailyReport?.content ?? null : null,
    reason: row.reason, proposedDailyReportContent: row.proposedDailyReportContent,
    reviewedAt: row.reviewedAt?.toISOString() ?? null, reviewerName: row.reviewedBy?.name ?? null,
    reviewNote: row.reviewNote, canResubmit,
  };
}
