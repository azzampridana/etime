import { AttendanceMonitoringFilters } from "@/components/admin/attendance/attendance-monitoring-filters";
import { UserPageSize } from "@/components/admin/users/user-page-size";
import { PageHeading } from "@/components/shared/page-heading";
import { AttendanceTable } from "@/components/admin/attendance/attendance-table";
import { Pagination } from "@/components/admin/pagination";
import { InvalidFilters } from "@/components/admin/invalid-filters";
import { requirePageUser } from "@/lib/authorization/page-access";
import { ApplicationError } from "@/lib/errors/application-error";
import { adminAttendanceMonitoringQuerySchema, type AdminSearchParams } from "@/schemas/admin-query.schema";
import { getBusinessDate } from "@/lib/date-time/event-time";
import { listAdminAttendance } from "@/services/attendance.service";
import { getUserById } from "@/services/user.service";

export default async function Page({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  await requirePageUser(true);
  const parsed = adminAttendanceMonitoringQuerySchema.safeParse(await searchParams);
  if (!parsed.success) return <><PageHeading title="Attendance" /><InvalidFilters path="/admin/attendance" /></>;
  const input = parsed.data;
  const result = await listAdminAttendance(input);
  const selected = input.userId ? await getUserById(input.userId).catch((error: unknown) => {
    if (error instanceof ApplicationError && error.code === "USER_NOT_FOUND") return null;
    throw error;
  }) : undefined;
  if (selected === null) return <><PageHeading title="Attendance" /><InvalidFilters path="/admin/attendance" /></>;
  const today = getBusinessDate();
  const scope = input.from === today && input.to === today ? `Today · ${today}` : `${input.from} – ${input.to}`;
  return <><PageHeading title="Attendance" description={`${scope} · Asia/Jakarta business dates. Read-only monitoring.`} />
    {selected && <p className="mb-3 text-sm text-muted-foreground">Attendance for {selected.name}. Reset to show all employees.</p>}
    <AttendanceMonitoringFilters input={input} />
    <AttendanceTable items={result.items} query={input} /><Pagination path="/admin/attendance" query={input} {...result} compact
      pageSizeControl={<UserPageSize path="/admin/attendance" pageSize={input.pageSize} query={input} />} />
  </>;
}
