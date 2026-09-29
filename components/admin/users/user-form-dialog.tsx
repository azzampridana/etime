"use client";

import { useState } from "react";
import { Dialog, Tooltip } from "radix-ui";
import { Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserForm } from "@/components/admin/users/user-form";
import { useNotification } from "@/components/shared/notification-provider";
import type { UserDto } from "@/types/user";
import type { WorkScheduleOption } from "@/types/work-schedule";

export function UserFormDialog({ user, schedules }: { user?: UserDto; schedules: WorkScheduleOption[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const notify = useNotification();
  return <div>
    <Dialog.Root open={open} onOpenChange={next => { if (!pending) setOpen(next); }}>
      <Tooltip.Provider delayDuration={300}><Tooltip.Root>
        <Tooltip.Trigger asChild><Dialog.Trigger asChild>
          <Button variant={user ? "ghost" : "default"} className={user ? "size-10 p-0" : "h-10"} aria-label={user ? `Edit ${user.name}` : "Add User"}>
            {user ? <Pencil aria-hidden="true" className="size-4" /> : <><Plus aria-hidden="true" className="size-4" />Add User</>}
          </Button>
        </Dialog.Trigger></Tooltip.Trigger>
        <Tooltip.Portal><Tooltip.Content sideOffset={5} className="z-50 rounded bg-foreground px-2 py-1 text-xs text-background">{user ? "Edit user" : "Add User"}</Tooltip.Content></Tooltip.Portal>
      </Tooltip.Root></Tooltip.Provider>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-card p-5 shadow-lg"
          onEscapeKeyDown={event => { if (pending) event.preventDefault(); }} onPointerDownOutside={event => { if (pending) event.preventDefault(); }}>
          <div className="flex items-center justify-between gap-3">
            <Dialog.Title className="text-lg font-semibold">{user ? "Edit User" : "Add User"}</Dialog.Title>
            <Dialog.Close asChild><Button type="button" variant="ghost" size="icon" disabled={pending} aria-label="Close"><X aria-hidden="true" className="size-4" /></Button></Dialog.Close>
          </div>
          <Dialog.Description className="mb-4 mt-1 text-sm text-muted-foreground">{user ? `Update ${user.name}'s account.` : "Create an employee account and assign a work schedule."}</Dialog.Description>
          {open && <UserForm user={user} schedules={schedules} onPendingChange={setPending} onCancel={() => { if (!pending) setOpen(false); }} onSuccess={text => { setOpen(false); notify("success", text); }} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </div>;
}
