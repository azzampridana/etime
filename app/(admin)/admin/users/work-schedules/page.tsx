import Link from "next/link";
import { requirePageUser } from "@/lib/authorization/page-access";
import { listWorkSchedules } from "@/services/work-schedule.service";
import { WorkScheduleForm } from "@/components/admin/users/work-schedule-form";
import { PageHeading } from "@/components/shared/page-heading";

export default async function Page() {
  await requirePageUser(true);
  const schedules = await listWorkSchedules();
  return <><PageHeading title="Work duration policies" description="WorkSchedule defines required minutes, not mandatory clock times. Changes apply to future check-ins; historical snapshots remain unchanged." />
    <Link href="/admin/users" className="mb-5 inline-flex min-h-11 items-center underline">Back to users</Link>
    <div className="max-w-3xl space-y-5"><WorkScheduleForm />{schedules.map(schedule => <WorkScheduleForm key={`${schedule.id}-${schedule.name}-${schedule.requiredWorkMinutes}-${schedule.isActive}`} schedule={schedule} />)}</div>
    <p className="mt-4 text-sm text-muted-foreground">Showing up to 100 duration policies, including inactive policies.</p></>;
}
