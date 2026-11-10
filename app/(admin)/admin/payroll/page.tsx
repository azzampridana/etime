import { requirePageUser } from "@/lib/authorization/page-access";
import { PageHeading } from "@/components/shared/page-heading";
import { InvalidFilters } from "@/components/admin/invalid-filters";
import { PayrollListView } from "@/components/admin/payroll/payroll-list";
import { listPayrollSchema } from "@/schemas/payroll.schema";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageUser(true);
  const { deleted, ...raw } = await searchParams;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const parsed = listPayrollSchema.safeParse({ ...raw, year: raw.year ?? today.find(part => part.type === "year")?.value, month: raw.month ?? today.find(part => part.type === "month")?.value });
  if (!parsed.success) return <><div className="[&>div]:mb-3"><PageHeading title="Payroll" /></div><InvalidFilters path="/admin/payroll" /></>;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(parsed.data)) if (value !== undefined) params.set(key, String(value));
  const query = params.toString();
  return <div className="mx-auto min-w-0 max-w-7xl space-y-3 [overflow-wrap:anywhere]"><div className="[&>div]:mb-3"><PageHeading title="Payroll" /></div>
    {deleted === "1" && <p role="status" className="rounded-lg bg-muted p-3 text-sm">Draft berhasil dihapus.</p>}
    <PayrollListView key={query} query={query} />
  </div>;
}
