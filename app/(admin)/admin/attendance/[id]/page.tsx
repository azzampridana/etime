import Link from "next/link";
import { AttendanceDetail } from "@/components/admin/attendance/attendance-detail";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/shared/page-heading";
import { requirePageUser } from "@/lib/authorization/page-access";
import { ApplicationError } from "@/lib/errors/application-error";
import { userIdSchema } from "@/schemas/user.schema";
import { getAdminAttendance } from "@/services/attendance.service";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requirePageUser(true);
  const { id } = await params;
  if (!userIdSchema.safeParse(id).success) notFound();
  const item = await getAdminAttendance(id).catch((error: unknown) => {
    if (error instanceof ApplicationError && error.code === "ATTENDANCE_NOT_FOUND") notFound();
    throw error;
  });
  return <><Link href="/admin/attendance" className="mb-5 inline-flex min-h-11 items-center underline">Back to attendance</Link>
    <PageHeading title="Attendance details" />
    <AttendanceDetail item={item} />
  </>;
}