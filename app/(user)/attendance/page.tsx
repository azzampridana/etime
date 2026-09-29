import Link from "next/link";
import { AttendanceSummary } from "@/components/attendance/attendance-summary";
import { AttendanceEventForm } from "@/components/attendance/attendance-event-form";
import { OpenAttendanceWorkflow } from "@/components/attendance/open-attendance-workflow";
import { PageHeading } from "@/components/shared/page-heading";
import { requirePageUser } from "@/lib/authorization/page-access";
import { getCurrentAttendance, getAttendanceHistory } from "@/services/attendance.service";
import { getBusinessDate, formatBusinessDate, formatAdminEventTime } from "@/lib/date-time/event-time";

export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string; page?: string }> }) {
  const user = await requirePageUser();
  const query = await searchParams;
  const historyView = query.view === "history";
  const now = new Date();
  const attendance = historyView ? null : await getCurrentAttendance(user.id, () => now);
  const history = historyView ? await getAttendanceHistory(user.id, { page: query.page }, () => now) : null;
  return <>
    <PageHeading title="Attendance" description={formatBusinessDate(getBusinessDate(now))} />
    <nav aria-label="Attendance views" className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
      {[{ label: "Today", href: "/attendance", active: !historyView }, { label: "History", href: "/attendance?view=history", active: historyView }].map(item =>
        <Link key={item.label} href={item.href} aria-current={item.active ? "page" : undefined} className={`flex min-h-11 items-center justify-center rounded-md text-sm font-medium ${item.active ? "bg-background shadow-sm" : "text-muted-foreground"}`}>{item.label}</Link>)}
    </nav>
    {history ? <section aria-label="Attendance history" className="space-y-4">
      <h2 className="font-semibold">History</h2>
      {history.items.length ? <ul className="divide-y rounded-xl border bg-card">
        {history.items.map(item => <li key={item.id}>
          <Link href={`/attendance/${item.id}`} className="block space-y-2 p-4 [overflow-wrap:anywhere]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold">{item.workDate}</span>
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${item.state === "Completed" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>{item.state}</span>
            </div>
            <p className="text-sm">{formatAdminEventTime(item.checkInAt, item.checkInTimezone, true)} <span aria-hidden="true">→</span> {item.checkOutAt && item.checkOutTimezone ? formatAdminEventTime(item.checkOutAt, item.checkOutTimezone, true) : "Missing Checkout"}</p>
            <span className="text-xs text-muted-foreground">View details →</span>
          </Link>
        </li>)}
      </ul> : <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">No attendance records on this page.</p>}
      <nav aria-label="History pagination" className="flex flex-wrap items-center justify-between gap-3 text-sm">
        {history.page > 1 && <Link className="inline-flex min-h-11 items-center underline" href={`/attendance?view=history&page=${history.page - 1}`}>Previous</Link>}
        <span>Page {history.page} · {history.total} records</span>
        {history.page * history.pageSize < history.total && <Link className="inline-flex min-h-11 items-center underline" href={`/attendance?view=history&page=${history.page + 1}`}>Next</Link>}
      </nav>
    </section> : <div className="space-y-5">
      {attendance ? <AttendanceSummary attendance={attendance} /> : <div className="space-y-2">
        <h2 className="w-fit rounded-full bg-muted px-3 py-1 text-sm font-semibold text-muted-foreground">Not Checked In</h2>
        <p className="text-sm text-muted-foreground">You haven&apos;t checked in today.</p>
      </div>}
      {attendance?.isOpen ? <OpenAttendanceWorkflow key={attendance.id} attendanceId={attendance.id} report={attendance.dailyReport} /> : !attendance && <AttendanceEventForm key={getBusinessDate(now)} mode="check-in" />}
    </div>}
  </>;
}
