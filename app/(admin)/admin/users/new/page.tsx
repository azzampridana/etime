import Link from "next/link";
import { PageHeading } from "@/components/shared/page-heading";
import { UserForm } from "@/components/admin/users/user-form";
import { requirePageUser } from "@/lib/authorization/page-access";
import { listActiveWorkSchedules } from "@/services/work-schedule.service";

export default async function Page() {
  await requirePageUser(true);
  const schedules = await listActiveWorkSchedules();
  return <><Link href="/admin/users" className="mb-5 inline-flex min-h-11 items-center underline">Back to users</Link><PageHeading title="Create user" /><UserForm schedules={schedules} /></>;
}
