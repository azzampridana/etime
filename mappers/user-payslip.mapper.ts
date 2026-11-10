import type { PayrollDetailRecord, PayrollSummaryRecord } from "@/repositories/payroll.repository";

export function toUserPayslipSummary(row: PayrollSummaryRecord) {
  return { id: row.id, year: row.year, month: row.month, status: "PUBLISHED" as const,
    totalEarnings: row.totalEarnings.toFixed(0), totalDeductions: row.totalDeductions.toFixed(0),
    takeHomePay: row.takeHomePay.toFixed(0) };
}
export function toUserPayslipDetail(row: PayrollDetailRecord) {
  return { ...toUserPayslipSummary(row), employeeName: row.employeeNameSnapshot,
    employeePosition: row.employeePositionSnapshot, bankName: row.bankName,
    maskedAccountNumber: row.accountNumber ? (row.accountNumber.length > 4 ? `•••• ${row.accountNumber.slice(-4)}` : "••••") : null,
    items: row.items.map(item => ({ id: item.id, name: item.name, category: item.category, amount: item.amount.toFixed(0) })) };
}
