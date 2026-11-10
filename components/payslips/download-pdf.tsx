"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export function PayslipDownload({ id, primary = false }: { id: string; primary?: boolean }) {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    if (busy.current) return;
    busy.current = true; setPending(true); setError("");
    try {
      const response = await fetch(`/api/payslips/${encodeURIComponent(id)}/pdf`, { cache: "no-store" });
      if (!response.ok || !response.headers.get("content-type")?.startsWith("application/pdf")) {
        setError(response.status === 401 ? "Please sign in again." : "PDF unavailable. Please try again."); return;
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `payslip-${id}.pdf`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError("Unable to download PDF. Please try again."); }
    finally { busy.current = false; setPending(false); }
  }
  return <div><Button className={primary ? "min-h-11 w-full" : "min-h-11"} variant={primary ? "default" : "outline"} onClick={download} disabled={pending}><Download aria-hidden="true" />{pending ? "Downloading…" : primary ? "Download Payslip PDF" : "Download PDF"}</Button>{error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}</div>;
}
