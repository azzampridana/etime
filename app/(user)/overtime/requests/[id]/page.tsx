import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { OvertimeRequestStatus } from "@/components/admin/overtime-requests/status";
import { notFound } from "next/navigation";
import { getOvertimeCorrectionDetail } from "@/services/overtime-correction.service";
import { formatAdminEventTime } from "@/lib/date-time/event-time";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const item = await getOvertimeCorrectionDetail((await params).id);
  if (!item) notFound();
  const time = (at: string | null) => at ? formatAdminEventTime(at, "Asia/Jakarta") : "Not available";
  return <div className="mx-auto w-full min-w-0 max-w-5xl space-y-5 [overflow-wrap:anywhere]">
    <Button asChild variant="outline" className="min-h-11 max-w-full whitespace-normal text-center"><Link href="/overtime/requests" >Back to requests</Link></Button>
    <h1 className="text-2xl font-semibold">Missing Overtime Checkout</h1>
    <Card className="min-w-0 rounded-2xl"><CardContent className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Checkout proposal</h2><OvertimeRequestStatus status={item.status} /></div>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div><dt className="text-xs text-muted-foreground">Original Check-In · WIB</dt><dd className="mt-1 font-medium">{time(item.checkInAt)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Technical deadline · WIB</dt><dd className="mt-1 font-medium">{time(item.deadlineAt)}</dd></div>
        <div className="rounded-xl bg-accent p-3 sm:col-span-2"><dt className="text-xs text-muted-foreground">Proposed Checkout · WIB</dt><dd className="mt-1 text-base font-semibold">{time(item.proposedCheckOutAt)}</dd></div>
      </dl>
      <p className="text-muted-foreground">Times are displayed in WIB. This proposal does not automatically approve payable overtime hours.</p>
    </CardContent></Card>
    <Card className="rounded-2xl"><CardContent className="space-y-3"><h2 className="font-semibold">Your reason</h2><p className="whitespace-pre-wrap text-sm">{item.reason}</p><p className="border-t pt-3 text-xs text-muted-foreground">Submitted {time(item.createdAt)}</p></CardContent></Card>
    {item.status !== "PENDING" && <Card className="min-w-0 rounded-2xl"><CardContent className="space-y-3 text-sm">
      <h2 className="font-semibold">Decision</h2>
      <p>Reviewed: {time(item.reviewedAt)}</p><p>Reviewer: {item.reviewer ?? "Not recorded"}</p>
      <p className="whitespace-pre-wrap">{item.reviewNote ?? "No review note recorded."}</p>
    </CardContent></Card>}
    <Button asChild variant="outline" className="min-h-11 max-w-full whitespace-normal text-center"><Link href={`/overtime/history/${item.overtimeId}`} >View original overtime session</Link></Button>
    {item.status === "REJECTED" && <p className="text-sm">To resubmit, open the original session. The original submission window still applies.</p>}
  </div>;
}
