import Link from "next/link";
import { LocationEvidence } from "@/components/shared/location-evidence";
import { RetainedEvidencePhoto } from "@/components/admin/overtime/retained-evidence-photo";
import { OvertimeMonitoringStatus } from "@/components/admin/overtime/monitoring-status";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatAdminEventTime, formatBusinessDate } from "@/lib/date-time/event-time";
import { formatDurationMinutes } from "@/lib/date-time/format-duration";
import type { OvertimeMonitoringDetail } from "@/types/admin-overtime-monitoring";

export function OvertimeDetail({ item }: { item: OvertimeMonitoringDetail }) {
  return <div className="min-w-0 space-y-4 text-sm">
    <div className="space-y-1 break-words"><p className="text-lg font-semibold">{item.employee.name}</p>{item.employee.position && <p className="text-muted-foreground">{item.employee.position}</p>}
      <div className="flex flex-wrap items-center gap-2"><p>{formatBusinessDate(item.workDate)}</p><OvertimeMonitoringStatus state={item.state} /></div>
      <p>Actual OT Duration: {item.durationMinutes === null ? "—" : formatDurationMinutes(item.durationMinutes)}</p>
    </div>
    <div className="grid min-w-0 gap-4 md:grid-cols-2">{([["Check In", item.checkIn], ["Check Out", item.checkOut]] as const).map(([label, event]) => <Card key={label} className="min-w-0">
      <CardHeader><h2 className="font-semibold">OT {label}</h2></CardHeader><CardContent className="space-y-3">
        {event ? <><dl className="space-y-3 break-words">
          <div><dt className="text-muted-foreground">Event time</dt><dd>{formatAdminEventTime(event.at, event.timezone)}</dd></div>
          <div><dt className="text-muted-foreground">Timezone</dt><dd>{event.timezone}</dd></div>
          <div><dt className="text-muted-foreground">Description</dt><dd className="whitespace-pre-wrap">{event.description}</dd></div>
        </dl><LocationEvidence latitude={event.latitude} longitude={event.longitude} accuracy={event.accuracy} address={event.address} maps />
          <RetainedEvidencePhoto key={event.photoUrl} url={event.photoUrl} alt={`Watermarked overtime ${label} evidence`} />
        </> : <p className="text-muted-foreground">Checkout not recorded yet.</p>}
      </CardContent>
    </Card>)}</div>
    <details className="rounded-xl border p-4"><summary className="cursor-pointer font-medium">Authorization context</summary><div className="mt-3 space-y-2 break-words">
      <p>{item.authorization.revokedAt ? "Revoked" : "Authorized"}</p><p>Granted: {formatAdminEventTime(item.authorization.grantedAt, "Asia/Jakarta")}</p>
      {item.authorization.revokedAt && <p>Revoked: {formatAdminEventTime(item.authorization.revokedAt, "Asia/Jakarta")}</p>}
      {item.authorization.note && <p className="whitespace-pre-wrap">{item.authorization.note}</p>}
      <Link href={`/admin/attendance/${item.attendanceId}`} className="inline-flex min-h-11 items-center underline">Regular attendance details</Link>
    </div></details>
  </div>;
}
