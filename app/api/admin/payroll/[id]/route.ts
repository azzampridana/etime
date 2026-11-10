import { payrollApi, payrollJsonBody } from "@/lib/payroll/api";
import { deletePayrollDraft, getPayrollDetail, updatePayrollDraft } from "@/services/payroll.service";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  return payrollApi(async () => getPayrollDetail((await params).id));
}
export async function PUT(request: Request, { params }: Context) {
  return payrollApi(async () => updatePayrollDraft((await params).id, await payrollJsonBody(request)));
}
export async function DELETE(request: Request, { params }: Context) {
  return payrollApi(async () => deletePayrollDraft((await params).id, await payrollJsonBody(request)));
}
