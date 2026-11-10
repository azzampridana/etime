import { employeeApi } from "@/lib/employee/api";
import { getEmployeeLinkOptions } from "@/services/employee-link.service";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return employeeApi(() => getEmployeeLinkOptions(Object.fromEntries(new URL(request.url).searchParams)));
}
