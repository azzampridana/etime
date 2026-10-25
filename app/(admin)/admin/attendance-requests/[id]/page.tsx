import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/authorization/page-access";
import { getAdminCorrectionDetail } from "@/services/admin-attendance-correction.service";
import { formatAdminEventTime } from "@/lib/date-time/event-time";
import { formatDurationMinutes } from "@/lib/date-time/format-duration";
import { PageHeading } from "@/components/shared/page-heading";
import { DecisionControls } from "@/components/admin/attendance-requests/decision-controls";
import { LocationEvidence } from "@/components/shared/location-evidence";
import { mapsUrl } from "@/lib/geolocation/maps-url";
import { adminCorrectionQuerySchema } from "@/schemas/attendance-correction.schema";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageUser(true);
  const request = await getAdminCorrectionDetail((await params).id);
  if (!request) notFound();
  const origin = adminCorrectionQuerySchema.safeParse(await searchParams);
  const backHref = origin.success ? `/admin/attendance-requests?status=${origin.data.status}&page=${origin.data.page}` : "/admin/attendance-requests";
  const type = request.type === "MISSING_BOTH" ? "Missing Attendance" : "Missing Checkout";
  const start = request.requestedCheckInAt ?? request.originalCheckInAt;
  const zone = request.requestedCheckInTimezone ?? request.originalCheckInTimezone;
  const card = "space-y-3 rounded-xl border bg-card p-4 text-sm [overflow-wrap:anywhere]";
  return <div className="space-y-5">
    <Link href={backHref} className="inline-flex min-h-11 items-center text-sm underline">Back to Attendance Requests</Link>
    <PageHeading title={`${type} request`} description={`${request.employee.name} · ${request.workDate} · ${request.status}`} />
    <section className={card}><h2 className="font-semibold">Request information</h2>
      <p>{request.employee.name} · {request.employee.email}{!request.employee.isActive && " · Inactive employee"}</p>
      <p>Request ID: {request.id}</p><p>Submitted: {formatAdminEventTime(request.createdAt, "Asia/Jakarta")}</p>
      <h3 className="font-medium">Employee reason</h3><p className="whitespace-pre-wrap">{request.reason}</p>
    </section>
    <section className={card}><h2 className="font-semibold">Proposed completed interval (read-only)</h2>
      <p>{request.type === "MISSING_BOTH" ? "Proposed" : "Original"} Check In: {start && zone ? formatAdminEventTime(start, zone) : "Unavailable"}</p>
      {start && <p className="text-muted-foreground">Jakarta equivalent: {formatAdminEventTime(start, "Asia/Jakarta")}</p>}
      <p>Proposed Check Out: {formatAdminEventTime(request.requestedCheckOutAt, request.requestedCheckOutTimezone)}</p>
      <p className="text-muted-foreground">Jakarta equivalent: {formatAdminEventTime(request.requestedCheckOutAt, "Asia/Jakarta")}</p>
      <p>Proposed regular duration: {request.durationMinutes === null ? "Invalid interval — backend review required" : formatDurationMinutes(request.durationMinutes)}</p>
      {request.crossesJakartaMidnight && <p>Crosses midnight in Asia/Jakarta.</p>}
      {request.eventLocalDatesDiffer && <p>The Check-In and Checkout dates differ in their respective event timezones.</p>}
      <p className="text-muted-foreground">These are immutable requested times, not newly captured events.</p>
    </section>
    <div className="grid gap-5 lg:grid-cols-2">
      <section className={card}><h2 className="font-semibold">Original Attendance evidence</h2>
        {request.type === "MISSING_BOTH" ? <>
          <p>No Attendance existed at submission. Historical GPS was not captured; approval does not fabricate location evidence.</p>
          <h3 className="font-medium">Frozen WorkSchedule</h3><p>{request.schedule.name ?? "Unavailable"}</p><p>ID: {request.schedule.id ?? "Unavailable"}</p>
          <p>Basis: {request.schedule.basis ?? "Unavailable"}</p><p>Required duration: {request.schedule.minutes === null ? "Unavailable" : formatDurationMinutes(request.schedule.minutes)}</p>
        </> : request.original ? <>
          <p>Submission snapshot · Check In: {formatAdminEventTime(request.original.checkInAt, request.original.checkInTimezone)}</p>
          <p>Check-In source: {request.original.checkInSource}</p><p>Required duration: {formatDurationMinutes(request.original.requiredWorkMinutes)}</p>
          {request.original.checkInLatitude !== null && request.original.checkInLongitude !== null && request.original.checkInAccuracy !== null
            ? <LocationEvidence latitude={request.original.checkInLatitude} longitude={request.original.checkInLongitude} accuracy={request.original.checkInAccuracy} address={request.original.checkInAddress} source={request.original.checkInSource} maps />
            : <div className="space-y-2"><p>Latitude: {request.original.checkInLatitude ?? "Not recorded"}</p><p>Longitude: {request.original.checkInLongitude ?? "Not recorded"}</p><p>Accuracy: {request.original.checkInAccuracy === null ? "Not recorded" : `±${request.original.checkInAccuracy} m`}</p><p>Address: {request.original.checkInAddress ?? "Not recorded"}</p>
              {request.original.checkInLatitude !== null && request.original.checkInLongitude !== null && <a className="inline-flex min-h-11 items-center underline" href={mapsUrl(request.original.checkInLatitude, request.original.checkInLongitude)} target="_blank" rel="noopener noreferrer">Open in Maps</a>}
            </div>}
          {request.original.checkInDescription && <p className="whitespace-pre-wrap">{request.original.checkInDescription}</p>}
        </> : <p>Original snapshot unavailable. Approval will validate the stored evidence.</p>}
        <p>Current Attendance: {request.currentAttendance?.state ?? "Absent"}</p>
        {request.currentAttendance && <Link className="inline-flex min-h-11 items-center underline" href={`/admin/attendance/${request.currentAttendance.id}`}>View current official Attendance</Link>}
      </section>
      <section className={card}><h2 className="font-semibold">Daily Report</h2>
        <h3 className="font-medium">Current official report (read-only)</h3><p className="whitespace-pre-wrap">{request.currentAttendance?.report ?? "No official report exists."}</p>
        {request.existingReportContent !== null && <><h3 className="font-medium">Report at submission</h3><p className="whitespace-pre-wrap">{request.existingReportContent}</p></>}
        {request.proposedDailyReportContent !== null && <><h3 className="font-medium">Employee proposal (not the official report)</h3><p className="whitespace-pre-wrap">{request.proposedDailyReportContent}</p></>}
      </section>
    </div>
    <section className={card}><h2 className="font-semibold">Decision history</h2><p>Status: {request.status}</p>
      <p>Reviewer: {request.reviewerName ?? "Not reviewed"}</p><p>Decision time: {request.reviewedAt ? formatAdminEventTime(request.reviewedAt, "Asia/Jakarta") : "Not reviewed"}</p>
      <p className="whitespace-pre-wrap">{request.status === "REJECTED" ? "Rejection reason" : "Review note"}: {request.reviewNote ?? "Not provided"}</p>
      {request.appliedAttendanceId && <Link className="inline-flex min-h-11 items-center underline" href={`/admin/attendance/${request.appliedAttendanceId}`}>Applied Attendance: {request.appliedAttendanceId}</Link>}
    </section>
    {request.status === "PENDING" && <DecisionControls key={`${request.id}:${request.expectedVersion}`} id={request.id} expectedVersion={request.expectedVersion} employee={request.employee.name} workDate={request.workDate} type={type} />}
  </div>;
}
