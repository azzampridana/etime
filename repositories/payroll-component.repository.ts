import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import type { DatabaseTransaction } from "@/lib/db/transaction";
import type { CreatePayrollComponentInput, ListPayrollComponentsInput } from "@/schemas/payroll-component.schema";

const select = { id: true, name: true, category: true, sortOrder: true, isActive: true,
  version: true, createdAt: true, updatedAt: true } satisfies Prisma.PayrollComponentSelect;
export type PayrollComponentRecord = Prisma.PayrollComponentGetPayload<{ select: typeof select }>;

export function listPayrollComponentRecords(input: ListPayrollComponentsInput) {
  const where = { category: input.category, isActive: input.isActive };
  return getPrisma().$transaction(async tx => {
    const items = await tx.payrollComponent.findMany({ where, select,
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
      skip: (input.page - 1) * input.pageSize, take: input.pageSize });
    return { items, total: await tx.payrollComponent.count({ where }) };
  });
}
export function createPayrollComponentRecord(data: CreatePayrollComponentInput, tx: DatabaseTransaction) {
  return tx.payrollComponent.create({ data, select });
}
export function findPayrollComponent(id: string, tx: DatabaseTransaction) {
  return tx.payrollComponent.findUnique({ where: { id }, select });
}

// One statement gives a consistent master snapshot; 101 detects overflow without truncating silently.
export function findPayrollInitializationComponents() {
  return getPrisma().payrollComponent.findMany({ where: { isActive: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { id: "asc" }], take: 101,
    select: { id: true, name: true, category: true, sortOrder: true, version: true } });
}
export async function lockPayrollComponent(id: string, tx: DatabaseTransaction) {
  await tx.$queryRaw`SELECT id FROM payrollcomponent WHERE id = ${id} FOR UPDATE`;
}
export function updatePayrollComponentRecord(id: string, version: number,
  data: CreatePayrollComponentInput | { isActive: false }, tx: DatabaseTransaction) {
  return tx.payrollComponent.updateMany({ where: { id, version }, data: { ...data, version: { increment: 1 } } });
}
