import Link from "next/link";
import { notFound } from "next/navigation";
import { getMyPayslip } from "@/services/user-payslip.service";
import { ApplicationError } from "@/lib/errors/application-error";
import { formatRupiah, payrollPeriod, PayslipSummary } from "@/components/payslips/summary";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
export default async function PayslipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const slip = await getMyPayslip(id).catch(error => { if (error instanceof ApplicationError && error.code === "PAYROLL_NOT_FOUND") notFound(); throw error; });
  return <div className="space-y-4 py-5"><Button asChild variant="outline"><Link prefetch={false} href="/payslips">Back to My Payslips</Link></Button><h1 className="text-xl font-semibold">Payslip · {payrollPeriod(slip.year, slip.month)}</h1>
    <Card><CardContent className="space-y-3 p-4 [overflow-wrap:anywhere]"><div><h2 className="font-semibold">{slip.employeeName}</h2>{slip.employeePosition && <p className="text-sm text-muted-foreground">{slip.employeePosition}</p>}</div><dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Payment Bank</dt><dd>{slip.bankName || "Not provided"}</dd></div><div><dt className="text-muted-foreground">Account Number</dt><dd>{slip.maskedAccountNumber || "Not provided"}</dd></div></dl></CardContent></Card>
    <div className="grid gap-4 sm:grid-cols-2">{(["EARNING", "DEDUCTION"] as const).map(category => <Card key={category}><CardContent className="p-4"><h2 className="mb-3 font-semibold">{category === "EARNING" ? "Earnings" : "Deductions"}</h2><dl className="space-y-3 text-sm">{slip.items.filter(item => item.category === category).map(item => <div key={item.id} className="flex items-start justify-between gap-3"><dt className="min-w-0 flex-1 break-words">{item.name}</dt><dd className="max-w-[60%] break-words text-right font-medium">{formatRupiah(item.amount)}</dd></div>)}</dl>{!slip.items.some(item => item.category === category) && <p className="text-sm text-muted-foreground">No items.</p>}</CardContent></Card>)}</div>
    <PayslipSummary slip={slip} showDetails={false} />
  </div>;
}
