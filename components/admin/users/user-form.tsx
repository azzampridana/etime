"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createUserAction, updateUserAction } from "@/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Role } from "@/generated/prisma/enums";
import { formatDurationMinutes } from "@/lib/date-time/format-duration";
import type { UserDto } from "@/types/user";
import type { WorkScheduleOption } from "@/types/work-schedule";
import type { ActionResult } from "@/types/action-result";

export function UserForm({ user, schedules, onSuccess, onCancel, onPendingChange }: {
  user?: UserDto; schedules: WorkScheduleOption[];
  onSuccess?: (message: string) => void; onCancel?: () => void; onPendingChange?: (pending: boolean) => void;
}) {
  const router = useRouter();
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResult<UserDto>>({ success: false, message: "" });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const input = { name: data.get("name"), position: data.get("position"), email: data.get("email"), role: data.get("role"), workScheduleId: data.get("workScheduleId"), password: data.get("password") };
    submitting.current = true; setPending(true); onPendingChange?.(true); setResult({ success: false, message: "" });
    try {
      const response = user ? await updateUserAction({ ...input, id: user.id }) : await createUserAction({ ...input, isActive: data.get("isActive") === "on" });
      setResult({ ...response, message: response.success ? user ? "User updated." : "User created." : response.message });
      if (response.success) {
        const password = form.elements.namedItem("password");
        if (password instanceof HTMLInputElement) password.value = "";
        onSuccess?.(user ? "User updated." : "User created.");
        router.refresh();
      }
    } catch { setResult({ success: false, message: "Unable to reach the server. Please try again." }); }
    finally { submitting.current = false; setPending(false); onPendingChange?.(false); }
  }
  function error(field: string) { return result.fieldErrors?.[field]?.join(" "); }
  const scheduleAvailable = schedules.some((schedule) => schedule.id === user?.workSchedule.id);
  return <form onSubmit={submit} className={onCancel ? "min-w-0 space-y-3" : "min-w-0 max-w-2xl space-y-3 rounded-xl border bg-card p-5"} aria-busy={pending}>
    <fieldset disabled={pending} className="min-w-0 space-y-3 [&_input:not([type=checkbox])]:min-h-10 [&_select]:min-h-10 [&_select]:py-2">
      {([['name', 'Name', 'text'], ['email', 'Email', 'email'], ['password', user ? 'New password (optional)' : 'Password', 'password']] as const).map(([name, label, type]) => <div key={name} className="space-y-2">
        <Label htmlFor={name}>{label}</Label>
        <Input id={name} name={name} type={type} className="min-h-12 text-base" defaultValue={name === "password" ? "" : user?.[name] ?? ""} required={name !== "password" || !user}
          autoComplete={name === "password" ? "new-password" : name === "email" ? "off" : "name"} aria-invalid={!!error(name)} aria-describedby={error(name) ? `${name}-error` : undefined} />
        {error(name) && <p id={`${name}-error`} className="text-sm text-destructive">{error(name)}</p>}
        {name === "password" && user && <p className="text-sm text-muted-foreground">Leave blank to keep the existing password.</p>}
      </div>)}
      <div className="space-y-2"><Label htmlFor="position">Company position (optional)</Label><Input id="position" name="position" maxLength={100} defaultValue={user?.position ?? ""} className="min-h-12" />{error("position") && <p role="alert">{error("position")}</p>}</div>
      <div className="space-y-2"><Label htmlFor="role">System role</Label><select id="role" name="role" defaultValue={user?.role ?? Role.USER} className="min-h-12 w-full rounded-lg border bg-background p-3">
        {Object.values(Role).map((role) => <option key={role}>{role}</option>)}
      </select>{error("role") && <p role="alert">{error("role")}</p>}</div>
      <div className="space-y-2"><Label htmlFor="workScheduleId">WorkSchedule</Label>
        <select id="workScheduleId" name="workScheduleId" required defaultValue={user?.workSchedule.id ?? ""} className="min-h-12 w-full min-w-0 rounded-lg border bg-background p-3">
          <option value="" disabled>Select a schedule</option>
          {user && !scheduleAvailable && <option value={user.workSchedule.id} disabled>{user.workSchedule.name} — choose an available active schedule</option>}
          {schedules.map((schedule) => <option key={schedule.id} value={schedule.id}>{schedule.name} · Required {formatDurationMinutes(schedule.requiredWorkMinutes)}</option>)}
        </select>
        {error("workScheduleId") && <p role="alert">{error("workScheduleId")}</p>}
        {!schedules.length && <p role="alert">No active schedules are available. A usable schedule is required.</p>}
      </div>
      {!user && <label className="flex min-h-11 items-center gap-3"><input type="checkbox" name="isActive" defaultChecked className="size-5" />Active account</label>}
      <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-card pt-3 pb-1">
        {onCancel && <Button type="button" variant="outline" className="h-10" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" className="h-10" disabled={pending || !schedules.length}>{pending ? "Saving…" : user ? "Save Changes" : "Create User"}</Button>
      </div>
    </fieldset>
    <p role="status" className="break-words text-sm">{result.message}</p>
    {result.success && !onSuccess && <Link href="/admin/users" className="inline-flex min-h-11 items-center underline">Back to users</Link>}
  </form>;
}
