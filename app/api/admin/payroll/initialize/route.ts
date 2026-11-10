import { payrollApi, payrollJsonBody } from "@/lib/payroll/api";
import { initializePayrollDrafts } from "@/services/payroll.service";

export const runtime = "nodejs";
export async function POST(request: Request) {
  return payrollApi(async () => initializePayrollDrafts(await payrollJsonBody(request)));
}
