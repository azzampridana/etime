import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/authorization/require-user";
import { assertAdmin } from "@/lib/authorization/policy";
import { ApplicationError } from "@/lib/errors/application-error";
import { inTransaction, type DatabaseTransaction } from "@/lib/db/transaction";
import { isUniqueConstraintOn } from "@/lib/db/persistence-error";
import { lockAttendanceUser } from "@/repositories/attendance.repository";
import { findUserById } from "@/repositories/user.repository";
import { findEmployeeBankByUserId } from "@/repositories/employee.repository";
import { createAuditRecord } from "@/repositories/audit.repository";
import { createPayrollRecord, deletePayrollRecord, findPayrollDetail, listPayrollRecords,
  lockPayrollRecord, reconcilePayrollItems, updatePayrollRecord, findPayrollEmployeeUpperBound,
  listPayrollEmployeeBatch, findPayrollPeriodRecord, publishPayrollRecord, updatePayrollBankRecord } from "@/repositories/payroll.repository";
import { findPayrollInitializationComponents } from "@/repositories/payroll-component.repository";
import { toPayrollDetail, toPayrollSummary } from "@/mappers/payroll.mapper";
import { createPayrollDraftSchema, deletePayrollDraftSchema, listPayrollSchema,
  payslipIdSchema, updatePayrollDraftSchema, initializePayrollSchema, publishPayrollSchema, fillPayrollBankSchema, type PayrollItemsInput } from "@/schemas/payroll.schema";

const companySnapshot = {
  companyNameSnapshot: "Ennea Phos Group",
  companyAddressSnapshot: "Grand Centro Bintaro, Jl. Kodam Bintaro blok B no 18, RT.5/RW.3 Pesanggrahan, Kota Jakarta Selatan, Daerah Khusus Ibukota Jakarta 12320",
  companyEmailSnapshot: "", companyPhoneSnapshot: "",
};
const maxAmount = new Prisma.Decimal("999999999999999999");
function calculate<T extends PayrollItemsInput[number]>(items: T[]) {
  let totalEarnings = new Prisma.Decimal(0), totalDeductions = new Prisma.Decimal(0);
  const records = items.map(item => {
    const amount = new Prisma.Decimal(item.amount);
    if (item.category === "EARNING") totalEarnings = totalEarnings.plus(amount);
    else totalDeductions = totalDeductions.plus(amount);
    // Bound each partial sum before further arithmetic; no floating-point money.
    if (totalEarnings.gt(maxAmount) || totalDeductions.gt(maxAmount)) {
      throw new ApplicationError("PAYROLL_INVALID", "Payroll totals exceed the supported amount.");
    }
    return { ...item, amount };
  });
  const takeHomePay = totalEarnings.minus(totalDeductions);
  if (takeHomePay.isNegative()) throw new ApplicationError("PAYROLL_INVALID", "Deductions cannot exceed earnings.");
  return { items: records, totalEarnings, totalDeductions, takeHomePay };
}
async function lockActor(actorId: string, tx: DatabaseTransaction, recipientId?: string) {
  // Same deterministic User lock order as existing account deletion/domain writers.
  for (const id of [...new Set([actorId, ...(recipientId ? [recipientId] : [])])].sort()) await lockAttendanceUser(id, tx);
  const actor = await findUserById(actorId, tx);
  assertAdmin(actor?.isActive ? actor : null);
}
async function draftForMutation(id: string, version: number, tx: DatabaseTransaction) {
  await lockPayrollRecord(id, tx);
  const row = await findPayrollDetail(id, tx);
  if (!row) throw new ApplicationError("PAYROLL_NOT_FOUND", "Payslip not found.");
  if (row.status !== "DRAFT") throw new ApplicationError("PAYROLL_CONFLICT", "Published payslips cannot be changed or deleted.");
  if (row.version !== version) throw new ApplicationError("PAYROLL_CONFLICT", "Payslip changed. Reload before trying again.");
  return row;
}
function ensureChanged(count: number) {
  if (count !== 1) throw new ApplicationError("PAYROLL_CONFLICT", "Payslip changed. Reload before trying again.");
}

