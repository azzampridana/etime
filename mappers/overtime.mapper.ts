import type { OvertimeRecord, AdminOvertimeRecord } from "@/repositories/overtime.repository";
import type { OvertimeDto, AdminOvertimeDto } from "@/types/overtime";
import { elapsedWholeMinutes } from "@/lib/date-time/duration";
import { overtimePhotoUrl } from "@/lib/storage/storage";
import { getOvertimeState } from "@/lib/overtime/state";
import type { OvertimeHistoryRecord, OwnOvertimeDetailRecord } from "@/repositories/overtime.repository";

export function toOvertimeHistoryDto(row: OvertimeHistoryRecord, now: Date) {
  return { checkOutSource: row.checkOutSource, checkOutCorrectionRequestId: row.checkOutCorrectionRequestId, id: row.id, workDate: row.authorization.attendance.workDate.toISOString().slice(0, 10),
    state: getOvertimeState(row, now), checkInAt: row.checkInAt.toISOString(), checkOutAt: row.checkOutAt?.toISOString() ?? null,
    durationMinutes: row.checkOutAt ? elapsedWholeMinutes(row.checkInAt, row.checkOutAt) : null };
}

/** Historical reads retain nullable evidence without fabricating event metadata. */
export function toOwnOvertimeDetailDto(row: OwnOvertimeDetailRecord, now: Date) {
  return { ...toOvertimeHistoryDto(row, now),
    authorization: { id: row.authorization.id, grantedAt: row.authorization.grantedAt.toISOString(),
      revokedAt: row.authorization.revokedAt?.toISOString() ?? null, note: row.authorization.note },
    events: [
      { label: "Check-In", at: row.checkInAt.toISOString(), timezone: row.checkInTimezone,
        description: row.checkInDescription, latitude: row.checkInLatitude, longitude: row.checkInLongitude,
        accuracy: row.checkInAccuracy, address: row.checkInAddress,
        photoUrl: row.checkInPhotoPath ? overtimePhotoUrl(row.id, "check-in") : null },
      { label: "Checkout", at: row.checkOutAt?.toISOString() ?? null, timezone: row.checkOutTimezone,
        description: row.checkOutDescription, latitude: row.checkOutLatitude, longitude: row.checkOutLongitude,
        accuracy: row.checkOutAccuracy, address: row.checkOutAddress,
        photoUrl: row.checkOutPhotoPath ? overtimePhotoUrl(row.id, "check-out") : null },
    ],
  };
}

export function toOvertimeDto(row: OvertimeRecord, now = new Date()): OvertimeDto {
  const state = getOvertimeState(row, now);
  return {
    state, checkOutSource: row.checkOutSource, checkOutCorrectionRequestId: row.checkOutCorrectionRequestId,
    id: row.id, workDate: row.authorization.attendance.workDate.toISOString().slice(0, 10),
    authorizationRevoked: row.authorization.revokedAt !== null, isOpen: state === "Open",
    durationMinutes: row.checkOutAt ? elapsedWholeMinutes(row.checkInAt, row.checkOutAt) : null,
    checkIn: { at: row.checkInAt.toISOString(), latitude: row.checkInLatitude, longitude: row.checkInLongitude,
      accuracy: row.checkInAccuracy, timezone: row.checkInTimezone, description: row.checkInDescription,
      address: row.checkInAddress, photoUrl: overtimePhotoUrl(row.id, "check-in") },
    checkOut: row.checkOutAt ? { at: row.checkOutAt.toISOString(), latitude: row.checkOutLatitude, longitude: row.checkOutLongitude,
      accuracy: row.checkOutAccuracy, timezone: row.checkOutTimezone, description: row.checkOutDescription,
      address: row.checkOutAddress, photoUrl: row.checkOutPhotoPath ? overtimePhotoUrl(row.id, "check-out") : null } : null,
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
