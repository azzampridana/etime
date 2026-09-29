import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LocationEvidence } from "@/components/shared/location-evidence";
import { formatAdminEventTime } from "@/lib/date-time/event-time";
import type { AttendanceDto } from "@/types/attendance";

export function AttendanceSummary({ attendance, state = attendance.isOpen ? "Working" : "Completed" }: {
  attendance: AttendanceDto; state?: "Working" | "Completed" | "Incomplete";
}) {
  const color = state === "Completed" ? "bg-emerald-50 text-emerald-800" : state === "Incomplete" ? "bg-amber-50 text-amber-900" : "bg-blue-50 text-blue-800";
  return <Card>
    <CardHeader className="gap-2">
      <h2 className={`w-fit rounded-full px-3 py-1 text-sm font-semibold ${color}`}>{state}</h2>
      <p className="text-sm text-muted-foreground">Work date: {attendance.workDate}</p>
    </CardHeader>
    <CardContent className="space-y-5 [overflow-wrap:anywhere]">
      <section className="space-y-3" aria-label="Check-in evidence">
        <h3 className="text-xs font-semibold text-muted-foreground">CHECK IN</h3>
        <p className="text-lg font-semibold">{formatAdminEventTime(attendance.checkInAt, attendance.checkInTimezone)}</p>
        <details><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Check-In Location &amp; Description</summary>
          <LocationEvidence latitude={attendance.checkInLatitude} longitude={attendance.checkInLongitude} accuracy={attendance.checkInAccuracy} address={attendance.checkInAddress} />
          {attendance.checkInDescription && <p className="mt-3 whitespace-pre-wrap">{attendance.checkInDescription}</p>}
        </details>
      </section>
      <section className="space-y-3 border-t pt-4" aria-label="Daily Report">
        <h3 className="font-semibold">Daily Report</h3>
        <p className="whitespace-pre-wrap text-sm">{attendance.dailyReport?.content ?? "No report recorded."}</p>
      </section>
      <section className="space-y-3 border-t pt-4" aria-label="Checkout evidence">
        <h3 className="text-xs font-semibold text-muted-foreground">CHECK OUT</h3>
        {attendance.checkOutAt && attendance.checkOutTimezone ? <>
          <p className="text-lg font-semibold">{formatAdminEventTime(attendance.checkOutAt, attendance.checkOutTimezone)}</p>
          <details><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Check-Out Location &amp; Description</summary>
            {attendance.checkOutLatitude !== null && attendance.checkOutLongitude !== null && attendance.checkOutAccuracy !== null &&
              <LocationEvidence latitude={attendance.checkOutLatitude} longitude={attendance.checkOutLongitude} accuracy={attendance.checkOutAccuracy} address={attendance.checkOutAddress} />}
            {attendance.checkOutDescription && <p className="mt-3 whitespace-pre-wrap">{attendance.checkOutDescription}</p>}
          </details>
        </> : <p className={state === "Incomplete" ? "font-medium text-amber-900" : "text-muted-foreground"}>{state === "Incomplete" ? "Missing Checkout" : "Not yet"}</p>}
      </section>
    </CardContent>
  </Card>;
}
