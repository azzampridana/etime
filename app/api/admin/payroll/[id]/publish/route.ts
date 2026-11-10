import { payrollApi, payrollJsonBody } from "@/lib/payroll/api";
import { publishPayroll } from "@/services/payroll.service";

export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return payrollApi(async () => publishPayroll((await params).id, await payrollJsonBody(request)));
}
