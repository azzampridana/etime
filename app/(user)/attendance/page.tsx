import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDurationMinutes } from "@/lib/date-time/format-duration";
import { AttendanceSummary } from "@/components/attendance/attendance-summary";
import { UserAttendanceNavigation } from "@/components/attendance/user-attendance-navigation";
import { AttendanceProvenanceNote } from "@/components/attendance/attendance-provenance";
import { AttendanceEventForm } from "@/components/attendance/attendance-event-form";
import { OpenAttendanceWorkflow } from "@/components/attendance/open-attendance-workflow";
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
  return <div className="mx-auto w-full min-w-0 max-w-5xl space-y-5 [overflow-wrap:anywhere]">
    <header className="space-y-1.5"><h1 className="text-2xl font-semibold tracking-tight">Attendance</h1><p className="text-sm text-muted-foreground">{formatBusinessDate(getBusinessDate(now))} · WIB</p></header>
    <UserAttendanceNavigation active={historyView ? "list" : "today"} />
    {history ? <section aria-label="Attendance history" className="space-y-4">
      <div className="space-y-1"><h2 className="font-semibold">History</h2><p className="text-xs text-muted-foreground">Attendance dates are in WIB. Event times use the recorded event timezone.</p></div>
      {history.items.length ? <ul className="space-y-3">
        {history.items.map(item => <li key={item.id}>
          <Card className="min-w-0 rounded-2xl"><CardContent className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="min-w-0 flex-1 text-sm font-semibold">{formatBusinessDate(item.workDate)}</h3>
              <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ring-current/10 ${item.state === "Completed" ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : item.state === "Working" ? "bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-200" : "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200"}`}>{item.state}</span>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="mb-1 text-xs text-muted-foreground">Check In</dt><dd className="font-medium tabular-nums">{formatAdminEventTime(item.checkInAt, item.checkInTimezone, true)}</dd></div>
              <div><dt className="mb-1 text-xs text-muted-foreground">Check Out</dt><dd className="font-medium tabular-nums">{item.checkOutAt ? item.checkOutTimezone ? formatAdminEventTime(item.checkOutAt, item.checkOutTimezone, true) : "Recorded · timezone unavailable" : item.state === "Incomplete" ? "Missing Checkout" : "Not checked out yet"}</dd></div>
            </dl>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
              <div className="min-w-0 space-y-1">
                {item.checkOutAt && item.actualDurationMinutes !== null && Number.isFinite(item.actualDurationMinutes) && item.actualDurationMinutes >= 0 && <p className="text-sm font-medium">Duration: {formatDurationMinutes(item.actualDurationMinutes)}</p>}
                <AttendanceProvenanceNote {...item} />
              </div>
              <Button asChild variant="outline" className="min-h-11"><Link href={`/attendance/${item.id}`}>View details<span className="sr-only"> for {item.workDate}</span></Link></Button>
            </div>
          </CardContent></Card>
        </li>)}
      </ul> : <Card className="rounded-2xl"><CardContent className="space-y-2 py-4 text-center"><h3 className="font-semibold">No attendance records</h3><p className="text-sm text-muted-foreground">There are no attendance records on this page.</p></CardContent></Card>}
      <nav aria-label="History pagination" className="flex flex-wrap items-center justify-between gap-3 text-sm">
        {history.page > 1 && <Button asChild variant="outline" className="min-h-11"><Link href={`/attendance?view=history&page=${history.page - 1}`}>Previous</Link></Button>}
        <span>Page {history.page} · {history.total} records</span>
        {history.page * history.pageSize < history.total && <Button asChild variant="outline" className="min-h-11"><Link href={`/attendance?view=history&page=${history.page + 1}`}>Next</Link></Button>}
      </nav>
    </section> : <div className="space-y-4">
      {attendance ? <AttendanceSummary attendance={attendance} compact /> : <Card className="rounded-2xl"><CardContent className="space-y-2">
        <h2 className="w-fit rounded-full bg-muted px-3 py-1 text-sm font-semibold text-muted-foreground">Not Checked In</h2>
        <p className="text-sm text-muted-foreground">You haven&apos;t checked in today.</p>
      </CardContent></Card>}
      {attendance?.isOpen ? <OpenAttendanceWorkflow key={attendance.id} attendanceId={attendance.id} report={attendance.dailyReport} /> : !attendance && <AttendanceEventForm key={getBusinessDate(now)} mode="check-in" />}
    </div>}
  </div>;
}
