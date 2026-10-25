import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { OvertimeRequestStatus } from "@/components/admin/overtime-requests/status";
import { getOvertimeCorrectionHistory } from "@/services/overtime-correction.service";
import { formatAdminEventTime } from "@/lib/date-time/event-time";

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const history = await getOvertimeCorrectionHistory(await searchParams);
  return <div className="mx-auto w-full min-w-0 max-w-5xl space-y-5 [overflow-wrap:anywhere]">
    <Button asChild variant="outline" className="min-h-11 max-w-full whitespace-normal text-center"><Link href="/overtime/history" >Back to Overtime History</Link></Button>
    <h1 className="text-2xl font-semibold">Overtime correction requests</h1>
    <p className="text-sm text-muted-foreground">For a missing Checkout, open the session in Overtime History. Requests do not automatically approve payable overtime hours.</p>
    {history.items.length ? <ul className="space-y-3">
      {history.items.map(item => <li key={item.id}><Card className="rounded-2xl"><CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Missing Checkout</h2><OvertimeRequestStatus status={item.status} /></div>
        <div><p className="text-xs text-muted-foreground">Proposed Checkout · WIB</p><p className="mt-1 font-medium">{formatAdminEventTime(item.proposedCheckOutAt, "Asia/Jakarta")}</p></div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <p className="text-xs text-muted-foreground">Submitted {formatAdminEventTime(item.createdAt, "Asia/Jakarta")}</p>
          <Button asChild variant="outline" className="min-h-11"><Link href={`/overtime/requests/${item.id}`}>View request</Link></Button>
        </div>
      </CardContent></Card></li>)}
    </ul> : <Card><CardContent className="space-y-2 py-4 text-center"><h2 className="font-semibold">No requests on this page</h2><p className="text-sm text-muted-foreground">Open an incomplete session in Overtime History to request a missing Checkout.</p></CardContent></Card>}
    <nav aria-label="Overtime correction pagination" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      {history.page > 1 && <Button asChild variant="outline" className="min-h-11 max-w-full whitespace-normal text-center"><Link  href={`/overtime/requests?page=${history.page - 1}`}>Previous</Link></Button>}
      <span>Page {history.page} · {history.total} requests</span>
      {history.page * history.pageSize < history.total && <Button asChild variant="outline" className="min-h-11 max-w-full whitespace-normal text-center"><Link  href={`/overtime/requests?page=${history.page + 1}`}>Next</Link></Button>}
    </nav>
  </div>;
}
