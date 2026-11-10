import { requirePageUser } from "@/lib/authorization/page-access";
import { PageHeading } from "@/components/shared/page-heading";
import { DraftForm } from "@/components/admin/payroll/draft-form";

export default async function Page() {
  await requirePageUser(true);
  return <div className="mx-auto min-w-0 max-w-4xl space-y-5 [overflow-wrap:anywhere]"><PageHeading title="Buat draft Payroll" description="Pilih karyawan dan periode, lalu tambahkan komponen penghasilan dan potongan." /><DraftForm /></div>;
}
