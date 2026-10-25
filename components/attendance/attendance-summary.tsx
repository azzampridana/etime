import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LocationEvidence } from "@/components/shared/location-evidence";
import { AttendanceProvenanceNote } from "@/components/attendance/attendance-provenance";
import { formatAdminEventTime } from "@/lib/date-time/event-time";
import type { AttendanceDto } from "@/types/attendance";

export function AttendanceSummary({ attendance, state = attendance.isOpen ? "Working" : "Completed", compact = false }: {
  attendance: AttendanceDto; state?: "Working" | "Completed" | "Incomplete"; compact?: boolean;
}) {
  const color = state === "Completed" ? "bg-emerald-50 text-emerald-800" : state === "Incomplete" ? "bg-amber-50 text-amber-900" : "bg-blue-50 text-blue-800";
  return <Card className={compact ? "min-w-0 rounded-2xl" : "rounded-2xl bg-white/95 shadow-sm shadow-slate-950/5 ring-slate-200/70 [--card-spacing:--spacing(5)] sm:[--card-spacing:--spacing(6)]"}>
    <CardHeader className="gap-2">
      <h2 className={`w-fit max-w-full ${compact ? "rounded-full px-2.5 py-1 text-xs ring-1 ring-inset ring-current/10" : "rounded-xl px-3 py-2 text-sm"} font-semibold ${color}`}>{state}</h2>
      <p className="text-sm text-muted-foreground">Work date: {attendance.workDate}</p>
      <AttendanceProvenanceNote {...attendance} />
    </CardHeader>
    <CardContent className={compact ? "grid gap-3 sm:grid-cols-2 [overflow-wrap:anywhere]" : "space-y-5 [overflow-wrap:anywhere]"}>
      <section className="min-w-0 space-y-3" aria-label="Check-in evidence">
        <h3 className="text-xs font-semibold text-muted-foreground">CHECK IN</h3>
        <p className={compact ? "text-sm font-medium" : "text-lg font-semibold"}>{formatAdminEventTime(attendance.checkInAt, attendance.checkInTimezone)}</p>
        <details><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Check-In Location &amp; Description</summary>
          <LocationEvidence latitude={attendance.checkInLatitude} longitude={attendance.checkInLongitude} accuracy={attendance.checkInAccuracy} address={attendance.checkInAddress} source={attendance.checkInSource} />
          {attendance.checkInDescription && <p className="mt-3 whitespace-pre-wrap">{attendance.checkInDescription}</p>}
        </details>
      </section>
      {!(compact && attendance.isOpen) && <section className={compact ? "order-last space-y-2 border-t pt-3 sm:col-span-2" : "space-y-3 border-t pt-4"} aria-label="Daily Report">
        <h3 className="font-semibold">Daily Report</h3>
        <p className="whitespace-pre-wrap text-sm">{attendance.dailyReport?.content ?? "No report recorded."}</p>
      </section>}
      <section className={compact ? "min-w-0 space-y-3" : "space-y-3 border-t pt-4"} aria-label="Checkout evidence">
        <h3 className="text-xs font-semibold text-muted-foreground">CHECK OUT</h3>
        {attendance.checkOutAt && attendance.checkOutTimezone ? <>
          <p className={compact ? "text-sm font-medium" : "text-lg font-semibold"}>{formatAdminEventTime(attendance.checkOutAt, attendance.checkOutTimezone)}</p>
          <details><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Check-Out Location &amp; Description</summary>
            <LocationEvidence latitude={attendance.checkOutLatitude} longitude={attendance.checkOutLongitude} accuracy={attendance.checkOutAccuracy} address={attendance.checkOutAddress} source={attendance.checkOutSource} />
            {attendance.checkOutDescription && <p className="mt-3 whitespace-pre-wrap">{attendance.checkOutDescription}</p>}
          </details>
        </> : <p className={state === "Incomplete" ? "font-medium text-amber-900" : "text-muted-foreground"}>{state === "Incomplete" ? "Missing Checkout" : "Not yet"}</p>}
      </section>
    </CardContent>
  </Card>;
}
