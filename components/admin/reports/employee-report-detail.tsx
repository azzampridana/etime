import { ReportMetrics } from "@/components/admin/reports/report-metrics";
import { formatAdminEventTime } from "@/lib/date-time/event-time";
import { formatDurationMinutes, formatSignedDurationMinutes } from "@/lib/date-time/format-duration";
import type { EmployeeReportDetail } from "@/types/report";

const tableClass = "w-full text-left text-sm [&_th]:border-b [&_th]:bg-muted/50 [&_th]:px-3 [&_th]:py-2 [&_td]:border-b [&_td]:px-3 [&_td]:py-2 [&_tr:last-child_td]:border-0";
const duration = (value: number | null) => value === null ? "—" : formatDurationMinutes(value);
const time = (at: string | null, zone: string | null) => at && zone ? formatAdminEventTime(at, zone) : "Missing Checkout";

export function EmployeeReportDetailView({ item }: { item: EmployeeReportDetail }) {
  const summary = item.summary;
  return <div className="min-w-0 space-y-4">
    <div className="break-words"><p className="text-lg font-semibold">{summary.name}</p>{summary.position && <p className="text-sm text-muted-foreground">{summary.position}</p>}<p className="mt-1 text-sm">{item.from} – {item.to}</p></div>
    <ReportMetrics items={[["Attendance", summary.attendance], ["Completed", summary.completed], ["Incomplete", summary.incomplete], ["Working", summary.working],
      ["Regular Hours (actual)", duration(summary.regularMinutes)], ["Average Hours", duration(summary.averageMinutes === null ? null : Math.round(summary.averageMinutes))],
      ["Required (completed records)", duration(summary.requiredMinutes)], ["Difference (completed records)", summary.differenceMinutes === null ? "—" : formatSignedDurationMinutes(summary.differenceMinutes)],
      ["OT Sessions", summary.overtimeSessions], ["OT Hours", duration(summary.overtimeMinutes)]]} />
    <p className="text-xs text-muted-foreground">Required and Difference compare completed regular records only. Average uses completed records and is displayed to the nearest minute. Regular and overtime hours are separate.</p>
    <section className="min-w-0 space-y-2"><h2 className="font-semibold">Attendance Dates</h2>
      <div className="max-w-full overflow-x-auto rounded-xl border" role="region" aria-label="Attendance dates" tabIndex={0}><table className={tableClass}>
        <thead><tr>{["Date", "Check In", "Check Out", "Duration", "Required", "Difference", "Status", "Daily Report"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{item.attendance.map(row => <tr key={row.id}>
          <td className="whitespace-nowrap">{row.workDate}</td><td className="min-w-44">{time(row.checkInAt, row.checkInTimezone)}</td><td className="min-w-44">{time(row.checkOutAt, row.checkOutTimezone)}</td>
          <td className="whitespace-nowrap">{duration(row.actualMinutes)}</td><td className="whitespace-nowrap">{duration(row.requiredMinutes)}</td>
          <td className="whitespace-nowrap">{row.differenceMinutes === null ? "—" : formatSignedDurationMinutes(row.differenceMinutes)}</td><td>{row.state ?? "—"}</td>
          <td><span aria-label={row.hasDailyReport ? "Daily Report available" : "No Daily Report"}>{row.hasDailyReport ? "✓" : "—"}</span></td>
        </tr>)}</tbody>
      </table></div>
    </section>
    <section className="min-w-0 space-y-2"><h2 className="font-semibold">Overtime</h2>
      {!item.overtime.length ? <p className="text-sm text-muted-foreground">No overtime activity recorded for this period.</p> : <div className="max-w-full overflow-x-auto rounded-xl border" role="region" aria-label="Overtime report" tabIndex={0}><table className={tableClass}>
        <thead><tr>{["Work Date", "Check In", "Check Out", "Duration", "Status"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{item.overtime.map(row => <tr key={row.id}><td className="whitespace-nowrap">{row.workDate}</td><td>{time(row.checkInAt, row.checkInTimezone)}</td><td>{row.checkOutAt ? time(row.checkOutAt, row.checkOutTimezone) : row.state === "Incomplete" ? "Missing Checkout" : "—"}</td><td className="whitespace-nowrap">{duration(row.durationMinutes)}</td><td className="whitespace-nowrap">{row.state}</td></tr>)}</tbody>
      </table></div>}
    </section>
  </div>;
}
