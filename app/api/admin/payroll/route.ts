import { payrollApi, payrollJsonBody } from "@/lib/payroll/api";
import { createPayrollDraft, listPayroll } from "@/services/payroll.service";

export const runtime = "nodejs";
export async function GET(request: Request) {
  return payrollApi(() => {
    const params = new URL(request.url).searchParams;
    const input = Object.fromEntries([...new Set(params.keys())].map(key => {
      const values = params.getAll(key);
      return [key, values.length === 1 ? values[0] : values];
    }));
    return listPayroll(input);
  });
}
export async function POST(request: Request) {
  return payrollApi(async () => createPayrollDraft(await payrollJsonBody(request)), 201);
}
