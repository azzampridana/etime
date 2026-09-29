"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { saveWorkScheduleAction } from "@/actions/work-schedules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function WorkScheduleForm({ schedule }: { schedule?: { id: string; name: string; requiredWorkMinutes: number; isActive: boolean } }) {
  const [pending, setPending] = useState(false), [message, setMessage] = useState(""); const router = useRouter();
  const prefix = schedule?.id ?? "new";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending) return;
    const form = event.currentTarget, data = new FormData(form); setPending(true); setMessage("");
    try {
      const result = await saveWorkScheduleAction({ id: schedule?.id, name: data.get("name"), requiredWorkMinutes: Number(data.get("requiredWorkMinutes")), isActive: data.get("isActive") === "on" });
      setMessage(result.message); if (result.success) { if (!schedule) form.reset(); router.refresh(); }
    } catch { setMessage("Unable to save. Please try again."); } finally { setPending(false); }
  }
  return <form onSubmit={submit} className="space-y-3 rounded-lg border p-4"><h2 className="font-semibold">{schedule ? "Edit duration policy" : "New duration policy"}</h2><fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
    <div><Label htmlFor={`${prefix}-name`}>Name</Label><Input id={`${prefix}-name`} name="name" required maxLength={100} defaultValue={schedule?.name ?? ""} /></div>
    <div><Label htmlFor={`${prefix}-minutes`}>Required work duration (minutes)</Label><Input id={`${prefix}-minutes`} name="requiredWorkMinutes" type="number" min={1} max={65535} step={1} required defaultValue={schedule?.requiredWorkMinutes ?? 480} /></div>
    <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="isActive" defaultChecked={schedule?.isActive ?? true} />Active</label>
    <Button type="submit" className="min-h-11">{pending ? "Saving…" : "Save duration policy"}</Button>
  </fieldset><p role="status" className="text-sm">{message}</p></form>;
}
