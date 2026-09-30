import "server-only";
import { getOvertimeState } from "@/lib/overtime/state";
import { reportQuerySchema } from "@/schemas/report.schema";
import { listReportRecords, findReportExportRecords } from "@/repositories/report.repository";
import { toReportDto } from "@/mappers/report.mapper";
import { assertReportExportLimit } from "@/lib/reports/export-limit";
import { employeeReportQuerySchema, employeeReportDetailSchema } from "@/schemas/report.schema";
import { listEmployeeReportAggregates, findEmployeeReportDetail, findEmployeeReportExport, type EmployeeReportAggregate } from "@/repositories/report.repository";
import { getBusinessDate } from "@/lib/date-time/event-time";
import { elapsedWholeMinutes } from "@/lib/date-time/duration";
import { ApplicationError } from "@/lib/errors/application-error";
import type { EmployeeReportSummary, EmployeeReportDetail, EmployeeReportAttendance, EmployeeReportExportRow } from "@/types/report";

/** Internal reads: callers independently enforce current database-backed ADMIN access. */
export async function listReport(raw: unknown) {
  const input = reportQuerySchema.parse(raw);
  const result = await listReportRecords(input);
  return { items: result.items.map(toReportDto), total: result.total, page: input.page, pageSize: input.pageSize };
}

export async function getReportExport(raw: unknown) {
  const filters = reportQuerySchema.parse(raw);
  const records = await findReportExportRecords(filters);
  assertReportExportLimit(records.length);
  return { filters, items: records.map(toReportDto) };
}

function employeeSummary(row: EmployeeReportAggregate): EmployeeReportSummary {
  const completed = Number(row.completed), regularMinutes = Number(row.regularMinutes);
  const requiredMinutes = completed ? Number(row.requiredMinutes) : null;
  return { id: row.id, name: row.name, email: row.email, position: row.position,
    attendance: Number(row.attendance), completed, incomplete: Number(row.incomplete), working: Number(row.working),
    regularMinutes, averageMinutes: completed ? regularMinutes / completed : null, requiredMinutes,
    differenceMinutes: requiredMinutes === null ? null : regularMinutes - requiredMinutes,
    overtimeSessions: Number(row.overtimeSessions), overtimeMinutes: Number(row.overtimeMinutes) };
}
function reportAttendanceState(workDate: string, checkOutAt: Date | null, today: string): EmployeeReportAttendance["state"] {
  return checkOutAt ? "Completed" : workDate < today ? "Incomplete" : workDate === today ? "Working" : null;
}
export async function listEmployeeReport(raw: unknown) {
  const filters = employeeReportQuerySchema.parse(raw);
  const result = await listEmployeeReportAggregates(filters, getBusinessDate());
  const totals = { employees: Number(result.totals.employees), attendance: Number(result.totals.attendance ?? 0),
    regularMinutes: Number(result.totals.regularMinutes ?? 0), overtimeMinutes: Number(result.totals.overtimeMinutes ?? 0) };
  return { items: result.items.map(employeeSummary), totals, total: totals.employees, page: filters.page, pageSize: filters.pageSize };
}
export async function getEmployeeReportDetail(raw: unknown): Promise<EmployeeReportDetail> {
  const { employeeId, filters } = employeeReportDetailSchema.parse(raw);
  const now = new Date();
  const today = getBusinessDate(now);
  const result = await findEmployeeReportDetail(filters, employeeId, today);
  if (!result) throw new ApplicationError("REPORT_NOT_FOUND", "No attendance records found for this employee and period.");
  return { summary: employeeSummary(result.summary), from: filters.from, to: filters.to,
    attendance: result.records.map(row => {
      const workDate = row.workDate.toISOString().slice(0, 10);
      const actualMinutes = row.checkOutAt ? elapsedWholeMinutes(row.checkInAt, row.checkOutAt) : null;
      return { id: row.id, workDate, checkInAt: row.checkInAt.toISOString(), checkInTimezone: row.checkInTimezone,
        checkOutAt: row.checkOutAt?.toISOString() ?? null, checkOutTimezone: row.checkOutTimezone,
        actualMinutes, requiredMinutes: row.requiredWorkMinutes, differenceMinutes: actualMinutes === null ? null : actualMinutes - row.requiredWorkMinutes,
        state: reportAttendanceState(workDate, row.checkOutAt, today), hasDailyReport: row.dailyReport !== null };
    }),
    overtime: result.records.flatMap(row => {
      const ot = row.overtimeAuthorization?.overtime;
      const state = ot ? getOvertimeState(ot, now) : null;
      return ot ? [{ id: ot.id, workDate: row.workDate.toISOString().slice(0, 10), checkInAt: ot.checkInAt.toISOString(), checkInTimezone: ot.checkInTimezone,
        checkOutAt: ot.checkOutAt?.toISOString() ?? null, checkOutTimezone: ot.checkOutTimezone,
        durationMinutes: ot.checkOutAt ? elapsedWholeMinutes(ot.checkInAt, ot.checkOutAt) : null,
        state: state === "Incomplete" ? "Incomplete" as const : state === "Completed" ? "Completed" as const : "In Progress" as const }] : [];
    }),
  };
}
export async function getEmployeeReportExport(raw: unknown) {
  const filters = employeeReportQuerySchema.parse(raw);
  const today = getBusinessDate();
  const result = await findEmployeeReportExport(filters, today);
  assertReportExportLimit(result.records.length);
  const items: EmployeeReportExportRow[] = result.records.map(row => {
    const item = toReportDto(row);
    return { ...item, employee: { ...item.employee, position: row.user.position }, state: reportAttendanceState(item.workDate, row.checkOutAt, today) };
  });
  return { filters, items, summaries: result.summaries.map(employeeSummary) };
}
