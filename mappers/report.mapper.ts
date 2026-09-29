import { toAdminAttendanceDto } from "@/mappers/attendance.mapper";
import { toOvertimeDto } from "@/mappers/overtime.mapper";
import { authorizationState } from "@/mappers/overtime-authorization.mapper";
import type { ReportRecord } from "@/repositories/report.repository";
import type { ReportDto } from "@/types/report";

export function toReportDto(row: ReportRecord): ReportDto {
  const authorization = row.overtimeAuthorization;
  return { ...toAdminAttendanceDto(row), authorizationState: authorizationState(authorization),
    authorization: authorization ? { id: authorization.id, grantedAt: authorization.grantedAt.toISOString(), revokedAt: authorization.revokedAt?.toISOString() ?? null, note: authorization.note } : null,
    overtime: authorization?.overtime ? toOvertimeDto(authorization.overtime) : null,
  };
}
