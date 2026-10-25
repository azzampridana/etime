import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { z } from "zod";
import { ApplicationError } from "@/lib/errors/application-error";
import { getOvertimeCorrectionContext } from "@/services/overtime-correction.service";
import { formatAdminEventTime } from "@/lib/date-time/event-time";
import { OvertimeCorrectionRequestForm } from "@/components/overtime/correction-request-form";

export default async function Page({ searchParams }: { searchParams: Promise<{ overtimeId?: string }> }) {
  const { overtimeId } = await searchParams;
  let context: Awaited<ReturnType<typeof getOvertimeCorrectionContext>> | null = null;
  let message: string | null = null;
  try { context = await getOvertimeCorrectionContext(overtimeId); }
  catch (error) {
    if (error instanceof z.ZodError) message = "Choose a session from Overtime History first.";
    else if (error instanceof ApplicationError) message = error.message;
    else throw error;
  }
  return <div className="mx-auto w-full min-w-0 max-w-5xl space-y-5 [overflow-wrap:anywhere]">
    <Button asChild variant="outline" className="min-h-11 max-w-full whitespace-normal text-center"><Link href="/overtime/requests" >Back to requests</Link></Button>
    <h1 className="text-2xl font-semibold">Request missing Overtime Checkout</h1>
    {message && <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm">{message}</p>}
    {context && <>
      <Card className="min-w-0 rounded-2xl"><CardContent className="space-y-3 text-sm">
        <h2 className="font-semibold">Session reference · WIB</h2>
        <dl className="grid gap-4 sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">Original Check-In</dt><dd className="mt-1 font-medium">{formatAdminEventTime(context.checkInAt, "Asia/Jakarta")}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Technical Checkout deadline</dt><dd className="mt-1 font-medium">{formatAdminEventTime(context.deadlineAt, "Asia/Jakarta")}</dd></div></dl>
        <p className="rounded-lg bg-muted/50 p-3">Submit by the end of <strong>{context.lastSubmissionDate}</strong> (WIB).</p>
        <p className="text-xs text-muted-foreground">The technical deadline limits an open session; it is not credited overtime duration.</p>
      </CardContent></Card>
      {context.unavailableReason ? <p role="status" className="rounded-xl border bg-muted/50 p-4 text-sm">{context.unavailableReason}</p> : <OvertimeCorrectionRequestForm overtimeId={context.overtimeId} />}
      {context.existingRequestId && <Button asChild variant="outline" className="min-h-11 max-w-full whitespace-normal text-center"><Link  href={`/overtime/requests/${context.existingRequestId}`}>View existing request</Link></Button>}
    </>}
    <Button asChild variant="outline" className="min-h-11 max-w-full whitespace-normal text-center"><Link href="/overtime/history" >Open Overtime History</Link></Button>
  </div>;
}
