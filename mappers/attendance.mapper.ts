import type { AttendanceRecord, AdminAttendanceRecord } from "@/repositories/attendance.repository";
import type { AdminAttendanceDto } from "@/types/admin-attendance";
import type { AttendanceDto } from "@/types/attendance";
import { elapsedWholeMinutes } from "@/lib/date-time/duration";
import { toDailyReportDto } from "@/mappers/daily-report.mapper";

export function toAttendanceDto(record: AttendanceRecord): AttendanceDto {
  const actualDurationMinutes = record.checkOutAt ? elapsedWholeMinutes(record.checkInAt, record.checkOutAt) : null;
  return {
    id: record.id, workDate: record.workDate.toISOString().slice(0, 10),
    requiredWorkMinutes: record.requiredWorkMinutes, checkInAt: record.checkInAt.toISOString(),
    checkInLatitude: record.checkInLatitude, checkInLongitude: record.checkInLongitude,
    checkInAccuracy: record.checkInAccuracy, checkInAddress: record.checkInAddress,
    checkInTimezone: record.checkInTimezone, checkInDescription: record.checkInDescription,
    checkOutAt: record.checkOutAt?.toISOString() ?? null,
    checkOutLatitude: record.checkOutLatitude, checkOutLongitude: record.checkOutLongitude,
    checkOutAccuracy: record.checkOutAccuracy, checkOutAddress: record.checkOutAddress,
    checkOutTimezone: record.checkOutTimezone, checkOutDescription: record.checkOutDescription,
    dailyReport: record.dailyReport ? toDailyReportDto(record.dailyReport) : null,
    actualDurationMinutes,
    differenceMinutes: actualDurationMinutes === null ? null : actualDurationMinutes - record.requiredWorkMinutes,
    isOpen: record.checkOutAt === null,
  };
}

export function toAdminAttendanceDto(record: AdminAttendanceRecord): AdminAttendanceDto {
  return { ...toAttendanceDto(record), employee: { id: record.user.id, name: record.user.name, email: record.user.email } };
}
