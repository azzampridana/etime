import "server-only";
import { getPayrollDetail } from "@/services/payroll.service";
import { ApplicationError } from "@/lib/errors/application-error";
import { renderPayrollPdf } from "@/lib/payroll/pdf";

export async function getPayrollPdf(id: unknown) {
  // Existing service authenticates active ADMIN before reading server snapshots.
  const slip = await getPayrollDetail(id);
  if (slip.status !== "PUBLISHED") {
    throw new ApplicationError("PAYROLL_CONFLICT", "Only published payslips can be downloaded.");
  }
  const bytes = await renderPayrollPdf(slip);
  // UUID is validated by getPayrollDetail; no employee text enters the filename.
  return { bytes, filename: `payslip-${slip.year}-${String(slip.month).padStart(2, "0")}-${slip.id}.pdf` };
}
