"use client";

import { useRef, useState } from "react";
import { Dialog, Tooltip } from "radix-ui";
import { Eye, X } from "lucide-react";
import { getAdminAttendanceAction } from "@/actions/attendance/get-admin-attendance";
import { AttendanceDetail } from "@/components/admin/attendance/attendance-detail";
import { Button } from "@/components/ui/button";
import type { AdminAttendanceDetailDto } from "@/types/admin-attendance";

export function AttendanceDetailDialog({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState<AdminAttendanceDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  async function load() {
    const version = ++request.current;
    setItem(null); setError(null);
    try {
      const result = await getAdminAttendanceAction(id);
      if (version !== request.current) return;
      if (result.success && result.data) setItem(result.data);
      else setError(result.message);
    } catch {
      if (version === request.current) setError("Unable to load attendance. Please try again.");
    }
  }
  return <Dialog.Root open={open} onOpenChange={next => {
    setOpen(next);
    if (next) void load();
    else { request.current++; setItem(null); setError(null); }
  }}>
    <Tooltip.Provider delayDuration={300}><Tooltip.Root>
      <Tooltip.Trigger asChild><Dialog.Trigger asChild><Button variant="ghost" className="size-10 p-0" aria-label={`View attendance for ${name}`}><Eye aria-hidden="true" className="size-4" /></Button></Dialog.Trigger></Tooltip.Trigger>
      <Tooltip.Portal><Tooltip.Content sideOffset={5} className="z-50 rounded bg-foreground px-2 py-1 text-xs text-background">View Details</Tooltip.Content></Tooltip.Portal>
    </Tooltip.Root></Tooltip.Provider>
    <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
      <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-card p-5 shadow-lg">
        <div className="flex items-center justify-between gap-3"><Dialog.Title className="text-lg font-semibold">Attendance Details</Dialog.Title><Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Close"><X aria-hidden="true" className="size-4" /></Button></Dialog.Close></div>
        <Dialog.Description className="mb-4 text-sm text-muted-foreground">Read-only attendance evidence.</Dialog.Description>
        {item ? <AttendanceDetail item={item} /> : error ? <div role="alert" className="space-y-3"><p>{error}</p><Button variant="outline" onClick={() => void load()}>Try again</Button></div> : <p role="status">Loading attendance…</p>}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
