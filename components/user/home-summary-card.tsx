import Link from "next/link";
import { ArrowRight, CalendarCheck, Timer } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { formatAdminEventTime } from "@/lib/date-time/event-time";

type EventTime = { at: string; timezone: string | null };
const tones = {
  warning: "bg-amber-50 text-amber-900",
  neutral: "bg-muted text-muted-foreground",
  active: "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  success: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
};

function SummaryEvent({ label, event, placeholder }: { label: string; event: EventTime | null; placeholder: string }) {
  return (
    <div className="min-w-0 space-y-1 [overflow-wrap:anywhere]">
      <dt className="text-xs leading-4 font-semibold tracking-wide text-muted-foreground">{label}</dt>
      <dd>{event ? <time dateTime={event.at} title={formatAdminEventTime(event.at, event.timezone ?? "Asia/Jakarta")}
        aria-label={formatAdminEventTime(event.at, event.timezone ?? "Asia/Jakarta")} className="text-base leading-5 font-semibold tabular-nums">
        {formatAdminEventTime(event.at, event.timezone ?? "Asia/Jakarta", true)}
      </time> : <span className="text-xs leading-4 text-muted-foreground">{placeholder}</span>}</dd>
    </div>
  );
}

export function HomeSummaryCard({ id, title, workDate, status, tone, checkIn, checkOut, checkOutPlaceholder = "Not yet",
  showEvents = true, showCheckOut = true, description, href, cta, primary = false }: {
  id: string; title: string; workDate?: string; status: string; tone: keyof typeof tones;
  checkIn: EventTime | null; checkOut: EventTime | null; checkOutPlaceholder?: string;
  showEvents?: boolean; showCheckOut?: boolean; description?: string; href: "/attendance" | "/overtime"; cta: string; primary?: boolean;
}) {
  const Icon = href === "/attendance" ? CalendarCheck : Timer;
  return (
    <section aria-labelledby={id}>
      <Card className={`rounded-2xl ring-slate-200/70 [--card-spacing:--spacing(3)] ${primary ? "bg-linear-to-br from-white via-white to-blue-50/80 shadow-lg shadow-blue-950/5" : "bg-white/90 shadow-sm shadow-slate-950/5"}`}>
        <CardHeader className="gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${primary ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}><Icon aria-hidden="true" className="size-4" /></span>
            <div className="min-w-0 [overflow-wrap:anywhere]">
            <h2 id={id} className="text-sm leading-5 font-semibold text-muted-foreground">{title}</h2>
            {workDate && <p className="mt-0.5 text-xs leading-4 text-muted-foreground">Work date: {workDate}</p>}
            </div>
          </div>
          <span className={`inline-flex w-fit max-w-full items-center gap-1.5 rounded-lg px-2 py-1 text-xs leading-4 font-semibold [overflow-wrap:anywhere] ${tones[tone]}`}>
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />{status}
          </span>
        </CardHeader>
        <CardContent className="space-y-3">
          {description && <p className="text-xs leading-4 text-muted-foreground">{description}</p>}
          {showEvents && <dl className="grid grid-cols-1 gap-3 border-t border-slate-200/70 pt-3 min-[360px]:grid-cols-2">
            <SummaryEvent label="CHECK IN" event={checkIn} placeholder="Not checked in yet" />
            {showCheckOut && <SummaryEvent label="CHECK OUT" event={checkOut} placeholder={checkOutPlaceholder} />}
          </dl>}
        </CardContent>
        <CardFooter className="border-t border-slate-200/70 bg-transparent py-0">
          <Link href={href} className="group flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-2 py-2 text-xs leading-4 font-semibold text-blue-900 transition-colors hover:bg-blue-50 active:bg-blue-100 motion-safe:active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 motion-reduce:transition-none">
            <span className="min-w-0 [overflow-wrap:anywhere]">{cta}</span><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-50 group-hover:bg-blue-100"><ArrowRight aria-hidden="true" className="size-4" /></span>
          </Link>
        </CardFooter>
      </Card>
    </section>
  );
}
