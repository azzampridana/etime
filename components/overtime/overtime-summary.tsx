import { OvertimeCheckoutProvenance } from "@/components/overtime/checkout-provenance";
import { EvidencePhoto } from "@/components/shared/evidence-photo";
import { LocationEvidence } from "@/components/shared/location-evidence";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatAdminEventTime } from "@/lib/date-time/event-time";
import { formatDurationMinutes } from "@/lib/date-time/format-duration";
import type { OvertimeDto } from "@/types/overtime";

export function OvertimeSummary({ overtime, audience = "worker" }: { overtime: OvertimeDto; audience?: "worker" | "admin" }) {
  const surface = audience === "worker" ? "rounded-2xl bg-white/95 shadow-sm shadow-slate-950/5 ring-slate-200/70 [--card-spacing:--spacing(5)] sm:[--card-spacing:--spacing(6)]" : "";
  const statusStyle = audience === "worker" ? `w-fit rounded-xl px-3 py-2 ${overtime.state === "Incomplete" ? "bg-amber-50 text-amber-900" : overtime.isOpen ? "bg-indigo-50 text-indigo-900" : "bg-emerald-50 text-emerald-900"}` : "";
  return <div className="min-w-0 space-y-5">
    <OvertimeCheckoutProvenance source={overtime.checkOutSource} requestId={overtime.checkOutCorrectionRequestId} />
    <Card className={surface}><CardHeader><h2 className={`text-lg font-semibold ${statusStyle}`}>{overtime.state === "Incomplete" ? "Overtime incomplete" : overtime.isOpen ? "Overtime in progress" : "Overtime completed"}</h2></CardHeader><CardContent className="space-y-2"><p>Work date: {overtime.workDate}</p>
      {overtime.state === "Incomplete" && <><p>Status: Incomplete</p><p>Check-Out: Missing Checkout</p><p>OT Duration: —</p></>}
      {overtime.durationMinutes !== null && <p className="font-semibold">OT Duration: {formatDurationMinutes(overtime.durationMinutes)}</p>}
      {overtime.authorizationRevoked && <p>Authorization has been revoked.{audience === "admin" ? " Recorded overtime evidence is preserved." : overtime.isOpen ? " You can still check out this existing session." : " Your recorded evidence is preserved."}</p>}
      {overtime.isOpen && <p>Checkout evidence and final overtime duration are not yet available.</p>}
    </CardContent></Card>
    {([['Check-In', overtime.checkIn], ['Check-Out', overtime.checkOut]] as const).map(([label, event]) => event && <Card key={label} className={`min-w-0 ${surface}`}><CardHeader><h3 className="font-semibold">Overtime {label}</h3></CardHeader><CardContent className="space-y-4">
      <dl className="space-y-3 break-words">{[
        ["Event time", formatAdminEventTime(event.at, event.timezone ?? "Asia/Jakarta")], ["Event timezone", event.timezone ?? "Not recorded (time shown in WIB)"], ["Description", event.description ?? "Not recorded"],
      ].map(([name, value]) => <div key={name}><dt className="text-sm text-muted-foreground">{name}</dt><dd className="whitespace-pre-wrap">{value}</dd></div>)}</dl>
      <LocationEvidence latitude={event.latitude} longitude={event.longitude} accuracy={event.accuracy} address={event.address} maps={audience === "admin"} />
      {event.photoUrl ? <EvidencePhoto key={event.photoUrl} url={event.photoUrl} alt={`Processed overtime ${label} photo evidence`} /> : <p>Photo: Not recorded</p>}
    </CardContent></Card>)}
  </div>;
}
