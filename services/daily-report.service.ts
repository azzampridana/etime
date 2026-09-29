import "server-only";

import { inTransaction } from "@/lib/db/transaction";
import { toDailyReportDto } from "@/mappers/daily-report.mapper";
import { upsertDailyReportRecord } from "@/repositories/daily-report.repository";
import { saveDailyReportSchema } from "@/schemas/daily-report.schema";
import { lockActiveAttendanceUser, requireOpenAttendance } from "@/services/attendance-context";

export async function saveDailyReport(userId: string, raw: unknown) {
  const input = saveDailyReportSchema.parse(raw);
  return inTransaction(async (tx) => {
    await lockActiveAttendanceUser(userId, tx);
    const attendance = await requireOpenAttendance(userId, tx, input.attendanceId);
    return toDailyReportDto(await upsertDailyReportRecord(attendance.id, input.content, tx));
  });
}
