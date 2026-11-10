import { requirePageUser } from "@/lib/authorization/page-access";
import { PageHeading } from "@/components/shared/page-heading";
import { EmployeeManagement } from "@/components/admin/employees/management";
import { listEmployeesSchema } from "@/schemas/employee.schema";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageUser(true);
  const params = await searchParams;
  const parsed = listEmployeesSchema.safeParse({ search: params.search, page: params.page, pageSize: params.pageSize, sort: params.sort, order: params.order });
  const query = parsed.success ? parsed.data : listEmployeesSchema.parse({});
  return <div className="mx-auto min-w-0 max-w-7xl space-y-3"><PageHeading title="Employees" /><EmployeeManagement key={JSON.stringify(query)} query={query} /></div>;
}
