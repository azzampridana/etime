import { PageHeading } from "@/components/shared/page-heading";
import { OvertimeEventForm } from "@/components/overtime/overtime-event-form";
import { OvertimeSummary } from "@/components/overtime/overtime-summary";
import { getOvertimePage } from "@/services/overtime.service";
import { requirePageUser } from "@/lib/authorization/page-access";

export default async function Page() {
  const user = await requirePageUser();
  const result = await getOvertimePage(user.id);
  return <><PageHeading title="Overtime" description="Photo and location evidence for authorized overtime work." />
    <div className="min-w-0 space-y-5">
      {result.previousIncomplete && result.state !== "incomplete" && <aside className="rounded-xl border p-4 text-sm text-muted-foreground"><h2 className="font-medium text-foreground">Previous overtime incomplete</h2><p>Your previous overtime session ({result.previousIncomplete.workDate}) was not checked out. It does not block a new authorized session.</p></aside>}
      {result.state === "unavailable" && <p className="rounded-xl border bg-card p-5">{result.message}</p>}
      {result.state === "authorized" && <><div className="space-y-2 rounded-xl border bg-card p-5"><h2 className="font-semibold">Overtime authorized</h2><p>Work date: {result.workDate}</p><p>Regular attendance completed.</p>{result.note && <p className="whitespace-pre-wrap break-words">Authorization note: {result.note}</p>}</div><OvertimeEventForm key={`in-${result.workDate}`} mode="check-in" /></>}
      {(result.state === "open" || result.state === "completed" || result.state === "incomplete") && <OvertimeSummary overtime={result.overtime} />}
      {result.state === "open" && <OvertimeEventForm key={`out-${result.overtime.id}`} mode="check-out" />}
    </div>
  </>;
}
