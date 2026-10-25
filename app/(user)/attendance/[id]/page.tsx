import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AttendanceSummary } from "@/components/attendance/attendance-summary";
import { PageHeading } from "@/components/shared/page-heading";
import { requirePageUser } from "@/lib/authorization/page-access";
import { getUserAttendanceDetail } from "@/services/attendance.service";
import { getCorrectionFormContext } from "@/services/attendance-correction.service";
import { ApplicationError } from "@/lib/errors/application-error";
import type { CorrectionFormContext } from "@/types/attendance-correction";

export default async function AttendanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const attendance = await getUserAttendanceDetail(user.id, id);
  if (!attendance) notFound();
  let correction: CorrectionFormContext | null = null;
  if (attendance.state === "Incomplete" && user.role === "USER") {
    try { correction = await getCorrectionFormContext(user.id, attendance.workDate, attendance.id); }
    catch (error) { if (!(error instanceof ApplicationError)) throw error; }
  }
  return <>
    <Link href="/attendance?view=history" className="mb-3 inline-flex min-h-11 items-center text-sm underline">Back to History</Link>
    <PageHeading title="Attendance detail" description="Read-only attendance evidence." />
    <AttendanceSummary attendance={attendance} state={attendance.state} />
    {correction && <Link className="mt-4 inline-flex min-h-12 items-center rounded-xl border bg-card px-4 text-sm font-medium underline"
      href={correction.pendingRequestId ? `/attendance/requests/${correction.pendingRequestId}` : `/attendance/requests/new?workDate=${correction.workDate}&attendanceId=${attendance.id}`}>
      {correction.pendingRequestId ? "View pending correction request" : "Request Missing Checkout"}
    </Link>}
  </>;
}