export async function listPayroll(raw: unknown) {
  await requireAdmin();
  const input = listPayrollSchema.parse(raw);
  const result = await listPayrollRecords(input);
  return { items: result.items.map(toPayrollSummary), total: result.total, page: input.page, pageSize: input.pageSize };
}
export async function getPayrollDetail(rawId: unknown) {
  await requireAdmin();
  const row = await findPayrollDetail(payslipIdSchema.parse(rawId));
  if (!row) throw new ApplicationError("PAYROLL_NOT_FOUND", "Payslip not found.");
  return toPayrollDetail(row);
}
export async function createPayrollDraft(raw: unknown) {
  const actor = await requireAdmin();
  const input = createPayrollDraftSchema.parse(raw);
  try {
    return await inTransaction(async tx => {
      await lockActor(actor.id, tx, input.userId);
      const employee = await findUserById(input.userId, tx);
      if (!employee) throw new ApplicationError("PAYROLL_NOT_FOUND", "Employee not found.");
      if (employee.role !== "USER" || !employee.isActive) throw new ApplicationError("PAYROLL_INVALID", "Select an active USER employee.");
      const { items, ...totals } = calculate(input.items);
      const bank = await findEmployeeBankByUserId(employee.id, tx);
      const row = await createPayrollRecord({ userId: employee.id, year: input.year, month: input.month,
        bankName: input.bankName ?? (bank?.bankName?.trim() || null), accountNumber: input.accountNumber ?? (bank?.bankAccountNumber?.trim() || null),
        employeeNameSnapshot: employee.name, employeePositionSnapshot: employee.position,
        ...companySnapshot, ...totals, status: "DRAFT", createdById: actor.id, updatedById: actor.id,
        items: { create: items.map(item => ({ ...item, origin: "CUSTOM" as const })) } }, tx);
      await createAuditRecord({ actorId: actor.id, action: "PAYROLL_DRAFT_CREATED", entityType: "Payslip", entityId: row.id,
        metadata: { version: row.version } }, tx);
      return toPayrollDetail(row);
    });
  } catch (error) {
    if (isUniqueConstraintOn(error, "payslip_userId_year_month_key", ["userId", "year", "month"])) {
      throw new ApplicationError("PAYROLL_CONFLICT", "A payslip already exists for this employee and period.");
    }
    throw error;
  }
}
export async function updatePayrollDraft(rawId: unknown, raw: unknown) {
  const actor = await requireAdmin();
  const id = payslipIdSchema.parse(rawId), input = updatePayrollDraftSchema.parse(raw);
  return inTransaction(async tx => {
    await lockActor(actor.id, tx);
    const before = await draftForMutation(id, input.version, tx);
    const existing = new Map(before.items.map(item => [item.id, item]));
    const submittedIds = new Set(input.items.flatMap(item => item.id ? [item.id] : []));
    for (const item of input.items) {
      if (!item.id) continue;
      const original = existing.get(item.id);
      if (!original) throw new ApplicationError("PAYROLL_INVALID", "Item ID does not belong to this payslip. Reload and preserve existing item IDs.");
      if (original.origin === "MASTER" && (original.name !== item.name || original.category !== item.category || original.sortOrder !== item.sortOrder)) {
        throw new ApplicationError("PAYROLL_INVALID", "MASTER items allow amount changes only.");
      }
    }
    if (before.items.some(item => item.origin === "MASTER" && !submittedIds.has(item.id))) {
      throw new ApplicationError("PAYROLL_INVALID", "All MASTER items must be retained with their original IDs.");
    }
    const { items, ...totals } = calculate(input.items);
    const result = await updatePayrollRecord(id, input.version, { ...totals,
      bankName: input.bankName, accountNumber: input.accountNumber, updatedById: actor.id }, tx);
    ensureChanged(result.count);
    await reconcilePayrollItems(id, items.map(item => {
      if (!item.id) return { ...item, origin: "CUSTOM" as const };
      const original = existing.get(item.id);
      if (!original) throw new ApplicationError("PAYROLL_INVALID", "Item ID does not belong to this payslip.");
      return { ...item, origin: original.origin };
    }), tx);
    await createAuditRecord({ actorId: actor.id, action: "PAYROLL_DRAFT_UPDATED", entityType: "Payslip", entityId: id,
      metadata: { version: input.version + 1 } }, tx);
    const row = await findPayrollDetail(id, tx);
    if (!row) throw new ApplicationError("PAYROLL_CONFLICT", "Payslip changed. Reload before trying again.");
    return toPayrollDetail(row);
  });
}
export async function deletePayrollDraft(rawId: unknown, raw: unknown) {
  const actor = await requireAdmin();
  const id = payslipIdSchema.parse(rawId), input = deletePayrollDraftSchema.parse(raw);
  return inTransaction(async tx => {
    await lockActor(actor.id, tx);
    await draftForMutation(id, input.version, tx);
    ensureChanged((await deletePayrollRecord(id, input.version, tx)).count);
    await createAuditRecord({ actorId: actor.id, action: "PAYROLL_DRAFT_DELETED", entityType: "Payslip", entityId: id,
      metadata: { version: input.version } }, tx);
    return { id };
  });
}

