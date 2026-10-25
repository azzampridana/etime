"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { submitOvertimeCorrectionAction } from "@/actions/overtime-correction/submit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { ActionResult } from "@/types/action-result";

export function OvertimeCorrectionRequestForm({ overtimeId }: { overtimeId: string }) {
  const [result, setResult] = useState<ActionResult<{ id: string }> | null>(null);
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const submitting = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || result?.success || uncertain) return;
    const form = new FormData(event.currentTarget);
    submitting.current = true;
    setPending(true);
    setResult(null);
    try {
      setResult(await submitOvertimeCorrectionAction({ overtimeId, checkOutLocal: form.get("checkOutLocal"), reason: form.get("reason") }));
    } catch {
      setUncertain(true);
      setResult({ success: false, message: "Submission outcome is unknown. Open request history before attempting another submission." });
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }
  return <Card className="min-w-0 rounded-2xl"><CardHeader><h2 className="text-lg font-semibold">Checkout details</h2><p className="text-sm text-muted-foreground">Tell us when your session ended and why Checkout was missed.</p></CardHeader><CardContent><form onSubmit={submit} className="space-y-5" aria-busy={pending}>
    <fieldset disabled={pending || !!result?.success || uncertain} className="space-y-4">
      <label className="block space-y-2 text-sm font-medium">Proposed Checkout (WIB / Asia/Jakarta)
        <Input name="checkOutLocal" type="datetime-local" step={60} required className="min-h-12 w-full min-w-0 rounded-xl" aria-invalid={!!result?.fieldErrors?.checkOutLocal} aria-describedby="checkout-help checkout-error" />
      </label>
      <p id="checkout-help" className="text-sm text-muted-foreground">Enter the actual historical Checkout date and time in WIB, even if your device uses another timezone. Cross-midnight sessions are allowed.</p>
      <p id="checkout-error" className="text-sm text-destructive">{result?.fieldErrors?.checkOutLocal?.join(" ")}</p>
      <label className="block space-y-2 text-sm font-medium">Reason for correction
        <Textarea name="reason" required maxLength={2000} rows={4} className="min-h-28 rounded-xl" aria-invalid={!!result?.fieldErrors?.reason} aria-describedby="reason-error" />
      </label>
      <p id="reason-error" className="text-sm text-destructive">{result?.fieldErrors?.reason?.join(" ")}</p>
      <p className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">This is a missing Checkout proposal, not automatic approval of payable overtime hours. Submission does not change official overtime or create GPS/photo evidence.</p>
      <Button type="submit" className="min-h-11 w-full">{pending ? "Submitting…" : "Submit request"}</Button>
    </fieldset>
    {result && <p role="status" className="rounded-xl border bg-muted/50 p-3 text-sm">{result.message}</p>}
    {result?.success && result.data && <Button asChild className="min-h-11 w-full"><Link href={`/overtime/requests/${result.data.id}`}>View submitted request</Link></Button>}
    <Button asChild variant="outline" className="min-h-11 w-full"><Link href="/overtime/requests">Open request history</Link></Button>
  </form></CardContent></Card>;
}
