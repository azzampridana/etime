import type { PayrollDetailRecord, PayrollSummaryRecord } from "@/repositories/payroll.repository";

export function toPayrollSummary(row: PayrollSummaryRecord) {
  return {
    id: row.id, userId: row.userId, year: row.year, month: row.month, status: row.status,
    employeeNameSnapshot: row.employeeNameSnapshot, employeePositionSnapshot: row.employeePositionSnapshot,
    totalEarnings: row.totalEarnings.toFixed(0), totalDeductions: row.totalDeductions.toFixed(0),
    takeHomePay: row.takeHomePay.toFixed(0), version: row.version,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
  };
}
export function toPayrollDetail(row: PayrollDetailRecord) {
  return { ...toPayrollSummary(row),
    companyNameSnapshot: row.companyNameSnapshot, companyAddressSnapshot: row.companyAddressSnapshot,
    companyEmailSnapshot: row.companyEmailSnapshot, companyPhoneSnapshot: row.companyPhoneSnapshot,
    bankName: row.bankName, accountNumber: row.accountNumber, templateVersion: row.templateVersion,
    items: row.items.map(item => ({ id: item.id, origin: item.origin, name: item.name, category: item.category,
      amount: item.amount.toFixed(0), sortOrder: item.sortOrder })),
  };
}
