import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/authorization/page-access";
import { getCorrectionHistory } from "@/services/attendance-correction.service";
import { formatAdminEventTime } from "@/lib/date-time/event-time";
import { PageHeading } from "@/components/shared/page-heading";
import { Button } from "@/components/ui/button";

export default async function CorrectionHistoryPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requirePageUser();
  if (user.role !== "USER") redirect("/admin");
  const history = await getCorrectionHistory(user.id, await searchParams);
  return <div className="space-y-4">
    <PageHeading title="Correction requests" description="Your historical attendance proposals and review status." />
    <Button asChild className="min-h-11"><Link href="/attendance/requests/new">Request Missing Attendance</Link></Button>
    <p className="text-sm text-muted-foreground">For a missing checkout, open an Incomplete record in the Attendance List tab. Pending requests leave Attendance unchanged until ADMIN approval.</p>
    {history.items.length ? <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
      {history.items.map(item => <li key={item.id}><Link href={`/attendance/requests/${item.id}`} className="block space-y-2 p-4 hover:bg-muted/50">
        <div className="flex flex-wrap justify-between gap-2 text-sm font-semibold"><span>{item.workDate}</span><span>{item.status}</span></div>
        <p className="text-sm">{item.type === "MISSING_BOTH" ? "Missing Attendance" : "Missing Checkout"}</p>
        <p className="text-xs text-muted-foreground">Submitted {formatAdminEventTime(item.createdAt, "Asia/Jakarta")}</p>
      </Link></li>)}
    </ul> : <p className="rounded-xl border bg-card p-4 text-sm">No correction requests on this page.</p>}
    <nav aria-label="Correction request pagination" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      {history.page > 1 && <Button asChild variant="outline" className="min-h-11"><Link href={`/attendance/requests?page=${history.page - 1}`}>Previous</Link></Button>}
      <span>Page {history.page} · {history.total} requests</span>
      {history.page * history.pageSize < history.total && <Button asChild variant="outline" className="min-h-11"><Link href={`/attendance/requests?page=${history.page + 1}`}>Next</Link></Button>}
    </nav>
  </div>;
}
