import Link from "next/link";
import { PageHeading } from "@/components/shared/page-heading";
import { UserTable } from "@/components/admin/users/user-table";
import { UserFormDialog } from "@/components/admin/users/user-form-dialog";
import { UserPageSize } from "@/components/admin/users/user-page-size";
import { Pagination } from "@/components/admin/pagination";
import { InvalidFilters } from "@/components/admin/invalid-filters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requirePageUser } from "@/lib/authorization/page-access";
import { adminUsersQuerySchema, type AdminSearchParams } from "@/schemas/admin-query.schema";
import { listUsers } from "@/services/user.service";
import { listActiveWorkSchedules } from "@/services/work-schedule.service";

export default async function Page({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  const admin = await requirePageUser(true);
  const parsed = adminUsersQuerySchema.safeParse(await searchParams);
  if (!parsed.success) return <><PageHeading title="Users" /><InvalidFilters path="/admin/users" /></>;
  const input = parsed.data;
  const [result, schedules] = await Promise.all([listUsers(input), listActiveWorkSchedules()]);
  const status = input.isActive === undefined ? "" : input.isActive ? "active" : "inactive";
  const query = { search: input.search, role: input.role, status, pageSize: input.pageSize, sort: input.sort, order: input.order };
  return <>
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h1 id="users-heading" tabIndex={-1} className="text-2xl font-semibold tracking-tight">Users</h1><p className="mt-1 text-sm text-muted-foreground">Manage employee accounts and access.</p></div><UserFormDialog schedules={schedules} /></div>
    <form key={`${input.search ?? ""}:${status}`} method="get" className="mb-4 flex flex-wrap items-center gap-2">
      <div className="min-w-0 flex-1 basis-56"><Label htmlFor="search" className="sr-only">Search by name or email</Label><Input id="search" name="search" defaultValue={input.search} placeholder="Search by name or email…" className="h-10" /></div>
      {input.role && <input type="hidden" name="role" value={input.role} />}
      <input type="hidden" name="pageSize" value={input.pageSize} />
      <input type="hidden" name="page" value="1" />
      {input.sort && <input type="hidden" name="sort" value={input.sort} />}
      {input.order && <input type="hidden" name="order" value={input.order} />}
      <Label htmlFor="status" className="sr-only">Status</Label><select id="status" name="status" defaultValue={status} className="h-10 rounded-lg border bg-background px-3 text-sm"><option value="">Status: All</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
      <Button type="submit" className="h-10">Search</Button><Link href="/admin/users" className="inline-flex h-10 items-center px-2 text-sm underline">Reset</Link>
      <Link href="/admin/users/work-schedules" className="ml-auto inline-flex h-10 items-center text-xs text-muted-foreground underline">Work duration policies</Link>
    </form>
    {input.role && <p className="mb-3 text-xs text-muted-foreground">Filtered to {input.role} accounts. Reset to show all roles.</p>}
    <UserTable users={result.items} schedules={schedules} adminId={admin.id} query={query} page={result.page} />
    <Pagination compact path="/admin/users" query={query} pageSizeControl={<UserPageSize pageSize={input.pageSize} query={query} />} {...result} />
  </>;
}
