import "server-only";
import { requireAdmin } from "@/lib/authorization/require-user";
import { assertAdmin } from "@/lib/authorization/policy";
import { ApplicationError } from "@/lib/errors/application-error";
import { inTransaction, type DatabaseTransaction } from "@/lib/db/transaction";
import { isUniqueConstraintOn } from "@/lib/db/persistence-error";
import { lockAttendanceUser } from "@/repositories/attendance.repository";
import { findUserById } from "@/repositories/user.repository";
import { createAuditRecord } from "@/repositories/audit.repository";
import { createPayrollComponentRecord, findPayrollComponent, listPayrollComponentRecords,
  lockPayrollComponent, updatePayrollComponentRecord, type PayrollComponentRecord } from "@/repositories/payroll-component.repository";
import { toPayrollComponent } from "@/mappers/payroll-component.mapper";
import { createPayrollComponentSchema, deactivatePayrollComponentSchema, listPayrollComponentsSchema,
  payrollComponentIdSchema, updatePayrollComponentSchema, type CreatePayrollComponentInput } from "@/schemas/payroll-component.schema";

async function lockActor(actorId: string, tx: DatabaseTransaction) {
  await lockAttendanceUser(actorId, tx);
  const actor = await findUserById(actorId, tx);
  assertAdmin(actor?.isActive ? actor : null);
}
async function classifyConflict<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch (error) {
    if (isUniqueConstraintOn(error, "payrollcomponent_category_name_key", ["category", "name"])) {
      throw new ApplicationError("PAYROLL_CONFLICT", "A component with this name already exists in this category, including inactive components.");
    }
    throw error;
  }
}
export async function listPayrollComponents(raw: unknown) {
  await requireAdmin();
  const input = listPayrollComponentsSchema.parse(raw);
  const result = await listPayrollComponentRecords(input);
  return { items: result.items.map(toPayrollComponent), total: result.total, page: input.page, pageSize: input.pageSize };
}
export async function createPayrollComponent(raw: unknown) {
  const actor = await requireAdmin();
  const input = createPayrollComponentSchema.parse(raw);
  return classifyConflict(() => inTransaction(async tx => {
    await lockActor(actor.id, tx);
    const row = await createPayrollComponentRecord(input, tx);
    await createAuditRecord({ actorId: actor.id, action: "PAYROLL_COMPONENT_CREATED", entityType: "PayrollComponent", entityId: row.id,
      metadata: { version: row.version, name: row.name, category: row.category, sortOrder: row.sortOrder, isActive: row.isActive } }, tx);
    return toPayrollComponent(row);
  }));
}
async function mutate(actorId: string, id: string, version: number, data: CreatePayrollComponentInput | { isActive: false }, action: string) {
  return classifyConflict(() => inTransaction(async tx => {
    // Same actor-first lock ordering as draft writers; no Payslip/Item locks or writes.
    await lockActor(actorId, tx);
    await lockPayrollComponent(id, tx);
    const before = await findPayrollComponent(id, tx);
    if (!before) throw new ApplicationError("PAYROLL_NOT_FOUND", "Payroll component not found.");
    if (before.version !== version) throw new ApplicationError("PAYROLL_CONFLICT", "Component changed. Reload before trying again.");
    const result = await updatePayrollComponentRecord(id, version, data, tx);
    if (result.count !== 1) throw new ApplicationError("PAYROLL_CONFLICT", "Component changed. Reload before trying again.");
    const after = await findPayrollComponent(id, tx);
    if (!after) throw new ApplicationError("PAYROLL_CONFLICT", "Component changed. Reload before trying again.");
    const snapshot = (row: PayrollComponentRecord) => ({ name: row.name, category: row.category, sortOrder: row.sortOrder, isActive: row.isActive, version: row.version });
    await createAuditRecord({ actorId, action, entityType: "PayrollComponent", entityId: id,
      metadata: { before: snapshot(before), after: snapshot(after) } }, tx);
    return toPayrollComponent(after);
  }));
}
export async function updatePayrollComponent(rawId: unknown, raw: unknown) {
  const actor = await requireAdmin();
  const id = payrollComponentIdSchema.parse(rawId);
  const { version, ...data } = updatePayrollComponentSchema.parse(raw);
  return mutate(actor.id, id, version, data, "PAYROLL_COMPONENT_UPDATED");
}
export async function deactivatePayrollComponent(rawId: unknown, raw: unknown) {
  const actor = await requireAdmin();
  const id = payrollComponentIdSchema.parse(rawId);
  const { version } = deactivatePayrollComponentSchema.parse(raw);
  return mutate(actor.id, id, version, { isActive: false }, "PAYROLL_COMPONENT_DEACTIVATED");
}
