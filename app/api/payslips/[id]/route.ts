import { userPayslipApi } from "@/lib/payroll/user-api";
import { getMyPayslip } from "@/services/user-payslip.service";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return userPayslipApi(async () => getMyPayslip((await context.params).id));
}
