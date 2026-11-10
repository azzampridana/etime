import { userPayslipApi, userPayslipHeaders } from "@/lib/payroll/user-api";
import { getMyPayslipPdf } from "@/services/user-payslip.service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return userPayslipApi(async () => {
    const { bytes, filename } = await getMyPayslipPdf((await context.params).id);
    return new Response(new Uint8Array(bytes), { headers: { ...userPayslipHeaders, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"` } });
  });
}
