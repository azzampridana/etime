import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/authorization/page-access";
import { getAdminOvertimeCorrectionDetail } from "@/services/admin-overtime-correction.service";
import { adminOvertimeCorrectionQuerySchema } from "@/schemas/overtime-correction.schema";
import { OvertimeDecisionControls } from "@/components/admin/overtime-requests/decision-controls";
import { OvertimeRequestStatus } from "@/components/admin/overtime-requests/status";
import { formatAdminEventTime } from "@/lib/date-time/event-time";
import { LocationEvidence } from "@/components/shared/location-evidence";

export default async function Page({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageUser(true);
  const item = await getAdminOvertimeCorrectionDetail((await params).id);
  if (!item) notFound();
  const query = adminOvertimeCorrectionQuerySchema.safeParse(await searchParams);
  const back = query.success ? `?status=${query.data.status}&page=${query.data.page}` : "";
  const time = (at: string | null) => at ? formatAdminEventTime(at, "Asia/Jakarta") : "Not recorded";
  return <div className="mx-auto w-full min-w-0 max-w-5xl space-y-5 [overflow-wrap:anywhere]">
    <Button asChild variant="outline" className="min-h-11 max-w-full whitespace-normal text-center"><Link href={`/admin/overtime-requests${back}`} >Back to requests</Link></Button>
    <h1 className="text-2xl font-semibold">Missing Overtime Checkout</h1>
    <Card className="min-w-0 rounded-2xl"><CardContent className="space-y-3 text-sm">
      <h2 className="font-semibold">{item.employee.name}</h2>{item.employee.position && <p>{item.employee.position}</p>}
      {!item.employee.isActive && <p>Inactive employee</p>}<OvertimeRequestStatus status={item.status} />
      <p className="text-sm">Submitted: {time(item.createdAt)}</p>
    </CardContent></Card>
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="min-w-0 rounded-2xl"><CardContent className="space-y-3 text-sm">
        <h2 className="font-semibold">Original snapshot · version 1</h2>
        {item.original ? <>
          <dl className="space-y-3"><div><dt className="text-xs text-muted-foreground">Check-In · WIB</dt><dd className="mt-1 font-semibold">{time(item.original.checkInAt)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Original Checkout</dt><dd className="mt-1">{time(item.original.checkOutAt)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Technical deadline · WIB</dt><dd className="mt-1 font-medium">{time(item.original.deadlineAt)}</dd></div></dl>
          <details className="rounded-xl bg-muted/50 p-3"><summary className="cursor-pointer rounded font-medium focus-visible:outline-2 focus-visible:outline-ring">Original session evidence</summary><div className="mt-3 space-y-3">
          <p>Parent work date: {item.original.workDate}</p><p>Recorded Check-In timezone: {item.original.checkInTimezone}</p>
          <p>Maximum open window snapshot: {item.original.maxOpenMinutes} minutes (not credited hours)</p>
          <LocationEvidence latitude={item.original.checkInLatitude} longitude={item.original.checkInLongitude} accuracy={item.original.checkInAccuracy} address={item.original.checkInAddress} maps />
          <p className="whitespace-pre-wrap">Check-In description: {item.original.checkInDescription}</p>
          <p>Authorization revoked at submission: {time(item.original.authorizationRevokedAt)}</p>
          </div></details>
        </> : <p>Original snapshot cannot be displayed. Approval will validate the stored snapshot before writing.</p>}
      </CardContent></Card>
      <Card className="min-w-0 rounded-2xl"><CardContent className="space-y-3 text-sm">
        <h2 className="font-semibold">Employee proposal</h2><div className="rounded-xl bg-accent p-4"><p className="text-xs text-muted-foreground">Proposed Checkout · WIB</p><p className="mt-1 text-lg font-semibold">{time(item.proposedCheckOutAt)}</p></div>
        <p>All comparison timestamps are displayed in WIB. Original Check-In will remain unchanged.</p>
        <p>No historical GPS, photo, address or event timezone will be fabricated. Recorded overtime duration does not automatically approve compensation.</p>
      </CardContent></Card>
    </div>
    <Card className="rounded-2xl"><CardContent className="space-y-3"><h2 className="font-semibold">Employee reason</h2><p className="whitespace-pre-wrap text-sm">{item.reason}</p></CardContent></Card>
    <Card className="min-w-0 rounded-2xl"><CardContent className="space-y-3 text-sm">
      <h2 className="font-semibold">Review outcome</h2>
      <p className="whitespace-pre-wrap">{item.reviewNote ?? "No review note"}</p>
      <details className="rounded-xl bg-muted/50 p-3"><summary className="cursor-pointer rounded font-medium focus-visible:outline-2 focus-visible:outline-ring">Audit & official Checkout</summary><div className="mt-3 space-y-2 text-muted-foreground">
      <p>Current Checkout: {time(item.officialCheckout.at)}</p><p>Source: {item.officialCheckout.source ?? "Not recorded"}</p>
      <p>Correction request reference: {item.officialCheckout.requestId ?? "Not recorded"}</p>
      <p>Reviewer: {item.reviewer ?? "Not reviewed"}</p><p>Reviewed: {time(item.reviewedAt)}</p>
      </div></details>
      <Button asChild variant="outline" className="min-h-11 max-w-full whitespace-normal text-center"><Link href={`/admin/overtime/activity/${item.overtimeId}`} >View official overtime evidence</Link></Button>
    </CardContent></Card>
    {item.canDecide ? <OvertimeDecisionControls key={`${item.id}:${item.expectedVersion}`} requestId={item.id} expectedVersion={item.expectedVersion} employeeActive={item.employee.isActive} />
      : <p role="status" className="rounded-xl border bg-muted/50 p-4 text-sm text-muted-foreground">Decision controls are unavailable: this request is no longer pending or requires state review.</p>}
  </div>;
}
