import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeading } from "@/components/shared/page-heading";
import { OvertimeNavigation } from "@/components/admin/overtime/overtime-navigation";
import { OvertimeDetail } from "@/components/admin/overtime/overtime-detail";
import { requirePageUser } from "@/lib/authorization/page-access";
import { ApplicationError } from "@/lib/errors/application-error";
import { getOvertimeMonitoringDetail } from "@/services/admin-overtime-monitoring.service";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requirePageUser(true);
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const item = await getOvertimeMonitoringDetail(id).catch((error: unknown) => {
    if (error instanceof ApplicationError && error.code === "OVERTIME_NOT_FOUND") notFound();
    throw error;
  });
  return <><PageHeading title="Overtime details" /><OvertimeNavigation active="activity" />
    <Link href="/admin/overtime" className="mb-5 inline-flex min-h-11 items-center underline">Back to activity</Link>
    <OvertimeDetail item={item} />
  </>;
}
