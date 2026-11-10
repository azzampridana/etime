"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DownloadPayrollPdf({ id }: { id: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const downloads = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const urls = downloads.current;
    return () => {
      request.current?.abort();
      for (const [url, timer] of urls) { clearTimeout(timer); URL.revokeObjectURL(url); }
      urls.clear();
    };
  }, []);
  async function download() {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller;
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/admin/payroll/${encodeURIComponent(id)}/pdf`, {
        cache: "no-store", credentials: "same-origin", signal: controller.signal,
      });
      if (!response.ok) {
        const messages: Record<number, string> = {
          400: "Permintaan PDF tidak valid.", 401: "Sesi berakhir. Silakan login kembali.",
          403: "Akses ADMIN aktif diperlukan.", 404: "Slip tidak ditemukan.",
          409: "PDF hanya tersedia untuk slip PUBLISHED. Muat ulang detail.",
        };
        setError(messages[response.status] ?? "PDF tidak dapat dibuat. Silakan coba lagi."); return;
      }
      if (response.headers.get("content-type")?.split(";")[0] !== "application/pdf") {
        setError("Respons PDF tidak dikenali. Silakan muat ulang."); return;
      }
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      if (!blob.size) { setError("PDF kosong. Silakan coba lagi."); return; }
      const filename = response.headers.get("content-disposition")?.match(/filename="(payslip-[a-zA-Z0-9-]+\.pdf)"/)?.[1] ?? "payslip.pdf";
      const url = URL.createObjectURL(blob);
      const timer = setTimeout(() => { URL.revokeObjectURL(url); downloads.current.delete(url); }, 60_000);
      downloads.current.set(url, timer);
      const link = document.createElement("a"); link.href = url; link.download = filename;
      document.body.appendChild(link); link.click(); link.remove();
    } catch {
      if (!controller.signal.aborted) setError("Unduhan gagal. Periksa koneksi lalu coba lagi.");
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setPending(false);
    }
  }
  return <div className="space-y-2">
    <Button type="button" variant="outline" className="min-h-11" disabled={pending} onClick={download}>
      <Download aria-hidden="true" />{pending ? "Menyiapkan PDF…" : "Download PDF"}
    </Button>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