export async function fillPayrollBank(rawId: unknown, raw: unknown) {
  const actor = await requireAdmin();
  const id = payslipIdSchema.parse(rawId), input = fillPayrollBankSchema.parse(raw);
  return inTransaction(async tx => {
    await lockActor(actor.id, tx);
    const before = await draftForMutation(id, input.version, tx);
    if ((before.bankName || before.accountNumber) && !input.replaceExisting) {
      throw new ApplicationError("PAYROLL_CONFLICT", "Confirm replacement of the existing bank snapshot before filling.");
    }
    const employee = await findEmployeeBankByUserId(before.userId, tx);
    if (!employee) throw new ApplicationError("PAYROLL_INVALID", "No Employee profile is linked to this payroll recipient.");
    const bankName = employee.bankName?.trim() || null;
    const accountNumber = employee.bankAccountNumber?.trim() || null;
    if (!bankName && !accountNumber) throw new ApplicationError("PAYROLL_INVALID", "Employee bank information is empty. Complete the Employee profile first.");
    // Empty Employee fields never erase a previously saved payroll snapshot.
    const next = { bankName: bankName ?? before.bankName, accountNumber: accountNumber ?? before.accountNumber };
    const fields = (["bankName", "accountNumber"] as const).filter(key => next[key] !== before[key]);
    ensureChanged((await updatePayrollBankRecord(id, input.version, actor.id, next, tx)).count);
    await createAuditRecord({ actorId: actor.id, action: "PAYROLL_BANK_FILLED_FROM_EMPLOYEE", entityType: "Payslip", entityId: id,
      metadata: { fields, version: input.version + 1 } }, tx);
    const after = await findPayrollDetail(id, tx);
    if (!after) throw new ApplicationError("PAYROLL_CONFLICT", "Payslip changed. Reload before trying again.");
    return { slip: toPayrollDetail(after), message: bankName && accountNumber
      ? "Bank snapshot saved from Employee."
      : "Employee bank information is incomplete. Available fields were saved; existing values for empty fields were preserved." };
  });
}

export async function publishPayroll(rawId: unknown, raw: unknown) {
  const actor = await requireAdmin();
  const id = payslipIdSchema.parse(rawId), { version } = publishPayrollSchema.parse(raw);
  return inTransaction(async tx => {
    await lockActor(actor.id, tx);
    const row = await draftForMutation(id, version, tx);
    if (row.publishedAt || row.publishedById) throw new ApplicationError("PAYROLL_INVALID", "Draft publication metadata is inconsistent.");
    // Validate stored values without rounding fractions or changing snapshots.
    const checked = createPayrollDraftSchema.safeParse({ userId: row.userId, year: row.year, month: row.month,
      bankName: row.bankName, accountNumber: row.accountNumber,
      items: row.items.map(item => ({ name: item.name, category: item.category, amount: item.amount.toString(), sortOrder: item.sortOrder })) });
    if (!checked.success || !row.employeeNameSnapshot.trim() || !row.companyNameSnapshot.trim() || !row.companyAddressSnapshot.trim()
      || !row.templateVersion.trim() || row.items.some(item => item.origin !== "MASTER" && item.origin !== "CUSTOM")) {
      throw new ApplicationError("PAYROLL_INVALID", "Stored payslip data is invalid. Review the draft before publishing.");
    }
    const totals = calculate(checked.data.items);
    if (!totals.totalEarnings.equals(row.totalEarnings) || !totals.totalDeductions.equals(row.totalDeductions) || !totals.takeHomePay.equals(row.takeHomePay)) {
      throw new ApplicationError("PAYROLL_INVALID", "Stored totals do not match items. Review and save the draft before publishing.");
    }
    ensureChanged((await publishPayrollRecord(id, version, actor.id, new Date(), tx)).count);
    await createAuditRecord({ actorId: actor.id, action: "PAYROLL_PUBLISHED", entityType: "Payslip", entityId: id,
      metadata: { previousVersion: version, version: version + 1 } }, tx);
    const published = await findPayrollDetail(id, tx);
    if (!published) throw new ApplicationError("PAYROLL_CONFLICT", "Payslip changed. Reload before trying again.");
    return toPayrollDetail(published);
  });
}

