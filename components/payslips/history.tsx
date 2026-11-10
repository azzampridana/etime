"use client";

import { useEffect, useState } from "react";
import { Dialog } from "radix-ui";
import { ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { toUserPayslipDetail, toUserPayslipSummary } from "@/mappers/user-payslip.mapper";
import { formatRupiah, payrollPeriod } from "./summary";
import { PayslipDownload } from "./download-pdf";

type Detail = ReturnType<typeof toUserPayslipDetail>;
type Summary = ReturnType<typeof toUserPayslipSummary>;

function DetailContent({ id }: { id: string }) {
  const [slip, setSlip] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(""); setSlip(null);
    async function load() {
      try {
        const response = await fetch(`/api/payslips/${encodeURIComponent(id)}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) {
          if (!controller.signal.aborted) setError(response.status === 401 ? "Please sign in again." : response.status === 404 ? "Payslip unavailable." : "Unable to load payslip.");
          return;
        }
        const result: { success: boolean; data?: Detail } = await response.json();
        if (!result.success || !result.data || result.data.id !== id) throw new Error("Invalid response");
        if (!controller.signal.aborted) setSlip(result.data);
      } catch {
        if (!controller.signal.aborted) setError("Unable to load payslip. Please try again.");
      }
    }
    void load();
    return () => controller.abort();
  }, [id, attempt]);
  return <>
    <div className="min-h-0 flex-1 overflow-y-auto p-4 [overflow-wrap:anywhere] sm:p-5">
      {error ? <div className="space-y-3"><p role="alert" className="text-sm text-destructive">{error}</p><Button variant="outline" onClick={() => setAttempt(value => value + 1)}>Retry</Button></div> : !slip ? <p role="status" className="text-sm text-muted-foreground">Loading payslip…</p> : <div className="space-y-5">
        <div className="rounded-lg bg-muted/50 p-4"><p className="text-sm text-muted-foreground">Net Take Home Pay</p><p className="mt-1 text-2xl font-semibold tabular-nums">{formatRupiah(slip.takeHomePay)}</p></div>
        <div className="text-sm"><p className="font-semibold">{slip.employeeName}</p>{slip.employeePosition && <p className="text-muted-foreground">{slip.employeePosition}</p>}
          <dl className="mt-3 grid grid-cols-2 gap-3"><div><dt className="text-muted-foreground">Payment Bank</dt><dd>{slip.bankName || "Not provided"}</dd></div><div><dt className="text-muted-foreground">Account Number</dt><dd>{slip.maskedAccountNumber || "Not provided"}</dd></div></dl>
        </div>
        {(["EARNING", "DEDUCTION"] as const).map(category => <section key={category} className="space-y-3">
          <h3 className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${category === "EARNING" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"}`}>{category === "EARNING" ? "Earnings" : "Deductions"}</h3>
          <dl className="space-y-2 text-sm">{slip.items.filter(item => item.category === category).map(item => <div key={item.id} className="flex items-start justify-between gap-3"><dt className="min-w-0 flex-1">{item.name}</dt><dd className="max-w-[60%] text-right tabular-nums">{formatRupiah(item.amount)}</dd></div>)}</dl>
          {!slip.items.some(item => item.category === category) && <p className="text-sm text-muted-foreground">No items.</p>}
          <div className="flex justify-between gap-3 border-t pt-2 text-sm font-semibold"><span>Total {category === "EARNING" ? "Earnings" : "Deductions"}</span><span className="max-w-[60%] text-right tabular-nums">{formatRupiah(category === "EARNING" ? slip.totalEarnings : slip.totalDeductions)}</span></div>
        </section>)}
      </div>}
    </div>
    {slip && <footer className="shrink-0 border-t p-4"><PayslipDownload id={slip.id} primary /></footer>}
  </>;
}

function HistoryRow({ slip }: { slip: Summary }) {
  const [open, setOpen] = useState(false);
  return <li><Dialog.Root open={open} onOpenChange={setOpen}>
    <Dialog.Trigger asChild><button type="button" aria-label={`View payslip for ${payrollPeriod(slip.year, slip.month)}`} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
      <span className="min-w-0 flex-1 text-sm font-medium [overflow-wrap:anywhere]">{payrollPeriod(slip.year, slip.month)}</span><span className="min-w-0 max-w-[55%] text-right [overflow-wrap:anywhere]"><span className="block text-xs text-muted-foreground">Net Pay</span><span className="text-sm font-semibold tabular-nums">{formatRupiah(slip.takeHomePay)}</span></span><ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button></Dialog.Trigger>
    <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" /><Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[calc(100%_-_1rem)] max-w-[600px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border bg-background text-foreground shadow-lg">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b p-4"><div><Dialog.Title className="font-semibold">Payslip</Dialog.Title><Dialog.Description className="mt-1 text-sm text-muted-foreground">{payrollPeriod(slip.year, slip.month)}</Dialog.Description></div><Dialog.Close asChild><Button type="button" variant="ghost" size="icon" className="size-11 shrink-0" aria-label="Tutup"><X aria-hidden="true" /></Button></Dialog.Close></header>
      <DetailContent id={slip.id} />
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root></li>;
}

export function PayslipHistory({ items }: { items: Summary[] }) {
  return <ul aria-label="Payslip history" className="divide-y overflow-hidden rounded-xl border bg-card text-card-foreground">{items.map(slip => <HistoryRow key={slip.id} slip={slip} />)}</ul>;
}
