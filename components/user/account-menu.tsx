"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertDialog, DropdownMenu } from "radix-ui";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";

export type AccountIdentity = { name: string; position: string | null; email: string };

function SignOutActions() {
  const { pending } = useFormStatus();
  return (
    <div className="mt-6 flex justify-end gap-3">
      <AlertDialog.Cancel asChild>
        <Button type="button" variant="outline" disabled={pending} className="h-11">Cancel</Button>
      </AlertDialog.Cancel>
      <Button type="submit" disabled={pending} className="h-11" aria-disabled={pending}>
        {pending ? "Signing out…" : "Sign Out"}
      </Button>
    </div>
  );
}

export function AccountMenu({ user }: { user: AccountIdentity }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const confirmationRequested = useRef(false);
  const words = user.name.trim().split(/\s+/).filter(Boolean);
  const initials = (words.length > 1
    ? `${Array.from(words[0])[0]}${Array.from(words[words.length - 1])[0]}`
    : Array.from(words[0] ?? "")[0] ?? "?").toLocaleUpperCase("en");

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button ref={triggerRef} type="button" variant="secondary" aria-label="Open account menu" className="size-11 rounded-full p-0">
            <span aria-hidden="true">{initials}</span>
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end" sideOffset={8} collisionPadding={12}
            className="z-40 w-72 max-w-[calc(100vw-1.5rem)] rounded-xl border bg-popover p-2 text-popover-foreground shadow-md outline-none"
            onCloseAutoFocus={(event) => {
              // Hand focus to the dialog only after the menu has unmounted.
              if (confirmationRequested.current) {
                event.preventDefault();
                confirmationRequested.current = false;
                setConfirmOpen(true);
              }
            }}
          >
            <DropdownMenu.Label className="space-y-1 px-3 py-2 [overflow-wrap:anywhere]">
              <p className="text-sm font-semibold">{user.name.trim() || "Account"}</p>
              {user.position && <p className="text-sm font-normal text-muted-foreground">{user.position}</p>}
              <p className="text-xs font-normal text-muted-foreground">{user.email}</p>
            </DropdownMenu.Label>
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            <DropdownMenu.Item
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
              onSelect={() => { confirmationRequested.current = true; }}
            >
              <LogOut aria-hidden="true" className="size-4" />Sign Out
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <AlertDialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <AlertDialog.Content
            className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-lg"
            onCloseAutoFocus={(event) => { event.preventDefault(); triggerRef.current?.focus(); }}
          >
            <AlertDialog.Title className="text-lg font-semibold">Sign out?</AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to sign out of ETime?
            </AlertDialog.Description>
            <form action={logoutAction}><SignOutActions /></form>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}
