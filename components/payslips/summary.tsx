import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { toUserPayslipSummary } from "@/mappers/user-payslip.mapper";
import { PayslipDownload } from "@/components/payslips/download-pdf";
export const formatRupiah = (amount: string) => `Rp ${BigInt(amount).toLocaleString("id-ID")}`;
export const payrollPeriod = (year: number, month: number) => new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
export function PayslipSummary({ slip, latest = false, showDetails = true }: { slip: ReturnType<typeof toUserPayslipSummary>; latest?: boolean; showDetails?: boolean }) {
  return <Card className="py-0"><CardContent className="space-y-4 p-4 sm:p-5">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0">{latest && <p className="mb-1 text-xs font-medium text-muted-foreground">Latest Payslip</p>}<h2 className="font-semibold">{payrollPeriod(slip.year, slip.month)}</h2></div><span className="shrink-0 rounded-full bg-secondary px-2 py-1 text-xs font-medium">Published</span></div>
    <div><p className="text-sm text-muted-foreground">Take-Home Pay</p><p className="break-words text-xl font-semibold">{formatRupiah(slip.takeHomePay)}</p></div>
    <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-muted-foreground">Earnings</dt><dd className="break-words font-medium">{formatRupiah(slip.totalEarnings)}</dd></div><div><dt className="text-muted-foreground">Deductions</dt><dd className="break-words font-medium">{formatRupiah(slip.totalDeductions)}</dd></div></dl>
    <div className="flex flex-wrap gap-2">{showDetails && <Button asChild className="min-h-11"><Link prefetch={false} href={`/payslips/${slip.id}`}>View Details</Link></Button>}<PayslipDownload id={slip.id} /></div>
  </CardContent></Card>;
}
