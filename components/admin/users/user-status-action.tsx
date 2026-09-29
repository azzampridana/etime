"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertDialog, DropdownMenu, Tooltip } from "radix-ui";
import { EllipsisVertical } from "lucide-react";
import { deleteUserAction, setUserActiveStatusAction } from "@/actions/users";
import { Button } from "@/components/ui/button";
import { useNotification } from "@/components/shared/notification-provider";

export function UserStatusAction({ id, name, isActive, isSelf }: { id: string; name: string; isActive: boolean; isSelf: boolean }) {
  const router = useRouter();
  const notify = useNotification();
  const [operation, setOperation] = useState<"status" | "delete" | null>(null);
  const requested = useRef<"status" | "delete" | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const submitting = useRef(false);
  const deleted = useRef(false);
  const [pending, setPending] = useState(false);
  const statusLabel = isActive ? "Deactivate" : "Activate";
  const label = operation === "delete" ? "Delete User" : statusLabel;
  async function change() {
    if (submitting.current || !operation) return;
    submitting.current = true;
    setPending(true);
    try {
      const result = operation === "delete" ? await deleteUserAction(id) : await setUserActiveStatusAction({ id, isActive: !isActive });
      setOperation(null);
      notify(result.success ? "success" : "error", result.success ? operation === "delete" ? "User deleted successfully." : isActive ? "User deactivated successfully." : "User activated successfully." : result.message);
      if (result.success) {
        deleted.current = operation === "delete";
        router.refresh();
      }
    } catch { setOperation(null); notify("error", "Unable to reach the server. Please try again."); }
    finally { submitting.current = false; setPending(false); }
  }
  const itemClass = "cursor-pointer rounded px-3 py-2 text-sm outline-none data-highlighted:bg-accent data-disabled:pointer-events-none data-disabled:opacity-50";
  return <div>
    <DropdownMenu.Root>
      <Tooltip.Provider delayDuration={300}><Tooltip.Root><Tooltip.Trigger asChild><DropdownMenu.Trigger asChild>
        <Button ref={trigger} variant="ghost" className="size-10 p-0" aria-label={`More actions for ${name}`}><EllipsisVertical aria-hidden="true" className="size-4" /></Button>
      </DropdownMenu.Trigger></Tooltip.Trigger><Tooltip.Portal><Tooltip.Content sideOffset={5} className="z-50 rounded bg-foreground px-2 py-1 text-xs text-background">More actions</Tooltip.Content></Tooltip.Portal></Tooltip.Root></Tooltip.Provider>
      <DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={5} collisionPadding={12} className="z-40 min-w-44 rounded-lg border bg-popover p-1 shadow-md"
        onCloseAutoFocus={event => { if (requested.current) { event.preventDefault(); setOperation(requested.current); requested.current = null; } }}>
        <DropdownMenu.Item className={itemClass} disabled={isSelf && isActive} onSelect={() => { requested.current = "status"; }}>{statusLabel}</DropdownMenu.Item>
        <DropdownMenu.Item className={itemClass} asChild><Link href={`/admin/attendance?userId=${id}`}>View Attendance</Link></DropdownMenu.Item>
        <DropdownMenu.Separator className="my-1 h-px bg-border" />
        <DropdownMenu.Item className={`${itemClass} text-destructive`} disabled={isSelf} onSelect={() => { requested.current = "delete"; }}>Delete</DropdownMenu.Item>
        {isSelf && <DropdownMenu.Label className="px-3 py-2 text-xs text-muted-foreground">Your current account is protected.</DropdownMenu.Label>}
      </DropdownMenu.Content></DropdownMenu.Portal>
    </DropdownMenu.Root>
    <AlertDialog.Root open={operation !== null} onOpenChange={open => { if (!open && !pending) setOperation(null); }}>
      <AlertDialog.Portal><AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-background p-5 shadow-lg"
          onEscapeKeyDown={event => { if (pending) event.preventDefault(); }}
          onCloseAutoFocus={event => { event.preventDefault(); (!deleted.current && trigger.current?.isConnected ? trigger.current : document.getElementById("users-heading"))?.focus(); }}>
          <AlertDialog.Title className="text-lg font-semibold">{label}?</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 break-words text-sm text-muted-foreground">
            {operation === "delete" ? `Permanently delete “${name}”? This is only available for accounts without protected operational history.` : `${statusLabel} ${name}? ${isActive ? "Account access will be blocked. Historical records will remain available." : "Account access will be restored."}`}
          </AlertDialog.Description>
          <div className="mt-5 flex justify-end gap-2"><AlertDialog.Cancel asChild><Button variant="outline" className="h-10" disabled={pending}>Cancel</Button></AlertDialog.Cancel>
            <Button className="h-10" variant={operation === "delete" ? "destructive" : "default"} disabled={pending} onClick={change}>{pending ? "Saving…" : label}</Button></div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  </div>;
}
