"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ExportButton({ url }: { url: string }) {
  const [pending, setPending] = useState(false), [message, setMessage] = useState("");
  async function download() {
    setPending(true); setMessage("");
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const result: unknown = await response.json();
        setMessage(typeof result === "object" && result !== null && "message" in result && typeof result.message === "string" ? result.message : "Unable to export the report.");
        return;
      }
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = objectUrl;
      link.download = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ?? "etime-attendance.xlsx";
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setMessage("Excel report downloaded.");
    } catch { setMessage("Unable to download the report. Please try again."); }
    finally { setPending(false); }
  }
  return <div className="max-w-sm space-y-2"><Button type="button" disabled={pending} onClick={download} className="h-10">{pending ? "Preparing Excel…" : "Export Excel"}</Button>{message && <p role="status" className="text-sm">{message}</p>}</div>;
}
