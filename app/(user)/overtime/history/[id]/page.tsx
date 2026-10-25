import { OvertimeCheckoutProvenance } from "@/components/overtime/checkout-provenance";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/authorization/page-access";
import { getOwnOvertimeDetail } from "@/services/overtime.service";
import { getOvertimeCorrectionContext } from "@/services/overtime-correction.service";
import { formatAdminEventTime } from "@/lib/date-time/event-time";
import { formatDurationMinutes } from "@/lib/date-time/format-duration";
import { EvidencePhoto } from "@/components/shared/evidence-photo";
import { LocationEvidence } from "@/components/shared/location-evidence";
import { UserOvertimeNavigation } from "@/components/overtime/user-overtime-navigation";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requirePageUser();
  const item = await getOwnOvertimeDetail((await params).id);
  if (!item) notFound();
  const correction = item.state === "Incomplete" ? await getOvertimeCorrectionContext(item.id) : null;
  return <div className="space-y-4 [overflow-wrap:anywhere]">
    <h1 className="text-2xl font-semibold">Overtime session</h1>
    <UserOvertimeNavigation active="history" />
    <Button asChild variant="outline" className="min-h-11"><Link href="/overtime/history">Back to History</Link></Button>
    <OvertimeCheckoutProvenance source={item.checkOutSource} requestId={item.checkOutCorrectionRequestId} />
    {correction && <Card className="rounded-2xl"><CardContent className="space-y-3 text-sm">
      <h2 className="font-semibold">Missing Overtime Checkout</h2>
      {correction.unavailableReason ? <p>{correction.unavailableReason}</p>
        : <Button asChild className="min-h-12 w-full whitespace-normal"><Link href={`/overtime/requests/new?overtimeId=${item.id}`}>Request Checkout correction</Link></Button>}
      {correction.existingRequestId && <Button asChild variant="outline" className="min-h-11 w-full"><Link href={`/overtime/requests/${correction.existingRequestId}`}>View existing request</Link></Button>}
      <p className="text-muted-foreground">Last submission date: {correction.lastSubmissionDate} (WIB). A request does not automatically approve payable overtime hours.</p>
    </CardContent></Card>}
    <section className="space-y-2 rounded-2xl border bg-card p-5 text-sm">
      <h2 className="text-lg font-semibold">{item.state === "Open" ? "Active" : item.state}</h2>
      <p>Parent Attendance date (WIB): {item.workDate}</p>
      <p>This is the Attendance work date; overtime can cross midnight.</p>
      <p>Completed duration: {item.durationMinutes === null ? "Not available without Checkout" : formatDurationMinutes(item.durationMinutes)}</p>
    </section>
    {item.events.map(event => <section key={event.label} className="space-y-3 rounded-2xl border bg-card p-5 text-sm">
      <h2 className="text-lg font-semibold">OT {event.label}</h2>
      <p>{event.at ? formatAdminEventTime(event.at, "Asia/Jakarta") : item.state === "Incomplete" ? "Missing Checkout" : "Not checked out yet"}</p>
      <p className="text-muted-foreground">Recorded event timezone: {event.timezone ?? "Not recorded"}</p>
      <p className="whitespace-pre-wrap">Description: {event.description ?? "Not recorded"}</p>
      <p>Address: {event.address ?? "Not recorded"}</p>
      <LocationEvidence latitude={event.latitude} longitude={event.longitude} accuracy={event.accuracy} address={event.address} maps />
      {event.photoUrl ? <EvidencePhoto url={event.photoUrl} alt={`Overtime ${event.label} evidence`} /> : <p className="text-muted-foreground">Photo evidence was not recorded.</p>}
    </section>)}
    <section className="space-y-2 rounded-2xl border bg-card p-5 text-sm">
      <h2 className="text-lg font-semibold">Authorization</h2>
      <p>{item.authorization.revokedAt ? "Revoked" : "Granted"} · Recorded session evidence is retained.</p>
      <p>Granted: {formatAdminEventTime(item.authorization.grantedAt, "Asia/Jakarta")}</p>
      {item.authorization.revokedAt && <p>Revoked: {formatAdminEventTime(item.authorization.revokedAt, "Asia/Jakarta")}</p>}
      <p className="whitespace-pre-wrap">Note: {item.authorization.note ?? "No note"}</p>
    </section>
  </div>;
}
