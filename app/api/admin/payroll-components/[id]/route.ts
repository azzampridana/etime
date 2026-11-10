import { payrollApi, payrollJsonBody } from "@/lib/payroll/api";
import { updatePayrollComponent } from "@/services/payroll-component.service";

export const runtime = "nodejs";
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return payrollApi(async () => updatePayrollComponent((await params).id, await payrollJsonBody(request)));
}
