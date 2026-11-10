import "server-only";
import { requireAdmin } from "@/lib/authorization/require-user";
import { assertAdmin } from "@/lib/authorization/policy";
import { ApplicationError } from "@/lib/errors/application-error";
import { inTransaction, type DatabaseTransaction } from "@/lib/db/transaction";
import { lockAttendanceUser } from "@/repositories/attendance.repository";
import { findUserById } from "@/repositories/user.repository";
import { createAuditRecord } from "@/repositories/audit.repository";
import { createEmployeeRecord, findEmployeeRecord, findEmployeeByLinkedUser, listEmployeeRecords, lockEmployeeRecord, updateEmployeeRecord } from "@/repositories/employee.repository";
import { toEmployeeDetail, toEmployeeSummary } from "@/mappers/employee.mapper";
import { createEmployeeSchema, updateEmployeeSchema, employeeIdSchema, listEmployeesSchema, type EmployeeInput } from "@/schemas/employee.schema";

export async function lockEmployeeAdminActor(id: string, tx: DatabaseTransaction) {
  await lockAttendanceUser(id, tx);
  const actor = await findUserById(id, tx);
  assertAdmin(actor?.isActive ? actor : null);
}
function persistence(input: EmployeeInput) {
  return { ...input, joinDate: input.joinDate ? new Date(`${input.joinDate}T00:00:00.000Z`) : null,
    dateOfBirth: input.dateOfBirth ? new Date(`${input.dateOfBirth}T00:00:00.000Z`) : null,
    employmentEndDate: input.employmentEndDate ? new Date(`${input.employmentEndDate}T00:00:00.000Z`) : null };
}
export async function listEmployees(raw: unknown) {
  await requireAdmin();
  const input = listEmployeesSchema.parse(raw);
  const result = await listEmployeeRecords(input);
  return { ...result, items: result.items.map(toEmployeeSummary) };
}
export async function getEmployee(id: unknown) {
  await requireAdmin();
  const row = await findEmployeeRecord(employeeIdSchema.parse(id));
  if (!row) throw new ApplicationError("EMPLOYEE_NOT_FOUND", "Employee not found.");
  return toEmployeeDetail(row);
}
export async function createEmployee(raw: unknown) {
  const actor = await requireAdmin(), input = createEmployeeSchema.parse(raw);
  const { userId, ...fields } = input;
  return inTransaction(async tx => {
    for (const id of [...new Set([actor.id, ...(userId ? [userId] : [])])].sort()) await lockAttendanceUser(id, tx);
    await lockEmployeeAdminActor(actor.id, tx);
    if (userId) {
      const user = await findUserById(userId, tx);
      if (!user || user.role !== "USER" || await findEmployeeByLinkedUser(userId, tx)) {
        throw new ApplicationError("EMPLOYEE_CONFLICT", "Selected User is no longer available. Reload and choose an unlinked USER account.");
      }
    }
    const row = await createEmployeeRecord({ ...persistence(fields), ...(userId ? { user: { connect: { id: userId } } } : {}) }, tx);
    await createAuditRecord({ actorId: actor.id, action: "EMPLOYEE_CREATED", entityType: "Employee", entityId: row.id,
      metadata: { fields: Object.keys(input), version: row.version, linkedUserId: userId ?? null } }, tx);
    return toEmployeeDetail(row);
  });
}
export async function updateEmployee(id: unknown, raw: unknown) {
  const actor = await requireAdmin(), employeeId = employeeIdSchema.parse(id);
  const { version, ...input } = updateEmployeeSchema.parse(raw);
  return inTransaction(async tx => {
    await lockEmployeeAdminActor(actor.id, tx);
    await lockEmployeeRecord(employeeId, tx);
    const before = await findEmployeeRecord(employeeId, tx);
    if (!before) throw new ApplicationError("EMPLOYEE_NOT_FOUND", "Employee not found.");
    if (before.version !== version) throw new ApplicationError("EMPLOYEE_CONFLICT", "Employee changed. Reload before saving.");
    // User linkage is never submitted or written. FK unlinking cannot be overwritten by this editor.
    const previous = toEmployeeDetail(before);
    const fields = (Object.keys(input) as (keyof EmployeeInput)[]).filter(key => input[key] !== previous[key]);
    const result = await updateEmployeeRecord(employeeId, version, persistence(input), tx);
    if (result.count !== 1) throw new ApplicationError("EMPLOYEE_CONFLICT", "Employee changed. Reload before saving.");
    await createAuditRecord({ actorId: actor.id, action: "EMPLOYEE_UPDATED", entityType: "Employee", entityId: employeeId,
      metadata: { fields, version: version + 1 } }, tx);
    const after = await findEmployeeRecord(employeeId, tx);
    if (!after) throw new ApplicationError("EMPLOYEE_CONFLICT", "Employee changed. Reload before saving.");
    return toEmployeeDetail(after);
  });
}
