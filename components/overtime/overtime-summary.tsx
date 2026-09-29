import { EvidencePhoto } from "@/components/shared/evidence-photo";
import { LocationEvidence } from "@/components/shared/location-evidence";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatAdminEventTime } from "@/lib/date-time/event-time";
import { formatDurationMinutes } from "@/lib/date-time/format-duration";
import type { OvertimeDto } from "@/types/overtime";

export function OvertimeSummary({ overtime, audience = "worker" }: { overtime: OvertimeDto; audience?: "worker" | "admin" }) {
  return <div className="min-w-0 space-y-5">
    <Card><CardHeader><h2 className="text-lg font-semibold">{overtime.isOpen ? "Overtime in progress" : "Overtime completed"}</h2></CardHeader><CardContent className="space-y-2"><p>Work date: {overtime.workDate}</p>
      {overtime.durationMinutes !== null && <p className="font-semibold">OT Duration: {formatDurationMinutes(overtime.durationMinutes)}</p>}
      {overtime.authorizationRevoked && <p>Authorization has been revoked.{audience === "admin" ? " Recorded overtime evidence is preserved." : overtime.isOpen ? " You can still check out this existing session." : " Your completed evidence is preserved."}</p>}
      {overtime.isOpen && <p>Checkout evidence and final overtime duration are not yet available.</p>}
    </CardContent></Card>
    {([['Check-In', overtime.checkIn], ['Check-Out', overtime.checkOut]] as const).map(([label, event]) => event && <Card key={label} className="min-w-0"><CardHeader><h3 className="font-semibold">Overtime {label}</h3></CardHeader><CardContent className="space-y-4">
      <dl className="space-y-3 break-words">{[
        ["Event time", formatAdminEventTime(event.at, event.timezone)], ["Description", event.description],
      ].map(([name, value]) => <div key={name}><dt className="text-sm text-muted-foreground">{name}</dt><dd className="whitespace-pre-wrap">{value}</dd></div>)}</dl>
      <LocationEvidence latitude={event.latitude} longitude={event.longitude} accuracy={event.accuracy} address={event.address} maps={audience === "admin"} />
      <EvidencePhoto key={event.photoUrl} url={event.photoUrl} alt={`Processed overtime ${label} photo evidence`} />
    </CardContent></Card>)}
  </div>;
}
