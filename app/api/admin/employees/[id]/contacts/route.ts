import { employeeApi, employeeBody } from "@/lib/employee/api";
import { listEmployeeContacts, mutateEmployeeContact } from "@/services/employee-contact.service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  return employeeApi(async () => listEmployeeContacts((await context.params).id, new URL(request.url).searchParams.get("page") ?? undefined));
}
export async function POST(request: Request, context: Context) {
  return employeeApi(async () => mutateEmployeeContact((await context.params).id, undefined, await employeeBody(request), "create"), 201);
}
