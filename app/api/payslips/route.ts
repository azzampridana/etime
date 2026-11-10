import { userPayslipApi } from "@/lib/payroll/user-api";
import { getMyPayslips } from "@/services/user-payslip.service";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return userPayslipApi(() => getMyPayslips(new URL(request.url).searchParams.get("page") ?? undefined));
}
