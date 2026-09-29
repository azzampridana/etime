"use client";

import { useState } from "react";
import { Dialog } from "radix-ui";
import { Menu, X } from "lucide-react";
import { NavigationLinks } from "@/components/shared/navigation-links";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/shared/brand";

export function AdminMobileNavigation() {
  const [open, setOpen] = useState(false);
  return <Dialog.Root open={open} onOpenChange={setOpen}>
    <Dialog.Trigger asChild>
      <Button type="button" variant="ghost" className="size-11 p-0 md:hidden" aria-label="Open Admin navigation"><Menu aria-hidden="true" className="size-5" /></Button>
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
      <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[calc(100vw-2rem)] flex-col border-r bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-lg">
        <div className="flex items-center justify-between gap-3 border-b p-3">
          <Brand />
          <Dialog.Title className="sr-only">Admin navigation</Dialog.Title>
          <Dialog.Close asChild><Button type="button" variant="ghost" className="size-11 p-0" aria-label="Close Admin navigation"><X aria-hidden="true" className="size-5" /></Button></Dialog.Close>
        </div>
        <Dialog.Description className="sr-only">Choose an ETime administration page.</Dialog.Description>
        <nav aria-label="Admin navigation" className="flex-1 space-y-1 overflow-y-auto p-3"><NavigationLinks area="admin" onNavigate={() => setOpen(false)} /></nav>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
