import "server-only";
import { getOvertimeState } from "@/lib/overtime/state";
import { overtimeActivityQuerySchema, overtimeAuthorizationMonitoringQuerySchema } from "@/schemas/admin-overtime-monitoring.schema";
import { listOvertimeActivityRecords } from "@/repositories/overtime.repository";
import { listAuthorizationMonitoringRecords } from "@/repositories/overtime-authorization.repository";
import { canGrantOvertimeAuthorization } from "@/services/overtime-authorization.service";
import { getAdminOvertimeDetail } from "@/services/overtime.service";
import { elapsedWholeMinutes } from "@/lib/date-time/duration";
import type { OvertimeActivitySummary, OvertimeMonitoringDetail, AuthorizationMonitoringSummary } from "@/types/admin-overtime-monitoring";

// Every exposing page/action independently requires active ADMIN authorization.
export async function listOvertimeActivity(raw: unknown) {
  const input = overtimeActivityQuerySchema.parse(raw);
  const now = new Date();
  const result = await listOvertimeActivityRecords(input, now);
  const items: OvertimeActivitySummary[] = result.items.map(row => {
    const state = getOvertimeState(row, now);
    return {
      id: row.id, workDate: row.authorization.attendance.workDate.toISOString().slice(0, 10), employee: row.authorization.attendance.user,
      checkIn: { at: row.checkInAt.toISOString(), timezone: row.checkInTimezone },
      checkOut: row.checkOutAt && row.checkOutTimezone ? { at: row.checkOutAt.toISOString(), timezone: row.checkOutTimezone } : null,
      state: state === "Open" ? "In Progress" : state,
      durationMinutes: row.checkOutAt ? elapsedWholeMinutes(row.checkInAt, row.checkOutAt) : null,
    };
  });
  return { items, total: result.total, page: input.page, pageSize: input.pageSize };
}
export async function getOvertimeMonitoringDetail(rawId: unknown): Promise<OvertimeMonitoringDetail> {
  const item = await getAdminOvertimeDetail(rawId);
  return { ...item, state: item.state === "Open" ? "In Progress" : item.state };
}
export async function listAuthorizationMonitoring(raw: unknown) {
  const input = overtimeAuthorizationMonitoringQuerySchema.parse(raw);
  const result = await listAuthorizationMonitoringRecords(input);
  const items: AuthorizationMonitoringSummary[] = result.items.map(row => {
    const authorization = row.overtimeAuthorization;
    const authorizationState = !authorization ? "Not Authorized" : authorization.revokedAt ? "Revoked" : "Authorized";
    return { id: row.id, workDate: row.workDate.toISOString().slice(0, 10),
      employee: { name: row.user.name, position: row.user.position }, authorizationState,
      state: authorization?.overtime ? "Activity Started" : authorizationState,
      authorization: authorization ? { note: authorization.note } : null,
      revoked: !!authorization?.revokedAt, canGrant: canGrantOvertimeAuthorization(row.checkOutAt, row.user.isActive) };
  });
  return { items, total: result.total, page: input.page, pageSize: input.pageSize };
}
