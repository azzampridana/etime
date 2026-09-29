import { LocationEvidence } from "@/components/shared/location-evidence";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AttendanceStatus } from "@/components/admin/attendance/attendance-status";
import { formatAdminEventTime, formatBusinessDate } from "@/lib/date-time/event-time";
import { formatDurationMinutes, formatSignedDurationMinutes } from "@/lib/date-time/format-duration";
import type { AdminAttendanceDetailDto } from "@/types/admin-attendance";

export function AttendanceDetail({ item }: { item: AdminAttendanceDetailDto }) {
  const events = [
    { label: "Check In", at: item.checkInAt, zone: item.checkInTimezone, latitude: item.checkInLatitude, longitude: item.checkInLongitude, accuracy: item.checkInAccuracy, address: item.checkInAddress, description: item.checkInDescription },
    { label: "Check Out", at: item.checkOutAt, zone: item.checkOutTimezone, latitude: item.checkOutLatitude, longitude: item.checkOutLongitude, accuracy: item.checkOutAccuracy, address: item.checkOutAddress, description: item.checkOutDescription },
  ];
  return <div className="min-w-0 space-y-4 text-sm">
    <div className="space-y-1 break-words">
      <p className="text-lg font-semibold">{item.employee.name}</p>
      {item.employee.position && <p className="text-muted-foreground">{item.employee.position}</p>}
      <div className="flex flex-wrap items-center gap-2"><p>{formatBusinessDate(item.workDate)}</p><AttendanceStatus state={item.state} /></div>
    </div>
    <div className="grid min-w-0 gap-4 md:grid-cols-2">{events.map(event => <Card key={event.label} className="min-w-0">
      <CardHeader><h2 className="font-semibold">{event.label}</h2></CardHeader><CardContent>
        {!event.at ? <p className="text-muted-foreground">Missing Checkout</p> : <>
          <dl className="space-y-3">
            <div><dt className="text-muted-foreground">Event time</dt><dd className="break-words">{event.zone ? formatAdminEventTime(event.at, event.zone) : "Timezone unavailable"}</dd></div>
            <div><dt className="text-muted-foreground">Timezone</dt><dd className="break-words">{event.zone ?? "—"}</dd></div>
            {event.description && <div><dt className="text-muted-foreground">Description</dt><dd className="whitespace-pre-wrap break-words">{event.description}</dd></div>}
          </dl>
          {event.latitude !== null && event.longitude !== null && event.accuracy !== null && <div className="mt-3"><LocationEvidence latitude={event.latitude} longitude={event.longitude} accuracy={event.accuracy} address={event.address} maps /></div>}
        </>}
      </CardContent>
    </Card>)}</div>
    <Card><CardHeader><h2 className="font-semibold">Daily Report</h2></CardHeader><CardContent><p className="whitespace-pre-wrap break-words">{item.dailyReport?.content ?? "No Daily Report saved."}</p></CardContent></Card>
    <Card><CardHeader><h2 className="font-semibold">Duration Summary</h2></CardHeader><CardContent>
      <dl className="grid gap-3 sm:grid-cols-3">{[
        ["Actual", item.actualDurationMinutes === null ? "—" : formatDurationMinutes(item.actualDurationMinutes)],
        ["Required", formatDurationMinutes(item.requiredWorkMinutes)],
        ["Difference", item.differenceMinutes === null ? "—" : formatSignedDurationMinutes(item.differenceMinutes)],
      ].map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="font-medium">{value}</dd></div>)}</dl>
    </CardContent></Card>
  </div>;
}
