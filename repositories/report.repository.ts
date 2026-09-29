import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import { MAX_REPORT_EXPORT_ROWS } from "@/lib/reports/export-limit";
import { adminAttendanceOrder, adminAttendanceSelect, adminAttendanceWhere } from "@/repositories/attendance.repository";
import { overtimeSelect } from "@/repositories/overtime.repository";
import type { ReportQuery } from "@/schemas/report.schema";
import type { EmployeeReportQuery } from "@/schemas/report.schema";
import { MAX_EMPLOYEE_REPORT_DAYS } from "@/schemas/report.schema";

const reportSelect = {
  ...adminAttendanceSelect,
  user: { select: { id: true, name: true, email: true, position: true } },
  overtimeAuthorization: { select: { id: true, grantedAt: true, revokedAt: true, note: true, overtime: { select: overtimeSelect } } },
} satisfies Prisma.AttendanceSelect;
export type ReportRecord = Prisma.AttendanceGetPayload<{ select: typeof reportSelect }>;

export async function listReportRecords(input: ReportQuery) {
  const db = getPrisma(), where = adminAttendanceWhere(input);
  const [items, total] = await db.$transaction([
    db.attendance.findMany({ where, select: reportSelect, orderBy: adminAttendanceOrder, skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
    db.attendance.count({ where }),
  ]);
  return { items, total };
}

export function findReportExportRecords(input: ReportQuery) {
  // No UI skip/pageSize. The extra row detects overflow without an unbounded read
  // or a count/read race that could silently truncate an export.
  return getPrisma().attendance.findMany({ where: adminAttendanceWhere(input), select: reportSelect, orderBy: adminAttendanceOrder, take: MAX_REPORT_EXPORT_ROWS + 1 });
}

type DatabaseNumber = number | bigint | Prisma.Decimal;
export type EmployeeReportAggregate = {
  id: string; name: string; email: string; position: string | null;
  attendance: DatabaseNumber; completed: DatabaseNumber; incomplete: DatabaseNumber; working: DatabaseNumber;
  regularMinutes: DatabaseNumber; requiredMinutes: DatabaseNumber;
  overtimeSessions: DatabaseNumber; overtimeMinutes: DatabaseNumber;
};
function employeeReportWhere(input: EmployeeReportQuery) {
  return Prisma.sql`a.workDate >= ${input.from} AND a.workDate <= ${input.to}
    ${input.search ? Prisma.sql`AND (u.name LIKE ${`%${input.search}%`} OR u.email LIKE ${`%${input.search}%`})` : Prisma.empty}`;
}
function employeeAggregation(input: EmployeeReportQuery, today: string, employeeId?: string) {
  // Each joined relation is unique per Attendance/authorization; no fan-out.
  return Prisma.sql`SELECT u.id, u.name, u.email, u.position, COUNT(*) AS attendance,
    SUM(a.checkOutAt IS NOT NULL) AS completed,
    SUM(a.checkOutAt IS NULL AND a.workDate < ${today}) AS incomplete,
    SUM(a.checkOutAt IS NULL AND a.workDate = ${today}) AS working,
    SUM(CASE WHEN a.checkOutAt IS NOT NULL THEN FLOOR(TIMESTAMPDIFF(MICROSECOND, a.checkInAt, a.checkOutAt) / 60000000) ELSE 0 END) AS regularMinutes,
    SUM(CASE WHEN a.checkOutAt IS NOT NULL THEN a.requiredWorkMinutes ELSE 0 END) AS requiredMinutes,
    COUNT(o.id) AS overtimeSessions,
    SUM(CASE WHEN o.checkOutAt IS NOT NULL THEN FLOOR(TIMESTAMPDIFF(MICROSECOND, o.checkInAt, o.checkOutAt) / 60000000) ELSE 0 END) AS overtimeMinutes
    FROM Attendance a JOIN User u ON u.id = a.userId
    LEFT JOIN OvertimeAuthorization oa ON oa.attendanceId = a.id
    LEFT JOIN Overtime o ON o.authorizationId = oa.id
    WHERE ${employeeReportWhere(input)}
    ${employeeId ? Prisma.sql`AND u.id = ${employeeId}` : Prisma.empty}
    GROUP BY u.id, u.name, u.email, u.position`;
}
function employeeOrder(input: EmployeeReportQuery) {
  const fields = { employee: Prisma.sql`r.name`, attendance: Prisma.sql`r.attendance`, completed: Prisma.sql`r.completed`,
    incomplete: Prisma.sql`r.incomplete`, regular: Prisma.sql`r.regularMinutes`, average: Prisma.sql`r.regularMinutes / NULLIF(r.completed, 0)`,
    overtime: Prisma.sql`r.overtimeSessions`, overtimeHours: Prisma.sql`r.overtimeMinutes` };
  const direction = input.order === "desc" ? Prisma.sql`DESC` : Prisma.sql`ASC`;
  return input.sort && input.order ? Prisma.sql`${fields[input.sort]} ${direction}, r.id ${direction}` : Prisma.sql`r.name ASC, r.id ASC`;
}
export async function listEmployeeReportAggregates(input: EmployeeReportQuery, today: string) {
  const grouped = employeeAggregation(input, today);
  return getPrisma().$transaction(async tx => {
    const [totals] = await tx.$queryRaw<{ employees: DatabaseNumber; attendance: DatabaseNumber | null; regularMinutes: DatabaseNumber | null; overtimeMinutes: DatabaseNumber | null }[]>(Prisma.sql`
      SELECT COUNT(*) AS employees, SUM(r.attendance) AS attendance, SUM(r.regularMinutes) AS regularMinutes, SUM(r.overtimeMinutes) AS overtimeMinutes FROM (${grouped}) r`);
    const items = await tx.$queryRaw<EmployeeReportAggregate[]>(Prisma.sql`SELECT r.* FROM (${grouped}) r ORDER BY ${employeeOrder(input)} LIMIT ${input.pageSize} OFFSET ${(input.page - 1) * input.pageSize}`);
    return { totals, items };
  }, { isolationLevel: "RepeatableRead" });
}

const employeeDetailSelect = {
  id: true, workDate: true, checkInAt: true, checkInTimezone: true, checkOutAt: true, checkOutTimezone: true, requiredWorkMinutes: true,
  dailyReport: { select: { id: true } },
  overtimeAuthorization: { select: { overtime: { select: { id: true, checkInAt: true, checkInTimezone: true, checkOutAt: true, checkOutTimezone: true } } } },
} satisfies Prisma.AttendanceSelect;
export async function findEmployeeReportDetail(input: EmployeeReportQuery, employeeId: string, today: string) {
  return getPrisma().$transaction(async tx => {
    const [summary] = await tx.$queryRaw<EmployeeReportAggregate[]>(Prisma.sql`SELECT r.* FROM (${employeeAggregation(input, today, employeeId)}) r`);
    if (!summary) return null;
    // Unique (userId, workDate) plus the validated period bounds makes this a
    // complete date list, not a silently truncated lifetime history.
    const records = await tx.attendance.findMany({ where: { userId: employeeId,
      workDate: { gte: new Date(`${input.from}T00:00:00.000Z`), lte: new Date(`${input.to}T00:00:00.000Z`) } },
      select: employeeDetailSelect, orderBy: [{ workDate: "asc" }, { id: "asc" }], take: MAX_EMPLOYEE_REPORT_DAYS });
    return { summary, records };
  }, { isolationLevel: "RepeatableRead" });
}

export async function findEmployeeReportExport(input: EmployeeReportQuery, today: string) {
  return getPrisma().$transaction(async tx => {
    // Identical SQL predicate for page totals, detail eligibility and all export sheets.
    const ids = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT a.id FROM Attendance a JOIN User u ON u.id = a.userId
      WHERE ${employeeReportWhere(input)} ORDER BY u.name ASC, u.id ASC, a.workDate ASC, a.id ASC LIMIT ${MAX_REPORT_EXPORT_ROWS + 1}`);
    const rows = ids.length ? await tx.attendance.findMany({ where: { id: { in: ids.map(row => row.id) } }, select: reportSelect }) : [];
    const byId = new Map(rows.map(row => [row.id, row]));
    const records = ids.map(row => byId.get(row.id)!);
    // Do not aggregate an oversized export; the service reports the existing limit error.
    const summaries = records.length > MAX_REPORT_EXPORT_ROWS ? [] : await tx.$queryRaw<EmployeeReportAggregate[]>(Prisma.sql`
      SELECT r.* FROM (${employeeAggregation(input, today)}) r ORDER BY ${employeeOrder(input)} LIMIT ${MAX_REPORT_EXPORT_ROWS}`);
    return { records, summaries };
  }, { isolationLevel: "RepeatableRead" });
}
