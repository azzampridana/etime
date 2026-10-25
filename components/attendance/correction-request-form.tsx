"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { submitAttendanceCorrectionAction } from "@/actions/attendance-correction/submit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DAILY_REPORT_MAX_LENGTH } from "@/schemas/daily-report.schema";
import { formatAdminEventTime } from "@/lib/date-time/event-time";
import type { CorrectionFormContext } from "@/types/attendance-correction";

export function CorrectionRequestForm({ context }: { context: CorrectionFormContext }) {
  const router = useRouter();
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missingBoth = !context.attendanceId;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = new FormData(event.currentTarget);
    const common = { workDate: context.workDate, checkOutLocal: form.get("checkOutLocal"),
      checkOutTimezone: form.get("checkOutTimezone"), reason: form.get("reason"),
      ...(!context.existingReportContent ? { proposedDailyReportContent: form.get("report") } : {}) };
    submitting.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await submitAttendanceCorrectionAction(missingBoth
        ? { ...common, type: "MISSING_BOTH", checkInLocal: form.get("checkInLocal"), checkInTimezone: form.get("checkInTimezone") }
        : { ...common, type: "MISSING_CHECKOUT", attendanceId: context.attendanceId });
      if (result.success && result.data) {
        router.push(`/attendance/requests/${result.data.id}`);
        router.refresh();
      } else {
        setError([result.message, ...Object.values(result.fieldErrors ?? {}).flat()].join(" "));
      }
    } catch { setError("Unable to submit your request. Please try again."); }
    finally { submitting.current = false; setPending(false); }
  }
  return <form onSubmit={submit} className="space-y-5 rounded-2xl border bg-card p-4 sm:p-5">
    <div><h2 className="font-semibold">{missingBoth ? "Request Missing Attendance" : "Request Missing Checkout"}</h2>
      <p className="mt-1 text-sm text-muted-foreground">Work date: {context.workDate} (Asia/Jakarta). This proposal will not change Attendance until ADMIN approval. Submitted requests cannot be edited.</p></div>
    {context.checkInAt && context.checkInTimezone && <p className="text-sm">Original Check In: <strong>{formatAdminEventTime(context.checkInAt, context.checkInTimezone)}</strong>. Original evidence is preserved.</p>}
    <fieldset disabled={pending} className="min-w-0 space-y-4">
      <datalist id="correction-timezones"><option value="Asia/Jakarta" /><option value="Asia/Makassar" /><option value="Asia/Jayapura" /></datalist>
      {(missingBoth ? ["checkIn", "checkOut"] as const : ["checkOut"] as const).map(event => <div key={event} className="space-y-3">
        <label className="block space-y-2 text-sm font-medium">{event === "checkIn" ? "Proposed Check In" : "Proposed Check Out"}
          <Input className="min-h-11 min-w-0" type="datetime-local" name={`${event}Local`} required step={60} /></label>
        <label className="block space-y-2 text-sm font-medium">Declared {event === "checkIn" ? "Check-In" : "Checkout"} timezone
          <Input className="min-h-11" name={`${event}Timezone`} list="correction-timezones" placeholder="Select or enter an IANA timezone" required maxLength={100} autoComplete="off" /></label>
      </div>)}
      <p className="text-xs text-muted-foreground">Use the local time and timezone where each event happened. Checkout must be later than check-in and within 24 hours; crossing midnight is allowed.</p>
      {context.existingReportContent ? <div className="space-y-2 text-sm"><h3 className="font-medium">Existing Daily Report (read-only)</h3><p className="whitespace-pre-wrap break-words rounded-lg bg-muted p-3">{context.existingReportContent}</p></div>
        : <label className="block space-y-2 text-sm font-medium">Proposed Daily Report<Textarea name="report" required maxLength={DAILY_REPORT_MAX_LENGTH} rows={5} /><span className="text-xs font-normal text-muted-foreground">This remains a proposal until approval.</span></label>}
      <label className="block space-y-2 text-sm font-medium">Reason for correction<Textarea name="reason" required maxLength={2000} rows={3} /></label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="min-h-12 w-full">{pending ? "Submitting…" : "Submit correction request"}</Button>
    </fieldset>
  </form>;
}
