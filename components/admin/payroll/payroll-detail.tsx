"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DraftForm } from "./draft-form";
import { PayrollItemTable, period, Status, Totals, payrollRequest, PayrollHttpError, type PayrollDetail } from "./shared";

function DeleteDraft({ row }: { row: PayrollDetail }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false);
  const busy = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  async function remove() {
    if (busy.current || blocked) return;
    busy.current = true; setPending(true); setError("");
    try {
      // Confirm the displayed version is still current; never delete unseen edits.
      const current = await payrollRequest<PayrollDetail>(`/${row.id}`);
      if (current.version !== row.version || current.status !== "DRAFT") throw new PayrollHttpError(409, "Draft berubah. Muat ulang dan tinjau kembali sebelum menghapus.");
      await payrollRequest<{ id: string }>(`/${row.id}`, "DELETE", { version: current.version });
      setOpen(false); router.replace("/admin/payroll?deleted=1"); router.refresh();
    } catch (failure) {
      setError(failure instanceof PayrollHttpError ? failure.message : "Hasil belum dapat dipastikan. Muat ulang sebelum mencoba lagi.");
      setBlocked(true);
    } finally { busy.current = false; setPending(false); }
  }
  return <><Button ref={trigger} variant="destructive" className="min-h-11" onClick={() => setOpen(true)}>Hapus draft</Button>
    <ConfirmDialog open={open} title="Hapus draft Payroll?" description={`Draft ${row.employeeNameSnapshot}, ${period(row)}, beserta semua item akan dihapus permanen.`}
      variant="danger" pending={pending} error={error} confirmLabel={blocked ? "Muat ulang" : "Hapus draft"}
      onCancel={() => { if (!busy.current) setOpen(false); }} onConfirm={() => { if (blocked) window.location.reload(); else void remove(); }} onRestoreFocus={() => trigger.current?.focus()} />
  </>;
}

export function PayrollDetailView({ id, edit = false }: { id: string; edit?: boolean }) {
  const [row, setRow] = useState<PayrollDetail | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let live = true;
    payrollRequest<PayrollDetail>(`/${encodeURIComponent(id)}`).then(data => { if (live) setRow(data); }).catch(failure => {
      if (live) setError(failure instanceof PayrollHttpError ? failure.message : "Detail Payroll tidak dapat dimuat.");
    });
    return () => { live = false; };
  }, [id, reload]);
  if (error) return <div role="alert" className="space-y-3"><p className="text-destructive">{error}</p><Button variant="outline" className="min-h-11" onClick={() => { setError(""); setReload(value => value + 1); }}>Muat ulang</Button><Button asChild variant="outline" className="min-h-11"><Link href="/admin/payroll">Kembali ke Payroll</Link></Button></div>;
  if (!row) return <p role="status">Memuat detail Payroll…</p>;
  if (edit && row.status === "DRAFT") return <DraftForm key={`${row.id}:${row.version}`} initial={row} />;
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3"><Button asChild variant="outline" className="min-h-11"><Link href="/admin/payroll">Kembali ke Payroll</Link></Button><Status status={row.status} /></div>
    {edit && <p className="rounded-lg border p-3 text-sm">Slip PUBLISHED bersifat read-only.</p>}
    <Card size="sm"><CardContent className="space-y-3"><div><h2 className="text-lg font-semibold">{row.employeeNameSnapshot}</h2><p className="text-sm text-muted-foreground">{row.employeePositionSnapshot || "Jabatan tidak tercatat"}</p><p className="mt-1 font-medium">{period(row)}</p></div>
      <div className="grid gap-3 border-t pt-3 text-sm sm:grid-cols-2"><div className="space-y-1"><h3 className="font-medium">Perusahaan (snapshot)</h3><p>{row.companyNameSnapshot}</p><p>{row.companyAddressSnapshot || "—"}</p><p>{row.companyEmailSnapshot || "—"}</p><p>{row.companyPhoneSnapshot || "—"}</p></div><div className="space-y-1"><h3 className="font-medium">Informasi pembayaran</h3><p>Bank: {row.bankName || "—"}</p><p>Nomor rekening: {row.accountNumber || "—"}</p></div></div>
    </CardContent></Card>
    <PayrollItemTable items={row.items} />
    <Totals earnings={row.totalEarnings} deductions={row.totalDeductions} takeHome={row.takeHomePay} />
    {row.status === "DRAFT" && <div className="flex flex-wrap gap-2"><Button asChild className="min-h-11"><Link href={`/admin/payroll/${row.id}/edit`}>Edit draft</Link></Button><DeleteDraft row={row} /></div>}
  </div>;
}
