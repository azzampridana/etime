import "server-only";
import { userPayslipPageSchema } from "@/schemas/user-payslip.schema";
import { requireUser } from "@/lib/authorization/require-user";
import { ApplicationError } from "@/lib/errors/application-error";
import { payslipIdSchema } from "@/schemas/payroll.schema";
import { findUserPublishedPayslip, listUserPublishedPayslips } from "@/repositories/payroll.repository";
import { toUserPayslipDetail, toUserPayslipSummary } from "@/mappers/user-payslip.mapper";
import { toPayrollDetail } from "@/mappers/payroll.mapper";

export async function requirePayslipUser() {
  const user = await requireUser();
  if (user.role !== "USER") throw new ApplicationError("FORBIDDEN", "Employee access required.");
  return user;
}
export async function getMyPayslips(pageInput: unknown) {
  const user = await requirePayslipUser();
  const page = userPayslipPageSchema.parse(pageInput);
  const result = await listUserPublishedPayslips(user.id, page, 15);
  return { ...result, items: result.items.map(toUserPayslipSummary), latest: result.latest ? toUserPayslipSummary(result.latest) : null };
}
async function ownedRecord(idInput: unknown) {
  const user = await requirePayslipUser();
  const id = payslipIdSchema.safeParse(idInput);
  if (!id.success) throw new ApplicationError("PAYROLL_NOT_FOUND", "Payslip unavailable.");
  const record = await findUserPublishedPayslip(user.id, id.data);
  if (!record) throw new ApplicationError("PAYROLL_NOT_FOUND", "Payslip unavailable.");
  return record;
}
export async function getMyPayslip(id: unknown) { return toUserPayslipDetail(await ownedRecord(id)); }
export async function getMyPayslipPdf(id: unknown) {
  const record = await ownedRecord(id);
  const { renderPayrollPdf } = await import("@/lib/payroll/pdf");
  return { bytes: await renderPayrollPdf(toPayrollDetail(record)), filename: `payslip-${record.year}-${String(record.month).padStart(2, "0")}-${record.id}.pdf` };
}
