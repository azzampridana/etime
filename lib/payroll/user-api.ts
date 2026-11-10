import "server-only";
import { z } from "zod";
import { ApplicationError } from "@/lib/errors/application-error";
import { requirePayslipUser } from "@/services/user-payslip.service";

export const userPayslipHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export async function userPayslipApi(operation: () => Promise<unknown>) {
  try {
    await requirePayslipUser();
    const result = await operation();
    return result instanceof Response ? result : Response.json({ success: true, data: result }, { headers: userPayslipHeaders });
  } catch (error) {
    const statuses: Record<string, number> = { UNAUTHENTICATED: 401, FORBIDDEN: 403, PAYROLL_NOT_FOUND: 404 };
    const status = error instanceof z.ZodError ? 400 : error instanceof ApplicationError ? statuses[error.code] ?? 500 : 500;
    const message = status === 404 ? "Payslip unavailable." : status === 401 ? "Please sign in again." : status === 403 ? "Employee access required." : status === 400 ? "Invalid page." : "Unable to load payslip. Please try again.";
    return Response.json({ success: false, message }, { status, headers: userPayslipHeaders });
  }
}
