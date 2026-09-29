"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { saveDailyReportAction } from "@/actions/attendance/save-daily-report";
import { AttendanceEventForm } from "@/components/attendance/attendance-event-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { DAILY_REPORT_MAX_LENGTH } from "@/schemas/daily-report.schema";
import type { DailyReportDto } from "@/types/daily-report";

export function OpenAttendanceWorkflow({ report, attendanceId }: { report: DailyReportDto | null; attendanceId: string }) {
  const router = useRouter();
  const [content, setContent] = useState(report?.content ?? "");
  const [saved, setSaved] = useState(report);
  const [pending, setPending] = useState(false);
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [message, setMessage] = useState("");
  const saving = useRef(false);
  const dirty = content.trim() !== (saved?.content ?? "");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || checkoutPending) return;
    saving.current = true;
    setPending(true);
    setMessage("");
    try {
      const result = await saveDailyReportAction({ content, attendanceId });
      if (result.success && result.data) {
        setSaved(result.data);
        setContent(result.data.content);
      }
      setMessage([result.message, ...Object.values(result.fieldErrors ?? {}).flat()].join(" "));
      router.refresh();
    } catch {
      setMessage("Unable to reach the server. Please check your connection and try again.");
    } finally {
      saving.current = false;
      setPending(false);
    }
  }

  return <div className="space-y-6">
    <Card>
      <CardHeader><h2 className="text-lg font-semibold">Daily Report</h2><p className="text-muted-foreground">Describe today's work. Save your report before checkout.</p></CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-4" aria-busy={pending}>
          <Label htmlFor="daily-report">Work completed</Label>
          <textarea id="daily-report" required maxLength={DAILY_REPORT_MAX_LENGTH} rows={6} value={content} onChange={(event) => setContent(event.target.value)} disabled={pending || checkoutPending}
            className="w-full resize-y rounded-lg border border-input bg-background p-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <p className="text-sm text-muted-foreground">{saved ? dirty ? "Unsaved changes. Save before checking out." : "Your report is saved. You can update it until checkout." : "A saved Daily Report is required for checkout."}</p>
          <p role="status" className="break-words text-sm">{message}</p>
          <Button type="submit" className="min-h-12 w-full" disabled={pending || checkoutPending || !content.trim()}>{pending ? "Saving…" : "Save Daily Report"}</Button>
        </form>
      </CardContent>
    </Card>
    <AttendanceEventForm mode="check-out" attendanceId={attendanceId} disabled={!saved || dirty || pending} onPendingChange={setCheckoutPending} />
  </div>;
}
