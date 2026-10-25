"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useNotification } from "@/components/shared/notification-provider";
import { approveAttendanceCorrectionAction, rejectAttendanceCorrectionAction } from "@/actions/attendance-correction/decide";

export function DecisionControls({ id, expectedVersion, employee, workDate, type }: {
  id: string; expectedVersion: string; employee: string; workDate: string; type: string;
}) {
  const router = useRouter();
  const notify = useNotification();
  const busy = useRef(false);
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [pending, setPending] = useState(false);
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!decision || busy.current || locked) return;
    const reviewNote = String(new FormData(event.currentTarget).get("reviewNote") ?? "").trim();
    if (decision === "REJECTED" && !reviewNote) { setFeedback("A rejection reason is required."); return; }
    busy.current = true;
    setPending(true);
    try {
      const input = { requestId: id, expectedVersion, decision, reviewNote };
      const result = await (decision === "APPROVED" ? approveAttendanceCorrectionAction(input) : rejectAttendanceCorrectionAction(input));
      const message = [result.message, ...Object.values(result.fieldErrors ?? {}).flat()].join(" ");
      setFeedback(message);
      notify(result.success ? "success" : "error", message);
      // Hide controls after confirmation, and also after conflicts until an authoritative reload.
      setLocked(true);
      setDecision(null);
      router.refresh();
    } catch {
      setFeedback("The decision result could not be confirmed. Reload the request before trying again.");
      setLocked(true);
      setDecision(null);
    } finally { busy.current = false; setPending(false); }
  }
  return <div className="space-y-3 rounded-xl border bg-card p-4">
    {feedback && <p role="status" className="text-sm">{feedback}</p>}
    {locked ? <Button className="min-h-11" variant="outline" onClick={() => window.location.reload()}>Reload authoritative request state</Button>
      : <div className="flex flex-wrap gap-3"><Button className="min-h-11" onClick={() => setDecision("APPROVED")}>Approve</Button><Button className="min-h-11" variant="destructive" onClick={() => setDecision("REJECTED")}>Reject</Button></div>}
    <Dialog.Root open={decision !== null} onOpenChange={open => { if (!open && !busy.current) setDecision(null); }}>
      <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-card p-5 shadow-lg"
          onEscapeKeyDown={event => { if (pending) event.preventDefault(); }} onPointerDownOutside={event => { if (pending) event.preventDefault(); }}>
          <Dialog.Title className="text-lg font-semibold">{decision === "APPROVED" ? "Approve correction?" : "Reject correction?"}</Dialog.Title>
          <Dialog.Description className="my-3 text-sm text-muted-foreground">{employee} · {workDate} · {type}. {decision === "APPROVED" ? "Approval creates or updates official Attendance and ensures a valid Daily Report. Existing valid reports are preserved." : "Rejection leaves Attendance unchanged."} The employee proposal cannot be edited.</Dialog.Description>
          <form onSubmit={submit} className="space-y-4">
            <label className="block space-y-2 text-sm font-medium">{decision === "REJECTED" ? "Rejection reason (required)" : "Review note (optional)"}<Textarea name="reviewNote" required={decision === "REJECTED"} maxLength={2000} disabled={pending} rows={4} /></label>
            {feedback && <p role="alert" className="text-sm">{feedback}</p>}
            <div className="flex flex-wrap justify-end gap-3"><Button type="button" variant="outline" disabled={pending} onClick={() => setDecision(null)}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? "Saving…" : "Confirm decision"}</Button></div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </div>;
}
