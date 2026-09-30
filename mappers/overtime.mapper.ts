import type { OvertimeRecord, AdminOvertimeRecord } from "@/repositories/overtime.repository";
import type { OvertimeDto, AdminOvertimeDto } from "@/types/overtime";
import { elapsedWholeMinutes } from "@/lib/date-time/duration";
import { overtimePhotoUrl } from "@/lib/storage/storage";
import { getOvertimeState } from "@/lib/overtime/state";

export function toOvertimeDto(row: OvertimeRecord, now = new Date()): OvertimeDto {
  const state = getOvertimeState(row, now);
  return {
    state,
    id: row.id, workDate: row.authorization.attendance.workDate.toISOString().slice(0, 10),
    authorizationRevoked: row.authorization.revokedAt !== null, isOpen: state === "Open",
    durationMinutes: row.checkOutAt ? elapsedWholeMinutes(row.checkInAt, row.checkOutAt) : null,
    checkIn: { at: row.checkInAt.toISOString(), latitude: row.checkInLatitude, longitude: row.checkInLongitude,
      accuracy: row.checkInAccuracy, timezone: row.checkInTimezone, description: row.checkInDescription,
      address: row.checkInAddress, photoUrl: overtimePhotoUrl(row.id, "check-in") },
    checkOut: row.checkOutAt ? { at: row.checkOutAt.toISOString(), latitude: row.checkOutLatitude!, longitude: row.checkOutLongitude!,
      accuracy: row.checkOutAccuracy!, timezone: row.checkOutTimezone!, description: row.checkOutDescription!,
      address: row.checkOutAddress, photoUrl: overtimePhotoUrl(row.id, "check-out") } : null,
  };
}

export function toAdminOvertimeDto(row: AdminOvertimeRecord, now = new Date()): AdminOvertimeDto {
  const authorization = row.authorization;
  const employee = authorization.attendance.user;
  return { ...toOvertimeDto(row, now),
    employee: { id: employee.id, name: employee.name, email: employee.email, position: employee.position }, attendanceId: authorization.attendance.id,
    authorization: { id: authorization.id, grantedAt: authorization.grantedAt.toISOString(), revokedAt: authorization.revokedAt?.toISOString() ?? null, note: authorization.note },
  };
}
