import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/shared/page-heading";
import { UserForm } from "@/components/admin/users/user-form";
import { requirePageUser } from "@/lib/authorization/page-access";
import { ApplicationError } from "@/lib/errors/application-error";
import { userIdSchema } from "@/schemas/user.schema";
import { getUserById } from "@/services/user.service";
import { listActiveWorkSchedules } from "@/services/work-schedule.service";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePageUser(true);
  const { id } = await params;
  if (!userIdSchema.safeParse(id).success) notFound();
  const user = await getUserById(id).catch((error: unknown) => {
    if (error instanceof ApplicationError && error.code === "USER_NOT_FOUND") notFound();
    throw error;
  });
  const schedules = await listActiveWorkSchedules();
  return <><Link href="/admin/users" className="mb-5 inline-flex min-h-11 items-center underline">Back to users</Link><PageHeading title="Edit user" description={user.name} />
    {admin.id === user.id && <p className="mb-5 text-sm">You are editing your own account. Your ADMIN role must be retained.</p>}
    <UserForm user={user} schedules={schedules} /></>;
}
