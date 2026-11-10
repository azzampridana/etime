import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/authorization/page-access";
import { PageHeading } from "@/components/shared/page-heading";
import { PayrollDetailView } from "@/components/admin/payroll/payroll-detail";
import { payslipIdSchema } from "@/schemas/payroll.schema";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageUser(true);
  const parsed = payslipIdSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const saved = (await searchParams).saved === "1";
  return <div className="mx-auto min-w-0 max-w-4xl space-y-5 [overflow-wrap:anywhere]"><PageHeading title="Detail Payroll" />
    {saved && <p role="status" className="rounded-lg bg-muted p-3 text-sm">Draft berhasil disimpan.</p>}
    <PayrollDetailView key={parsed.data} id={parsed.data} />
  </div>;
}
