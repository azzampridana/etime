import { employeeApi, employeeBody } from "@/lib/employee/api";
import { getEmployee, updateEmployee } from "@/services/employee.service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  return employeeApi(async () => getEmployee((await context.params).id));
}
export async function PUT(request: Request, context: Context) {
  return employeeApi(async () => updateEmployee((await context.params).id, await employeeBody(request)));
}