export async function initializePayrollDrafts(raw: unknown) {
  const actor = await requireAdmin();
  const period = initializePayrollSchema.parse(raw);
  const components = await findPayrollInitializationComponents();
  if (!components.length) throw new ApplicationError("PAYROLL_INVALID", "Activate at least one master Payroll component before initialization.");
  if (components.length > 100) throw new ApplicationError("PAYROLL_INVALID", "More than 100 active master components. Reduce the active set before initialization.");
  const nextOrder = { EARNING: 0, DEDUCTION: 0 };
  const { items, ...totals } = calculate(components.map(component => ({ name: component.name,
    category: component.category, amount: "0", sortOrder: nextOrder[component.category]++ })));
  const operationId = randomUUID();
  await inTransaction(async tx => {
    await lockActor(actor.id, tx);
    await createAuditRecord({ actorId: actor.id, action: "PAYROLL_INITIALIZATION_STARTED",
      entityType: "PayrollInitialization", entityId: operationId,
      metadata: { ...period, componentCount: components.length } }, tx);
  });
  type Outcome = { userId: string; outcome: "created" | "skippedExisting" | "skippedIneligible" | "failed" | "unconfirmed" };
  const outcomes: Outcome[] = [];
  const summary = { operationId, period, status: "completed" as "completed" | "stopped",
    eligibleEmployeeCount: 0, createdCount: 0, skippedExistingCount: 0, skippedIneligibleCount: 0,
    failedCount: 0, unconfirmedCount: 0, remainingEmployeesProcessed: false,
    componentCount: components.length, message: "Initialization completed.", outcomes };
  const upper = await findPayrollEmployeeUpperBound();
  if (!upper) { summary.remainingEmployeesProcessed = true; return summary; }
  let afterId: string | undefined;
  while (true) {
    // Do not return payroll progress to an actor whose authorization has been revoked.
    await requireAdmin();
    let batch: Awaited<ReturnType<typeof listPayrollEmployeeBatch>>;
    try { batch = await listPayrollEmployeeBatch(upper.id, afterId); }
    catch {
      summary.status = "stopped";
      summary.message = "Employee lookup failed. Earlier committed drafts remain intact. Reload and initialize again to process remaining employees.";
      return summary;
    }
    if (!batch.length) break;
    for (const candidate of batch) {
      let eligibilityConfirmed = false;
      try {
        const outcome = await inTransaction(async tx => {
          await lockActor(actor.id, tx, candidate.id);
          const employee = await findUserById(candidate.id, tx);
          if (!employee || !employee.isActive || employee.role !== "USER") return "skippedIneligible" as const;
          eligibilityConfirmed = true;
          if (await findPayrollPeriodRecord(employee.id, period.year, period.month, tx)) return "skippedExisting" as const;
          const bank = await findEmployeeBankByUserId(employee.id, tx);
          const row = await createPayrollRecord({ userId: employee.id, ...period,
            employeeNameSnapshot: employee.name, employeePositionSnapshot: employee.position,
            ...companySnapshot, ...totals, bankName: bank?.bankName?.trim() || null, accountNumber: bank?.bankAccountNumber?.trim() || null,
            status: "DRAFT", createdById: actor.id, updatedById: actor.id,
            items: { create: items.map(item => ({ ...item, origin: "MASTER" as const })) } }, tx);
          await createAuditRecord({ actorId: actor.id, action: "PAYROLL_DRAFT_CREATED", entityType: "Payslip", entityId: row.id,
            metadata: { version: row.version, source: "BULK_INITIALIZATION", operationId,
              year: period.year, month: period.month,
              components: components.map(component => ({ id: component.id, version: component.version })) } }, tx);
          return "created" as const;
        });
        outcomes.push({ userId: candidate.id, outcome });
        if (outcome === "skippedIneligible") summary.skippedIneligibleCount++;
        else {
          summary.eligibleEmployeeCount++;
          if (outcome === "created") summary.createdCount++; else summary.skippedExistingCount++;
        }
      } catch (error) {
        if (error instanceof ApplicationError && ["UNAUTHENTICATED", "FORBIDDEN"].includes(error.code)) throw error;
        if (eligibilityConfirmed) summary.eligibleEmployeeCount++;
        if (isUniqueConstraintOn(error, "payslip_userId_year_month_key", ["userId", "year", "month"])) {
          summary.skippedExistingCount++;
          outcomes.push({ userId: candidate.id, outcome: "skippedExisting" });
          continue;
        }
        // Only known transaction rollback is counted as failed. A lost COMMIT response is ambiguous.
        const rolledBack = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
        if (rolledBack) summary.failedCount++; else summary.unconfirmedCount++;
        outcomes.push({ userId: candidate.id, outcome: rolledBack ? "failed" : "unconfirmed" });
        summary.status = "stopped";
        summary.message = "Initialization stopped. Earlier committed drafts remain intact. Reload authoritative Payroll data before retrying; unconfirmed outcomes may have committed.";
        await requireAdmin();
        return summary;
      }
    }
    afterId = batch[batch.length - 1].id;
  }
  await requireAdmin();
  summary.remainingEmployeesProcessed = true;
  return summary;
}
