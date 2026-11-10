import "server-only";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/authorization/require-user";
import { ApplicationError } from "@/lib/errors/application-error";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export async function payrollApi(operation: () => Promise<unknown>, status = 200) {
  try {
    // Authenticate before parsing a body or resolving resource details.
    await requireAdmin();
    const result = await operation();
    // Binary downloads share the same authorization and sanitized error boundary.
    if (result instanceof Response) return result;
    return Response.json({ success: true, data: result }, { status, headers });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ success: false, message: "Invalid payroll input. Check fields, amounts and item order." }, { status: 400, headers });
    if (error instanceof ApplicationError) {
      const statuses: Record<string, number> = { UNAUTHENTICATED: 401, FORBIDDEN: 403,
        PAYROLL_INVALID: 400, PAYROLL_NOT_FOUND: 404, PAYROLL_CONFLICT: 409 };
      const status = statuses[error.code];
      if (status) return Response.json({ success: false, message: error.message }, { status, headers });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return Response.json({ success: false, message: "Concurrent change detected. Reload before trying again." }, { status: 409, headers });
    }
    return Response.json({ success: false, message: "Unable to complete payroll operation. Reload to confirm the current state before retrying." }, { status: 500, headers });
  }
}

export async function payrollJsonBody(request: Request): Promise<unknown> {
  // Cookie-authenticated mutations accept JSON only, never cross-site HTML forms.
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new ApplicationError("PAYROLL_INVALID", "Send an application/json request body.");
  }
  const origin = request.headers.get("origin");
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new ApplicationError("FORBIDDEN", "Cross-site payroll changes are not permitted.");
  }
  try { return await request.json(); }
  catch { throw new ApplicationError("PAYROLL_INVALID", "Invalid JSON request body."); }
}
