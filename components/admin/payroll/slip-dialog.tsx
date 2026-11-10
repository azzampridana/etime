"use client";
import { useEffect, useRef, useState } from "react";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { DraftForm, type DraftCloseGuard } from "./draft-form";
import { X } from "lucide-react";
import { DownloadPayrollPdf } from "./download-pdf";
import { PayrollItemTable, period, Status, Totals, payrollRequest, PayrollHttpError, type PayrollDetail } from "./shared";

export function SlipDialog({ id, onClose, onSaved, onChanged }: { id: string; onClose: () => void; onSaved: () => void; onChanged: () => Promise<void> }) {
  const [row, setRow] = useState<PayrollDetail | null>(null);
  const [error, setError] = useState("");
  const opener = useRef<HTMLElement | null>(null);
  const closeGuard = useRef<DraftCloseGuard | null>(null);
  const [notice, setNotice] = useState("");
  function requestClose() { if (!closeGuard.current || closeGuard.current.canClose()) onClose(); }
  useEffect(() => {
    let live = true;
    payrollRequest<PayrollDetail>(`/${id}`).then(data => { if (live) setRow(data); }).catch(e => { if (live) setError(e instanceof PayrollHttpError ? e.message : "Detail tidak dapat dimuat."); });
    return () => { live = false; };
  }, [id]);
  return <Dialog.Root open><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" /><Dialog.Content onOpenAutoFocus={() => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }} onCloseAutoFocus={event => { event.preventDefault(); opener.current?.focus(); }} onEscapeKeyDown={event => { event.preventDefault(); requestClose(); }} onPointerDownOutside={event => { event.preventDefault(); requestClose(); }} onInteractOutside={event => event.preventDefault()} className="fixed inset-0 z-50 flex flex-col bg-background sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:max-h-[90dvh] sm:w-[calc(100%_-_2rem)] sm:max-w-5xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border">
    <div className="border-b px-4 py-3"><div className="flex items-start justify-between gap-3"><Dialog.Title className="font-semibold">{row ? `${row.employeeNameSnapshot} · ${period(row)}` : "Slip Payroll"}</Dialog.Title><div className="flex shrink-0 items-center gap-2">{row && <Status status={row.status} />}<Button type="button" variant="ghost" size="icon" className="size-11" aria-label="Tutup" onClick={requestClose}><X aria-hidden="true" /></Button></div></div><Dialog.Description className="sr-only">Detail slip Payroll. Tutup melalui tombol X, Escape, atau backdrop.</Dialog.Description></div>
    <div className="min-h-0 overflow-y-auto p-3 [overflow-wrap:anywhere]">{notice && <p role="status" className="mb-3 rounded-lg bg-muted p-3 text-sm">{notice}</p>}
      {error ? <p role="alert" className="text-destructive">{error}</p> : !row ? <p role="status">Memuat detail…</p> : row.status === "DRAFT" ? <DraftForm initial={row} closeGuard={closeGuard} onClose={onClose} onSaved={onSaved} onPublished={published => { setRow(published); setNotice("Slip berhasil dipublikasikan dan tidak dapat diedit."); void onChanged().catch(() => setNotice("Publish berhasil, tetapi refresh daftar gagal. Muat ulang daftar.")); }} /> : <div className="space-y-3">
        <p>{row.employeePositionSnapshot || "Jabatan tidak tercatat"}</p><p>Bank: {row.bankName || "—"} · Rekening: {row.accountNumber || "—"}</p>
        <p className="text-sm text-muted-foreground">{row.companyNameSnapshot} · {row.companyAddressSnapshot}</p>
        <PayrollItemTable items={row.items} />
        <Totals earnings={row.totalEarnings} deductions={row.totalDeductions} takeHome={row.takeHomePay} />
        <div className="sticky bottom-0 flex flex-wrap gap-2 bg-background py-2"><Button disabled className="min-h-11">Save Draft</Button><Button disabled variant="outline" className="min-h-11">Publish</Button><DownloadPayrollPdf id={row.id} /></div>
      </div>}
      
    </div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
