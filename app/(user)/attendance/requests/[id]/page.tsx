import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePageUser } from "@/lib/authorization/page-access";
import { getCorrectionDetail } from "@/services/attendance-correction.service";
import { formatAdminEventTime } from "@/lib/date-time/event-time";
import { PageHeading } from "@/components/shared/page-heading";
import { Button } from "@/components/ui/button";

export default async function CorrectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  if (user.role !== "USER") redirect("/admin");
  const request = await getCorrectionDetail(user.id, (await params).id);
  if (!request) notFound();
  const checkIn = request.requestedCheckInAt ?? request.originalCheckInAt;
  const checkInZone = request.requestedCheckInTimezone ?? request.originalCheckInTimezone;
  return <div className="space-y-4">
    <PageHeading title={request.type === "MISSING_BOTH" ? "Missing Attendance request" : "Missing Checkout request"} description={`Work date: ${request.workDate} · ${request.status}`} />
    <section className="space-y-4 rounded-2xl border bg-card p-4 text-sm [overflow-wrap:anywhere]">
      {request.status === "PENDING" && <p role="status">Request submitted and pending review. Attendance remains unchanged until ADMIN approval.</p>}
      <p>Submitted: {formatAdminEventTime(request.createdAt, "Asia/Jakarta")}</p>
      <dl className="space-y-4">
        <div><dt className="font-medium">{request.type === "MISSING_BOTH" ? "Proposed" : "Original"} Check In</dt><dd>{checkIn && checkInZone ? formatAdminEventTime(checkIn, checkInZone) : "Unavailable"}</dd></div>
        <div><dt className="font-medium">Proposed Check Out</dt><dd>{formatAdminEventTime(request.requestedCheckOutAt, request.requestedCheckOutTimezone)}</dd></div>
        <div><dt className="font-medium">Reason</dt><dd className="whitespace-pre-wrap">{request.reason}</dd></div>
        {request.existingReportContent && <div><dt className="font-medium">Original Daily Report (submission snapshot)</dt><dd className="whitespace-pre-wrap">{request.existingReportContent}</dd></div>}
        {request.proposedDailyReportContent && <div><dt className="font-medium">Proposed Daily Report</dt><dd className="whitespace-pre-wrap">{request.proposedDailyReportContent}</dd></div>}
        {request.status !== "PENDING" && <>
          <div><dt className="font-medium">Reviewed by</dt><dd>{request.reviewerName ?? "Unavailable"}</dd></div>
          <div><dt className="font-medium">Decision time</dt><dd>{request.reviewedAt ? formatAdminEventTime(request.reviewedAt, "Asia/Jakarta") : "Unavailable"}</dd></div>
          <div><dt className="font-medium">{request.status === "REJECTED" ? "Rejection reason" : "Review note"}</dt><dd className="whitespace-pre-wrap">{request.reviewNote ?? "Not provided"}</dd></div>
        </>}
      </dl>
      <p className="text-muted-foreground">Submitted proposals are read-only.</p>
      {request.canResubmit && <Button asChild variant="outline" className="min-h-11 h-auto max-w-full whitespace-normal py-2"><Link href={`/attendance/requests/new?workDate=${request.workDate}${request.attendanceId ? `&attendanceId=${request.attendanceId}` : ""}`}>Submit a new request for this date</Link></Button>}
    </section>
  </div>;
}
