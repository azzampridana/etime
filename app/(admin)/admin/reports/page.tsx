import { PageHeading } from "@/components/shared/page-heading";
import { Pagination } from "@/components/admin/pagination";
import { UserPageSize } from "@/components/admin/users/user-page-size";
import { ReportTable } from "@/components/admin/reports/report-table";
import { ReportFilters } from "@/components/admin/reports/report-filters";
import { ReportMetrics } from "@/components/admin/reports/report-metrics";
import { InvalidFilters } from "@/components/admin/invalid-filters";
import { requirePageUser } from "@/lib/authorization/page-access";
import { MAX_REPORT_EXPORT_ROWS } from "@/lib/reports/export-limit";
import { formatDurationMinutes } from "@/lib/date-time/format-duration";
import { employeeReportQuerySchema, MAX_EMPLOYEE_REPORT_DAYS } from "@/schemas/report.schema";
import type { AdminSearchParams } from "@/schemas/admin-query.schema";
import { listEmployeeReport } from "@/services/report.service";

export default async function Page({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  await requirePageUser(true);
  const parsed = employeeReportQuerySchema.safeParse(await searchParams);
  if (!parsed.success) return <><PageHeading title="Reports" /><p className="mb-3 text-sm">Select a valid period of at most {MAX_EMPLOYEE_REPORT_DAYS} days.</p><InvalidFilters path="/admin/reports" /></>;
  const input = parsed.data;
  const result = await listEmployeeReport(input);
  return <><PageHeading title="Reports" description={`${input.from} – ${input.to} · Attendance work dates (Asia/Jakarta). Employee summaries of recorded activity.`} />
    <ReportFilters input={input} />
    <ReportMetrics items={[["Employees", result.totals.employees], ["Attendance Records", result.totals.attendance], ["Regular Work Hours", formatDurationMinutes(result.totals.regularMinutes)], ["Overtime Hours", formatDurationMinutes(result.totals.overtimeMinutes)]]} />
    <p className="mb-3 text-xs text-muted-foreground">Attendance counts actual records. Current-day Working records are neither Completed nor Incomplete. Average hours use completed records, displayed to the nearest minute.</p>
    <ReportTable items={result.items} query={input} /><Pagination path="/admin/reports" query={input} {...result} compact pageSizeControl={<UserPageSize path="/admin/reports" pageSize={input.pageSize} query={input} />} />
    <p className="mt-4 text-xs text-muted-foreground">Select up to {MAX_EMPLOYEE_REPORT_DAYS} days. Excel exports the full filtered result, up to {MAX_REPORT_EXPORT_ROWS.toLocaleString("en-US")} Attendance records; each of its three worksheets contains at most that many data rows. Narrow filters if the export limit is exceeded.</p>
  </>;
}
