import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExportButton } from "@/components/admin/reports/export-button";
import type { EmployeeReportQuery } from "@/schemas/report.schema";

export function ReportFilters({ input }: { input: EmployeeReportQuery }) {
  const exportParams = new URLSearchParams({ from: input.from, to: input.to });
  for (const field of ["search", "sort", "order"] as const) if (input[field]) exportParams.set(field, input[field]);
  return <div className="mb-4 flex flex-wrap items-start gap-3">
    <form key={JSON.stringify(input)} action="/admin/reports" className="flex min-w-0 flex-1 flex-wrap items-end gap-3">
      <input type="hidden" name="page" value="1" /><input type="hidden" name="pageSize" value={input.pageSize} />
      {input.sort && <input type="hidden" name="sort" value={input.sort} />}{input.order && <input type="hidden" name="order" value={input.order} />}
      <label className="min-w-40 flex-1 space-y-1 text-sm">Search Employee<Input name="search" defaultValue={input.search} placeholder="Name or email…" className="h-10" /></label>
      <label className="space-y-1 text-sm">From<Input type="date" name="from" defaultValue={input.from} required className="h-10" /></label>
      <label className="space-y-1 text-sm">To<Input type="date" name="to" defaultValue={input.to} required className="h-10" /></label>
      <Button type="submit" className="h-10">Apply</Button><Link href="/admin/reports" className="inline-flex h-10 items-center text-sm underline">Reset</Link>
    </form>
    <div className="pt-5"><ExportButton url={`/api/reports/export?${exportParams}`} /></div>
  </div>;
}
