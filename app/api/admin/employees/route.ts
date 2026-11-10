import { employeeApi, employeeBody } from "@/lib/employee/api";
import { createEmployee, listEmployees } from "@/services/employee.service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return employeeApi(() => listEmployees(Object.fromEntries(new URL(request.url).searchParams)));
}
export async function POST(request: Request) {
  return employeeApi(async () => createEmployee(await employeeBody(request)), 201);
}
