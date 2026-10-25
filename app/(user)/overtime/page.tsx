import { OvertimeEventForm } from "@/components/overtime/overtime-event-form";
import { OvertimeSummary } from "@/components/overtime/overtime-summary";
import { getOvertimePage } from "@/services/overtime.service";
import { requirePageUser } from "@/lib/authorization/page-access";
import { UserOvertimeNavigation } from "@/components/overtime/user-overtime-navigation";

export default async function Page() {
  const user = await requirePageUser();
  const result = await getOvertimePage(user.id);
  return <><header className="mb-5 space-y-1.5"><h1 className="text-2xl font-semibold tracking-tight">Overtime</h1><p className="text-xs leading-5 text-slate-600">Photo and location evidence for authorized overtime work.</p></header>
    <UserOvertimeNavigation active="current" />
    <div className="min-w-0 space-y-5">
      {result.previousIncomplete && result.state !== "incomplete" && <aside className="space-y-1 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm leading-6 text-amber-900"><h2 className="font-semibold">Previous overtime incomplete</h2><p>Your previous overtime session ({result.previousIncomplete.workDate}) was not checked out. It does not block a new authorized session.</p></aside>}
      {result.state === "unavailable" && <p className="rounded-2xl border border-slate-200/70 bg-white/90 p-5 text-sm leading-6 shadow-sm shadow-slate-950/5">{result.message}</p>}
      {result.state === "authorized" && <><div className="space-y-3 rounded-2xl border border-indigo-100 bg-white/95 p-5 shadow-sm shadow-indigo-950/5"><h2 className="w-fit rounded-xl bg-indigo-50 px-3 py-2 font-semibold text-indigo-900">Overtime authorized</h2><p className="text-xs text-slate-600">Work date: {result.workDate}</p><p className="text-sm">Regular attendance completed.</p>{result.note && <p className="border-t border-slate-200/70 pt-3 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">Authorization note: {result.note}</p>}</div><OvertimeEventForm key={`in-${result.workDate}`} mode="check-in" /></>}
      {(result.state === "open" || result.state === "completed" || result.state === "incomplete") && <OvertimeSummary overtime={result.overtime} />}
      {result.state === "open" && <OvertimeEventForm key={`out-${result.overtime.id}`} mode="check-out" />}
    </div>
  </>;
}
