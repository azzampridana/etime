import type { PayrollComponentRecord } from "@/repositories/payroll-component.repository";

export function toPayrollComponent(row: PayrollComponentRecord) {
  return { id: row.id, name: row.name, category: row.category, sortOrder: row.sortOrder,
    isActive: row.isActive, version: row.version,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
