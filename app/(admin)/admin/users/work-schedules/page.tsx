import Link from "next/link";
import { requirePageUser } from "@/lib/authorization/page-access";
import { listWorkSchedules } from "@/services/work-schedule.service";
import { WorkScheduleForm } from "@/components/admin/users/work-schedule-form";
import { PageHeading } from "@/components/shared/page-heading";
import { getOvertimePolicyMinutes } from "@/services/overtime-policy.service";
import { OvertimePolicyForm } from "@/components/admin/users/overtime-policy-form";

export default async function Page() {
  await requirePageUser(true);
  const [schedules, maxOpenMinutes] = await Promise.all([listWorkSchedules(), getOvertimePolicyMinutes()]);
  return <><PageHeading title="Work duration policies" description="Regular work requirements and the company-wide overtime checkout window are separate policies. Changes apply to future check-ins." />
    <Link href="/admin/users" className="mb-5 inline-flex min-h-11 items-center underline">Back to users</Link>
    <div className="max-w-3xl space-y-8">
      <section aria-labelledby="regular-duration-heading" className="space-y-5">
        <div><h2 id="regular-duration-heading" className="text-lg font-semibold">Regular Attendance</h2><p className="text-sm text-muted-foreground">WorkSchedule defines the expected regular working duration. It does not define fixed check-in or checkout times. Historical required durations remain unchanged.</p></div>
        <WorkScheduleForm />{schedules.map(schedule => <WorkScheduleForm key={`${schedule.id}-${schedule.name}-${schedule.requiredWorkMinutes}-${schedule.isActive}`} schedule={schedule} />)}
        <p className="text-sm text-muted-foreground">Showing up to 100 WorkSchedules, including inactive schedules.</p>
      </section>
      <section aria-labelledby="overtime-policy-heading" className="space-y-4 border-t pt-6">
        <h2 id="overtime-policy-heading" className="text-lg font-semibold">Overtime</h2>
        <OvertimePolicyForm maxOpenMinutes={maxOpenMinutes} />
      </section>
    </div></>;
}
