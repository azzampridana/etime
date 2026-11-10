"use client";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { AlertDialog } from "radix-ui";
import { AlertTriangle, Info, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Confirmation = {
  title: string; description: string; context?: ReactNode;
  confirmLabel?: string; cancelLabel?: string; variant?: "neutral" | "warning" | "danger"; icon?: ReactNode;
  onConfirm: () => boolean | void | Promise<boolean | void>;
};
export function ConfirmDialog({ open, title, description, context, confirmLabel = "Lanjutkan", cancelLabel = "Batal", variant = "neutral", icon,
  pending, disabled, error, onCancel, onConfirm, onRestoreFocus }: Omit<Confirmation, "onConfirm"> & {
    open: boolean; pending: boolean; disabled?: boolean; error?: string; onCancel: () => void; onConfirm: () => void; onRestoreFocus?: () => void;
  }) {
  const Icon = variant === "danger" ? Trash2 : variant === "warning" ? AlertTriangle : Info;
  return <AlertDialog.Root open={open} onOpenChange={value => { if (!value && !pending) onCancel(); }}><AlertDialog.Portal>
    <AlertDialog.Overlay className="fixed inset-0 z-[60] bg-black/50" />
    <AlertDialog.Content onEscapeKeyDown={event => { event.stopPropagation(); if (pending) event.preventDefault(); }} onCloseAutoFocus={event => { if (onRestoreFocus) { event.preventDefault(); onRestoreFocus(); } }}
      className="fixed left-1/2 top-1/2 z-[61] max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 overflow-y-auto rounded-xl border bg-background p-5 text-foreground shadow-lg" aria-busy={pending}>
      <div className="flex items-start gap-3"><span aria-hidden="true" className={variant === "danger" ? "text-destructive" : variant === "warning" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}>{icon ?? <Icon className="size-5" />}</span><div className="min-w-0 space-y-2"><AlertDialog.Title className="font-semibold">{title}</AlertDialog.Title><AlertDialog.Description className="break-words text-sm text-muted-foreground">{description}</AlertDialog.Description></div></div>
      {context}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2"><AlertDialog.Cancel asChild><Button type="button" variant="outline" className="min-h-11" disabled={pending}>{cancelLabel}</Button></AlertDialog.Cancel><Button type="button" variant={variant === "danger" ? "destructive" : "default"} className="min-h-11" disabled={pending || disabled} onClick={onConfirm}>{pending ? "Memproses…" : confirmLabel}</Button></div>
    </AlertDialog.Content>
  </AlertDialog.Portal></AlertDialog.Root>;
}

/** Returning false retains the dialog; conflicts can disable retry until an explicit reload. */
export function useConfirmDialog() {
  const [options, setOptions] = useState<Confirmation | null>(null);
  const [pending, setPending] = useState(false), [failed, setFailed] = useState(false);
  const active = useRef(false), busy = useRef(false), opener = useRef<HTMLElement | null>(null);
  const request = useCallback((next: Confirmation) => {
    if (active.current) return;
    active.current = true; opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setFailed(false); setOptions(next);
  }, []);
  const close = () => { if (!busy.current) { active.current = false; setOptions(null); } };
  async function execute() {
    if (!options || busy.current) return;
    busy.current = true; setPending(true); setFailed(false);
    try { if (await options.onConfirm() === false) setFailed(true); else { active.current = false; setOptions(null); } }
    catch { setFailed(true); }
    finally { busy.current = false; setPending(false); }
  }
  return { request, isOpen: () => active.current, dialog: (error = "", disabled = false) => options ? <ConfirmDialog {...options} open pending={pending} disabled={disabled}
    error={failed ? error || "Operasi belum selesai. Periksa pesan dan data terbaru sebelum mencoba lagi." : undefined} onCancel={close} onConfirm={() => void execute()}
    onRestoreFocus={() => { if (opener.current?.isConnected) opener.current.focus(); }} /> : null };
}
