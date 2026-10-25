import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { requirePageUser } from "@/lib/authorization/page-access";
import { getAdminOvertimeCorrectionList } from "@/services/admin-overtime-correction.service";
import { adminOvertimeCorrectionQuerySchema } from "@/schemas/overtime-correction.schema";
import { PageHeading } from "@/components/shared/page-heading";
import { InvalidFilters } from "@/components/admin/invalid-filters";
import { OvertimeRequestStatus } from "@/components/admin/overtime-requests/status";
import { formatAdminEventTime } from "@/lib/date-time/event-time";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageUser(true);
  const parsed = adminOvertimeCorrectionQuerySchema.safeParse(await searchParams);
  if (!parsed.success) return <><PageHeading title="Overtime Requests" /><InvalidFilters path="/admin/overtime-requests" /></>;
  const result = await getAdminOvertimeCorrectionList(parsed.data);
  const query = `status=${result.status}&page=${result.page}`;
  return <div className="mx-auto w-full min-w-0 max-w-5xl space-y-5 [overflow-wrap:anywhere]">
    <PageHeading title="Overtime Requests" description="Review missing Checkout proposals. All times below use WIB / Asia/Jakarta." />
    <nav aria-label="Request status" className="flex flex-wrap gap-2 rounded-xl bg-muted/50 p-2">
      {(["PENDING", "APPROVED", "REJECTED"] as const).map(status => <Button key={status} asChild variant={result.status === status ? "default" : "ghost"} className="min-h-11 flex-1 sm:flex-none"><Link href={`/admin/overtime-requests?status=${status}`}
        aria-current={result.status === status ? "page" : undefined}>{status}</Link></Button>)}
    </nav>
    {!result.items.length ? <Card><CardContent className="space-y-2 py-5 text-center"><h2 className="font-semibold">No matching requests</h2><p className="text-muted-foreground">No requests match this filter on this page.</p></CardContent></Card> :
      <ul className="space-y-3">{result.items.map(item => <li key={item.id}><Card><CardContent className="grid min-w-0 gap-3 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{item.employee.name}</h2><OvertimeRequestStatus status={item.status} /></div>
        {item.employee.position && <p className="text-muted-foreground">{item.employee.position}</p>}{!item.employee.isActive && <p className="text-destructive">Inactive employee</p>}
        </div><div className="min-w-0 space-y-1"><p className="text-xs text-muted-foreground">Proposed Checkout · WIB</p><p className="font-medium">{formatAdminEventTime(item.proposedCheckOutAt, "Asia/Jakarta")}</p>
        <p className="text-xs text-muted-foreground">Submitted {formatAdminEventTime(item.createdAt, "Asia/Jakarta")}</p>
        <details className="text-xs text-muted-foreground"><summary className="cursor-pointer rounded py-1 focus-visible:outline-2 focus-visible:outline-ring">Session reference</summary><p className="break-all py-1">{item.overtimeId}</p></details></div>
        <Button asChild variant="outline" className="min-h-11 max-w-full whitespace-normal text-center"><Link href={`/admin/overtime-requests/${item.id}?${query}`} >Review request</Link></Button>
      </CardContent></Card></li>)}</ul>}
    <nav aria-label="Request pagination" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      {result.page > 1 && <Button asChild variant="outline" className="min-h-11 max-w-full whitespace-normal text-center"><Link  href={`/admin/overtime-requests?status=${result.status}&page=${result.page - 1}`}>Previous</Link></Button>}
      <span>Page {result.page} · {result.total} requests</span>
      {result.page * result.pageSize < result.total && <Button asChild variant="outline" className="min-h-11 max-w-full whitespace-normal text-center"><Link  href={`/admin/overtime-requests?status=${result.status}&page=${result.page + 1}`}>Next</Link></Button>}
    </nav>
  </div>;
}
