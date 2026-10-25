import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePageUser } from "@/lib/authorization/page-access";
import { ApplicationError } from "@/lib/errors/application-error";
import { correctionDateBounds, getCorrectionFormContext } from "@/services/attendance-correction.service";
import { CorrectionRequestForm } from "@/components/attendance/correction-request-form";
import { PageHeading } from "@/components/shared/page-heading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CorrectionFormContext } from "@/types/attendance-correction";

export default async function NewCorrectionPage({ searchParams }: { searchParams: Promise<{ workDate?: string; attendanceId?: string }> }) {
  const user = await requirePageUser();
  if (user.role !== "USER") redirect("/admin");
  const query = await searchParams;
  const bounds = correctionDateBounds();
  let context: CorrectionFormContext | null = null;
  let error: string | null = null;
  if (query.workDate) {
    try { context = await getCorrectionFormContext(user.id, query.workDate, query.attendanceId); }
    catch (cause) {
      if (cause instanceof ApplicationError) error = cause.message;
      else if (cause instanceof z.ZodError) error = "Choose a valid work date and attendance record.";
      else throw cause;
    }
  }
  return <div className="space-y-4">
    <PageHeading title="Request a correction" description="Yesterday through 30 calendar days ago, using Asia/Jakarta business dates." />
    {!query.attendanceId && <form action="/attendance/requests/new" className="space-y-3 rounded-2xl border bg-card p-4">
      <label className="block space-y-2 text-sm font-medium">Missing Attendance work date<Input type="date" name="workDate" min={bounds.from} max={bounds.to} required defaultValue={query.workDate} className="min-h-11" /></label>
      <Button type="submit" variant="outline" className="min-h-11">Continue</Button>
    </form>}
    {error && <div role="alert" className="space-y-2 rounded-xl border bg-card p-4 text-sm"><p>{error}</p><Button asChild variant="outline" className="min-h-11"><Link href="/attendance?view=history">Open Attendance List</Link></Button></div>}
    {context?.pendingRequestId ? <div className="rounded-xl border bg-card p-4 text-sm">A pending request already exists. <Button asChild variant="outline" className="min-h-11"><Link href={`/attendance/requests/${context.pendingRequestId}`}>View request</Link></Button></div>
      : context && <CorrectionRequestForm key={`${context.workDate}:${context.attendanceId ?? "new"}`} context={context} />}
  </div>;
}
