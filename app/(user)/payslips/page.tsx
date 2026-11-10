import Link from "next/link";
import { getMyPayslips } from "@/services/user-payslip.service";
import { PayslipHistory } from "@/components/payslips/history";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
export default async function PayslipsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page } = await searchParams;
  const data = await getMyPayslips(page);
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return <div className="space-y-5 py-5"><header><h1 className="text-xl font-semibold">My Payslips</h1><p className="text-sm text-muted-foreground">Your published payroll statements.</p></header>
    {!data.latest ? <Card><CardContent className="p-5 text-sm text-muted-foreground">No published payslips yet. Your payslips will appear here after publication.</CardContent></Card> : <>
      <PayslipHistory items={data.items} />
      <nav aria-label="Payslip pagination" className="flex flex-wrap items-center justify-between gap-3"><Button asChild variant="outline" disabled={data.page <= 1}><Link prefetch={false} aria-disabled={data.page <= 1} tabIndex={data.page <= 1 ? -1 : undefined} className={data.page <= 1 ? "pointer-events-none opacity-50" : ""} href={`/payslips?page=${Math.max(1, data.page - 1)}`}>Previous</Link></Button><span className="text-sm text-muted-foreground">Page {data.page} of {pages}</span><Button asChild variant="outline" disabled={data.page >= pages}><Link prefetch={false} aria-disabled={data.page >= pages} tabIndex={data.page >= pages ? -1 : undefined} className={data.page >= pages ? "pointer-events-none opacity-50" : ""} href={`/payslips?page=${Math.min(pages, data.page + 1)}`}>Next</Link></Button></nav>
    </>}
  </div>;
}
