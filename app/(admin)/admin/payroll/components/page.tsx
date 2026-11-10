import { requirePageUser } from "@/lib/authorization/page-access";
import { PageHeading } from "@/components/shared/page-heading";
import { MasterComponents } from "@/components/admin/payroll/master-components";

export default async function Page() {
  await requirePageUser(true);
  return <div className="mx-auto min-w-0 max-w-4xl space-y-5"><PageHeading title="Komponen mandatory Payroll" description="Master aktif digunakan untuk draft baru. Perubahan tidak mengubah slip existing." /><MasterComponents /></div>;
}
