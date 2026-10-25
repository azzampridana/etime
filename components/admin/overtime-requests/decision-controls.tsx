"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { approveOvertimeCorrectionAction, rejectOvertimeCorrectionAction } from "@/actions/overtime-correction/decide";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function OvertimeDecisionControls({ requestId, expectedVersion, employeeActive }: {
  requestId: string; expectedVersion: string; employeeActive: boolean;
}) {
  const router = useRouter();
  const busy = useRef(false);
  const decisionHeading = useRef<HTMLHeadingElement>(null);
  const [pending, setPending] = useState(false);
  const [locked, setLocked] = useState(false);
  const [note, setNote] = useState("");
  const [confirmation, setConfirmation] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [message, setMessage] = useState("");
  async function decide() {
    if (!confirmation || busy.current || locked) return;
    if (confirmation === "REJECTED" && !note.trim()) { setMessage("A rejection reason is required."); return; }
    busy.current = true; setPending(true); setMessage("");
    try {
      const action = confirmation === "APPROVED" ? approveOvertimeCorrectionAction : rejectOvertimeCorrectionAction;
      const result = await action({ requestId, expectedVersion, decision: confirmation, reviewNote: note });
      setMessage(result.message);
      // Any decision response needs authoritative reload; never automatically retry a mutation.
      setLocked(true); setConfirmation(null);
      if (result.success) router.refresh();
    } catch {
      setLocked(true); setConfirmation(null);
      setMessage("Decision outcome is unknown. Reload the request to inspect its status before acting again.");
    } finally { busy.current = false; setPending(false); }
  }
  return <Card className="rounded-2xl" aria-busy={pending}><CardHeader><h2 ref={decisionHeading} tabIndex={-1} className="rounded text-lg font-semibold focus-visible:outline-2 focus-visible:outline-ring">ADMIN decision</h2><p className="text-sm text-muted-foreground">Review the proposal before confirming your decision.</p></CardHeader><CardContent className="space-y-4">
    {!employeeActive && <p className="rounded-xl bg-muted/50 p-3 text-sm">The employee is inactive. Approval is unavailable; rejection remains available.</p>}
    <label className="block space-y-2 text-sm font-medium">Review note (required for rejection)
      <Textarea className="min-h-28 rounded-xl" value={note} onChange={event => setNote(event.target.value)} maxLength={2000} rows={4} disabled={pending || locked || !!confirmation} />
    </label>
    {!confirmation ? <div className="flex flex-wrap gap-3">
      <Button className="min-h-11 flex-1 sm:flex-none" onClick={() => setConfirmation("APPROVED")} disabled={pending || locked || !employeeActive}>Approve</Button>
      <Button className="min-h-11 flex-1 sm:flex-none" variant="destructive" onClick={() => { if (!note.trim()) setMessage("A rejection reason is required."); else setConfirmation("REJECTED"); }} disabled={pending || locked}>Reject</Button>
    </div> : null}
    <Dialog.Root open={confirmation !== null} onOpenChange={open => { if (!open && !busy.current) setConfirmation(null); }}>
      <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-card p-5 shadow-lg [overflow-wrap:anywhere]"
          onCloseAutoFocus={event => { event.preventDefault(); decisionHeading.current?.focus(); }}
          onEscapeKeyDown={event => { if (pending) event.preventDefault(); }} onPointerDownOutside={event => { if (pending) event.preventDefault(); }}>
          <Dialog.Title className="text-lg font-semibold">{confirmation === "APPROVED" ? "Approve correction?" : "Reject correction?"}</Dialog.Title>
          <Dialog.Description className="mt-3 text-sm text-muted-foreground">{confirmation === "APPROVED" ? "This records the proposed official Checkout without fabricated GPS, photo or event timezone. Recorded duration does not automatically approve compensation." : "The request becomes terminal and official overtime remains unchanged."}</Dialog.Description>
          {note && <div className="mt-4 rounded-xl bg-muted/50 p-3 text-sm"><p className="font-medium">Review note</p><p className="mt-1 whitespace-pre-wrap">{note}</p></div>}
          <div className="mt-5 flex flex-wrap justify-end gap-3"><Button className="min-h-11" variant="outline" disabled={pending} onClick={() => setConfirmation(null)}>Cancel</Button>
            <Button className="min-h-11" variant={confirmation === "REJECTED" ? "destructive" : "default"} disabled={pending} onClick={decide}>{pending ? "Saving…" : "Confirm decision"}</Button></div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    {message && <p role="status" className="rounded-xl border bg-muted/50 p-3 text-sm">{message}</p>}
    {locked && <Button className="min-h-11 max-w-full whitespace-normal" variant="outline" onClick={() => window.location.reload()}>Reload authoritative status</Button>}
  </CardContent></Card>;
}
