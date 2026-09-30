"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { saveOvertimePolicyAction } from "@/actions/overtime-policy";
import { MAX_OVERTIME_POLICY_MINUTES } from "@/schemas/overtime-policy.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OvertimePolicyForm({ maxOpenMinutes }: { maxOpenMinutes: number }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setPending(true); setMessage("");
    try {
      const result = await saveOvertimePolicyAction({ hours: Number(data.get("hours")), minutes: Number(data.get("minutes")) });
      setMessage(result.message);
      if (result.success) router.refresh();
    } catch { setMessage("Unable to save. Please try again."); }
    finally { setPending(false); }
  }
  return <form onSubmit={submit} className="space-y-3 rounded-lg border p-4" aria-busy={pending}>
    <h3 className="font-semibold">Maximum open overtime window</h3>
    <fieldset disabled={pending} className="space-y-3">
      <legend className="sr-only">Company-wide overtime checkout window</legend>
      <div className="grid max-w-sm grid-cols-2 gap-3">
        <div className="space-y-1"><Label htmlFor="ot-policy-hours">Hours</Label><Input id="ot-policy-hours" name="hours" type="number" min={0} max={MAX_OVERTIME_POLICY_MINUTES / 60} step={1} required defaultValue={Math.floor(maxOpenMinutes / 60)} className="h-11" /></div>
        <div className="space-y-1"><Label htmlFor="ot-policy-minutes">Minutes</Label><Input id="ot-policy-minutes" name="minutes" type="number" min={0} max={59} step={1} required defaultValue={maxOpenMinutes % 60} className="h-11" /></div>
      </div>
      <p className="text-sm text-muted-foreground">An overtime session without checkout becomes Incomplete after this duration. This limit does not count as credited overtime hours.</p>
      <p className="text-sm text-muted-foreground">Company-wide. Applies to new overtime check-ins only; existing sessions retain their original window. Allowed range: 1 minute to 48 hours.</p>
      <Button type="submit" className="min-h-11">{pending ? "Saving…" : "Save overtime policy"}</Button>
    </fieldset>
    <p role="status" className="text-sm">{message}</p>
  </form>;
}
