import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import type { DatabaseTransaction } from "@/lib/db/transaction";
import type { ListPayrollInput } from "@/schemas/payroll.schema";

const summarySelect = {
  id: true, userId: true, year: true, month: true, status: true,
  employeeNameSnapshot: true, employeePositionSnapshot: true,
  totalEarnings: true, totalDeductions: true, takeHomePay: true,
  version: true, createdAt: true, updatedAt: true, publishedAt: true,
} satisfies Prisma.PayslipSelect;
const detailSelect = {
  ...summarySelect, companyNameSnapshot: true, companyAddressSnapshot: true,
  companyEmailSnapshot: true, companyPhoneSnapshot: true,
  bankName: true, accountNumber: true, templateVersion: true, publishedById: true,
  items: { select: { id: true, origin: true, name: true, category: true, amount: true, sortOrder: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { id: "asc" }] },
} satisfies Prisma.PayslipSelect;
export type PayrollSummaryRecord = Prisma.PayslipGetPayload<{ select: typeof summarySelect }>;
export type PayrollDetailRecord = Prisma.PayslipGetPayload<{ select: typeof detailSelect }>;

export async function listPayrollRecords(input: ListPayrollInput) {
  const where: Prisma.PayslipWhereInput = {
    year: input.year, month: input.month, status: input.status, userId: input.userId,
  };
  return getPrisma().$transaction(async tx => {
    const items = await tx.payslip.findMany({ where, select: summarySelect,
      orderBy: [{ year: "desc" }, { month: "desc" }, { id: "desc" }],
      skip: (input.page - 1) * input.pageSize, take: input.pageSize });
    const total = await tx.payslip.count({ where });
    return { items, total };
  });
}
export function findPayrollDetail(id: string, tx?: DatabaseTransaction) {
  return (tx ?? getPrisma()).payslip.findUnique({ where: { id }, select: detailSelect });
}
export function findUserPublishedPayslip(userId: string, id: string) {
  return getPrisma().payslip.findFirst({ where: { id, userId, status: "PUBLISHED" }, select: detailSelect });
}
export function listUserPublishedPayslips(userId: string, page: number, pageSize: number) {
  const where: Prisma.PayslipWhereInput = { userId, status: "PUBLISHED" };
  return getPrisma().$transaction(async tx => {
    const orderBy: Prisma.PayslipOrderByWithRelationInput[] = [{ year: "desc" }, { month: "desc" }, { id: "desc" }];
    const total = await tx.payslip.count({ where });
    const currentPage = Math.min(page, Math.max(1, Math.ceil(total / pageSize)));
    const items = await tx.payslip.findMany({ where, select: summarySelect, orderBy, skip: (currentPage - 1) * pageSize, take: pageSize });
    const latest = await tx.payslip.findFirst({ where, select: summarySelect, orderBy });
    return { items, latest, total, page: currentPage, pageSize };
  });
}
export async function lockPayrollRecord(id: string, tx: DatabaseTransaction) {
  await tx.$queryRaw`SELECT id FROM payslip WHERE id = ${id} FOR UPDATE`;
}
export function createPayrollRecord(data: Prisma.PayslipUncheckedCreateInput, tx: DatabaseTransaction) {
  return tx.payslip.create({ data, select: detailSelect });
}
export function updatePayrollRecord(id: string, version: number, data: {
  bankName: string | null; accountNumber: string | null; updatedById: string;
  totalEarnings: Prisma.Decimal; totalDeductions: Prisma.Decimal; takeHomePay: Prisma.Decimal;
}, tx: DatabaseTransaction) {
  return tx.payslip.updateMany({ where: { id, version, status: "DRAFT" },
    data: { ...data, version: { increment: 1 } } });
}
export function updatePayrollBankRecord(id: string, version: number, actorId: string,
  bank: { bankName: string | null; accountNumber: string | null }, tx: DatabaseTransaction) {
  return tx.payslip.updateMany({ where: { id, version, status: "DRAFT" },
    data: { ...bank, updatedById: actorId, version: { increment: 1 } } });
}
export async function reconcilePayrollItems(payslipId: string, items: {
  id?: string; origin: "MASTER" | "CUSTOM";
  name: string; category: "EARNING" | "DEDUCTION"; amount: Prisma.Decimal; sortOrder: number;
}[], tx: DatabaseTransaction) {
  // Parent lock is held by the service. Stage retained CUSTOM orders below the
  // valid input range so category/order swaps cannot collide with the unique key.
  const custom = items.filter(item => item.origin === "CUSTOM" && item.id);
  for (const [index, item] of custom.entries()) {
    if (item.id) await tx.payslipItem.update({ where: { id: item.id, payslipId, origin: "CUSTOM" }, data: { sortOrder: -1 - index } });
  }
  const retainedIds = items.flatMap(item => item.id ? [item.id] : []);
  await tx.payslipItem.deleteMany({ where: { payslipId, origin: "CUSTOM", id: { notIn: retainedIds } } });
  for (const item of items) {
    if (item.id) {
      await tx.payslipItem.update({ where: { id: item.id, payslipId, origin: item.origin },
        data: item.origin === "MASTER" ? { amount: item.amount }
          : { name: item.name, category: item.category, amount: item.amount, sortOrder: item.sortOrder } });
    } else {
      await tx.payslipItem.create({ data: { payslipId, origin: "CUSTOM", name: item.name,
        category: item.category, amount: item.amount, sortOrder: item.sortOrder } });
    }
  }
}
export function deletePayrollRecord(id: string, version: number, tx: DatabaseTransaction) {
  return tx.payslip.deleteMany({ where: { id, version, status: "DRAFT" } });
}
export function publishPayrollRecord(id: string, version: number, actorId: string, publishedAt: Date, tx: DatabaseTransaction) {
  return tx.payslip.updateMany({ where: { id, version, status: "DRAFT" }, data: {
    status: "PUBLISHED", publishedAt, publishedById: actorId, updatedById: actorId, version: { increment: 1 },
  } });
}

// Initialization uses a high-water ID and keyset pages, never an unbounded employee read.
export function findPayrollEmployeeUpperBound() {
  return getPrisma().user.findFirst({ where: { role: "USER", isActive: true }, orderBy: { id: "desc" }, select: { id: true } });
}
export function listPayrollEmployeeBatch(upperId: string, afterId?: string) {
  return getPrisma().user.findMany({ where: { role: "USER", isActive: true,
    id: { lte: upperId, ...(afterId ? { gt: afterId } : {}) } },
    orderBy: { id: "asc" }, take: 50, select: { id: true } });
}
export function findPayrollPeriodRecord(userId: string, year: number, month: number, tx: DatabaseTransaction) {
  return tx.payslip.findUnique({ where: { userId_year_month: { userId, year, month } }, select: { id: true } });
}
