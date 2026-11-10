import { payrollApi } from "@/lib/payroll/api";
import { getPayrollPdf } from "@/services/payroll-pdf.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return payrollApi(async () => {
    const { bytes, filename } = await getPayrollPdf((await params).id);
    return new Response(new Uint8Array(bytes), { headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  });
}
