"use client";
import { useRef, useState } from "react";
import { useConfirmDialog } from "@/components/shared/confirm-dialog";
import { Files } from "lucide-react";
import type { initializePayrollDrafts } from "@/services/payroll.service";
import { Button } from "@/components/ui/button";
import { payrollRequest, PayrollHttpError, period } from "./shared";

export function InitializeButton({ year, month, refresh, disabled = false, onBusy }: { year: number; month: number; refresh: () => Promise<void>; disabled?: boolean; onBusy: (busy: boolean) => void }) {
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [report, setReport] = useState<Awaited<ReturnType<typeof initializePayrollDrafts>> | null>(null);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const confirmation = useConfirmDialog();
  const [reconciling, setReconciling] = useState(false);
  async function generate() {
    if (busy.current || blocked || disabled) return false;
    let completed = false;
    busy.current = true; onBusy(true); setPending(true); setError(""); setReport(null);
    try {
      const result = await payrollRequest<Awaited<ReturnType<typeof initializePayrollDrafts>>>("/initialize", "POST", { year, month });
      setReport(result);
      completed = result.status === "completed" && result.remainingEmployeesProcessed && result.unconfirmedCount === 0;
      setBlocked(result.status !== "completed" || !result.remainingEmployeesProcessed || result.unconfirmedCount > 0);
    } catch (e) { setError(e instanceof PayrollHttpError && e.status === 400 ? "Periksa periode dan pastikan master aktif berjumlah 1–100 sebelum generate." : e instanceof PayrollHttpError ? e.message : "Hasil belum dapat dipastikan."); setBlocked(true); }
    finally { await refresh().catch(() => { completed = false; setError("Daftar gagal diperbarui. Muat ulang dan periksa hasil sebelum mencoba lagi."); setBlocked(true); }); busy.current = false; onBusy(false); setPending(false); }
    return completed;
  }
  return <div className="min-w-0 max-w-full space-y-3"><Button className="min-h-11" disabled={pending || blocked || disabled} onClick={() => { setReconciling(false); confirmation.request({ title: "Generate Semua Draft?", description: `Generate semua draft ${period({ year, month })}? Slip existing tidak diubah. Pastikan master aktif sudah benar.`, variant: "warning", confirmLabel: "Generate Semua Draft", onConfirm: generate }); }}><Files aria-hidden="true" className="size-4" />{pending ? "Menyiapkan draft…" : "Generate Semua Draft"}</Button>
    {report && <div role="status" className="rounded-xl border bg-muted/40 p-4 text-sm"><p className="font-semibold">{report.status === "completed" && report.remainingEmployeesProcessed && !report.unconfirmedCount ? "Proses selesai" : "Proses terhenti — periksa progres"}</p><p>Created: {report.createdCount} · Skipped existing: {report.skippedExistingCount} · Tidak eligible: {report.skippedIneligibleCount} · Failed: {report.failedCount} · Unconfirmed: {report.unconfirmedCount}</p></div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {blocked && <div className="space-y-2 text-sm"><p>Periksa daftar/detail dan rekonsiliasi hasil yang belum pasti sebelum retry. Draft yang sudah committed tetap tersimpan.</p><Button className="min-h-11" variant="outline" onClick={async () => { if (busy.current) return; busy.current = true; try { await refresh(); setReconciling(true); confirmation.request({ title: "Konfirmasi rekonsiliasi", description: "Daftar sudah dimuat ulang. Sudah memeriksa dan merekonsiliasi hasil sebelum mengizinkan percobaan baru?", variant: "warning", confirmLabel: "Sudah diperiksa", onConfirm: () => { setBlocked(false); setError(""); } }); } catch { setError("Refresh gagal. Retry belum diizinkan."); } finally { busy.current = false; } }}>Refresh & konfirmasi rekonsiliasi</Button></div>}
    {confirmation.dialog(error, !reconciling && (blocked || disabled))}
  </div>;
}
