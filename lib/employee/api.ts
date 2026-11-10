import "server-only";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/authorization/require-user";
import { ApplicationError } from "@/lib/errors/application-error";
import { isUniqueConstraintOn } from "@/lib/db/persistence-error";
import { checkMutationOrigin } from "@/lib/security/mutation-origin";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export async function employeeApi(operation: () => Promise<unknown>, status = 200) {
  try {
    await requireAdmin();
    return Response.json({ success: true, data: await operation() }, { status, headers });
  } catch (error) {
    let code = 500, message = "Unable to complete Employee operation. Reload before retrying.";
    if (error instanceof z.ZodError) { code = 400; message = "Check required fields, maximum lengths and date order."; }
    if (error instanceof ApplicationError) {
      const statuses: Record<string, number> = { UNAUTHENTICATED: 401, FORBIDDEN: 403, EMPLOYEE_CROSS_SITE: 403, EMPLOYEE_INVALID: 400, EMPLOYEE_NOT_FOUND: 404, EMPLOYEE_CONFLICT: 409 };
      if (statuses[error.code]) { code = statuses[error.code]; message = error.message; }
    }
    if (isUniqueConstraintOn(error, "employee_employeeNumber_key", ["employeeNumber"])) {
      code = 409; message = "Employee number is already in use. Reload and choose another number.";
    } else if (isUniqueConstraintOn(error, "employee_userId_key", ["userId"])) {
      code = 409; message = "Selected User is already linked to an Employee. Reload and choose another account.";
    } else if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
      code = 409; message = "Conflicting Employee change. Reload before saving.";
    }
    const errorCode = error instanceof ApplicationError && ["UNAUTHENTICATED", "FORBIDDEN", "EMPLOYEE_CROSS_SITE"].includes(error.code) ? error.code : undefined;
    return Response.json({ success: false, message, code: errorCode }, { status: code, headers });
  }
}
export async function employeeBody(request: Request): Promise<unknown> {
  const originFailure = checkMutationOrigin(request);
  if (originFailure) {
    throw new ApplicationError("EMPLOYEE_CROSS_SITE", originFailure === "configuration"
      ? "Employee origin configuration is invalid. Contact the administrator."
      : "Cross-site changes are not permitted.");
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new ApplicationError("EMPLOYEE_INVALID", "Send an application/json body.");
  }
  try { return await request.json(); }
  catch { throw new ApplicationError("EMPLOYEE_INVALID", "Invalid JSON body."); }
}
