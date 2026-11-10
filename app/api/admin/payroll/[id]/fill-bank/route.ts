import { payrollApi, payrollJsonBody } from "@/lib/payroll/api";
import { fillPayrollBank } from "@/services/payroll.service";

export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return payrollApi(async () => fillPayrollBank((await params).id, await payrollJsonBody(request)));
}
