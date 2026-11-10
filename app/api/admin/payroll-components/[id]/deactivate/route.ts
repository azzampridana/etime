import { payrollApi, payrollJsonBody } from "@/lib/payroll/api";
import { deactivatePayrollComponent } from "@/services/payroll-component.service";

export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return payrollApi(async () => deactivatePayrollComponent((await params).id, await payrollJsonBody(request)));
}
