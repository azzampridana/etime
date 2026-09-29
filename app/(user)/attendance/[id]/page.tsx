import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AttendanceSummary } from "@/components/attendance/attendance-summary";
import { PageHeading } from "@/components/shared/page-heading";
import { requirePageUser } from "@/lib/authorization/page-access";
import { getUserAttendanceDetail } from "@/services/attendance.service";

export default async function AttendanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const attendance = await getUserAttendanceDetail(user.id, id);
  if (!attendance) notFound();
  return <>
    <Link href="/attendance?view=history" className="mb-3 inline-flex min-h-11 items-center text-sm underline">Back to History</Link>
    <PageHeading title="Attendance detail" description="Read-only attendance evidence." />
    <AttendanceSummary attendance={attendance} state={attendance.state} />
  </>;
}
