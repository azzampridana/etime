import { OvertimeNavigation } from "@/components/admin/overtime/overtime-navigation";
import { OvertimeMonitoringFilters } from "@/components/admin/overtime/monitoring-filters";
import { OvertimeTable } from "@/components/admin/overtime/overtime-table";
import { AuthorizationTable } from "@/components/admin/overtime/authorization-table";
import { UserPageSize } from "@/components/admin/users/user-page-size";
import { PageHeading } from "@/components/shared/page-heading";
import { Pagination } from "@/components/admin/pagination";
import { InvalidFilters } from "@/components/admin/invalid-filters";
import { requirePageUser } from "@/lib/authorization/page-access";
import { getBusinessDate } from "@/lib/date-time/event-time";
import type { AdminSearchParams } from "@/schemas/admin-query.schema";
import { overtimeActivityQuerySchema, overtimeAuthorizationMonitoringQuerySchema } from "@/schemas/admin-overtime-monitoring.schema";
import { listOvertimeActivity, listAuthorizationMonitoring } from "@/services/admin-overtime-monitoring.service";

export default async function Page({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  await requirePageUser(true);
  const raw = await searchParams;
  const authorization = raw.view === "authorization";
  const active = authorization ? "authorization" : "activity";
  const today = getBusinessDate();
  if (authorization) {
    const parsed = overtimeAuthorizationMonitoringQuerySchema.safeParse(raw);
    if (!parsed.success) return <><PageHeading title="Overtime" /><OvertimeNavigation active={active} /><InvalidFilters path="/admin/overtime?view=authorization" /></>;
    const input = parsed.data;
    const result = await listAuthorizationMonitoring(input);
    const query = { ...input, view: "authorization" };
    return <><PageHeading title="Overtime" description={`${input.from === today && input.to === today ? `Today · ${today}` : `${input.from} – ${input.to}`} · Asia/Jakarta work dates.`} />
      <OvertimeNavigation active={active} /><OvertimeMonitoringFilters input={input} authorization />
      <AuthorizationTable items={result.items} query={input} /><Pagination path="/admin/overtime" query={query} {...result} compact pageSizeControl={<UserPageSize path="/admin/overtime" pageSize={input.pageSize} query={query} />} />
    </>;
  }
  const parsed = overtimeActivityQuerySchema.safeParse(raw);
  if (!parsed.success) return <><PageHeading title="Overtime" /><OvertimeNavigation active={active} /><InvalidFilters path="/admin/overtime" /></>;
  const input = parsed.data;
  const result = await listOvertimeActivity(input);
  const isToday = input.from === today && input.to === today;
  return <><PageHeading title="Overtime" description={`${isToday ? `Today · ${today}` : `${input.from} – ${input.to}`} · Originating Attendance work dates (Asia/Jakarta).`} />
    <OvertimeNavigation active={active} /><OvertimeMonitoringFilters input={input} />
    <OvertimeTable items={result.items} query={input} today={isToday} /><Pagination path="/admin/overtime" query={input} {...result} compact pageSizeControl={<UserPageSize path="/admin/overtime" pageSize={input.pageSize} query={input} />} />
  </>;
}
