"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotification } from "@/components/shared/notification-provider";
import { grantOvertimeAuthorizationAction, revokeOvertimeAuthorizationAction } from "@/actions/overtime-authorization";
import type { OvertimeAuthorizationAttendanceDto } from "@/types/overtime-authorization";

type AuthorizationControlItem = Pick<OvertimeAuthorizationAttendanceDto, "id" | "workDate" | "authorizationState"> & {
  employee: { name: string };
  authorization: { note: string | null } | null;
};

export function AuthorizationControls({ item, grantOnly = false, compact = false, canGrant = true }: { item: AuthorizationControlItem; grantOnly?: boolean; compact?: boolean; canGrant?: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const trigger = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const notify = useNotification();
  const revoke = !grantOnly && item.authorizationState === "Authorized";
  const label = grantOnly ? "Grant OT" : revoke ? "Revoke" : item.authorizationState === "Revoked" ? (compact ? "Regrant" : "Re-authorize") : "Grant";
  function close() { setConfirm(false); trigger.current?.focus(); }
  if (grantOnly && item.authorizationState !== "Not Authorized") return null;
  const confirmation = <form aria-label={`${grantOnly ? "Grant" : label} overtime for ${item.employee.name}`} className={compact ? "space-y-3" : "space-y-3 rounded-lg border p-3"} onSubmit={event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        const result = revoke ? await revokeOvertimeAuthorizationAction({ attendanceId: item.id })
          : await grantOvertimeAuthorizationAction({ attendanceId: item.id, note: String(form.get("note") ?? "") });
        const text = result.fieldErrors?.note?.join(" ") || result.message;
        if (compact) notify(result.success ? "success" : "error", text);
        else { setMessage(text); setFailed(!result.success); }
        if (result.success) { close(); router.refresh(); }
      } catch (error) {
        if (compact) notify("error", "Unable to update authorization. Please try again.");
        else throw error;
      }
    });
  }}>
    <p className="break-words">{grantOnly ? "Grant" : label} overtime for <strong>{item.employee.name}</strong> on <strong>{item.workDate}</strong>?</p>
    {!revoke && <label className="block space-y-2">Authorization note (optional)<textarea name="note" autoFocus maxLength={1000} defaultValue={item.authorization?.note ?? ""} disabled={pending} className="min-h-24 w-full rounded border bg-background p-2" /><span className="text-xs text-muted-foreground">Up to 1,000 characters.</span></label>}
    <div className="flex flex-wrap gap-2"><Button type="submit" disabled={pending}>{pending ? "Saving…" : `Confirm ${label.toLowerCase()}`}</Button><Button type="button" variant="outline" disabled={pending} onClick={close}>Cancel</Button></div>
  </form>;
  return <div className={compact ? "whitespace-nowrap" : grantOnly ? "max-w-80 space-y-2" : "min-w-60 max-w-80 space-y-2"}>
    <Button ref={trigger} type="button" variant={compact ? "outline" : "default"} className={compact ? "h-9 px-3 text-xs" : undefined} disabled={pending || (!revoke && !canGrant)} onClick={() => { setConfirm(true); setMessage(""); }}>{label}</Button>
    {compact ? <Dialog.Root open={confirm} onOpenChange={open => { if (!pending) { if (open) setConfirm(true); else close(); } }}><Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
      <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-card p-5 shadow-lg" onEscapeKeyDown={event => { if (pending) event.preventDefault(); }} onPointerDownOutside={event => { if (pending) event.preventDefault(); }} onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus(); }}>
        <div className="flex items-center justify-between"><Dialog.Title className="font-semibold">{label} overtime</Dialog.Title><Dialog.Close asChild><Button variant="ghost" size="icon" disabled={pending} aria-label="Close"><X className="size-4" aria-hidden="true" /></Button></Dialog.Close></div>
        <Dialog.Description className="mb-4 text-sm text-muted-foreground">Confirm this authorization change.</Dialog.Description>
        {confirmation}
      </Dialog.Content>
    </Dialog.Portal></Dialog.Root> : confirm && confirmation}
    {!compact && message && <p role={failed ? "alert" : "status"} className="break-words text-sm">{message}</p>}
  </div>;
}
