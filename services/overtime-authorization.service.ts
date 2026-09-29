import "server-only";
import { inTransaction } from "@/lib/db/transaction";
import { ApplicationError } from "@/lib/errors/application-error";
import { assertAdmin } from "@/lib/authorization/policy";
import { findUserById } from "@/repositories/user.repository";
import { lockAttendanceUser } from "@/repositories/attendance.repository";
import { createAuditRecord } from "@/repositories/audit.repository";
import { findAuthorizationAttendance, listAuthorizationAttendanceRecords, lockAuthorizationAttendance, saveAuthorizationGrant, saveAuthorizationRevoke } from "@/repositories/overtime-authorization.repository";
import { toAuthorizationAttendanceDto } from "@/mappers/overtime-authorization.mapper";
import { grantOvertimeAuthorizationSchema, revokeOvertimeAuthorizationSchema } from "@/schemas/overtime-authorization.schema";
import { adminOvertimeAuthorizationQuerySchema } from "@/schemas/admin-query.schema";

/** Grant prerequisites, shared by the mutation and the dashboard shortcut. */
export function canGrantOvertimeAuthorization(checkOutAt: Date | null, isActive: boolean) {
  return checkOutAt !== null && isActive;
}

/** actorId is supplied by requireAdmin at the action boundary, never by the client input. */
async function transition(actorId: string, raw: unknown, operation: "grant" | "revoke") {
  const input = operation === "grant" ? grantOvertimeAuthorizationSchema.parse(raw) : { ...revokeOvertimeAuthorizationSchema.parse(raw), note: null };
  // Immutable relationship lookup determines lock ordering; all state is read again after locks.
  const target = await findAuthorizationAttendance(input.attendanceId);
  if (!target) throw new ApplicationError("ATTENDANCE_NOT_FOUND", "Attendance not found.");
  return inTransaction(async (tx) => {
    // Stable order also handles self-authorization and two admins authorizing each other.
    for (const id of [...new Set([actorId, target.user.id])].sort()) await lockAttendanceUser(id, tx);
    await lockAuthorizationAttendance(input.attendanceId, tx);
    const actor = await findUserById(actorId, tx);
    assertAdmin(actor?.isActive ? actor : null);
    const attendance = await findAuthorizationAttendance(input.attendanceId, tx);
    if (!attendance) throw new ApplicationError("ATTENDANCE_NOT_FOUND", "Attendance not found.");
    if (!attendance.checkOutAt) throw new ApplicationError("ATTENDANCE_OPEN", "Regular attendance must be completed first.");
    const previous = attendance.overtimeAuthorization;
    if (operation === "grant") {
      const user = await findUserById(attendance.user.id, tx);
      if (!canGrantOvertimeAuthorization(attendance.checkOutAt, user?.isActive ?? false)) throw new ApplicationError("USER_INACTIVE", "An inactive user cannot receive overtime authorization.");
      if (previous && !previous.revokedAt) return { item: toAuthorizationAttendanceDto(attendance), message: "Already authorized." };
    } else if (!previous || previous.revokedAt) {
      return { item: toAuthorizationAttendanceDto(attendance), message: previous ? "Already revoked." : "Attendance is not authorized." };
    }
    const now = new Date();
    const record = operation === "grant"
      ? await saveAuthorizationGrant(attendance.id, actorId, now, input.note, tx)
      : await saveAuthorizationRevoke(attendance.id, now, tx);
    const action = operation === "revoke" ? "OVERTIME_AUTHORIZATION_REVOKED" : previous ? "OVERTIME_AUTHORIZATION_REGRANTED" : "OVERTIME_AUTHORIZATION_GRANTED";
    await createAuditRecord({ actorId, action, entityType: "OvertimeAuthorization", entityId: record.id,
      metadata: { attendanceId: attendance.id, targetUserId: attendance.user.id, workDate: attendance.workDate.toISOString().slice(0, 10), authorizationId: record.id, note: record.note, grantedAt: record.grantedAt.toISOString(), revokedAt: record.revokedAt?.toISOString() ?? null },
    }, tx);
    return { item: toAuthorizationAttendanceDto({ ...attendance, overtimeAuthorization: record }), message: operation === "revoke" ? "Authorization revoked." : previous ? "Overtime re-authorized." : "Overtime authorized." };
  });
}
export function grantOvertimeAuthorization(actorId: string, input: unknown) { return transition(actorId, input, "grant"); }
export function revokeOvertimeAuthorization(actorId: string, input: unknown) { return transition(actorId, input, "revoke"); }
export async function listOvertimeAuthorizations(raw: unknown) {
  const input = adminOvertimeAuthorizationQuerySchema.parse(raw);
  const result = await listAuthorizationAttendanceRecords(input);
  return { items: result.items.map(toAuthorizationAttendanceDto), total: result.total, page: input.page, pageSize: input.pageSize };
}
