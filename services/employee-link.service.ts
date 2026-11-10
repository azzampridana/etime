import "server-only";
import { employeeLinkOptionsSchema } from "@/schemas/employee.schema";
import { requireAdmin } from "@/lib/authorization/require-user";
import { listUnlinkedEmployeeOptions, listUnlinkedUserOptions } from "@/repositories/employee.repository";
export async function getEmployeeLinkOptions(raw: unknown) {
  await requireAdmin();
  const input = employeeLinkOptionsSchema.parse(raw);
  return input.kind === "employee" ? listUnlinkedEmployeeOptions(input.search) : listUnlinkedUserOptions(input.search);
}
