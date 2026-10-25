import Link from "next/link";
import { requirePageUser } from "@/lib/authorization/page-access";
import { getOwnOvertimeHistory } from "@/services/overtime.service";
import { formatAdminEventTime, formatBusinessDate, getLocalWorkDate } from "@/lib/date-time/event-time";
import { formatDurationMinutes } from "@/lib/date-time/format-duration";
import { UserOvertimeNavigation } from "@/components/overtime/user-overtime-navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requirePageUser();
  const result = await getOwnOvertimeHistory(await searchParams);
  return <div className="mx-auto w-full min-w-0 max-w-5xl space-y-5 [overflow-wrap:anywhere]">
    <header className="space-y-2"><h1 className="text-2xl font-semibold">Overtime History</h1><p className="text-sm text-muted-foreground">Session dates and event times are shown in WIB. The parent Attendance work date may differ from the date overtime started.</p></header>
    <UserOvertimeNavigation active="history" />
    {result.items.length ? <ul className="space-y-3">
      {result.items.map(item => <li key={item.id}><Card className="min-w-0 rounded-2xl"><CardContent className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="min-w-0 font-semibold">{formatBusinessDate(getLocalWorkDate(new Date(item.checkInAt), "Asia/Jakarta"))} <span className="text-xs font-normal text-muted-foreground">WIB</span></h2>
          <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ring-current/10 ${item.state === "Open" ? "bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-200" : item.state === "Completed" ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200"}`}>{item.state === "Open" ? "Active" : item.state}</span>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="min-w-0 space-y-1"><dt className="text-xs text-muted-foreground">OT Check-In</dt><dd className="font-medium">{formatAdminEventTime(item.checkInAt, "Asia/Jakarta")}</dd></div>
          <div className="min-w-0 space-y-1"><dt className="text-xs text-muted-foreground">OT Checkout</dt><dd className={item.checkOutAt ? "font-medium" : "text-muted-foreground"}>{item.checkOutAt ? formatAdminEventTime(item.checkOutAt, "Asia/Jakarta") : item.state === "Incomplete" ? "Missing Checkout" : "Not checked out yet"}</dd></div>
        </dl>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <div className="min-w-0 space-y-1">
            {item.checkOutAt && item.durationMinutes !== null && Number.isFinite(item.durationMinutes) && item.durationMinutes >= 0 && <p className="text-sm font-medium">Completed duration: {formatDurationMinutes(item.durationMinutes)}</p>}
            <p className="text-xs text-muted-foreground">Parent Attendance: {item.workDate} · WIB</p>
            {item.checkOutSource === "ADMIN_CORRECTION" && <p className="text-xs text-muted-foreground">ADMIN-corrected Checkout</p>}
          </div>
          <Button asChild variant="outline" className="min-h-11"><Link href={`/overtime/history/${item.id}`}>View details<span className="sr-only"> for overtime {formatAdminEventTime(item.checkInAt, "Asia/Jakarta")}</span></Link></Button>
        </div>
      </CardContent></Card></li>)}
    </ul> : <Card className="rounded-2xl"><CardContent className="space-y-2 py-6 text-center"><h2 className="font-semibold">No overtime sessions</h2><p className="text-sm text-muted-foreground">There are no overtime sessions on this page.</p></CardContent></Card>}
    <nav aria-label="Overtime history pagination" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      {result.page > 1 && <Button asChild variant="outline" className="min-h-11"><Link href={`/overtime/history?page=${result.page - 1}`}>Previous</Link></Button>}
      <span>Page {result.page} · {result.total} sessions</span>
      {result.page * result.pageSize < result.total && <Button asChild variant="outline" className="min-h-11"><Link href={`/overtime/history?page=${result.page + 1}`}>Next</Link></Button>}
    </nav>
  </div>;
}
