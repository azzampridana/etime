import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/authorization/page-access";
import { PageHeading } from "@/components/shared/page-heading";
import { PayrollDetailView } from "@/components/admin/payroll/payroll-detail";
import { payslipIdSchema } from "@/schemas/payroll.schema";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requirePageUser(true);
  const parsed = payslipIdSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  return <div className="mx-auto min-w-0 max-w-4xl space-y-5 [overflow-wrap:anywhere]"><PageHeading title="Edit draft Payroll" description="Simpan mengganti seluruh komponen editable. Identitas dan periode tetap." /><PayrollDetailView key={parsed.data} id={parsed.data} edit /></div>;
}
