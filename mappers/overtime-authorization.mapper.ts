import type { AuthorizationAttendanceRecord } from "@/repositories/overtime-authorization.repository";
import type { OvertimeAuthorizationAttendanceDto, OvertimeAuthorizationState } from "@/types/overtime-authorization";
import { toAdminAttendanceDto } from "@/mappers/attendance.mapper";

export function authorizationState(record: { revokedAt: unknown } | null): OvertimeAuthorizationState {
  return !record ? "Not Authorized" : record.revokedAt === null ? "Authorized" : "Revoked";
}
export function toAuthorizationAttendanceDto(record: AuthorizationAttendanceRecord): OvertimeAuthorizationAttendanceDto {
  const authorization = record.overtimeAuthorization;
  return {
    ...toAdminAttendanceDto(record), authorizationState: authorizationState(authorization),
    authorization: authorization ? {
      id: authorization.id, attendanceId: authorization.attendanceId, grantedAt: authorization.grantedAt.toISOString(),
      revokedAt: authorization.revokedAt?.toISOString() ?? null, note: authorization.note,
      grantedBy: { id: authorization.grantedBy.id, name: authorization.grantedBy.name, email: authorization.grantedBy.email },
    } : null,
  };
}
