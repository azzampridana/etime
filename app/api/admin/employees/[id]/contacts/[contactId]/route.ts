import { employeeApi, employeeBody } from "@/lib/employee/api";
import { mutateEmployeeContact } from "@/services/employee-contact.service";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string; contactId: string }> };
export async function PUT(request: Request, context: Context) {
  // Temporary E4.6 diagnostic: no identifiers or request data.
  if (process.env.NODE_ENV === "development") console.info("[EmployeeContact] PUT_ENTERED");
  return employeeApi(async () => { const { id, contactId } = await context.params; return mutateEmployeeContact(id, contactId, await employeeBody(request), "update"); });
}
export async function DELETE(request: Request, context: Context) {
  return employeeApi(async () => { const { id, contactId } = await context.params; return mutateEmployeeContact(id, contactId, await employeeBody(request), "delete"); });
}
