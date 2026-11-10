import type { EmployeeDetailRecord, EmployeeSummaryRecord } from "@/repositories/employee.repository";

export function toEmployeeSummary(row: EmployeeSummaryRecord) {
  return { id: row.id, fullName: row.fullName, jobTitle: row.jobTitle, employeeNumber: row.employeeNumber,
    employmentStatus: row.employmentStatus, joinDate: row.joinDate?.toISOString().slice(0, 10) ?? null,
    user: row.user, bankComplete: Boolean(row.bankName && row.bankAccountNumber && row.bankAccountHolder) };
}
export function toEmployeeDetail(row: EmployeeDetailRecord) {
  return { ...toEmployeeSummary(row), version: row.version, nik: row.nik, phoneNumber: row.phoneNumber,
    npwp: row.npwp, placeOfBirth: row.placeOfBirth, dateOfBirth: row.dateOfBirth?.toISOString().slice(0, 10) ?? null,
    gender: row.gender, maritalStatus: row.maritalStatus, employmentType: row.employmentType,
    bpjsKesehatanNumber: row.bpjsKesehatanNumber, bpjsKetenagakerjaanNumber: row.bpjsKetenagakerjaanNumber,
    address: row.address, employmentEndDate: row.employmentEndDate?.toISOString().slice(0, 10) ?? null,
    bankName: row.bankName, bankAccountNumber: row.bankAccountNumber, bankAccountHolder: row.bankAccountHolder };
}
